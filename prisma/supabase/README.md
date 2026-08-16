# Supabase 预览环境 SQL

按顺序执行。三个文件都可以直接贴进 Supabase 控制台的 SQL Editor。

| 文件 | 作用 |
| --- | --- |
| `01-schema.sql` | 建 `app` schema：37 张表 / 40 个枚举 / 64 个外键 / 32 个唯一约束 / 39 个索引，并对全部表启用 RLS |
| `02-demo-data.sql` | 写入演示数据。密码用库内 pgcrypto 生成 bcrypt 哈希，不需要本地 Node |
| `03-verify.sql` | 30 项隔离与合规检查，输出「预期 / 实际 / 结果」表格。出现 ❌ 就是真实问题 |

## 为什么建在 app schema 而不是 public

Supabase 通过 PostgREST 把 `public` 暴露成 HTTP API，而 anon key 是公开字符串。
表建在 `public` 且没有 RLS 策略，就等于把长辈健康数据放在公网上。

两层防护：`app` schema 不在 PostgREST 的暴露范围；37 张表全部启用 RLS 且不建 policy
（deny-all）。Prisma 用的 `postgres` 角色是表 owner，默认绕过 RLS，应用照常读写。

**因此连接串必须带 `?schema=app`。** 忘了加会报 "relation does not exist"。

## 重新灌一遍

```sql
DROP SCHEMA app CASCADE;
```
然后重新执行 `01` 和 `02`。

## 与 prisma/seed.ts 的关系

`seed.ts` 是维护主线，字段覆盖更全。如果你能在本地跑 `npm run db:seed`，用它。
这两套是同一个故事（相同手机号、相同家庭），`seed.ts` 会先清空再写入，不会冲突。

详细部署步骤见项目根目录的 `DEPLOY-PREVIEW.md`。
