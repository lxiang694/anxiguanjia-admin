'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { PermissionError } from '@/lib/permissions';
import {
  addFamilyMember,
  changePrimarySpecialist,
  createHousehold,
  updateFamilyMemberFlags,
  updateHouseholdStatus,
  upsertHouseholdPlan,
} from '@/services/household';
import { createElder, updateElder, upsertSensitiveInfo } from '@/services/elder';
import { grantConsent, revokeConsent } from '@/services/consent';
import { assignTask, cancelTask, createTask } from '@/services/scheduling';
import { amendVisitRecord, reviewVisitRecord } from '@/services/visit';
import { approveReport, generateReportDraft, publishReport, rejectReport } from '@/services/report';
import { updateIncidentStatus } from '@/services/incident';
import { updateServiceStatus, verifyEducation } from '@/services/staff';
import { createSubscription, refundOrder, renewSubscription } from '@/services/subscription';

/**
 * 总后台 Server Actions。
 *
 * 统一约定：
 *  - 每个 action 第一件事是 requireUser()，第二件事是把用户交给 service 层做权限判定。
 *  - 权限与业务校验只在 service 层实现一次，不在这里重复（避免两处规则不一致）。
 *  - 返回 { ok, error } 结构，让表单能就地显示错误而不是抛出整页错误。
 */

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;

async function run<T>(fn: () => Promise<T>): Promise<ActionState> {
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    const message = err instanceof Error ? err.message : '操作失败，请重试';
    return { ok: false, error: message };
  }
}

/* ============================== 家庭 ============================== */

const createHouseholdSchema = z.object({
  name: z.string().trim().min(1, '请填写家庭名称').max(60),
  cityId: z.string().min(1, '请选择城市'),
  districtId: z.string().optional(),
  addressLine: z.string().trim().max(200).optional(),
  consultantId: z.string().optional(),
  serviceNotes: z.string().trim().max(1000).optional(),
  internalNotes: z.string().trim().max(1000).optional(),
});

export async function createHouseholdAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser('/admin/households/new');

  const parsed = createHouseholdSchema.safeParse({
    name: formData.get('name'),
    cityId: formData.get('cityId'),
    districtId: formData.get('districtId') || undefined,
    addressLine: formData.get('addressLine') || undefined,
    consultantId: formData.get('consultantId') || undefined,
    serviceNotes: formData.get('serviceNotes') || undefined,
    internalNotes: formData.get('internalNotes') || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '请检查输入' };
  }

  let householdId: string;
  try {
    const household = await createHousehold(user, {
      ...parsed.data,
      districtId: parsed.data.districtId ?? null,
      status: 'LEAD',
    });
    householdId = household.id;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : '创建失败' };
  }

  revalidatePath('/admin/households');
  redirect(`/admin/households/${householdId}`);
}

export async function updateHouseholdStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const householdId = String(formData.get('householdId') ?? '');
  const status = String(formData.get('status') ?? '');
  const valid = [
    'LEAD',
    'PENDING_ASSESSMENT',
    'TRIAL',
    'ACTIVE_MEMBER',
    'RENEWAL_DUE',
    'PAUSED',
    'TERMINATED',
  ];
  if (!valid.includes(status)) return { ok: false, error: '状态不合法' };

  const result = await run(() =>
    updateHouseholdStatus(user, householdId, status as Parameters<typeof updateHouseholdStatus>[2]),
  );
  revalidatePath(`/admin/households/${householdId}`);
  return result;
}

export async function changeSpecialistAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const householdId = String(formData.get('householdId') ?? '');
  const staffProfileId = String(formData.get('staffProfileId') ?? '') || null;
  const reason = String(formData.get('reason') ?? '');

  const result = await run(() =>
    changePrimarySpecialist(user, householdId, staffProfileId, reason),
  );
  revalidatePath(`/admin/households/${householdId}`);
  return result;
}

/* ============================== 长辈 ============================== */

const createElderSchema = z.object({
  householdId: z.string().min(1),
  name: z.string().trim().min(1, '请填写长辈姓名').max(40),
  gender: z.enum(['MALE', 'FEMALE', 'UNDISCLOSED']).optional(),
  birthday: z.string().optional(),
  phone: z.string().trim().max(30).optional(),
  livingArrangement: z.string().trim().max(300).optional(),
  dailyRoutine: z.string().trim().max(500).optional(),
  communicationPrefs: z.string().trim().max(300).optional(),
  dailyNeeds: z.string().trim().max(500).optional(),
  attentionNotes: z.string().trim().max(500).optional(),
  emergencyArrangement: z.string().trim().max(300).optional(),
});

export async function createElderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = createElderSchema.safeParse({
    householdId: formData.get('householdId'),
    name: formData.get('name'),
    gender: formData.get('gender') || undefined,
    birthday: formData.get('birthday') || undefined,
    phone: formData.get('phone') || undefined,
    livingArrangement: formData.get('livingArrangement') || undefined,
    dailyRoutine: formData.get('dailyRoutine') || undefined,
    communicationPrefs: formData.get('communicationPrefs') || undefined,
    dailyNeeds: formData.get('dailyNeeds') || undefined,
    attentionNotes: formData.get('attentionNotes') || undefined,
    emergencyArrangement: formData.get('emergencyArrangement') || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '请检查输入' };
  }

  const { birthday, ...rest } = parsed.data;
  const result = await run(() =>
    createElder(user, {
      ...rest,
      birthday: birthday ? new Date(birthday) : null,
    }),
  );
  revalidatePath(`/admin/households/${parsed.data.householdId}`);
  return result;
}

/* ============================== 授权 ============================== */

export async function grantConsentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const elderId = String(formData.get('elderId') ?? '');
  const grantorId = String(formData.get('grantorId') ?? '');
  const granteeId = String(formData.get('granteeId') ?? '');
  const permissionType = String(formData.get('permissionType') ?? '');
  const basis = String(formData.get('basis') ?? 'ELDER_SELF_SIGNED');
  const expiresAt = String(formData.get('expiresAt') ?? '');
  const scope = String(formData.get('scope') ?? '');
  const householdId = String(formData.get('householdId') ?? '');

  const validPerms = [
    'ASSURANCE_REPORT',
    'LIFE_RECORD',
    'PHOTO',
    'INCIDENT_ALERT',
    'SENSITIVE_HEALTH',
    'SERVICE_SCHEDULE',
    'CONTACT_INFO',
  ];
  if (!validPerms.includes(permissionType)) return { ok: false, error: '授权内容不合法' };

  const result = await run(() =>
    grantConsent(user, {
      elderId,
      grantorId,
      granteeId,
      permissionType: permissionType as Parameters<typeof grantConsent>[1]['permissionType'],
      basis: basis as Parameters<typeof grantConsent>[1]['basis'],
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      scope: scope || null,
    }),
  );
  if (householdId) revalidatePath(`/admin/households/${householdId}`);
  revalidatePath('/admin/consents');
  return result;
}

export async function revokeConsentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const consentId = String(formData.get('consentId') ?? '');
  const reason = String(formData.get('reason') ?? '');
  const householdId = String(formData.get('householdId') ?? '');

  const result = await run(() => revokeConsent(user, consentId, reason || undefined));
  if (householdId) revalidatePath(`/admin/households/${householdId}`);
  revalidatePath('/admin/consents');
  return result;
}

/* ============================== 排班派单 ============================== */

export async function createTaskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const householdId = String(formData.get('householdId') ?? '');
  const elderId = String(formData.get('elderId') ?? '') || null;
  const serviceType = String(formData.get('serviceType') ?? '');
  const scheduledStart = String(formData.get('scheduledStart') ?? '');
  const staffProfileId = String(formData.get('staffProfileId') ?? '') || null;
  const taskItems = String(formData.get('taskItems') ?? '') || null;
  const estimatedMinutes = Number(formData.get('estimatedMinutes') ?? '60');

  if (!scheduledStart) return { ok: false, error: '请选择服务时间' };
  const when = new Date(scheduledStart);
  if (Number.isNaN(when.getTime())) return { ok: false, error: '服务时间格式不正确' };

  const result = await run(() =>
    createTask(user, {
      householdId,
      elderId,
      serviceType: serviceType as Parameters<typeof createTask>[1]['serviceType'],
      scheduledStart: when,
      staffProfileId,
      taskItems,
      estimatedMinutes: Number.isFinite(estimatedMinutes) ? estimatedMinutes : 60,
    }),
  );
  revalidatePath('/admin/service/dispatch');
  revalidatePath('/admin/service/today');
  revalidatePath(`/admin/households/${householdId}`);
  return result;
}

export async function assignTaskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const taskId = String(formData.get('taskId') ?? '');
  const staffProfileId = String(formData.get('staffProfileId') ?? '');
  const reason = String(formData.get('reason') ?? '') || undefined;

  const result = await run(() => assignTask(user, taskId, staffProfileId, reason));
  revalidatePath('/admin/service/dispatch');
  revalidatePath('/admin/service/today');
  return result;
}

export async function cancelTaskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const taskId = String(formData.get('taskId') ?? '');
  const reason = String(formData.get('reason') ?? '');
  const result = await run(() => cancelTask(user, taskId, reason));
  revalidatePath('/admin/service/today');
  revalidatePath('/admin/service/dispatch');
  return result;
}

/* ============================== 服务记录 ============================== */

export async function reviewRecordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const recordId = String(formData.get('recordId') ?? '');
  const note = String(formData.get('note') ?? '') || undefined;
  const result = await run(() => reviewVisitRecord(user, recordId, note));
  revalidatePath('/admin/service/records');
  revalidatePath(`/admin/service/records/${recordId}`);
  return result;
}

export async function amendRecordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const recordId = String(formData.get('recordId') ?? '');
  const amendment = String(formData.get('amendment') ?? '');
  const result = await run(() => amendVisitRecord(user, recordId, amendment));
  revalidatePath(`/admin/service/records/${recordId}`);
  return result;
}

/* ============================== 安心报告 ============================== */

export async function generateReportAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const householdId = String(formData.get('householdId') ?? '');
  const elderId = String(formData.get('elderId') ?? '') || null;

  const result = await run(() => generateReportDraft(user, { householdId, elderId }));
  revalidatePath('/admin/service/reports');
  return result;
}

export async function approveReportAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const reportId = String(formData.get('reportId') ?? '');

  const patchKeys = [
    'title',
    'spiritSummary',
    'dietSummary',
    'sleepSummary',
    'activitySummary',
    'lifeSummary',
    'attentionSummary',
    'familyTip',
  ] as const;

  const patch: Partial<Record<(typeof patchKeys)[number], string>> = {};
  for (const key of patchKeys) {
    const value = formData.get(key);
    if (typeof value === 'string' && value.trim().length > 0) patch[key] = value;
  }

  const result = await run(() =>
    approveReport(user, {
      reportId,
      patch,
      note: String(formData.get('note') ?? '') || undefined,
    }),
  );
  revalidatePath('/admin/service/reports');
  revalidatePath(`/admin/service/reports/${reportId}`);
  return result;
}

export async function rejectReportAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const reportId = String(formData.get('reportId') ?? '');
  const reason = String(formData.get('reason') ?? '');
  const result = await run(() => rejectReport(user, reportId, reason));
  revalidatePath(`/admin/service/reports/${reportId}`);
  return result;
}

export async function publishReportAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const reportId = String(formData.get('reportId') ?? '');
  const result = await run(() => publishReport(user, reportId));
  revalidatePath('/admin/service/reports');
  revalidatePath(`/admin/service/reports/${reportId}`);
  return result;
}

/* ============================== 事件 ============================== */

export async function updateIncidentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const incidentId = String(formData.get('incidentId') ?? '');
  const status = String(formData.get('status') ?? '');
  const note = String(formData.get('note') ?? '') || undefined;
  const resolution = String(formData.get('resolution') ?? '') || undefined;

  const valid = ['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PENDING_FOLLOW_UP', 'CLOSED'];
  if (!valid.includes(status)) return { ok: false, error: '状态不合法' };

  const result = await run(() =>
    updateIncidentStatus(user, incidentId, status as Parameters<typeof updateIncidentStatus>[2], {
      note,
      resolution,
      takeOwnership: formData.get('takeOwnership') === 'on',
    }),
  );
  revalidatePath('/admin/incidents');
  revalidatePath(`/admin/incidents/${incidentId}`);
  return result;
}

/* ============================== 专员 ============================== */

export async function updateStaffStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const staffProfileId = String(formData.get('staffProfileId') ?? '');
  const status = String(formData.get('serviceStatus') ?? '');
  const valid = [
    'NOT_STARTED',
    'IN_TRAINING',
    'PENDING_ASSESSMENT',
    'PASSED',
    'ACTIVE',
    'SUSPENDED',
    'OFFBOARDED',
  ];
  if (!valid.includes(status)) return { ok: false, error: '状态不合法' };

  const result = await run(() =>
    updateServiceStatus(user, staffProfileId, status as Parameters<typeof updateServiceStatus>[2]),
  );
  revalidatePath('/admin/staff');
  revalidatePath(`/admin/staff/${staffProfileId}`);
  return result;
}

export async function verifyEducationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const educationId = String(formData.get('educationId') ?? '');
  const status = String(formData.get('status') ?? '');
  if (status !== 'VERIFIED' && status !== 'REJECTED') {
    return { ok: false, error: '核验结果不合法' };
  }
  const result = await run(() => verifyEducation(user, educationId, status));
  revalidatePath('/admin/staff');
  return result;
}

/* ============================== 订单 ============================== */

export async function renewSubscriptionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const subscriptionId = String(formData.get('subscriptionId') ?? '');
  const months = Number(formData.get('months') ?? '1');
  const result = await run(() =>
    renewSubscription(user, subscriptionId, Number.isFinite(months) && months > 0 ? months : 1),
  );
  revalidatePath('/admin/billing/subscriptions');
  return result;
}

export async function refundOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const orderId = String(formData.get('orderId') ?? '');
  const reason = String(formData.get('reason') ?? '');
  const result = await run(() => refundOrder(user, orderId, reason));
  revalidatePath('/admin/billing/orders');
  return result;
}

/* ============================== 长辈档案编辑 ============================== */

const updateElderSchema = z.object({
  elderId: z.string().min(1),
  name: z.string().trim().min(1, '请填写长辈姓名').max(40),
  gender: z.enum(['MALE', 'FEMALE', 'UNDISCLOSED']).optional(),
  birthday: z.string().optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(200).optional(),
  livingStatus: z
    .enum(['ALONE', 'WITH_SPOUSE', 'WITH_CHILDREN', 'WITH_CAREGIVER', 'OTHER'])
    .optional(),
  mobilityStatus: z
    .enum([
      'INDEPENDENT',
      'SLOW_BUT_INDEPENDENT',
      'NEEDS_AID',
      'NEEDS_ASSISTANCE',
      'MOSTLY_BEDBOUND',
      'UNKNOWN',
    ])
    .optional(),
  livingArrangement: z.string().trim().max(300).optional(),
  familyRelations: z.string().trim().max(300).optional(),
  dailyRoutine: z.string().trim().max(500).optional(),
  activityNotes: z.string().trim().max(500).optional(),
  dietNotes: z.string().trim().max(500).optional(),
  sleepNotes: z.string().trim().max(500).optional(),
  communicationPrefs: z.string().trim().max(300).optional(),
  dailyNeeds: z.string().trim().max(500).optional(),
  attentionNotes: z.string().trim().max(500).optional(),
  emergencyArrangement: z.string().trim().max(300).optional(),
  generalNotes: z.string().trim().max(1000).optional(),
});

export async function updateElderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const raw: Record<string, unknown> = { elderId: formData.get('elderId') };
  for (const key of [
    'name',
    'gender',
    'birthday',
    'phone',
    'address',
    'livingStatus',
    'mobilityStatus',
    'livingArrangement',
    'familyRelations',
    'dailyRoutine',
    'activityNotes',
    'dietNotes',
    'sleepNotes',
    'communicationPrefs',
    'dailyNeeds',
    'attentionNotes',
    'emergencyArrangement',
    'generalNotes',
  ]) {
    raw[key] = formData.get(key) || undefined;
  }

  const parsed = updateElderSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '请检查输入' };
  }

  const { elderId, birthday, ...patch } = parsed.data;
  const result = await run(() =>
    updateElder(user, elderId, {
      ...patch,
      birthday: birthday ? new Date(birthday) : undefined,
    }),
  );
  revalidatePath(`/admin/elders/${elderId}`);
  return result;
}

const sensitiveSchema = z.object({
  elderId: z.string().min(1),
  chronicConditions: z.string().trim().max(1000).optional(),
  medications: z.string().trim().max(1000).optional(),
  allergies: z.string().trim().max(500).optional(),
  medicalDocsNotes: z.string().trim().max(1000).optional(),
  bpSystolicMax: z.coerce.number().int().min(60).max(260).optional(),
  bpDiastolicMax: z.coerce.number().int().min(30).max(200).optional(),
  glucoseMax: z.coerce.number().min(1).max(50).optional(),
});

/**
 * 录入健康敏感信息。
 * 这是全系统权限最紧的写操作之一：一线专员没有这个能力，
 * 且每次写入都单独审计（只记录改了哪些字段，不把明文再落一份到日志）。
 */
export async function saveSensitiveInfoAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = sensitiveSchema.safeParse({
    elderId: formData.get('elderId'),
    chronicConditions: formData.get('chronicConditions') || undefined,
    medications: formData.get('medications') || undefined,
    allergies: formData.get('allergies') || undefined,
    medicalDocsNotes: formData.get('medicalDocsNotes') || undefined,
    bpSystolicMax: formData.get('bpSystolicMax') || undefined,
    bpDiastolicMax: formData.get('bpDiastolicMax') || undefined,
    glucoseMax: formData.get('glucoseMax') || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '请检查输入' };
  }

  const { elderId, ...patch } = parsed.data;
  const result = await run(() => upsertSensitiveInfo(user, elderId, patch));
  revalidatePath(`/admin/elders/${elderId}`);
  return result;
}

/* ============================== 家庭成员 ============================== */

const addMemberSchema = z.object({
  householdId: z.string().min(1),
  name: z.string().trim().min(1, '请填写姓名').max(40),
  phone: z.string().trim().min(6, '请填写手机号').max(20),
  email: z.string().trim().email('邮箱格式不正确').optional().or(z.literal('')),
  relationship: z.enum([
    'SON',
    'DAUGHTER',
    'SPOUSE',
    'DAUGHTER_IN_LAW',
    'SON_IN_LAW',
    'GRANDCHILD',
    'SIBLING',
    'RELATIVE',
    'FRIEND',
    'OTHER',
  ]),
  elderId: z.string().optional(),
  password: z.string().min(10, '初始密码至少 10 位').max(200),
});

export async function addFamilyMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = addMemberSchema.safeParse({
    householdId: formData.get('householdId'),
    name: formData.get('name'),
    phone: formData.get('phone'),
    email: formData.get('email') || undefined,
    relationship: formData.get('relationship'),
    elderId: formData.get('elderId') || undefined,
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '请检查输入' };
  }

  const result = await run(() =>
    addFamilyMember(user, {
      ...parsed.data,
      email: parsed.data.email || null,
      elderId: parsed.data.elderId ?? null,
      isPayer: formData.get('isPayer') === 'on',
      isPrimaryContact: formData.get('isPrimaryContact') === 'on',
      isEmergencyContact: formData.get('isEmergencyContact') === 'on',
    }),
  );
  revalidatePath(`/admin/households/${parsed.data.householdId}`);
  revalidatePath('/admin/members');
  if (result?.ok) {
    return {
      ok: true,
      message:
        '成员已加入，家庭端帐号已创建。注意：新增成员不会自动获得任何查看授权 —— 请在「授权」页逐项建立。',
    };
  }
  return result;
}

export async function updateMemberFlagsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const memberId = String(formData.get('memberId') ?? '');
  const householdId = String(formData.get('householdId') ?? '');
  const result = await run(() =>
    updateFamilyMemberFlags(user, memberId, {
      isPayer: formData.get('isPayer') === 'on',
      isPrimaryContact: formData.get('isPrimaryContact') === 'on',
      isEmergencyContact: formData.get('isEmergencyContact') === 'on',
    }),
  );
  if (householdId) revalidatePath(`/admin/households/${householdId}`);
  revalidatePath('/admin/members');
  return result;
}

/* ============================== 家庭执行计划 / 订阅 ============================== */

const householdPlanSchema = z.object({
  householdId: z.string().min(1),
  planId: z.string().optional(),
  visitsPerWeek: z.coerce.number().min(0).max(21),
  phoneCarePerWeek: z.coerce.number().min(0).max(21),
  reportsPerWeek: z.coerce.number().min(0).max(21),
  preferredWeekday: z.coerce.number().int().min(0).max(6).optional(),
  preferredWindow: z.string().trim().max(60).optional(),
  executionNotes: z.string().trim().max(1000).optional(),
});

export async function saveHouseholdPlanAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const weekdayRaw = formData.get('preferredWeekday');
  const parsed = householdPlanSchema.safeParse({
    householdId: formData.get('householdId'),
    planId: formData.get('planId') || undefined,
    visitsPerWeek: formData.get('visitsPerWeek'),
    phoneCarePerWeek: formData.get('phoneCarePerWeek'),
    reportsPerWeek: formData.get('reportsPerWeek'),
    preferredWeekday: weekdayRaw === '' || weekdayRaw === null ? undefined : weekdayRaw,
    preferredWindow: formData.get('preferredWindow') || undefined,
    executionNotes: formData.get('executionNotes') || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '请检查输入' };
  }

  const result = await run(() =>
    upsertHouseholdPlan(user, {
      ...parsed.data,
      planId: parsed.data.planId ?? null,
      preferredWeekday: parsed.data.preferredWeekday ?? null,
      preferredWindow: parsed.data.preferredWindow ?? null,
      executionNotes: parsed.data.executionNotes ?? null,
    }),
  );
  revalidatePath(`/admin/households/${parsed.data.householdId}`);
  return result;
}

export async function createSubscriptionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const householdId = String(formData.get('householdId') ?? '');
  const planId = String(formData.get('planId') ?? '');
  const months = Number(formData.get('periodMonths') ?? '1');
  const statusRaw = String(formData.get('status') ?? 'ACTIVE');
  const valid = ['TRIAL', 'ACTIVE'];

  const result = await run(() =>
    createSubscription(user, {
      householdId,
      planId,
      periodMonths: Number.isFinite(months) && months > 0 ? months : 1,
      status: valid.includes(statusRaw)
        ? (statusRaw as Parameters<typeof createSubscription>[1]['status'])
        : 'ACTIVE',
      createOrder: formData.get('createOrder') === 'on',
    }),
  );
  revalidatePath(`/admin/households/${householdId}`);
  revalidatePath('/admin/billing/subscriptions');
  return result;
}
