import Link from 'next/link';
import { Inbox } from 'lucide-react';

import { Badge, Card, CardHeader, EmptyState, Table, Td } from '@/components/ui';
import { prisma } from '@/lib/db';
import {
  CHANGE_REQUEST_STATUS_LABELS,
  CHANGE_REQUEST_TYPE_LABELS,
  SERVICE_TYPE_LABELS,
} from '@/lib/labels';
import { can, guardPage } from '@/lib/permissions';
import { formatDateTime } from '@/lib/utils';
import { listChangeRequests } from '@/services/support';
import { DecideRequestForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '家庭申请' };

/** datetime-local 需要 yyyy-MM-ddTHH:mm 格式 */
function toLocalInput(d: Date | null): string | null {
  if (!d) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await guardPage('task.read', { returnTo: '/admin/service/requests' });
  const sp = await searchParams;
  const showAll = sp.status === 'ALL';

  const [requests, staff] = await Promise.all([
    listChangeRequests(user, { status: showAll ? 'ALL' : 'SUBMITTED' }),
    can(user, 'task.assign')
      ? prisma.staffProfile.findMany({
          where: { serviceStatus: 'ACTIVE', deletedAt: null },
          select: { id: true, employeeCode: true, user: { select: { name: true } } },
          orderBy: { employeeCode: 'asc' },
        })
      : [],
  ]);

  const staffOptions = staff.map((s) => ({
    id: s.id,
    name: s.user.name,
    employeeCode: s.employeeCode,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">家庭申请</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-500">
          批准时系统会<strong>真的动任务</strong>：改期直接改时间、取消直接取消任务、
          额外服务直接建一条新任务（走完整派单资格校验），并通知家庭与专员。
        </p>
      </div>

      <div className="flex gap-1.5">
        <Link
          href="/admin/service/requests"
          className={
            !showAll
              ? 'rounded-pill bg-brand-700 px-3 py-1.5 text-[13px] font-medium text-white'
              : 'rounded-pill border border-cream-400 bg-white px-3 py-1.5 text-[13px] text-ink-600'
          }
        >
          待处理
        </Link>
        <Link
          href="/admin/service/requests?status=ALL"
          className={
            showAll
              ? 'rounded-pill bg-brand-700 px-3 py-1.5 text-[13px] font-medium text-white'
              : 'rounded-pill border border-cream-400 bg-white px-3 py-1.5 text-[13px] text-ink-600'
          }
        >
          全部
        </Link>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="申请列表" subtitle={`共 ${requests.length} 条`} />
        {requests.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title={showAll ? '还没有家庭申请' : '没有待处理的申请'}
          />
        ) : (
          <Table
            head={['申请单号', '提交时间', '提交人 / 家庭', '类型', '关联服务', '希望时间', '原因', '状态', '']}
          >
            {requests.map((r) => {
              const household = r.task?.household ?? r.requestedBy.familyMembers[0]?.household;
              return (
                <tr key={r.id}>
                  <Td className="font-mono text-[13px]">{r.requestNo}</Td>
                  <Td className="whitespace-nowrap text-[13px]">{formatDateTime(r.createdAt)}</Td>
                  <Td className="text-[13px]">
                    {r.requestedBy.name}
                    {household ? (
                      <Link
                        href={`/admin/households/${household.id}`}
                        className="mt-0.5 block text-xs text-brand-700 hover:underline"
                      >
                        {household.name}
                      </Link>
                    ) : null}
                  </Td>
                  <Td className="text-[13px]">
                    {CHANGE_REQUEST_TYPE_LABELS[r.type]}
                    {r.serviceType ? (
                      <span className="mt-0.5 block text-xs text-ink-500">
                        {SERVICE_TYPE_LABELS[r.serviceType]}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-[13px]">
                    {r.task ? (
                      <>
                        <span className="block font-mono text-xs">{r.task.taskNo}</span>
                        <span className="block text-xs text-ink-500">
                          {formatDateTime(r.task.scheduledStart)}
                          {r.task.staffProfile ? ` · ${r.task.staffProfile.user.name}` : ''}
                        </span>
                      </>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-[13px]">
                    {r.preferredAt ? formatDateTime(r.preferredAt) : '—'}
                  </Td>
                  <Td className="max-w-[14rem] text-[13px]">
                    {r.reason ?? '—'}
                    {r.handledNote ? (
                      <span className="mt-1 block rounded bg-cream-100 px-2 py-1 text-xs text-ink-700">
                        {r.handledNote}
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        r.status === 'SUBMITTED'
                          ? 'warm'
                          : r.status === 'APPROVED'
                            ? 'brand'
                            : 'neutral'
                      }
                    >
                      {CHANGE_REQUEST_STATUS_LABELS[r.status]}
                    </Badge>
                  </Td>
                  <Td>
                    {r.status === 'SUBMITTED' && can(user, 'task.assign') ? (
                      <DecideRequestForm
                        requestId={r.id}
                        type={r.type}
                        preferredAt={toLocalInput(r.preferredAt)}
                        staff={staffOptions}
                      />
                    ) : null}
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
