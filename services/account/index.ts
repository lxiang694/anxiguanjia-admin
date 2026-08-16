import 'server-only';

import type { Prisma, Role, StaffLevel, UserStatus } from '@prisma/client';

import type { CurrentUser } from '@/lib/auth';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { auditAs } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { nextEmployeeCode } from '@/lib/ids';
import { assertCan, STAFF_ROLES } from '@/lib/permissions';

/**
 * 帐号管理。
 *
 * 这一层解决的是「系统上线第一天怎么把人放进来」——
 * 之前只有 seed 能造帐号，运营与人事在界面上无法新建成员，这是个硬缺口。
 *
 * 三条纪律：
 *  1. 创建帐号绝不返回明文密码给页面渲染，而是要求操作人当场设定初始密码并当面/电话告知。
 *     （既不发短信也不发邮件 —— 第一版没有接这些渠道，不能假装发了。）
 *  2. 一线岗位（专员 / 资深专员 / 顾问）建帐号时同时建立 StaffProfile，
 *     且初始服务状态一律是 NOT_STARTED —— 新人不可能一入职就能被派单。
 *  3. 每一次建号、改状态、重置密码都写审计日志。
 */

export type ListUsersFilters = {
  q?: string;
  role?: Role | 'ALL';
  status?: UserStatus | 'ALL';
  /** 是否只看一线岗位 */
  staffOnly?: boolean;
};

export async function listUsers(user: CurrentUser, filters: ListUsersFilters = {}) {
  assertCan(user, 'user.read');

  const and: Prisma.UserWhereInput[] = [{ deletedAt: null }];

  // 家庭成员帐号不在「内部帐号」页管理 —— 它们属于某个家庭，在家庭 360° 里维护
  and.push({ role: { not: 'FAMILY_MEMBER' } });

  if (filters.role && filters.role !== 'ALL') and.push({ role: filters.role });
  if (filters.status && filters.status !== 'ALL') and.push({ status: filters.status });
  if (filters.staffOnly) and.push({ role: { in: STAFF_ROLES } });
  if (filters.q) {
    and.push({
      OR: [
        { name: { contains: filters.q, mode: 'insensitive' } },
        { phone: { contains: filters.q } },
        { email: { contains: filters.q, mode: 'insensitive' } },
      ],
    });
  }

  // 城市负责人 / 区域主管只看本城市的人
  if ((user.role === 'CITY_LEAD' || user.role === 'AREA_MANAGER') && user.cityId) {
    and.push({ cityId: user.cityId });
  }

  return prisma.user.findMany({
    where: { AND: and },
    include: {
      staffProfile: {
        select: {
          id: true,
          employeeCode: true,
          staffLevel: true,
          serviceStatus: true,
          employmentStatus: true,
          district: { select: { name: true } },
        },
      },
      _count: { select: { sessions: true } },
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    take: 300,
  });
}

export type CreateInternalUserInput = {
  name: string;
  phone: string;
  email?: string | null;
  role: Role;
  password: string;
  cityId?: string | null;
  /** 一线岗位才需要下面这些 */
  districtId?: string | null;
  staffLevel?: StaffLevel;
  hiredAt?: Date | null;
  bio?: string | null;
  isDemo?: boolean;
};

/**
 * 新建内部帐号。若角色属于一线岗位，同时建立安心专员档案。
 */
export async function createInternalUser(user: CurrentUser, input: CreateInternalUserInput) {
  assertCan(user, 'user.manage');

  if (input.role === 'FAMILY_MEMBER') {
    throw new Error('家庭成员帐号请在对应家庭的「家庭成员」页创建，以确保绑定到具体家庭');
  }
  if (input.role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN') {
    throw new Error('只有超级管理员可以创建超级管理员帐号');
  }

  const phone = input.phone.replace(/\s|-/g, '');
  if (!/^\d{6,20}$/.test(phone)) throw new Error('手机号格式不正确');

  const strength = validatePasswordStrength(input.password);
  if (!strength.ok) throw new Error(strength.message ?? '初始密码强度不足');

  const exists = await prisma.user.findUnique({ where: { phone } });
  if (exists) throw new Error('这个手机号已经有帐号了');
  if (input.email) {
    const byEmail = await prisma.user.findUnique({ where: { email: input.email } });
    if (byEmail) throw new Error('这个邮箱已经被占用');
  }

  const needsStaffProfile = STAFF_ROLES.includes(input.role);
  const passwordHash = await hashPassword(input.password);

  const created = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        name: input.name,
        phone,
        email: input.email || undefined,
        role: input.role,
        passwordHash,
        status: 'ACTIVE',
        cityId: input.cityId ?? user.cityId ?? undefined,
        isDemo: input.isDemo ?? false,
      },
    });

    if (needsStaffProfile) {
      if (!input.cityId && !user.cityId) throw new Error('一线岗位必须指定所属城市');
      await tx.staffProfile.create({
        data: {
          userId: u.id,
          employeeCode: await nextEmployeeCode(),
          staffLevel: input.staffLevel ?? 'TRAINEE',
          cityId: (input.cityId ?? user.cityId)!,
          districtId: input.districtId ?? undefined,
          employmentStatus: 'ONBOARDED',
          // 新人一律从「未开始」起步，必须走完培训与考核才可能被派单
          serviceStatus: 'NOT_STARTED',
          hiredAt: input.hiredAt ?? new Date(),
          bio: input.bio ?? undefined,
          isDemo: input.isDemo ?? false,
        },
      });
    }

    return u;
  });

  await auditAs(user, {
    action: 'CREATE_USER',
    resource: 'User',
    resourceId: created.id,
    after: {
      name: created.name,
      role: created.role,
      staffProfileCreated: needsStaffProfile,
      // 明确不记录密码，连哈希也不记
    },
    permissionNote: `由 ${user.role} 创建内部帐号`,
  });

  return created;
}

export async function setUserStatus(user: CurrentUser, userId: string, status: UserStatus) {
  assertCan(user, 'user.manage');
  if (userId === user.id) throw new Error('不能修改自己的帐号状态');

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, status: true },
  });
  if (!target) throw new Error('帐号不存在');
  if (target.role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN') {
    throw new Error('只有超级管理员可以变更超级管理员帐号');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id: userId }, data: { status } });
    // 停用或暂停时立刻吊销全部会话，不等 Cookie 过期
    if (status !== 'ACTIVE') {
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return u;
  });

  await auditAs(user, {
    action: 'UPDATE_USER_STATUS',
    resource: 'User',
    resourceId: userId,
    before: { status: target.status },
    after: { status, sessionsRevoked: status !== 'ACTIVE' },
  });

  return updated;
}

/**
 * 重置密码。
 * 新密码由操作人当场设定并线下告知本人 —— 第一版没有短信/邮件渠道，不做「发送重置链接」。
 */
export async function resetPassword(user: CurrentUser, userId: string, newPassword: string) {
  assertCan(user, 'user.manage');

  const strength = validatePasswordStrength(newPassword);
  if (!strength.ok) throw new Error(strength.message ?? '密码强度不足');

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target) throw new Error('帐号不存在');
  if (target.role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN') {
    throw new Error('只有超级管理员可以重置超级管理员密码');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    // 重置密码后所有旧会话立即失效
    prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await auditAs(user, {
    action: 'RESET_PASSWORD',
    resource: 'User',
    resourceId: userId,
    after: { sessionsRevoked: true },
    permissionNote: '密码与哈希均不写入日志',
  });

  return { ok: true };
}

/** 会话列表（供「谁还在线」与安全排查用） */
export async function listSessions(user: CurrentUser, userId: string) {
  assertCan(user, 'user.read');
  return prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
}
