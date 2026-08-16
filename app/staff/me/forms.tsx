'use client';

import { submitAvailabilityAction } from '@/app/actions/staff';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';

export function AvailabilityForm() {
  return (
    <ActionForm action={submitAvailabilityAction} successMessage="已提交，排班会避开这段时间">
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="label" htmlFor="startAt">
            开始时间
          </label>
          <input
            id="startAt"
            name="startAt"
            type="datetime-local"
            required
            className="field text-[15px]"
          />
        </div>
        <div>
          <label className="label" htmlFor="endAt">
            结束时间
          </label>
          <input
            id="endAt"
            name="endAt"
            type="datetime-local"
            required
            className="field text-[15px]"
          />
        </div>
        <div>
          <label className="label" htmlFor="reason">
            原因（可留空）
          </label>
          <input
            id="reason"
            name="reason"
            maxLength={200}
            placeholder="例：家中有事"
            className="field text-[15px]"
          />
        </div>
      </div>
      <SubmitButton variant="secondary">提交</SubmitButton>
    </ActionForm>
  );
}
