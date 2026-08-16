'use client';

import { useState } from 'react';

import { decideRequestAction } from '@/app/actions/support';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';

type StaffOption = { id: string; name: string; employeeCode: string };

/**
 * 家庭申请的审批表单。
 *
 * 批准时系统会真的动任务（改期改时间、取消取消任务、额外服务建任务），
 * 而不是只把申请标成「已同意」—— 这正是之前缺的那一环。
 */
export function DecideRequestForm({
  requestId,
  type,
  preferredAt,
  staff,
}: {
  requestId: string;
  type: 'RESCHEDULE' | 'CANCEL' | 'EXTRA_SERVICE';
  preferredAt: string | null;
  staff: StaffOption[];
}) {
  const [mode, setMode] = useState<'none' | 'approve' | 'decline'>('none');
  const needsTime = type === 'RESCHEDULE' || type === 'EXTRA_SERVICE';

  if (mode === 'none') {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('approve')}
          className="rounded-lg bg-brand-700 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-brand-800"
        >
          批准并执行
        </button>
        <button
          type="button"
          onClick={() => setMode('decline')}
          className="rounded-lg border border-cream-400 px-3 py-1.5 text-[13px] text-ink-600 hover:border-danger-300"
        >
          未通过
        </button>
      </div>
    );
  }

  const approving = mode === 'approve';

  return (
    <ActionForm
      action={decideRequestAction}
      className="w-72 space-y-1.5"
      successMessage={approving ? '已批准并执行' : '已回复家庭'}
      hiddenFields={{ requestId, approve: approving ? 'yes' : 'no' }}
    >
      {approving && needsTime ? (
        <div>
          <label className="label text-[12px]">
            {type === 'RESCHEDULE' ? '改期到' : '安排时间'}
          </label>
          <input
            name="finalAt"
            type="datetime-local"
            defaultValue={preferredAt ?? ''}
            required={type === 'EXTRA_SERVICE'}
            className="field text-[13px]"
          />
          <p className="mt-1 text-[11px] text-ink-400">留空则采用家庭希望的时间。</p>
        </div>
      ) : null}

      {approving && type === 'EXTRA_SERVICE' ? (
        <div>
          <label className="label text-[12px]">指派专员</label>
          <select name="staffProfileId" className="field text-[13px]" defaultValue="">
            <option value="">默认派给固定专员</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}（{s.employeeCode}）
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-ink-400">
            会走完整的派单资格校验；不满足会明确报错。
          </p>
        </div>
      ) : null}

      <textarea
        name="note"
        rows={2}
        required={!approving}
        maxLength={500}
        placeholder={approving ? '给家庭的说明（可留空）' : '未通过的原因（必填，家庭会看到）'}
        className="field text-[13px]"
      />

      <div className="flex gap-2">
        <SubmitButton size="sm" variant={approving ? 'primary' : 'danger'}>
          {approving ? '确认批准' : '确认未通过'}
        </SubmitButton>
        <button type="button" onClick={() => setMode('none')} className="px-1 text-[13px] text-ink-500">
          取消
        </button>
      </div>
    </ActionForm>
  );
}
