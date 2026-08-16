'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { PermissionError } from '@/lib/permissions';
import { decideChangeRequest, handleFeedback } from '@/services/support';
import {
  enrollTraining,
  gradeTraining,
  grantCompetency,
  revokeCompetency,
  upsertCompetency,
  upsertCourse,
} from '@/services/training';
import { issueInvoice, requestInvoice, voidInvoice } from '@/services/subscription';

/** 客服工单、家庭申请、培训考核、发票的 Server Actions。 */

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;

async function run<T>(fn: () => Promise<T>): Promise<ActionState> {
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : '操作失败，请重试' };
  }
}

/* ============================== 客服工单 ============================== */

export async function handleFeedbackAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser('/admin/support/feedback');
  const caseId = String(formData.get('caseId') ?? '');
  const status = String(formData.get('status') ?? '');
  const valid = ['NEW', 'IN_PROGRESS', 'AWAITING_FAMILY', 'RESOLVED', 'CLOSED'];
  if (!valid.includes(status)) return { ok: false, error: '状态不合法' };

  const result = await run(() =>
    handleFeedback(user, {
      caseId,
      status: status as Parameters<typeof handleFeedback>[1]['status'],
      resolution: String(formData.get('resolution') ?? '') || null,
      takeOwnership: formData.get('takeOwnership') === 'on',
      notifyFamily: formData.get('notifyFamily') === 'on',
    }),
  );
  revalidatePath('/admin/support/feedback');
  revalidatePath(`/admin/support/feedback/${caseId}`);
  return result;
}

/* ============================== 家庭申请 ============================== */

const decideSchema = z.object({
  requestId: z.string().min(1),
  approve: z.enum(['yes', 'no']),
  note: z.string().trim().max(500).optional(),
  finalAt: z.string().optional(),
  staffProfileId: z.string().optional(),
});

export async function decideRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser('/admin/service/requests');

  const parsed = decideSchema.safeParse({
    requestId: formData.get('requestId'),
    approve: formData.get('approve'),
    note: formData.get('note') || undefined,
    finalAt: formData.get('finalAt') || undefined,
    staffProfileId: formData.get('staffProfileId') || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '请检查输入' };
  }

  let finalAt: Date | null = null;
  if (parsed.data.finalAt) {
    const d = new Date(parsed.data.finalAt);
    if (Number.isNaN(d.getTime())) return { ok: false, error: '时间格式不正确' };
    finalAt = d;
  }

  const result = await run(() =>
    decideChangeRequest(user, {
      requestId: parsed.data.requestId,
      approve: parsed.data.approve === 'yes',
      note: parsed.data.note ?? null,
      finalAt,
      staffProfileId: parsed.data.staffProfileId ?? null,
    }),
  );
  revalidatePath('/admin/service/requests');
  revalidatePath('/admin/service/today');
  revalidatePath('/admin/service/dispatch');
  return result;
}

/* ============================== 培训与考核 ============================== */

const courseSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, '请填写课程标题').max(80),
  type: z.enum([
    'ONBOARDING',
    'SERVICE_PHILOSOPHY',
    'ELDER_COMMUNICATION',
    'SERVICE_PROCESS',
    'SAFETY',
    'PRIVACY',
    'INCIDENT_HANDLING',
    'PRACTICAL_ASSESSMENT',
    'OTHER',
  ]),
  description: z.string().trim().max(1000).optional(),
  creditHours: z.coerce.number().min(0).max(200),
  validMonths: z.coerce.number().int().min(1).max(120).optional(),
  passingScore: z.coerce.number().int().min(0).max(100).optional(),
});

export async function saveCourseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser('/admin/staff/training');

  const parsed = courseSchema.safeParse({
    id: formData.get('id') || undefined,
    title: formData.get('title'),
    type: formData.get('type'),
    description: formData.get('description') || undefined,
    creditHours: formData.get('creditHours'),
    validMonths: formData.get('validMonths') || undefined,
    passingScore: formData.get('passingScore') || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '请检查输入' };
  }

  const result = await run(() =>
    upsertCourse(user, {
      ...parsed.data,
      description: parsed.data.description ?? null,
      validMonths: parsed.data.validMonths ?? null,
      passingScore: parsed.data.passingScore ?? null,
      isMandatory: formData.get('isMandatory') === 'on',
      requiresExam: formData.get('requiresExam') === 'on',
      isActive: formData.get('isActive') === 'on',
    }),
  );
  revalidatePath('/admin/staff/training');
  return result;
}

export async function enrollTrainingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser('/admin/staff/training');
  const result = await run(() =>
    enrollTraining(user, {
      staffProfileId: String(formData.get('staffProfileId') ?? ''),
      courseId: String(formData.get('courseId') ?? ''),
      status: (String(formData.get('status') ?? 'IN_PROGRESS') ||
        'IN_PROGRESS') as Parameters<typeof enrollTraining>[1]['status'],
      instructorName: String(formData.get('instructorName') ?? '') || null,
    }),
  );
  revalidatePath('/admin/staff/training');
  revalidatePath('/admin/staff/exams');
  return result;
}

export async function gradeTrainingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser('/admin/staff/exams');
  const raw = formData.get('examScore');
  const examScore = raw === null || raw === '' ? null : Number(raw);
  if (examScore !== null && !Number.isFinite(examScore)) {
    return { ok: false, error: '成绩必须是数字' };
  }
  const statusRaw = String(formData.get('status') ?? '');
  const valid = ['PASSED', 'FAILED', 'NEEDS_RETRAIN', 'PENDING_EXAM'];

  const result = await run(() =>
    gradeTraining(user, {
      recordId: String(formData.get('recordId') ?? ''),
      examScore,
      status: valid.includes(statusRaw)
        ? (statusRaw as Parameters<typeof gradeTraining>[1]['status'])
        : undefined,
      instructorName: String(formData.get('instructorName') ?? '') || null,
      remark: String(formData.get('remark') ?? '') || null,
    }),
  );
  revalidatePath('/admin/staff/exams');
  revalidatePath('/admin/staff/training');
  return result;
}

/* ============================== 能力标签 ============================== */

const competencySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, '请填写能力名称').max(40),
  code: z.string().trim().min(2, '请填写代码').max(40),
  description: z.string().trim().max(500).optional(),
});

export async function saveCompetencyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser('/admin/staff/competencies');

  const parsed = competencySchema.safeParse({
    id: formData.get('id') || undefined,
    name: formData.get('name'),
    code: formData.get('code'),
    description: formData.get('description') || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '请检查输入' };
  }

  const services = formData.getAll('requiredForServices').map(String);
  const valid = [
    'HOME_VISIT',
    'PHONE_CARE',
    'MEDICAL_ESCORT',
    'DAILY_ASSISTANCE',
    'ASSESSMENT',
    'EXTRA_VISIT',
  ];

  const result = await run(() =>
    upsertCompetency(user, {
      ...parsed.data,
      code: parsed.data.code.toLowerCase(),
      description: parsed.data.description ?? null,
      requiresCredential: formData.get('requiresCredential') === 'on',
      requiredForServices: services.filter((s) => valid.includes(s)) as Parameters<
        typeof upsertCompetency
      >[1]['requiredForServices'],
      isActive: formData.get('isActive') === 'on',
    }),
  );
  revalidatePath('/admin/staff/competencies');
  return result;
}

export async function grantCompetencyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser('/admin/staff');
  const expiry = String(formData.get('credentialExpiry') ?? '');
  const statusRaw = String(formData.get('credentialStatus') ?? 'UNVERIFIED');
  const valid = ['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'];

  const staffProfileId = String(formData.get('staffProfileId') ?? '');
  const result = await run(() =>
    grantCompetency(user, {
      staffProfileId,
      competencyId: String(formData.get('competencyId') ?? ''),
      credentialNo: String(formData.get('credentialNo') ?? '') || null,
      credentialStatus: valid.includes(statusRaw)
        ? (statusRaw as Parameters<typeof grantCompetency>[1]['credentialStatus'])
        : 'UNVERIFIED',
      credentialExpiry: expiry ? new Date(expiry) : null,
    }),
  );
  revalidatePath(`/admin/staff/${staffProfileId}`);
  revalidatePath('/admin/staff/competencies');
  return result;
}

export async function revokeCompetencyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser('/admin/staff');
  const staffProfileId = String(formData.get('staffProfileId') ?? '');
  const result = await run(() =>
    revokeCompetency(user, staffProfileId, String(formData.get('competencyId') ?? '')),
  );
  revalidatePath(`/admin/staff/${staffProfileId}`);
  return result;
}

/* ============================== 发票 ============================== */

export async function requestInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser('/admin/billing/invoices');
  const typeRaw = String(formData.get('invoiceType') ?? '');
  const valid = ['PERSONAL_ELECTRONIC', 'COMPANY_ELECTRONIC', 'COMPANY_SPECIAL'];
  if (!valid.includes(typeRaw)) return { ok: false, error: '发票类型不合法' };

  const result = await run(() =>
    requestInvoice(user, {
      orderId: String(formData.get('orderId') ?? ''),
      invoiceType: typeRaw as Parameters<typeof requestInvoice>[1]['invoiceType'],
      invoiceTitle: String(formData.get('invoiceTitle') ?? ''),
      invoiceTaxNo: String(formData.get('invoiceTaxNo') ?? '') || null,
      note: String(formData.get('note') ?? '') || null,
    }),
  );
  revalidatePath('/admin/billing/invoices');
  return result;
}

export async function issueInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser('/admin/billing/invoices');
  const result = await run(() =>
    issueInvoice(user, String(formData.get('orderId') ?? ''), String(formData.get('invoiceNo') ?? '')),
  );
  revalidatePath('/admin/billing/invoices');
  return result;
}

export async function voidInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser('/admin/billing/invoices');
  const result = await run(() =>
    voidInvoice(user, String(formData.get('orderId') ?? ''), String(formData.get('reason') ?? '')),
  );
  revalidatePath('/admin/billing/invoices');
  return result;
}
