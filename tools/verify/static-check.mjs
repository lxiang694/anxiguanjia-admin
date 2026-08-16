import fs from 'fs';
import path from 'path';

const ROOT = process.env.PROJECT_ROOT ?? process.cwd();
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  }
})(ROOT);

const read = (f) => fs.readFileSync(f, 'utf8');
const rel = (f) => path.relative(ROOT, f);
const errors = [];
const warns = [];
const err = (f, m) => errors.push(`${rel(f)}: ${m}`);
const warn = (f, m) => warns.push(`${rel(f)}: ${m}`);

// ---- 1. 括号 / JSX 花括号平衡（粗粒度，能抓住结构性断裂）
for (const f of files) {
  const src = read(f);
  // 先去字符串再去注释：否则 startsWith('//') 里的 '//' 会被当成注释吃掉后面的括号
  const stripped = src
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  for (const [open, close, name] of [['{', '}', '花括号'], ['(', ')', '圆括号'], ['[', ']', '方括号']]) {
    const o = (stripped.match(new RegExp('\\' + open, 'g')) || []).length;
    const c = (stripped.match(new RegExp('\\' + close, 'g')) || []).length;
    if (o !== c) err(f, `${name}不平衡 ${o} vs ${c}`);
  }
}

// ---- 2. 客户端/服务端边界
for (const f of files) {
  const src = read(f);
  const isClient = /^['"]use client['"]/m.test(src.split('\n').slice(0, 3).join('\n'));
  if (isClient) {
    for (const bad of ['@/lib/db', '@/services/', '@/lib/auth', 'bcryptjs', 'server-only']) {
      if (new RegExp(`from ['"]${bad.replace(/[/]/g, '\\/')}`).test(src)) {
        err(f, `'use client' 文件不能 import ${bad}`);
      }
    }
    if (/prisma\./.test(src)) err(f, `'use client' 文件里出现 prisma.`);
  }
}

// ---- 3. import 的本地路径必须存在
const exts = ['.ts', '.tsx', '/index.ts', '/index.tsx', '.d.ts'];
for (const f of files) {
  const src = read(f);
  for (const m of src.matchAll(/from ['"](@\/[^'"]+|\.[^'"]+)['"]/g)) {
    let spec = m[1];
    let base = spec.startsWith('@/') ? path.join(ROOT, spec.slice(2)) : path.resolve(path.dirname(f), spec);
    if (!exts.some((e) => fs.existsSync(base + e)) && !fs.existsSync(base)) {
      err(f, `import 路径不存在：${spec}`);
    }
  }
}

// ---- 4. 命名纪律：界面文案不得出现禁用称呼
// 规则来自需求：不得把「一线成员」称为阿姨/服务阿姨/护工/陪护/陪诊阿姨/工作人员。
// 因此把「明确指代服务人员」的词判为错误；单独的「阿姨」可能是对长辈的敬称
// （例：服务记录里写「王阿姨表示昨晚一点才入睡」），列为需人工确认的警告。
const BANNED_STAFF = ['服务阿姨', '陪诊阿姨', '护工', '陪护', '保姆', '护理员', '工作人员'];
const REVIEW_TERMS = ['阿姨'];
// 说明规则本身的行不算违规
const META_LINE = /不(要|得|应|准)|严禁|禁用|统一称|避免|而不是|取代|BANNED|敬称/;
for (const f of files) {
  const src = read(f);
  const lines = src.split('\n');
  lines.forEach((l, i) => {
    if (META_LINE.test(l)) return;
    for (const b of BANNED_STAFF) {
      if (l.includes(b)) err(f, `第 ${i + 1} 行出现禁用称呼「${b}」：${l.trim().slice(0, 60)}`);
    }
    for (const b of REVIEW_TERMS) {
      if (!l.includes(b)) continue;
      // 「王阿姨」「李阿姨」这类姓氏 + 敬称，指的是长辈，不违规
      const asHonorific = new RegExp(`[\\u4e00-\\u9fa5]${b}`).test(l) && !/提醒阿姨|阿姨(更换|负责|上门|服务|前往)/.test(l);
      if (asHonorific) return;
      warn(f, `第 ${i + 1} 行的「${b}」需确认是否指服务人员：${l.trim().slice(0, 60)}`);
    }
  });
}

// ---- 5. Prisma include/select 里不得出现非字面量布尔
for (const f of files) {
  const src = read(f);
  for (const m of src.matchAll(/^\s*(\w+):\s*(!?[a-zA-Z_$][\w.$]*(?:\([^)]*\))?),\s*$/gm)) {
    const val = m[2];
    if (/^(true|false|null|undefined)$/.test(val)) continue;
  }
  for (const m of src.matchAll(/(select|include):\s*\{([^{}]|\{[^{}]*\})*\}/g)) {
    const block = m[0];
    for (const mm of block.matchAll(/(\w+):\s*(perms\.has\([^)]*\)|include\w*|can\([^)]*\)|show\w*)\s*[,}]/g)) {
      err(f, `Prisma ${m[1]} 里出现非字面量布尔 ${mm[1]}: ${mm[2]}（会破坏类型推导）`);
    }
  }
}

// ---- 6. 每个 Server Action 文件必须有 'use server' 且用 zod 校验
for (const f of files.filter((f) => rel(f).startsWith('app/actions/'))) {
  const src = read(f);
  if (!/^['"]use server['"]/m.test(src)) err(f, `缺少 'use server'`);
  if (!/from ['"]zod['"]/.test(src)) err(f, `Server Action 文件没有引入 zod`);
}

// ---- 7. Server Action 里不得直接写 prisma（业务逻辑应在 services/）
for (const f of files.filter((f) => rel(f).startsWith('app/actions/'))) {
  const src = read(f);
  const hits = [...src.matchAll(/prisma\.(\w+)\.(create|update|delete|upsert|updateMany|deleteMany)\(/g)];
  if (hits.length) warn(f, `Server Action 里直接写库：${hits.map((h) => h[0]).join(', ')}`);
}

// ---- 8. 每个 app/admin 页面必须 guardPage；family/specialist 必须 guardPortal
for (const f of files.filter((f) => /^app\/(admin|family|specialist)\/.*page\.tsx$/.test(rel(f)))) {
  const src = read(f);
  const r = rel(f);
  // 个人页（首页总览、我的通知）用 guardPortal('admin') 做端口级把关即可，
  // 页内每个区块再按 can() 裁剪；业务列表页必须绑定具体 capability。
  if (r.startsWith('app/admin/') && !/guardPage\(|guardPortal\(/.test(src)) {
    err(f, '后台页面既没有 guardPage 也没有 guardPortal');
  }
  if (/^app\/(family|specialist)\//.test(r) && !/guardPortal\(/.test(src)) err(f, '端口页面缺少 guardPortal');
}

// ---- 9. 不得出现硬编码密钥/密码
for (const f of files) {
  const src = read(f);
  if (/(?:api[_-]?key|secret|password)\s*[:=]\s*['"][A-Za-z0-9@!#$%^&*_.\-]{8,}['"]/i.test(src)) {
    // 例外：种子数据与登录页的 Demo 帐号提示。两者都只在 NEXT_PUBLIC_DEMO_MODE=true 下出现，
    // 且 README 要求正式部署重置全部密码。除此之外不接受任何硬编码凭据。
    const ALLOW = ['prisma/seed.ts', 'app/login/demo-accounts.tsx'];
    if (!ALLOW.includes(rel(f))) err(f, '疑似硬编码密钥/密码');
  }
}

// ---- 10. labels.ts 的 Record<Enum,...> 必须覆盖 schema 里的所有枚举值
const schema = read(path.join(ROOT, 'prisma/schema.prisma'));
const enums = {};
for (const m of schema.matchAll(/enum (\w+) \{([\s\S]*?)\n\}/g)) {
  enums[m[1]] = m[2]
    .split('\n')
    .map((l) => l.replace(/\/\/\/.*$/, '').trim())
    .filter((l) => /^[A-Z][A-Z0-9_]*$/.test(l));
}
const labels = read(path.join(ROOT, 'lib/labels.ts'));
let recordCount = 0;
for (const m of labels.matchAll(/export const (\w+): Record<(\w+), [^>]*>\s*=\s*\{([\s\S]*?)\n\};/g)) {
  const [, name, enumName, body] = m;
  if (!enums[enumName]) continue;
  recordCount++;
  const keys = new Set([...body.matchAll(/^\s*(\w+):/gm)].map((k) => k[1]));
  const missing = enums[enumName].filter((v) => !keys.has(v));
  const extra = [...keys].filter((k) => !enums[enumName].includes(k));
  if (missing.length) errors.push(`lib/labels.ts: ${name} 缺少 ${enumName} 的值：${missing.join(', ')}`);
  if (extra.length) errors.push(`lib/labels.ts: ${name} 出现 ${enumName} 里不存在的键：${extra.join(', ')}`);
}

// ---- 11. 导航 capability 必须都存在
const caps = read(path.join(ROOT, 'lib/permissions/capabilities.ts'));
const capSet = new Set([...caps.matchAll(/'([a-zA-Z.]+)'/g)].map((m) => m[1]));
const nav = read(path.join(ROOT, 'components/admin/nav-config.ts'));
for (const m of nav.matchAll(/capability: '([^']+)'/g)) {
  if (!capSet.has(m[1])) errors.push(`nav-config.ts: capability '${m[1]}' 未在 capabilities.ts 定义`);
}

// ---- 12. guardPage 的 capability 必须都存在
for (const f of files) {
  const src = read(f);
  for (const m of src.matchAll(/guardPage\(\s*'([^']+)'/g)) {
    if (!capSet.has(m[1])) err(f, `guardPage('${m[1]}') 未在 capabilities.ts 定义`);
  }
  for (const m of src.matchAll(/\bcan\(\s*\w+,\s*'([^']+)'\s*\)/g)) {
    if (!capSet.has(m[1])) err(f, `can(..., '${m[1]}') 未在 capabilities.ts 定义`);
  }
}

// ---- 13. 未使用的 import（粗查，避免 noUnusedLocals 报错）
for (const f of files) {
  const src = read(f);
  for (const m of src.matchAll(/^import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"][^'"]+['"];/gm)) {
    for (const raw of m[1].split(',')) {
      const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()?.trim();
      if (!name) continue;
      const body = src.slice(src.indexOf(m[0]) + m[0].length);
      const re = new RegExp(`\\b${name.replace(/[$]/g, '\\$')}\\b`);
      if (!re.test(body)) err(f, `import 了但没使用：${name}`);
    }
  }
}

// ---- 14. Prisma 模型名在代码里必须真实存在
const models = new Set([...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1][0].toLowerCase() + m[1].slice(1)));
for (const f of files) {
  const src = read(f);
  for (const m of src.matchAll(/(?:prisma|tx)\.(\w+)\.(findMany|findFirst|findUnique|create|update|delete|upsert|count|groupBy|aggregate|updateMany|deleteMany|createMany)\(/g)) {
    if (!models.has(m[1]) && m[1] !== '$transaction') {
      err(f, `Prisma 模型不存在：${m[1]}`);
    }
  }
}

console.log(`扫描 ${files.length} 个 TS/TSX 文件，labels 枚举映射 ${recordCount} 组，Prisma 模型 ${models.size} 个`);
console.log(`\n错误 ${errors.length} 条：`);
for (const e of errors) console.log('  ✗ ' + e);
console.log(`\n警告 ${warns.length} 条：`);
for (const w of warns) console.log('  ! ' + w);
process.exit(errors.length ? 1 : 0);
