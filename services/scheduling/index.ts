import 'server-only';

import type { ServiceType, TaskStatus } from '@prisma/client';

import type { CurrentUser } from '@/lib/auth';
import { auditAs } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { nextTaskNo } from '@/lib/ids';
import { assertCan, householdScopeFilter, taskScopeWhere } from '@/lib/permissions';
import { SERVICE_TYPE_LABELS } from '@/lib/labels';
import { dayRange } from '@/lib/utils';
import { checkDispatchEligibility } from '@/services/staff';

/**
 * 排班与派单。
 *
 * 固定专员制度：正常情况优先安排固定家庭安心专员；
 * 需要临时更换时必须记录原因，并通知家庭（notifyHousehold）。
 */

export type CreateTaskInput = {
  householdId: string;
  elderId?: string | null;
  serviceType: ServiceType;
  scheduledStart: Date;
  estimatedMinutes?: number;
  taskItems?: string | null;
  staffProfileId?: string | null;
  isDemo?: boolean;
};

export async function createTask(user: CurrentUser, input: CreateTaskInput) {
  assertCan(user, 'task.assign');

  const filter = householdScopeFilter(user, input.householdId);
  if (!filter) throw new Error('家庭不存在或不在数据范围内');

  const household = await prisma.household.findFirst({
    where: filter,
    include: {
      elders: { where: { deletedAt: null }, select: { id: true, attentionNotes: true } },
      servicePlan: true,
    },
  });
  if (!household) throw new Error('家庭不存在或不在数据范围内');

  // 未指定则默认派给固定专员 —— 品牌承诺的默认行为
  let staffProfileId = input.staffProfileId ?? household.primarySpecialistId ?? null;
  let isBackupAssignment = false;

  if (staffProfileId) {
    const eligibility = await checkDispatchEligibility(
      staffProfileId,
      input.serviceType,
      input.scheduledStart,
    );
    if (!eligibility.ok) {
      // 固定专员不可用时，尝试备用专员，而不是随机找人
      if (
        staffProfileId === household.primarySpecialistId &&
        household.backupSpecialistId
      ) {
        const backup = await checkDispatchEligibility(
          household.backupSpecialistId,
          input.serviceType,
          input.scheduledStart,
        );
        if (backup.ok) {
          staffProfileId = household.backupSpecialistId;
          isBackupAssignment = true;
        } else {
          throw new Error(
            `固定与备用安心专员均不可派单。固定：${eligibility.reasons.join('；')}；备用：${backup.reasons.join('；')}`,
          );
        }
      } else {
        throw new Error(`该安心专员不可派单：${eligibility.reasons.join('；')}`);
      }
    } else if (
      household.primarySpecialistId &&
      staffProfileId === household.backupSpecialistId
    ) {
      isBackupAssignment = true;
    }
  }

  const elderId = input.elderId ?? household.elders[0]?.id ?? null;
  const attention =
    (elderId ? household.elders.find((e) => e.id === elderId)?.attentionNotes : null) ??
    household.serviceNotes ??
    null;

  const taskNo = await nextTaskNo(input.scheduledStart);

  const task = await prisma.serviceTask.create({
    data: {
      taskNo,
      householdId: household.id,
      elderId: elderId ?? undefined,
      staffProfileId: staffProfileId ?? undefined,
      serviceType: input.serviceType,
      status: staffProfileId ? 'ASSIGNED' : 'PENDING_ASSIGN',
      scheduledStart: input.scheduledStart,
      estimatedMinutes: input.estimatedMinutes ?? (input.serviceType === 'PHONE_CARE' ? 15 : 60),
      addressLine: household.addressLine,
      taskItems: input.taskItems ?? undefined,
      attentionSnapshot: attention ?? undefined,
      isBackupAssignment,
      isDemo: input.isDemo ?? household.isDemo,
    },
  });

  if (staffProfileId) {
    const staff = await prisma.staffProfile.findUnique({
      where: { id: staffProfileId },
      select: { userId: true, user: { select: { name: true } } },
    });
    if (staff) {
      const { notify } = await import('@/lib/notifications');
      await notify({
        userId: staff.userId,
        title: `新任务：${SERVICE_TYPE_LABELS[input.serviceType]}`,
        body: `${household.name} · ${input.scheduledStart.toLocaleString('zh-CN')}`,
        linkUrl: `/staff/tasks/${task.id}`,
        refType: 'task',
        refId: task.id,
        isDemo: task.isDemo,
      });
    }

    if (isBackupAssignment) {
      const { notifyHousehold } = await import('@/lib/notifications');
      await notifyHousehold(household.id, {
        level: 'IMPORTANT',
        title: '本次服务由备用家庭安心专员前往',
        body: '固定安心专员本次无法前往，已安排备用安心专员，服务内容不变。',
        linkUrl: '/family/service',
        refType: 'task',
        refId: task.id,
        isDemo: task.isDemo,
      });
    }
  }

  await prisma.timelineEvent.create({
    data: {
      householdId: household.id,
      elderId: elderId ?? undefined,
      title: `已安排${SERVICE_TYPE_LABELS[input.serviceType]}`,
      detail: input.scheduledStart.toLocaleString('zh-CN'),
      refType: 'task',
      refId: task.id,
      requiredPermission: 'SERVICE_SCHEDULE',
      isDemo: task.isDemo,
    },
  });

  await auditAs(user, {
    action: 'ASSIGN_TASK',
    resource: 'ServiceTask',
    resourceId: task.id,
    after: { taskNo, householdId: household.id, staffProfileId, serviceType: input.serviceType },
  });

  return task;
}

/** 派单 / 改派 */
export async function assignTask(
  user: CurrentUser,
  taskId: string,
  staffProfileId: string,
  reason?: string,
) {
  assertCan(user, 'task.assign');

  const scope = taskScopeWhere(user);
  if (!scope) throw new Error('不在数据范围内');
  const task = await prisma.serviceTask.findFirst({
    where: { AND: [scope, { id: taskId }] },
    include: { household: { select: { id: true, name: true, primarySpecialistId: true, backupSpecialistId: true, isDemo: true } } },
  });
  if (!task) throw new Error('任务不存在或不在数据范围内');

  if (['COMPLETED', 'CANCELLED'].includes(task.status)) {
    throw new Error('已结束的任务不可改派');
  }

  const eligibility = await checkDispatchEligibility(
    staffProfileId,
    task.serviceType,
    task.scheduledStart,
  );
  if (!eligibility.ok) {
    throw new Error(`该安心专员不可派单：${eligibility.reasons.join('；')}`);
  }

  const isReassign = task.staffProfileId && task.staffProfileId !== staffProfileId;
  if (isReassign && !reason?.trim()) {
    throw new Error('更换安心专员必须填写原因');
  }

  const isBackup = staffProfileId === task.household.backupSpecialistId;

  const updated = await prisma.serviceTask.update({
    where: { id: taskId },
    data: {
      staffProfileId,
      status: 'ASSIGNED',
      isBackupAssignment: isBackup,
      reassignReason: isReassign ? reason : task.reassignReason,
    },
  });

  const staff = await prisma.staffProfile.findUnique({
    where: { id: staffProfileId },
    select: { userId: true },
  });
  if (staff) {
    const { notify } = await import('@/lib/notifications');
    await notify({
      userId: staff.userId,
      title: `新任务：${SERVICE_TYPE_LABELS[task.serviceType]}`,
      body: `${task.household.name} · ${task.scheduledStart.toLocaleString('zh-CN')}`,
      linkUrl: `/staff/tasks/${taskId}`,
      refType: 'task',
      refId: taskId,
      isDemo: task.isDemo,
    });
  }

  if (isReassign) {
    const { notifyHousehold } = await import('@/lib/notifications');
    await notifyHousehold(task.household.id, {
      level: 'IMPORTANT',
      title: '本次服务的安心专员有调整',
      body: reason ?? undefined,
      linkUrl: '/family/service',
      refType: 'task',
      refId: taskId,
      isDemo: task.isDemo,
    });
  }

  await auditAs(user, {
    action: 'ASSIGN_TASK',
    resource: 'ServiceTask',
    resourceId: taskId,
    before: { staffProfileId: task.staffProfileId },
    after: { staffProfileId, reason: reason ?? null },
  });

  return updated;
}

/** 今日服务（后台「今天需要处理什么」的数据源） */
export async function todayTasks(user: CurrentUser, ref: Date = new Date()) {
  assertCan(user, 'task.read');
  const scope = taskScopeWhere(user);
  if (!scope) return [];
  const { start, end } = dayRange(ref);

  return prisma.serviceTask.findMany({
    where: { AND: [scope, { scheduledStart: { gte: start, lt: end } }] },
    include: {
      household: {
        select: {
          id: true,
          name: true,
          householdCode: true,
          district: { select: { name: true } },
        },
      },
      elder: { select: { id: true, name: true } },
      staffProfile: { include: { user: { select: { name: true } } } },
      record: { select: { id: true, submittedAt: true } },
    },
    orderBy: { scheduledStart: 'asc' },
  });
}

/** 专员工作台「今天」列表 */
export async function myTasksForDay(user: CurrentUser, ref: Date = new Date()) {
  if (!user.staffProfileId) return [];
  const { start, end } = dayRange(ref);
  return prisma.serviceTask.findMany({
    where: {
      staffProfileId: user.staffProfileId,
      deletedAt: null,
      scheduledStart: { gte: start, lt: end },
      status: { notIn: ['CANCELLED', 'RESCHEDULED'] },
    },
    include: {
      household: { select: { id: true, name: true } },
      elder: { select: { id: true, name: true } },
      record: { select: { id: true } },
    },
    orderBy: { scheduledStart: 'asc' },
  });
}

/** 专员工作台「任务」页：近期与待办 */
export async function myUpcomingTasks(user: CurrentUser, days = 14) {
  if (!user.staffProfileId) return [];
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + days);

  return prisma.serviceTask.findMany({
    where: {
      staffProfileId: user.staffProfileId,
      deletedAt: null,
      scheduledStart: { gte: from, lt: to },
      status: { notIn: ['CANCELLED', 'RESCHEDULED'] },
    },
    include: {
      household: { select: { id: true, name: true } },
      elder: { select: { id: true, name: true } },
      record: { select: { id: true } },
    },
    orderBy: { scheduledStart: 'asc' },
  });
}

/** 待派单队列 */
export async function pendingAssignTasks(user: CurrentUser) {
  assertCan(user, 'task.assign');
  const scope = taskScopeWhere(user);
  if (!scope) return [];
  return prisma.serviceTask.findMany({
    where: { AND: [scope, { status: 'PENDING_ASSIGN' }] },
    include: {
      household: {
        select: {
          id: true,
          name: true,
          householdCode: true,
          primarySpecialistId: true,
          backupSpecialistId: true,
          district: { select: { name: true } },
        },
      },
      elder: { select: { id: true, name: true } },
    },
    orderBy: { scheduledStart: 'asc' },
  });
}

export async function cancelTask(user: CurrentUser, taskId: string, reason: string) {
  assertCan(user, 'task.assign');
  const scope = taskScopeWhere(user);
  if (!scope) throw new Error('不在数据范围内');
  const task = await prisma.serviceTask.findFirst({ where: { AND: [scope, { id: taskId }] } });
  if (!task) throw new Error('任务不存在或不在数据范围内');
  if (!reason.trim()) throw new Error('取消任务必须填写原因');

  const updated = await prisma.serviceTask.update({
    where: { id: taskId },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
  });

  await auditAs(user, {
    action: 'UPDATE_TASK',
    resource: 'ServiceTask',
    resourceId: taskId,
    before: { status: task.status },
    after: { status: 'CANCELLED', reason },
  });

  return updated;
}

/** 状态机允许的下一步 —— 供 UI 决定按钮，也供 service 层校验 */
export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  PENDING_ASSIGN: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['ACCEPTED', 'DECLINED', 'CANCELLED', 'RESCHEDULED'],
  ACCEPTED: ['READY_TO_DEPART', 'ARRIVED', 'CANCELLED', 'RESCHEDULED'],
  READY_TO_DEPART: ['ARRIVED', 'NOT_COMPLETED', 'CANCELLED'],
  ARRIVED: ['IN_SERVICE', 'NOT_COMPLETED'],
  IN_SERVICE: ['PENDING_RECORD', 'NOT_COMPLETED'],
  PENDING_RECORD: ['PENDING_REVIEW'],
  PENDING_REVIEW: ['COMPLETED', 'PENDING_RECORD'],
  COMPLETED: [],
  CANCELLED: [],
  RESCHEDULED: [],
  DECLINED: ['ASSIGNED', 'CANCELLED'],
  NOT_COMPLETED: ['PENDING_REVIEW', 'RESCHEDULED'],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from]?.includes(to) ?? false;
}
