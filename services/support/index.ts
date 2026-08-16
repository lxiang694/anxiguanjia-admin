import 'server-only';

import type { FeedbackCategory, FeedbackStatus, Prisma } from '@prisma/client';

import type { CurrentUser } from '@/lib/auth';
import { auditAs } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { assertCan, householdScopeWhere, taskScopeWhere } from '@/lib/permissions';
import { SERVICE_TYPE_LABELS } from '@/lib/labels';

/**
 * 客服工单与家庭申请的处理。
 *
 * 这两块之前只有列表、没有动作 —— 也就是「家庭发起了，系统没接住」。
 * 现在补上完整闭环：
 *   反馈：指派 → 处理中 → 等待家庭确认 → 已解决 → 关闭
 *   申请：改期直接改任务时间；额外服务直接建任务；取消直接取消任务。
 * 每一步都通知家庭，并写审计日志。
 */

/* ============================== 家庭反馈 / 投诉 ============================== */

export type FeedbackFilters = {
  status?: FeedbackStatus | 'OPEN' | 'ALL';
  /** complaint = 只看投诉；consultation = 只看咨询；feedback = 只看一般反馈 */
  kind?: 'complaint' | 'consultation' | 'feedback' | 'all';
  category?: FeedbackCategory;
};

export async function listFeedback(user: CurrentUser, filters: FeedbackFilters = {}) {
  assertCan(user, 'feedback.read');
  const scope = householdScopeWhere(user);
  if (!scope) return [];

  const and: Prisma.FeedbackCaseWhereInput[] = [{ household: scope }];

  if (filters.status === 'OPEN') {
    and.push({ status: { in: ['NEW', 'IN_PROGRESS', 'AWAITING_FAMILY'] } });
  } else if (filters.status && filters.status !== 'ALL') {
    and.push({ status: filters.status });
  }

  if (filters.kind === 'complaint') and.push({ isComplaint: true });
  if (filters.kind === 'feedback') and.push({ isComplaint: false, category: { not: 'CONSULTATION' } });
  if (filters.kind === 'consultation') and.push({ category: 'CONSULTATION' });
  if (filters.category) and.push({ category: filters.category });

  return prisma.feedbackCase.findMany({
    where: { AND: and },
    include: {
      household: { select: { id: true, name: true, householdCode: true } },
      submittedBy: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });
}

export async function getFeedback(user: CurrentUser, caseId: string) {
  assertCan(user, 'feedback.read');
  const scope = householdScopeWhere(user);
  if (!scope) return null;

  return prisma.feedbackCase.findFirst({
    where: { id: caseId, household: scope },
    include: {
      household: {
        select: {
          id: true,
          name: true,
          householdCode: true,
          primarySpecialist: { include: { user: { select: { name: true } } } },
        },
      },
      submittedBy: { select: { id: true, name: true, phone: true } },
      assignee: { select: { id: true, name: true } },
    },
  });
}

const FEEDBACK_ACTION_TEXT: Record<FeedbackStatus, string> = {
  NEW: '重新打开',
  IN_PROGRESS: '开始处理',
  AWAITING_FAMILY: '转为等待家庭确认',
  RESOLVED: '标记为已解决',
  CLOSED: '关闭工单',
};

export type HandleFeedbackInput = {
  caseId: string;
  status: FeedbackStatus;
  resolution?: string | null;
  /** 是否把自己设为负责人 */
  takeOwnership?: boolean;
  assigneeId?: string | null;
  /** 是否同时通知家庭 */
  notifyFamily?: boolean;
};

export async function handleFeedback(user: CurrentUser, input: HandleFeedbackInput) {
  assertCan(user, 'feedback.handle');

  const scope = householdScopeWhere(user);
  if (!scope) throw new Error('不在数据范围内');
  const item = await prisma.feedbackCase.findFirst({
    where: { id: input.caseId, household: scope },
    select: {
      id: true,
      caseNo: true,
      status: true,
      assigneeId: true,
      householdId: true,
      isComplaint: true,
      isDemo: true,
      submittedById: true,
      subject: true,
    },
  });
  if (!item) throw new Error('工单不存在或不在数据范围内');

  // 解决与关闭必须写处理结果 —— 与事件中心保持同一条纪律
  if (
    (input.status === 'RESOLVED' || input.status === 'CLOSED') &&
    !input.resolution?.trim()
  ) {
    throw new Error('标记为已解决或关闭时，必须填写处理结果');
  }

  const updated = await prisma.feedbackCase.update({
    where: { id: input.caseId },
    data: {
      status: input.status,
      assigneeId:
        input.assigneeId ?? (input.takeOwnership || !item.assigneeId ? user.id : undefined),
      resolution: input.resolution ?? undefined,
      resolvedAt:
        input.status === 'RESOLVED' || input.status === 'CLOSED' ? new Date() : undefined,
    },
  });

  if (input.notifyFamily && item.submittedById) {
    const { notify } = await import('@/lib/notifications');
    await notify({
      userId: item.submittedById,
      level: item.isComplaint ? 'IMPORTANT' : 'NORMAL',
      title:
        input.status === 'RESOLVED' || input.status === 'CLOSED'
          ? '您的反馈已处理完成'
          : '您的反馈有新进展',
      body: input.resolution ?? `工单 ${item.caseNo}：${FEEDBACK_ACTION_TEXT[input.status]}`,
      linkUrl: '/family/me',
      refType: 'feedback',
      refId: item.id,
      isDemo: item.isDemo,
    });
  }

  await auditAs(user, {
    action: 'HANDLE_FEEDBACK',
    resource: 'FeedbackCase',
    resourceId: input.caseId,
    before: { status: item.status, assigneeId: item.assigneeId },
    after: {
      status: input.status,
      resolution: input.resolution ?? null,
      notifiedFamily: !!input.notifyFamily,
    },
  });

  return updated;
}

/* ============================== 家庭申请 ============================== */

export async function listChangeRequests(
  user: CurrentUser,
  filters: { status?: 'SUBMITTED' | 'ALL' } = {},
) {
  assertCan(user, 'task.read');

  return prisma.serviceChangeRequest.findMany({
    where: filters.status === 'ALL' ? {} : { status: 'SUBMITTED' },
    include: {
      requestedBy: {
        select: {
          id: true,
          name: true,
          phone: true,
          familyMembers: {
            select: { household: { select: { id: true, name: true, householdCode: true } } },
          },
        },
      },
      task: {
        select: {
          id: true,
          taskNo: true,
          serviceType: true,
          scheduledStart: true,
          status: true,
          household: { select: { id: true, name: true } },
          elder: { select: { id: true, name: true } },
          staffProfile: { select: { id: true, user: { select: { name: true } } } },
        },
      },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });
}

export type DecideRequestInput = {
  requestId: string;
  approve: boolean;
  note?: string | null;
  /** 批准改期时的最终时间；留空则用家庭希望的时间 */
  finalAt?: Date | null;
  /** 批准额外服务时指派的专员；留空则默认派给固定专员 */
  staffProfileId?: string | null;
};

/**
 * 审批家庭申请。
 *
 * 批准时**真的会动任务**，而不是只把申请标成已同意：
 *  - 改期 → 修改任务时间（并保留原时间到审批备注）
 *  - 取消 → 取消任务并写原因
 *  - 额外服务 → 直接建一条新任务（走完整的派单资格校验）
 */
export async function decideChangeRequest(user: CurrentUser, input: DecideRequestInput) {
  assertCan(user, 'task.assign');

  const req = await prisma.serviceChangeRequest.findUnique({
    where: { id: input.requestId },
    include: {
      task: { select: { id: true, taskNo: true, scheduledStart: true, status: true, householdId: true } },
      requestedBy: {
        select: {
          id: true,
          name: true,
          familyMembers: { select: { householdId: true } },
        },
      },
    },
  });
  if (!req) throw new Error('申请不存在');
  if (req.status !== 'SUBMITTED') throw new Error('这条申请已经处理过了');

  const householdId =
    req.task?.householdId ?? req.requestedBy.familyMembers[0]?.householdId ?? null;
  if (!householdId) throw new Error('无法确定该申请所属家庭');

  // 数据范围校验：不能审批不属于自己范围的家庭
  const scope = taskScopeWhere(user);
  if (!scope) throw new Error('不在数据范围内');
  const inScope = await prisma.household.findFirst({
    where: { id: householdId, ...(householdScopeWhere(user) ?? {}) },
    select: { id: true, isDemo: true, primarySpecialistId: true },
  });
  if (!inScope) throw new Error('该家庭不在您的数据范围内');

  let effectNote = '';

  if (!input.approve) {
    if (!input.note?.trim()) throw new Error('未通过时必须填写原因，家庭会看到这段说明');
  } else {
    if (req.type === 'RESCHEDULE') {
      if (!req.task) throw new Error('改期申请缺少关联任务');
      const target = input.finalAt ?? req.preferredAt;
      if (!target) throw new Error('请填写改期后的时间');
      if (['COMPLETED', 'CANCELLED'].includes(req.task.status)) {
        throw new Error('该任务已结束，无法改期');
      }
      const original = req.task.scheduledStart;
      await prisma.serviceTask.update({
        where: { id: req.task.id },
        data: {
          scheduledStart: target,
          // 改期后回到已派单状态，让专员重新确认
          status: 'ASSIGNED',
          acceptedAt: null,
        },
      });
      effectNote = `任务 ${req.task.taskNo} 已从 ${original.toLocaleString('zh-CN')} 改到 ${target.toLocaleString('zh-CN')}`;
    }

    if (req.type === 'CANCEL') {
      if (!req.task) throw new Error('取消申请缺少关联任务');
      const { cancelTask } = await import('@/services/scheduling');
      await cancelTask(
        user,
        req.task.id,
        `家庭申请取消（${req.requestNo}）${input.note ? `：${input.note}` : ''}`,
      );
      effectNote = `任务 ${req.task.taskNo} 已取消`;
    }

    if (req.type === 'EXTRA_SERVICE') {
      if (!req.serviceType) throw new Error('额外服务申请缺少服务类型');
      const when = input.finalAt ?? req.preferredAt;
      if (!when) throw new Error('请填写额外服务的时间');
      const { createTask } = await import('@/services/scheduling');
      const { defaultMinutesFor } = await import('@/services/settings');
      const created = await createTask(user, {
        householdId,
        serviceType: req.serviceType,
        scheduledStart: when,
        estimatedMinutes: await defaultMinutesFor(req.serviceType),
        staffProfileId: input.staffProfileId ?? null,
        taskItems: `家庭申请的额外服务（${req.requestNo}）：${req.reason ?? SERVICE_TYPE_LABELS[req.serviceType]}`,
      });
      effectNote = `已新建任务 ${created.taskNo}`;
    }
  }

  const updated = await prisma.serviceChangeRequest.update({
    where: { id: input.requestId },
    data: {
      status: input.approve ? 'APPROVED' : 'DECLINED',
      handledAt: new Date(),
      handledNote: [input.note, effectNote].filter(Boolean).join('｜') || undefined,
    },
  });

  const { notify } = await import('@/lib/notifications');
  await notify({
    userId: req.requestedById,
    level: 'IMPORTANT',
    title: input.approve ? '您的申请已安排好了' : '您的申请暂时无法安排',
    body: [input.note, effectNote].filter(Boolean).join('\n') || undefined,
    linkUrl: '/family/service',
    refType: 'change_request',
    refId: req.id,
    isDemo: inScope.isDemo,
  });

  await prisma.timelineEvent.create({
    data: {
      householdId,
      title: input.approve ? '家庭申请已处理' : '家庭申请未通过',
      detail: [input.note, effectNote].filter(Boolean).join('｜') || undefined,
      refType: 'change_request',
      refId: req.id,
      requiredPermission: 'SERVICE_SCHEDULE',
      isDemo: inScope.isDemo,
    },
  });

  await auditAs(user, {
    action: 'DECIDE_CHANGE_REQUEST',
    resource: 'ServiceChangeRequest',
    resourceId: input.requestId,
    before: { status: 'SUBMITTED' },
    after: { status: updated.status, effect: effectNote || null },
  });

  return updated;
}
