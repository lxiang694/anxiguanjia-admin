'use client';

import { useState } from 'react';

import { updateStaffStatusAction, verifyEducationAction } from '@/app/actions/admin';
import { grantCompetencyAction, revokeCompetencyAction } from '@/app/actions/support';
import { ActionForm, InlineAction, SubmitButton } from '@/components/shared/action-form';
import { SERVICE_STATUS_FLOW, SERVICE_STATUS_LABELS } from '@/lib/labels';

/** 允许的下一步：沿流程前进一格，或转入暂停 / 离职；暂停可恢复为可排班。 */
function nextOptions(current: string): string[] {
  const idx = SERVICE_STATUS_FLOW.indexOf(current as (typeof SERVICE_STATUS_FLOW)[number]);
  const out: string[] = [];
  if (current === 'SUSPENDED') out.push('ACTIVE');
  if (idx >= 0 && idx < SERVICE_STATUS_FLOW.length - 1) out.push(SERVICE_STATUS_FLOW[idx + 1]);
  if (current !== 'SUSPENDED' && current !== 'OFFBOARDED') out.push('SUSPENDED');
  if (current !== 'OFFBOARDED') out.push('OFFBOARDED');
  return out;
}

export function ServiceStatusForm({
  staffProfileId,
  currentStatus,
}: {
  staffProfileId: string;
  currentStatus: string;
}) {
  const options = nextOptions(currentStatus);

  if (options.length === 0) {
    return <p className="text-sm text-ink-400">没有可执行的状态变更。</p>;
  }

  return (
    <ActionForm
      action={updateStaffStatusAction}
      successMessage="服务状态已更新"
      hiddenFields={{ staffProfileId }}
    >
      <select name="serviceStatus" className="field" defaultValue={options[0]}>
        {options.map((s) => (
          <option key={s} value={s}>
            {SERVICE_STATUS_LABELS[s as keyof typeof SERVICE_STATUS_LABELS]}
          </option>
        ))}
      </select>
      <p className="text-xs text-ink-400">
        推进到「可排班」时，系统会校验必修培训与能力要求；不满足会明确列出原因并拒绝。
      </p>
      <SubmitButton variant="secondary" size="sm">
        更新状态
      </SubmitButton>
    </ActionForm>
  );
}

export function VerifyEducationForm({ educationId }: { educationId: string }) {
  return (
    <span className="flex gap-1.5">
      <InlineAction
        action={verifyEducationAction}
        label="标记为已核验"
        variant="secondary"
        size="sm"
        fields={{ educationId, status: 'VERIFIED' }}
        confirm="确认已经见到并核对过原始学历证明？核验结果会记入操作日志。"
      />
      <InlineAction
        action={verifyEducationAction}
        label="核验未通过"
        variant="ghost"
        size="sm"
        fields={{ educationId, status: 'REJECTED' }}
      />
    </span>
  );
}

/* ============================== 能力授予 ============================== */

export function GrantCompetencyForm({
  staffProfileId,
  options,
}: {
  staffProfileId: string;
  options: { id: string; name: string; requiresCredential: boolean }[];
}) {
  const [competencyId, setCompetencyId] = useState(options[0]?.id ?? '');
  const selected = options.find((o) => o.id === competencyId);

  if (options.length === 0) {
    return <p className="text-sm text-ink-400">这位成员已具备全部在用的能力标签。</p>;
  }

  return (
    <ActionForm
      action={grantCompetencyAction}
      successMessage="能力已授予"
      hiddenFields={{ staffProfileId }}
    >
      <div>
        <label className="label" htmlFor="gc-competency">
          能力标签
        </label>
        <select
          id="gc-competency"
          name="competencyId"
          className="field"
          value={competencyId}
          onChange={(e) => setCompetencyId(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.requiresCredential ? '（涉及法定资格）' : ''}
            </option>
          ))}
        </select>
      </div>

      {selected?.requiresCredential ? (
        <div className="space-y-2 rounded-lg bg-warm-50 px-3 py-3">
          <p className="text-xs leading-relaxed text-warm-700">
            这项能力涉及法定资格，必须登记外部凭证编号。公司培训不能替代。
          </p>
          <input
            name="credentialNo"
            required
            maxLength={60}
            placeholder="外部资格凭证编号"
            className="field text-[13px]"
          />
          <select name="credentialStatus" className="field text-[13px]" defaultValue="UNVERIFIED">
            <option value="UNVERIFIED">未核验</option>
            <option value="PENDING">核验中</option>
            <option value="VERIFIED">已核验（需填有效期）</option>
          </select>
          <input name="credentialExpiry" type="date" className="field text-[13px]" />
        </div>
      ) : null}

      <SubmitButton size="sm" variant="secondary">
        授予能力
      </SubmitButton>
    </ActionForm>
  );
}

export function RevokeCompetencyButton({
  staffProfileId,
  competencyId,
  name,
}: {
  staffProfileId: string;
  competencyId: string;
  name: string;
}) {
  return (
    <InlineAction
      action={revokeCompetencyAction}
      label="移除"
      variant="ghost"
      size="sm"
      fields={{ staffProfileId, competencyId }}
      confirm={`确认移除「${name}」？移除后该成员将不能被派需要这项能力的服务。`}
    />
  );
}
