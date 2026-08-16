import 'server-only';

import type { ObservationLevel, VisitRecord } from '@prisma/client';

import type { CurrentUser } from '@/lib/auth';
import { auditAs } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { nextReportNo } from '@/lib/ids';
import { assertCan, householdScopeFilter, reportScopeWhere } from '@/lib/permissions';
import { currentWeekRange, formatMonthDay } from '@/lib/utils';

/**
 * 家庭安心报告。
 *
 * 最重要的设计约束：
 *
 *   原始服务记录（VisitRecord）  ≠  家庭安心报告（AssuranceReport）
 *
 * 原始记录永久保留、不因报告改写而变动。
 * 报告是「另外形成」的、面向家庭的表达，可由系统汇总或 AI 辅助整理，
 * 但内容必须能在原始记录中找到依据，且必须经人工确认后才发送家庭端。
 *
 * 本文件里的生成逻辑刻意采用规则式（RULE_BASED_DRAFT）：
 * 每一句话都由原始记录的字段直接映射而来，不会凭空产生任何新事实。
 */

const SPIRIT_TEXT: Record<ObservationLevel, string> = {
  NORMAL: '交流正常',
  FAIR: '比平常安静一些',
  SELF_REPORTED_ISSUE: '本人反映精神状态有变化',
  REDUCED: '比平常疲倦一些',
  UNKNOWN: '本次未能确认',
  OTHER: '有其他情况，详见服务记录',
};

const DIET_TEXT: Record<ObservationLevel, string> = {
  NORMAL: '正常',
  FAIR: '一般',
  SELF_REPORTED_ISSUE: '本人反映食欲减少',
  REDUCED: '进食比平常减少',
  UNKNOWN: '本次未能确认',
  OTHER: '有其他情况，详见服务记录',
};

const SLEEP_TEXT: Record<ObservationLevel, string> = {
  NORMAL: '正常',
  FAIR: '一般',
  SELF_REPORTED_ISSUE: '本人反映近期睡得不太好',
  REDUCED: '休息时间比平常少',
  UNKNOWN: '本次未能确认',
  OTHER: '有其他情况，详见服务记录',
};

const ACTIVITY_TEXT: Record<ObservationLevel, string> = {
  NORMAL: '活动正常',
  FAIR: '活动时略感不便',
  SELF_REPORTED_ISSUE: '本人反映活动情况有变化',
  REDUCED: '活动比平常减少',
  UNKNOWN: '本次未能确认',
  OTHER: '有其他情况，详见服务记录',
};

/** 观察等级的「严重度」排序，用于挑出最需要家人留意的那一次 */
const SEVERITY_ORDER: ObservationLevel[] = [
  'NORMAL',
  'FAIR',
  'UNKNOWN',
  'OTHER',
  'REDUCED',
  'SELF_REPORTED_ISSUE',
];

function worst(levels: ObservationLevel[]): ObservationLevel {
  if (levels.length === 0) return 'UNKNOWN';
  return levels.reduce((acc, cur) =>
    SEVERITY_ORDER.indexOf(cur) > SEVERITY_ORDER.indexOf(acc) ? cur : acc,
  );
}

function needsAttention(level: ObservationLevel): boolean {
  return level === 'SELF_REPORTED_ISSUE' || level === 'REDUCED';
}

/**
 * 由原始记录生成报告草稿内容。
 * 纯函数、无副作用，便于单独验证「不会虚构内容」。
 */
export function composeDraftFromRecords(
  records: Pick<
    VisitRecord,
    | 'spiritLevel'
    | 'spiritNote'
    | 'dietLevel'
    | 'dietNote'
    | 'sleepLevel'
    | 'sleepNote'
    | 'activityLevel'
    | 'activityNote'
    | 'completedItems'
    | 'observationText'
    | 'submittedAt'
  >[],
  opts: { elderTitle: string; visitCount: number; phoneCareCount: number },
) {
  const spirit = worst(records.map((r) => r.spiritLevel));
  const diet = worst(records.map((r) => r.dietLevel));
  const sleep = worst(records.map((r) => r.sleepLevel));
  const activity = worst(records.map((r) => r.activityLevel));

  // 睡眠等维度若是「本人反映」，把具体是哪一天带上，家人更容易理解
  const sleepDetail = records.find((r) => needsAttention(r.sleepLevel));
  const sleepSummary =
    sleepDetail && needsAttention(sleep)
      ? `${SLEEP_TEXT[sleep]}（${formatMonthDay(sleepDetail.submittedAt)}）${sleepDetail.sleepNote ? `：${sleepDetail.sleepNote}` : ''}`
      : SLEEP_TEXT[sleep];

  const dietDetail = records.find((r) => needsAttention(r.dietLevel));
  const dietSummary =
    dietDetail && needsAttention(diet)
      ? `${DIET_TEXT[diet]}${dietDetail.dietNote ? `：${dietDetail.dietNote}` : ''}`
      : DIET_TEXT[diet];

  // 生活协助：直接汇总原始记录里勾选的事项，不添加未发生的服务
  const allItems = Array.from(new Set(records.flatMap((r) => r.completedItems))).filter(
    (i) => i && i !== '其他',
  );
  const walkCount = records.filter((r) => r.completedItems.includes('散步')).length;

  const activityParts: string[] = [ACTIVITY_TEXT[activity]];
  if (walkCount > 0) activityParts.push(`本周陪同散步 ${walkCount} 次`);

  const lifeSummary =
    allItems.length > 0
      ? `本周协助：${allItems.join('、')}。`
      : '本周以陪伴与日常观察为主。';

  // 需要留意：只搬运原始记录里的客观描述，不做任何推断或诊断
  const attentionPoints: string[] = [];
  for (const r of records) {
    if (needsAttention(r.spiritLevel) && r.spiritNote) attentionPoints.push(r.spiritNote);
    if (needsAttention(r.dietLevel) && r.dietNote) attentionPoints.push(r.dietNote);
    if (needsAttention(r.sleepLevel) && r.sleepNote) attentionPoints.push(r.sleepNote);
    if (needsAttention(r.activityLevel) && r.activityNote) attentionPoints.push(r.activityNote);
    if (r.observationText) attentionPoints.push(r.observationText);
  }
  const attentionSummary =
    attentionPoints.length > 0
      ? Array.from(new Set(attentionPoints)).join('\n')
      : '本周未发现需要特别留意的情况。';

  // 给家人的小提醒：固定几句温和建议，不涉及任何健康判断
  const familyTip =
    attentionPoints.length > 0
      ? '周末有时间可以多和长辈视频聊聊，问问最近的感受。'
      : '一切都还平稳，周末有空的话打个电话，长辈会很开心。';

  return {
    title: `${opts.elderTitle}这周过得怎么样？`,
    spiritSummary: SPIRIT_TEXT[spirit],
    dietSummary,
    sleepSummary,
    activitySummary: activityParts.join('，'),
    lifeSummary,
    attentionSummary,
    familyTip,
  };
}

export type GenerateReportInput = {
  householdId: string;
  elderId?: string | null;
  periodStart?: Date;
  periodEnd?: Date;
};

/**
 * 生成安心报告草稿。
 * 草稿状态为 PENDING_REVIEW —— 未经人工确认，家庭端一律看不到。
 */
export async function generateReportDraft(user: CurrentUser, input: GenerateReportInput) {
  assertCan(user, 'report.generate');

  const filter = householdScopeFilter(user, input.householdId);
  if (!filter) throw new Error('家庭不存在或不在数据范围内');

  const household = await prisma.household.findFirst({
    where: filter,
    include: {
      elders: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      members: { include: { user: { select: { id: true } } } },
    },
  });
  if (!household) throw new Error('家庭不存在或不在数据范围内');

  const week = currentWeekRange();
  const periodStart = input.periodStart ?? week.start;
  const periodEnd = input.periodEnd ?? week.end;

  const elder =
    (input.elderId ? household.elders.find((e) => e.id === input.elderId) : household.elders[0]) ??
    null;

  // 只取「本周期内、已提交记录」的任务 —— 报告不得包含还没发生的服务
  const tasks = await prisma.serviceTask.findMany({
    where: {
      householdId: household.id,
      deletedAt: null,
      scheduledStart: { gte: periodStart, lt: periodEnd },
      status: { in: ['PENDING_REVIEW', 'COMPLETED'] },
      ...(elder ? { OR: [{ elderId: elder.id }, { elderId: null }] } : {}),
    },
    include: { record: true },
    orderBy: { scheduledStart: 'asc' },
  });

  const visitTasks = tasks.filter((t) => t.serviceType !== 'PHONE_CARE');
  const phoneTasks = tasks.filter((t) => t.serviceType === 'PHONE_CARE');
  const records = tasks.map((t) => t.record).filter((r): r is NonNullable<typeof r> => !!r);

  if (records.length === 0) {
    throw new Error('该周期内没有已提交的服务记录，无法生成报告（不允许凭空生成内容）');
  }

  const elderTitle = elder?.name ?? household.name;
  const draft = composeDraftFromRecords(records, {
    elderTitle,
    visitCount: visitTasks.length,
    phoneCareCount: phoneTasks.length,
  });

  const reportNo = await nextReportNo(periodStart);

  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.assuranceReport.create({
      data: {
        reportNo,
        householdId: household.id,
        elderId: elder?.id,
        periodStart,
        periodEnd,
        status: 'PENDING_REVIEW',
        generation: 'RULE_BASED_DRAFT',
        title: draft.title,
        visitCount: visitTasks.length,
        phoneCareCount: phoneTasks.length,
        spiritSummary: draft.spiritSummary,
        dietSummary: draft.dietSummary,
        sleepSummary: draft.sleepSummary,
        activitySummary: draft.activitySummary,
        lifeSummary: draft.lifeSummary,
        attentionSummary: draft.attentionSummary,
        familyTip: draft.familyTip,
        aiGenerated: false,
        isDemo: household.isDemo,
      },
    });

    // 建立与原始记录的引用关系，保证每句话都能被追溯
    for (const r of records) {
      await tx.assuranceVisitRecordLink.create({
        data: { reportId: created.id, visitRecordId: r.id },
      });
    }

    return created;
  });

  const { notifySupervisors } = await import('@/lib/notifications');
  await notifySupervisors({
    title: '有安心报告草稿待人工确认',
    body: `${household.name} · ${reportNo}`,
    linkUrl: `/admin/service/reports/${report.id}`,
    refType: 'report',
    refId: report.id,
    isDemo: household.isDemo,
  });

  await auditAs(user, {
    action: 'GENERATE_REPORT',
    resource: 'AssuranceReport',
    resourceId: report.id,
    after: { reportNo, generation: 'RULE_BASED_DRAFT', sourceRecordCount: records.length },
  });

  return report;
}

export type ReviewReportInput = {
  reportId: string;
  /** 人工可以润色文字，但统计数字由原始记录决定，不接受手改 */
  patch?: {
    title?: string;
    spiritSummary?: string;
    dietSummary?: string;
    sleepSummary?: string;
    activitySummary?: string;
    lifeSummary?: string;
    attentionSummary?: string;
    familyTip?: string;
  };
  note?: string;
};

/** 人工确认（不直接发布，留一步「发布」动作给运营决定时机） */
export async function approveReport(user: CurrentUser, input: ReviewReportInput) {
  assertCan(user, 'report.review');

  const scope = reportScopeWhere(user);
  if (!scope) throw new Error('不在数据范围内');
  const report = await prisma.assuranceReport.findFirst({
    where: { AND: [scope, { id: input.reportId }] },
  });
  if (!report) throw new Error('报告不存在或不在数据范围内');
  if (report.status === 'PUBLISHED') throw new Error('报告已发布');

  const updated = await prisma.assuranceReport.update({
    where: { id: input.reportId },
    data: {
      ...input.patch,
      status: 'APPROVED',
      reviewedById: user.id,
      reviewedAt: new Date(),
      reviewNote: input.note,
    },
  });

  await auditAs(user, {
    action: 'REVIEW_REPORT',
    resource: 'AssuranceReport',
    resourceId: input.reportId,
    before: { status: report.status },
    after: { status: 'APPROVED', note: input.note ?? null },
  });

  return updated;
}

export async function rejectReport(user: CurrentUser, reportId: string, reason: string) {
  assertCan(user, 'report.review');
  if (!reason.trim()) throw new Error('退回报告必须填写原因');

  const scope = reportScopeWhere(user);
  if (!scope) throw new Error('不在数据范围内');
  const report = await prisma.assuranceReport.findFirst({
    where: { AND: [scope, { id: reportId }] },
    select: { id: true, status: true },
  });
  if (!report) throw new Error('报告不存在或不在数据范围内');

  const updated = await prisma.assuranceReport.update({
    where: { id: reportId },
    data: { status: 'REJECTED', rejectReason: reason, reviewedById: user.id, reviewedAt: new Date() },
  });

  await auditAs(user, {
    action: 'REVIEW_REPORT',
    resource: 'AssuranceReport',
    resourceId: reportId,
    before: { status: report.status },
    after: { status: 'REJECTED', reason },
  });

  return updated;
}

/** 发布到家庭端。未经 APPROVED 的报告不可发布。 */
export async function publishReport(user: CurrentUser, reportId: string) {
  assertCan(user, 'report.publish');

  const scope = reportScopeWhere(user);
  if (!scope) throw new Error('不在数据范围内');
  const report = await prisma.assuranceReport.findFirst({
    where: { AND: [scope, { id: reportId }] },
    include: { household: { select: { id: true, name: true, isDemo: true } }, elder: { select: { id: true, name: true } } },
  });
  if (!report) throw new Error('报告不存在或不在数据范围内');
  if (report.status !== 'APPROVED') {
    throw new Error('只有经人工确认（已确认）的报告才能发布给家庭');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.assuranceReport.update({
      where: { id: reportId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    await tx.timelineEvent.create({
      data: {
        householdId: report.householdId,
        elderId: report.elderId ?? undefined,
        title: '本周安心报告已生成',
        detail: report.title,
        refType: 'report',
        refId: reportId,
        requiredPermission: 'ASSURANCE_REPORT',
        isDemo: report.household.isDemo,
      },
    });
    return r;
  });

  // 只通知「对该长辈拥有安心报告授权」的家庭成员 —— 付款权不等于查看权
  const grantees = report.elderId
    ? await prisma.consent.findMany({
        where: {
          elderId: report.elderId,
          permissionType: 'ASSURANCE_REPORT',
          status: 'ACTIVE',
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { granteeId: true },
      })
    : [];

  if (grantees.length > 0) {
    const { notifyMany } = await import('@/lib/notifications');
    await notifyMany(
      Array.from(new Set(grantees.map((g) => g.granteeId))),
      {
        title: '本周安心报告已生成',
        body: report.title,
        linkUrl: `/family/reports/${reportId}`,
        refType: 'report',
        refId: reportId,
        isDemo: report.household.isDemo,
      },
    );
  }

  await auditAs(user, {
    action: 'PUBLISH_REPORT',
    resource: 'AssuranceReport',
    resourceId: reportId,
    after: { status: 'PUBLISHED', notifiedGrantees: grantees.length },
  });

  return updated;
}

/** 后台报告队列 */
export async function listReports(
  user: CurrentUser,
  filters: { status?: 'PENDING' | 'ALL' } = {},
) {
  assertCan(user, 'report.read');
  const scope = reportScopeWhere(user);
  if (!scope) return [];

  return prisma.assuranceReport.findMany({
    where: {
      AND: [
        scope,
        filters.status === 'PENDING'
          ? { status: { in: ['DRAFT', 'PENDING_REVIEW', 'REJECTED'] } }
          : {},
      ],
    },
    include: {
      household: { select: { id: true, name: true, householdCode: true } },
      elder: { select: { id: true, name: true } },
      reviewedBy: { select: { name: true } },
      _count: { select: { sourceRecords: true } },
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 100,
  });
}

/** 报告详情（后台）—— 带上原始记录以便审核者逐句核对 */
export async function getReportForReview(user: CurrentUser, reportId: string) {
  assertCan(user, 'report.read');
  const scope = reportScopeWhere(user);
  if (!scope) return null;

  return prisma.assuranceReport.findFirst({
    where: { AND: [scope, { id: reportId }] },
    include: {
      household: { select: { id: true, name: true, householdCode: true } },
      elder: { select: { id: true, name: true } },
      reviewedBy: { select: { name: true } },
      sourceRecords: {
        include: {
          visitRecord: {
            include: {
              staffProfile: { include: { user: { select: { name: true } } } },
              task: { select: { taskNo: true, serviceType: true, scheduledStart: true } },
            },
          },
        },
      },
    },
  });
}
