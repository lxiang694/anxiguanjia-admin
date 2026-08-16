import Link from 'next/link';

import { Badge, Card, CardHeader, EmptyState, StatTile, Table, Td } from '@/components/ui';
import { ORDER_STATUS_LABELS, ORDER_TYPE_LABELS } from '@/lib/labels';
import { can, guardPage } from '@/lib/permissions';
import { formatDateTime, formatMoneyCNY } from '@/lib/utils';
import { listOrders, monthlyRevenue } from '@/services/subscription';
import { RefundForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '订单' };

export default async function OrdersPage() {
  const user = await guardPage('order.read', { returnTo: '/admin/billing/orders' });
  const [orders, revenue] = await Promise.all([listOrders(user), monthlyRevenue()]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">订单</h1>
        <p className="mt-1 text-sm text-ink-500">
          第一版未接入在线支付，订单状态由运营/财务在后台登记；退款会额外生成一条负数金额的记录以保留账目痕迹。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
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

      <Card className="overflow-hidden">
        <CardHeader title="订单列表" subtitle={`共 ${orders.length} 条`} />
        {orders.length === 0 ? (
          <EmptyState title="还没有订单" />
        ) : (
          <Table head={['订单号', '时间', '家庭', '类型', '说明', '金额', '状态', '']}>
            {orders.map((o) => (
              <tr key={o.id}>
                <Td className="font-mono text-[13px]">{o.orderNo}</Td>
                <Td className="whitespace-nowrap text-[13px]">{formatDateTime(o.createdAt)}</Td>
                <Td>
                  <Link href={`/admin/households/${o.household.id}`} className="link text-[13px]">
                    {o.household.name}
                  </Link>
                </Td>
                <Td className="text-[13px]">{ORDER_TYPE_LABELS[o.type]}</Td>
                <Td className="max-w-[14rem] text-[13px]">{o.description ?? '—'}</Td>
                <Td className={o.amount < 0 ? 'tabular-nums text-danger-600' : 'tabular-nums'}>
                  {formatMoneyCNY(o.amount)}
                </Td>
                <Td>
                  <Badge
                    tone={o.status === 'PAID' ? 'brand' : o.status === 'REFUNDED' ? 'danger' : 'neutral'}
                  >
                    {ORDER_STATUS_LABELS[o.status]}
                  </Badge>
                </Td>
                <Td>
                  {can(user, 'order.refund') && o.status === 'PAID' && o.amount > 0 ? (
                    <RefundForm orderId={o.id} />
                  ) : null}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
