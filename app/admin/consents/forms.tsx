'use client';

import { useState } from 'react';

import { grantConsentAction, revokeConsentAction } from '@/app/actions/admin';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';
import { CONSENT_BASIS_LABELS, PERMISSION_DESCRIPTIONS, PERMISSION_LABELS } from '@/lib/labels';

type Member = { userId: string; name: string; relationship: string; isPayer: boolean };

const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS) as (keyof typeof PERMISSION_LABELS)[];
const BASIS_KEYS = Object.keys(CONSENT_BASIS_LABELS) as (keyof typeof CONSENT_BASIS_LABELS)[];

export function GrantConsentForm({
  householdId,
  elders,
  members,
}: {
  householdId: string;
  elders: { id: string; name: string }[];
  members: Member[];
}) {
  const [permission, setPermission] = useState<keyof typeof PERMISSION_LABELS>('ASSURANCE_REPORT');

  return (
    <ActionForm
      action={grantConsentAction}
      successMessage="授权已建立"
      hiddenFields={{ householdId }}
    >
      <div>
        <label className="label" htmlFor="elderId">
          长辈 <span className="text-danger-500">*</span>
        </label>
        <select id="elderId" name="elderId" required className="field">
          {elders.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="grantorId">
          授权人 <span className="text-danger-500">*</span>
        </label>
        <select id="grantorId" name="grantorId" required className="field">
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}（{m.relationship}）
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-400">
          正常情况下应由长辈本人签署。若由家庭成员代为同意，请在下方「授权依据」中如实选择。
        </p>
      </div>

      <div>
        <label className="label" htmlFor="granteeId">
          被授权人 <span className="text-danger-500">*</span>
        </label>
        <select id="granteeId" name="granteeId" required className="field">
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}（{m.relationship}
              {m.isPayer ? ' · 付款人' : ''}）
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-warm-600">
          注意：是付款人不构成授权理由。付款人同样需要逐项取得授权。
        </p>
      </div>

      <div>
        <label className="label" htmlFor="permissionType">
          授权内容 <span className="text-danger-500">*</span>
        </label>
        <select
          id="permissionType"
          name="permissionType"
          required
          className="field"
          value={permission}
          onChange={(e) => setPermission(e.target.value as keyof typeof PERMISSION_LABELS)}
        >
          {PERMISSION_KEYS.map((k) => (
            <option key={k} value={k}>
              {PERMISSION_LABELS[k]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-500">{PERMISSION_DESCRIPTIONS[permission]}</p>
      </div>

      <div>
        <label className="label" htmlFor="basis">
          授权依据 <span className="text-danger-500">*</span>
        </label>
        <select id="basis" name="basis" required className="field" defaultValue="ELDER_SELF_SIGNED">
          {BASIS_KEYS.map((k) => (
            <option key={k} value={k}>
              {CONSENT_BASIS_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="expiresAt">
          有效期至
        </label>
        <input id="expiresAt" name="expiresAt" type="date" className="field" />
        <p className="mt-1 text-xs text-ink-400">留空表示长期有效，直到被撤回。</p>
      </div>

      <div>
        <label className="label" htmlFor="scope">
          范围说明
        </label>
        <input
          id="scope"
          name="scope"
          maxLength={300}
          placeholder="例：仅限每周安心报告摘要，不含服务照片"
          className="field"
        />
      </div>

      <SubmitButton>建立授权</SubmitButton>
    </ActionForm>
  );
}

export function RevokeConsentButton({
  consentId,
  householdId,
}: {
  consentId: string;
  householdId: string;
}) {
  return (
    <ActionForm
      action={revokeConsentAction}
      className="space-y-1.5"
      successMessage="已撤回"
      hiddenFields={{ consentId, householdId }}
    >
      <input name="reason" maxLength={200} placeholder="撤回原因" className="field text-[13px]" />
      <SubmitButton
        variant="danger"
        size="sm"
        confirm="确认撤回这项授权？撤回后该家庭成员将立即无法查看对应内容。"
      >
        撤回
      </SubmitButton>
    </ActionForm>
  );
}
