'use client';

import { useState } from 'react';

import { handleFeedbackAction } from '@/app/actions/support';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';
import { FEEDBACK_STATUS_LABELS } from '@/lib/labels';

/** 按当前状态给出合理的下一步，而不是把五个状态全列出来 */
const NEXT: Record<string, string[]> = {
  NEW: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['AWAITING_FAMILY', 'RESOLVED', 'CLOSED'],
  AWAITING_FAMILY: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: ['IN_PROGRESS'],
};

export function HandleFeedbackForm({
  caseId,
  status,
}: {
  caseId: string;
  status: string;
}) {
  const options = NEXT[status] ?? [];
  const [next, setNext] = useState(options[0] ?? '');
  const [open, setOpen] = useState(false);
  const needsResolution = next === 'RESOLVED' || next === 'CLOSED';

  if (options.length === 0) return <span className="text-[13px] text-ink-400">—</span>;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] text-brand-700 underline underline-offset-2"
      >
        处理
      </button>
    );
  }

  return (
    <ActionForm
      action={handleFeedbackAction}
      className="w-64 space-y-1.5"
      successMessage="已更新"
      hiddenFields={{ caseId }}
    >
      <select
        name="status"
        className="field text-[13px]"
        value={next}
        onChange={(e) => setNext(e.target.value)}
      >
        {options.map((s) => (
          <option key={s} value={s}>
            {FEEDBACK_STATUS_LABELS[s as keyof typeof FEEDBACK_STATUS_LABELS]}
          </option>
        ))}
      </select>

      <textarea
        name="resolution"
        rows={3}
        required={needsResolution}
        maxLength={800}
        placeholder={
          needsResolution ? '处理结果（必填，家庭会看到）' : '处理备注（可留空）'
        }
        className="field text-[13px]"
      />

      <label className="flex items-center gap-1.5 text-[12px] text-ink-600">
        <input type="checkbox" name="takeOwnership" className="h-3.5 w-3.5 rounded" />
        由我负责
      </label>
      <label className="flex items-center gap-1.5 text-[12px] text-ink-600">
        <input type="checkbox" name="notifyFamily" defaultChecked className="h-3.5 w-3.5 rounded" />
        同时通知家庭
      </label>

      <div className="flex gap-2">
        <SubmitButton size="sm">提交</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="px-1 text-[13px] text-ink-500">
          取消
        </button>
      </div>
    </ActionForm>
  );
}
