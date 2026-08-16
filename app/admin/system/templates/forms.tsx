'use client';

import { saveNotificationTemplateAction } from '@/app/actions/settings';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';
import {
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_LEVEL_LABELS,
  PERMISSION_LABELS,
} from '@/lib/labels';

const LEVELS = Object.keys(NOTIFICATION_LEVEL_LABELS) as (keyof typeof NOTIFICATION_LEVEL_LABELS)[];
const PERMS = Object.keys(PERMISSION_LABELS) as (keyof typeof PERMISSION_LABELS)[];
const CHANNELS = Object.keys(NOTIFICATION_CHANNEL_LABELS) as (keyof typeof NOTIFICATION_CHANNEL_LABELS)[];

export function TemplateForm({
  event,
  vars,
  current,
  suggested,
  defaultName,
}: {
  event: string;
  vars: string[];
  current: {
    name: string;
    level: string;
    titleTemplate: string;
    bodyTemplate: string | null;
    enabledChannels: string[];
    requiredPermission: string | null;
    isActive: boolean;
  } | null;
  suggested?: { title: string; body: string };
  defaultName: string;
}) {
  return (
    <ActionForm
      action={saveNotificationTemplateAction}
      successMessage="模板已保存"
      hiddenFields={{ event }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor={`n-${event}`}>
            模板名称
          </label>
          <input
            id={`n-${event}`}
            name="name"
            required
            maxLength={40}
            defaultValue={current?.name ?? defaultName}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor={`l-${event}`}>
            通知级别
          </label>
          <select
            id={`l-${event}`}
            name="level"
            className="field"
            defaultValue={current?.level ?? 'NORMAL'}
          >
            {LEVELS.map((k) => (
              <option key={k} value={k}>
                {NOTIFICATION_LEVEL_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`p-${event}`}>
            家庭端所需授权
          </label>
          <select
            id={`p-${event}`}
            name="requiredPermission"
            className="field"
            defaultValue={current?.requiredPermission ?? ''}
          >
            <option value="">不限制</option>
            {PERMS.map((k) => (
              <option key={k} value={k}>
                {PERMISSION_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor={`t-${event}`}>
          标题模板
        </label>
        <input
          id={`t-${event}`}
          name="titleTemplate"
          required
          maxLength={200}
          defaultValue={current?.titleTemplate ?? suggested?.title ?? ''}
          className="field"
        />
      </div>

      <div>
        <label className="label" htmlFor={`b-${event}`}>
          正文模板
        </label>
        <textarea
          id={`b-${event}`}
          name="bodyTemplate"
          rows={2}
          maxLength={1000}
          defaultValue={current?.bodyTemplate ?? suggested?.body ?? ''}
          className="field"
        />
        <p className="mt-1 font-mono text-xs text-ink-400">可用变量：{vars.join('  ')}</p>
      </div>

      <div>
        <p className="label">启用渠道</p>
        <div className="flex flex-wrap gap-4 text-[13px] text-ink-700">
          {CHANNELS.map((c) => {
            const isInApp = c === 'IN_APP';
            const checked = current
              ? current.enabledChannels.includes(c)
              : isInApp;
            return (
              <label key={c} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  name="enabledChannels"
                  value={c}
                  defaultChecked={checked}
                  disabled={isInApp}
                  className="h-4 w-4 rounded"
                />
                {NOTIFICATION_CHANNEL_LABELS[c]}
                {isInApp ? (
                  <span className="text-xs text-brand-600">（必选，唯一已接入）</span>
                ) : (
                  <span className="text-xs text-warm-600">（渠道尚未接入）</span>
                )}
              </label>
            );
          })}
        </div>
        {/* IN_APP 是 disabled 的复选框，不会随表单提交，这里补一个隐藏字段保证它一定在 */}
        <input type="hidden" name="enabledChannels" value="IN_APP" />
      </div>

      <label className="flex items-center gap-1.5 text-[13px] text-ink-700">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={current?.isActive ?? true}
          className="h-4 w-4 rounded"
        />
        启用这个模板
      </label>

      <SubmitButton size="sm">保存模板</SubmitButton>
    </ActionForm>
  );
}
