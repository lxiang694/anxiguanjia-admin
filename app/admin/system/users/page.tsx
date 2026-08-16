import { Badge, Card, CardHeader, EmptyState, Table, Td } from '@/components/ui';
import { prisma } from '@/lib/db';
import { ROLE_LABELS, SERVICE_STATUS_LABELS, STAFF_LEVEL_LABELS, USER_STATUS_LABELS } from '@/lib/labels';
import { can, guardPage } from '@/lib/permissions';
import { formatDateTime, maskPhone } from '@/lib/utils';
import { listUsers } from '@/services/account';
import { CreateUserForm, UserRowActions } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '帐号管理' };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const user = await guardPage('user.read', { returnTo: '/admin/system/users' });
  const sp = await searchParams;

  const [users, cities] = await Promise.all([
    listUsers(user, { q: sp.q, role: (sp.role as never) || 'ALL' }),
    prisma.city.findMany({
      where: { isActive: true },
      include: { districts: { orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">帐号管理</h1>
        <p className="mt-1 text-sm text-ink-500">
          内部帐号与一线成员帐号在这里创建。家庭成员帐号属于某个家庭，在该家庭的「家庭成员」页创建。
        </p>
      </div>

      {can(user, 'user.manage') ? (
        <Card>
          <CardHeader
            title="新建帐号"
            subtitle="一线岗位（专员 / 资深专员 / 顾问）会同时建立安心专员档案，初始服务状态为「未开始」。"
          />
          <div className="px-5 py-4">
            <CreateUserForm cities={cities} isSuperAdmin={user.role === 'SUPER_ADMIN'} />
          </div>
        </Card>
      ) : null}

      <form method="GET" className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="搜索姓名 / 手机号 / 邮箱"
          className="field sm:max-w-xs"
        />
        <button
          type="submit"
          className="h-10 rounded-lg border border-cream-400 bg-white px-4 text-sm text-ink-700 hover:border-brand-300"
        >
          搜索
        </button>
      </form>

      <Card className="overflow-hidden">
        <CardHeader title="内部帐号" subtitle={`共 ${users.length} 个`} />
        {users.length === 0 ? (
          <EmptyState title="还没有内部帐号" />
        ) : (
          <Table head={['姓名', '手机号', '角色', '员工编号', '职级 / 区域', '服务状态', '帐号状态', '最近登录', '']}>
            {users.map((u) => (
              <tr key={u.id}>
                <Td className="font-medium">{u.name}</Td>
                <Td className="text-[13px]">{maskPhone(u.phone)}</Td>
                <Td className="text-[13px]">{ROLE_LABELS[u.role]}</Td>
                <Td className="font-mono text-[13px]">{u.staffProfile?.employeeCode ?? '—'}</Td>
                <Td className="text-[13px]">
                  {u.staffProfile
                    ? `${STAFF_LEVEL_LABELS[u.staffProfile.staffLevel]}${u.staffProfile.district ? ` · ${u.staffProfile.district.name}` : ''}`
                    : '—'}
                </Td>
                <Td>
                  {u.staffProfile ? (
                    <Badge tone={u.staffProfile.serviceStatus === 'ACTIVE' ? 'brand' : 'warm'}>
                      {SERVICE_STATUS_LABELS[u.staffProfile.serviceStatus]}
                    </Badge>
                  ) : (
                    <span className="text-[13px] text-ink-400">—</span>
                  )}
                </Td>
                <Td>
                  <Badge
                    tone={
                      u.status === 'ACTIVE' ? 'brand' : u.status === 'DISABLED' ? 'danger' : 'warm'
                    }
                  >
                    {USER_STATUS_LABELS[u.status]}
                  </Badge>
                </Td>
                <Td className="whitespace-nowrap text-xs text-ink-400">
                  {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '从未登录'}
                </Td>
                <Td>
                  {can(user, 'user.manage') && u.id !== user.id ? (
                    <UserRowActions userId={u.id} status={u.status} />
                  ) : null}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title="关于密码与通知" />
        <ul className="list-disc space-y-1.5 px-5 py-4 pl-9 text-[13px] leading-relaxed text-ink-600">
          <li>初始密码由创建人当场设定，并当面或电话告知本人。第一版没有短信/邮件渠道，系统不会自动发送。</li>
          <li>重置密码会立即吊销该帐号的全部登录会话。</li>
          <li>停用或暂停帐号同样会立即吊销全部会话，不等 Cookie 自然过期。</li>
          <li>密码与其哈希都不会写入操作日志。</li>
        </ul>
      </Card>
    </div>
  );
}
