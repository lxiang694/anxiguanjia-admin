import 'server-only';

import type { CurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { can, householdScopeWhere, taskScopeWhere } from '@/lib/permissions';
import { dayRange, monthRange } from '@/lib/utils';
import { monthlyRevenue, renewalDueSubscriptions, revenueMetrics } from '@/services/subscription';

/**
 * 运营总览。
 *
 * 首屏刻意先回答「今天需要处理什么」，而不是先给漂亮图表。
 * 所有统计都在数据范围（scope）内计算 —— 城市负责人看到的数字只属于自己城市。
 */

export async function todayServiceStats(user: CurrentUser) {
  const scope = taskScopeWhere(user);
  if (!scope) {
    return { total: 0, completed: 0, inService: 0, notStarted: 0, abnormal: 0, pendingRecord: 0 };
  }
  const { start, end } = dayRange();

  const rows = await prisma.serviceTask.groupBy({
    by: ['status'],
    where: { AND: [scope, { scheduledStart: { gte: start, lt: end } }] },
    _count: { _all: true },
  });

  const byStatus = new Map(rows.map((r) => [r.status, r._count._all]));
  const get = (...keys: Parameters<typeof byStatus.get>[0][]) =>
    keys.reduce((sum, k) => sum + (byStatus.get(k) ?? 0), 0);

  return {
    total: rows.reduce((s, r) => s + r._count._all, 0),
    completed: get('COMPLETED'),
    inService: get('ARRIVED', 'IN_SERVICE'),
    notStarted: get('PENDING_ASSIGN', 'ASSIGNED', 'ACCEPTED', 'READY_TO_DEPART'),
    pendingRecord: get('PENDING_RECORD', 'PENDING_REVIEW'),
    abnormal: get('NOT_COMPLETED', 'DECLINED'),
  };
}

export async function householdStats(user: CurrentUser) {
  const scope = householdScopeWhere(user);
  if (!scope) {
    return { activeMember: 0, trial: 0, renewalDue: 0, paused: 0, lead: 0, newThisMonth: 0, terminated: 0 };
  }

  const { start, end } = monthRange();

  const [rows, newThisMonth] = await Promise.all([
    prisma.household.groupBy({
      by: ['status'],
      where: scope,
      _count: { _all: true },
    }),
    prisma.household.count({
      where: { AND: [scope, { createdAt: { gte: start, lt: end } }] },
    }),
  ]);

  const byStatus = new Map(rows.map((r) => [r.status, r._count._all]));
  return {
    activeMember: byStatus.get('ACTIVE_MEMBER') ?? 0,
    trial: byStatus.get('TRIAL') ?? 0,
    renewalDue: byStatus.get('RENEWAL_DUE') ?? 0,
    paused: byStatus.get('PAUSED') ?? 0,
    lead: byStatus.get('LEAD') ?? 0,
    terminated: byStatus.get('TERMINATED') ?? 0,
    newThisMonth,
  };
}

/** 服务质量指标：准时率 / 完成率 / 报告准时率 / 取消率 */
export async function qualityMetrics(user: CurrentUser, days = 30) {
  const scope = taskScopeWhere(user);
  if (!scope) return null;

  const from = new Date();
  from.setDate(from.getDate() - days);

  const tasks = await prisma.serviceTask.findMany({
    where: { AND: [scope, { scheduledStart: { gte: from } }] },
    select: {
      status: true,
      scheduledStart: true,
      arrivedAt: true,
      endedAt: true,
      record: { select: { submittedAt: true } },
    },
  });

  const finished = tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'PENDING_REVIEW');
  const cancelled = tasks.filter((t) => t.status === 'CANCELLED');
  const scheduled = tasks.filter((t) => !['PENDING_ASSIGN'].includes(t.status));

  // 准时 = 到达时间不晚于预约时间 15 分钟
  const arrived = finished.filter((t) => t.arrivedAt);
  const onTime = arrived.filter(
    (t) => t.arrivedAt!.getTime() - t.scheduledStart.getTime() <= 15 * 60 * 1000,
  );

  // 记录及时 = 服务结束后 24 小时内提交
  const withRecord = finished.filter((t) => t.record && t.endedAt);
  const recordTimely = withRecord.filter(
    (t) => t.record!.submittedAt.getTime() - t.endedAt!.getTime() <= 24 * 3600 * 1000,
  );

  const reportsTotal = await prisma.assuranceReport.count({
    where: { periodStart: { gte: from }, household: (householdScopeWhere(user) ?? undefined) },
  });
  const reportsPublished = await prisma.assuranceReport.count({
    where: {
      periodStart: { gte: from },
      status: 'PUBLISHED',
      household: (householdScopeWhere(user) ?? undefined),
    },
  });

  const rate = (num: number, den: number) => (den > 0 ? num / den : null);

  return {
    onTimeRate: rate(onTime.length, arrived.length),
    completionRate: rate(finished.length, scheduled.length),
    recordTimelyRate: rate(recordTimely.length, withRecord.length),
    reportOnTimeRate: rate(reportsPublished, reportsTotal),
    cancelRate: rate(cancelled.length, tasks.length),
    sampleSize: tasks.length,
  };
}

/** 事件指标：数量与平均处理时长 */
export async function incidentMetrics(user: CurrentUser, days = 30) {
  const hh = householdScopeWhere(user);
  if (!hh) return null;

  const from = new Date();
  from.setDate(from.getDate() - days);

  const incidents = await prisma.incident.findMany({
    where: { household: hh, occurredAt: { gte: from } },
    select: { status: true, occurredAt: true, closedAt: true },
  });

  const closed = incidents.filter((i) => i.closedAt);
  const avgMinutes =
    closed.length > 0
      ? Math.round(
          closed.reduce((s, i) => s + (i.closedAt!.getTime() - i.occurredAt.getTime()), 0) /
            closed.length /
            60000,
        )
      : null;

  return {
    total: incidents.length,
    open: incidents.filter((i) => i.status !== 'CLOSED').length,
    avgHandlingMinutes: avgMinutes,
  };
}

/** 人效：每名可排班专员的家庭数与本周任务数（不做单量排行榜） */
export async function staffEfficiency(user: CurrentUser) {
  const scope = householdScopeWhere(user);
  if (!scope) return null;

  const activeStaff = await prisma.staffProfile.count({
    where: { serviceStatus: 'ACTIVE', deletedAt: null },
  });
  const activeHouseholds = await prisma.household.count({
    where: { AND: [scope, { status: { in: ['ACTIVE_MEMBER', 'TRIAL', 'RENEWAL_DUE'] } }] },
  });

  const from = new Date();
  from.setDate(from.getDate() - 7);
  const weekTasks = await prisma.serviceTask.count({
    where: { household: scope, scheduledStart: { gte: from }, deletedAt: null },
  });

  return {
    activeStaff,
    householdsPerStaff: activeStaff > 0 ? Number((activeHouseholds / activeStaff).toFixed(1)) : null,
    tasksPerStaffPerWeek: activeStaff > 0 ? Number((weekTasks / activeStaff).toFixed(1)) : null,
  };
}

/** 待办计数：Dashboard 上的红点来源 */
export async function pendingCounts(user: CurrentUser) {
  const taskScope = taskScopeWhere(user);
  const hhScope = householdScopeWhere(user);

  const [pendingAssign, pendingRecordReview, pendingReports, openIncidents, openFeedback, openRequests] =
    await Promise.all([
      taskScope
        ? prisma.serviceTask.count({ where: { AND: [taskScope, { status: 'PENDING_ASSIGN' }] } })
        : 0,
      taskScope
        ? prisma.visitRecord.count({ where: { reviewedAt: null, task: taskScope } })
        : 0,
      hhScope
        ? prisma.assuranceReport.count({
            where: { household: hhScope, status: { in: ['DRAFT', 'PENDING_REVIEW', 'REJECTED'] } },
          })
        : 0,
      hhScope
        ? prisma.incident.count({
            where: {
              household: hhScope,
              status: { in: ['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PENDING_FOLLOW_UP'] },
            },
          })
        : 0,
      hhScope
        ? prisma.feedbackCase.count({
            where: { household: hhScope, status: { in: ['NEW', 'IN_PROGRESS', 'AWAITING_FAMILY'] } },
          })
        : 0,
      prisma.serviceChangeRequest.count({ where: { status: 'SUBMITTED' } }),
    ]);

  const [pendingExams, pendingInvoices] = await Promise.all([
    can(user, 'staff.training.manage')
      ? prisma.trainingRecord.count({
          where: {
            course: { requiresExam: true, isActive: true },
            status: { in: ['IN_PROGRESS', 'PENDING_EXAM', 'NEEDS_RETRAIN'] },
          },
        })
      : 0,
    can(user, 'invoice.manage')
      ? prisma.order.count({ where: { status: 'PAID', amount: { gt: 0 }, invoiceStatus: 'REQUESTED' } })
      : 0,
  ]);

  return {
    pendingAssign,
    pendingRecordReview,
    pendingReports,
    openIncidents,
    openFeedback,
    openRequests,
    pendingExams,
    pendingInvoices,
  };
}

/** Dashboard 一次性聚合（含权限裁剪：无财务权限就不返回收入） */
export async function dashboardSummary(user: CurrentUser) {
  const [today, households, pending, quality, incidents, efficiency] = await Promise.all([
    todayServiceStats(user),
    householdStats(user),
    pendingCounts(user),
    qualityMetrics(user),
    incidentMetrics(user),
    staffEfficiency(user),
  ]);

  const showFinance = can(user, 'dashboard.finance') || can(user, 'order.read');
  const [revenue, metrics, renewals] = showFinance
    ? await Promise.all([monthlyRevenue(), revenueMetrics(), renewalDueSubscriptions(30)])
    : [null, null, []];

  return {
    today,
    households,
    pending,
    quality,
    incidents,
    efficiency,
    finance: showFinance ? { revenue, metrics, renewalCount: renewals.length } : null,
  };
}

/* ==========================================================================
 * 需求里点名、之前缺的三个指标：续费率 / 家庭满意度 / 利用率
 * ======================================================================== */

/**
 * 续费率。
 *
 * 定义（写清楚很重要，否则同一个数字每人一种理解）：
 *   分母 = 统计区间内本应续费的订阅数（周期结束日落在区间内）
 *   分子 = 其中在区间内确实产生了 RENEWAL 订单的订阅数
 *
 * 样本量太小时返回 null 而不是 0% —— 一个家庭没续费就显示 0% 会误导决策。
 */
export async function renewalRate(user: CurrentUser, days = 90) {
  const scope = householdScopeWhere(user);
  if (!scope) return null;

  const from = new Date();
  from.setDate(from.getDate() - days);
  const now = new Date();

  const dueSubs = await prisma.subscription.findMany({
    where: {
      household: scope,
      currentPeriodEnd: { gte: from, lte: now },
    },
    select: { id: true, householdId: true },
  });

  if (dueSubs.length === 0) {
    return { rate: null, due: 0, renewed: 0, churned: 0, note: '统计区间内没有到期的订阅' };
  }

  const renewals = await prisma.order.groupBy({
    by: ['subscriptionId'],
    where: {
      type: 'RENEWAL',
      status: 'PAID',
      paidAt: { gte: from },
      subscriptionId: { in: dueSubs.map((s) => s.id) },
    },
  });

  const renewedIds = new Set(renewals.map((r) => r.subscriptionId));
  const renewed = dueSubs.filter((s) => renewedIds.has(s.id)).length;

  return {
    rate: renewed / dueSubs.length,
    due: dueSubs.length,
    renewed,
    churned: dueSubs.length - renewed,
    note: dueSubs.length < 5 ? '样本量较小，比率仅供参考' : null,
  };
}

/**
 * 家庭满意度。
 * 取家庭对安心报告的评分（1-5）。这是目前系统里唯一真实存在的家庭主动评分，
 * 不额外编造「满意度」数字。
 */
export async function familySatisfaction(user: CurrentUser, days = 90) {
  const scope = householdScopeWhere(user);
  if (!scope) return null;

  const from = new Date();
  from.setDate(from.getDate() - days);

  const rated = await prisma.assuranceReport.findMany({
    where: { household: scope, familyRating: { not: null }, publishedAt: { gte: from } },
    select: { familyRating: true },
  });

  const published = await prisma.assuranceReport.count({
    where: { household: scope, status: 'PUBLISHED', publishedAt: { gte: from } },
  });

  const read = await prisma.assuranceReport.count({
    where: {
      household: scope,
      status: 'PUBLISHED',
      publishedAt: { gte: from },
      firstReadAt: { not: null },
    },
  });

  const scores = rated.map((r) => r.familyRating!).filter((n) => n >= 1 && n <= 5);
  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  return {
    avgScore: avg,
    sampleSize: scores.length,
    // 报告已读率是「家庭是否真的在看」的代理指标，比满意度更早暴露问题
    readRate: published > 0 ? read / published : null,
    publishedCount: published,
    note: scores.length < 5 ? '评分样本较少，建议结合已读率一起看' : null,
  };
}

/**
 * 利用率。
 *
 * 两个角度：
 *  1. 权益利用率 —— 家庭买的次数有没有真的用掉（用不掉说明服务没跟上，续费会出问题）
 *  2. 专员时间利用率 —— 可排班专员的服务时长占其名义可服务时长的比例
 */
export async function utilizationMetrics(user: CurrentUser) {
  const scope = householdScopeWhere(user);
  if (!scope) return null;

  const activeSubs = await prisma.subscription.findMany({
    where: { household: scope, status: { in: ['ACTIVE', 'TRIAL'] } },
    include: { plan: { select: { visitsPerMonth: true, phoneCarePerMonth: true, reportsPerMonth: true } } },
  });

  let entitled = 0;
  let used = 0;
  for (const s of activeSubs) {
    entitled += s.plan.visitsPerMonth + s.plan.phoneCarePerMonth + s.plan.reportsPerMonth;
    used += s.usedVisits + s.usedPhoneCare + s.usedReports;
  }

  // 专员时间：近 4 周实际服务分钟数 / （可排班人数 × 4 周 × 每周名义 5 天 × 6 小时）
  const from = new Date();
  from.setDate(from.getDate() - 28);

  const activeStaff = await prisma.staffProfile.count({
    where: { serviceStatus: 'ACTIVE', deletedAt: null },
  });

  const served = await prisma.serviceTask.findMany({
    where: {
      household: scope,
      deletedAt: null,
      scheduledStart: { gte: from },
      status: { in: ['COMPLETED', 'PENDING_REVIEW'] },
    },
    select: { estimatedMinutes: true, startedAt: true, endedAt: true },
  });

  const servedMinutes = served.reduce((sum, t) => {
    if (t.startedAt && t.endedAt) {
      return sum + Math.max(0, Math.round((t.endedAt.getTime() - t.startedAt.getTime()) / 60000));
    }
    return sum + t.estimatedMinutes;
  }, 0);

  const NOMINAL_MINUTES_PER_STAFF = 4 * 5 * 6 * 60; // 4 周 × 每周 5 天 × 每天 6 小时
  const capacity = activeStaff * NOMINAL_MINUTES_PER_STAFF;

  return {
    entitlementUsage: entitled > 0 ? used / entitled : null,
    entitledCount: entitled,
    usedCount: used,
    staffUtilization: capacity > 0 ? servedMinutes / capacity : null,
    servedHours: Math.round(servedMinutes / 60),
    capacityHours: Math.round(capacity / 60),
    activeStaff,
    note: '名义产能按每名可排班专员每周 5 天、每天 6 小时估算，仅用于趋势观察',
  };
}
