# Supabase + Vercel 预览部署

这份文件只讲一件事：**怎么把这套系统跑成一个你能点开看的预览环境。**

数据库那一半已经做完了（见第 1 节）。你需要做的是第 2 节的 Vercel 部分，大约 10 分钟。

---

## 0. 现在的状态

| 项目 | 状态 |
| --- | --- |
| Supabase 项目 | `jiating-anxin-guanjia`（ref `zkomnapkkpbqlnqswxgs`，ap-southeast-1，PostgreSQL 17） |
| 表结构 | ✅ 已建好：**37 张表 / 40 个枚举 / 64 个外键 / 32 个唯一约束**，全部在 `app` schema |
| 演示数据 | ✅ 已写入：3 个家庭、15 个帐号、6 条本周任务、3 份服务记录、3 份报告、1 个已闭环异常事件 |
| 演示密码 | ✅ `Demo@2026`（bcrypt cost 12，库内用 pgcrypto 生成，已验证可通过校验） |
| 安全隔离 | ✅ 32 项检查全部通过（见第 4 节） |
| Vercel | ⬜ **需要你来做**（原因见第 2 节开头） |

---

## 1. Supabase：为什么表在 `app` schema 而不是 `public`

这是一个刻意的安全决定，值得你知道原因。

Supabase 会把 `public` schema 通过 PostgREST 暴露成 HTTP API，而 anon key 是设计上就要发到浏览器里的**公开**字符串。如果这些表建在 `public` 且没有 RLS 策略，那么任何拿到 anon key 的人都可以直接：

```
GET https://<ref>.supabase.co/rest/v1/elder_sensitive_info?apikey=<anon key>
```

——把长辈的慢性情况和用药一次性拉走。这跟整个产品「付款权 ≠ 数据查看权」的设计是直接冲突的。

所以做了两层防护：

1. **表建在 `app` schema** —— PostgREST 默认只暴露 `public`，`app` 根本不在 API 的可见范围内
2. **37 张表全部启用 RLS 且不建任何 policy** —— 即使某天有人把 `app` 加进 Exposed schemas，anon / authenticated 也读不到任何一行

Prisma 用的是 `postgres` 角色（表 owner），PostgreSQL 里表 owner 默认绕过 RLS，所以应用照常读写。另外我还显式执行了：

```sql
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM anon, authenticated;
REVOKE ALL ON SCHEMA app FROM anon, authenticated;
```

> Supabase 的 Security Advisor 会报 37 条 `rls_enabled_no_policy`（INFO 级）。
> **这是预期结果，不是问题** —— 「启用 RLS 且没有 policy」正是 deny-all 的写法。
> 没有任何 WARN 或 ERROR 级告警。

### 这意味着连接串必须带 `?schema=app`

这是最容易踩的坑：**忘了加 `schema=app`，Prisma 会去 `public` 找表，然后报 "table does not exist"。**

---

## 2. Vercel：需要你操作

### 先说清楚我为什么没直接帮你部署

我这边有 Vercel 的 MCP 工具，但它的部署方式是「把整棵源码树塞进一次工具调用」。这个项目的源码是 **约 1MB / 153 个文件**，塞不进单次调用。GitHub 那条路也走不通（这个沙箱只能访问预配置的仓库，没有 `gh` CLI）。

所以数据库这一半我做完了，Vercel 这一半得你来。**最快的方式不需要 GitHub：**

### 方式 A：Vercel CLI（推荐，不需要 GitHub，约 3 分钟）

```bash
# 1. 解压项目并进入目录
unzip jiating-anxin-guanjia-v1.zip && cd jtaxgj

# 2. 装依赖（postinstall 会自动跑 prisma generate）
npm install

# 3. 先在本地把编译器跑一遍 —— 这一步很重要，见 VERIFICATION.md
npm run check:all

# 4. 部署
npx vercel          # 首次会引导你登录并创建项目，一路回车即可
```

CLI 会问几个问题，默认值都对（Framework 会自动识别成 Next.js）。第一次部署会因为缺环境变量而在运行时报数据库连接失败 —— 正常，下一步就是配环境变量。

### 方式 B：GitHub → Vercel

把解压后的目录推到一个新仓库，然后在 Vercel 里 **Add New → Project → Import Git Repository**。Framework Preset 选 Next.js，其余保持默认。

---

## 3. 环境变量：每一个填什么

在 Vercel 项目的 **Settings → Environment Variables** 里加下面这些。除特别说明外，Environment 都勾 **Production / Preview / Development**。

### 3.1 先去 Supabase 拿连接串

Supabase 控制台 → 你的项目 → 右上角 **Connect** 按钮。里面有两种串，都要用：

- **Transaction pooler**（端口 `6543`）→ 给 `DATABASE_URL`
- **Direct connection**（端口 `5432`）→ 给 `DIRECT_URL`

> 不要照抄我下面写的 host。Supabase 的 pooler 域名会变（`aws-0-` / `aws-1-` 之类），
> **一定要从 Connect 面板里复制你自己项目的那一行**，然后按下面的说明改造。

**为什么必须用 pooler**：Vercel 是 serverless，每个请求可能起一个新实例。直连会很快把 Postgres 的连接数打满。Transaction pooler 就是为这种场景准备的。

### 3.2 变量清单

| 变量名 | 值 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | pooler 串 + `?pgbouncer=true&connection_limit=1&schema=app` | ⚠️ 三个参数一个都不能少 |
| `DIRECT_URL` | 直连串 + `?schema=app` | ⚠️ **必须设置**，即使你不跑迁移。`schema.prisma` 里引用了它，环境变量不存在会让 `prisma generate` 直接失败 |
| `AUTH_SECRET` | `openssl rand -base64 48` 生成的随机串 | ⚠️ **至少 24 字符**，否则登录时会抛错。绝对不要用 `.env.example` 里那个占位值 |
| `AUTH_SESSION_MAX_AGE` | `28800` | 会话 8 小时 |
| `NEXT_PUBLIC_APP_URL` | 你的 Vercel 域名，如 `https://xxx.vercel.app` | 用于生成绝对链接 |
| `NEXT_PUBLIC_DEMO_MODE` | `true` | 登录页显示演示帐号入口、界面显示「示例数据」水印。**正式上线必须改 `false`** |
| `DEV_CHECK_TOKEN` | 一个你自己定的随机串 | 开启内置自检端点。不设置则端点返回 404 |
| `STORAGE_DRIVER` | 留空或不设 | 对象存储未接，`/api/files` 会返回 501 并说明原因 |

**不要**手动设置 `NODE_ENV` —— Vercel 会自己管，手动设反而会让 cookie 的 `secure` 标记判断出错。

### 3.3 `DATABASE_URL` 长什么样

从 Connect 面板复制到的 pooler 串大致是这个形状：

```
postgresql://postgres.zkomnapkkpbqlnqswxgs:[YOUR-PASSWORD]@aws-?-ap-southeast-1.pooler.supabase.com:6543/postgres
```

你要把 `[YOUR-PASSWORD]` 换成真实数据库密码（在 Supabase 控制台 **Settings → Database** 里可以重置），然后在末尾追加参数：

```
...:6543/postgres?pgbouncer=true&connection_limit=1&schema=app
```

`DIRECT_URL` 同理，端口是 `5432`，末尾只加 `?schema=app`。

> 密码里如果有 `@` `#` `/` `?` 这些字符，必须做 URL 编码，否则连接串会被解析错。
> 最省事的办法是在 Supabase 里重置成一个只含字母数字的密码。

### 3.4 配完之后必须重新部署

Vercel 的环境变量**不会**自动应用到已有部署。去 **Deployments → 最新那条 → ⋯ → Redeploy**。

---

## 4. 打开访问保护

预览环境里有（虚构的）长辈健康信息，而且演示密码是公开的 `Demo@2026`。链接不应该让外人打开。

**Settings → Deployment Protection → Vercel Authentication → 选 Standard Protection → Save。**

之后只有登录了你 Vercel 帐号（或被你邀请到 team）的人才能打开这个域名。

> 副作用：开了保护之后 `curl` 也会被拦。如果你想用命令行验证，
> 在同一页面开 **Protection Bypass for Automation**，拿到一个 secret，
> 然后请求时带上 `?x-vercel-protection-bypass=<secret>`。

---

## 5. 部署后怎么验证

按顺序做，每一步都有明确的预期结果。

### 5.1 数据库连通

```
GET https://<你的域名>/api/health
```

预期 `{"ok":true,"db":"up"}`。

如果是 `{"ok":false,"db":"down", ...}`，看 error 内容：

| 报错关键字 | 原因 | 怎么修 |
| --- | --- | --- |
| `does not exist` / `relation ... does not exist` | 连接串少了 `schema=app` | 补上参数并 Redeploy |
| `password authentication failed` | 密码错，或密码里有特殊字符没编码 | 在 Supabase 重置成纯字母数字的密码 |
| `Environment variable not found: DIRECT_URL` | 忘了设 `DIRECT_URL` | 设一个（即使不跑迁移也必须有） |
| `too many connections` | 用了直连而不是 pooler | 换成 6543 端口的 pooler 串 |

### 5.2 服务端自检（50+ 项断言）

```
GET https://<你的域名>/api/dev/selfcheck?token=<你设的 DEV_CHECK_TOKEN>
```

它用**真实的服务层函数与权限判定代码**跑一遍，返回 `{"ok":true,"summary":"N/N 项通过"}`。这一步等于把权限模型端到端验证了一次。

### 5.3 手点一遍隔离验证

登录页会显示演示帐号，统一密码 `Demo@2026`。最值得看的是这四条：

| 用谁登录 | 应该看到什么 |
| --- | --- |
| `13800000021`（王女士，**付款人**） | 能看报告、服务安排、生活记录、照片 —— 但**看不到**慢性情况与用药 |
| `13800000022`（王先生） | 只有 2 项授权，**看不到**安心报告（他的生活记录授权已被撤回） |
| `13800000031`（刘先生） | 只看到刘家，**看不到**王家任何数据 |
| `13800000004`（财务） | 侧边栏里**没有**长辈档案与服务记录的入口 |

第一条是整个产品的核心边界，演示给别人看的时候建议从这里开始。

`README.md` 第六节有完整的 20 步演示路线（运营 → 专员 → 回到运营审核 → 家庭端 → 隔离验证）。

---

## 6. 几件容易出问题的事

**「本周」的数据会不会过期？**
不会。演示数据的时间是用 `date_trunc('week', now())` 算出来的，永远落在你打开的那一周。已完成的任务保证在过去，待办的任务保证在未来。

**想重新灌一遍数据怎么办？**
两个办法：
- 在 Supabase SQL Editor 里跑 `DROP SCHEMA app CASCADE;`，然后依次执行 `prisma/supabase/01-schema.sql` 和 `02-demo-data.sql`
- 或者在本地 `npm run db:seed`（用 `prisma/seed.ts` 那一套更丰富的数据，它会先清空再写入，不会冲突）

**以后想用 Prisma 管迁移？**
现在的表是用原生 SQL 建的，没有 `_prisma_migrations` 记录，所以 `prisma migrate dev` 会想把库重置掉。要接上 Prisma 迁移，先做一次 baseline：

```bash
mkdir -p prisma/migrations/0_init
npx prisma migrate diff \
  --from-empty --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql
npx prisma migrate resolve --applied 0_init
```

之后再 `prisma migrate dev` 就正常了。

**这套预览能不能直接转正式？**
不能，至少要先做这三件事：
1. `NEXT_PUBLIC_DEMO_MODE` 改 `false`
2. 重置全部演示密码（`Demo@2026` 是公开的）
3. 清掉 `isDemo = true` 的示例数据 —— 这些是虚构内容，**不得作为公司真实案例展示**

`README.md` 第十一节有完整的上线检查清单。

---

## 附：数据库里现在有什么

| 表 | 条数 | 说明 |
| --- | --- | --- |
| `users` | 15 | 12 个内部帐号 + 3 个家庭成员 |
| `households` | 3 | 王家（完整主流程）、刘家（隔离验证）、陈家（潜在家庭） |
| `elders` | 3 | 含 1 份健康敏感信息（独立表） |
| `consents` | 13 | 含 1 条已撤回 —— 撤回立即失效但记录永不删除 |
| `service_tasks` | 6 | 3 条已完成、2 条待执行、1 条待派单 |
| `visit_records` | 3 | 全部已审核，其中 1 条带 2 张私有存储照片 key |
| `health_readings` | 2 | 都标了来源，1 条标记「超出家庭设定的提醒范围」 |
| `assurance_reports` | 3 | 2 份已发布 + 1 份待审核（家庭端看不到待审核的） |
| `incidents` / `incident_events` | 1 / 6 | 已闭环，含完整时间线 |
| `service_catalog_items` | 6 | 其中 3 类开放家庭自助申请，都有加购价 |
| `notification_templates` | 8 | 只启用站内通知，其他渠道保持关闭 |
| `orders` | 3 | 含已开票 / 已申请待开票 / 未申请三种状态 |
| `training_records` | 25 | 3 人全部必修通过；1 人在培训中（用于验证不可派单） |
| `education_records` | 3 | 其中 1 条未核验 —— 界面不得标示「已认证」 |
| `audit_logs` | 4 | 含 1 条查看健康敏感信息的记录 |

全部记录都带 `isDemo = true`，界面会显示「示例数据」标记。
