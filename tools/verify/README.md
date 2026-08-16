# 交付前验证脚本

这些脚本是 `VERIFICATION.md` 里那些结论的**可复现来源**。
构建它们的原因很朴素：交付环境访问不了 npm registry，跑不了
`tsc --noEmit` / `next lint` / `next build`，所以我用别的手段把能验的都验了一遍。

拿到项目后，**优先跑真正的编译器**（`npm run check:all`）。
这些脚本是补充，不是替代 —— 它们能查到编译器查不到的东西（术语纪律、
权限守卫覆盖、隔离规则在数据库层是否真的成立），但查不到编译器能查到的类型细节。

---

## 1. 静态检查（不需要装依赖）

```bash
node tools/verify/static-check.mjs
```

在项目全部 TS/TSX 文件上跑 14 类检查，**错误 0 条才算通过**：

- 括号 / JSX 花括号是否平衡（抓结构性断裂）
- `'use client'` 文件是否误引服务端模块（`@/lib/db`、`@/services/*`、`bcryptjs`…）
- 所有 `@/` 与相对路径 import 是否指向真实文件
- 界面文案是否出现禁用称呼（服务阿姨 / 陪诊阿姨 / 护工 / 陪护 / 保姆 / 护理员 / 工作人员）
- Prisma `select` / `include` 里是否出现非字面量布尔（会破坏类型推导）
- Server Action 是否都有 `'use server'` + zod 校验，且不直接写库
- 每个后台页面是否都有 `guardPage` / `guardPortal`
- 是否有硬编码密钥或密码（仅 seed 与登录页 Demo 提示为例外）
- `lib/labels.ts` 的 `Record<Enum, …>` 是否穷尽 schema 里的所有枚举值
- 导航配置、`guardPage()`、`can()` 引用的能力是否都在 `capabilities.ts` 里存在
- 是否有未使用的 import（ESLint 里配的是 `error`，会让构建失败）
- 代码里用到的 `prisma.<model>` 是否都真实存在

## 2. Prisma schema 结构校验（不需要装依赖）

```bash
python3 tools/verify/validate-schema.py
```

检查关系两端是否配对、`references` 是否指向 `@id`/`@unique`、
一对一外键是否带 `@unique`、可选性是否一致等。
（它在开发过程中真的抓到过一个漏掉的反向关系。）

## 3. 用真实 PostgreSQL 验证数据模型

需要一个可连接的 PostgreSQL（16 及以上）。

```bash
# 生成 DDL
python3 tools/verify/generate-ddl.py           # 默认写到 /tmp/schema.sql

# 建结构（会创建独立的 check_model schema，不影响你的业务库）
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /tmp/schema.sql

# 按主流程顺序插入整条数据链（一个事务）
psql "$DATABASE_URL" -f tools/verify/e2e-insert.sql

# 用纯 SQL 复现服务端的隔离与合规判定，22 项逐条对照预期
psql "$DATABASE_URL" -f tools/verify/isolation-checks.sql
```

`isolation-checks.sql` 的输出是一张「检查项 / 预期 / 实际 / 结果」表格，
出现 `❌ 不符` 就是真实的权限漏洞，不是脚本的问题。

> 注意：`generate-ddl.py` 是**机械翻译**，只覆盖本项目用到的 Prisma 特性。
> 它的用途是「验证这套模型能不能在真实 PostgreSQL 里建起来」，
> **不要用它代替 `prisma migrate`** 生产迁移。

## 4. 运行时自检（需要能跑起来）

装好依赖、`npm run db:seed` 之后：

```bash
# .env 里设置 DEV_CHECK_TOKEN
curl "http://localhost:3000/api/dev/selfcheck?token=<你的令牌>"
```

用**真实的服务层函数与权限判定代码**跑 50+ 项断言。生产环境把
`DEV_CHECK_TOKEN` 留空，端点会直接返回 404。
