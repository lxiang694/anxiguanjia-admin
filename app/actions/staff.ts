'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { PermissionError } from '@/lib/permissions';
import { createIncident } from '@/services/incident';
import { submitUnavailability } from '@/services/staff';
import {
  acceptTask,
  checkInArrival,
  declineTask,
  markNotCompleted,
  startService,
  submitVisitRecord,
} from '@/services/visit';

/**
 * 安心专员工作台的 Server Actions。
 *
 * 设计取向：一线成员常在户外单手操作，所以每个动作都尽量「一步完成」，
 * 错误信息用口语化中文直接说清楚下一步该怎么做。
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

function revalidateTask(taskId: string) {
  revalidatePath('/staff');
  revalidatePath('/staff/tasks');
  revalidatePath(`/staff/tasks/${taskId}`);
}

/* ---------------------------- 任务状态推进 ---------------------------- */

export async function acceptTaskAction(_prev: ActionState, formData: FormData) {
  const user = await requireUser('/staff');
  const taskId = String(formData.get('taskId') ?? '');
  const result = await run(() => acceptTask(user, taskId));
  revalidateTask(taskId);
  return result;
}

export async function declineTaskAction(_prev: ActionState, formData: FormData) {
  const user = await requireUser('/staff');
  const taskId = String(formData.get('taskId') ?? '');
  const reason = String(formData.get('reason') ?? '');
  const result = await run(() => declineTask(user, taskId, reason));
  revalidateTask(taskId);
  return result;
}

const coordsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  accuracy: z.coerce.number().min(0).optional(),
});

/** 到达签到。坐标可选 —— 室内定位失败不应阻断服务。 */
export async function checkInAction(_prev: ActionState, formData: FormData) {
  const user = await requireUser('/staff');
  const taskId = String(formData.get('taskId') ?? '');

  const parsed = coordsSchema.safeParse({
    lat: formData.get('lat') || undefined,
    lng: formData.get('lng') || undefined,
    accuracy: formData.get('accuracy') || undefined,
  });

  const coords =
    parsed.success && parsed.data.lat !== undefined && parsed.data.lng !== undefined
      ? { lat: parsed.data.lat, lng: parsed.data.lng, accuracy: parsed.data.accuracy }
      : undefined;

  const result = await run(() => checkInArrival(user, taskId, coords));
  revalidateTask(taskId);
  return result;
}

export async function startServiceAction(_prev: ActionState, formData: FormData) {
  const user = await requireUser('/staff');
  const taskId = String(formData.get('taskId') ?? '');
  const result = await run(() => startService(user, taskId));
  revalidateTask(taskId);
  return result;
}

export async function markNotCompletedAction(_prev: ActionState, formData: FormData) {
  const user = await requireUser('/staff');
  const taskId = String(formData.get('taskId') ?? '');
  const reason = String(formData.get('reason') ?? '');
  const result = await run(() => markNotCompleted(user, taskId, reason));
  revalidateTask(taskId);
  return result;
}

/* ---------------------------- 服务记录 ---------------------------- */

const OBSERVATION = z.enum(['NORMAL', 'FAIR', 'SELF_REPORTED_ISSUE', 'REDUCED', 'UNKNOWN', 'OTHER']);

const recordSchema = z.object({
  taskId: z.string().min(1),
  spiritLevel: OBSERVATION,
  spiritNote: z.string().trim().max(300).optional(),
  dietLevel: OBSERVATION,
  dietNote: z.string().trim().max(300).optional(),
  sleepLevel: OBSERVATION,
  sleepNote: z.string().trim().max(300).optional(),
  activityLevel: OBSERVATION,
  activityNote: z.string().trim().max(300).optional(),
  observationText: z.string().trim().max(1500).optional(),
});

export async function submitRecordAction(_prev: ActionState, formData: FormData) {
  const user = await requireUser('/staff');

  const parsed = recordSchema.safeParse({
    taskId: formData.get('taskId'),
    spiritLevel: formData.get('spiritLevel'),
    spiritNote: formData.get('spiritNote') || undefined,
    dietLevel: formData.get('dietLevel'),
    dietNote: formData.get('dietNote') || undefined,
    sleepLevel: formData.get('sleepLevel'),
    sleepNote: formData.get('sleepNote') || undefined,
    activityLevel: formData.get('activityLevel'),
    activityNote: formData.get('activityNote') || undefined,
    observationText: formData.get('observationText') || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '请检查填写内容' };
  }

  const completedItems = formData.getAll('completedItems').map(String).filter(Boolean);

  // 健康数值：全部字段都填了才登记，且必须选择来源
  const readings: NonNullable<Parameters<typeof submitVisitRecord>[1]['readings']> = [];
  const bpSys = formData.get('bpSystolic');
  const bpDia = formData.get('bpDiastolic');
  const bpSource = String(formData.get('bpSource') ?? '');
  if (bpSys && bpDia && bpSource) {
    const sys = Number(bpSys);
    const dia = Number(bpDia);
    if (Number.isFinite(sys) && Number.isFinite(dia) && sys > 0 && dia > 0) {
      readings.push({
        type: 'BLOOD_PRESSURE',
        source: bpSource as never,
        valuePrimary: sys,
        valueSecondary: dia,
        unit: 'mmHg',
      });
    }
  }

  const result = await run(() =>
    submitVisitRecord(user, {
      ...parsed.data,
      completedItems,
      readings: readings.length > 0 ? readings : undefined,
    }),
  );

  revalidateTask(parsed.data.taskId);
  if (result?.ok) redirect(`/staff/tasks/${parsed.data.taskId}?submitted=1`);
  return result;
}

/* ---------------------------- 需要协助 / 异常上报 ---------------------------- */

const incidentSchema = z.object({
  householdId: z.string().min(1, '请选择家庭'),
  elderId: z.string().optional(),
  taskId: z.string().optional(),
  type: z.enum([
    'CANNOT_REACH_ELDER',
    'ELDER_FEELS_UNWELL',
    'FALL',
    'ENVIRONMENT_SAFETY',
    'SERVICE_CONFLICT',
    'FAMILY_DISPUTE',
    'OTHER',
  ]),
  description: z.string().trim().min(5, '请简单描述发生了什么（至少 5 个字）').max(1500),
});

export async function reportIncidentAction(_prev: ActionState, formData: FormData) {
  const user = await requireUser('/staff');

  const parsed = incidentSchema.safeParse({
    householdId: formData.get('householdId'),
    elderId: formData.get('elderId') || undefined,
    taskId: formData.get('taskId') || undefined,
    type: formData.get('type'),
    description: formData.get('description'),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '请检查填写内容' };
  }

  let incidentNo: string;
  try {
    const incident = await createIncident(user, {
      householdId: parsed.data.householdId,
      elderId: parsed.data.elderId ?? null,
      taskId: parsed.data.taskId ?? null,
      type: parsed.data.type,
      description: parsed.data.description,
      needsImmediateFamilyContact: formData.get('needsImmediateFamilyContact') === 'on',
    });
    incidentNo = incident.incidentNo;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : '上报失败，请重试' };
  }

  revalidatePath('/staff');
  revalidatePath('/staff/help');
  return {
    ok: true,
    message: `已上报（事件编号 ${incidentNo}）。服务督导已收到通知，请留在现场等待联系。`,
  };
}

/* ---------------------------- 不可排班时间 ---------------------------- */

const availabilitySchema = z.object({
  startAt: z.string().min(1, '请选择开始时间'),
  endAt: z.string().min(1, '请选择结束时间'),
  reason: z.string().trim().max(200).optional(),
});

export async function submitAvailabilityAction(_prev: ActionState, formData: FormData) {
  const user = await requireUser('/staff');

  const parsed = availabilitySchema.safeParse({
    startAt: formData.get('startAt'),
    endAt: formData.get('endAt'),
    reason: formData.get('reason') || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '请检查填写内容' };
  }

  try {
    await submitUnavailability(user, {
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
      reason: parsed.data.reason ?? null,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : '提交失败，请重试' };
  }

  revalidatePath('/staff/me');
  return { ok: true, message: '已提交，排班时会避开这段时间' };
}
