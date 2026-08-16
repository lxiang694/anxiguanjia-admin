'use client';

import { submitFeedbackAction } from '@/app/actions/family';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';
import { FEEDBACK_CATEGORY_LABELS } from '@/lib/labels';

const CATEGORIES = Object.keys(FEEDBACK_CATEGORY_LABELS) as (keyof typeof FEEDBACK_CATEGORY_LABELS)[];

export function FeedbackForm() {
  return (
    <ActionForm action={submitFeedbackAction} successMessage="已收到，我们会尽快跟进并与您联系">
      <div>
        <label className="label" htmlFor="category">
          类别
        </label>
        <select id="category" name="category" required className="field text-[15px]">
          {CATEGORIES.map((k) => (
            <option key={k} value={k}>
              {FEEDBACK_CATEGORY_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="subject">
          一句话说明
        </label>
        <input
          id="subject"
          name="subject"
          required
          maxLength={100}
          placeholder="例：希望把上门时间固定在周四下午"
          className="field text-[15px]"
        />
      </div>

      <div>
        <label className="label" htmlFor="content">
          具体情况
        </label>
        <textarea
          id="content"
          name="content"
          rows={4}
          required
          maxLength={2000}
          placeholder="请尽量写具体，方便我们准确处理。"
          className="field text-[15px]"
        />
      </div>

      <label className="flex items-start gap-2.5 rounded-xl border border-cream-400 px-3.5 py-3">
        <input
          type="checkbox"
          name="isComplaint"
          className="mt-0.5 h-5 w-5 shrink-0 rounded accent-danger-600"
        />
        <span className="text-[14px] leading-relaxed text-ink-700">
          这是一次投诉
          <span className="mt-0.5 block text-[12.5px] text-ink-500">
            勾选后会由服务督导直接接手，并纳入服务质量统计。
          </span>
        </span>
      </label>

      <SubmitButton>提交</SubmitButton>
    </ActionForm>
  );
}
