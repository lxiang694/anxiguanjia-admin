import 'server-only';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Role } from '@prisma/client';

import { prisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { verifyPassword } from './password';
import {
  SESSION_COOKIE,
  hashToken,
  sessionMaxAgeSeconds,
  signSessionToken,
  verifySessionToken,
} from './session';

export type CurrentUser = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  avatarUrl: string | null;
  role: Role;
  cityId: string | null;
  sessionId: string;
  /** 若该用户是安心专员，带上其档案 id 与可排班状态 */
  staffProfileId: string | null;
  staffServiceStatus: string | null;
  /** 若该用户是家庭成员，带上其所属家庭 id 列表（通常只有一个） */
  householdIds: string[];
  isDemo: boolean;
};

/** 读取当前登录用户。未登录返回 null。 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const tokenHash = await hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          staffProfile: { select: { id: true, serviceStatus: true } },
          familyMembers: { select: { householdId: true } },
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  const user = session.user;
  if (!user || user.deletedAt || user.status !== 'ACTIVE') return null;

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    cityId: user.cityId,
    sessionId: session.id,
    staffProfileId: user.staffProfile?.id ?? null,
    staffServiceStatus: user.staffProfile?.serviceStatus ?? null,
    householdIds: user.familyMembers.map((m) => m.householdId),
    isDemo: user.isDemo,
  };
}

/** 必须登录，否则跳转登录页并带回跳地址。 */
export async function requireUser(returnTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login';
    redirect(target);
  }
  return user;
}

export type LoginResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; error: string };

async function requestMeta() {
  try {
    const h = await headers();
    const ip =
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      h.get('x-real-ip') ??
      null;
    return { ip, userAgent: h.get('user-agent') };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/**
 * 登录。
 * 失败时统一返回「手机号或密码不正确」，不透露帐号是否存在。
 */
export async function login(phone: string, password: string): Promise<LoginResult> {
  const normalized = phone.replace(/\s|-/g, '');
  const user = await prisma.user.findUnique({ where: { phone: normalized } });

  const GENERIC = '手机号或密码不正确';

  if (!user || user.deletedAt) return { ok: false, error: GENERIC };
  if (user.status === 'SUSPENDED') return { ok: false, error: '帐号已暂停，请联系管理员' };
  if (user.status === 'DISABLED') return { ok: false, error: '帐号已停用，请联系管理员' };

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await writeAudit({
      userId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'LOGIN_FAILED',
      resource: 'User',
      resourceId: user.id,
    });
    return { ok: false, error: GENERIC };
  }

  const { ip, userAgent } = await requestMeta();
  const maxAge = sessionMaxAgeSeconds();
  const expiresAt = new Date(Date.now() + maxAge * 1000);

  // 先建会话记录拿到 sid，再签发含 sid 的 token，最后回填 tokenHash。
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: `pending:${crypto.randomUUID()}`,
      userAgent: userAgent ?? undefined,
      ipAddress: ip ?? undefined,
      expiresAt,
    },
  });

  const token = await signSessionToken({
    sub: user.id,
    sid: session.id,
    role: user.role,
    name: user.name,
  });

  await prisma.session.update({
    where: { id: session.id },
    data: { tokenHash: await hashToken(token) },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await writeAudit({
    userId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: 'LOGIN',
    resource: 'User',
    resourceId: user.id,
    ipAddress: ip,
    userAgent,
  });

  const fresh = await getCurrentUser();
  if (!fresh) return { ok: false, error: '会话建立失败，请重试' };
  return { ok: true, user: fresh };
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const tokenHash = await hashToken(token);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, name: true, role: true } } },
    });
    if (session) {
      await prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      await writeAudit({
        userId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        action: 'LOGOUT',
        resource: 'User',
        resourceId: session.user.id,
      });
    }
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** 登录后按角色决定落地页 —— 三个端共享同一后端与同一套帐号体系 */
export function landingPathForRole(role: Role): string {
  switch (role) {
    case 'FAMILY_MEMBER':
      return '/family';
    case 'CARE_SPECIALIST':
    case 'SENIOR_CARE_SPECIALIST':
    case 'FAMILY_CONSULTANT':
      return '/staff';
    default:
      return '/admin';
  }
}

export { hashPassword, validatePasswordStrength } from './password';
