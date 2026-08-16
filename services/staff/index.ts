import 'server-only';

import type { ServiceStatus, ServiceType, VerificationStatus } from '@prisma/client';

import type { CurrentUser } from '@/lib/auth';
import { auditAs } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { assertCan, staffScopeWhere } from '@/lib/permissions';
import { SERVICE_STATUS_FLOW } from '@/lib/labels';

/**
 * 安心专员管理。
 *
 * 上岗纪律（不可绕过）：
 *   只有 serviceStatus = ACTIVE，且具备该服务类型所需能力的人员，才能被派单。
 *
 * 展示纪律（不可绕过）：
 *   学历未核验 → 前端不得标示「已认证」；
 *   涉及法定资格的能力（requiresCredential）→ 公司培训不等同法定资格，
 *   必须另有已核验的外部凭证才可对家庭展示。
 */

export async function listStaff(
  user: CurrentUser,
  filters: { q?: string; serviceStatus?: ServiceStatus | 'ALL'; districtId?: string } = {},
) {
  assertCan(user, 'staff.read');
  const scope = staffScopeWhere(user);
  if (!scope) return [];

  return prisma.staffProfile.findMany({
    where: {
      AND: [
        scope,
        filters.serviceStatus && filters.serviceStatus !== 'ALL'
          ? { serviceStatus: filters.serviceStatus }
          : {},
        filters.districtId ? { districtId: filters.districtId } : {},
        filters.q
          ? {
              OR: [
                { employeeCode: { contains: filters.q, mode: 'insensitive' } },
                { user: { name: { contains: filters.q, mode: 'insensitive' } } },
                { user: { phone: { contains: filters.q } } },
              ],
            }
          : {},
      ],
    },
    include: {
      user: { select: { id: true, name: true, phone: true, avatarUrl: true, role: true, status: true } },
      district: { select: { id: true, name: true } },
      educations: true,
      competencies: { include: { competency: true } },
      _count: { select: { primaryFor: true, backupFor: true, tasks: true } },
    },
    orderBy: [{ serviceStatus: 'asc' }, { employeeCode: 'asc' }],
  });
}

export async function getStaffProfile(user: CurrentUser, staffProfileId: string) {
  assertCan(user, 'staff.read');
  const scope = staffScopeWhere(user);
  if (!scope) return null;

  return prisma.staffProfile.findFirst({
    where: { AND: [scope, { id: staffProfileId }] },
    include: {
      user: { select: { id: true, name: true, phone: true, email: true, avatarUrl: true, role: true, status: true } },
      district: { select: { id: true, name: true } },
      educations: { include: { verifiedBy: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
      trainings: { include: { course: true }, orderBy: { createdAt: 'desc' } },
      competencies: { include: { competency: true } },
      availability: { orderBy: { startAt: 'desc' }, take: 20 },
      performance: { orderBy: { periodStart: 'desc' }, take: 6 },
      primaryFor: { select: { id: true, householdCode: true, name: true, status: true } },
      backupFor: { select: { id: true, householdCode: true, name: true } },
    },
  });
}

/**
 * 是否可以对外（尤其对家庭端）展示为「已认证学历」。
 * 未核验一律返回 false —— 这是合规硬线。
 */
export function isEducationVerified(e: { verificationStatus: VerificationStatus }): boolean {
  return e.verificationStatus === 'VERIFIED';
}

/**
 * 派单资格判定。
 * 返回 ok=false 时附带具体原因，方便派单界面直接显示为什么这个人不能派。
 */
export async function checkDispatchEligibility(
  staffProfileId: string,
  serviceType: ServiceType,
  scheduledStart?: Date,
): Promise<{ ok: boolean; reasons: string[] }> {
  const reasons: string[] = [];

  const staff = await prisma.staffProfile.findUnique({
    where: { id: staffProfileId },
    include: {
      user: { select: { name: true, status: true } },
      competencies: { include: { competency: true } },
      availability: true,
    },
  });

  if (!staff) return { ok: false, reasons: ['安心专员档案不存在'] };
  if (staff.deletedAt) reasons.push('档案已删除');
  if (staff.user.status !== 'ACTIVE') reasons.push('帐号非正常状态');
  if (staff.employmentStatus !== 'ONBOARDED') reasons.push('尚未完成入职');
  if (staff.serviceStatus !== 'ACTIVE') {
    reasons.push('服务状态非「可排班」，不可派单');
  }

  // 该服务类型所需能力
  const required = await prisma.competency.findMany({
    where: { isActive: true, requiredForServices: { has: serviceType } },
  });

  for (const req of required) {
    const held = staff.competencies.find((c) => c.competencyId === req.id);
    if (!held) {
      reasons.push(`缺少能力：${req.name}`);
      continue;
    }
    // 涉及法定资格的能力，公司内部认定不足以派单
    if (req.requiresCredential) {
      if (held.credentialStatus !== 'VERIFIED') {
        reasons.push(`能力「${req.name}」涉及法定资格，凭证尚未核验`);
      } else if (held.credentialExpiry && held.credentialExpiry < new Date()) {
        reasons.push(`能力「${req.name}」的资格凭证已过期`);
      }
    }
  }

  // 必修培训未通过则不可上岗
  const mandatoryCourses = await prisma.trainingCourse.findMany({
    where: { isMandatory: true, isActive: true },
    select: { id: true, title: true },
  });
  if (mandatoryCourses.length > 0) {
    const passed = await prisma.trainingRecord.findMany({
      where: {
        staffProfileId,
        courseId: { in: mandatoryCourses.map((c) => c.id) },
        status: 'PASSED',
      },
      select: { courseId: true, expiresAt: true },
    });
    const passedValid = new Set(
      passed.filter((p) => !p.expiresAt || p.expiresAt > new Date()).map((p) => p.courseId),
    );
    const missing = mandatoryCourses.filter((c) => !passedValid.has(c.id));
    if (missing.length > 0) {
      reasons.push(`必修培训未通过或已过期：${missing.map((m) => m.title).join('、')}`);
    }
  }

  // 已提交的不可排班时间
  if (scheduledStart) {
    const blocked = staff.availability.find(
      (a) => a.isBlocked && a.startAt <= scheduledStart && a.endAt >= scheduledStart,
    );
    if (blocked) reasons.push(`该时段已提交不可排班（${blocked.reason ?? '未填原因'}）`);
  }

  return { ok: reasons.length === 0, reasons };
}

/** 推进上岗状态机。只允许沿既定路径前进，或转入暂停/离职。 */
export async function updateServiceStatus(
  user: CurrentUser,
  staffProfileId: string,
  next: ServiceStatus,
) {
  assertCan(user, 'staff.update');

  const staff = await prisma.staffProfile.findUnique({
    where: { id: staffProfileId },
    select: { id: true, serviceStatus: true, employmentStatus: true },
  });
  if (!staff) throw new Error('安心专员档案不存在');

  const current = staff.serviceStatus;
  const terminal: ServiceStatus[] = ['SUSPENDED', 'OFFBOARDED'];

  if (!terminal.includes(next)) {
    const from = SERVICE_STATUS_FLOW.indexOf(current);
    const to = SERVICE_STATUS_FLOW.indexOf(next);
    if (to === -1) throw new Error('目标状态不合法');
    // 允许从暂停恢复到可排班
    const resuming = current === 'SUSPENDED' && next === 'ACTIVE';
    if (!resuming && (from === -1 || to !== from + 1)) {
      throw new Error('服务状态必须按流程逐步推进，不可跳级');
    }
  }

  if (next === 'ACTIVE') {
    const eligibility = await checkDispatchEligibility(staffProfileId, 'HOME_VISIT');
    // ACTIVE 之前必须已满足除「状态本身」以外的全部条件
    const blockers = eligibility.reasons.filter((r) => !r.includes('服务状态'));
    if (blockers.length > 0) {
      throw new Error(`尚不满足上岗条件：${blockers.join('；')}`);
    }
  }

  const updated = await prisma.staffProfile.update({
    where: { id: staffProfileId },
    data: {
      serviceStatus: next,
      employmentStatus:
        next === 'OFFBOARDED'
          ? 'RESIGNED'
          : staff.employmentStatus === 'CANDIDATE' && next !== 'NOT_STARTED'
            ? 'ONBOARDED'
            : undefined,
    },
  });

  await auditAs(user, {
    action: 'UPDATE_STAFF_PROFILE',
    resource: 'StaffProfile',
    resourceId: staffProfileId,
    before: { serviceStatus: current },
    after: { serviceStatus: next },
  });

  return updated;
}

export async function verifyEducation(
  user: CurrentUser,
  educationId: string,
  status: Extract<VerificationStatus, 'VERIFIED' | 'REJECTED'>,
) {
  assertCan(user, 'staff.education.verify');

  const before = await prisma.educationRecord.findUnique({
    where: { id: educationId },
    select: { verificationStatus: true, school: true, major: true },
  });
  if (!before) throw new Error('学历记录不存在');

  const updated = await prisma.educationRecord.update({
    where: { id: educationId },
    data: {
      verificationStatus: status,
      verifiedById: user.id,
      verifiedAt: new Date(),
    },
  });

  await auditAs(user, {
    action: 'VERIFY_EDUCATION',
    resource: 'EducationRecord',
    resourceId: educationId,
    before: { verificationStatus: before.verificationStatus },
    after: { verificationStatus: status },
  });

  return updated;
}

/**
 * 对家庭端展示的专员卡片。
 * 严格过滤：未核验的学历不出现；requiresCredential 且未核验的能力不出现。
 */
export async function specialistCardForFamily(staffProfileId: string, householdId: string) {
  const staff = await prisma.staffProfile.findUnique({
    where: { id: staffProfileId },
    include: {
      user: { select: { name: true, avatarUrl: true } },
      educations: { where: { verificationStatus: 'VERIFIED' } },
      competencies: { include: { competency: true } },
      trainings: {
        where: { status: 'PASSED', course: { isMandatory: true } },
        include: { course: { select: { title: true } } },
      },
    },
  });
  if (!staff) return null;

  const servedCount = await prisma.serviceTask.count({
    where: { householdId, staffProfileId, status: 'COMPLETED', deletedAt: null },
  });

  const showableCompetencies = staff.competencies
    .filter((c) => !c.competency.requiresCredential || c.credentialStatus === 'VERIFIED')
    .map((c) => c.competency.name);

  const mandatoryTotal = await prisma.trainingCourse.count({
    where: { isMandatory: true, isActive: true },
  });
  const onboardingComplete =
    mandatoryTotal > 0 && staff.trainings.length >= mandatoryTotal;

  return {
    id: staff.id,
    name: staff.user.name,
    avatarUrl: staff.user.avatarUrl,
    title: staff.staffLevel === 'SENIOR' ? '资深家庭安心专员' : '家庭安心专员',
    /** 只有已核验的学历才会出现在这里 */
    educations: staff.educations.map((e) => ({
      school: e.school,
      major: e.major,
      level: e.level,
    })),
    /** 公司培训表述与「法定资格」严格区分 */
    onboardingComplete,
    competencies: showableCompetencies,
    servedCount,
    bio: staff.bio,
  };
}

/**
 * 安心专员提交自己的不可排班时间。
 *
 * 这是「专员自己申报不方便的时间段」，不是定位、不是考勤 ——
 * 系统不做任何 24 小时持续定位，排班时只需要知道哪段时间避开。
 */
export async function submitUnavailability(
  user: CurrentUser,
  input: { startAt: Date; endAt: Date; reason?: string | null },
) {
  if (!user.staffProfileId) throw new Error('当前帐号没有安心专员档案');
  if (Number.isNaN(input.startAt.getTime()) || Number.isNaN(input.endAt.getTime())) {
    throw new Error('请选择正确的起止时间');
  }
  if (input.endAt <= input.startAt) throw new Error('结束时间必须晚于开始时间');

  const MAX_DAYS = 90;
  const days = (input.endAt.getTime() - input.startAt.getTime()) / 86400000;
  if (days > MAX_DAYS) throw new Error(`一次最多申报 ${MAX_DAYS} 天，请分段提交`);

  // 与已有申报重叠时直接合并，避免同一段时间重复申报把排班视图撑满
  const overlap = await prisma.staffAvailability.findFirst({
    where: {
      staffProfileId: user.staffProfileId,
      isBlocked: true,
      startAt: { lte: input.endAt },
      endAt: { gte: input.startAt },
    },
  });

  if (overlap) {
    return prisma.staffAvailability.update({
      where: { id: overlap.id },
      data: {
        startAt: overlap.startAt < input.startAt ? overlap.startAt : input.startAt,
        endAt: overlap.endAt > input.endAt ? overlap.endAt : input.endAt,
        reason: input.reason?.trim() || overlap.reason,
      },
    });
  }

  return prisma.staffAvailability.create({
    data: {
      staffProfileId: user.staffProfileId,
      startAt: input.startAt,
      endAt: input.endAt,
      reason: input.reason?.trim() || undefined,
      isBlocked: true,
    },
  });
}
