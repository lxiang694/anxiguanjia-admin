'use client';

import { useState } from 'react';

import { rateReportAction } from '@/app/actions/family';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 5, label: '很有帮助' },
  { value: 4, label: '有帮助' },
  { value: 3, label: '一般' },
  { value: 2, label: '不太够' },
  { value: 1, label: '没有帮助' },
];

export function RateReportForm({
  reportId,
  currentRating,
  currentComment,
}: {
  reportId: string;
  currentRating: number | null;
  currentComment: string | null;
}) {
  const [rating, setRating] = useState(currentRating ?? 0);

  return (
    <ActionForm
      action={rateReportAction}
      successMessage="谢谢您的反馈"
      hiddenFields={{ reportId }}
    >
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => {
          const active = rating === o.value;
          return (
            <label
              key={o.value}
              className={cn(
                'cursor-pointer rounded-pill px-3.5 py-2 text-[14px] transition',
                active
                  ? 'bg-brand-700 font-medium text-white'
                  : 'border border-cream-400 bg-white text-ink-700 active:bg-cream-100',
              )}
            >
              <input
                type="radio"
                name="rating"
                value={o.value}
                checked={active}
                onChange={() => setRating(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>

      <textarea
        name="comment"
        rows={3}
        maxLength={500}
        defaultValue={currentComment ?? ''}
        placeholder="想让我们多写点什么？（可留空）"
        className="field text-[15px]"
      />

      <SubmitButton variant="secondary">提交</SubmitButton>
    </ActionForm>
  );
}
