import Link from 'next/link';

import { Badge, Card, CardHeader, EmptyState, Table, Td } from '@/components/ui';
import { prisma } from '@/lib/db';
import { RELATIONSHIP_LABELS, USER_STATUS_LABELS } from '@/lib/labels';
import { guardPage, householdScopeWhere } from '@/lib/permissions';
import { maskPhone } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: '家庭成员' };

export default async function MembersPage() {
  const user = await guardPage('familyMember.read', { returnTo: '/admin/members' });
  const scope = householdScopeWhere(user);

  const members = scope
    ? await prisma.familyMember.findMany({
        where: { household: scope },
        include: {
          user: { select: { id: true, name: true, phone: true, status: true } },
          household: { select: { id: true, name: true, householdCode: true } },
          elder: { select: { name: true } },
        },
        orderBy: [{ householdId: 'asc' }, { createdAt: 'asc' }],
        take: 300,
      })
    : [];

  // 统计每位成员拥有的有效授权数，用于直观看出「付款不等于能看」
  const consentCounts = await prisma.consent.groupBy({
    by: ['granteeId'],
    where: {
      status: 'ACTIVE',
      revokedAt: null,
      granteeId: { in: members.map((m) => m.userId) },
    },
    _count: { _all: true },
  });
  const countMap = new Map(consentCounts.map((c) => [c.granteeId, c._count._all]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">家庭成员</h1>
        <p className="mt-1 text-sm text-ink-500">
          「有效授权数」为 0 的成员，即使是付款人，在家庭端也看不到任何长辈数据。
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="成员列表" subtitle={`共 ${members.length} 人`} />
        {members.length === 0 ? (
          <EmptyState title="还没有家庭成员" />
        ) : (
          <Table head={['姓名', '手机号', '家庭', '关系', '角色标记', '对应长辈', '有效授权数', '帐号状态']}>
            {members.map((m) => {
              const count = countMap.get(m.userId) ?? 0;
              return (
                <tr key={m.id}>
                  <Td className="font-medium">{m.user.name}</Td>
                  <Td className="text-[13px]">{maskPhone(m.user.phone)}</Td>
                  <Td>
                    <Link href={`/admin/households/${m.household.id}`} className="link text-[13px]">
                      {m.household.name}
                    </Link>
                  </Td>
                  <Td className="text-[13px]">{RELATIONSHIP_LABELS[m.relationship]}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {m.isPayer ? <Badge tone="info">付款人</Badge> : null}
                      {m.isPrimaryContact ? <Badge tone="brand">主要联络人</Badge> : null}
                      {m.isEmergencyContact ? <Badge tone="warm">紧急联络人</Badge> : null}
                      {!m.isPayer && !m.isPrimaryContact && !m.isEmergencyContact ? (
                        <span className="text-[13px] text-ink-400">—</span>
                      ) : null}
                    </div>
                  </Td>
                  <Td className="text-[13px]">{m.elder?.name ?? '整个家庭'}</Td>
                  <Td>
                    <Badge tone={count > 0 ? 'brand' : 'neutral'}>{count}</Badge>
                  </Td>
                  <Td className="text-[13px]">{USER_STATUS_LABELS[m.user.status]}</Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}
