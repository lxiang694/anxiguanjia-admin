'use client';

import { Send } from 'lucide-react';

import {
  approveReportAction,
  publishReportAction,
  rejectReportAction,
} from '@/app/actions/admin';
import { ActionForm, InlineAction, SubmitButton } from '@/components/shared/action-form';
import { Card } from '@/components/ui';

type ReportDraft = {
  id: string;
  title: string;
  spiritSummary: string;
  dietSummary: string;
  sleepSummary: string;
  activitySummary: string;
  lifeSummary: string;
  attentionSummary: string;
  familyTip: string;
  visitCount: number;
  phoneCareCount: number;
};

const FIELDS: { name: keyof ReportDraft; label: string; rows?: number; hint?: string }[] = [
  { name: 'spiritSummary', label: '精神', rows: 2 },
  { name: 'dietSummary', label: '饮食', rows: 2 },
  { name: 'sleepSummary', label: '睡眠', rows: 2 },
  { name: 'activitySummary', label: '活动', rows: 2 },
  { name: 'lifeSummary', label: '生活', rows: 2 },
  {
    name: 'attentionSummary',
    label: '需要留意',
    rows: 3,
    hint: '只能搬运原始记录里的客观描述，不要加入推断或诊断性表述。',
  },
  { name: 'familyTip', label: '给家人的小提醒', rows: 2 },
];

export function ApproveReportForm({ report }: { report: ReportDraft }) {
  return (
    <ActionForm
      action={approveReportAction}
      successMessage="已确认。可在页面底部发布给家庭。"
      hiddenFields={{ reportId: report.id }}
    >
      <div>
        <label className="label" htmlFor="title">
          标题
        </label>
        <input
          id="title"
          name="title"
          defaultValue={report.title}
          maxLength={80}
          className="field"
        />
      </div>

      <div className="rounded-lg bg-cream-50 px-3 py-2 text-[13px] text-ink-600">
        本周完成：上门探访 <strong className="tabular-nums">{report.visitCount}</strong> 次 · 电话关怀{' '}
        <strong className="tabular-nums">{report.phoneCareCount}</strong> 次
        <span className="mt-0.5 block text-xs text-ink-400">
          由原始记录统计得出，不提供手动修改。
        </span>
      </div>

      {FIELDS.map((f) => (
        <div key={f.name}>
          <label className="label" htmlFor={f.name}>
            {f.label}
          </label>
          <textarea
            id={f.name}
            name={f.name}
            rows={f.rows ?? 2}
            maxLength={800}
            defaultValue={String(report[f.name] ?? '')}
            className="field"
          />
          {f.hint ? <p className="mt-1 text-xs text-ink-400">{f.hint}</p> : null}
        </div>
      ))}

      <div>
        <label className="label" htmlFor="note">
          确认备注
        </label>
        <input id="note" name="note" maxLength={200} className="field" placeholder="可留空" />
      </div>

      <SubmitButton>保存并确认</SubmitButton>
    </ActionForm>
  );
}

export function RejectReportForm({ reportId }: { reportId: string }) {
  return (
    <ActionForm
      action={rejectReportAction}
      successMessage="已退回"
      hiddenFields={{ reportId }}
    >
      <textarea
        name="reason"
        rows={3}
        required
        maxLength={400}
        placeholder="例：睡眠一段的描述在原始记录中找不到依据，请重新整理。"
        className="field"
      />
      <SubmitButton variant="danger">退回重写</SubmitButton>
    </ActionForm>
  );
}

export function PublishBar({
  reportId,
  status,
  publishedAt,
}: {
  reportId: string;
  status: string;
  publishedAt: string | null;
}) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-medium text-ink-800">
          <Send className="h-4 w-4 text-brand-600" />
          发布给家庭
        </p>
        <p className="mt-0.5 text-[13px] text-ink-500">
          {status === 'PUBLISHED'
            ? `已于 ${publishedAt} 发布。只有拥有「安心报告」授权的家庭成员会收到通知。`
            : status === 'APPROVED'
              ? '报告已人工确认，可以发布。发布后仅拥有「安心报告」授权的家庭成员可见。'
              : '需要先完成人工确认，才能发布给家庭。'}
        </p>
      </div>
      {status === 'APPROVED' ? (
        <InlineAction
          action={publishReportAction}
          label="发布给家庭"
          variant="primary"
          size="md"
          fields={{ reportId }}
          confirm="确认发布？发布后拥有安心报告授权的家庭成员将立即可见。"
        />
      ) : null}
    </Card>
  );
}
