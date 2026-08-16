'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

import { saveCompetencyAction } from '@/app/actions/support';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';
import { Button } from '@/components/ui';
import { SERVICE_TYPE_LABELS } from '@/lib/labels';

const TYPES = Object.keys(SERVICE_TYPE_LABELS) as (keyof typeof SERVICE_TYPE_LABELS)[];

type CompetencyValues = {
  id?: string;
  name: string;
  code: string;
  description: string | null;
  requiresCredential: boolean;
  requiredForServices: string[];
  isActive: boolean;
};

function Fields({ current }: { current?: CompetencyValues }) {
  const [requiresCredential, setRequiresCredential] = useState(
    current?.requiresCredential ?? false,
  );
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">能力名称 <span className="text-danger-500">*</span></label>
          <input name="name" required maxLength={40} defaultValue={current?.name ?? ''} className="field" />
        </div>
        <div>
          <label className="label">代码 <span className="text-danger-500">*</span></label>
          <input
            name="code"
            required
            maxLength={40}
            defaultValue={current?.code ?? ''}
            placeholder="例：elder_communication"
            className="field font-mono"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-1.5 text-[13px] text-ink-700">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={current?.isActive ?? true}
              className="h-4 w-4 rounded"
            />
            启用
          </label>
        </div>
      </div>

      <div>
        <label className="label">说明</label>
        <textarea
          name="description"
          rows={2}
          maxLength={500}
          defaultValue={current?.description ?? ''}
          className="field"
        />
      </div>

      <div>
        <p className="label">作为派单前置条件的服务类型</p>
        <div className="flex flex-wrap gap-3 text-[13px] text-ink-700">
          {TYPES.map((t) => (
            <label key={t} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                name="requiredForServices"
                value={t}
                defaultChecked={current?.requiredForServices.includes(t) ?? false}
                className="h-4 w-4 rounded"
              />
              {SERVICE_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-ink-400">
          勾选后，派单这些服务类型时会校验专员是否具备本能力。
        </p>
      </div>

      <label className="flex items-start gap-2 rounded-lg bg-warm-50 px-3 py-2.5 text-[13px] text-warm-700">
        <input
          type="checkbox"
          name="requiresCredential"
          checked={requiresCredential}
          onChange={(e) => setRequiresCredential(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded"
        />
        <span>
          涉及法定资格
          <span className="mt-0.5 block text-xs leading-relaxed">
            勾选后，公司内部培训<strong>不足以</strong>满足派单条件：必须另外登记外部资格凭证并核验，
            凭证过期同样不可派单。这是为了避免公司自行把普通培训等同于法定资格。
          </span>
        </span>
      </label>
    </>
  );
}

export function NewCompetencyForm() {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        新建能力标签
      </Button>
    );
  }
  return (
    <div className="card px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-ink-800">新建能力标签</span>
        <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-ink-500">
          收起
        </button>
      </div>
      <ActionForm action={saveCompetencyAction} successMessage="已创建">
        <Fields />
        <SubmitButton>创建</SubmitButton>
      </ActionForm>
    </div>
  );
}

export function EditCompetencyForm({ competency }: { competency: CompetencyValues }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] text-brand-700 underline underline-offset-2"
      >
        编辑
      </button>
    );
  }
  return (
    <div className="rounded-card border border-cream-300 bg-cream-50 px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-ink-800">编辑「{competency.name}」</span>
        <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-ink-500">
          收起
        </button>
      </div>
      <ActionForm
        action={saveCompetencyAction}
        successMessage="已更新"
        hiddenFields={{ id: competency.id }}
      >
        <Fields current={competency} />
        <SubmitButton>保存</SubmitButton>
      </ActionForm>
    </div>
  );
}
