'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, Send } from 'lucide-react';

import { submitRecordAction, type ActionState } from '@/app/actions/staff';
import { ErrorNotice } from '@/components/ui';
import {
  ACTIVITY_OPTIONS,
  COMPLETED_ITEM_OPTIONS,
  DIET_OPTIONS,
  READING_SOURCE_LABELS,
  SLEEP_OPTIONS,
  SPIRIT_OPTIONS,
} from '@/lib/labels';
import { cn } from '@/lib/utils';

/**
 * 服务记录表单。
 *
 * 刻意用卡片式单选，不要求专员填几十个字段 —— 一线在长辈家里，
 * 能几分钟内完成才有可能被真正执行。
 *
 * 所有选项文案都是「观察到的事实」或「本人反映」，不含任何诊断性表述。
 */

function OptionGroup({
  name,
  label,
  options,
  noteName,
  notePlaceholder,
  defaultValue,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  noteName: string;
  notePlaceholder: string;
  defaultValue?: string;
}) {
  const [selected, setSelected] = useState(defaultValue ?? options[0].value);

  return (
    <fieldset className="border-t border-cream-200 pt-4 first:border-t-0 first:pt-0">
      <legend className="mb-2.5 text-[15px] font-semibold text-ink-800">{label}</legend>

      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => {
          const active = selected === o.value;
          return (
            <label
              key={o.value}
              className={cn(
                'flex min-h-[46px] cursor-pointer items-center justify-center rounded-xl px-3 py-2 text-center text-[14px] leading-tight transition',
                active
                  ? 'bg-brand-700 font-medium text-white'
                  : 'border border-cream-400 bg-white text-ink-700 active:bg-cream-100',
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={active}
                onChange={() => setSelected(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>

      <input
        name={noteName}
        maxLength={300}
        placeholder={notePlaceholder}
        className="field mt-2 text-[14px]"
      />
    </fieldset>
  );
}

function SubmitBar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-mobile bg-brand-700 text-white active:bg-brand-800 disabled:bg-brand-300"
    >
      {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
      {pending ? '提交中…' : '提交服务记录并完成服务'}
    </button>
  );
}

export function VisitRecordForm({ taskId }: { taskId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(submitRecordAction, null);
  const [showReadings, setShowReadings] = useState(false);

  return (
    <form action={formAction} className="space-y-5">
      {state?.error ? <ErrorNotice title="没有提交成功" message={state.error} /> : null}
      <input type="hidden" name="taskId" value={taskId} />

      <OptionGroup
        name="spiritLevel"
        label="今天精神状态"
        options={[...SPIRIT_OPTIONS]}
        noteName="spiritNote"
        notePlaceholder="补充说明（可留空）"
      />

      <OptionGroup
        name="dietLevel"
        label="饮食"
        options={[...DIET_OPTIONS]}
        noteName="dietNote"
        notePlaceholder="补充说明（可留空）"
      />

      <OptionGroup
        name="sleepLevel"
        label="睡眠"
        options={[...SLEEP_OPTIONS]}
        noteName="sleepNote"
        notePlaceholder="例：本人表示昨晚约凌晨 1 点入睡"
      />

      <OptionGroup
        name="activityLevel"
        label="活动"
        options={[...ACTIVITY_OPTIONS]}
        noteName="activityNote"
        notePlaceholder="补充说明（可留空）"
      />

      {/* 今日完成事项（多选） */}
      <fieldset className="border-t border-cream-200 pt-4">
        <legend className="mb-2.5 text-[15px] font-semibold text-ink-800">今日完成事项</legend>
        <div className="grid grid-cols-2 gap-2">
          {COMPLETED_ITEM_OPTIONS.map((item) => (
            <label
              key={item}
              className="flex min-h-[46px] cursor-pointer items-center gap-2 rounded-xl border border-cream-400 bg-white px-3 py-2 text-[14px] text-ink-700 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:font-medium has-[:checked]:text-brand-700"
            >
              <input
                type="checkbox"
                name="completedItems"
                value={item}
                className="h-4 w-4 shrink-0 rounded accent-brand-700"
              />
              {item}
            </label>
          ))}
        </div>
      </fieldset>

      {/* 补充观察 */}
      <fieldset className="border-t border-cream-200 pt-4">
        <legend className="mb-1.5 text-[15px] font-semibold text-ink-800">补充观察</legend>
        <p className="mb-2 text-[13px] leading-relaxed text-ink-500">
          请描述看到、听到的客观事实。
          <br />
          可以写：「王阿姨表示昨晚约凌晨 1 点入睡。」
          <br />
          不要写：「王阿姨患有严重失眠。」
        </p>
        <textarea
          name="observationText"
          rows={4}
          maxLength={1500}
          placeholder="今天还有什么需要让家人和督导知道的？"
          className="field text-[15px]"
        />
      </fieldset>

      {/* 健康数值（可选） */}
      <fieldset className="border-t border-cream-200 pt-4">
        <legend className="mb-1.5 text-[15px] font-semibold text-ink-800">
          健康数值
          <span className="ml-1.5 text-[13px] font-normal text-ink-400">可选</span>
        </legend>

        {showReadings ? (
          <div className="space-y-3">
            <p className="text-[13px] leading-relaxed text-ink-500">
              每一条数值都必须说明来源。系统只会记录数字与来源，不会给出任何疾病判断。
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="bpSystolic">
                  收缩压 (mmHg)
                </label>
                <input
                  id="bpSystolic"
                  name="bpSystolic"
                  type="number"
                  inputMode="numeric"
                  min={40}
                  max={300}
                  className="field text-[15px]"
                />
              </div>
              <div>
                <label className="label" htmlFor="bpDiastolic">
                  舒张压 (mmHg)
                </label>
                <input
                  id="bpDiastolic"
                  name="bpDiastolic"
                  type="number"
                  inputMode="numeric"
                  min={20}
                  max={200}
                  className="field text-[15px]"
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="bpSource">
                数据来源
              </label>
              <select id="bpSource" name="bpSource" className="field text-[15px]" defaultValue="">
                <option value="">请选择来源</option>
                {Object.entries(READING_SOURCE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowReadings(true)}
            className="w-full rounded-xl border border-dashed border-cream-400 py-3 text-[14px] text-ink-500 active:bg-cream-100"
          >
            今天协助测了血压？点这里记录
          </button>
        )}
      </fieldset>

      <SubmitBar />

      <p className="text-center text-xs leading-relaxed text-ink-400">
        提交后这条记录即为原始记录并永久保留。
        <br />
        家庭看到的安心报告由公司另外整理并经人工确认，不会直接把这份记录发给家庭。
      </p>
    </form>
  );
}
