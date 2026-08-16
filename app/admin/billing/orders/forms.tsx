'use client';

import { refundOrderAction } from '@/app/actions/admin';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';

export function RefundForm({ orderId }: { orderId: string }) {
  return (
    <ActionForm
      action={refundOrderAction}
      className="w-40 space-y-1.5"
      successMessage="已退款"
      hiddenFields={{ orderId }}
    >
      <input name="reason" required maxLength={200} placeholder="退款原因" className="field text-[13px]" />
      <SubmitButton
        size="sm"
        variant="danger"
        confirm="确认退款？此操作会写入操作日志，并生成一条负数金额的退款记录。"
      >
        退款
      </SubmitButton>
    </ActionForm>
  );
}
