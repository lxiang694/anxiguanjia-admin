'use client';

import { revokeMyConsentAction } from '@/app/actions/family';
import { InlineAction } from '@/components/shared/action-form';

export function RevokeMyConsentButton({ consentId }: { consentId: string }) {
  return (
    <InlineAction
      action={revokeMyConsentAction}
      label="撤回"
      variant="ghost"
      size="sm"
      fields={{ consentId }}
      confirm="确认撤回这项授权？撤回后对方将立即无法查看对应内容。"
    />
  );
}
