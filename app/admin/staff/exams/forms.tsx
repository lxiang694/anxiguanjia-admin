'use client';

import { gradeTrainingAction } from '@/app/actions/support';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';

export function GradeForm({
  recordId,
  passingScore,
}: {
  recordId: string;
  passingScore: number;
}) {
  return (
    <ActionForm
      action={gradeTrainingAction}
      className="w-48 space-y-1.5"
      successMessage="成绩已录入"
      hiddenFields={{ recordId }}
    >
      <input
        name="examScore"
        type="number"
        min={0}
        max={100}
        required
        placeholder={`成绩（及格 ${passingScore}）`}
        className="field text-[13px]"
      />
      <select name="status" className="field text-[13px]" defaultValue="">
        <option value="">按及格分自动判定</option>
        <option value="NEEDS_RETRAIN">未达标并要求复训</option>
      </select>
      <input name="instructorName" maxLength={40} placeholder="考核人" className="field text-[13px]" />
      <SubmitButton size="sm">录入</SubmitButton>
    </ActionForm>
  );
}
