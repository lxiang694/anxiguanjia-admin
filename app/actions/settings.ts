'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { PermissionError } from '@/lib/permissions';
import { createInternalUser, resetPassword, setUserStatus } from '@/services/account';
import { upsertNotificationTemplate, upsertServiceCatalogItem } from '@/services/settings';
import { upsertPlan } from '@/services/subscription';

/**
 * 系统配置与帐号管理的 Server Actions。
 *
 * 与业务 action 一样：权限判定只在 service 层做一次，这里只负责解析表单与回写页面。
 */

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

const SERVICE_TYPES = [
  'HOME_VISIT',
  'PHONE_CARE',
  'MEDICAL_ESCORT',
  'DAILY_ASSISTANCE',
  'ASSESSMENT',
  'EXTRA_VISIT',
] as const;

/* ========================= 服务类型与价格 ========================= */

const catalogSchema = z.object({
  serviceType: z.enum(SERVICE_TYPES),
  displayName: z.string().trim().min(1, '请填写对外显示名称').max(40),
  description: z.string().trim().max(500).optional(),
  defaultMinutes: z.coerce.number().int().min(5).max(600),
  addOnPrice: z.coerce.number().int().min(0).max(100000000).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});

export async function saveServiceCatalogAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser('/admin/system/services');

  const parsed = catalogSchema.safeParse({
    serviceType: formData.get('serviceType'),
    displayName: formData.get('displayName'),
    description: formData.get('description') || undefined,
    defaultMinutes: formData.get('defaultMinutes'),
    addOnPrice: formData.get('addOnPrice') || undefined,
    sortOrder: formData.get('sortOrder') || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '请检查输入' };
  }

  const result = await run(() =>
    upsertServiceCatalogItem(user, {
      ...parsed.data,
      description: parsed.data.description ?? null,
      // 价格以元输入、以分存储
      addOnPrice:
        parsed.data.addOnPrice === undefined ? null : Math.round(parsed.data.addOnPrice * 100),
      familyRequestable: formData.get('familyRequestable') === 'on',
      requiresCompetency: formData.get('requiresCompetency') === 'on',
      isActive: formData.get('isActive') === 'on',
    }),
  );
  revalidatePath('/admin/system/services');
  revalidatePath('/family/service');
  return result;
}

/* ========================= 通知模板 ========================= */

const templateSchema = z.object({
  event: z.enum([
    'SERVICE_COMPLETED',
    'REPORT_PUBLISHED',
    'NEXT_SERVICE_REMINDER',
    'SPECIALIST_CHANGED',
    'SCHEDULE_CHANGED',
    'MEMBERSHIP_EXPIRING',
    'INCIDENT_URGENT',
    'CANNOT_REACH_ELDER',
  ]),
  name: z.string().trim().min(1, '请填写模板名称').max(40),
  level: z.enum(['NORMAL', 'IMPORTANT', 'URGENT']),
  titleTemplate: z.string().trim().min(1, '请填写标题模板').max(200),
  bodyTemplate: z.string().trim().max(1000).optional(),
  requiredPermission: z
    .enum([
      'ASSURANCE_REPORT',
      'LIFE_RECORD',
      'PHOTO',
      'INCIDENT_ALERT',
      'SENSITIVE_HEALTH',
      'SERVICE_SCHEDULE',
      'CONTACT_INFO',
    ])
    .optional(),
});

export async function saveNotificationTemplateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser('/admin/system/templates');

  const parsed = templateSchema.safeParse({
    event: formData.get('event'),
    name: formData.get('name'),
    level: formData.get('level'),
    titleTemplate: formData.get('titleTemplate'),
    bodyTemplate: formData.get('bodyTemplate') || undefined,
    requiredPermission: formData.get('requiredPermission') || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '请检查输入' };
  }

  const channels = formData.getAll('enabledChannels').map(String);
  const valid = ['IN_APP', 'SMS', 'WECHAT', 'WECOM'];
  const enabledChannels = channels.filter((c) => valid.includes(c)) as (
    | 'IN_APP'
    | 'SMS'
    | 'WECHAT'
    | 'WECOM'
  )[];

  const result = await run(() =>
    upsertNotificationTemplate(user, {
      ...parsed.data,
      bodyTemplate: parsed.data.bodyTemplate ?? null,
      requiredPermission: parsed.data.requiredPermission ?? null,
      enabledChannels: enabledChannels.length > 0 ? enabledChannels : ['IN_APP'],
      isActive: formData.get('isActive') === 'on',
    }),
  );
  revalidatePath('/admin/system/templates');
  return result;
}

/* ========================= 服务方案 ========================= */

const planSchema = z.object({
  id: z.string().optional(),
  code: z.string().trim().min(2, '请填写方案代码').max(20),
  name: z.string().trim().min(1, '请填写方案名称').max(40),
  tier: z.enum(['CARE', 'ASSURANCE', 'STEWARD']),
  description: z.string().trim().max(500).optional(),
  monthlyPrice: z.coerce.number().min(0).max(1000000),
  visitsPerMonth: z.coerce.number().int().min(0).max(60),
  phoneCarePerMonth: z.coerce.number().int().min(0).max(60),
  reportsPerMonth: z.coerce.number().int().min(0).max(60),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});

export async function savePlanAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser('/admin/billing/plans');

  const parsed = planSchema.safeParse({
    id: formData.get('id') || undefined,
    code: formData.get('code'),
    name: formData.get('name'),
    tier: formData.get('tier'),
    description: formData.get('description') || undefined,
    monthlyPrice: formData.get('monthlyPrice'),
    visitsPerMonth: formData.get('visitsPerMonth'),
    phoneCarePerMonth: formData.get('phoneCarePerMonth'),
    reportsPerMonth: formData.get('reportsPerMonth'),
    sortOrder: formData.get('sortOrder') || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '请检查输入' };
  }

  const included = formData.getAll('includedServices').map(String);
  const includedServices = included.filter((s) =>
    (SERVICE_TYPES as readonly string[]).includes(s),
  ) as (typeof SERVICE_TYPES)[number][];

  const result = await run(() =>
    upsertPlan(user, {
      ...parsed.data,
      code: parsed.data.code.toUpperCase(),
      description: parsed.data.description ?? null,
      // 月费以元输入、以分存储
      monthlyPrice: Math.round(parsed.data.monthlyPrice * 100),
      includedServices,
      isActive: formData.get('isActive') === 'on',
    }),
  );
  revalidatePath('/admin/billing/plans');
  return result;
}

/* ========================= 帐号 ========================= */

const userSchema = z.object({
  name: z.string().trim().min(1, '请填写姓名').max(40),
  phone: z.string().trim().min(6, '请填写手机号').max(20),
  email: z.string().trim().email('邮箱格式不正确').optional().or(z.literal('')),
  role: z.enum([
    'SUPER_ADMIN',
    'OPERATIONS',
    'SERVICE_SUPERVISOR',
    'AREA_MANAGER',
    'CUSTOMER_SERVICE',
    'FINANCE',
    'HR',
    'CITY_LEAD',
    'FAMILY_CONSULTANT',
    'SENIOR_CARE_SPECIALIST',
    'CARE_SPECIALIST',
  ]),
  password: z.string().min(10, '初始密码至少 10 位').max(200),
  cityId: z.string().optional(),
  districtId: z.string().optional(),
  staffLevel: z.enum(['TRAINEE', 'JUNIOR', 'INTERMEDIATE', 'SENIOR', 'SUPERVISOR']).optional(),
  bio: z.string().trim().max(500).optional(),
});

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser('/admin/system/users');

  const parsed = userSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    email: formData.get('email') || undefined,
    role: formData.get('role'),
    password: formData.get('password'),
    cityId: formData.get('cityId') || undefined,
    districtId: formData.get('districtId') || undefined,
    staffLevel: formData.get('staffLevel') || undefined,
    bio: formData.get('bio') || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '请检查输入' };
  }

  const result = await run(() =>
    createInternalUser(user, {
      ...parsed.data,
      email: parsed.data.email || null,
      cityId: parsed.data.cityId ?? null,
      districtId: parsed.data.districtId ?? null,
      bio: parsed.data.bio ?? null,
    }),
  );
  revalidatePath('/admin/system/users');
  revalidatePath('/admin/staff');
  if (result?.ok) {
    return {
      ok: true,
      message: '帐号已创建。请当面或电话把初始密码告知本人 —— 第一版没有短信渠道，系统不会自动发送。',
    };
  }
  return result;
}

export async function setUserStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser('/admin/system/users');
  const userId = String(formData.get('userId') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!['ACTIVE', 'SUSPENDED', 'DISABLED', 'INVITED'].includes(status)) {
    return { ok: false, error: '状态不合法' };
  }
  const result = await run(() =>
    setUserStatus(user, userId, status as Parameters<typeof setUserStatus>[2]),
  );
  revalidatePath('/admin/system/users');
  return result;
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser('/admin/system/users');
  const userId = String(formData.get('userId') ?? '');
  const password = String(formData.get('password') ?? '');
  const result = await run(() => resetPassword(user, userId, password));
  revalidatePath('/admin/system/users');
  if (result?.ok) {
    return { ok: true, message: '密码已重置，该帐号的所有登录会话已同时失效。请线下告知本人新密码。' };
  }
  return result;
}
