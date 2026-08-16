import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Heart } from 'lucide-react';

import { Card, CardHeader, NonMedicalNotice } from '@/components/ui';
import { REPORT_GENERATION_LABELS } from '@/lib/labels';
import { guardPortal } from '@/lib/permissions';
import { formatDate } from '@/lib/utils';
import { myReport } from '@/services/family';
import { RateReportForm } from './rate-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: '安心报告' };

export default async function FamilyReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await guardPortal('family');
  const { id } = await params;

  // 授权不足与不存在都返回 null —— 家庭端不需要区分这两种情况
  const report = await myReport(user, id);
  if (!report) notFound();

  const sections: { label: string; value: string | null }[] = [
    { label: '精神', value: report.spiritSummary },
    { label: '饮食', value: report.dietSummary },
    { label: '睡眠', value: report.sleepSummary },
    { label: '活动', value: report.activitySummary },
    { label: '生活', value: report.lifeSummary },
  ];

  return (
    <div className="px-4 py-6">
      <Link
        href="/family/reports"
        className="inline-flex items-center gap-1 text-[13px] text-ink-500 active:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" />
        安心报告
      </Link>

      {/* 报告正文 —— 刻意做成「一封信」的观感，而不是数据表 */}
      <article className="mt-4 rounded-card border border-cream-300 bg-white px-5 py-6 shadow-card">
        <h1 className="text-[24px] font-semibold leading-snug text-ink-800">{report.title}</h1>
        <p className="mt-1.5 text-[13.5px] text-ink-400">
          {formatDate(report.periodStart)} — {formatDate(report.periodEnd)}
        </p>

        <div className="mt-5 rounded-xl bg-cream-100 px-4 py-3.5">
          <p className="text-[13.5px] text-ink-500">本周完成</p>
          <p className="mt-1 text-[16px] text-ink-800">
            上门探访 <strong className="tabular-nums">{report.visitCount}</strong> 次 · 电话关怀{' '}
            <strong className="tabular-nums">{report.phoneCareCount}</strong> 次
          </p>
        </div>

        <dl className="mt-5 space-y-4">
          {sections.map((s) =>
            s.value ? (
              <div key={s.label}>
                <dt className="text-[14px] font-semibold text-brand-700">{s.label}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-[16px] leading-relaxed text-ink-800">
                  {s.value}
                </dd>
              </div>
            ) : null,
          )}
        </dl>

        {report.attentionSummary ? (
          <div className="mt-6 rounded-xl border border-warm-200 bg-warm-50 px-4 py-4">
            <p className="text-[14px] font-semibold text-warm-700">需要留意</p>
            <p className="mt-1.5 whitespace-pre-wrap text-[16px] leading-relaxed text-ink-800">
              {report.attentionSummary}
            </p>
          </div>
        ) : null}

        {report.familyTip ? (
          <div className="mt-4 rounded-xl bg-brand-50 px-4 py-4">
            <p className="flex items-center gap-1.5 text-[14px] font-semibold text-brand-700">
              <Heart className="h-4 w-4" />
              给家人的小提醒
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-[16px] leading-relaxed text-brand-800">
              {report.familyTip}
            </p>
          </div>
        ) : null}

        <p className="mt-6 border-t border-cream-200 pt-4 text-[12px] leading-relaxed text-ink-400">
          报告编号 {report.reportNo} · {REPORT_GENERATION_LABELS[report.generation]}
          {report.aiGenerated ? '（内容经人工逐句核对后确认）' : ''}
          <br />
          本报告内容全部来自安心专员当天的服务记录，我们不会写入没有发生过的事。
        </p>
      </article>

      <div className="mt-4">
        <NonMedicalNotice />
      </div>

      {/* 评分 */}
      <Card className="mt-4">
        <CardHeader
          title="这份报告对您有帮助吗？"
          subtitle="您的反馈会用于改进报告的写法，不会影响任何数据权限。"
        />
        <div className="px-5 py-4">
          <RateReportForm
            reportId={report.id}
            currentRating={report.familyRating}
            currentComment={report.familyComment}
          />
        </div>
      </Card>
    </div>
  );
}
