import Link from 'next/link';
import { Search, UserRound } from 'lucide-react';

import { Badge, Card, CardHeader, EmptyState, NonMedicalNotice, Table, Td } from '@/components/ui';
import { HOUSEHOLD_STATUS_LABELS, MOBILITY_STATUS_LABELS } from '@/lib/labels';
import { guardPage } from '@/lib/permissions';
import { ageFromBirthday, maskPhone } from '@/lib/utils';
import { listElders } from '@/services/elder';

export const dynamic = 'force-dynamic';
export const metadata = { title: '长辈档案' };

export default async function EldersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await guardPage('elder.read', { returnTo: '/admin/elders' });
  const sp = await searchParams;
  const elders = await listElders(user, sp.q);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">长辈安心档案</h1>
        <p className="mt-1 text-sm text-ink-500">
          档案以生活情况为主，不是电子病历。健康敏感信息单独隔离，按角色权限控制。
        </p>
      </div>

      <NonMedicalNotice />

      <form method="GET" className="flex flex-wrap gap-2">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
          <input
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="搜索长辈姓名或手机号"
            className="field pl-9"
          />
        </div>
        <button
          type="submit"
          className="h-10 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800"
        >
          搜索
        </button>
      </form>

      <Card className="overflow-hidden">
        <CardHeader title="长辈列表" subtitle={`共 ${elders.length} 位`} />
        {elders.length === 0 ? (
          <EmptyState
            icon={<UserRound className="h-5 w-5" />}
            title={sp.q ? '没有匹配的长辈' : '还没有长辈档案'}
            description="长辈档案在家庭建档后，由家庭安心顾问在评估过程中建立。"
          />
        ) : (
          <Table head={['姓名', '年龄', '家庭', '区域', '行动情况', '联系电话', '固定安心专员', '家庭状态']}>
            {elders.map((e) => {
              const age = ageFromBirthday(e.birthday);
              return (
                <tr key={e.id}>
                  <Td>
                    <Link href={`/admin/elders/${e.id}`} className="link font-medium">
                      {e.name}
                    </Link>
                  </Td>
                  <Td className="text-[13px] tabular-nums">{age ? `${age} 岁` : '—'}</Td>
                  <Td>
                    <Link href={`/admin/households/${e.household.id}`} className="link text-[13px]">
                      {e.household.name}
                    </Link>
                    <span className="mt-0.5 block font-mono text-xs text-ink-400">
                      {e.household.householdCode}
                    </span>
                  </Td>
                  <Td className="text-[13px]">{e.household.district?.name ?? '—'}</Td>
                  <Td className="text-[13px]">{MOBILITY_STATUS_LABELS[e.mobilityStatus]}</Td>
                  <Td className="text-[13px]">{maskPhone(e.phone)}</Td>
                  <Td className="text-[13px]">
                    {e.household.primarySpecialist?.user.name ?? (
                      <span className="text-warm-600">未指派</span>
                    )}
                  </Td>
                  <Td>
                    <Badge tone="neutral">{HOUSEHOLD_STATUS_LABELS[e.household.status]}</Badge>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}
