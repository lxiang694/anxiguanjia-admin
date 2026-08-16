import Link from 'next/link';
import { Receipt } from 'lucide-react';

import { Badge, Card, CardHeader, EmptyState, StatTile, Table, Td } from '@/components/ui';
import { INVOICE_STATUS_LABELS, INVOICE_TYPE_LABELS, ORDER_TYPE_LABELS } from '@/lib/labels';
import { guardPage } from '@/lib/permissions';
import { formatDate, formatMoneyCNY } from '@/lib/utils';
import { listInvoiceOrders } from '@/services/subscription';
import { InvoiceActions } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '发票' };

const TABS = [
  { value: 'PENDING', label: '待处理' },
  { value: 'REQUESTED', label: '已申请' },
  { value: 'ISSUED', label: '已开票' },
  { value: 'VOIDED', label: '已作废' },
  { value: 'ALL', label: '全部' },
] as const;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await guardPage('invoice.manage', { returnTo: '/admin/billing/invoices' });
  const sp = await searchParams;
  const status = TABS.find((t) => t.value === sp.status)?.value ?? 'PENDING';

  const [orders, all] = await Promise.all([
    listInvoiceOrders(user, { status }),
    listInvoiceOrders(user, { status: 'ALL' }),
  ]);

  const counts = {
    requested: all.filter((o) => o.invoiceStatus === 'REQUESTED').length,
    issued: all.filter((o) => o.invoiceStatus === 'ISSUED').length,
    notRequested: all.filter((o) => o.invoiceStatus === 'NOT_REQUESTED' && o.status === 'PAID').length,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">发票</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-500">
          第一版是人工流程：在这里登记家庭要开什么票，到税控系统实际开出后回填发票号。
          刻意不做「一键开票」—— 没有接税控系统，那会是个假功能。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="待申请" value={counts.notRequested} />
        <StatTile
          label="已申请待开票"
          value={counts.requested}
          tone={counts.requested > 0 ? 'warm' : 'neutral'}
        />
        <StatTile label="已开票" value={counts.issued} tone="brand" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/admin/billing/invoices?status=${t.value}`}
            className={
              t.value === status
                ? 'rounded-pill bg-brand-700 px-3 py-1.5 text-[13px] font-medium text-white'
                : 'rounded-pill border border-cream-400 bg-white px-3 py-1.5 text-[13px] text-ink-600 hover:border-brand-300'
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="订单开票情况" subtitle={`共 ${orders.length} 条`} />
        {orders.length === 0 ? (
          <EmptyState icon={<Receipt className="h-5 w-5" />} title="没有符合条件的订单" />
        ) : (
          <Table head={['订单号', '家庭', '类型', '金额', '开票状态', '发票信息', '']}>
            {orders.map((o) => (
              <tr key={o.id}>
                <Td className="font-mono text-[13px]">
                  {o.orderNo}
                  <span className="mt-0.5 block font-sans text-xs text-ink-400">
                    {formatDate(o.createdAt)}
                  </span>
                </Td>
                <Td>
                  <Link href={`/admin/households/${o.household.id}`} className="link text-[13px]">
                    {o.household.name}
                  </Link>
                </Td>
                <Td className="text-[13px]">{ORDER_TYPE_LABELS[o.type]}</Td>
                <Td className="tabular-nums">{formatMoneyCNY(o.amount)}</Td>
                <Td>
                  <Badge
                    tone={
                      o.invoiceStatus === 'ISSUED'
                        ? 'brand'
                        : o.invoiceStatus === 'REQUESTED'
                          ? 'warm'
                          : o.invoiceStatus === 'VOIDED'
                            ? 'danger'
                            : 'neutral'
                    }
                  >
                    {INVOICE_STATUS_LABELS[o.invoiceStatus]}
                  </Badge>
                </Td>
                <Td className="text-[13px]">
                  {o.invoiceTitle ? (
                    <>
                      <span className="block text-ink-800">{o.invoiceTitle}</span>
                      <span className="block text-xs text-ink-400">
                        {o.invoiceType ? INVOICE_TYPE_LABELS[o.invoiceType] : ''}
                        {o.invoiceTaxNo ? ` · ${o.invoiceTaxNo}` : ''}
                      </span>
                      {o.invoiceNo ? (
                        <span className="block font-mono text-xs text-brand-700">
                          发票号 {o.invoiceNo}
                        </span>
                      ) : null}
                      {o.invoiceNote ? (
                        <span className="block text-xs text-ink-400">{o.invoiceNote}</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </Td>
                <Td>
                  <InvoiceActions orderId={o.id} invoiceStatus={o.invoiceStatus} />
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
