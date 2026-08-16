import { Card, CardHeader, EmptyState, StatTile, Table, Td } from '@/components/ui';
import { guardPage } from '@/lib/permissions';
import { formatDate, formatMoneyCNY } from '@/lib/utils';
import { monthlyRevenue, renewalDueSubscriptions, revenueMetrics } from '@/services/subscription';

export const dynamic = 'force-dynamic';
export const metadata = { title: '财务指标' };

export default async function FinanceAnalyticsPage() {
  await guardPage('dashboard.finance', { returnTo: '/admin/analytics/finance' });

  const [revenue, metrics, dueSoon] = await Promise.all([
    monthlyRevenue(),
    revenueMetrics(),
    renewalDueSubscriptions(30),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">财务指标</h1>
        <p className="mt-1 text-sm text-ink-500">
          财务角色可以看到订单与订阅，但按设计看不到长辈生活记录与健康信息。
        </p>
      </div>

      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-ink-700">本月收入</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="本月收入" value={formatMoneyCNY(revenue.total)} tone="brand" />
          <StatTile label="新订阅" value={formatMoneyCNY(revenue.newSubscription)} />
          <StatTile label="续费" value={formatMoneyCNY(revenue.renewal)} />
          <StatTile label="增值服务" value={formatMoneyCNY(revenue.addOn)} />
          <StatTile
            label="退款"
            value={formatMoneyCNY(revenue.refund)}
            tone={revenue.refund < 0 ? 'danger' : 'neutral'}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-ink-700">经常性收入</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="MRR" value={formatMoneyCNY(metrics.mrr)} tone="brand" />
          <StatTile label="ARPU" value={formatMoneyCNY(metrics.arpu)} />
          <StatTile label="生效中订阅" value={metrics.activeCount} />
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardHeader title="30 天内待续费" subtitle={`${dueSoon.length} 个家庭`} />
        {dueSoon.length === 0 ? (
          <EmptyState title="近一个月没有到期的订阅" />
        ) : (
          <Table head={['家庭', '方案', '月费', '本周期结束', '状态']}>
            {dueSoon.map((s) => (
              <tr key={s.id}>
                <Td className="font-medium">{s.household.name}</Td>
                <Td className="text-[13px]">{s.plan.name}</Td>
                <Td className="tabular-nums">{formatMoneyCNY(s.monthlyPrice)}</Td>
                <Td className="whitespace-nowrap text-[13px]">{formatDate(s.currentPeriodEnd)}</Td>
                <Td className="text-[13px]">{s.status}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
