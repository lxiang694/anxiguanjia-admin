import type { Prisma, Role } from '@prisma/client';

import type { CurrentUser } from '@/lib/auth';
import { CITY_SCOPED_ROLES, STAFF_ROLES } from './capabilities';

/**
 * 数据范围（Data Scope）。
 *
 * 与能力（capability）是两个独立维度：
 *   能力回答「这个角色能不能做这类动作」
 *   范围回答「这条具体数据是不是他该看的」
 *
 * 所有列表查询都必须把 householdScopeWhere() 的结果合并进 where，
 * 不允许在应用层先查全量再过滤 —— 那样一旦分页就会泄露总数。
 */

/** 一线专员保留访问权的时间窗（天）。用于「服务结束后仍需补记录」的合理窗口。 */
export const SPECIALIST_ACCESS_WINDOW_DAYS = 7;

function windowStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - SPECIALIST_ACCESS_WINDOW_DAYS);
  d.setHours(0, 0, 0, 0);
  return d;
}

function windowEnd(): Date {
  const d = new Date();
  d.setDate(d.getDate() + SPECIALIST_ACCESS_WINDOW_DAYS);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** 全局可见（不含城市限制）的角色 */
const GLOBAL_ROLES: Role[] = [
  'SUPER_ADMIN',
  'OPERATIONS',
  'SERVICE_SUPERVISOR',
  'CUSTOMER_SERVICE',
  'FINANCE',
  'HR',
];

/**
 * 生成家庭级别的 Prisma where 条件。
 * 返回 null 表示该用户完全不该看到任何家庭（例如人事）。
 */
export function householdScopeWhere(user: CurrentUser): Prisma.HouseholdWhereInput | null {
  const base: Prisma.HouseholdWhereInput = { deletedAt: null };

  // 人事不接触家庭数据
  if (user.role === 'HR') return null;

  if (user.role === 'FAMILY_MEMBER') {
    if (user.householdIds.length === 0) return null;
    return { ...base, id: { in: user.householdIds } };
  }

  if (STAFF_ROLES.includes(user.role)) {
    const spid = user.staffProfileId;
    const consultantClause: Prisma.HouseholdWhereInput[] =
      user.role === 'FAMILY_CONSULTANT' ? [{ consultantId: user.id }] : [];

    if (!spid) {
      // 顾问可能没有专员档案，但仍需看到自己负责的家庭
      if (consultantClause.length > 0) return { ...base, OR: consultantClause };
      return null;
    }

    return {
      ...base,
      OR: [
        // 固定专员 / 备用专员 —— 长期服务关系
        { primarySpecialistId: spid },
        { backupSpecialistId: spid },
        ...consultantClause,
        // 临时派单 —— 仅在未结案或近期窗口内可见，不长期保留
        {
          tasks: {
            some: {
              staffProfileId: spid,
              deletedAt: null,
              OR: [
                {
                  status: {
                    notIn: ['COMPLETED', 'CANCELLED', 'DECLINED', 'RESCHEDULED'],
                  },
                },
                { scheduledStart: { gte: windowStart(), lte: windowEnd() } },
              ],
            },
          },
        },
      ],
    };
  }

  if (CITY_SCOPED_ROLES.includes(user.role)) {
    if (!user.cityId) return null;
    return { ...base, cityId: user.cityId };
  }

  if (GLOBAL_ROLES.includes(user.role)) return base;

  return null;
}

/** 该用户能否访问指定家庭。用于详情页与 Server Action 的单条校验。 */
export function householdScopeFilter(
  user: CurrentUser,
  householdId: string,
): Prisma.HouseholdWhereInput | null {
  const scope = householdScopeWhere(user);
  if (!scope) return null;
  return { AND: [scope, { id: householdId }] };
}

/** 任务范围：专员只见自己的任务；运营/督导按家庭范围。 */
export function taskScopeWhere(user: CurrentUser): Prisma.ServiceTaskWhereInput | null {
  const base: Prisma.ServiceTaskWhereInput = { deletedAt: null };

  if (user.role === 'HR') return null;

  if (user.role === 'FAMILY_MEMBER') {
    if (user.householdIds.length === 0) return null;
    return { ...base, householdId: { in: user.householdIds } };
  }

  if (STAFF_ROLES.includes(user.role)) {
    const spid = user.staffProfileId;
    if (user.role === 'FAMILY_CONSULTANT') {
      const or: Prisma.ServiceTaskWhereInput[] = [{ household: { consultantId: user.id } }];
      if (spid) or.push({ staffProfileId: spid });
      return { ...base, OR: or };
    }
    if (!spid) return null;
    // 专员只看得到派给自己的任务，看不到同事的任务
    return { ...base, staffProfileId: spid };
  }

  if (CITY_SCOPED_ROLES.includes(user.role)) {
    if (!user.cityId) return null;
    return { ...base, household: { cityId: user.cityId } };
  }

  if (GLOBAL_ROLES.includes(user.role)) return base;
  return null;
}

/** 专员档案范围：人事/督导/超管可见全部；专员只见自己。 */
export function staffScopeWhere(user: CurrentUser): Prisma.StaffProfileWhereInput | null {
  const base: Prisma.StaffProfileWhereInput = { deletedAt: null };

  if (user.role === 'FAMILY_MEMBER') return null;

  if (STAFF_ROLES.includes(user.role)) {
    if (!user.staffProfileId) return null;
    return { ...base, id: user.staffProfileId };
  }

  if (CITY_SCOPED_ROLES.includes(user.role)) {
    if (!user.cityId) return null;
    return { ...base, cityId: user.cityId };
  }

  if (user.role === 'FINANCE') return null;

  if (GLOBAL_ROLES.includes(user.role)) return base;
  return null;
}

/** 事件范围 */
export function incidentScopeWhere(user: CurrentUser): Prisma.IncidentWhereInput | null {
  if (user.role === 'FAMILY_MEMBER') {
    if (user.householdIds.length === 0) return null;
    return { householdId: { in: user.householdIds } };
  }
  if (STAFF_ROLES.includes(user.role)) {
    const spid = user.staffProfileId;
    const or: Prisma.IncidentWhereInput[] = [{ reportedById: user.id }];
    if (spid) {
      or.push({ household: { primarySpecialistId: spid } });
      or.push({ task: { staffProfileId: spid } });
    }
    return { OR: or };
  }
  const hh = householdScopeWhere(user);
  if (!hh) return null;
  return { household: hh };
}

/** 报告范围 */
export function reportScopeWhere(user: CurrentUser): Prisma.AssuranceReportWhereInput | null {
  if (user.role === 'FAMILY_MEMBER') {
    if (user.householdIds.length === 0) return null;
    // 家庭端只看得到已发布的报告 —— 草稿与待审核不得外泄
    return { householdId: { in: user.householdIds }, status: 'PUBLISHED' };
  }
  const hh = householdScopeWhere(user);
  if (!hh) return null;
  return { household: hh };
}

/** 订单范围 */
export function orderScopeWhere(user: CurrentUser): Prisma.OrderWhereInput | null {
  if (user.role === 'FAMILY_MEMBER') {
    if (user.householdIds.length === 0) return null;
    return { householdId: { in: user.householdIds } };
  }
  if (user.role === 'FINANCE' || user.role === 'SUPER_ADMIN') return {};
  const hh = householdScopeWhere(user);
  if (!hh) return null;
  return { household: hh };
}

/**
 * 一线专员在任务详情中不得看到的内容（产品明确要求）：
 *   套餐支付价格 / 无关家庭财务资料 / 其他安心专员内部评价 / 无关敏感健康信息。
 * 该常量用于在 UI 与 service 层双重确认裁剪逻辑没有被绕过。
 */
export const SPECIALIST_FORBIDDEN_FIELDS = [
  'plan.monthlyPrice',
  'subscription.monthlyPrice',
  'order.amount',
  'household.internalNotes',
  'staffPerformance',
  'elderSensitiveInfo',
] as const;
