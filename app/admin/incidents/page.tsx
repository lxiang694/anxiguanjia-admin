import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import type { IncidentStatus } from '@prisma/client';

import { Badge, Card, EmptyState, Table, Td } from '@/components/ui';
import {
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_TYPE_LABELS,
} from '@/lib/labels';
import { guardPage } from '@/lib/permissions';
import { formatDateTime } from '@/lib/utils';
import { listIncidents } from '@/services/incident';

export const dynamic = 'force-dynamic';
export const metadata = { title: '事件中心' };

const TABS: { value: IncidentStatus | 'OPEN' | 'ALL'; label: string }[] = [
  { value: 'OPEN', label: '未关闭' },
  { value: 'NEW', label: '未处理' },
  { value: 'IN_PROGRESS', label: '处理中' },
  { value: 'PENDING_FOLLOW_UP', label: '待跟进' },
  { value: 'CLOSED', label: '已关闭' },
  { value: 'ALL', label: '全部' },
];

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await guardPage('incident.read', { returnTo: '/admin/incidents' });
  const sp = await searchParams;
  const status = TABS.find((t) => t.value === sp.status)?.value ?? 'OPEN';

  const incidents = await listIncidents(user, { status });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">事件中心</h1>
        <p className="mt-1 text-sm text-ink-500">
          每个事件都有完整时间线：谁在什么时候做了什么。关闭事件必须填写处理结果。
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const active = t.value === status;
          return (
            <Link
              key={t.value}
              href={`/admin/incidents?status=${t.value}`}
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
        {incidents.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-5 w-5 text-brand-500" />}
            title="没有符合条件的事件"
            description="安心专员在工作台随时可以按「需要协助」上报异常，事件会立刻出现在这里并通知服务督导。"
          />
        ) : (
          <Table
            head={['事件编号', '发生时间', '家庭 / 长辈', '类型', '严重度', '上报人', '负责人', '状态']}
          >
            {incidents.map((i) => (
              <tr key={i.id}>
                <Td>
                  <Link href={`/admin/incidents/${i.id}`} className="link font-mono text-[13px]">
                    {i.incidentNo}
                  </Link>
                </Td>
                <Td className="whitespace-nowrap text-[13px]">{formatDateTime(i.occurredAt)}</Td>
                <Td>
                  <Link href={`/admin/households/${i.household.id}`} className="link">
                    {i.household.name}
                  </Link>
                  {i.elder ? (
                    <span className="mt-0.5 block text-xs text-ink-400">{i.elder.name}</span>
                  ) : null}
                </Td>
                <Td className="text-[13px]">{INCIDENT_TYPE_LABELS[i.type]}</Td>
                <Td>
                  <Badge
                    tone={
                      i.severity === 'CRITICAL'
                        ? 'danger'
                        : i.severity === 'HIGH'
                          ? 'danger'
                          : i.severity === 'MEDIUM'
                            ? 'warm'
                            : 'neutral'
                    }
                  >
                    {INCIDENT_SEVERITY_LABELS[i.severity]}
                  </Badge>
                </Td>
                <Td className="text-[13px]">{i.reportedBy?.name ?? '—'}</Td>
                <Td className="text-[13px]">
                  {i.owner?.name ?? <span className="font-medium text-warm-600">尚未指定</span>}
                </Td>
                <Td>
                  <Badge
                    tone={
                      i.status === 'CLOSED'
                        ? 'neutral'
                        : i.status === 'NEW'
                          ? 'danger'
                          : 'info'
                    }
                  >
                    {INCIDENT_STATUS_LABELS[i.status]}
                  </Badge>
                  <span className="mt-0.5 block text-xs text-ink-400">
                    {i._count.events} 条时间线
                  </span>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
