import 'server-only';

import type { ObservationLevel, ReadingSource, ReadingType } from '@prisma/client';

import type { CurrentUser } from '@/lib/auth';
import { auditAs } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { assertCan, taskScopeWhere } from '@/lib/permissions';
import { SERVICE_TYPE_LABELS } from '@/lib/labels';
import { canTransition } from '@/services/scheduling';

/**
 * 上门服务执行与服务记录。
 *
 * 两条纪律：
 *  1. 定位只在「到达签到」时记录一次，绝不做 24 小时持续定位。
 *  2. 提交后的 VisitRecord 即为原始记录，永久保留；后续更正只追加 amendmentNote，
 *     不覆盖原始语义，也不因为家庭报告改写而变动。
 */

/** 专员端任务详情 —— 已按「专员不该看到什么」裁剪 */
export async function getTaskForSpecialist(user: CurrentUser, taskId: string) {
  if (!user.staffProfileId) return null;

  const task = await prisma.serviceTask.findFirst({
    where: { id: taskId, staffProfileId: user.staffProfileId, deletedAt: null },
    select: {
      id: true,
      taskNo: true,
      serviceType: true,
      status: true,
      scheduledStart: true,
      estimatedMinutes: true,
      addressLine: true,
      taskItems: true,
      attentionSnapshot: true,
      isBackupAssignment: true,
      acceptedAt: true,
      arrivedAt: true,
      startedAt: true,
      endedAt: true,
      isDemo: true,
      household: {
        select: {
          id: true,
          name: true,
          serviceNotes: true,
          district: { select: { name: true } },
          // 紧急联络安排属于服务必要信息，保留；但不含订阅价格等财务字段
          primaryContact: {
            select: {
              isEmergencyContact: true,
              relationship: true,
              user: { select: { name: true, phone: true } },
            },
          },
        },
      },
      elder: {
        select: {
          id: true,
          name: true,
          gender: true,
          birthday: true,
          phone: true,
          mobilityStatus: true,
          communicationPrefs: true,
          dailyNeeds: true,
          attentionNotes: true,
          emergencyArrangement: true,
          // 明确不 select sensitive 关联 —— 一线专员看不到慢性病与用药
        },
      },
      record: true,
    },
  });

  if (!task) return null;

  await auditAs(user, {
    action: 'VIEW_ELDER_PROFILE',
    resource: 'ServiceTask',
    resourceId: taskId,
    permissionNote: '一线专员访问自身任务（已裁剪财务与敏感健康字段）',
  });

  return task;
}

async function transition(
  user: CurrentUser,
  taskId: string,
  to: Parameters<typeof canTransition>[1],
  data: Record<string, unknown> = {},
) {
  if (!user.staffProfileId) throw new Error('当前帐号没有安心专员档案');
  const task = await prisma.serviceTask.findFirst({
    where: { id: taskId, staffProfileId: user.staffProfileId, deletedAt: null },
    select: { id: true, status: true, householdId: true, isDemo: true, serviceType: true },
  });
  if (!task) throw new Error('任务不存在或不属于当前安心专员');
  if (!canTransition(task.status, to)) {
    throw new Error(`当前状态（${task.status}）不能变更为 ${to}`);
  }
  const updated = await prisma.serviceTask.update({
    where: { id: taskId },
    data: { status: to, ...data },
  });
  await auditAs(user, {
    action: 'UPDATE_TASK_STATUS',
    resource: 'ServiceTask',
    resourceId: taskId,
    before: { status: task.status },
    after: { status: to },
  });
  return { task, updated };
}

export async function acceptTask(user: CurrentUser, taskId: string) {
  assertCan(user, 'task.execute');
  const { updated } = await transition(user, taskId, 'ACCEPTED', { acceptedAt: new Date() });
  return updated;
}

export async function declineTask(user: CurrentUser, taskId: string, reason: string) {
  assertCan(user, 'task.execute');
  if (!reason.trim()) throw new Error('拒绝任务必须填写原因');
  const { updated } = await transition(user, taskId, 'DECLINED', { declineReason: reason });

  const { notifySupervisors } = await import('@/lib/notifications');
  await notifySupervisors({
    title: '有任务被安心专员拒绝，需要重新安排',
    body: reason,
    linkUrl: '/admin/service/dispatch',
    refType: 'task',
    refId: taskId,
  });

  return updated;
}

/**
 * 到达签到 —— 一次性定位。
 * 坐标可以为空（例如室内定位失败），不因此阻断服务开始。
 */
export async function checkInArrival(
  user: CurrentUser,
  taskId: string,
  coords?: { lat: number; lng: number; accuracy?: number },
) {
  assertCan(user, 'task.execute');
  const { updated } = await transition(user, taskId, 'ARRIVED', {
    arrivedAt: new Date(),
    checkinLat: coords?.lat,
    checkinLng: coords?.lng,
    checkinAccuracy: coords?.accuracy,
  });
  return updated;
}

/** 开始服务 */
export async function startService(user: CurrentUser, taskId: string) {
  assertCan(user, 'task.execute');
  const { task, updated } = await transition(user, taskId, 'IN_SERVICE', {
    startedAt: new Date(),
  });

  await prisma.timelineEvent.create({
    data: {
      householdId: task.householdId,
      title: `安心专员开始${SERVICE_TYPE_LABELS[task.serviceType]}`,
      refType: 'task',
      refId: taskId,
      requiredPermission: 'SERVICE_SCHEDULE',
      isDemo: task.isDemo,
    },
  });

  return updated;
}

export type SubmitVisitRecordInput = {
  taskId: string;
  spiritLevel: ObservationLevel;
  spiritNote?: string | null;
  dietLevel: ObservationLevel;
  dietNote?: string | null;
  sleepLevel: ObservationLevel;
  sleepNote?: string | null;
  activityLevel: ObservationLevel;
  activityNote?: string | null;
  completedItems: string[];
  observationText?: string | null;
  photoKeys?: string[];
  readings?: {
    type: ReadingType;
    source: ReadingSource;
    valuePrimary: number;
    valueSecondary?: number | null;
    unit: string;
    note?: string | null;
  }[];
};

/**
 * 提交服务记录并完成服务。
 * 提交后任务进入 PENDING_REVIEW，等后台审核；同时写入家庭时间线。
 */
export async function submitVisitRecord(user: CurrentUser, input: SubmitVisitRecordInput) {
  assertCan(user, 'visitRecord.submit');
  if (!user.staffProfileId) throw new Error('当前帐号没有安心专员档案');

  const task = await prisma.serviceTask.findFirst({
    where: { id: input.taskId, staffProfileId: user.staffProfileId, deletedAt: null },
    select: {
      id: true,
      status: true,
      householdId: true,
      elderId: true,
      isDemo: true,
      serviceType: true,
      record: { select: { id: true } },
    },
  });
  if (!task) throw new Error('任务不存在或不属于当前安心专员');
  if (task.record) throw new Error('该任务已提交过服务记录');
  if (!['IN_SERVICE', 'ARRIVED', 'PENDING_RECORD', 'NOT_COMPLETED'].includes(task.status)) {
    throw new Error('当前任务状态不允许提交服务记录');
  }

  // 家庭设定的提醒范围（用于标记「超出家庭设定的提醒范围」，不是医疗诊断）
  const sensitive = task.elderId
    ? await prisma.elderSensitiveInfo.findUnique({
        where: { elderId: task.elderId },
        select: { bpSystolicMax: true, bpDiastolicMax: true, glucoseMax: true },
      })
    : null;

  function outsideRange(r: NonNullable<SubmitVisitRecordInput['readings']>[number]): boolean {
    if (!sensitive) return false;
    if (r.type === 'BLOOD_PRESSURE') {
      if (sensitive.bpSystolicMax && r.valuePrimary > sensitive.bpSystolicMax) return true;
      if (
        sensitive.bpDiastolicMax &&
        r.valueSecondary != null &&
        r.valueSecondary > sensitive.bpDiastolicMax
      ) {
        return true;
      }
      return false;
    }
    if (r.type === 'BLOOD_GLUCOSE') {
      return !!sensitive.glucoseMax && r.valuePrimary > sensitive.glucoseMax;
    }
    return false;
  }

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.visitRecord.create({
      data: {
        taskId: task.id,
        householdId: task.householdId,
        elderId: task.elderId ?? undefined,
        staffProfileId: user.staffProfileId!,
        spiritLevel: input.spiritLevel,
        spiritNote: input.spiritNote ?? undefined,
        dietLevel: input.dietLevel,
        dietNote: input.dietNote ?? undefined,
        sleepLevel: input.sleepLevel,
        sleepNote: input.sleepNote ?? undefined,
        activityLevel: input.activityLevel,
        activityNote: input.activityNote ?? undefined,
        completedItems: input.completedItems,
        observationText: input.observationText ?? undefined,
        photoKeys: input.photoKeys ?? [],
        isDemo: task.isDemo,
      },
    });

    if (input.readings?.length && task.elderId) {
      await tx.healthReading.createMany({
        data: input.readings.map((r) => ({
          elderId: task.elderId!,
          visitRecordId: created.id,
          type: r.type,
          source: r.source,
          valuePrimary: r.valuePrimary,
          valueSecondary: r.valueSecondary ?? undefined,
          unit: r.unit,
          note: r.note ?? undefined,
          outsideFamilyRange: outsideRange(r),
          isDemo: task.isDemo,
        })),
      });
    }

    await tx.serviceTask.update({
      where: { id: task.id },
      data: { status: 'PENDING_REVIEW', endedAt: new Date() },
    });

    await tx.timelineEvent.create({
      data: {
        householdId: task.householdId,
        elderId: task.elderId ?? undefined,
        title: `本次${SERVICE_TYPE_LABELS[task.serviceType]}完成`,
        refType: 'visit_record',
        refId: created.id,
        requiredPermission: 'LIFE_RECORD',
        isDemo: task.isDemo,
      },
    });

    return created;
  });

  const { notifySupervisors } = await import('@/lib/notifications');
  await notifySupervisors({
    level: 'NORMAL',
    title: '有服务记录待审核',
    body: `${SERVICE_TYPE_LABELS[task.serviceType]} · 记录已提交`,
    linkUrl: `/admin/service/records/${record.id}`,
    refType: 'visit_record',
    refId: record.id,
    isDemo: task.isDemo,
  });

  await auditAs(user, {
    action: 'SUBMIT_VISIT_RECORD',
    resource: 'VisitRecord',
    resourceId: record.id,
    after: { taskId: task.id, completedItems: input.completedItems },
  });

  return record;
}

/** 服务未完成（例如无法进门）—— 仍然要留下记录，不能静默消失 */
export async function markNotCompleted(user: CurrentUser, taskId: string, reason: string) {
  assertCan(user, 'task.execute');
  if (!reason.trim()) throw new Error('请填写未能完成服务的原因');
  const { updated } = await transition(user, taskId, 'NOT_COMPLETED', {
    cancelReason: reason,
    endedAt: new Date(),
  });
  const { notifySupervisors } = await import('@/lib/notifications');
  await notifySupervisors({
    level: 'IMPORTANT',
    title: '有一次服务未能完成',
    body: reason,
    linkUrl: '/admin/service/today',
    refType: 'task',
    refId: taskId,
  });
  return updated;
}

/** 后台审核服务记录 */
export async function reviewVisitRecord(
  user: CurrentUser,
  recordId: string,
  note?: string,
) {
  assertCan(user, 'visitRecord.review');

  const record = await prisma.visitRecord.findUnique({
    where: { id: recordId },
    select: { id: true, taskId: true, reviewedAt: true },
  });
  if (!record) throw new Error('服务记录不存在');

  const [updated] = await prisma.$transaction([
    prisma.visitRecord.update({
      where: { id: recordId },
      data: { reviewedById: user.id, reviewedAt: new Date(), reviewNote: note },
    }),
    prisma.serviceTask.update({
      where: { id: record.taskId },
      data: { status: 'COMPLETED' },
    }),
  ]);

  await auditAs(user, {
    action: 'UPDATE_VISIT_RECORD',
    resource: 'VisitRecord',
    resourceId: recordId,
    after: { reviewed: true, note: note ?? null },
  });

  return updated;
}

/**
 * 更正服务记录 —— 只追加修订说明，不覆盖原始内容。
 * 原始记录是服务发生过的事实，不允许被「改成好看的样子」。
 */
export async function amendVisitRecord(user: CurrentUser, recordId: string, amendment: string) {
  assertCan(user, 'visitRecord.review');
  if (!amendment.trim()) throw new Error('请填写修订说明');

  const before = await prisma.visitRecord.findUnique({
    where: { id: recordId },
    select: { amendmentNote: true },
  });
  if (!before) throw new Error('服务记录不存在');

  const stamped = `[${new Date().toISOString()} ${user.name}] ${amendment}`;
  const updated = await prisma.visitRecord.update({
    where: { id: recordId },
    data: {
      amendmentNote: before.amendmentNote ? `${before.amendmentNote}\n${stamped}` : stamped,
    },
  });

  await auditAs(user, {
    action: 'UPDATE_VISIT_RECORD',
    resource: 'VisitRecord',
    resourceId: recordId,
    before: { amendmentNote: before.amendmentNote },
    after: { amendmentNote: updated.amendmentNote },
  });

  return updated;
}

/** 待审核的服务记录队列 */
export async function pendingReviewRecords(user: CurrentUser) {
  assertCan(user, 'visitRecord.review');
  const scope = taskScopeWhere(user);
  if (!scope) return [];

  return prisma.visitRecord.findMany({
    where: { reviewedAt: null, task: scope },
    include: {
      task: {
        select: {
          id: true,
          taskNo: true,
          serviceType: true,
          scheduledStart: true,
          household: { select: { id: true, name: true, householdCode: true } },
        },
      },
      elder: { select: { id: true, name: true } },
      staffProfile: { include: { user: { select: { name: true } } } },
    },
    orderBy: { submittedAt: 'asc' },
  });
}
