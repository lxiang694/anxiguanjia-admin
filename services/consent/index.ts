import 'server-only';

import type { ConsentBasis, PermissionType } from '@prisma/client';

import type { CurrentUser } from '@/lib/auth';
import { auditAs } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { assertCan, householdScopeFilter } from '@/lib/permissions';
import { PERMISSION_LABELS } from '@/lib/labels';

/**
 * 授权管理。
 *
 * 每一次授权变更都会：
 *  1. 以「新版本」方式记录，而不是覆盖旧记录 —— 旧授权是历史事实，必须留存。
 *  2. 写审计日志（GRANT_CONSENT / REVOKE_CONSENT）。
 *  3. 写家庭时间线，让家庭看得到自己的授权被谁在什么时候改过。
 */

export type GrantConsentInput = {
  elderId: string;
  grantorId: string;
  granteeId: string;
  permissionType: PermissionType;
  scope?: string | null;
  expiresAt?: Date | null;
  basis?: ConsentBasis;
  evidenceKey?: string | null;
  isDemo?: boolean;
};

export async function listConsentsForHousehold(user: CurrentUser, householdId: string) {
  assertCan(user, 'consent.read');
  const filter = householdScopeFilter(user, householdId);
  if (!filter) return [];
  const exists = await prisma.household.findFirst({ where: filter, select: { id: true } });
  if (!exists) return [];

  return prisma.consent.findMany({
    where: { elder: { householdId, deletedAt: null } },
    include: {
      elder: { select: { id: true, name: true } },
      grantor: { select: { id: true, name: true } },
      grantee: { select: { id: true, name: true, role: true } },
    },
    orderBy: [{ elderId: 'asc' }, { permissionType: 'asc' }, { version: 'desc' }],
  });
}

export async function grantConsent(user: CurrentUser, input: GrantConsentInput) {
  assertCan(user, 'consent.manage');

  const elder = await prisma.elder.findFirst({
    where: { id: input.elderId, deletedAt: null },
    select: { id: true, name: true, householdId: true, isDemo: true },
  });
  if (!elder) throw new Error('长辈档案不存在');

  const filter = householdScopeFilter(user, elder.householdId);
  if (!filter) throw new Error('不在数据范围内');
  const inScope = await prisma.household.findFirst({ where: filter, select: { id: true } });
  if (!inScope) throw new Error('不在数据范围内');

  // 被授权人必须是该家庭的成员 —— 不允许把长辈数据授权给家庭外的人
  const grantee = await prisma.familyMember.findFirst({
    where: { userId: input.granteeId, householdId: elder.householdId },
    select: { id: true, user: { select: { name: true } } },
  });
  if (!grantee) throw new Error('被授权人不是该家庭的成员');

  // 取同一组合的最新版本号 +1
  const latest = await prisma.consent.findFirst({
    where: {
      elderId: input.elderId,
      granteeId: input.granteeId,
      permissionType: input.permissionType,
    },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, status: true },
  });

  const consent = await prisma.$transaction(async (tx) => {
    // 同一权限若已有有效版本，先置为已撤回，再建新版本，保持「同时只有一条有效」
    if (latest && latest.status === 'ACTIVE') {
      await tx.consent.update({
        where: { id: latest.id },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
    }
    return tx.consent.create({
      data: {
        elderId: input.elderId,
        grantorId: input.grantorId,
        granteeId: input.granteeId,
        permissionType: input.permissionType,
        scope: input.scope ?? undefined,
        expiresAt: input.expiresAt ?? undefined,
        basis: input.basis ?? 'ELDER_SELF_SIGNED',
        evidenceKey: input.evidenceKey ?? undefined,
        version: (latest?.version ?? 0) + 1,
        status: 'ACTIVE',
        isDemo: input.isDemo ?? elder.isDemo,
      },
    });
  });

  await prisma.timelineEvent.create({
    data: {
      householdId: elder.householdId,
      elderId: elder.id,
      title: '授权已建立',
      detail: `${grantee.user.name} 获得「${PERMISSION_LABELS[input.permissionType]}」查看权限`,
      refType: 'consent',
      refId: consent.id,
      requiredPermission: 'SERVICE_SCHEDULE',
      isDemo: input.isDemo ?? elder.isDemo,
    },
  });

  await auditAs(user, {
    action: 'GRANT_CONSENT',
    resource: 'Consent',
    resourceId: consent.id,
    after: {
      elderId: input.elderId,
      granteeId: input.granteeId,
      permissionType: input.permissionType,
      version: consent.version,
      basis: consent.basis,
    },
  });

  return consent;
}

export async function revokeConsent(user: CurrentUser, consentId: string, reason?: string) {
  assertCan(user, 'consent.manage');

  const consent = await prisma.consent.findUnique({
    where: { id: consentId },
    include: {
      elder: { select: { id: true, householdId: true, isDemo: true } },
      grantee: { select: { name: true } },
    },
  });
  if (!consent) throw new Error('授权记录不存在');

  const filter = householdScopeFilter(user, consent.elder.householdId);
  if (!filter) throw new Error('不在数据范围内');
  const inScope = await prisma.household.findFirst({ where: filter, select: { id: true } });
  if (!inScope) throw new Error('不在数据范围内');

  if (consent.status !== 'ACTIVE') return consent;

  const updated = await prisma.consent.update({
    where: { id: consentId },
    data: {
      status: 'REVOKED',
      revokedAt: new Date(),
      scope: reason ? `${consent.scope ?? ''}\n撤回原因：${reason}`.trim() : consent.scope,
    },
  });

  await prisma.timelineEvent.create({
    data: {
      householdId: consent.elder.householdId,
      elderId: consent.elder.id,
      title: '授权已撤回',
      detail: `${consent.grantee.name} 的「${PERMISSION_LABELS[consent.permissionType]}」查看权限已撤回`,
      refType: 'consent',
      refId: consentId,
      requiredPermission: 'SERVICE_SCHEDULE',
      isDemo: consent.elder.isDemo,
    },
  });

  await auditAs(user, {
    action: 'REVOKE_CONSENT',
    resource: 'Consent',
    resourceId: consentId,
    before: { status: 'ACTIVE' },
    after: { status: 'REVOKED', reason: reason ?? null },
  });

  return updated;
}

/** 家庭端自助撤回：只能撤回「授权给自己家庭成员」且自己是授权人的记录 */
export async function revokeConsentByGrantor(user: CurrentUser, consentId: string) {
  const consent = await prisma.consent.findFirst({
    where: { id: consentId, grantorId: user.id, status: 'ACTIVE' },
    include: { elder: { select: { id: true, householdId: true, isDemo: true } }, grantee: { select: { name: true } } },
  });
  if (!consent) throw new Error('未找到可撤回的授权记录');

  const updated = await prisma.consent.update({
    where: { id: consentId },
    data: { status: 'REVOKED', revokedAt: new Date() },
  });

  await prisma.timelineEvent.create({
    data: {
      householdId: consent.elder.householdId,
      elderId: consent.elder.id,
      title: '授权已由家庭撤回',
      detail: `${consent.grantee.name} 的「${PERMISSION_LABELS[consent.permissionType]}」查看权限已撤回`,
      refType: 'consent',
      refId: consentId,
      requiredPermission: 'SERVICE_SCHEDULE',
      isDemo: consent.elder.isDemo,
    },
  });

  await auditAs(user, {
    action: 'REVOKE_CONSENT',
    resource: 'Consent',
    resourceId: consentId,
    after: { status: 'REVOKED', by: 'grantor' },
  });

  return updated;
}

/** 授权矩阵：家庭端「谁可以看什么」的展示数据 */
export async function consentMatrixForHousehold(householdId: string) {
  const [elders, members, consents] = await Promise.all([
    prisma.elder.findMany({
      where: { householdId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.familyMember.findMany({
      where: { householdId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.consent.findMany({
      where: {
        elder: { householdId, deletedAt: null },
        status: 'ACTIVE',
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true, elderId: true, granteeId: true, permissionType: true, expiresAt: true, grantorId: true },
    }),
  ]);

  return { elders, members, consents };
}
