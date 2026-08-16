'use client';

import { amendRecordAction, reviewRecordAction } from '@/app/actions/admin';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';

export function ReviewForm({ recordId }: { recordId: string }) {
  return (
    <ActionForm
      action={reviewRecordAction}
      successMessage="已审核，任务标记为已完成"
      hiddenFields={{ recordId }}
    >
      <textarea
        name="note"
        rows={3}
        maxLength={500}
        placeholder="审核备注（可留空）"
        className="field"
      />
      <SubmitButton>审核通过</SubmitButton>
    </ActionForm>
  );
}

export function AmendForm({ recordId }: { recordId: string }) {
  return (
    <ActionForm
      action={amendRecordAction}
      successMessage="修订说明已追加"
      hiddenFields={{ recordId }}
    >
      <textarea
        name="amendment"
        rows={3}
        required
        maxLength={500}
        placeholder="例：经与专员确认，睡眠一项应为「本人反映近期睡不好」，原勾选有误。"
        className="field"
      />
      <SubmitButton variant="secondary">追加修订说明</SubmitButton>
    </ActionForm>
  );
}
