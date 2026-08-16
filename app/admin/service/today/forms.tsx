'use client';

import { useState } from 'react';

import { cancelTaskAction } from '@/app/actions/admin';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';

export function CancelTaskButton({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] text-ink-500 underline underline-offset-2 hover:text-danger-600"
      >
        取消
      </button>
    );
  }

  return (
    <ActionForm
      action={cancelTaskAction}
      className="w-52 space-y-1.5"
      successMessage="任务已取消"
      hiddenFields={{ taskId }}
    >
      <input
        name="reason"
        required
        maxLength={200}
        placeholder="取消原因（必填）"
        className="field text-[13px]"
      />
      <div className="flex gap-2">
        <SubmitButton size="sm" variant="danger">
          确认取消
        </SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="px-1 text-[13px] text-ink-500">
          返回
        </button>
      </div>
    </ActionForm>
  );
}
