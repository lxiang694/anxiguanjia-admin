import 'server-only';

import type { PermissionType } from '@prisma/client';

import type { CurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Consent 授权判定 —— 系统最重要的隐私原则的执行点。
 *
 *      付款权 ≠ 数据查看权
 *
 * 子女支付服务费，不代表自动获得父母全部个人健康信息。
 * 家庭成员对某位长辈某类数据的每一次访问，都必须能在 Consent 表里找到一条
 * 有效（未过期、未撤回）的授权记录。
 */

export type ConsentDecision = {
  allowed: boolean;
  /** 记录判定依据，写入审计日志的 permissionNote */
  reason: string;
  consentId?: string;
};

const DENY_NO_CONSENT = '未找到有效授权记录';

/** 判断一条 Consent 在当下是否有效 */
export function isConsentEffective(c: {
  status: string;
  revokedAt: Date | null;
  expiresAt: Date | null;
}): boolean {
  if (c.status !== 'ACTIVE') return false;
  if (c.revokedAt) return false;
  if (c.expiresAt && c.expiresAt < new Date()) return false;
  return true;
}

/**
 * 家庭成员能否查看某位长辈的某类数据。
 * 注意：这里不因为「他是付款人」或「他是主要联络人」而放宽任何一项。
 */
export async function checkElderConsent(
  user: CurrentUser,
  elderId: string,
  permission: PermissionType,
): Promise<ConsentDecision> {
  // 长辈必须在该家庭成员所属家庭内 —— 先做归属校验，避免跨家庭探测
  const elder = await prisma.elder.findFirst({
    where: { id: elderId, deletedAt: null, householdId: { in: user.householdIds } },
    select: { id: true },
  });
  if (!elder) {
    return { allowed: false, reason: '长辈不属于该用户所在家庭' };
  }

  const consent = await prisma.consent.findFirst({
    where: {
      elderId,
      granteeId: user.id,
      permissionType: permission,
      status: 'ACTIVE',
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, basis: true },
  });

  if (!consent) return { allowed: false, reason: DENY_NO_CONSENT };

  return {
    allowed: true,
    reason: `Consent#${consent.id} v${consent.version} basis=${consent.basis}`,
    consentId: consent.id,
  };
}

/** 一次性取出该家庭成员对某长辈拥有的全部有效授权类型 */
export async function grantedPermissionsFor(
  user: CurrentUser,
  elderId: string,
): Promise<Set<PermissionType>> {
  if (user.householdIds.length === 0) return new Set();
  const rows = await prisma.consent.findMany({
    where: {
      elderId,
      granteeId: user.id,
      status: 'ACTIVE',
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      elder: { householdId: { in: user.householdIds } },
    },
    select: { permissionType: true },
  });
  return new Set(rows.map((r) => r.permissionType));
}

/** 家庭内全部长辈的授权映射：elderId → 授权类型集合 */
export async function grantedPermissionsByElder(
  user: CurrentUser,
  householdId: string,
): Promise<Map<string, Set<PermissionType>>> {
  const map = new Map<string, Set<PermissionType>>();
  if (!user.householdIds.includes(householdId)) return map;

  const rows = await prisma.consent.findMany({
    where: {
      granteeId: user.id,
      status: 'ACTIVE',
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      elder: { householdId },
    },
    select: { elderId: true, permissionType: true },
  });

  for (const r of rows) {
    if (!map.has(r.elderId)) map.set(r.elderId, new Set());
    map.get(r.elderId)!.add(r.permissionType);
  }
  return map;
}

/**
 * 一线安心专员对健康敏感信息的访问：
 * 默认拒绝。即使被派到该家庭，也不因此获得慢性病与用药资料。
 * 只有当能力清单里明确具备 elder.sensitive.read 时才可能通过（专员角色不具备）。
 */
export function specialistMaySeeSensitive(): boolean {
  return false;
}
