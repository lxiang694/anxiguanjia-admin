import 'server-only';

import type { NotificationChannel, NotificationLevel } from '@prisma/client';

import { prisma } from '@/lib/db';

/**
 * 通知中心。
 *
 * 第一版只实现站内通知（IN_APP）。短信 / 微信 / 企业微信保留接口与字段，
 * 但不做假实现 —— dispatchExternal() 明确返回未接入，避免界面上出现
 * 「已发送短信」这种事实上没有发生的状态。
 */

export type NotifyInput = {
  userId: string;
  level?: NotificationLevel;
  title: string;
  body?: string;
  linkUrl?: string;
  refType?: string;
  refId?: string;
  isDemo?: boolean;
};

export async function notify(input: NotifyInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      level: input.level ?? 'NORMAL',
      channel: 'IN_APP',
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl,
      refType: input.refType,
      refId: input.refId,
      isDemo: input.isDemo ?? false,
      dispatchedAt: new Date(),
    },
  });
}

export async function notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>) {
  if (userIds.length === 0) return { count: 0 };
  return prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      level: input.level ?? 'NORMAL',
      channel: 'IN_APP' as NotificationChannel,
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl,
      refType: input.refType,
      refId: input.refId,
      isDemo: input.isDemo ?? false,
      dispatchedAt: new Date(),
    })),
  });
}

/** 通知家庭内所有成员（家庭端读取时仍会按 Consent 再过滤内容细节） */
export async function notifyHousehold(
  householdId: string,
  input: Omit<NotifyInput, 'userId'>,
) {
  const members = await prisma.familyMember.findMany({
    where: { householdId },
    select: { userId: true },
  });
  return notifyMany(
    members.map((m) => m.userId),
    input,
  );
}

/** 通知全部服务督导 —— 异常事件的默认升级路径 */
export async function notifySupervisors(input: Omit<NotifyInput, 'userId'>) {
  const supervisors = await prisma.user.findMany({
    where: {
      role: { in: ['SERVICE_SUPERVISOR', 'OPERATIONS', 'SUPER_ADMIN'] },
      status: 'ACTIVE',
      deletedAt: null,
    },
    select: { id: true },
  });
  return notifyMany(
    supervisors.map((s) => s.id),
    { ...input, level: input.level ?? 'IMPORTANT' },
  );
}

/**
 * 外部渠道投递（短信 / 微信 / 企业微信）。
 * 第一版未接入：明确返回未实现，并把原因写进通知记录，绝不假装已送达。
 */
export async function dispatchExternal(
  notificationId: string,
  channel: Exclude<NotificationChannel, 'IN_APP'>,
): Promise<{ ok: false; reason: string }> {
  const reason = `渠道 ${channel} 尚未接入（第一版仅站内通知）`;
  await prisma.notification.update({
    where: { id: notificationId },
    data: { dispatchError: reason },
  });
  return { ok: false, reason };
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markRead(userId: string, notificationId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
