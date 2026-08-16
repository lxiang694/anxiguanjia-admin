import Link from 'next/link';

import { Badge, Card, CardHeader, EmptyState, StatTile, Table, Td } from '@/components/ui';
import { prisma } from '@/lib/db';
import { SUBSCRIPTION_STATUS_LABELS } from '@/lib/labels';
import { can, guardPage } from '@/lib/permissions';
import { formatDate, formatMoneyCNY } from '@/lib/utils';
import { renewalDueSubscriptions, revenueMetrics } from '@/services/subscription';
import { RenewForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '订阅' };

export default async function SubscriptionsPage() {
  const user = await guardPage('subscription.read', { returnTo: '/admin/billing/subscriptions' });

  const [subscriptions, metrics, dueSoon] = await Promise.all([
    prisma.subscription.findMany({
      include: {
        household: { select: { id: true, name: true, householdCode: true } },
        plan: { select: { name: true, visitsPerMonth: true, phoneCarePerMonth: true, reportsPerMonth: true } },
      },
      orderBy: [{ status: 'asc' }, { currentPeriodEnd: 'asc' }],
      take: 200,
    }),
    revenueMetrics(),
    renewalDueSubscriptions(30),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">订阅</h1>
        <p className="mt-1 text-sm text-ink-500">
          核心是会员订阅，不是「一个订单 = 一次上门」。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="生效中订阅" value={metrics.activeCount} tone="brand" />
        <StatTile label="MRR" value={formatMoneyCNY(metrics.mrr)} tone="brand" />
        <StatTile label="ARPU" value={formatMoneyCNY(metrics.arpu)} />
        <StatTile label="30 天内待续费" value={dueSoon.length} tone={dueSoon.length > 0 ? 'warm' : 'neutral'} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="订阅列表" subtitle={`共 ${subscriptions.length} 条`} />
        {subscriptions.length === 0 ? (
          <EmptyState title="还没有订阅记录" />
        ) : (
          <Table head={['家庭', '方案', '状态', '月费', '本周期', '本周期权益使用', '自动续费', '']}>
            {subscriptions.map((s) => (
              <tr key={s.id}>
                <Td>
                  <Link href={`/admin/households/${s.household.id}`} className="link font-medium">
                    {s.household.name}
                  </Link>
                  <span className="mt-0.5 block font-mono text-xs text-ink-400">
                    {s.household.householdCode}
                  </span>
                </Td>
                <Td className="text-[13px]">{s.plan.name}</Td>
                <Td>
                  <Badge
                    tone={
                      s.status === 'ACTIVE'
                        ? 'brand'
                        : s.status === 'PAST_DUE'
                          ? 'danger'
                          : s.status === 'TRIAL'
                            ? 'info'
                            : 'warm'
                    }
                  >
                    {SUBSCRIPTION_STATUS_LABELS[s.status]}
                  </Badge>
                </Td>
                <Td className="tabular-nums">{formatMoneyCNY(s.monthlyPrice)}</Td>
                <Td className="whitespace-nowrap text-[13px]">
                  {formatDate(s.currentPeriodStart)} → {formatDate(s.currentPeriodEnd)}
                </Td>
                <Td className="text-[13px] tabular-nums">
                  探访 {s.usedVisits}/{s.plan.visitsPerMonth} · 关怀 {s.usedPhoneCare}/
                  {s.plan.phoneCarePerMonth} · 报告 {s.usedReports}/{s.plan.reportsPerMonth}
                </Td>
                <Td className="text-[13px]">{s.autoRenew ? '是' : '否'}</Td>
                <Td>
                  {can(user, 'subscription.manage') ? <RenewForm subscriptionId={s.id} /> : null}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
