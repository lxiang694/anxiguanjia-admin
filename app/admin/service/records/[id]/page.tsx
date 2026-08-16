import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Camera, ShieldAlert } from 'lucide-react';

import {
  Badge,
  Card,
  CardHeader,
  DescRow,
  NonMedicalNotice,
} from '@/components/ui';
import { prisma } from '@/lib/db';
import {
  OBSERVATION_LABELS,
  READING_SOURCE_LABELS,
  READING_TYPE_LABELS,
  SERVICE_TYPE_LABELS,
} from '@/lib/labels';
import { can, guardPage, taskScopeWhere } from '@/lib/permissions';
import { formatDateTime } from '@/lib/utils';
import { AmendForm, ReviewForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '服务记录详情' };

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await guardPage('visitRecord.read');
  const { id } = await params;

  const scope = taskScopeWhere(user);
  if (!scope) notFound();

  const record = await prisma.visitRecord.findFirst({
    where: { id, task: scope },
    include: {
      task: {
        select: {
          id: true,
          taskNo: true,
          serviceType: true,
          scheduledStart: true,
          arrivedAt: true,
          startedAt: true,
          endedAt: true,
          status: true,
          checkinLat: true,
          checkinLng: true,
          household: { select: { id: true, name: true, householdCode: true } },
        },
      },
      elder: { select: { id: true, name: true } },
      staffProfile: { include: { user: { select: { name: true } } } },
      readings: { orderBy: { measuredAt: 'desc' } },
    },
  });

  if (!record) notFound();

  const reviewer = record.reviewedById
    ? await prisma.user.findUnique({
        where: { id: record.reviewedById },
        select: { name: true },
      })
    : null;

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link
          href="/admin/service/records"
          className="inline-flex items-center gap-1 text-[13px] text-ink-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          服务记录
        </Link>
        <h1 className="mt-2.5 flex flex-wrap items-center gap-2 text-xl font-semibold text-ink-800">
          原始服务记录
          <span className="font-mono text-sm font-normal text-ink-400">{record.task.taskNo}</span>
          {record.reviewedAt ? (
            <Badge tone="brand">已审核</Badge>
          ) : (
            <Badge tone="warm">待审核</Badge>
          )}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          <Link href={`/admin/households/${record.task.household.id}`} className="link">
            {record.task.household.name}
          </Link>
          {record.elder ? ` · ${record.elder.name}` : ''} ·{' '}
          {SERVICE_TYPE_LABELS[record.task.serviceType]} · 由 {record.staffProfile.user.name} 提交
        </p>
      </div>

      <NonMedicalNotice />

      <Card>
        <CardHeader title="服务过程" subtitle="到达签到只在到达时记录一次，不做持续定位。" />
        <div className="px-5 py-3">
          <dl className="divide-y divide-cream-100">
            <DescRow label="预约时间">{formatDateTime(record.task.scheduledStart)}</DescRow>
            <DescRow label="到达时间">{formatDateTime(record.task.arrivedAt)}</DescRow>
            <DescRow label="开始服务">{formatDateTime(record.task.startedAt)}</DescRow>
            <DescRow label="结束时间">{formatDateTime(record.task.endedAt)}</DescRow>
            <DescRow label="到达签到">
              {record.task.checkinLat && record.task.checkinLng ? (
                <span className="font-mono text-[13px]">
                  {record.task.checkinLat.toFixed(5)}, {record.task.checkinLng.toFixed(5)}
                  <span className="ml-2 font-sans text-xs text-ink-400">（一次性记录）</span>
                </span>
              ) : (
                <span className="text-ink-400">未记录坐标</span>
              )}
            </DescRow>
          </dl>
        </div>
      </Card>

      <Card>
        <CardHeader title="观察记录" subtitle="全部为观察到的事实或长辈本人反映，不含任何医疗判断。" />
        <div className="px-5 py-3">
          <dl className="divide-y divide-cream-100">
            <DescRow label="精神状态">
              {OBSERVATION_LABELS[record.spiritLevel]}
              {record.spiritNote ? `：${record.spiritNote}` : ''}
            </DescRow>
            <DescRow label="饮食">
              {OBSERVATION_LABELS[record.dietLevel]}
              {record.dietNote ? `：${record.dietNote}` : ''}
            </DescRow>
            <DescRow label="睡眠">
              {OBSERVATION_LABELS[record.sleepLevel]}
              {record.sleepNote ? `：${record.sleepNote}` : ''}
            </DescRow>
            <DescRow label="活动">
              {OBSERVATION_LABELS[record.activityLevel]}
              {record.activityNote ? `：${record.activityNote}` : ''}
            </DescRow>
            <DescRow label="今日完成事项">
              {record.completedItems.length > 0 ? record.completedItems.join('、') : '—'}
            </DescRow>
            <DescRow label="补充观察">{record.observationText || '—'}</DescRow>
          </dl>
        </div>
      </Card>

      {record.readings.length > 0 ? (
        <Card>
          <CardHeader
            title="健康数值"
            subtitle="每条数值都记录来源。「超出提醒范围」指超出家庭自行设定的范围，不是医疗诊断。"
          />
          <ul className="divide-y divide-cream-100 px-5">
            {record.readings.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
                <span className="font-medium text-ink-800">{READING_TYPE_LABELS[r.type]}</span>
                <span className="tabular-nums text-ink-700">
                  {r.valuePrimary}
                  {r.valueSecondary != null ? ` / ${r.valueSecondary}` : ''} {r.unit}
                </span>
                <Badge tone="neutral">{READING_SOURCE_LABELS[r.source]}</Badge>
                {r.outsideFamilyRange ? (
                  <Badge tone="warm">
                    <ShieldAlert className="h-3 w-3" />
                    超出家庭设定的提醒范围
                  </Badge>
                ) : null}
                <span className="ml-auto text-xs text-ink-400">{formatDateTime(r.measuredAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {record.photoKeys.length > 0 ? (
        <Card>
          <CardHeader
            title="服务照片"
            subtitle="照片存放在私有存储，不建立公开链接；查看时按权限生成临时地址。"
          />
          <div className="px-5 py-4">
            <ul className="space-y-1.5 text-[13px]">
              {record.photoKeys.map((k) => (
                <li key={k} className="flex items-center gap-2 font-mono text-ink-500">
                  <Camera className="h-3.5 w-3.5 shrink-0 text-ink-300" />
                  {k}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ) : null}

      {record.amendmentNote ? (
        <Card className="border-warm-200">
          <CardHeader title="修订说明" subtitle="原始内容未被覆盖，修订以追加方式留存。" />
          <div className="px-5 py-4">
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-700">
              {record.amendmentNote}
            </p>
          </div>
        </Card>
      ) : null}

      {can(user, 'visitRecord.review') ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader
              title={record.reviewedAt ? '审核信息' : '审核这条记录'}
              subtitle={
                record.reviewedAt
                  ? `${reviewer?.name ?? '—'} 于 ${formatDateTime(record.reviewedAt)} 审核`
                  : '审核通过后任务标记为已完成。'
              }
            />
            <div className="px-5 py-4">
              {record.reviewedAt ? (
                <p className="text-[13px] text-ink-600">{record.reviewNote || '无审核备注'}</p>
              ) : (
                <ReviewForm recordId={record.id} />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="追加修订说明" subtitle="不修改原文，只追加说明并留下时间与操作人。" />
            <div className="px-5 py-4">
              <AmendForm recordId={record.id} />
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
