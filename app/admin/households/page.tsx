import Link from 'next/link';
import { Home, Plus, Search } from 'lucide-react';
import type { HouseholdStatus } from '@prisma/client';

import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  Table,
  Td,
  DemoBadge,
} from '@/components/ui';
import {
  HOUSEHOLD_STATUS_LABELS,
  HOUSEHOLD_STATUS_TONE,
  PLAN_TIER_LABELS,
} from '@/lib/labels';
import { can, guardPage } from '@/lib/permissions';
import { ageFromBirthday, formatDate } from '@/lib/utils';
import { listHouseholds } from '@/services/household';

export const dynamic = 'force-dynamic';
export const metadata = { title: '家庭列表' };

const STATUS_TABS: { value: HouseholdStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'LEAD', label: '潜在' },
  { value: 'PENDING_ASSESSMENT', label: '待评估' },
  { value: 'TRIAL', label: '体验中' },
  { value: 'ACTIVE_MEMBER', label: '正式会员' },
  { value: 'RENEWAL_DUE', label: '待续费' },
  { value: 'PAUSED', label: '暂停' },
  { value: 'TERMINATED', label: '终止' },
];

export default async function HouseholdsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const user = await guardPage('household.read', { returnTo: '/admin/households' });
  const sp = await searchParams;

  const status = (STATUS_TABS.find((t) => t.value === sp.status)?.value ?? 'ALL') as
    | HouseholdStatus
    | 'ALL';
  const page = Number(sp.page ?? '1') || 1;

  const { items, total, pageSize } = await listHouseholds(user, {
    q: sp.q,
    status,
    page,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function tabHref(value: string) {
    const params = new URLSearchParams();
    if (value !== 'ALL') params.set('status', value);
    if (sp.q) params.set('q', sp.q);
    const qs = params.toString();
    return `/admin/households${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-800">家庭</h1>
          <p className="mt-1 text-sm text-ink-500">
            一个家庭是一个服务单位。共 {total} 个家庭在您的可见范围内。
          </p>
        </div>
        {can(user, 'household.create') ? (
          <ButtonLink href="/admin/households/new" variant="primary">
            <Plus className="h-4 w-4" />
            新建家庭
          </ButtonLink>
        ) : null}
      </div>

      {/* 搜索 */}
      <form method="GET" className="flex flex-wrap gap-2">
        {status !== 'ALL' ? <input type="hidden" name="status" value={status} /> : null}
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
          <input
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="搜索家庭名 / 长辈姓名 / 手机号 / 家庭编号"
            className="field pl-9"
          />
        </div>
        <button
          type="submit"
          className="h-10 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800"
        >
          搜索
        </button>
        {sp.q ? (
          <Link href={tabHref(status)} className="link inline-flex h-10 items-center px-2 text-sm">
            清除
          </Link>
        ) : null}
      </form>

      {/* 状态筛选 */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((t) => {
          const active = t.value === status;
          return (
            <Link
              key={t.value}
              href={tabHref(t.value)}
              className={
                active
                  ? 'rounded-pill bg-brand-700 px-3 py-1.5 text-[13px] font-medium text-white'
                  : 'rounded-pill border border-cream-400 bg-white px-3 py-1.5 text-[13px] text-ink-600 hover:border-brand-300 hover:text-brand-700'
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            icon={<Home className="h-5 w-5" />}
            title={sp.q ? '没有匹配的家庭' : '还没有家庭'}
            description={
              sp.q
                ? '试试用家庭编号或长辈姓名再搜一次。'
                : '从新建家庭开始：建档 → 建立长辈安心档案 → 加入家庭成员 → 取得授权 → 制定服务方案。'
            }
            action={
              can(user, 'household.create') && !sp.q ? (
                <ButtonLink href="/admin/households/new" variant="primary" size="sm">
                  新建家庭
                </ButtonLink>
              ) : null
            }
          />
        ) : (
          <>
            <Table
              head={['家庭', '长辈', '区域', '固定安心专员', '方案', '状态', '更新时间']}
            >
              {items.map((h) => (
                <tr key={h.id} className="transition hover:bg-cream-50">
                  <Td>
                    <Link href={`/admin/households/${h.id}`} className="group block">
                      <span className="flex items-center gap-1.5">
                        <span className="font-medium text-ink-800 group-hover:text-brand-700">
                          {h.name}
                        </span>
                        {h.isDemo ? <DemoBadge /> : null}
                      </span>
                      <span className="mt-0.5 block font-mono text-xs text-ink-400">
                        {h.householdCode}
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    {h.elders.length === 0 ? (
                      <span className="text-ink-400">未建档</span>
                    ) : (
                      <span className="text-[13px]">
                        {h.elders
                          .map((e) => {
                            const age = ageFromBirthday(e.birthday);
                            return age ? `${e.name}（${age}岁）` : e.name;
                          })
                          .join('、')}
                      </span>
                    )}
                  </Td>
                  <Td className="text-[13px]">
                    {h.city.name}
                    {h.district ? ` · ${h.district.name}` : ''}
                  </Td>
                  <Td className="text-[13px]">
                    {h.primarySpecialist?.user.name ?? (
                      <span className="text-warm-600">未指派</span>
                    )}
                  </Td>
                  <Td className="text-[13px]">
                    {h.servicePlan?.plan
                      ? PLAN_TIER_LABELS[h.servicePlan.plan.tier]
                      : <span className="text-ink-400">—</span>}
                  </Td>
                  <Td>
                    <Badge tone={HOUSEHOLD_STATUS_TONE[h.status]}>
                      {HOUSEHOLD_STATUS_LABELS[h.status]}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-ink-400">
                    {formatDate(h.updatedAt)}
                  </Td>
                </tr>
              ))}
            </Table>

            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-cream-200 px-4 py-3 text-[13px] text-ink-500">
                <span>
                  第 {page} / {totalPages} 页
                </span>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Link
                      href={`${tabHref(status)}${tabHref(status).includes('?') ? '&' : '?'}page=${page - 1}`}
                      className="link"
                    >
                      上一页
                    </Link>
                  ) : null}
                  {page < totalPages ? (
                    <Link
                      href={`${tabHref(status)}${tabHref(status).includes('?') ? '&' : '?'}page=${page + 1}`}
                      className="link"
                    >
                      下一页
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}
