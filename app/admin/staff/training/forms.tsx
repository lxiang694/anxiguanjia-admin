'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

import { enrollTrainingAction, saveCourseAction } from '@/app/actions/support';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';
import { Button } from '@/components/ui';
import { TRAINING_TYPE_LABELS } from '@/lib/labels';

const TYPES = Object.keys(TRAINING_TYPE_LABELS) as (keyof typeof TRAINING_TYPE_LABELS)[];

type CourseValues = {
  id?: string;
  title: string;
  type: string;
  description: string | null;
  creditHours: number;
  isMandatory: boolean;
  validMonths: number | null;
  requiresExam: boolean;
  passingScore: number | null;
  isActive: boolean;
};

function CourseFields({ current }: { current?: CourseValues }) {
  const [requiresExam, setRequiresExam] = useState(current?.requiresExam ?? true);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="label">课程标题 <span className="text-danger-500">*</span></label>
          <input name="title" required maxLength={80} defaultValue={current?.title ?? ''} className="field" />
        </div>
        <div>
          <label className="label">类型</label>
          <select name="type" className="field" defaultValue={current?.type ?? 'SERVICE_PROCESS'}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {TRAINING_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">学时</label>
          <input
            name="creditHours"
            type="number"
            min={0}
            max={200}
            step="0.5"
            defaultValue={current?.creditHours ?? 4}
            className="field"
          />
        </div>
        <div>
          <label className="label">有效期（月）</label>
          <input
            name="validMonths"
            type="number"
            min={1}
            max={120}
            defaultValue={current?.validMonths ?? ''}
            placeholder="留空表示长期有效"
            className="field"
          />
        </div>
        <div>
          <label className="label">及格分</label>
          <input
            name="passingScore"
            type="number"
            min={0}
            max={100}
            defaultValue={current?.passingScore ?? 80}
            disabled={!requiresExam}
            className="field"
          />
        </div>
      </div>

      <div>
        <label className="label">课程说明</label>
        <textarea
          name="description"
          rows={2}
          maxLength={1000}
          defaultValue={current?.description ?? ''}
          className="field"
        />
      </div>

      <div className="flex flex-wrap gap-4 text-[13px] text-ink-700">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="isMandatory"
            defaultChecked={current?.isMandatory ?? true}
            className="h-4 w-4 rounded"
          />
          必修（未通过则不可派单）
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="requiresExam"
            checked={requiresExam}
            onChange={(e) => setRequiresExam(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          需要考核
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={current?.isActive ?? true}
            className="h-4 w-4 rounded"
          />
          启用
        </label>
      </div>
    </>
  );
}

export function NewCourseForm() {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        新建课程
      </Button>
    );
  }
  return (
    <div className="card px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-ink-800">新建课程</span>
        <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-ink-500">
          收起
        </button>
      </div>
      <ActionForm action={saveCourseAction} successMessage="课程已创建">
        <CourseFields />
        <SubmitButton>创建课程</SubmitButton>
      </ActionForm>
    </div>
  );
}

export function EditCourseForm({ course }: { course: CourseValues }) {
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
        <span className="text-sm font-medium text-ink-800">编辑「{course.title}」</span>
        <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-ink-500">
          收起
        </button>
      </div>
      <ActionForm action={saveCourseAction} successMessage="课程已更新" hiddenFields={{ id: course.id }}>
        <CourseFields current={course} />
        <SubmitButton>保存</SubmitButton>
      </ActionForm>
    </div>
  );
}

export function EnrollForm({
  staff,
  courses,
}: {
  staff: { id: string; name: string; employeeCode: string }[];
  courses: { id: string; title: string }[];
}) {
  return (
    <ActionForm action={enrollTrainingAction} successMessage="已登记">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div>
          <label className="label">成员</label>
          <select name="staffProfileId" required className="field">
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}（{s.employeeCode}）
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">课程</label>
          <select name="courseId" required className="field">
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">状态</label>
          <select name="status" className="field" defaultValue="IN_PROGRESS">
            <option value="NOT_STARTED">未开始</option>
            <option value="IN_PROGRESS">培训中</option>
            <option value="PENDING_EXAM">待考核</option>
          </select>
        </div>
        <div>
          <label className="label">培训负责人</label>
          <input name="instructorName" maxLength={40} className="field" />
        </div>
      </div>
      <SubmitButton size="sm">登记培训</SubmitButton>
    </ActionForm>
  );
}
