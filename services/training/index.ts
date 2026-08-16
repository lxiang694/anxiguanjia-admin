import 'server-only';

import type { ServiceType, TrainingStatus, TrainingType, VerificationStatus } from '@prisma/client';

import type { CurrentUser } from '@/lib/auth';
import { auditAs } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { assertCan } from '@/lib/permissions';

/**
 * 培训、考核与能力标签的写操作。
 *
 * 一条贯穿的纪律：**公司培训 ≠ 法定资格**。
 * 所以这里把两件事严格分开：
 *  - TrainingRecord：公司自己的课程与考核，由督导/人事登记；
 *  - StaffCompetency.credentialStatus：涉及法定资格的能力，必须另外登记外部凭证并核验。
 * 系统不允许用「培训通过」去满足「法定资格」的要求。
 */

/* ================================ 课程 ================================ */

export type UpsertCourseInput = {
  id?: string;
  title: string;
  type: TrainingType;
  description?: string | null;
  creditHours: number;
  isMandatory: boolean;
  validMonths?: number | null;
  requiresExam: boolean;
  passingScore?: number | null;
  isActive: boolean;
};

export async function upsertCourse(user: CurrentUser, input: UpsertCourseInput) {
  assertCan(user, 'staff.training.manage');

  if (!input.title.trim()) throw new Error('请填写课程标题');
  if (input.creditHours < 0 || input.creditHours > 200) throw new Error('学时需在 0 到 200 之间');
  if (input.requiresExam && (input.passingScore == null || input.passingScore < 0 || input.passingScore > 100)) {
    throw new Error('需要考核的课程必须设定 0-100 的及格分');
  }

  const data = {
    title: input.title.trim(),
    type: input.type,
    description: input.description ?? undefined,
    creditHours: input.creditHours,
    isMandatory: input.isMandatory,
    validMonths: input.validMonths ?? null,
    requiresExam: input.requiresExam,
    passingScore: input.requiresExam ? input.passingScore : null,
    isActive: input.isActive,
  };

  if (input.id) {
    const before = await prisma.trainingCourse.findUnique({ where: { id: input.id } });
    if (!before) throw new Error('课程不存在');
    const updated = await prisma.trainingCourse.update({ where: { id: input.id }, data });
    await auditAs(user, {
      action: 'UPDATE_TRAINING_COURSE',
      resource: 'TrainingCourse',
      resourceId: updated.id,
      before: { title: before.title, isMandatory: before.isMandatory, isActive: before.isActive },
      after: { title: updated.title, isMandatory: updated.isMandatory, isActive: updated.isActive },
    });
    return updated;
  }

  const exists = await prisma.trainingCourse.findUnique({ where: { title: data.title } });
  if (exists) throw new Error('已有同名课程');

  const created = await prisma.trainingCourse.create({ data });
  await auditAs(user, {
    action: 'CREATE_TRAINING_COURSE',
    resource: 'TrainingCourse',
    resourceId: created.id,
    after: { title: created.title, isMandatory: created.isMandatory },
  });
  return created;
}

/* ============================== 培训记录 ============================== */

export type EnrollInput = {
  staffProfileId: string;
  courseId: string;
  status?: TrainingStatus;
  instructorName?: string | null;
};

/** 为专员登记一门培训（报名 / 开始学习） */
export async function enrollTraining(user: CurrentUser, input: EnrollInput) {
  assertCan(user, 'staff.training.manage');

  const [staff, course] = await Promise.all([
    prisma.staffProfile.findUnique({ where: { id: input.staffProfileId }, select: { id: true } }),
    prisma.trainingCourse.findUnique({ where: { id: input.courseId }, select: { id: true, creditHours: true } }),
  ]);
  if (!staff) throw new Error('安心专员档案不存在');
  if (!course) throw new Error('课程不存在');

  const status = input.status ?? 'IN_PROGRESS';
  const record = await prisma.trainingRecord.upsert({
    where: { staffProfileId_courseId: { staffProfileId: input.staffProfileId, courseId: input.courseId } },
    create: {
      staffProfileId: input.staffProfileId,
      courseId: input.courseId,
      status,
      startedAt: status === 'NOT_STARTED' ? null : new Date(),
      instructorName: input.instructorName ?? undefined,
    },
    update: {
      status,
      startedAt: status === 'NOT_STARTED' ? null : new Date(),
      instructorName: input.instructorName ?? undefined,
    },
  });

  await auditAs(user, {
    action: 'ENROLL_TRAINING',
    resource: 'TrainingRecord',
    resourceId: record.id,
    after: { staffProfileId: input.staffProfileId, courseId: input.courseId, status },
  });

  return record;
}

export type GradeInput = {
  recordId: string;
  examScore?: number | null;
  /** 不传则按及格分自动判定 */
  status?: TrainingStatus;
  instructorName?: string | null;
  remark?: string | null;
};

/**
 * 录入考核成绩。
 * 通过与否由课程的及格分决定，不允许在没达到及格分的情况下手动标「通过」。
 */
export async function gradeTraining(user: CurrentUser, input: GradeInput) {
  assertCan(user, 'staff.training.manage');

  const record = await prisma.trainingRecord.findUnique({
    where: { id: input.recordId },
    include: { course: true },
  });
  if (!record) throw new Error('培训记录不存在');

  let status: TrainingStatus;
  const passing = record.course.passingScore ?? 60;

  if (record.course.requiresExam) {
    if (input.examScore == null) throw new Error('这门课需要考核，请填写成绩');
    if (input.examScore < 0 || input.examScore > 100) throw new Error('成绩需在 0 到 100 之间');
    status = input.examScore >= passing ? 'PASSED' : 'FAILED';
    // 允许把未达标的结果标为「需复训」，但不允许标为「通过」
    if (input.status === 'NEEDS_RETRAIN' && status === 'FAILED') status = 'NEEDS_RETRAIN';
    if (input.status === 'PASSED' && input.examScore < passing) {
      throw new Error(`成绩 ${input.examScore} 未达及格分 ${passing}，不能标记为通过`);
    }
  } else {
    status = input.status ?? 'PASSED';
  }

  const completedAt = ['PASSED', 'FAILED', 'NEEDS_RETRAIN'].includes(status) ? new Date() : null;
  const expiresAt =
    status === 'PASSED' && record.course.validMonths
      ? new Date(Date.now() + record.course.validMonths * 30 * 86400000)
      : null;

  const updated = await prisma.trainingRecord.update({
    where: { id: input.recordId },
    data: {
      examScore: input.examScore ?? undefined,
      status,
      completedAt,
      expiresAt,
      creditHours: status === 'PASSED' ? record.course.creditHours : record.creditHours,
      instructorName: input.instructorName ?? record.instructorName,
      remark: input.remark ?? undefined,
    },
  });

  await auditAs(user, {
    action: 'GRADE_TRAINING',
    resource: 'TrainingRecord',
    resourceId: input.recordId,
    before: { status: record.status, examScore: record.examScore },
    after: { status, examScore: input.examScore ?? null, passingScore: passing },
  });

  return updated;
}

/** 考核管理页的数据源：需要考核、且还没有最终结果的记录 */
export async function pendingExams(user: CurrentUser) {
  assertCan(user, 'staff.training.manage');
  return prisma.trainingRecord.findMany({
    where: {
      course: { requiresExam: true, isActive: true },
      status: { in: ['IN_PROGRESS', 'PENDING_EXAM', 'NEEDS_RETRAIN', 'FAILED'] },
    },
    include: {
      course: { select: { id: true, title: true, passingScore: true, isMandatory: true, requiresExam: true } },
      staffProfile: {
        include: { user: { select: { name: true } }, district: { select: { name: true } } },
      },
    },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: 200,
  });
}

/** 已完成考核的记录（考核管理页下半部分） */
export async function gradedExams(user: CurrentUser) {
  assertCan(user, 'staff.training.manage');
  return prisma.trainingRecord.findMany({
    where: { course: { requiresExam: true }, status: { in: ['PASSED', 'FAILED'] }, examScore: { not: null } },
    include: {
      course: { select: { title: true, passingScore: true } },
      staffProfile: { include: { user: { select: { name: true } } } },
    },
    orderBy: { completedAt: 'desc' },
    take: 100,
  });
}

/* ============================== 能力标签 ============================== */

export type UpsertCompetencyInput = {
  id?: string;
  name: string;
  code: string;
  description?: string | null;
  requiresCredential: boolean;
  requiredForServices: ServiceType[];
  isActive: boolean;
};

export async function upsertCompetency(user: CurrentUser, input: UpsertCompetencyInput) {
  assertCan(user, 'staff.competency.manage');

  if (!input.name.trim()) throw new Error('请填写能力名称');
  if (!/^[a-z][a-z0-9_]*$/.test(input.code)) {
    throw new Error('代码只能使用小写字母、数字与下划线，且以字母开头');
  }

  const data = {
    name: input.name.trim(),
    code: input.code,
    description: input.description ?? undefined,
    requiresCredential: input.requiresCredential,
    requiredForServices: input.requiredForServices,
    isActive: input.isActive,
  };

  if (input.id) {
    const before = await prisma.competency.findUnique({ where: { id: input.id } });
    if (!before) throw new Error('能力标签不存在');
    const updated = await prisma.competency.update({ where: { id: input.id }, data });
    await auditAs(user, {
      action: 'UPDATE_COMPETENCY',
      resource: 'Competency',
      resourceId: updated.id,
      before: {
        name: before.name,
        requiresCredential: before.requiresCredential,
        requiredForServices: before.requiredForServices,
      },
      after: {
        name: updated.name,
        requiresCredential: updated.requiresCredential,
        requiredForServices: updated.requiredForServices,
      },
    });
    return updated;
  }

  const dup = await prisma.competency.findFirst({
    where: { OR: [{ name: data.name }, { code: data.code }] },
  });
  if (dup) throw new Error('已有同名或同代码的能力标签');

  const created = await prisma.competency.create({ data });
  await auditAs(user, {
    action: 'CREATE_COMPETENCY',
    resource: 'Competency',
    resourceId: created.id,
    after: { name: created.name, code: created.code, requiresCredential: created.requiresCredential },
  });
  return created;
}

export type GrantCompetencyInput = {
  staffProfileId: string;
  competencyId: string;
  credentialNo?: string | null;
  credentialStatus?: VerificationStatus;
  credentialExpiry?: Date | null;
};

/** 授予能力标签。涉及法定资格的能力必须同时登记凭证编号。 */
export async function grantCompetency(user: CurrentUser, input: GrantCompetencyInput) {
  assertCan(user, 'staff.competency.manage');

  const [staff, comp] = await Promise.all([
    prisma.staffProfile.findUnique({ where: { id: input.staffProfileId }, select: { id: true } }),
    prisma.competency.findUnique({ where: { id: input.competencyId } }),
  ]);
  if (!staff) throw new Error('安心专员档案不存在');
  if (!comp) throw new Error('能力标签不存在');

  if (comp.requiresCredential) {
    if (!input.credentialNo?.trim()) {
      throw new Error(`「${comp.name}」涉及法定资格，必须登记外部凭证编号，公司培训不能替代`);
    }
    if (input.credentialStatus === 'VERIFIED' && !input.credentialExpiry) {
      throw new Error('标记为已核验时，请一并登记凭证有效期');
    }
  }

  const link = await prisma.staffCompetency.upsert({
    where: {
      staffProfileId_competencyId: {
        staffProfileId: input.staffProfileId,
        competencyId: input.competencyId,
      },
    },
    create: {
      staffProfileId: input.staffProfileId,
      competencyId: input.competencyId,
      credentialNo: input.credentialNo ?? undefined,
      credentialStatus: input.credentialStatus ?? 'UNVERIFIED',
      credentialExpiry: input.credentialExpiry ?? undefined,
    },
    update: {
      credentialNo: input.credentialNo ?? undefined,
      credentialStatus: input.credentialStatus ?? 'UNVERIFIED',
      credentialExpiry: input.credentialExpiry ?? undefined,
    },
  });

  await auditAs(user, {
    action: 'GRANT_COMPETENCY',
    resource: 'StaffCompetency',
    resourceId: link.id,
    after: {
      staffProfileId: input.staffProfileId,
      competency: comp.name,
      requiresCredential: comp.requiresCredential,
      credentialStatus: link.credentialStatus,
    },
  });

  return link;
}

export async function revokeCompetency(
  user: CurrentUser,
  staffProfileId: string,
  competencyId: string,
) {
  assertCan(user, 'staff.competency.manage');

  const link = await prisma.staffCompetency.findUnique({
    where: { staffProfileId_competencyId: { staffProfileId, competencyId } },
    include: { competency: { select: { name: true } } },
  });
  if (!link) throw new Error('该专员没有这项能力标签');

  await prisma.staffCompetency.delete({ where: { id: link.id } });

  await auditAs(user, {
    action: 'REVOKE_COMPETENCY',
    resource: 'StaffCompetency',
    resourceId: link.id,
    before: { staffProfileId, competency: link.competency.name },
  });

  return { ok: true };
}
