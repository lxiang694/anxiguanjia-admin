import 'server-only';

import type { Prisma, Role } from '@prisma/client';
import { headers } from 'next/headers';

import { prisma } from '@/lib/db';

/**
 * 审计日志。
 *
 * 重要操作全部落库：登录、查看敏感信息、修改长辈档案、修改授权、
 * 查看健康资料、导出、修改服务记录、审核安心报告、退款、修改专员档案。
 *
 * 原则：
 *  - 只记录必要字段快照，避免把大量敏感明文再落一份库。
 *  - permissionNote 记录「当时为什么允许／拒绝」，便于事后复查。
 *  - 写日志失败绝不阻断主流程，但会在服务端输出错误。
 */

export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  VIEW_SENSITIVE_HEALTH: 'VIEW_SENSITIVE_HEALTH',
  VIEW_ELDER_PROFILE: 'VIEW_ELDER_PROFILE',
  VIEW_VISIT_RECORD: 'VIEW_VISIT_RECORD',
  UPDATE_ELDER: 'UPDATE_ELDER',
  UPDATE_SENSITIVE_HEALTH: 'UPDATE_SENSITIVE_HEALTH',
  CREATE_HOUSEHOLD: 'CREATE_HOUSEHOLD',
  UPDATE_HOUSEHOLD: 'UPDATE_HOUSEHOLD',
  GRANT_CONSENT: 'GRANT_CONSENT',
  REVOKE_CONSENT: 'REVOKE_CONSENT',
  UPDATE_CONSENT: 'UPDATE_CONSENT',
  ASSIGN_TASK: 'ASSIGN_TASK',
  REASSIGN_SPECIALIST: 'REASSIGN_SPECIALIST',
  SUBMIT_VISIT_RECORD: 'SUBMIT_VISIT_RECORD',
  UPDATE_VISIT_RECORD: 'UPDATE_VISIT_RECORD',
  GENERATE_REPORT: 'GENERATE_REPORT',
  REVIEW_REPORT: 'REVIEW_REPORT',
  PUBLISH_REPORT: 'PUBLISH_REPORT',
  UPDATE_STAFF_PROFILE: 'UPDATE_STAFF_PROFILE',
  VERIFY_EDUCATION: 'VERIFY_EDUCATION',
  CREATE_INCIDENT: 'CREATE_INCIDENT',
  UPDATE_INCIDENT: 'UPDATE_INCIDENT',
  REFUND: 'REFUND',
  EXPORT: 'EXPORT',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS] | string;

export type AuditInput = {
  userId?: string | null;
  actorName?: string | null;
  actorRole?: Role | null;
  action: AuditAction;
  resource: string;
  resourceId?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  permissionNote?: string | null;
};

async function resolveMeta(input: AuditInput) {
  if (input.ipAddress !== undefined && input.userAgent !== undefined) {
    return { ip: input.ipAddress, ua: input.userAgent };
  }
  try {
    const h = await headers();
    return {
      ip:
        input.ipAddress ??
        h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        h.get('x-real-ip') ??
        null,
      ua: input.userAgent ?? h.get('user-agent') ?? null,
    };
  } catch {
    return { ip: input.ipAddress ?? null, ua: input.userAgent ?? null };
  }
}

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    const { ip, ua } = await resolveMeta(input);
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? undefined,
        actorName: input.actorName ?? undefined,
        actorRole: input.actorRole ?? undefined,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? undefined,
        before: input.before ?? undefined,
        after: input.after ?? undefined,
        ipAddress: ip ?? undefined,
        userAgent: ua ?? undefined,
        permissionNote: input.permissionNote ?? undefined,
      },
    });
  } catch (err) {
    console.error('[audit] 写入审计日志失败（不影响主流程）:', err);
  }
}

/** 便捷封装：由 CurrentUser 直接写日志 */
export async function auditAs(
  actor: { id: string; name: string; role: Role } | null,
  input: Omit<AuditInput, 'userId' | 'actorName' | 'actorRole'>,
): Promise<void> {
  await writeAudit({
    ...input,
    userId: actor?.id ?? null,
    actorName: actor?.name ?? null,
    actorRole: actor?.role ?? null,
  });
}
