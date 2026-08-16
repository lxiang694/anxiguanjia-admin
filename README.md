# 家庭安心管家 · 三端业务后台系统 V1

> 父母身边的家庭健康生活助理。
> 替不在身边的子女，多照看一下爸妈。

一套后端 + 一套数据库 + 三个角色入口，支撑「家庭加入 → 评估 → 授权 → 服务 → 记录 → 报告 → 续费」的完整服务闭环。

---

## 目录

- [一、这个系统是什么](#一这个系统是什么)
- [二、核心设计决策](#二核心设计决策)
- [三、技术栈](#三技术栈)
- [四、快速开始](#四快速开始)
- [五、演示帐号](#五演示帐号)
- [六、端到端演示路线](#六端到端演示路线)
- [七、内置自检](#七内置自检)
- [八、目录结构](#八目录结构)
- [九、权限模型](#九权限模型)
- [十、数据模型](#十数据模型)
- [十一、部署](#十一部署)
- [十二、已完成 / 未完成](#十二已完成--未完成)
- [十三、下一步最值得做的功能](#十三下一步最值得做的功能)

---

## 一、这个系统是什么

三个角色入口，共享同一套后端与同一份客户数据（**不维护三份互相复制的客户数据**）：

| 入口 | 路径 | 使用人 | 设计取向 |
| --- | --- | --- | --- |
| 总后台 | `/admin` | 管理员、运营、服务督导、客服、财务、人事、城市负责人 | 信息密度适中，首屏先回答「今天需要处理什么」 |
| 安心专员工作台 | `/staff` | 家庭安心专员、资深专员、家庭安心顾问 | Mobile First，大按钮、少步骤，几分钟完成记录 |
| 家庭端 | `/family` | 付费子女、获授权的其他家庭成员 | 温暖、易懂，第一屏是「爸妈最近怎么样？」而不是订单 |

### 术语纪律（代码与界面都必须遵守）

界面中**严禁**出现：阿姨、服务阿姨、护工、陪护、陪诊阿姨、工作人员。

统一称呼：

| 岗位 | 内部代码 |
| --- | --- |
| 家庭安心顾问 | `FAMILY_CONSULTANT` |
| 家庭安心专员（简称安心专员） | `CARE_SPECIALIST` |
| 资深家庭安心专员 | `SENIOR_CARE_SPECIALIST` |
| 服务督导 | `SERVICE_SUPERVISOR` |
| 区域服务主管 | `AREA_MANAGER` |

> `care` 只是程序内部命名，不代表任何医疗护理资质。

---

## 二、核心设计决策

这一版有几个刻意做出的选择，理解它们比读代码更重要。

### 1. 核心不是「老人」，而是 `Household`（家庭）

一个家庭是一个服务单位。长辈、家庭成员、顾问、固定专员、备用专员、服务方案、任务、报告、事件、订单，全部围绕 `Household` 建立关联。

### 2. 付款权 ≠ 数据查看权

子女支付服务费，**不代表**自动获得父母的全部个人信息。

系统里没有任何一处会因为 `isPayer = true` 而放宽访问。家庭成员对某位长辈某一类数据的每一次访问，都必须能在 `Consent` 表里找到一条有效（未过期、未撤回）的授权记录。

**授权不足时数据根本不会进入返回值** —— 而不是返回后由前端隐藏。判定点在 `lib/permissions/consent.ts` 与 `services/family/index.ts`。

演示数据刻意做了对比：王女士是付款人、主要联络人，拥有 5 项授权，但**没有**健康敏感信息授权；王先生只有 2 项授权。两人登录家庭端看到的内容不同。

### 3. 原始服务记录 ≠ 家庭安心报告

这是两张独立的表：

- `VisitRecord` —— 安心专员提交的原始记录，**永久保留**。更正只追加 `amendmentNote`，不覆盖原文。
- `AssuranceReport` —— 另外形成的、面向家庭的表达，必须经**人工确认**后才能发布。

报告生成采用规则式（`composeDraftFromRecords`，纯函数）：每一句话都由原始记录的字段直接映射而来，不会凭空产生任何新事实。周期内没有已提交的记录时，生成会直接失败而不是编内容。

报告与原始记录之间有 `AssuranceVisitRecordLink` 引用关系，审核页面可以逐句核对来源。若未来接入 AI 整理，`generation` 与 `aiGenerated` 字段会明确标注，且仍必须经人工确认。

### 4. `Elder` 不是电子病历

长辈档案以生活情况为主：居住、日常习惯、活动、饮食、睡眠、沟通偏好、生活需要、注意事项、紧急联络安排。

健康敏感信息（慢性情况、用药、健康数值）放在独立表 `ElderSensitiveInfo`，做**表级 + 能力级**双重隔离。一线安心专员一律不可见（`canSeeSensitiveHealth()` 对专员角色硬编码返回 false）。

### 5. 健康数值必须记录来源，且系统不做诊断

每条 `HealthReading` 必须带 `source`：本人自行测量 / 家庭成员提供 / 安心专员协助记录 / 医疗资料提供。

系统只显示「**超出家庭设定的提醒范围**」，并在同一处明确标注这不是医疗诊断。服务记录的选项文案全部是观察性措辞：「本人反映近期睡不好」，而不是「患有失眠」。

### 6. 定位只记录一次

到达签到时记录一次坐标，**不做 24 小时持续定位**。坐标缺失（室内定位失败很常见）不阻断服务开始。

### 7. 绩效不做单量排行榜

`StaffPerformanceSnapshot` 记录准时率、完成率、记录及时率、报告质量、家庭评价、投诉率、事件配合度、培训完成率、固定家庭续约情况。刻意不提供「接单最多」排序，避免鼓励抢单。

### 8. 派单有硬闸门

只有 `serviceStatus = ACTIVE`、**且**通过全部必修培训（未过期）、**且**具备该服务类型所需能力的人员才能被派单。

涉及法定资格的能力（`requiresCredential = true`）必须另有已核验的外部凭证 —— 公司内部培训不等同法定资格。

### 9. 未核验的信息不得标示「已认证」

学历 `verificationStatus !== 'VERIFIED'` 时，界面只显示「学历未核验」。对家庭端展示专员卡片时（`specialistCardForFamily`），未核验学历与未核验资格能力**根本不会出现在返回值里**。

### 10. Demo 数据全部带标记

所有种子数据带 `isDemo = true`，界面显示「示例数据」标记，顶部有演示环境横幅。虚构客户、专员、学历、服务数据不得作为公司真实案例展示。

---

## 三、技术栈

| 层 | 选择 |
| --- | --- |
| 框架 | Next.js 15（App Router）+ React 19 + TypeScript（strict） |
| 样式 | Tailwind CSS 3.4，自定义品牌令牌（米白 / 深绿 / 暖橙） |
| 图标 | Lucide React |
| 数据库 | PostgreSQL + Prisma 6 |
| 后端 | Server Actions + Route Handlers，业务逻辑收在 `services/` |
| 校验 | Zod（Server Action 入口统一校验） |
| 认证 | 自建会话：bcrypt 密码哈希 + `jose` 签发 HS256 JWT，存 httpOnly Cookie，数据库另存会话哈希以支持撤销 |

### 关于认证方案的说明

没有引入 NextAuth，原因是本系统需要「一套帐号体系 + 三端分流 + 数据库可撤销会话 + 每次访问都重新查库判定权限」，自建一层约 200 行、完全可审计，比适配一个通用框架更清楚。

安全要点：

- 密码 bcrypt（cost 12）
- JWT 只放最小信息（userId / sessionId / role / name），不放任何敏感资料
- 数据库只存 token 的 SHA-256 哈希，不存原文
- Cookie：`httpOnly` + `sameSite=lax` + 生产环境 `secure`
- 登录失败统一返回「手机号或密码不正确」，不透露帐号是否存在
- 管理员 2FA 已预留字段（`twoFactorEnabled` / `twoFactorSecret`），第一版未强制启用
- middleware 只做粗粒度拦截（Edge Runtime 连不上数据库）；**真正的数据权限判定全部在服务端重新查库执行**

---

## 四、快速开始

> ⚠️ **先读 [`VERIFICATION.md`](./VERIFICATION.md)**。
> 构建环境无法访问 npm registry，所以 `typecheck` / `lint` / `build` 没能在交付前跑过。
> 数据库结构已用真实 PostgreSQL 16 验证（35 表 / 37 枚举 / 64 外键 / 104 索引全部建成，
> 端到端数据链路与全部隔离规则实测通过）。
> 拿到项目后请先跑一次 `npm run check:all`。


### 环境要求

- Node.js ≥ 20（建议 22）
- PostgreSQL ≥ 14
- npm ≥ 10

### 步骤

```bash
# 1. 安装依赖（postinstall 会自动执行 prisma generate）
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，至少填写 DATABASE_URL 与 AUTH_SECRET
#   生成 AUTH_SECRET： openssl rand -base64 48

# 3. 创建数据库结构
npm run db:push          # 快速建表（开发用）
# 或：npm run db:migrate  # 生成正式 migration 文件

# 4. 写入演示数据
npm run db:seed

# 5. 启动
npm run dev
```

打开 http://localhost:3000 ，用下方演示帐号登录。根路径会按角色自动分流到对应的端。

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 开发服务器（:3000） |
| `npm run build` | 生产构建（含 `prisma generate`） |
| `npm run start` | 启动生产构建 |
| `npm run typecheck` | TypeScript 检查（`tsc --noEmit`） |
| `npm run lint` | ESLint |
| `npm run check:all` | typecheck + lint + build 一起跑 |
| `npm run db:push` | 直接同步 schema 到数据库 |
| `npm run db:migrate` | 生成并应用 migration |
| `npm run db:reset` | 重置数据库并重新 seed |
| `npm run db:seed` | 只写入演示数据 |
| `npm run db:studio` | Prisma Studio |

---

## 五、演示帐号

**统一密码：`Demo@2026`**

> ⚠️ 这些帐号与密码**只适用于本地 Demo 环境**。正式部署不得使用固定 Demo 密码：
> 请重置全部密码、把 `NEXT_PUBLIC_DEMO_MODE` 设为 `false`、把 `DEV_CHECK_TOKEN` 留空。

### 总后台 `/admin`

| 手机号 | 角色 | 用途 |
| --- | --- | --- |
| `13800000001` | 超级管理员 | 全部权限，含系统配置与操作日志 |
| `13800000002` | 运营 | 日常业务全流程；**看不到**系统配置与操作日志 |
| `13800000003` | 服务督导 | 培训、质控、服务审核、事件处理 |
| `13800000004` | 财务 | 只看订单与订阅；**看不到**长辈生活记录与健康信息 |
| `13800000005` | 人事 | 只看人员档案；**完全不接触**家庭数据 |
| `13800000006` | 客服 | 反馈与投诉处理 |
| `13800000007` | 城市负责人 | 只看长沙的数据 |
| `13800000008` | 区域服务主管 | 只看本区域 |

### 安心专员工作台 `/staff`

| 手机号 | 角色 | 用途 |
| --- | --- | --- |
| `13800000010` | 家庭安心顾问 张宁 | 前期沟通与家庭安心评估 |
| `13800000011` | 家庭安心专员 李晨 | **主线演示帐号**，固定服务王家 |
| `13800000012` | 家庭安心专员 周敏 | 验证专员之间的数据隔离 |
| `13800000013` | 培训中 吴桐 | 验证「非可排班状态不可派单」 |

### 家庭端 `/family`

| 手机号 | 角色 | 用途 |
| --- | --- | --- |
| `13800000021` | 王女士 | 王家付费子女，5 项授权（**不含**健康敏感信息） |
| `13800000022` | 王先生 | 王家儿子，仅 2 项授权，用于对比授权差异 |
| `13800000031` | 刘先生 | 刘家，验证家庭之间的数据隔离 |

---

## 六、端到端演示路线

演示数据已经把主流程走完一遍。想亲手再走一次，按下面顺序操作：

### A. 运营视角（`13800000002`）

1. `/admin` —— 首屏「今天需要处理什么」：需要现在处理的事件、今日服务、待办队列
2. `/admin/households` → 点「王家」→ **Household 360°**，逐个 Tab 看：概览 / 长辈 / 家庭成员 / 安心专员 / 授权 / 服务方案 / 服务记录 / 安心报告 / 事件 / 订单 / 时间线 / 内部备注
3. `/admin/service/dispatch` —— 为王家安排一次新的上门服务（不选专员即默认派给固定专员李晨）
4. `/admin/consents` —— 看王女士与王先生的授权差异

### B. 安心专员视角（`13800000011`）

5. `/staff` —— 「今天」列表，点进刚才安排的任务
6. 依次点：**接受任务 → 我已到达 →（可选）记录当前位置 → 开始服务**
7. 卡片式勾选服务记录 → **提交服务记录并完成服务**
8. 右下角常驻「需要协助」→ 试着上报一次异常（会立刻通知服务督导）

### C. 回到运营视角（`13800000002`）

9. `/admin/service/records` —— 审核刚提交的原始记录
10. `/admin/service/reports` —— 为王家**生成本周报告草稿**（只汇总已提交的记录）
11. 点进草稿 —— 左边是家庭将看到的内容，右边是引用的原始记录，可逐句核对
12. **保存并确认** → 页面底部 **发布给家庭**

### D. 家庭视角（`13800000021`）

13. `/family` —— 「爸妈最近怎么样？」、本周次数、下一次安排、服务团队、家庭时间线
14. 点「查看本周安心报告」—— 读那封「信」
15. `/family/consents` —— 「谁可以看到什么」，可以撤回自己给出的授权

### E. 隔离验证

16. 用 `13800000022`（王先生）登录 —— 只有 2 项授权，**看不到**安心报告
17. 用 `13800000031`（刘先生）登录 —— 只看到刘家，**看不到**王家任何数据
18. 用 `13800000012`（周敏）登录 —— **看不到**派给李晨的任务
19. 用 `13800000004`（财务）登录 —— 侧边栏没有长辈档案与服务记录入口
20. 用 `13800000002`（运营）访问 `/admin/system/audit` —— 会被拦到 403 并记录一条 `PERMISSION_DENIED`

---

## 七、内置自检

除了手动点击，系统内置了一个服务端自检端点，一次性验证 E2E 数据链路与全部隔离规则。

```bash
# 1. 在 .env 里设置一个令牌
DEV_CHECK_TOKEN="随便一串长字符串"

# 2. 启动后访问
curl "http://localhost:3000/api/dev/selfcheck?token=随便一串长字符串" | jq
```

返回结构：

```json
{
  "ok": true,
  "summary": "38/38 项通过",
  "byGroup": {
    "E2E 主流程": { "passed": 13, "total": 13 },
    "数据隔离":   { "passed": 6,  "total": 6 },
    "角色能力":   { "passed": 6,  "total": 6 },
    "授权模型":   { "passed": 6,  "total": 6 },
    "报告可追溯性": { "passed": 3, "total": 3 },
    "上岗闸门":   { "passed": 3,  "total": 3 },
    "...": "..."
  },
  "failed": [],
  "checks": [ { "group": "...", "name": "...", "pass": true, "detail": "..." } ]
}
```

它验证的内容包括：

- **E2E 主流程** —— 建家庭 → 长辈档案 → 家庭成员 → 授权 → 分配固定专员 → 派单 → 专员读取任务 → 提交原始记录 → 生成报告草稿 → 人工确认发布 → 家庭端可见 → 首页显示近况
- **数据隔离** —— 家庭 A 看不到家庭 B；跨家庭授权检查必然拒绝；专员 A 看不到专员 B 的任务；一线专员只看得到自己的档案
- **角色能力** —— 运营访问不到系统配置；财务看不到生活记录与健康信息；人事完全不接触家庭数据；一线专员看不到健康敏感信息
- **授权模型** —— 同家庭内不同成员授权范围不同；未获报告授权的成员看不到报告；健康敏感信息默认不开放；付款人身份本身不带来查看权限
- **报告可追溯性** —— 报告统计与原始记录一致；生活段落只包含记录中真实存在的完成事项；规则式生成是确定性的
- **上岗闸门** —— 非「可排班」状态不可派单；已完成培训与能力要求的可派单；存在「涉及法定资格」的能力标签
- **展示纪律 / 数据模型 / 审计日志 / Demo 标记 / 事件时间线**

> 生产环境请把 `DEV_CHECK_TOKEN` 留空，端点会直接返回 404。

另有 `GET /api/health` 用于部署后确认应用与数据库连通。

---

## 八、目录结构

```
app/
  layout.tsx                    根布局
  page.tsx                      按角色分流
  login/                        登录（含 Demo 帐号快捷参考）
  forbidden/                    403（权限不足，已记录审计日志）
  actions/                      Server Actions（auth / admin / staff / family / settings / support）
  admin/                        总后台
    page.tsx                    运营总览「今天需要处理什么」
    households/[id]/            ★ Household 360°（十二个 Tab）
    elders/                     长辈档案（含敏感信息权限裁剪）
    consents/                   授权管理
    service/
      today/ calendar/ dispatch/
      records/[id]/             原始记录审核 + 追加修订说明
      reports/[id]/             ★ 报告审核（左：家庭看到的 / 右：原始记录对照）
      requests/                 家庭申请
    incidents/[id]/             事件中心 + 完整时间线
    staff/[id]/                 专员档案（学历核验 / 上岗状态机）
    staff/training|competencies|performance/
    billing/plans|subscriptions|orders|invoices/
    support/feedback/
    analytics/ analytics/finance/
    system/users|roles|services|templates|regions|privacy|audit/
  staff/                        安心专员工作台（Mobile First）
    page.tsx                    ★「今天」
    tasks/[id]/                 ★ 任务详情 + 开始服务 + 卡片式服务记录
    help/                       ★ 需要协助（异常上报）
    messages/ me/
  family/                       家庭端
    page.tsx                    ★「爸妈最近怎么样？」
    reports/[id]/               ★ 安心报告阅读页
    service/                    服务安排 / 改期 / 额外服务申请
    consents/                   谁可以看到什么（可自助撤回）
    me/                         会员信息 / 服务反馈
  api/
    health/                     健康检查
    files/[...key]/             私有文件签名校验
    dev/selfcheck/              ★ 内置自检（需 DEV_CHECK_TOKEN）

components/
  ui/                           共享基础组件（Badge / Card / Table / EmptyState / 合规提示…）
  shared/action-form.tsx        Server Action 表单外壳（统一错误与成功提示）
  admin/                        侧边栏与导航配置（按能力裁剪）
  staff/ family/                两端的底部导航

lib/
  auth/                         会话签发与校验、登录登出、角色分流
  permissions/
    capabilities.ts             ★ RBAC 能力清单与角色矩阵
    scope.ts                    ★ 数据范围（Prisma where 生成器）
    consent.ts                  ★ Consent 授权判定
    index.ts                    页面/端级守卫
  db/                           Prisma 单例
  audit/                        审计日志
  storage/                      私有存储与签名地址
  notifications/                站内通知（外部渠道明确标注未接入）
  labels.ts                     ★ 全站中文文案字典（术语纪律的执行点）
  ids.ts                        业务编号生成（CS- / AX- / TSK- / INC- / RPT- / ORD- / CASE-）
  utils.ts                      脱敏、时间、金额、周期计算

services/                       ★ 全部业务规则都在这一层，页面与 Server Action 不直接写库
  household/ elder/ consent/ staff/ scheduling/
  visit/ report/ incident/ subscription/ family/ dashboard/
  account/                      内部帐号开通 / 停用 / 重置密码（都会吊销全部会话）
  settings/                     服务目录与通知模板
  support/                      家庭反馈处理与申请审批（审批会真正改动任务）
  training/                     培训与考核录入、能力标签授予（成绩不达标不允许标记通过）

prisma/
  schema.prisma                 数据模型（含大量设计说明注释）
  seed.ts                       演示数据

prisma/supabase/                预览环境 SQL（不需要本地 Node 即可灌库）
  01-schema.sql                 建 app schema：表 / 枚举 / 约束 / 索引 / RLS
  02-demo-data.sql              演示数据，密码用库内 pgcrypto 生成 bcrypt
  03-verify.sql                 30 项隔离与合规检查

tools/verify/                   交付前验证脚本（VERIFICATION.md 的可复现来源）
  static-check.mjs              14 类静态检查（不需要装依赖即可运行）
  validate-schema.py            Prisma schema 关系与约束校验
  generate-ddl.py               schema.prisma → PostgreSQL DDL
  e2e-insert.sql                按主流程顺序插入整条数据链
  isolation-checks.sql          22 项隔离与合规规则的纯 SQL 复现
```

★ = 投入最高设计质量的关键文件。

---

## 九、权限模型

权限由**三个独立维度**共同决定，三者同时成立才允许访问：

```
        能力（capability）        ×        数据范围（scope）        ×        授权（Consent）
   「这个角色能不能做这类动作」      「这条数据是不是他该看的」        「长辈同意给这个人看吗」
   lib/permissions/capabilities   lib/permissions/scope          lib/permissions/consent
```

### 能力（RBAC）

54 项细粒度能力，按业务动作划分（`household.read`、`elder.sensitive.read`、`report.publish`、`order.refund`、`system.audit`…）。

刻意**不用** Admin / Staff / Family 三级粗粒度模型 —— 那会让「财务能看到长辈生活记录」这类越权无法阻止。

导航条目本身绑定 capability，看不到的入口**根本不渲染**（见 `components/admin/nav-config.ts`）。完整矩阵可在 `/admin/system/roles` 查看。

### 数据范围（Data Scope）

所有列表查询都把 scope 的结果合并进 Prisma `where`，**不允许先查全量再过滤**（一旦分页就会泄露总数）。

| 角色 | 可见范围 |
| --- | --- |
| 超级管理员 / 运营 / 督导 / 客服 | 全部家庭 |
| 城市负责人 / 区域主管 | 仅 `cityId = 自己城市` |
| 财务 | 订单与订阅；家庭仅用于识别编号，不含生活记录 |
| 人事 | **完全不返回家庭数据**（`householdScopeWhere` 返回 `null`） |
| 家庭安心顾问 | 自己负责的家庭 |
| 一线安心专员 | 固定/备用服务的家庭 **+** 未结案任务 **+** 前后 7 天窗口内的任务 |
| 家庭成员 | 仅本人所属家庭，再经 Consent 逐项过滤 |

一线专员的 7 天窗口是刻意设计：**一次代班不会换来对该家庭的长期访问权**，但仍留有补记录的合理时间。

### 授权（Consent）

七类授权粒度（按业务可理解，而非技术字段级）：

安心报告 / 生活记录 / 服务照片 / 异常通知 / 健康敏感信息 / 服务安排 / 联络方式

授权记录保留规则：

- 每次变更以**新版本**写入，旧记录不覆盖 —— 旧授权是历史事实
- 同一组合（长辈 × 被授权人 × 授权内容）同时只有一条有效版本
- 记录授权人、被授权人、内容、开始/截止时间、是否撤回、撤回时间、版本、授权依据、凭证 key
- 变更同时写入审计日志与家庭时间线 —— 家庭自己能看到授权被谁在什么时候改过

### 审计日志

登录、查看敏感信息、修改长辈档案、修改授权、查看健康资料、导出、修改服务记录、审核报告、退款、修改专员档案全部留痕。

记录 user / time / ip / userAgent / action / resource / resourceId / before / after / **permissionNote**（当时为什么允许或拒绝，便于事后复查）。操作人姓名与角色冗余保存，人员离职后日志仍可读。

---

## 十、数据模型

37 张表 / 40 个枚举。按域分组：

| 域 | 实体 |
| --- | --- |
| 组织 | `City` `District` |
| 认证 | `User` `Session` |
| 家庭 | `Household` `Elder` `ElderSensitiveInfo` `FamilyMember` `HouseholdAssessment` |
| 授权 | `Consent` |
| 人员 | `StaffProfile` `EducationRecord` `TrainingCourse` `TrainingRecord` `Competency` `StaffCompetency` `StaffAvailability` `StaffPerformanceSnapshot` |
| 方案 | `ServicePlan` `HouseholdServicePlan` `Subscription` `Order` |
| 执行 | `ServiceTask` `VisitRecord` `HealthReading` |
| 事件 | `Incident` `IncidentEvent` |
| 报告 | `AssuranceReport` `AssuranceVisitRecordLink` |
| 家庭端 | `TimelineEvent` `ServiceChangeRequest` `FeedbackCase` |
| 系统 | `Notification` `NotificationTemplate` `ServiceCatalogItem` `AuditLog` `SpecialistChangeLog` |

`prisma/schema.prisma` 里每个模型和枚举都写了设计意图注释，建议直接读它。

### 任务状态机

```
待派单 → 已派单 → 已接受 → 待出发 → 已到达 → 服务中 → 待提交记录 → 待审核 → 已完成
                    ↘ 拒绝    ↘ 改期    ↘ 服务未完成      ↘ 取消
```

转移规则集中在 `services/scheduling/index.ts` 的 `TASK_TRANSITIONS`，UI 按钮与服务端校验读的是同一份定义。

### 上岗状态机

```
候选人 → 已入职 → 培训中 → 待考核 → 已通过 → 可排班 ⇄ 暂停服务 → 离职
```

只允许沿既定路径前进（不可跳级），转入暂停/离职除外。推进到「可排班」时会校验必修培训与能力要求，不满足会列出具体原因并拒绝。

---

## 十一、部署

> **想先跑一个预览环境？** 看 `DEPLOY-PREVIEW.md` —— Supabase 数据库已经建好并灌满演示数据，
> 你只需要做 Vercel 那一半（约 10 分钟）。里面写清了每个环境变量填什么、
> 为什么连接串必须带 `?schema=app`、以及部署后怎么用 `/api/health` 与 `/api/dev/selfcheck` 验证。


### 环境变量

见 `.env.example`。生产环境必须设置：

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串。用连接池时带 `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | 直连地址，供 `prisma migrate` 使用（Supabase / Neon 等托管库需要） |
| `AUTH_SECRET` | `openssl rand -base64 48` |
| `NEXT_PUBLIC_APP_URL` | 站点地址 |
| `NEXT_PUBLIC_DEMO_MODE` | 生产设为 `false` |
| `DEV_CHECK_TOKEN` | 生产**留空** |

### 部署检查清单

- [ ] `AUTH_SECRET` 已替换为随机值
- [ ] 全部 Demo 帐号密码已重置（`Demo@2026` 绝不可用于生产）
- [ ] `NEXT_PUBLIC_DEMO_MODE=false`
- [ ] `DEV_CHECK_TOKEN` 留空
- [ ] HTTPS 已启用（`next.config.mjs` 已配置 HSTS）
- [ ] 数据库已配置自动备份
- [ ] 若启用附件功能，已配置私有对象存储并实现 `lib/storage` 的 `getObject`
- [ ] `npm run check:all` 全绿

### Vercel + 托管 PostgreSQL

```bash
npm run db:deploy    # 应用 migration（用 DIRECT_URL）
npm run db:seed      # 仅演示环境
```

`build` 脚本已包含 `prisma generate`。所有数据页面都是 `force-dynamic`，构建期不访问数据库。

---

## 十二、已完成 / 未完成

### 已完成

**12 个核心模块全部落地：**

1. ✅ 登录与角色权限 —— 会话、12 种角色、50 项能力、数据范围、页面与端级守卫
2. ✅ 家庭 CRM —— 列表（搜索姓名/手机/编号，7 种状态筛选、分页）+ **Household 360°** 十二个 Tab；建家庭 / 建长辈 / 建成员 / 改家庭状态全部可在界面完成
3. ✅ 长辈安心档案 —— 生活情况为主，可在界面编辑；健康敏感信息独立表 + 能力裁剪 + 单独录入表单 + 单独审计
4. ✅ 家庭成员与授权 —— 七类授权、版本化、授权依据、撤回留痕、授权矩阵；**新增成员不附带任何授权**
5. ✅ 安心专员管理 —— 档案、学历核验、培训与考核录入、能力标签增删与授予/撤销、上岗状态机、派单资格闸门
6. ✅ 服务方案与会员 —— `ServicePlan` 后台可编辑 / `HouseholdServicePlan` / `Subscription` 开通 / `Order` / 退款 / 发票登记
7. ✅ 排班与派单 —— 固定专员优先、备用专员自动兜底、改派留原因并通知家庭、14 天日历、任务取消
8. ✅ 安心专员今日任务 —— Mobile First「今天」、任务详情（已脱敏）、状态机推进、不可排班时间申报
9. ✅ 上门服务记录 —— 一次性到达签到、卡片式表单、健康数值带来源、原始记录永久保留 + 追加式修订
10. ✅ 异常事件中心 —— 常驻「需要协助」、七类事件、完整时间线、按授权通知家庭、关闭必填处理结果
11. ✅ 家庭安心报告 —— 规则式草稿生成、原始记录逐句对照、人工确认、发布、按授权定向通知
12. ✅ 家庭端服务时间线 —— 授权过滤的时间线、报告阅读页与评分、服务安排、改期/额外服务申请、自助撤回授权

**家庭申请已闭环：** 家庭提交改期 / 取消 / 额外服务 → 后台「家庭申请」列表 → 审批。同意即真正改动任务
（改期改 `scheduledStart` 并回到 `ASSIGNED`、取消走 `cancelTask`、额外服务直接 `createTask`），
不再需要运营手动去派单页改。

**系统配置已可维护：** 帐号管理（建内部帐号 / 停用 / 重置密码，三者都会吊销全部会话）、
服务类型与价格（`ServiceCatalogItem`，决定家庭端能自助申请哪几类）、
通知模板（占位符白名单校验，未实现的渠道保持关闭）、城市与区域、角色权限矩阵（只读）、操作日志。

**另外完成：** 运营总览 Dashboard；运营指标含服务质量 / 事件 / 人效 / **续费率 / 家庭满意度 / 利用率**；
财务指标；客服工单（反馈处理、投诉与咨询登记）；通知中心；隐私与授权说明页；内置自检端点；健康检查端点。

### 未完成（诚实清单）

| 项目 | 现状 |
| --- | --- |
| **对象存储** | 权限与签名链路已完整（`lib/storage` + `/api/files`），但未接真实 S3/OSS。`/api/files` 在校验通过后返回 501 并说明原因 —— 刻意不返回假图片。 |
| **在线支付** | 未接。订单状态由运营/财务在后台登记。 |
| **开票** | 刻意做成人工流程：后台登记开票信息 → 到税控系统实际开出 → 回填发票号。没有「一键开票」，因为没接税控系统，那会是个假功能。 |
| **短信/微信/企业微信通知** | 字段、模板与渠道开关都已就位，`dispatchExternal()` 明确返回「未接入」，不会假装已送达。通知模板界面也不允许启用未实现的渠道。 |
| **AI 报告整理** | `generation` / `aiGenerated` / `aiModel` 字段与 `AI_REPORT_ENABLED` 开关已就位，但未接模型。当前是规则式生成。 |
| **服务日历** | 只做了 14 天分组列表，没有拖拽排班控件。 |
| **角色权限编辑** | `/admin/system/roles` 是只读展示。权限矩阵在代码里集中定义，避免有人在界面误改且无法审计。 |
| **绩效自动计算** | `StaffPerformanceSnapshot` 表与展示已就绪，但快照目前由 seed 写入，没有定时任务生成。 |
| **软删除 UI** | 数据层有 `deletedAt` 并在所有查询中过滤，但没有「回收站」界面。 |
| **管理员 2FA** | 字段已预留，未实现验证流程。 |
| **多城市 / 加盟** | 数据模型已按多城市设计（`City` / `District` / `cityId` 范围隔离），但没有跨城调度与加盟商功能。 |
| **单元测试** | 没有 Jest/Vitest 测试。验证依靠 `/api/dev/selfcheck`（50+ 项服务端断言）+ typecheck + lint + build。 |
| **交付前的 typecheck / lint / build** | 构建环境 npm 不可用，未能在交付前执行。详见 `VERIFICATION.md`。 |

**第一版明确不做**（按产品要求）：AI 疾病诊断、智能问诊、电子病历、全天 GPS、监控摄像头、复杂 IoT、智能手环、多城市加盟系统、积分商城、直播、养老电商、智能健康预测、复杂 AI 排班。

---

## 十三、下一步最值得做的功能

按「对业务的杠杆 / 实现成本」排序，我的建议是：

### 第一优先：绩效快照的定时生成

`qualityMetrics()` / `renewalRate()` / `utilizationMetrics()` 已经能实时算，但每次打开页面都全表扫。
加一个每周跑一次的任务把 `StaffPerformanceSnapshot` 写进去，同时给督导一个「本周需要关注的专员」清单
（准时率下滑、记录不及时、有投诉）。

这会让「我们强调服务质量而不是单量」从一句话变成运营每周真正会看的东西。成本约 1 天。

### 第二优先：续费提醒的自动化

`renewalRate()` 已经能算出「到期了但没续」的家庭。现在续费全靠人盯，规模到 100 户会明显吃力。
建议做成：到期前 14 天生成待办 + 站内通知 → 运营跟进记录 → 续费订单，把续费变成有流程的事而不是靠记性。

### 第三优先：对象存储 + 服务照片

上门照片是家庭端感知价值的重要一环（「我看到妈妈今天在小区散步」）。权限与签名链路已经写好，接 S3/OSS 大约半天。

注意接入时要同步做：拍照前征得长辈同意的流程提示、照片的 `PHOTO` 授权已在代码里独立控制（家庭成员没有 `PHOTO` 授权时 `myLifeRecords` 不返回 `photoKeys`）。

### 之后再考虑

- **在线支付** —— 现在订单靠后台登记，家庭无法自助付款
- **AI 报告整理** —— 建议等到每周报告量超过 50 份再做，且必须保留「逐句对照原始记录」的审核界面
- **短信通知** —— 紧急事件目前只有站内通知，家庭不一定及时看到。这件事的紧迫性取决于实际事件频率

---

## 附：几个可能会被问到的实现细节

**为什么 middleware 不做数据权限判定？**
Edge Runtime 连不上数据库。middleware 只做「未登录 → 登录页」「走错端 → 自己的落地页」这类体验优化，真正的判定全部在服务端 Node runtime 重新查库执行。

**为什么授权不足时返回 404 而不是 403？**
避免通过响应码差异探测「这个家庭/这份报告是否存在」。`assertHouseholdAccess()` 与 `myReport()` 都按「找不到」处理。

**为什么报告的统计数字不允许人工修改？**
`visitCount` / `phoneCareCount` 由原始记录统计得出。如果允许手改，报告就不再是「对已发生服务的表达」，而变成可以被润色的营销材料 —— 这会毁掉整个产品的信任基础。

**为什么服务记录提交后不能编辑？**
原始记录是服务发生过的事实。需要更正时追加 `amendmentNote`（带时间戳与操作人），原文保留。`amendVisitRecord()` 只做追加。

**为什么家庭端看不到「有数据但你没权限」？**
授权不足时数据不进入返回值，界面呈现为「没有可查看的内容」。刻意不提示「有 3 份报告但你看不到」—— 那本身也是信息泄露。
