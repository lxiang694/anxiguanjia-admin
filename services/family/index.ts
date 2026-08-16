import 'server-only';

import type { PermissionType, ServiceType } from '@prisma/client';

import type { CurrentUser } from '@/lib/auth';
import { auditAs } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { grantedPermissionsByElder, grantedPermissionsFor } from '@/lib/permissions';
import { nextRequestNo } from '@/lib/ids';
import { currentWeekRange } from '@/lib/utils';

/**
 * 家庭端读取层。
 *
 * 这一层的唯一职责：确保「家庭成员只能看到本人有权查看的数据」。
 *
 * 每一个返回给家庭端的对象，都要先问两个问题：
 *   1. 这条数据属于我所在的家庭吗？（householdIds 归属校验）
 *   2. 我对这位长辈的这一类数据有有效授权吗？（Consent 校验）
 *
 * 只要有一个答案是否，数据就根本不会进入返回值 —— 而不是返回后由前端隐藏。
 */

/** 当前用户的家庭（家庭端只服务单一家庭上下文；多家庭时取第一个） */
export async function myHousehold(user: CurrentUser) {
  if (user.householdIds.length === 0) return null;
  return prisma.household.findFirst({
    where: { id: { in: user.householdIds }, deletedAt: null },
    include: {
      city: { select: { name: true } },
      district: { select: { name: true } },
      consultant: { select: { id: true, name: true, phone: true } },
      primarySpecialist: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
      backupSpecialist: { include: { user: { select: { name: true } } } },
      servicePlan: { include: { plan: { select: { name: true, tier: true } } } },
      subscriptions: {
        where: { status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE', 'PAUSED'] } },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      elders: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      members: {
        include: { user: { select: { id: true, name: true, phone: true } } },
      },
    },
  });
}

export type ElderOverview = {
  id: string;
  name: string;
  /** 我对这位长辈拥有的授权 */
  permissions: PermissionType[];
  lastServiceAt: Date | null;
  lastServiceType: ServiceType | null;
  nextServiceAt: Date | null;
  nextServiceType: ServiceType | null;
  weekVisitCount: number;
  weekPhoneCount: number;
  latestReport: {
    id: string;
    title: string;
    publishedAt: Date | null;
    firstReadAt: Date | null;
  } | null;
  /** 未关闭且我有权知道的异常事件数 */
  openIncidentCount: number;
};

/**
 * 家庭端首页「爸妈最近怎么样？」的数据。
 * 注意：授权不足时对应字段直接为 null / 0，不透露「有但你看不到」。
 */
export async function eldersOverview(user: CurrentUser): Promise<ElderOverview[]> {
  const household = await myHousehold(user);
  if (!household) return [];

  const permsByElder = await grantedPermissionsByElder(user, household.id);
  const { start, end } = currentWeekRange();
  const now = new Date();

  const results: ElderOverview[] = [];

  for (const elder of household.elders) {
    const perms = permsByElder.get(elder.id) ?? new Set<PermissionType>();
    const canSeeSchedule = perms.has('SERVICE_SCHEDULE');
    const canSeeReport = perms.has('ASSURANCE_REPORT');
    const canSeeIncident = perms.has('INCIDENT_ALERT');

    const [last, next, weekTasks, latestReport, openIncidents] = await Promise.all([
      canSeeSchedule
        ? prisma.serviceTask.findFirst({
            where: {
              householdId: household.id,
              elderId: elder.id,
              deletedAt: null,
              status: { in: ['COMPLETED', 'PENDING_REVIEW'] },
            },
            orderBy: { scheduledStart: 'desc' },
            select: { scheduledStart: true, endedAt: true, serviceType: true },
          })
        : null,
      canSeeSchedule
        ? prisma.serviceTask.findFirst({
            where: {
              householdId: household.id,
              elderId: elder.id,
              deletedAt: null,
              scheduledStart: { gt: now },
              status: { in: ['ASSIGNED', 'ACCEPTED', 'READY_TO_DEPART', 'PENDING_ASSIGN'] },
            },
            orderBy: { scheduledStart: 'asc' },
            select: { scheduledStart: true, serviceType: true },
          })
        : null,
      canSeeSchedule
        ? prisma.serviceTask.findMany({
            where: {
              householdId: household.id,
              elderId: elder.id,
              deletedAt: null,
              scheduledStart: { gte: start, lt: end },
              status: { in: ['COMPLETED', 'PENDING_REVIEW'] },
            },
            select: { serviceType: true },
          })
        : [],
      canSeeReport
        ? prisma.assuranceReport.findFirst({
            where: { householdId: household.id, elderId: elder.id, status: 'PUBLISHED' },
            orderBy: { periodStart: 'desc' },
            select: { id: true, title: true, publishedAt: true, firstReadAt: true },
          })
        : null,
      canSeeIncident
        ? prisma.incident.count({
            where: {
              householdId: household.id,
              elderId: elder.id,
              status: { in: ['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PENDING_FOLLOW_UP'] },
            },
          })
        : 0,
    ]);

    results.push({
      id: elder.id,
      name: elder.name,
      permissions: Array.from(perms),
      lastServiceAt: last?.endedAt ?? last?.scheduledStart ?? null,
      lastServiceType: last?.serviceType ?? null,
      nextServiceAt: next?.scheduledStart ?? null,
      nextServiceType: next?.serviceType ?? null,
      weekVisitCount: weekTasks.filter((t) => t.serviceType !== 'PHONE_CARE').length,
      weekPhoneCount: weekTasks.filter((t) => t.serviceType === 'PHONE_CARE').length,
      latestReport,
      openIncidentCount: openIncidents,
    });
  }

  return results;
}

/**
 * 家庭时间线。
 * 每条 TimelineEvent 都带 requiredPermission；这里按「我对该家庭任一长辈是否拥有该授权」过滤。
 */
export async function familyTimeline(user: CurrentUser, take = 60) {
  const household = await myHousehold(user);
  if (!household) return [];

  const permsByElder = await grantedPermissionsByElder(user, household.id);
  const allPerms = new Set<PermissionType>();
  for (const set of permsByElder.values()) {
    for (const p of set) allPerms.add(p);
  }

  const events = await prisma.timelineEvent.findMany({
    where: { householdId: household.id, internalOnly: false },
    orderBy: { occurredAt: 'desc' },
    take: take * 2,
  });

  return events.filter((e) => allPerms.has(e.requiredPermission)).slice(0, take);
}

/** 已发布且我有授权的安心报告列表 */
export async function myReports(user: CurrentUser) {
  const household = await myHousehold(user);
  if (!household) return [];

  const permsByElder = await grantedPermissionsByElder(user, household.id);
  const allowedElderIds = Array.from(permsByElder.entries())
    .filter(([, perms]) => perms.has('ASSURANCE_REPORT'))
    .map(([elderId]) => elderId);

  if (allowedElderIds.length === 0) return [];

  return prisma.assuranceReport.findMany({
    where: {
      householdId: household.id,
      status: 'PUBLISHED',
      elderId: { in: allowedElderIds },
    },
    include: { elder: { select: { id: true, name: true } } },
    orderBy: { periodStart: 'desc' },
    take: 50,
  });
}

/** 报告详情。授权不足直接返回 null（不区分「不存在」与「无权」）。 */
export async function myReport(user: CurrentUser, reportId: string) {
  const household = await myHousehold(user);
  if (!household) return null;

  const report = await prisma.assuranceReport.findFirst({
    where: { id: reportId, householdId: household.id, status: 'PUBLISHED' },
    include: {
      elder: { select: { id: true, name: true } },
      household: { select: { name: true } },
    },
  });
  if (!report || !report.elderId) return null;

  const perms = await grantedPermissionsFor(user, report.elderId);
  if (!perms.has('ASSURANCE_REPORT')) {
    await auditAs(user, {
      action: 'PERMISSION_DENIED',
      resource: 'AssuranceReport',
      resourceId: reportId,
      permissionNote: '缺少 ASSURANCE_REPORT 授权',
    });
    return null;
  }

  // 记录首次阅读时间，用于「报告是否真的被看到」这一质量指标
  if (!report.firstReadAt) {
    await prisma.assuranceReport.update({
      where: { id: reportId },
      data: { firstReadAt: new Date() },
    });
  }

  await auditAs(user, {
    action: 'VIEW_ASSURANCE_REPORT',
    resource: 'AssuranceReport',
    resourceId: reportId,
    permissionNote: '通过 ASSURANCE_REPORT 授权',
  });

  return report;
}

/** 家庭端服务安排：未来与历史 */
export async function myServices(user: CurrentUser) {
  const household = await myHousehold(user);
  if (!household) return { upcoming: [], history: [] };

  const permsByElder = await grantedPermissionsByElder(user, household.id);
  const allowedElderIds = Array.from(permsByElder.entries())
    .filter(([, perms]) => perms.has('SERVICE_SCHEDULE'))
    .map(([elderId]) => elderId);

  if (allowedElderIds.length === 0) return { upcoming: [], history: [] };

  const now = new Date();
  const commonSelect = {
    id: true,
    taskNo: true,
    serviceType: true,
    status: true,
    scheduledStart: true,
    estimatedMinutes: true,
    endedAt: true,
    isBackupAssignment: true,
    elder: { select: { id: true, name: true } },
    // 家庭可以知道是谁来服务，但看不到专员的内部评价与绩效
    staffProfile: {
      select: { id: true, staffLevel: true, user: { select: { name: true, avatarUrl: true } } },
    },
  } as const;

  const [upcoming, history] = await Promise.all([
    prisma.serviceTask.findMany({
      where: {
        householdId: household.id,
        elderId: { in: allowedElderIds },
        deletedAt: null,
        scheduledStart: { gte: now },
        status: { notIn: ['CANCELLED', 'RESCHEDULED'] },
      },
      select: commonSelect,
      orderBy: { scheduledStart: 'asc' },
      take: 30,
    }),
    prisma.serviceTask.findMany({
      where: {
        householdId: household.id,
        elderId: { in: allowedElderIds },
        deletedAt: null,
        scheduledStart: { lt: now },
      },
      select: commonSelect,
      orderBy: { scheduledStart: 'desc' },
      take: 30,
    }),
  ]);

  return { upcoming, history };
}

/** 生活记录（需 LIFE_RECORD 授权）—— 家庭端可看到的原始观察摘要 */
export async function myLifeRecords(user: CurrentUser, elderId: string, take = 20) {
  const perms = await grantedPermissionsFor(user, elderId);
  if (!perms.has('LIFE_RECORD')) return [];

  const rows = await prisma.visitRecord.findMany({
    where: { elderId, task: { deletedAt: null } },
    select: {
      id: true,
      submittedAt: true,
      spiritLevel: true,
      dietLevel: true,
      sleepLevel: true,
      activityLevel: true,
      completedItems: true,
      observationText: true,
      photoKeys: true,
      task: { select: { serviceType: true, scheduledStart: true } },
      staffProfile: { select: { user: { select: { name: true } } } },
    },
    orderBy: { submittedAt: 'desc' },
    take,
  });

  // 照片单独受 PHOTO 授权控制：没有该授权时，photoKeys 在离开本函数前就被清空
  const canSeePhotos = perms.has('PHOTO');
  const records = rows.map((r) => ({ ...r, photoKeys: canSeePhotos ? r.photoKeys : [] }));

  await auditAs(user, {
    action: 'VIEW_VISIT_RECORD',
    resource: 'Elder',
    resourceId: elderId,
    permissionNote: `通过 LIFE_RECORD 授权${canSeePhotos ? ' + PHOTO' : '（不含照片）'}`,
  });

  return records;
}

/** 家庭端提交改期 / 取消 / 额外服务申请 */
export async function submitChangeRequest(
  user: CurrentUser,
  input: {
    type: 'RESCHEDULE' | 'CANCEL' | 'EXTRA_SERVICE';
    taskId?: string | null;
    preferredAt?: Date | null;
    serviceType?: ServiceType | null;
    reason?: string | null;
  },
) {
  const household = await myHousehold(user);
  if (!household) throw new Error('未找到所属家庭');

  // 改期 / 取消必须针对本家庭的任务
  if (input.taskId) {
    const task = await prisma.serviceTask.findFirst({
      where: { id: input.taskId, householdId: household.id, deletedAt: null },
      select: { id: true },
    });
    if (!task) throw new Error('任务不存在');
  } else if (input.type !== 'EXTRA_SERVICE') {
    throw new Error('请选择要处理的服务');
  }

  // 额外服务：只允许申请服务目录里明确开放给家庭自助申请的类型。
  // 判断放在服务层而不是前端，避免绕过表单直接提交未开放的类型。
  if (input.type === 'EXTRA_SERVICE') {
    if (!input.serviceType) throw new Error('请选择需要哪一类服务');
    const item = await prisma.serviceCatalogItem.findUnique({
      where: { serviceType: input.serviceType },
      select: { familyRequestable: true, isActive: true, displayName: true },
    });
    if (!item || !item.isActive || !item.familyRequestable) {
      throw new Error('这一类服务目前不开放家庭自行申请，请联系客服');
    }
  }

  const request = await prisma.serviceChangeRequest.create({
    data: {
      requestNo: await nextRequestNo(),
      taskId: input.taskId ?? undefined,
      requestedById: user.id,
      type: input.type,
      preferredAt: input.preferredAt ?? undefined,
      serviceType: input.serviceType ?? undefined,
      reason: input.reason ?? undefined,
      isDemo: household.isDemo,
    },
  });

  const { notifySupervisors } = await import('@/lib/notifications');
  await notifySupervisors({
    title: `家庭提交了${input.type === 'RESCHEDULE' ? '改期' : input.type === 'CANCEL' ? '取消' : '额外服务'}申请`,
    body: `${household.name} · ${request.requestNo}`,
    linkUrl: '/admin/service/requests',
    refType: 'change_request',
    refId: request.id,
    isDemo: household.isDemo,
  });

  return request;
}

/** 家庭端提交服务反馈 / 投诉 */
export async function submitFeedback(
  user: CurrentUser,
  input: {
    category:
      | 'SERVICE_ATTITUDE'
      | 'TIMING'
      | 'SERVICE_CONTENT'
      | 'SAFETY'
      | 'PAYMENT'
      | 'CONSULTATION'
      | 'OTHER';
    subject: string;
    content: string;
    isComplaint?: boolean;
  },
) {
  const household = await myHousehold(user);
  if (!household) throw new Error('未找到所属家庭');
  if (!input.subject.trim() || !input.content.trim()) throw new Error('请填写标题与内容');

  const { nextCaseNo } = await import('@/lib/ids');
  const created = await prisma.feedbackCase.create({
    data: {
      caseNo: await nextCaseNo(),
      householdId: household.id,
      submittedById: user.id,
      category: input.category,
      subject: input.subject,
      content: input.content,
      isComplaint: input.isComplaint ?? false,
      isDemo: household.isDemo,
    },
  });

  const { notifySupervisors } = await import('@/lib/notifications');
  await notifySupervisors({
    level: input.isComplaint ? 'IMPORTANT' : 'NORMAL',
    title: input.isComplaint ? '收到一条家庭投诉' : '收到一条家庭反馈',
    body: input.subject,
    linkUrl: '/admin/support/feedback',
    refType: 'feedback',
    refId: created.id,
    isDemo: household.isDemo,
  });

  return created;
}

/** 家庭端授权管理视图 */
export async function myConsentView(user: CurrentUser) {
  const household = await myHousehold(user);
  if (!household) return null;

  const { consentMatrixForHousehold } = await import('@/services/consent');
  const matrix = await consentMatrixForHousehold(household.id);

  return { household, ...matrix, currentUserId: user.id };
}

/** 对家庭展示的安心专员卡片 */
export async function myCareTeam(user: CurrentUser) {
  const household = await myHousehold(user);
  if (!household) return null;

  const { specialistCardForFamily } = await import('@/services/staff');

  const primary = household.primarySpecialistId
    ? await specialistCardForFamily(household.primarySpecialistId, household.id)
    : null;
  const backup = household.backupSpecialistId
    ? await specialistCardForFamily(household.backupSpecialistId, household.id)
    : null;

  return {
    consultant: household.consultant,
    primary,
    backup,
  };
}

/**
 * 家庭对安心报告评分。
 *
 * 只允许对「本人所属家庭 + 已发布」的报告评分 —— 归属校验放在服务层，
 * 不依赖前端传什么 reportId。评分只进服务质量指标，不影响任何数据访问权限。
 */
export async function rateReport(
  user: CurrentUser,
  input: { reportId: string; rating: number; comment?: string | null },
) {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error('请选择 1 到 5 之间的评分');
  }

  const report = await prisma.assuranceReport.findFirst({
    where: {
      id: input.reportId,
      status: 'PUBLISHED',
      householdId: { in: user.householdIds },
    },
    select: { id: true },
  });
  if (!report) throw new Error('未找到这份报告');

  return prisma.assuranceReport.update({
    where: { id: report.id },
    data: {
      familyRating: input.rating,
      familyComment: input.comment?.trim() || undefined,
    },
  });
}
