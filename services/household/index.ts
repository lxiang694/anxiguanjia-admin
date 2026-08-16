import 'server-only';

import type { HouseholdStatus, Prisma, RelationshipType } from '@prisma/client';

import { type CurrentUser } from '@/lib/auth';
import { auditAs } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { nextHouseholdCode } from '@/lib/ids';
import { RELATIONSHIP_LABELS } from '@/lib/labels';
import {
  assertCan,
  canSeeInternalNotes,
  householdScopeFilter,
  householdScopeWhere,
} from '@/lib/permissions';

export type HouseholdListFilters = {
  q?: string;
  status?: HouseholdStatus | 'ALL';
  districtId?: string;
  specialistId?: string;
  consultantId?: string;
  page?: number;
  pageSize?: number;
};

/**
 * 家庭列表。
 * 搜索支持：姓名（家庭名 / 长辈名 / 成员名）、手机号、家庭编号。
 * 所有查询都先合并 scope，绝不「先查全量再过滤」。
 */
export async function listHouseholds(user: CurrentUser, filters: HouseholdListFilters = {}) {
  assertCan(user, 'household.read');
  const scope = householdScopeWhere(user);
  if (!scope) return { items: [], total: 0, page: 1, pageSize: 20 };

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 20));

  const and: Prisma.HouseholdWhereInput[] = [scope];

  if (filters.status && filters.status !== 'ALL') {
    and.push({ status: filters.status });
  }
  if (filters.districtId) and.push({ districtId: filters.districtId });
  if (filters.specialistId) {
    and.push({
      OR: [
        { primarySpecialistId: filters.specialistId },
        { backupSpecialistId: filters.specialistId },
      ],
    });
  }
  if (filters.consultantId) and.push({ consultantId: filters.consultantId });

  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { householdCode: { contains: q, mode: 'insensitive' } },
        { elders: { some: { name: { contains: q, mode: 'insensitive' }, deletedAt: null } } },
        { elders: { some: { phone: { contains: q } } } },
        { members: { some: { user: { name: { contains: q, mode: 'insensitive' } } } } },
        { members: { some: { user: { phone: { contains: q } } } } },
      ],
    });
  }

  const where: Prisma.HouseholdWhereInput = { AND: and };

  const [items, total] = await Promise.all([
    prisma.household.findMany({
      where,
      include: {
        city: { select: { name: true } },
        district: { select: { name: true } },
        elders: {
          where: { deletedAt: null },
          select: { id: true, name: true, gender: true, birthday: true },
        },
        primarySpecialist: { include: { user: { select: { name: true } } } },
        consultant: { select: { id: true, name: true } },
        servicePlan: { include: { plan: { select: { name: true, tier: true } } } },
        subscriptions: {
          where: { status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, currentPeriodEnd: true },
        },
        _count: { select: { members: true, tasks: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.household.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

/** Household 360° 所需的完整聚合数据 */
export async function getHousehold360(user: CurrentUser, householdId: string) {
  assertCan(user, 'household.read');
  const filter = householdScopeFilter(user, householdId);
  if (!filter) return null;

  const household = await prisma.household.findFirst({
    where: filter,
    include: {
      city: true,
      district: true,
      consultant: { select: { id: true, name: true, phone: true, role: true } },
      primarySpecialist: {
        include: {
          user: { select: { id: true, name: true, phone: true, avatarUrl: true } },
          competencies: { include: { competency: true } },
        },
      },
      backupSpecialist: {
        include: { user: { select: { id: true, name: true, phone: true } } },
      },
      primaryContact: { include: { user: { select: { id: true, name: true, phone: true } } } },
      elders: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: {
          _count: { select: { consents: true } },
        },
      },
      members: {
        include: {
          user: { select: { id: true, name: true, phone: true, email: true, status: true } },
          elder: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      servicePlan: { include: { plan: true } },
      assessments: { orderBy: { assessedAt: 'desc' } },
      subscriptions: {
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      },
      orders: { orderBy: { createdAt: 'desc' }, take: 20 },
      specialistChanges: { orderBy: { createdAt: 'desc' }, take: 10 },
      _count: { select: { tasks: true, reports: true, incidents: true, feedbackCases: true } },
    },
  });

  if (!household) return null;

  await auditAs(user, {
    action: 'VIEW_ELDER_PROFILE',
    resource: 'Household',
    resourceId: householdId,
    permissionNote: `role=${user.role} 通过数据范围校验`,
  });

  // 内部备注按能力裁剪，而不是靠前端不渲染
  if (!canSeeInternalNotes(user)) {
    household.internalNotes = null;
  }

  return household;
}

export type CreateHouseholdInput = {
  name: string;
  cityId: string;
  districtId?: string | null;
  addressLine?: string | null;
  consultantId?: string | null;
  serviceNotes?: string | null;
  internalNotes?: string | null;
  status?: HouseholdStatus;
  isDemo?: boolean;
};

export async function createHousehold(user: CurrentUser, input: CreateHouseholdInput) {
  assertCan(user, 'household.create');

  const city = await prisma.city.findUnique({ where: { id: input.cityId } });
  if (!city) throw new Error('城市不存在');

  // 城市负责人只能在自己城市建档
  if ((user.role === 'CITY_LEAD' || user.role === 'AREA_MANAGER') && user.cityId !== input.cityId) {
    throw new Error('只能在自己负责的城市创建家庭');
  }

  const householdCode = await nextHouseholdCode(city.name);

  const household = await prisma.household.create({
    data: {
      householdCode,
      name: input.name,
      cityId: input.cityId,
      districtId: input.districtId ?? undefined,
      addressLine: input.addressLine ?? undefined,
      consultantId: input.consultantId ?? undefined,
      serviceNotes: input.serviceNotes ?? undefined,
      internalNotes: input.internalNotes ?? undefined,
      status: input.status ?? 'LEAD',
      isDemo: input.isDemo ?? false,
    },
  });

  await prisma.timelineEvent.create({
    data: {
      householdId: household.id,
      title: '家庭建档完成',
      detail: `家庭编号 ${householdCode}`,
      refType: 'household',
      refId: household.id,
      requiredPermission: 'SERVICE_SCHEDULE',
      isDemo: input.isDemo ?? false,
    },
  });

  await auditAs(user, {
    action: 'CREATE_HOUSEHOLD',
    resource: 'Household',
    resourceId: household.id,
    after: { householdCode, name: input.name, status: household.status },
  });

  return household;
}

export async function updateHouseholdStatus(
  user: CurrentUser,
  householdId: string,
  status: HouseholdStatus,
) {
  assertCan(user, 'household.update');
  const filter = householdScopeFilter(user, householdId);
  if (!filter) throw new Error('家庭不存在或不在数据范围内');

  const before = await prisma.household.findFirst({ where: filter, select: { status: true } });
  if (!before) throw new Error('家庭不存在或不在数据范围内');

  const updated = await prisma.household.update({
    where: { id: householdId },
    data: {
      status,
      joinedAt:
        status === 'ACTIVE_MEMBER' ? new Date() : undefined,
    },
  });

  await auditAs(user, {
    action: 'UPDATE_HOUSEHOLD',
    resource: 'Household',
    resourceId: householdId,
    before: { status: before.status },
    after: { status },
  });

  return updated;
}

/**
 * 更换固定安心专员。
 * 固定专员制度是品牌承诺，所以更换必须留原因、写时间线、并通知家庭。
 */
export async function changePrimarySpecialist(
  user: CurrentUser,
  householdId: string,
  toStaffProfileId: string | null,
  reason: string,
) {
  assertCan(user, 'household.update');
  const filter = householdScopeFilter(user, householdId);
  if (!filter) throw new Error('家庭不存在或不在数据范围内');
  if (!reason.trim()) throw new Error('更换固定安心专员必须填写原因');

  const household = await prisma.household.findFirst({
    where: filter,
    select: { id: true, primarySpecialistId: true, isDemo: true },
  });
  if (!household) throw new Error('家庭不存在或不在数据范围内');

  if (toStaffProfileId) {
    const target = await prisma.staffProfile.findUnique({
      where: { id: toStaffProfileId },
      select: { serviceStatus: true },
    });
    if (!target) throw new Error('安心专员不存在');
    if (target.serviceStatus !== 'ACTIVE') {
      throw new Error('该安心专员当前不可排班，无法设为固定专员');
    }
  }

  const [updated] = await prisma.$transaction([
    prisma.household.update({
      where: { id: householdId },
      data: { primarySpecialistId: toStaffProfileId },
    }),
    prisma.specialistChangeLog.create({
      data: {
        householdId,
        fromStaffProfileId: household.primarySpecialistId,
        toStaffProfileId,
        reason,
        changedByName: user.name,
      },
    }),
    prisma.timelineEvent.create({
      data: {
        householdId,
        title: '固定家庭安心专员调整',
        detail: reason,
        refType: 'household',
        refId: householdId,
        requiredPermission: 'SERVICE_SCHEDULE',
        isDemo: household.isDemo,
      },
    }),
  ]);

  const { notifyHousehold } = await import('@/lib/notifications');
  await notifyHousehold(householdId, {
    level: 'IMPORTANT',
    title: '固定家庭安心专员有调整',
    body: reason,
    linkUrl: '/family',
    refType: 'household',
    refId: householdId,
    isDemo: household.isDemo,
  });

  await auditAs(user, {
    action: 'REASSIGN_SPECIALIST',
    resource: 'Household',
    resourceId: householdId,
    before: { primarySpecialistId: household.primarySpecialistId },
    after: { primarySpecialistId: toStaffProfileId, reason },
  });

  return updated;
}

/** 家庭时间线（后台视角，含内部事件） */
export async function getHouseholdTimeline(user: CurrentUser, householdId: string, take = 50) {
  assertCan(user, 'household.read');
  const filter = householdScopeFilter(user, householdId);
  if (!filter) return [];
  const exists = await prisma.household.findFirst({ where: filter, select: { id: true } });
  if (!exists) return [];

  return prisma.timelineEvent.findMany({
    where: {
      householdId,
      ...(canSeeInternalNotes(user) ? {} : { internalOnly: false }),
    },
    orderBy: { occurredAt: 'desc' },
    take,
  });
}

/* ==========================================================================
 * 家庭成员与执行计划
 * ======================================================================== */

export type AddFamilyMemberInput = {
  householdId: string;
  name: string;
  phone: string;
  email?: string | null;
  relationship: RelationshipType;
  elderId?: string | null;
  isPayer?: boolean;
  isPrimaryContact?: boolean;
  isEmergencyContact?: boolean;
  /** 初始密码。第一版没有短信渠道，所以由顾问当面/电话告知本人。 */
  password: string;
  isDemo?: boolean;
};

/**
 * 加入家庭成员（顺带创建家庭端帐号）。
 *
 * 这是「从零建一户」链条上的一环：家庭建档后必须能在界面上把子女加进来，
 * 否则家庭端根本没人能登录。
 *
 * 注意：创建成员**不会**顺带给任何授权。
 * 授权必须在长辈本人（或法定监护人）同意后，到「授权管理」逐项建立 ——
 * 这正是「付款权 ≠ 数据查看权」的落地方式。
 */
export async function addFamilyMember(user: CurrentUser, input: AddFamilyMemberInput) {
  assertCan(user, 'familyMember.manage');

  const filter = householdScopeFilter(user, input.householdId);
  if (!filter) throw new Error('家庭不存在或不在数据范围内');
  const household = await prisma.household.findFirst({
    where: filter,
    select: { id: true, name: true, isDemo: true, primaryContactId: true },
  });
  if (!household) throw new Error('家庭不存在或不在数据范围内');

  const phone = input.phone.replace(/\s|-/g, '');
  if (!/^\d{6,20}$/.test(phone)) throw new Error('手机号格式不正确');

  const { hashPassword, validatePasswordStrength } = await import('@/lib/auth/password');
  const strength = validatePasswordStrength(input.password);
  if (!strength.ok) throw new Error(strength.message ?? '初始密码强度不足');

  if (input.elderId) {
    const elder = await prisma.elder.findFirst({
      where: { id: input.elderId, householdId: household.id, deletedAt: null },
      select: { id: true },
    });
    if (!elder) throw new Error('所选长辈不属于这个家庭');
  }

  const existing = await prisma.user.findUnique({
    where: { phone },
    include: { familyMembers: { select: { householdId: true } } },
  });

  if (existing) {
    if (existing.role !== 'FAMILY_MEMBER') {
      throw new Error('这个手机号已被内部帐号占用，请换一个号码');
    }
    if (existing.familyMembers.some((m) => m.householdId === household.id)) {
      throw new Error('这个人已经是该家庭的成员了');
    }
  }

  const passwordHash = await hashPassword(input.password);

  const member = await prisma.$transaction(async (tx) => {
    const account =
      existing ??
      (await tx.user.create({
        data: {
          name: input.name,
          phone,
          email: input.email || undefined,
          role: 'FAMILY_MEMBER',
          passwordHash,
          status: 'ACTIVE',
          isDemo: input.isDemo ?? household.isDemo,
        },
      }));

    const created = await tx.familyMember.create({
      data: {
        userId: account.id,
        householdId: household.id,
        elderId: input.elderId ?? undefined,
        relationship: input.relationship,
        isPayer: input.isPayer ?? false,
        isPrimaryContact: input.isPrimaryContact ?? false,
        isEmergencyContact: input.isEmergencyContact ?? false,
        isDemo: input.isDemo ?? household.isDemo,
      },
    });

    // 设为主要联络人时，把原来的主要联络人标记取消，保持唯一
    if (input.isPrimaryContact) {
      await tx.familyMember.updateMany({
        where: { householdId: household.id, id: { not: created.id } },
        data: { isPrimaryContact: false },
      });
      await tx.household.update({
        where: { id: household.id },
        data: { primaryContactId: created.id },
      });
    }

    return created;
  });

  await prisma.timelineEvent.create({
    data: {
      householdId: household.id,
      title: '家庭成员已加入',
      detail: `${input.name}（${RELATIONSHIP_LABELS[input.relationship]}）`,
      refType: 'family_member',
      refId: member.id,
      requiredPermission: 'SERVICE_SCHEDULE',
      isDemo: input.isDemo ?? household.isDemo,
    },
  });

  await auditAs(user, {
    action: 'CREATE_FAMILY_MEMBER',
    resource: 'FamilyMember',
    resourceId: member.id,
    after: {
      householdId: household.id,
      name: input.name,
      relationship: input.relationship,
      isPayer: member.isPayer,
      reusedExistingAccount: !!existing,
      grantedConsents: 0,
    },
    permissionNote: '新增成员不附带任何授权，授权须另行建立',
  });

  return member;
}

/** 调整成员的角色标记（付款人 / 主要联络人 / 紧急联络人） */
export async function updateFamilyMemberFlags(
  user: CurrentUser,
  memberId: string,
  flags: { isPayer?: boolean; isPrimaryContact?: boolean; isEmergencyContact?: boolean },
) {
  assertCan(user, 'familyMember.manage');

  const member = await prisma.familyMember.findUnique({
    where: { id: memberId },
    select: { id: true, householdId: true, isPayer: true, isPrimaryContact: true, isEmergencyContact: true },
  });
  if (!member) throw new Error('成员不存在');

  const filter = householdScopeFilter(user, member.householdId);
  if (!filter) throw new Error('不在数据范围内');
  const inScope = await prisma.household.findFirst({ where: filter, select: { id: true } });
  if (!inScope) throw new Error('不在数据范围内');

  const updated = await prisma.$transaction(async (tx) => {
    if (flags.isPrimaryContact) {
      await tx.familyMember.updateMany({
        where: { householdId: member.householdId, id: { not: memberId } },
        data: { isPrimaryContact: false },
      });
      await tx.household.update({
        where: { id: member.householdId },
        data: { primaryContactId: memberId },
      });
    }
    return tx.familyMember.update({ where: { id: memberId }, data: flags });
  });

  await auditAs(user, {
    action: 'UPDATE_FAMILY_MEMBER',
    resource: 'FamilyMember',
    resourceId: memberId,
    before: {
      isPayer: member.isPayer,
      isPrimaryContact: member.isPrimaryContact,
      isEmergencyContact: member.isEmergencyContact,
    },
    after: flags,
  });

  return updated;
}

export type UpsertHouseholdPlanInput = {
  householdId: string;
  planId?: string | null;
  visitsPerWeek: number;
  phoneCarePerWeek: number;
  reportsPerWeek: number;
  preferredWeekday?: number | null;
  preferredWindow?: string | null;
  executionNotes?: string | null;
};

/** 制定 / 调整家庭执行计划 —— 真正被排班引用的对象 */
export async function upsertHouseholdPlan(user: CurrentUser, input: UpsertHouseholdPlanInput) {
  assertCan(user, 'household.update');

  const filter = householdScopeFilter(user, input.householdId);
  if (!filter) throw new Error('家庭不存在或不在数据范围内');
  const household = await prisma.household.findFirst({
    where: filter,
    select: { id: true, isDemo: true },
  });
  if (!household) throw new Error('家庭不存在或不在数据范围内');

  for (const [label, v] of [
    ['每周上门', input.visitsPerWeek],
    ['每周电话关怀', input.phoneCarePerWeek],
    ['每周安心报告', input.reportsPerWeek],
  ] as const) {
    if (v < 0 || v > 21) throw new Error(`${label}次数需在 0 到 21 之间`);
  }
  if (
    input.preferredWeekday != null &&
    (input.preferredWeekday < 0 || input.preferredWeekday > 6)
  ) {
    throw new Error('偏好星期取值应为 0（周日）到 6（周六）');
  }

  const before = await prisma.householdServicePlan.findUnique({
    where: { householdId: household.id },
  });

  const data = {
    planId: input.planId ?? null,
    visitsPerWeek: input.visitsPerWeek,
    phoneCarePerWeek: input.phoneCarePerWeek,
    reportsPerWeek: input.reportsPerWeek,
    preferredWeekday: input.preferredWeekday ?? null,
    preferredWindow: input.preferredWindow ?? null,
    executionNotes: input.executionNotes ?? null,
    isActive: true,
  };

  const result = await prisma.householdServicePlan.upsert({
    where: { householdId: household.id },
    create: { householdId: household.id, ...data, isDemo: household.isDemo },
    update: data,
  });

  await auditAs(user, {
    action: 'UPDATE_HOUSEHOLD_PLAN',
    resource: 'HouseholdServicePlan',
    resourceId: result.id,
    before: before
      ? {
          visitsPerWeek: before.visitsPerWeek,
          phoneCarePerWeek: before.phoneCarePerWeek,
          preferredWeekday: before.preferredWeekday,
        }
      : { existed: false },
    after: {
      visitsPerWeek: result.visitsPerWeek,
      phoneCarePerWeek: result.phoneCarePerWeek,
      preferredWeekday: result.preferredWeekday,
    },
  });

  return result;
}
