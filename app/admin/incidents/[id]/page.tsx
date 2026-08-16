import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Phone } from 'lucide-react';

import { Badge, Card, CardHeader, DescRow } from '@/components/ui';
import {
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_TYPE_LABELS,
  ROLE_LABELS,
  SERVICE_TYPE_LABELS,
} from '@/lib/labels';
import { can, guardPage } from '@/lib/permissions';
import { formatDateTime, maskPhone } from '@/lib/utils';
import { getIncident } from '@/services/incident';
import { IncidentActionForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '事件详情' };

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await guardPage('incident.read');
  const { id } = await params;

  const incident = await getIncident(user, id);
  if (!incident) notFound();

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link
          href="/admin/incidents"
          className="inline-flex items-center gap-1 text-[13px] text-ink-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          事件中心
        </Link>
        <h1 className="mt-2.5 flex flex-wrap items-center gap-2 text-xl font-semibold text-ink-800">
          {INCIDENT_TYPE_LABELS[incident.type]}
          <span className="font-mono text-sm font-normal text-ink-400">{incident.incidentNo}</span>
          <Badge
            tone={
              incident.severity === 'CRITICAL' || incident.severity === 'HIGH' ? 'danger' : 'warm'
            }
          >
            {INCIDENT_SEVERITY_LABELS[incident.severity]}
          </Badge>
          <Badge tone={incident.status === 'CLOSED' ? 'neutral' : 'info'}>
            {INCIDENT_STATUS_LABELS[incident.status]}
          </Badge>
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          <Link href={`/admin/households/${incident.household.id}`} className="link">
            {incident.household.name}
          </Link>
          {incident.elder ? ` · ${incident.elder.name}` : ''} ·{' '}
          {formatDateTime(incident.occurredAt)}
        </p>
      </div>

      {incident.needsImmediateFamilyContact && incident.status !== 'CLOSED' ? (
        <div className="rounded-card border border-danger-100 bg-danger-50 px-5 py-3.5">
          <p className="text-sm font-semibold text-danger-700">上报时标记为需要立即联络家庭</p>
          <p className="mt-1 text-[13px] text-danger-600">
            请尽快联系主要联络人
            {incident.household.primaryContact
              ? `：${incident.household.primaryContact.user.name} ${maskPhone(incident.household.primaryContact.user.phone)}`
              : '（该家庭尚未指定主要联络人）'}
            。系统已向拥有「异常通知」授权的家庭成员发送站内通知。
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="事件描述" />
            <div className="px-5 py-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-800">
                {incident.description}
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="事件时间线" subtitle="每一步都保留时间、操作人、动作与备注。" />
            <div className="px-5 py-4">
              <ol className="space-y-3 border-l border-cream-300 pl-4">
                {incident.events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[1.32rem] top-1.5 h-2 w-2 rounded-full bg-brand-400" />
                    <p className="text-sm text-ink-800">
                      <span className="mr-2 font-mono text-xs tabular-nums text-ink-400">
                        {new Intl.DateTimeFormat('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                          timeZone: 'Asia/Shanghai',
                        }).format(e.occurredAt)}
                      </span>
                      {e.action}
                    </p>
                    {e.note ? (
                      <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-500">
                        {e.note}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-ink-300">
                      {formatDateTime(e.occurredAt)} · {e.actorName}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </Card>

          {incident.resolution ? (
            <Card className="border-brand-200">
              <CardHeader
                title="处理结果"
                subtitle={incident.closedAt ? `${formatDateTime(incident.closedAt)} 关闭` : undefined}
              />
              <div className="px-5 py-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-800">
                  {incident.resolution}
                </p>
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="相关信息" />
            <div className="px-5 py-3">
              <dl className="divide-y divide-cream-100">
                <DescRow label="上报人">
                  {incident.reportedBy
                    ? `${incident.reportedBy.name}（${ROLE_LABELS[incident.reportedBy.role]}）`
                    : '—'}
                </DescRow>
                <DescRow label="负责人">
                  {incident.owner?.name ?? (
                    <span className="font-medium text-warm-600">尚未指定</span>
                  )}
                </DescRow>
                <DescRow label="关联任务">
                  {incident.task ? (
                    <span className="font-mono text-[13px]">
                      {incident.task.taskNo}
                      <span className="ml-2 font-sans text-ink-500">
                        {SERVICE_TYPE_LABELS[incident.task.serviceType]}
                      </span>
                    </span>
                  ) : (
                    '—'
                  )}
                </DescRow>
                <DescRow label="长辈联系">
                  {incident.elder?.phone ? (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-ink-300" />
                      {maskPhone(incident.elder.phone)}
                    </span>
                  ) : (
                    '—'
                  )}
                </DescRow>
                <DescRow label="附件">
                  {incident.attachmentKeys.length > 0
                    ? `${incident.attachmentKeys.length} 个（私有存储）`
                    : '无'}
                </DescRow>
              </dl>
            </div>
          </Card>

          {can(user, 'incident.handle') ? (
            <Card>
              <CardHeader title="推进处理" subtitle="每次操作都会追加一条时间线。" />
              <div className="px-5 py-4">
                <IncidentActionForm incidentId={incident.id} status={incident.status} />
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
