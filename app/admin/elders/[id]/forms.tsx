'use client';

import { useState } from 'react';
import { Pencil, ShieldAlert } from 'lucide-react';

import { saveSensitiveInfoAction, updateElderAction } from '@/app/actions/admin';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';
import { Button } from '@/components/ui';
import { LIVING_STATUS_LABELS, MOBILITY_STATUS_LABELS } from '@/lib/labels';

const LIVING_KEYS = Object.keys(LIVING_STATUS_LABELS) as (keyof typeof LIVING_STATUS_LABELS)[];
const MOBILITY_KEYS = Object.keys(MOBILITY_STATUS_LABELS) as (keyof typeof MOBILITY_STATUS_LABELS)[];

type ElderValues = {
  id: string;
  name: string;
  gender: string;
  birthday: string | null;
  phone: string | null;
  address: string | null;
  livingStatus: string | null;
  mobilityStatus: string;
  livingArrangement: string | null;
  familyRelations: string | null;
  dailyRoutine: string | null;
  activityNotes: string | null;
  dietNotes: string | null;
  sleepNotes: string | null;
  communicationPrefs: string | null;
  dailyNeeds: string | null;
  attentionNotes: string | null;
  emergencyArrangement: string | null;
  generalNotes: string | null;
};

/** 生活档案编辑。刻意与健康敏感信息分成两个表单、两套权限。 */
export function EditElderForm({ elder }: { elder: ElderValues }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" />
        编辑生活档案
      </Button>
    );
  }

  return (
    <div className="card px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-ink-800">编辑生活档案</span>
        <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-ink-500">
          收起
        </button>
      </div>

      <ActionForm
        action={updateElderAction}
        successMessage="档案已更新"
        hiddenFields={{ elderId: elder.id }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">姓名 <span className="text-danger-500">*</span></label>
            <input name="name" required maxLength={40} defaultValue={elder.name} className="field" />
          </div>
          <div>
            <label className="label">性别</label>
            <select name="gender" className="field" defaultValue={elder.gender}>
              <option value="FEMALE">女</option>
              <option value="MALE">男</option>
              <option value="UNDISCLOSED">未填写</option>
            </select>
          </div>
          <div>
            <label className="label">出生日期</label>
            <input name="birthday" type="date" defaultValue={elder.birthday ?? ''} className="field" />
          </div>
          <div>
            <label className="label">联系电话</label>
            <input name="phone" maxLength={30} defaultValue={elder.phone ?? ''} className="field" />
          </div>
          <div>
            <label className="label">居住情况</label>
            <select name="livingStatus" className="field" defaultValue={elder.livingStatus ?? ''}>
              <option value="">暂未了解</option>
              {LIVING_KEYS.map((k) => (
                <option key={k} value={k}>
                  {LIVING_STATUS_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">行动情况</label>
            <select name="mobilityStatus" className="field" defaultValue={elder.mobilityStatus}>
              {MOBILITY_KEYS.map((k) => (
                <option key={k} value={k}>
                  {MOBILITY_STATUS_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">居住地址</label>
          <input name="address" maxLength={200} defaultValue={elder.address ?? ''} className="field" />
        </div>

        {(
          [
            ['livingArrangement', '居住安排', 2],
            ['familyRelations', '家庭关系', 2],
            ['dailyRoutine', '日常习惯', 2],
            ['activityNotes', '活动情况', 2],
            ['dietNotes', '饮食习惯', 2],
            ['sleepNotes', '睡眠情况', 2],
            ['communicationPrefs', '沟通偏好', 2],
            ['dailyNeeds', '生活需要', 2],
            ['attentionNotes', '需要注意事项', 2],
            ['emergencyArrangement', '紧急联络安排', 2],
            ['generalNotes', '其他备注', 2],
          ] as const
        ).map(([field, label, rows]) => (
          <div key={field}>
            <label className="label">{label}</label>
            <textarea
              name={field}
              rows={rows}
              maxLength={1000}
              defaultValue={(elder[field] as string | null) ?? ''}
              className="field"
            />
          </div>
        ))}

        <p className="rounded-lg bg-cream-50 px-3 py-2 text-xs leading-relaxed text-ink-500">
          这里只写生活情况与服务必要信息。请使用观察性措辞，不要写病名或诊断
          —— 慢性情况与用药属于健康敏感信息，请在下方单独录入。
        </p>

        <SubmitButton>保存档案</SubmitButton>
      </ActionForm>
    </div>
  );
}

type SensitiveValues = {
  chronicConditions: string | null;
  medications: string | null;
  allergies: string | null;
  medicalDocsNotes: string | null;
  bpSystolicMax: number | null;
  bpDiastolicMax: number | null;
  glucoseMax: number | null;
} | null;

/**
 * 健康敏感信息录入。
 * 权限最紧的写操作之一：一线专员没有这个能力，且每次写入单独审计。
 */
export function SensitiveInfoForm({
  elderId,
  current,
}: {
  elderId: string;
  current: SensitiveValues;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="warm" size="sm" onClick={() => setOpen(true)}>
        <ShieldAlert className="h-3.5 w-3.5" />
        {current ? '编辑健康敏感信息' : '录入健康敏感信息'}
      </Button>
    );
  }

  return (
    <div className="rounded-card border border-warm-200 bg-warm-50/60 px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-ink-800">健康敏感信息</span>
        <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-ink-500">
          收起
        </button>
      </div>

      <ActionForm
        action={saveSensitiveInfoAction}
        successMessage="已保存，本次写入已记入操作日志"
        hiddenFields={{ elderId }}
      >
        <p className="rounded-lg bg-white px-3 py-2 text-xs leading-relaxed text-ink-600">
          这些内容只应来自<strong>家庭提供</strong>或<strong>医疗机构资料</strong>，
          不是我们自己的判断。请照实转述，不要加入推断。
          一线安心专员看不到本区块的任何内容。
        </p>

        <div>
          <label className="label">慢性情况（由家庭或医疗资料提供）</label>
          <textarea
            name="chronicConditions"
            rows={2}
            maxLength={1000}
            defaultValue={current?.chronicConditions ?? ''}
            placeholder="例：高血压，社区医院随访中（家属提供）"
            className="field"
          />
        </div>
        <div>
          <label className="label">用药情况</label>
          <textarea
            name="medications"
            rows={2}
            maxLength={1000}
            defaultValue={current?.medications ?? ''}
            placeholder="例：每日早晨服用降压药一次。具体名称与剂量以医院处方为准。"
            className="field"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">过敏</label>
            <input
              name="allergies"
              maxLength={500}
              defaultValue={current?.allergies ?? ''}
              className="field"
            />
          </div>
          <div>
            <label className="label">医疗资料备注</label>
            <input
              name="medicalDocsNotes"
              maxLength={1000}
              defaultValue={current?.medicalDocsNotes ?? ''}
              className="field"
            />
          </div>
        </div>

        <div className="rounded-lg bg-white px-3 py-3">
          <p className="mb-2 text-[13px] font-medium text-ink-800">家庭设定的提醒范围</p>
          <p className="mb-2.5 text-xs leading-relaxed text-ink-500">
            这是<strong>家庭自己设定</strong>的提醒阈值，不是医疗诊断标准。
            超出范围时系统只会显示「超出家庭设定的提醒范围」，绝不给出任何疾病判断。
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">收缩压上限</label>
              <input
                name="bpSystolicMax"
                type="number"
                min={60}
                max={260}
                defaultValue={current?.bpSystolicMax ?? ''}
                className="field"
              />
            </div>
            <div>
              <label className="label">舒张压上限</label>
              <input
                name="bpDiastolicMax"
                type="number"
                min={30}
                max={200}
                defaultValue={current?.bpDiastolicMax ?? ''}
                className="field"
              />
            </div>
            <div>
              <label className="label">血糖上限</label>
              <input
                name="glucoseMax"
                type="number"
                min={1}
                max={50}
                step="0.1"
                defaultValue={current?.glucoseMax ?? ''}
                className="field"
              />
            </div>
          </div>
        </div>

        <SubmitButton variant="warm">保存敏感信息</SubmitButton>
      </ActionForm>
    </div>
  );
}
