'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { revokeConsentByGrantor } from '@/services/consent';
import { rateReport, submitChangeRequest, submitFeedback } from '@/services/family';

/**
 * 家庭端 Server Actions。
 *
 * 家庭端能做的写操作刻意很少：申请改期 / 取消 / 额外服务、提交反馈、管理自己给出的授权。
 * 所有涉及长辈数据的读取都在 services/family 里经 Consent 过滤，这里不做任何放宽。
 */

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;

async function run<T>(fn: () => Promise<T>): Promise<ActionState> {
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : '操作失败，请重试' };
  }
}

const changeRequestSchema = z.object({
  type: z.enum(['RESCHEDULE', 'CANCEL', 'EXTRA_SERVICE']),
  taskId: z.string().optional(),
  preferredAt: z.string().optional(),
  // 这里只校验「是不是合法的服务类型」；「家庭是否可以自行申请这一类」
  // 由 services/family 依据服务目录（ServiceCatalogItem.familyRequestable）判断，
  // 否则运营在系统配置里开放了新类型，家庭端仍会被前端写死的白名单挡掉。
  serviceType: z
    .enum(['HOME_VISIT', 'PHONE_CARE', 'MEDICAL_ESCORT', 'DAILY_ASSISTANCE', 'ASSESSMENT', 'EXTRA_VISIT'])
    .optional(),
  reason: z.string().trim().max(500).optional(),
});

export async function submitChangeRequestAction(_prev: ActionState, formData: FormData) {
  const user = await requireUser('/family/service');

  const parsed = changeRequestSchema.safeParse({
    type: formData.get('type'),
    taskId: formData.get('taskId') || undefined,
    preferredAt: formData.get('preferredAt') || undefined,
    serviceType: formData.get('serviceType') || undefined,
    reason: formData.get('reason') || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '请检查填写内容' };
  }

  const result = await run(() =>
    submitChangeRequest(user, {
      type: parsed.data.type,
      taskId: parsed.data.taskId ?? null,
      preferredAt: parsed.data.preferredAt ? new Date(parsed.data.preferredAt) : null,
      serviceType: parsed.data.serviceType ?? null,
      reason: parsed.data.reason ?? null,
    }),
  );

  revalidatePath('/family/service');
  if (result?.ok) {
    return { ok: true, message: '已提交，我们会尽快与您电话确认' };
  }
  return result;
}

const feedbackSchema = z.object({
  category: z.enum([
    'SERVICE_ATTITUDE',
    'TIMING',
    'SERVICE_CONTENT',
    'SAFETY',
    'PAYMENT',
    'CONSULTATION',
    'OTHER',
  ]),
  subject: z.string().trim().min(2, '请填写标题').max(100),
  content: z.string().trim().min(5, '请多写几句，方便我们了解情况').max(2000),
});

export async function submitFeedbackAction(_prev: ActionState, formData: FormData) {
  const user = await requireUser('/family/me');

  const parsed = feedbackSchema.safeParse({
    category: formData.get('category'),
    subject: formData.get('subject'),
    content: formData.get('content'),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '请检查填写内容' };
  }

  const result = await run(() =>
    submitFeedback(user, {
      ...parsed.data,
      isComplaint: formData.get('isComplaint') === 'on',
    }),
  );

  revalidatePath('/family/me');
  if (result?.ok) return { ok: true, message: '已收到，我们会尽快跟进并与您联系' };
  return result;
}

export async function revokeMyConsentAction(_prev: ActionState, formData: FormData) {
  const user = await requireUser('/family/consents');
  const consentId = String(formData.get('consentId') ?? '');
  const result = await run(() => revokeConsentByGrantor(user, consentId));
  revalidatePath('/family/consents');
  return result;
}

const rateReportSchema = z.object({
  reportId: z.string().min(1),
  rating: z.coerce.number().int().min(1, '请选择 1 到 5 之间的评分').max(5, '请选择 1 到 5 之间的评分'),
  comment: z.string().trim().max(500).optional(),
});

/** 阅读报告后的评分（用于服务质量指标，不影响任何数据访问） */
export async function rateReportAction(_prev: ActionState, formData: FormData) {
  const user = await requireUser('/family/reports');

  const parsed = rateReportSchema.safeParse({
    reportId: formData.get('reportId'),
    rating: formData.get('rating'),
    comment: formData.get('comment') || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '请检查填写内容' };
  }

  // 归属校验与写入都在服务层，这里不直接碰数据库
  const result = await run(() =>
    rateReport(user, {
      reportId: parsed.data.reportId,
      rating: parsed.data.rating,
      comment: parsed.data.comment ?? null,
    }),
  );

  revalidatePath(`/family/reports/${parsed.data.reportId}`);
  if (result?.ok) return { ok: true, message: '谢谢您的反馈' };
  return result;
}
