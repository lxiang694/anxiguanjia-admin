'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

import { savePlanAction } from '@/app/actions/settings';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';
import { Button } from '@/components/ui';
import { PLAN_TIER_LABELS, SERVICE_TYPE_LABELS } from '@/lib/labels';

const TIERS = Object.keys(PLAN_TIER_LABELS) as (keyof typeof PLAN_TIER_LABELS)[];
const TYPES = Object.keys(SERVICE_TYPE_LABELS) as (keyof typeof SERVICE_TYPE_LABELS)[];

type PlanValues = {
  id?: string;
  code: string;
  name: string;
  tier: string;
  description: string | null;
  monthlyPrice: number;
  visitsPerMonth: number;
  phoneCarePerMonth: number;
  reportsPerMonth: number;
  includedServices: string[];
  isActive: boolean;
  sortOrder: number;
  subscriptionCount?: number;
};

function PlanFields({ current }: { current?: PlanValues }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">方案名称 <span className="text-danger-500">*</span></label>
          <input name="name" required maxLength={40} defaultValue={current?.name ?? ''} className="field" />
        </div>
        <div>
          <label className="label">代码 <span className="text-danger-500">*</span></label>
          <input
            name="code"
            required
            maxLength={20}
            defaultValue={current?.code ?? ''}
            placeholder="例：ASSURANCE"
            className="field font-mono"
          />
        </div>
        <div>
          <label className="label">档位</label>
          <select name="tier" className="field" defaultValue={current?.tier ?? 'ASSURANCE'}>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {PLAN_TIER_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">月费（元） <span className="text-danger-500">*</span></label>
          <input
            name="monthlyPrice"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={current ? current.monthlyPrice / 100 : ''}
            className="field"
          />
          {current && (current.subscriptionCount ?? 0) > 0 ? (
            <p className="mt-1 text-xs text-warm-600">
              已有 {current.subscriptionCount} 个订阅在用，改价会被拒绝
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="label">每月探访</label>
          <input
            name="visitsPerMonth"
            type="number"
            min={0}
            max={60}
            defaultValue={current?.visitsPerMonth ?? 4}
            className="field"
          />
        </div>
        <div>
          <label className="label">每月电话关怀</label>
          <input
            name="phoneCarePerMonth"
            type="number"
            min={0}
            max={60}
            defaultValue={current?.phoneCarePerMonth ?? 8}
            className="field"
          />
        </div>
        <div>
          <label className="label">每月安心报告</label>
          <input
            name="reportsPerMonth"
            type="number"
            min={0}
            max={60}
            defaultValue={current?.reportsPerMonth ?? 4}
            className="field"
          />
        </div>
        <div>
          <label className="label">排序</label>
          <input
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            defaultValue={current?.sortOrder ?? 0}
            className="field"
          />
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
        <p className="label">包含的服务类型 <span className="text-danger-500">*</span></p>
        <div className="flex flex-wrap gap-3 text-[13px] text-ink-700">
          {TYPES.map((t) => (
            <label key={t} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                name="includedServices"
                value={t}
                defaultChecked={current?.includedServices.includes(t) ?? ['HOME_VISIT', 'PHONE_CARE'].includes(t)}
                className="h-4 w-4 rounded"
              />
              {SERVICE_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-1.5 text-[13px] text-ink-700">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={current?.isActive ?? true}
          className="h-4 w-4 rounded"
        />
        在售
      </label>
    </>
  );
}

export function NewPlanForm() {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        新建方案
      </Button>
    );
  }
  return (
    <div className="card px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-ink-800">新建服务方案</span>
        <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-ink-500">
          收起
        </button>
      </div>
      <ActionForm action={savePlanAction} successMessage="方案已创建">
        <PlanFields />
        <SubmitButton>创建方案</SubmitButton>
      </ActionForm>
    </div>
  );
}

export function EditPlanForm({ plan }: { plan: PlanValues }) {
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
        <span className="text-sm font-medium text-ink-800">编辑「{plan.name}」</span>
        <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-ink-500">
          收起
        </button>
      </div>
      <ActionForm action={savePlanAction} successMessage="方案已更新" hiddenFields={{ id: plan.id }}>
        <PlanFields current={plan} />
        <SubmitButton>保存</SubmitButton>
      </ActionForm>
    </div>
  );
}
