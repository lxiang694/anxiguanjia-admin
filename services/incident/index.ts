import 'server-only';

import type { IncidentSeverity, IncidentStatus, IncidentType } from '@prisma/client';

import type { CurrentUser } from '@/lib/auth';
import { auditAs } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { nextIncidentNo } from '@/lib/ids';
import { assertCan, incidentScopeWhere } from '@/lib/permissions';
import { INCIDENT_TYPE_LABELS } from '@/lib/labels';

/**
 * 异常事件中心。
 *
 * 事件时间线的每一步都保留：时间 / 操作人 / 动作 / 备注。
 * 事件不允许被删除或静默关闭 —— 关闭必须写处理结果。
 */

/** 事件类型的默认严重度。可由督导在处理时上调。 */
const DEFAULT_SEVERITY: Record<IncidentType, IncidentSeverity> = {
  CANNOT_REACH_ELDER: 'HIGH',
  ELDER_FEELS_UNWELL: 'HIGH',
  FALL: 'CRITICAL',
  ENVIRONMENT_SAFETY: 'MEDIUM',
  SERVICE_CONFLICT: 'MEDIUM',
  FAMILY_DISPUTE: 'MEDIUM',
  OTHER: 'LOW',
};

export type CreateIncidentInput = {
  householdId: string;
  elderId?: string | null;
  taskId?: string | null;
  type: IncidentType;
  description: string;
  needsImmediateFamilyContact?: boolean;
  attachmentKeys?: string[];
  severity?: IncidentSeverity;
  occurredAt?: Date;
};

export async function createIncident(user: CurrentUser, input: CreateIncidentInput) {
  assertCan(user, 'incident.create');
  if (!input.description.trim()) throw new Error('请描述发生了什么');

  // 一线专员只能对自己服务的家庭上报
  if (user.staffProfileId) {
    const allowed = await prisma.household.findFirst({
      where: {
        id: input.householdId,
        OR: [
          { primarySpecialistId: user.staffProfileId },
          { backupSpecialistId: user.staffProfileId },
          { tasks: { some: { staffProfileId: user.staffProfileId } } },
        ],
      },
      select: { id: true },
    });
    if (!allowed) throw new Error('只能对自己服务的家庭上报事件');
  }

  const household = await prisma.household.findUnique({
    where: { id: input.householdId },
    select: { id: true, name: true, isDemo: true },
  });
  if (!household) throw new Error('家庭不存在');

  const occurredAt = input.occurredAt ?? new Date();
  const incidentNo = await nextIncidentNo(occurredAt);
  const severity = input.severity ?? DEFAULT_SEVERITY[input.type];

  const incident = await prisma.$transaction(async (tx) => {
    const created = await tx.incident.create({
      data: {
        incidentNo,
        householdId: input.householdId,
        elderId: input.elderId ?? undefined,
        taskId: input.taskId ?? undefined,
        type: input.type,
        severity,
        status: 'NEW',
        description: input.description,
        occurredAt,
        needsImmediateFamilyContact: input.needsImmediateFamilyContact ?? false,
        attachmentKeys: input.attachmentKeys ?? [],
        reportedById: user.id,
        isDemo: household.isDemo,
      },
    });

    await tx.incidentEvent.create({
      data: {
        incidentId: created.id,
        actorId: user.id,
        actorName: user.name,
        action: `${user.name}提交事件`,
        note: input.description,
        occurredAt,
      },
    });

    await tx.incidentEvent.create({
      data: {
        incidentId: created.id,
        actorName: '系统',
        action: '系统通知服务督导',
        occurredAt: new Date(occurredAt.getTime() + 1000),
      },
    });

    await tx.timelineEvent.create({
      data: {
        householdId: input.householdId,
        elderId: input.elderId ?? undefined,
        title: `发生异常情况：${INCIDENT_TYPE_LABELS[input.type]}`,
        detail: input.description,
        refType: 'incident',
        refId: created.id,
        requiredPermission: 'INCIDENT_ALERT',
        isDemo: household.isDemo,
      },
    });

    return created;
  });

  const { notifySupervisors, notifyMany } = await import('@/lib/notifications');
  await notifySupervisors({
    level: severity === 'CRITICAL' || severity === 'HIGH' ? 'URGENT' : 'IMPORTANT',
    title: `🚨 ${household.name}：${INCIDENT_TYPE_LABELS[input.type]}`,
    body: input.description,
    linkUrl: `/admin/incidents/${incident.id}`,
    refType: 'incident',
    refId: incident.id,
    isDemo: household.isDemo,
  });

  // 只通知拥有「异常通知」授权的家庭成员
  if (input.needsImmediateFamilyContact && input.elderId) {
    const grantees = await prisma.consent.findMany({
      where: {
        elderId: input.elderId,
        permissionType: 'INCIDENT_ALERT',
        status: 'ACTIVE',
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { granteeId: true },
    });
    if (grantees.length > 0) {
      await notifyMany(Array.from(new Set(grantees.map((g) => g.granteeId))), {
        level: 'URGENT',
        title: '需要您立即确认的现场情况',
        body: input.description,
        linkUrl: '/family',
        refType: 'incident',
        refId: incident.id,
        isDemo: household.isDemo,
      });
    }
  }

  await auditAs(user, {
    action: 'CREATE_INCIDENT',
    resource: 'Incident',
    resourceId: incident.id,
    after: { incidentNo, type: input.type, severity },
  });

  return incident;
}

/** 追加一条时间线（每一次处理动作都必须留痕） */
export async function appendIncidentEvent(
  user: CurrentUser,
  incidentId: string,
  action: string,
  note?: string,
) {
  assertCan(user, 'incident.handle');
  const scope = incidentScopeWhere(user);
  if (!scope) throw new Error('不在数据范围内');
  const incident = await prisma.incident.findFirst({
    where: { AND: [scope, { id: incidentId }] },
    select: { id: true },
  });
  if (!incident) throw new Error('事件不存在或不在数据范围内');

  return prisma.incidentEvent.create({
    data: {
      incidentId,
      actorId: user.id,
      actorName: user.name,
      action,
      note,
    },
  });
}

export async function updateIncidentStatus(
  user: CurrentUser,
  incidentId: string,
  status: IncidentStatus,
  opts?: { note?: string; resolution?: string; takeOwnership?: boolean; severity?: IncidentSeverity },
) {
  assertCan(user, 'incident.handle');

  const scope = incidentScopeWhere(user);
  if (!scope) throw new Error('不在数据范围内');
  const incident = await prisma.incident.findFirst({
    where: { AND: [scope, { id: incidentId }] },
    select: { id: true, status: true, ownerId: true, householdId: true, isDemo: true },
  });
  if (!incident) throw new Error('事件不存在或不在数据范围内');

  if (status === 'CLOSED' && !opts?.resolution?.trim()) {
    throw new Error('关闭事件必须填写处理结果');
  }

  const ACTION_TEXT: Record<IncidentStatus, string> = {
    NEW: '重新打开事件',
    ACKNOWLEDGED: '接单',
    IN_PROGRESS: '开始处理',
    PENDING_FOLLOW_UP: '转入待跟进',
    CLOSED: '完成跟进并关闭事件',
  };

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.incident.update({
      where: { id: incidentId },
      data: {
        status,
        severity: opts?.severity,
        ownerId:
          opts?.takeOwnership || (!incident.ownerId && status !== 'NEW') ? user.id : undefined,
        acknowledgedAt:
          status === 'ACKNOWLEDGED' && !incident.ownerId ? new Date() : undefined,
        closedAt: status === 'CLOSED' ? new Date() : undefined,
        resolution: opts?.resolution,
      },
    });
    await tx.incidentEvent.create({
      data: {
        incidentId,
        actorId: user.id,
        actorName: user.name,
        action: `${user.name}${ACTION_TEXT[status]}`,
        note: opts?.note ?? opts?.resolution,
      },
    });
    if (status === 'CLOSED') {
      await tx.timelineEvent.create({
        data: {
          householdId: incident.householdId,
          title: '异常情况已完成跟进',
          detail: opts?.resolution,
          refType: 'incident',
          refId: incidentId,
          requiredPermission: 'INCIDENT_ALERT',
          isDemo: incident.isDemo,
        },
      });
    }
    return r;
  });

  await auditAs(user, {
    action: 'UPDATE_INCIDENT',
    resource: 'Incident',
    resourceId: incidentId,
    before: { status: incident.status },
    after: { status, resolution: opts?.resolution ?? null },
  });

  return updated;
}

export async function listIncidents(
  user: CurrentUser,
  filters: { status?: IncidentStatus | 'OPEN' | 'ALL' } = {},
) {
  assertCan(user, 'incident.read');
  const scope = incidentScopeWhere(user);
  if (!scope) return [];

  const statusWhere =
    filters.status === 'OPEN'
      ? { status: { in: ['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PENDING_FOLLOW_UP'] as IncidentStatus[] } }
      : filters.status && filters.status !== 'ALL'
        ? { status: filters.status }
        : {};

  return prisma.incident.findMany({
    where: { AND: [scope, statusWhere] },
    include: {
      household: { select: { id: true, name: true, householdCode: true } },
      elder: { select: { id: true, name: true } },
      reportedBy: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      _count: { select: { events: true } },
    },
    orderBy: [{ severity: 'desc' }, { occurredAt: 'desc' }],
    take: 200,
  });
}

export async function getIncident(user: CurrentUser, incidentId: string) {
  assertCan(user, 'incident.read');
  const scope = incidentScopeWhere(user);
  if (!scope) return null;

  return prisma.incident.findFirst({
    where: { AND: [scope, { id: incidentId }] },
    include: {
      household: {
        select: {
          id: true,
          name: true,
          householdCode: true,
          primaryContact: { include: { user: { select: { name: true, phone: true } } } },
        },
      },
      elder: { select: { id: true, name: true, phone: true } },
      task: { select: { id: true, taskNo: true, serviceType: true } },
      reportedBy: { select: { id: true, name: true, role: true } },
      owner: { select: { id: true, name: true } },
      events: { orderBy: { occurredAt: 'asc' } },
    },
  });
}

/** Dashboard「需要现在处理」的数据源：未指定负责人 或 高危未关闭 */
export async function urgentIncidents(user: CurrentUser) {
  assertCan(user, 'incident.read');
  const scope = incidentScopeWhere(user);
  if (!scope) return [];

  return prisma.incident.findMany({
    where: {
      AND: [
        scope,
        { status: { in: ['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS'] } },
        { OR: [{ ownerId: null }, { severity: { in: ['HIGH', 'CRITICAL'] } }] },
      ],
    },
    include: {
      household: { select: { id: true, name: true } },
      elder: { select: { name: true } },
      owner: { select: { name: true } },
      reportedBy: { select: { name: true } },
    },
    orderBy: [{ severity: 'desc' }, { occurredAt: 'asc' }],
    take: 10,
  });
}
