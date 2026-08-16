'use client';

import { useState } from 'react';

import { reportIncidentAction } from '@/app/actions/staff';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';
import { INCIDENT_TYPE_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';

type HouseholdOption = {
  id: string;
  name: string;
  elders: { id: string; name: string }[];
};

type TaskOption = {
  id: string;
  taskNo: string;
  householdId: string;
  elderId: string | null;
  household: { name: string };
};

const TYPES = Object.keys(INCIDENT_TYPE_LABELS) as (keyof typeof INCIDENT_TYPE_LABELS)[];

export function HelpForm({
  households,
  activeTasks,
}: {
  households: HouseholdOption[];
  activeTasks: TaskOption[];
}) {
  // 若正在服务中，默认选中对应家庭 —— 少一步操作
  const defaultTask = activeTasks[0];
  const [householdId, setHouseholdId] = useState(
    defaultTask?.householdId ?? households[0]?.id ?? '',
  );
  const [type, setType] = useState<keyof typeof INCIDENT_TYPE_LABELS>('CANNOT_REACH_ELDER');

  const elders = households.find((h) => h.id === householdId)?.elders ?? [];
  const relatedTask = activeTasks.find((t) => t.householdId === householdId);

  return (
    <ActionForm
      action={reportIncidentAction}
      successMessage="已上报，服务督导已收到通知"
      hiddenFields={{ taskId: relatedTask?.id }}
      className="space-y-4"
    >
      <div>
        <label className="label" htmlFor="householdId">
          家庭
        </label>
        <select
          id="householdId"
          name="householdId"
          required
          className="field text-[15px]"
          value={householdId}
          onChange={(e) => setHouseholdId(e.target.value)}
        >
          {households.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        {relatedTask ? (
          <p className="mt-1 text-[12px] text-brand-600">
            已自动关联进行中的任务 {relatedTask.taskNo}
          </p>
        ) : null}
      </div>

      <div>
        <label className="label" htmlFor="elderId">
          长辈
        </label>
        <select
          id="elderId"
          name="elderId"
          className="field text-[15px]"
          defaultValue={defaultTask?.elderId ?? ''}
        >
          <option value="">不特定 / 整个家庭</option>
          {elders.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="label">发生了什么</legend>
        <div className="grid grid-cols-2 gap-2">
          {TYPES.map((t) => {
            const active = type === t;
            return (
              <label
                key={t}
                className={cn(
                  'flex min-h-[48px] cursor-pointer items-center justify-center rounded-xl px-3 py-2 text-center text-[14px] leading-tight transition',
                  active
                    ? 'bg-danger-600 font-medium text-white'
                    : 'border border-cream-400 bg-white text-ink-700 active:bg-cream-100',
                )}
              >
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={active}
                  onChange={() => setType(t)}
                  className="sr-only"
                />
                {INCIDENT_TYPE_LABELS[t]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="description">
          具体描述
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          required
          maxLength={1500}
          placeholder="请写您看到的事实与已经做过的尝试。例：13:40 到达后按门铃与敲门均无回应，拨打王阿姨手机两次无人接听，已询问邻居但不在家。"
          className="field text-[15px]"
        />
        <p className="mt-1 text-[12px] leading-relaxed text-ink-400">
          写事实与已做的尝试就好，不需要判断原因，也不要写病名。
        </p>
      </div>

      <label className="flex items-start gap-2.5 rounded-xl border border-warm-200 bg-warm-50 px-3.5 py-3">
        <input
          type="checkbox"
          name="needsImmediateFamilyContact"
          className="mt-0.5 h-5 w-5 shrink-0 rounded accent-warm-500"
        />
        <span className="text-[14px] leading-relaxed text-warm-700">
          需要立即联络家庭
          <span className="mt-0.5 block text-[12px]">
            勾选后，系统会同时通知拥有「异常通知」授权的家庭成员。
          </span>
        </span>
      </label>

      <SubmitButton variant="danger" size="lg" className="w-full">
        立即上报
      </SubmitButton>
    </ActionForm>
  );
}
