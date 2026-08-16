'use client';

import { useState } from 'react';

import { submitChangeRequestAction } from '@/app/actions/family';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';

/** 单次服务的改期 / 取消申请。默认收起，避免每张卡片都堆一堆表单。 */
export function ChangeRequestForm({ taskId }: { taskId: string }) {
  const [mode, setMode] = useState<'none' | 'RESCHEDULE' | 'CANCEL'>('none');

  if (mode === 'none') {
    return (
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setMode('RESCHEDULE')}
          className="text-[13.5px] text-brand-700 underline underline-offset-2"
        >
          申请改期
        </button>
        <button
          type="button"
          onClick={() => setMode('CANCEL')}
          className="text-[13.5px] text-ink-500 underline underline-offset-2"
        >
          申请取消这次
        </button>
      </div>
    );
  }

  return (
    <ActionForm
      action={submitChangeRequestAction}
      className="rounded-xl bg-cream-100 px-3.5 py-3.5"
      successMessage="已提交，我们会尽快与您电话确认"
      hiddenFields={{ taskId, type: mode }}
    >
      {mode === 'RESCHEDULE' ? (
        <div>
          <label className="label" htmlFor={`preferredAt-${taskId}`}>
            希望改到
          </label>
          <input
            id={`preferredAt-${taskId}`}
            name="preferredAt"
            type="datetime-local"
            required
            className="field text-[15px]"
          />
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor={`reason-${taskId}`}>
          原因（可留空）
        </label>
        <textarea
          id={`reason-${taskId}`}
          name="reason"
          rows={2}
          maxLength={500}
          placeholder={mode === 'CANCEL' ? '例：这周我回家陪爸妈' : '例：那天家里有人在'}
          className="field text-[15px]"
        />
      </div>

      <div className="flex gap-2">
        <SubmitButton size="sm">{mode === 'CANCEL' ? '提交取消申请' : '提交改期申请'}</SubmitButton>
        <button
          type="button"
          onClick={() => setMode('none')}
          className="px-2 text-[13px] text-ink-500"
        >
          不用了
        </button>
      </div>

      <p className="text-[12px] leading-relaxed text-ink-400">
        提交的是申请，不是直接改动 —— 我们会先与您确认，再调整安排并通知安心专员。
      </p>
    </ActionForm>
  );
}

export function ExtraServiceForm({
  options,
}: {
  /** 由服务端从服务目录读出后传入，前端不维护白名单 */
  options: { value: string; label: string }[];
}) {
  return (
    <ActionForm
      action={submitChangeRequestAction}
      successMessage="已提交，我们会尽快与您电话确认"
      hiddenFields={{ type: 'EXTRA_SERVICE' }}
    >
      <div>
        <label className="label" htmlFor="serviceType">
          需要哪一类
        </label>
        <select id="serviceType" name="serviceType" required className="field text-[15px]">
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="extraPreferredAt">
          希望时间
        </label>
        <input
          id="extraPreferredAt"
          name="preferredAt"
          type="datetime-local"
          className="field text-[15px]"
        />
      </div>

      <div>
        <label className="label" htmlFor="extraReason">
          具体需要
        </label>
        <textarea
          id="extraReason"
          name="reason"
          rows={3}
          maxLength={500}
          placeholder="例：妈妈下周三上午要去省人民医院复查，希望有人陪同挂号与取药。"
          className="field text-[15px]"
        />
      </div>

      <SubmitButton>提交申请</SubmitButton>
    </ActionForm>
  );
}
