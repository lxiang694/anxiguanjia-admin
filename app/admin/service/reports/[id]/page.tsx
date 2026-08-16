import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileSearch } from 'lucide-react';

import { Badge, Card, CardHeader, NonMedicalNotice } from '@/components/ui';
import {
  OBSERVATION_LABELS,
  REPORT_GENERATION_LABELS,
  REPORT_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
} from '@/lib/labels';
import { can, guardPage } from '@/lib/permissions';
import { formatDate, formatDateTime } from '@/lib/utils';
import { getReportForReview } from '@/services/report';
import { ApproveReportForm, PublishBar, RejectReportForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '安心报告审核' };

export default async function ReportReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await guardPage('report.read');
  const { id } = await params;

  const report = await getReportForReview(user, id);
  if (!report) notFound();

  const editable = can(user, 'report.review') && report.status !== 'PUBLISHED';

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <Link
          href="/admin/service/reports"
          className="inline-flex items-center gap-1 text-[13px] text-ink-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          安心报告
        </Link>
        <h1 className="mt-2.5 flex flex-wrap items-center gap-2 text-xl font-semibold text-ink-800">
          {report.title}
          <span className="font-mono text-sm font-normal text-ink-400">{report.reportNo}</span>
          <Badge
            tone={
              report.status === 'PUBLISHED'
                ? 'brand'
                : report.status === 'REJECTED'
                  ? 'danger'
                  : report.status === 'APPROVED'
                    ? 'info'
                    : 'warm'
            }
          >
            {REPORT_STATUS_LABELS[report.status]}
          </Badge>
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          <Link href={`/admin/households/${report.household.id}`} className="link">
            {report.household.name}
          </Link>
          {report.elder ? ` · ${report.elder.name}` : ''} · {formatDate(report.periodStart)} →{' '}
          {formatDate(report.periodEnd)}
        </p>
        <p className="mt-1 text-xs text-ink-400">
          生成方式：{REPORT_GENERATION_LABELS[report.generation]}
          {report.aiGenerated ? `（AI 模型：${report.aiModel ?? '未记录'}）` : ''}
          {report.reviewedBy
            ? ` · ${report.reviewedBy.name} 于 ${formatDateTime(report.reviewedAt)} 确认`
            : ''}
        </p>
      </div>

      <NonMedicalNotice />

      {report.status === 'REJECTED' && report.rejectReason ? (
        <div className="rounded-card border border-danger-100 bg-danger-50 px-5 py-3">
          <p className="text-[13px] font-semibold text-danger-700">已退回</p>
          <p className="mt-1 text-[13px] text-danger-600">{report.rejectReason}</p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 报告内容 */}
        <Card>
          <CardHeader
            title="家庭将看到的内容"
            subtitle="统计数字由原始记录决定，不可手改；文字可润色，但不得加入记录中没有的事实。"
          />
          <div className="px-5 py-4">
            {editable ? (
              <ApproveReportForm
                report={{
                  id: report.id,
                  title: report.title,
                  spiritSummary: report.spiritSummary ?? '',
                  dietSummary: report.dietSummary ?? '',
                  sleepSummary: report.sleepSummary ?? '',
                  activitySummary: report.activitySummary ?? '',
                  lifeSummary: report.lifeSummary ?? '',
                  attentionSummary: report.attentionSummary ?? '',
                  familyTip: report.familyTip ?? '',
                  visitCount: report.visitCount,
                  phoneCareCount: report.phoneCareCount,
                }}
              />
            ) : (
              <ReadOnlyReport report={report} />
            )}
          </div>
        </Card>

        {/* 原始记录对照 */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <FileSearch className="h-4 w-4 text-brand-600" />
                  引用的原始记录
                </span>
              }
              subtitle={`${report.sourceRecords.length} 条 · 报告里的每一句都应能在这里找到依据`}
            />
            <ul className="divide-y divide-cream-200">
              {report.sourceRecords.length === 0 ? (
                <li className="px-5 py-6 text-center text-sm text-ink-400">没有引用记录</li>
              ) : (
                report.sourceRecords.map((link) =>
                  link.visitRecord ? (
                    <li key={link.id} className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/service/records/${link.visitRecord.id}`}
                          className="link font-mono text-[13px]"
                        >
                          {link.visitRecord.task?.taskNo ?? '—'}
                        </Link>
                        <span className="text-[13px] text-ink-500">
                          {link.visitRecord.task
                            ? SERVICE_TYPE_LABELS[link.visitRecord.task.serviceType]
                            : ''}
                        </span>
                        <span className="text-xs text-ink-400">
                          {formatDateTime(link.visitRecord.submittedAt)}
                        </span>
                        <span className="ml-auto text-xs text-ink-400">
                          {link.visitRecord.staffProfile.user.name}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">
                        精神 {OBSERVATION_LABELS[link.visitRecord.spiritLevel]} · 饮食{' '}
                        {OBSERVATION_LABELS[link.visitRecord.dietLevel]} · 睡眠{' '}
                        {OBSERVATION_LABELS[link.visitRecord.sleepLevel]} · 活动{' '}
                        {OBSERVATION_LABELS[link.visitRecord.activityLevel]}
                      </p>
                      {link.visitRecord.completedItems.length > 0 ? (
                        <p className="mt-1 text-[13px] text-ink-600">
                          完成事项：{link.visitRecord.completedItems.join('、')}
                        </p>
                      ) : null}
                      {link.visitRecord.observationText ? (
                        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-cream-50 px-2.5 py-2 text-[13px] leading-relaxed text-ink-700">
                          {link.visitRecord.observationText}
                        </p>
                      ) : null}
                    </li>
                  ) : null,
                )
              )}
            </ul>
          </Card>

          {can(user, 'report.review') && report.status !== 'PUBLISHED' ? (
            <Card className="border-danger-100">
              <CardHeader title="退回重写" subtitle="内容与原始记录不符时，请退回并写明原因。" />
              <div className="px-5 py-4">
                <RejectReportForm reportId={report.id} />
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      {can(user, 'report.publish') ? (
        <PublishBar
          reportId={report.id}
          status={report.status}
          publishedAt={report.publishedAt ? formatDateTime(report.publishedAt) : null}
        />
      ) : null}
    </div>
  );
}

function ReadOnlyReport({
  report,
}: {
  report: {
    visitCount: number;
    phoneCareCount: number;
    spiritSummary: string | null;
    dietSummary: string | null;
    sleepSummary: string | null;
    activitySummary: string | null;
    lifeSummary: string | null;
    attentionSummary: string | null;
    familyTip: string | null;
  };
}) {
  const sections = [
    ['本周完成', `上门探访 ${report.visitCount} 次 · 电话关怀 ${report.phoneCareCount} 次`],
    ['精神', report.spiritSummary],
    ['饮食', report.dietSummary],
    ['睡眠', report.sleepSummary],
    ['活动', report.activitySummary],
    ['生活', report.lifeSummary],
    ['需要留意', report.attentionSummary],
    ['给家人的小提醒', report.familyTip],
  ] as const;

  return (
    <dl className="space-y-3 text-sm">
      {sections.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[13px] font-medium text-ink-500">{label}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap leading-relaxed text-ink-800">
            {value || '—'}
          </dd>
        </div>
      ))}
    </dl>
  );
}
