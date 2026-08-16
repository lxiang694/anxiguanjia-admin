import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

import { Badge, Card, CardHeader, EmptyState, Table, Td } from '@/components/ui';
import { prisma } from '@/lib/db';
import {
  CONSENT_BASIS_LABELS,
  CONSENT_STATUS_LABELS,
  PERMISSION_DESCRIPTIONS,
  PERMISSION_LABELS,
  RELATIONSHIP_LABELS,
} from '@/lib/labels';
import { can, guardPage, householdScopeWhere } from '@/lib/permissions';
import { formatDate } from '@/lib/utils';
import { GrantConsentForm, RevokeConsentButton } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '授权管理' };

export default async function ConsentsPage({
  searchParams,
}: {
  searchParams: Promise<{ household?: string }>;
}) {
  const user = await guardPage('consent.read', { returnTo: '/admin/consents' });
  const sp = await searchParams;
  const scope = householdScopeWhere(user);

  const households = scope
    ? await prisma.household.findMany({
        where: scope,
        select: {
          id: true,
          name: true,
          householdCode: true,
          elders: { where: { deletedAt: null }, select: { id: true, name: true } },
          members: {
            select: {
              id: true,
              relationship: true,
              isPayer: true,
              user: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { householdCode: 'asc' },
      })
    : [];

  const selectedId = sp.household && households.some((h) => h.id === sp.household)
    ? sp.household
    : households[0]?.id;

  const selected = households.find((h) => h.id === selectedId);

  const consents = selected
    ? await prisma.consent.findMany({
        where: { elder: { householdId: selected.id, deletedAt: null } },
        include: {
          elder: { select: { id: true, name: true } },
          grantor: { select: { name: true } },
          grantee: { select: { name: true } },
        },
        orderBy: [{ status: 'asc' }, { elderId: 'asc' }, { permissionType: 'asc' }, { version: 'desc' }],
      })
    : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">授权管理</h1>
        <p className="mt-1 text-sm text-ink-500">
          付款权 ≠ 数据查看权。子女支付服务费，不代表自动获得父母全部个人信息。
        </p>
      </div>

      {/* 授权类型说明 */}
      <Card>
        <CardHeader title="授权类型" subtitle="授权按业务可理解的粒度划分，家庭成员逐项授予。" />
        <ul className="divide-y divide-cream-100 px-5">
          {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
            <li key={key} className="py-2.5 text-sm">
              <span className="font-medium text-ink-800">{label}</span>
              <span className="ml-2 text-[13px] text-ink-500">
                {PERMISSION_DESCRIPTIONS[key as keyof typeof PERMISSION_DESCRIPTIONS]}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {households.length === 0 ? (
        <Card>
          <EmptyState title="没有可管理授权的家庭" />
        </Card>
      ) : (
        <>
          {/* 家庭选择 */}
          <form method="GET" className="flex flex-wrap items-end gap-2">
            <div className="min-w-[16rem]">
              <label className="label" htmlFor="household">
                选择家庭
              </label>
              <select id="household" name="household" className="field" defaultValue={selectedId}>
                {households.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.householdCode} · {h.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="h-10 rounded-lg border border-cream-400 bg-white px-4 text-sm text-ink-700 hover:border-brand-300"
            >
              切换
            </button>
          </form>

          {selected ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
              {can(user, 'consent.manage') ? (
                <Card>
                  <CardHeader
                    title="建立授权"
                    subtitle="必须在长辈本人（或法定监护人）同意后建立，并记录授权依据。"
                  />
                  <div className="px-5 py-4">
                    {selected.elders.length === 0 || selected.members.length === 0 ? (
                      <p className="py-4 text-sm text-ink-400">
                        该家庭需要至少一位长辈与一位家庭成员，才能建立授权。
                      </p>
                    ) : (
                      <GrantConsentForm
                        householdId={selected.id}
                        elders={selected.elders}
                        members={selected.members.map((m) => ({
                          userId: m.user.id,
                          name: m.user.name,
                          relationship: RELATIONSHIP_LABELS[m.relationship],
                          isPayer: m.isPayer,
                        }))}
                      />
                    )}
                  </div>
                </Card>
              ) : null}

              <Card className="overflow-hidden">
                <CardHeader
                  title={`${selected.name} 的授权记录`}
                  subtitle="撤回不会删除历史记录 —— 旧授权是历史事实，必须留存。"
                  action={
                    <Link href={`/admin/households/${selected.id}`} className="link text-[13px]">
                      家庭 360°
                    </Link>
                  }
                />
                {consents.length === 0 ? (
                  <EmptyState
                    icon={<ShieldCheck className="h-5 w-5" />}
                    title="尚未建立任何授权"
                    description="未经授权，该家庭的成员在家庭端看不到任何长辈数据。"
                  />
                ) : (
                  <Table head={['长辈', '被授权人', '授权内容', '依据', '有效期', '状态', '']}>
                    {consents.map((c) => (
                      <tr key={c.id}>
                        <Td>{c.elder.name}</Td>
                        <Td>
                          {c.grantee.name}
                          <span className="mt-0.5 block text-xs text-ink-400">
                            授权人：{c.grantor.name}
                          </span>
                        </Td>
                        <Td className="text-[13px]">{PERMISSION_LABELS[c.permissionType]}</Td>
                        <Td className="text-[13px]">{CONSENT_BASIS_LABELS[c.basis]}</Td>
                        <Td className="whitespace-nowrap text-[13px]">
                          {formatDate(c.grantedAt)} → {c.expiresAt ? formatDate(c.expiresAt) : '长期'}
                        </Td>
                        <Td>
                          <Badge
                            tone={
                              c.status === 'ACTIVE'
                                ? 'brand'
                                : c.status === 'REVOKED'
                                  ? 'danger'
                                  : 'neutral'
                            }
                          >
                            {CONSENT_STATUS_LABELS[c.status]}
                          </Badge>
                          <span className="mt-0.5 block font-mono text-[11px] text-ink-400">
                            v{c.version}
                          </span>
                        </Td>
                        <Td>
                          {c.status === 'ACTIVE' && can(user, 'consent.manage') ? (
                            <RevokeConsentButton consentId={c.id} householdId={selected.id} />
                          ) : null}
                        </Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </Card>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
