import 'server-only';

import type { Gender, LivingStatus, MobilityStatus } from '@prisma/client';

import type { CurrentUser } from '@/lib/auth';
import { auditAs } from '@/lib/audit';
import { prisma } from '@/lib/db';
import {
  assertCan,
  canSeeSensitiveHealth,
  householdScopeFilter,
  householdScopeWhere,
} from '@/lib/permissions';

/**
 * 长辈安心档案。
 *
 * 刻意不做成电子病历：主体是生活情况、生活需要、沟通偏好与注意事项。
 * 健康敏感信息（慢性情况 / 用药 / 健康数值）放在独立表 ElderSensitiveInfo，
 * 读取需要 elder.sensitive.read 能力，一线安心专员一律不可见。
 */

export async function listElders(user: CurrentUser, q?: string) {
  assertCan(user, 'elder.read');
  const scope = householdScopeWhere(user);
  if (!scope) return [];

  return prisma.elder.findMany({
    where: {
      deletedAt: null,
      household: scope,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      household: {
        select: {
          id: true,
          name: true,
          householdCode: true,
          status: true,
          district: { select: { name: true } },
          primarySpecialist: { include: { user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

/**
 * 长辈档案详情。
 * sensitive 字段按能力裁剪：无权限时返回 null，而不是返回后由前端隐藏。
 */
export async function getElder(user: CurrentUser, elderId: string) {
  assertCan(user, 'elder.read');
  const scope = householdScopeWhere(user);
  if (!scope) return null;

  const includeSensitive = canSeeSensitiveHealth(user);

  const base = await prisma.elder.findFirst({
    where: { id: elderId, deletedAt: null, household: scope },
    include: {
      household: {
        select: {
          id: true,
          name: true,
          householdCode: true,
          status: true,
          serviceNotes: true,
          district: { select: { name: true } },
          primarySpecialist: { include: { user: { select: { name: true } } } },
          consultant: { select: { name: true } },
        },
      },
      familyMembers: {
        include: { user: { select: { id: true, name: true, phone: true } } },
      },
      consents: {
        include: {
          grantee: { select: { id: true, name: true } },
          grantor: { select: { id: true, name: true } },
        },
        orderBy: [{ permissionType: 'asc' }, { version: 'desc' }],
      },
      _count: { select: { tasks: true, visitRecords: true, reports: true } },
    },
  });

  if (!base) return null;

  /**
   * 健康敏感信息与健康数值单独查询：
   * 没有权限时这两条查询根本不会发出，敏感数据不会离开数据库。
   * （刻意不用「一次查回来再交给前端隐藏」的写法。）
   */
  const [sensitive, readings] = includeSensitive
    ? await Promise.all([
        prisma.elderSensitiveInfo.findUnique({ where: { elderId } }),
        prisma.healthReading.findMany({
          where: { elderId },
          orderBy: { measuredAt: 'desc' },
          take: 20,
        }),
      ])
    : [null, null];

  const elder = { ...base, sensitive, readings };

  await auditAs(user, {
    action: includeSensitive ? 'VIEW_SENSITIVE_HEALTH' : 'VIEW_ELDER_PROFILE',
    resource: 'Elder',
    resourceId: elderId,
    permissionNote: includeSensitive
      ? `role=${user.role} 具备 elder.sensitive.read`
      : `role=${user.role} 仅生活档案，敏感健康信息未返回`,
  });

  return elder;
}

export type CreateElderInput = {
  householdId: string;
  name: string;
  gender?: Gender;
  birthday?: Date | null;
  phone?: string | null;
  address?: string | null;
  livingStatus?: LivingStatus | null;
  mobilityStatus?: MobilityStatus;
  dailyRoutine?: string | null;
  activityNotes?: string | null;
  dietNotes?: string | null;
  sleepNotes?: string | null;
  communicationPrefs?: string | null;
  livingArrangement?: string | null;
  familyRelations?: string | null;
  dailyNeeds?: string | null;
  attentionNotes?: string | null;
  emergencyArrangement?: string | null;
  generalNotes?: string | null;
  isDemo?: boolean;
};

export async function createElder(user: CurrentUser, input: CreateElderInput) {
  assertCan(user, 'elder.update');

  const filter = householdScopeFilter(user, input.householdId);
  if (!filter) throw new Error('家庭不存在或不在数据范围内');
  const household = await prisma.household.findFirst({
    where: filter,
    select: { id: true, isDemo: true },
  });
  if (!household) throw new Error('家庭不存在或不在数据范围内');

  const { householdId: _hh, isDemo: _demo, ...rest } = input;

  const elder = await prisma.elder.create({
    data: {
      householdId: household.id,
      ...rest,
      gender: input.gender ?? 'UNDISCLOSED',
      mobilityStatus: input.mobilityStatus ?? 'UNKNOWN',
      birthday: input.birthday ?? undefined,
      isDemo: input.isDemo ?? household.isDemo,
    },
  });

  await prisma.timelineEvent.create({
    data: {
      householdId: household.id,
      elderId: elder.id,
      title: '长辈安心档案已建立',
      detail: elder.name,
      refType: 'elder',
      refId: elder.id,
      requiredPermission: 'SERVICE_SCHEDULE',
      isDemo: elder.isDemo,
    },
  });

  await auditAs(user, {
    action: 'UPDATE_ELDER',
    resource: 'Elder',
    resourceId: elder.id,
    after: { name: elder.name, householdId: household.id, created: true },
  });

  return elder;
}

export async function updateElder(
  user: CurrentUser,
  elderId: string,
  patch: Partial<Omit<CreateElderInput, 'householdId' | 'isDemo'>>,
) {
  assertCan(user, 'elder.update');
  const scope = householdScopeWhere(user);
  if (!scope) throw new Error('不在数据范围内');

  const before = await prisma.elder.findFirst({
    where: { id: elderId, deletedAt: null, household: scope },
  });
  if (!before) throw new Error('长辈档案不存在或不在数据范围内');

  const updated = await prisma.elder.update({
    where: { id: elderId },
    data: { ...patch, birthday: patch.birthday ?? undefined },
  });

  await auditAs(user, {
    action: 'UPDATE_ELDER',
    resource: 'Elder',
    resourceId: elderId,
    before: {
      name: before.name,
      mobilityStatus: before.mobilityStatus,
      attentionNotes: before.attentionNotes,
    },
    after: { ...patch, birthday: patch.birthday?.toISOString() ?? undefined },
  });

  return updated;
}

/**
 * 健康敏感信息写入。
 * 单独成方法，单独审计 —— 这类操作必须能被清楚地追溯到人。
 */
export async function upsertSensitiveInfo(
  user: CurrentUser,
  elderId: string,
  patch: {
    chronicConditions?: string | null;
    medications?: string | null;
    allergies?: string | null;
    medicalDocsNotes?: string | null;
    bpSystolicMax?: number | null;
    bpDiastolicMax?: number | null;
    glucoseMax?: number | null;
  },
) {
  assertCan(user, 'elder.sensitive.update');
  const scope = householdScopeWhere(user);
  if (!scope) throw new Error('不在数据范围内');

  const elder = await prisma.elder.findFirst({
    where: { id: elderId, deletedAt: null, household: scope },
    select: { id: true },
  });
  if (!elder) throw new Error('长辈档案不存在或不在数据范围内');

  const before = await prisma.elderSensitiveInfo.findUnique({ where: { elderId } });

  const data = {
    chronicConditions: patch.chronicConditions ?? undefined,
    medications: patch.medications ?? undefined,
    allergies: patch.allergies ?? undefined,
    medicalDocsNotes: patch.medicalDocsNotes ?? undefined,
    bpSystolicMax: patch.bpSystolicMax ?? undefined,
    bpDiastolicMax: patch.bpDiastolicMax ?? undefined,
    glucoseMax: patch.glucoseMax ?? undefined,
    updatedById: user.id,
  };

  const result = await prisma.elderSensitiveInfo.upsert({
    where: { elderId },
    create: { elderId, ...data },
    update: data,
  });

  await auditAs(user, {
    action: 'UPDATE_SENSITIVE_HEALTH',
    resource: 'ElderSensitiveInfo',
    resourceId: result.id,
    // 只记录「哪些字段被改过」，不把慢性病与用药明文再落一份到日志里
    before: { existed: !!before, fields: before ? Object.keys(before) : [] },
    after: { changedFields: Object.keys(patch) },
  });

  return result;
}
