'use client';

import { saveServiceCatalogAction } from '@/app/actions/settings';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';

export function CatalogForm({
  serviceType,
  current,
  defaultLabel,
}: {
  serviceType: string;
  current: {
    displayName: string;
    description: string | null;
    defaultMinutes: number;
    addOnPrice: number | null;
    familyRequestable: boolean;
    requiresCompetency: boolean;
    isActive: boolean;
    sortOrder: number;
  } | null;
  defaultLabel: string;
}) {
  return (
    <ActionForm
      action={saveServiceCatalogAction}
      successMessage="已保存"
      hiddenFields={{ serviceType }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor={`dn-${serviceType}`}>
            对外显示名称
          </label>
          <input
            id={`dn-${serviceType}`}
            name="displayName"
            required
            maxLength={40}
            defaultValue={current?.displayName ?? defaultLabel}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor={`dm-${serviceType}`}>
            默认时长（分钟）
          </label>
          <input
            id={`dm-${serviceType}`}
            name="defaultMinutes"
            type="number"
            min={5}
            max={600}
            step={5}
            defaultValue={current?.defaultMinutes ?? (serviceType === 'PHONE_CARE' ? 15 : 60)}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor={`ap-${serviceType}`}>
            增值服务单价（元）
          </label>
          <input
            id={`ap-${serviceType}`}
            name="addOnPrice"
            type="number"
            min={0}
            step="0.01"
            defaultValue={current?.addOnPrice != null ? current.addOnPrice / 100 : ''}
            placeholder="留空表示不单独售卖"
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor={`so-${serviceType}`}>
            排序
          </label>
          <input
            id={`so-${serviceType}`}
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
        <label className="label" htmlFor={`desc-${serviceType}`}>
          说明（家庭端也会看到）
        </label>
        <textarea
          id={`desc-${serviceType}`}
          name="description"
          rows={2}
          maxLength={500}
          defaultValue={current?.description ?? ''}
          className="field"
        />
      </div>

      <div className="flex flex-wrap gap-4 text-[13px] text-ink-700">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={current?.isActive ?? true}
            className="h-4 w-4 rounded"
          />
          启用
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="familyRequestable"
            defaultChecked={current?.familyRequestable ?? false}
            className="h-4 w-4 rounded"
          />
          开放家庭端申请
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="requiresCompetency"
            defaultChecked={current?.requiresCompetency ?? true}
            className="h-4 w-4 rounded"
          />
          派单需要对应能力
        </label>
      </div>

      <SubmitButton size="sm">保存</SubmitButton>
    </ActionForm>
  );
}
