'use client';

import { useState } from 'react';

import { updateIncidentAction } from '@/app/actions/admin';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';
import { INCIDENT_STATUS_LABELS } from '@/lib/labels';

const NEXT_STATUSES: Record<string, string[]> = {
  NEW: ['ACKNOWLEDGED', 'IN_PROGRESS', 'CLOSED'],
  ACKNOWLEDGED: ['IN_PROGRESS', 'PENDING_FOLLOW_UP', 'CLOSED'],
  IN_PROGRESS: ['PENDING_FOLLOW_UP', 'CLOSED'],
  PENDING_FOLLOW_UP: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: ['IN_PROGRESS'],
};

export function IncidentActionForm({
  incidentId,
  status,
}: {
  incidentId: string;
  status: string;
}) {
  const options = NEXT_STATUSES[status] ?? [];
  const [next, setNext] = useState(options[0] ?? '');
  const closing = next === 'CLOSED';

  if (options.length === 0) {
    return <p className="text-sm text-ink-400">这个事件已经没有可执行的状态变更。</p>;
  }

  return (
    <ActionForm
      action={updateIncidentAction}
      successMessage="已更新"
      hiddenFields={{ incidentId }}
    >
      <div>
        <label className="label" htmlFor="status">
          变更为
        </label>
        <select
          id="status"
          name="status"
          className="field"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        >
          {options.map((s) => (
            <option key={s} value={s}>
              {INCIDENT_STATUS_LABELS[s as keyof typeof INCIDENT_STATUS_LABELS]}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-[13px] text-ink-600">
        <input type="checkbox" name="takeOwnership" className="h-4 w-4 rounded" />
        由我担任负责人
      </label>

      {closing ? (
        <div>
          <label className="label" htmlFor="resolution">
            处理结果 <span className="text-danger-500">*</span>
          </label>
          <textarea
            id="resolution"
            name="resolution"
            rows={4}
            required
            maxLength={800}
            placeholder="例：13:45 联系王女士说明情况，14:10 家庭确认由邻居前往查看，16:00 回访确认王阿姨状况正常。"
            className="field"
          />
          <p className="mt-1 text-xs text-ink-400">关闭事件必须填写处理结果，无法跳过。</p>
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="note">
            处理备注
          </label>
          <textarea
            id="note"
            name="note"
            rows={3}
            maxLength={500}
            placeholder="这一步做了什么，会记入时间线"
            className="field"
          />
        </div>
      )}

      <SubmitButton variant={closing ? 'primary' : 'secondary'}>
        {closing ? '完成跟进并关闭' : '更新状态'}
      </SubmitButton>
    </ActionForm>
  );
}
