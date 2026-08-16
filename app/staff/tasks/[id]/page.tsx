import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock,
  Info,
  MapPin,
  Phone,
  ShieldAlert,
} from 'lucide-react';

import { Badge, Card, CardHeader, NonMedicalNotice } from '@/components/ui';
import {
  MOBILITY_STATUS_LABELS,
  OBSERVATION_LABELS,
  SERVICE_TYPE_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_TONE,
} from '@/lib/labels';
import { guardPortal } from '@/lib/permissions';
import { ageFromBirthday, formatDateTime, formatTime } from '@/lib/utils';
import { getTaskForSpecialist } from '@/services/visit';
import { TaskActions } from './task-actions';
import { VisitRecordForm } from './record-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: '任务详情' };

export default async function StaffTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const user = await guardPortal('staff');
  const { id } = await params;
  const { submitted } = await searchParams;

  const task = await getTaskForSpecialist(user, id);
  if (!task) notFound();

  const age = ageFromBirthday(task.elder?.birthday ?? null);
  const canFillRecord =
    !task.record && ['ARRIVED', 'IN_SERVICE', 'PENDING_RECORD', 'NOT_COMPLETED'].includes(task.status);

  return (
    <div className="px-4 py-5">
      <Link
        href="/staff"
        className="inline-flex items-center gap-1 text-[13px] text-ink-500 active:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" />
        今天
      </Link>

      {/* 标题区 */}
      <header className="mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[22px] font-semibold text-ink-800">
            {task.elder?.name ?? task.household.name}
          </h1>
          {age ? <span className="text-sm text-ink-500">{age} 岁</span> : null}
          <Badge tone={TASK_STATUS_TONE[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
          {task.isBackupAssignment ? <Badge tone="warm">代班</Badge> : null}
        </div>
        <p className="mt-1.5 text-[15px] text-ink-600">
          {SERVICE_TYPE_LABELS[task.serviceType]} · {formatTime(task.scheduledStart)} · 约{' '}
          {task.estimatedMinutes} 分钟
        </p>
        <p className="mt-0.5 font-mono text-xs text-ink-400">{task.taskNo}</p>
      </header>

      {submitted === '1' ? (
        <div className="mt-4 flex items-start gap-2 rounded-card border border-brand-200 bg-brand-50 px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <div>
            <p className="text-sm font-semibold text-brand-700">服务记录已提交</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-brand-700">
              服务督导会审核这条记录。您今天在这个家庭的工作已经完成，感谢您。
            </p>
          </div>
        </div>
      ) : null}

      {/* 地址与联络 */}
      <Card className="mt-4">
        <div className="space-y-3 px-4 py-4">
          {task.addressLine ? (
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-[18px] w-[18px] shrink-0 text-brand-600" />
              <div className="min-w-0">
                <p className="text-[15px] leading-snug text-ink-800">{task.addressLine}</p>
                {task.household.district ? (
                  <p className="mt-0.5 text-[13px] text-ink-500">{task.household.district.name}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {task.elder?.phone ? (
            <a
              href={`tel:${task.elder.phone}`}
              className="flex items-center gap-2.5 rounded-lg bg-cream-100 px-3 py-2.5 active:bg-cream-200"
            >
              <Phone className="h-[18px] w-[18px] shrink-0 text-brand-600" />
              <span className="text-[15px] text-ink-800">
                {task.elder.name} · {task.elder.phone}
              </span>
            </a>
          ) : null}

          {task.household.primaryContact ? (
            <a
              href={`tel:${task.household.primaryContact.user.phone}`}
              className="flex items-center gap-2.5 rounded-lg bg-cream-100 px-3 py-2.5 active:bg-cream-200"
            >
              <Phone className="h-[18px] w-[18px] shrink-0 text-warm-500" />
              <span className="min-w-0 text-[15px] text-ink-800">
                紧急联络 · {task.household.primaryContact.user.name}
                <span className="mt-0.5 block text-[13px] text-ink-500">
                  {task.household.primaryContact.user.phone}
                </span>
              </span>
            </a>
          ) : null}
        </div>
      </Card>

      {/* 今天需要完成的事项 */}
      {task.taskItems ? (
        <Card className="mt-3">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-brand-600" />
                今天需要完成
              </span>
            }
          />
          <div className="px-4 py-3.5">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-800">
              {task.taskItems}
            </p>
          </div>
        </Card>
      ) : null}

      {/* 家庭注意事项 */}
      {task.attentionSnapshot || task.household.serviceNotes ? (
        <Card className="mt-3 border-warm-200">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-warm-500" />
                家庭注意事项
              </span>
            }
          />
          <div className="space-y-2 px-4 py-3.5 text-[15px] leading-relaxed text-ink-800">
            {task.attentionSnapshot ? (
              <p className="whitespace-pre-wrap">{task.attentionSnapshot}</p>
            ) : null}
            {task.household.serviceNotes &&
            task.household.serviceNotes !== task.attentionSnapshot ? (
              <p className="whitespace-pre-wrap">{task.household.serviceNotes}</p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* 长辈情况（只含服务必要信息） */}
      {task.elder ? (
        <Card className="mt-3">
          <CardHeader
            title="长辈情况"
            subtitle="仅显示服务必要信息，不含慢性病、用药等敏感健康资料。"
          />
          <dl className="divide-y divide-cream-100 px-4">
            <Row label="行动情况">{MOBILITY_STATUS_LABELS[task.elder.mobilityStatus]}</Row>
            <Row label="沟通偏好">{task.elder.communicationPrefs || '—'}</Row>
            <Row label="生活需要">{task.elder.dailyNeeds || '—'}</Row>
            <Row label="紧急联络安排">{task.elder.emergencyArrangement || '—'}</Row>
          </dl>
        </Card>
      ) : null}

      {/* 服务过程时间 */}
      {task.arrivedAt || task.startedAt || task.endedAt ? (
        <Card className="mt-3">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-brand-600" />
                服务过程
              </span>
            }
          />
          <dl className="divide-y divide-cream-100 px-4">
            <Row label="到达时间">{formatDateTime(task.arrivedAt)}</Row>
            <Row label="开始服务">{formatDateTime(task.startedAt)}</Row>
            <Row label="结束时间">{formatDateTime(task.endedAt)}</Row>
          </dl>
        </Card>
      ) : null}

      {/* 动作区 */}
      <div className="mt-4">
        <TaskActions taskId={task.id} status={task.status} hasRecord={!!task.record} />
      </div>

      {/* 服务记录 */}
      {canFillRecord ? (
        <Card className="mt-4">
          <CardHeader
            title="填写服务记录"
            subtitle="按实际观察勾选即可。描述请写看到的事实，不要写病名或推测。"
          />
          <div className="px-4 py-4">
            <VisitRecordForm taskId={task.id} />
          </div>
        </Card>
      ) : null}

      {/* 已提交的记录（只读） */}
      {task.record ? (
        <Card className="mt-4">
          <CardHeader
            title="已提交的服务记录"
            subtitle={`${formatDateTime(task.record.submittedAt)} 提交${task.record.reviewedAt ? ' · 已审核' : ' · 待审核'}`}
          />
          <div className="px-4 py-3.5">
            <dl className="divide-y divide-cream-100">
              <Row label="精神状态">
                {OBSERVATION_LABELS[task.record.spiritLevel]}
                {task.record.spiritNote ? `：${task.record.spiritNote}` : ''}
              </Row>
              <Row label="饮食">
                {OBSERVATION_LABELS[task.record.dietLevel]}
                {task.record.dietNote ? `：${task.record.dietNote}` : ''}
              </Row>
              <Row label="睡眠">
                {OBSERVATION_LABELS[task.record.sleepLevel]}
                {task.record.sleepNote ? `：${task.record.sleepNote}` : ''}
              </Row>
              <Row label="活动">
                {OBSERVATION_LABELS[task.record.activityLevel]}
                {task.record.activityNote ? `：${task.record.activityNote}` : ''}
              </Row>
              <Row label="完成事项">
                {task.record.completedItems.length > 0
                  ? task.record.completedItems.join('、')
                  : '—'}
              </Row>
              <Row label="补充观察">{task.record.observationText || '—'}</Row>
            </dl>
            <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-ink-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              记录一经提交即为原始记录，会永久保留。如需更正，请联系服务督导追加修订说明 ——
              系统不会覆盖您原本写下的内容。
            </p>
          </div>
        </Card>
      ) : null}

      <div className="mt-4">
        <NonMedicalNotice />
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3 py-2.5 text-[15px]">
      <dt className="text-ink-500">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap break-words text-ink-800">{children}</dd>
    </div>
  );
}
