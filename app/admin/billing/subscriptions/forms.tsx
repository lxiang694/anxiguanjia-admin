'use client';

import { renewSubscriptionAction } from '@/app/actions/admin';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';

export function RenewForm({ subscriptionId }: { subscriptionId: string }) {
  return (
    <ActionForm
      action={renewSubscriptionAction}
      className="flex items-center gap-1.5"
      successMessage="已续费"
      hiddenFields={{ subscriptionId }}
    >
      <select name="months" className="field w-20 text-[13px]" defaultValue="1">
        <option value="1">1 月</option>
        <option value="3">3 月</option>
        <option value="6">6 月</option>
        <option value="12">12 月</option>
      </select>
      <SubmitButton size="sm" variant="secondary">
        续费
      </SubmitButton>
    </ActionForm>
  );
}
