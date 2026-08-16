'use client';

import { useState } from 'react';

import { assignTaskAction, createTaskAction } from '@/app/actions/admin';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';
import { SERVICE_TYPE_LABELS, STAFF_LEVEL_LABELS } from '@/lib/labels';
import { weekdayName } from '@/lib/utils';

type StaffOption = {
  id: string;
  employeeCode: string;
  staffLevel: keyof typeof STAFF_LEVEL_LABELS;
  user: { name: string };
  district: { name: string } | null;
};

type HouseholdOption = {
  id: string;
  name: string;
  householdCode: string;
  primarySpecialistId: string | null;
  backupSpecialistId: string | null;
  elders: { id: string; name: string }[];
  servicePlan: { preferredWeekday: number | null; preferredWindow: string | null } | null;
};

const SERVICE_TYPES: (keyof typeof SERVICE_TYPE_LABELS)[] = [
  'HOME_VISIT',
  'PHONE_CARE',
  'MEDICAL_ESCORT',
  'DAILY_ASSISTANCE',
  'EXTRA_VISIT',
  'ASSESSMENT',
];

/** 默认时间：明天 09:00，避免运营每次都手填 */
function defaultDateTime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewTaskForm({
  households,
  staff,
}: {
  households: HouseholdOption[];
  staff: StaffOption[];
}) {
  const [householdId, setHouseholdId] = useState(households[0]?.id ?? '');
  const selected = households.find((h) => h.id === householdId);
  const primary = staff.find((s) => s.id === selected?.primarySpecialistId);
  const backup = staff.find((s) => s.id === selected?.backupSpecialistId);

  return (
    <ActionForm action={createTaskAction} successMessage="服务已安排">
      <div>
        <label className="label" htmlFor="householdId">
          家庭 <span className="text-danger-500">*</span>
        </label>
        <select
          id="householdId"
          name="householdId"
          required
          className="field"
          value={householdId}
          onChange={(e) => setHouseholdId(e.target.value)}
        >
          {households.map((h) => (
            <option key={h.id} value={h.id}>
              {h.householdCode} · {h.name}
            </option>
          ))}
        </select>
        {selected?.servicePlan?.preferredWeekday !== null &&
        selected?.servicePlan?.preferredWeekday !== undefined ? (
          <p className="mt-1 text-xs text-brand-600">
            该家庭偏好时间：{weekdayName(selected.servicePlan.preferredWeekday)}
            {selected.servicePlan.preferredWindow ? ` ${selected.servicePlan.preferredWindow}` : ''}
          </p>
        ) : null}
      </div>

      <div>
        <label className="label" htmlFor="elderId">
          长辈
        </label>
        <select id="elderId" name="elderId" className="field" defaultValue="">
          <option value="">由系统取该家庭第一位长辈</option>
          {selected?.elders.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="serviceType">
            服务类型 <span className="text-danger-500">*</span>
          </label>
          <select id="serviceType" name="serviceType" required className="field" defaultValue="HOME_VISIT">
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {SERVICE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="estimatedMinutes">
            预计时长（分钟）
          </label>
          <input
            id="estimatedMinutes"
            name="estimatedMinutes"
            type="number"
            min={10}
            max={480}
            step={5}
            defaultValue={60}
            className="field"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="scheduledStart">
          服务时间 <span className="text-danger-500">*</span>
        </label>
        <input
          id="scheduledStart"
          name="scheduledStart"
          type="datetime-local"
          required
          defaultValue={defaultDateTime()}
          className="field"
        />
      </div>

      <div>
        <label className="label" htmlFor="staffProfileId">
          安心专员
        </label>
        <select id="staffProfileId" name="staffProfileId" className="field" defaultValue="">
          <option value="">
            {primary ? `默认派给固定专员：${primary.user.name}` : '默认派给固定专员（该家庭暂无）'}
          </option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.user.name}（{s.employeeCode} · {STAFF_LEVEL_LABELS[s.staffLevel]}
              {s.district ? ` · ${s.district.name}` : ''}）
              {s.id === selected?.primarySpecialistId ? ' — 固定专员' : ''}
              {s.id === selected?.backupSpecialistId ? ' — 备用专员' : ''}
            </option>
          ))}
        </select>
        {backup ? (
          <p className="mt-1 text-xs text-ink-400">
            备用专员：{backup.user.name}。固定专员不可用时系统会自动改派并通知家庭。
          </p>
        ) : null}
      </div>

      <div>
        <label className="label" htmlFor="taskItems">
          本次任务内容
        </label>
        <textarea
          id="taskItems"
          name="taskItems"
          rows={3}
          maxLength={800}
          placeholder="例：陪伴聊天、协助购买生活用品、确认近期睡眠情况"
          className="field"
        />
      </div>

      <SubmitButton>安排服务</SubmitButton>
    </ActionForm>
  );
}

export function AssignForm({ taskId, staff }: { taskId: string; staff: StaffOption[] }) {
  return (
    <ActionForm
      action={assignTaskAction}
      className="w-full shrink-0 space-y-2 sm:w-64"
      successMessage="已派单"
      hiddenFields={{ taskId }}
    >
      <select name="staffProfileId" required className="field" defaultValue="">
        <option value="" disabled>
          选择安心专员
        </option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.user.name}（{s.employeeCode}）
          </option>
        ))}
      </select>
      <input
        name="reason"
        maxLength={200}
        placeholder="改派原因（首次派单可留空）"
        className="field"
      />
      <SubmitButton size="sm" className="w-full">
        派单
      </SubmitButton>
    </ActionForm>
  );
}
