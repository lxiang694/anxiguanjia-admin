import 'server-only';

import { notFound, redirect } from 'next/navigation';
import type { Role } from '@prisma/client';

import { type CurrentUser, getCurrentUser, landingPathForRole } from '@/lib/auth';
import { auditAs } from '@/lib/audit';
import { type Capability, ADMIN_ROLES, FAMILY_ROLES, STAFF_ROLES, roleHas } from './capabilities';

export * from './capabilities';
export * from './scope';
export * from './consent';

/** 权限不足时抛出的错误。Server Action 捕获后返回结构化错误，页面则渲染 403。 */
export class PermissionError extends Error {
  constructor(message = '权限不足') {
    super(message);
    this.name = 'PermissionError';
  }
}

export function can(user: CurrentUser | null, capability: Capability): boolean {
  if (!user) return false;
  return roleHas(user.role, capability);
}

/** 断言能力。用于 Server Action 入口。 */
export function assertCan(user: CurrentUser | null, capability: Capability): void {
  if (!can(user, capability)) {
    throw new PermissionError(`缺少权限：${capability}`);
  }
}

/**
 * 页面级守卫：要求登录 + 具备指定能力。
 * 不具备时记录一条 PERMISSION_DENIED 审计日志再渲染 403，便于事后复查越权尝试。
 */
export async function guardPage(
  capability: Capability,
  opts?: { returnTo?: string; resource?: string },
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(opts?.returnTo ? `/login?next=${encodeURIComponent(opts.returnTo)}` : '/login');
  }
  if (!roleHas(user.role, capability)) {
    await auditAs(user, {
      action: 'PERMISSION_DENIED',
      resource: opts?.resource ?? 'Page',
      permissionNote: `缺少 ${capability}`,
    });
    redirect(`/forbidden?cap=${encodeURIComponent(capability)}`);
  }
  return user;
}

/** 端级守卫：/admin、/staff、/family 三个入口的准入判定 */
export async function guardPortal(portal: 'admin' | 'staff' | 'family'): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/${portal}`);

  const allowed: Role[] =
    portal === 'admin' ? ADMIN_ROLES : portal === 'staff' ? STAFF_ROLES : FAMILY_ROLES;

  if (!allowed.includes(user.role)) {
    // 走错端不是越权，直接送回自己的落地页，体验上更顺
    redirect(landingPathForRole(user.role));
  }
  return user;
}

/**
 * 断言当前用户可访问某个家庭。找不到（或不在范围内）一律按 404 处理，
 * 不返回 403 —— 避免通过响应码差异探测「这个家庭是否存在」。
 */
export async function assertHouseholdAccess(
  user: CurrentUser,
  householdId: string,
): Promise<void> {
  const { prisma } = await import('@/lib/db');
  const { householdScopeFilter } = await import('./scope');
  const filter = householdScopeFilter(user, householdId);
  if (!filter) notFound();
  const found = await prisma.household.findFirst({ where: filter, select: { id: true } });
  if (!found) {
    await auditAs(user, {
      action: 'PERMISSION_DENIED',
      resource: 'Household',
      resourceId: householdId,
      permissionNote: '不在数据范围内',
    });
    notFound();
  }
}

/** 是否可查看健康敏感信息（能力 + 角色双重确认） */
export function canSeeSensitiveHealth(user: CurrentUser | null): boolean {
  if (!user) return false;
  if (STAFF_ROLES.includes(user.role)) return false; // 一线专员一律不可
  if (user.role === 'FINANCE') return false;
  return roleHas(user.role, 'elder.sensitive.read');
}

/** 是否可查看内部备注 */
export function canSeeInternalNotes(user: CurrentUser | null): boolean {
  return can(user, 'household.internalNotes.read');
}
