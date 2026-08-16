import 'server-only';

import type {
  InvoiceStatus,
  InvoiceType,
  OrderType,
  PlanTier,
  ServiceType,
  SubscriptionStatus,
} from '@prisma/client';

import type { CurrentUser } from '@/lib/auth';
import { auditAs } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { nextOrderNo } from '@/lib/ids';
import { assertCan, householdScopeFilter, orderScopeWhere } from '@/lib/permissions';
import { monthRange } from '@/lib/utils';

/**
 * 订阅与订单。
 *
 * 核心不是「一个订单 = 一次上门」，而是 Subscription（会员订阅）。
 * 套餐权益（几次探访 / 几次关怀 / 几份报告）全部由后台可编辑的 ServicePlan 决定，
 * 代码里不写死任何套餐内容。
 */

export async function listPlans() {
  return prisma.servicePlan.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { monthlyPrice: 'asc' }],
  });
}

export type CreateSubscriptionInput = {
  householdId: string;
  planId: string;
  status?: SubscriptionStatus;
  monthlyPrice?: number;
  periodMonths?: number;
  createOrder?: boolean;
};

export async function createSubscription(user: CurrentUser, input: CreateSubscriptionInput) {
  assertCan(user, 'subscription.manage');

  const filter = householdScopeFilter(user, input.householdId);
  if (!filter) throw new Error('家庭不存在或不在数据范围内');
  const household = await prisma.household.findFirst({
    where: filter,
    select: { id: true, isDemo: true },
  });
  if (!household) throw new Error('家庭不存在或不在数据范围内');

  const plan = await prisma.servicePlan.findUnique({ where: { id: input.planId } });
  if (!plan) throw new Error('服务方案不存在');

  const months = input.periodMonths ?? 1;
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + months);

  const price = input.monthlyPrice ?? plan.monthlyPrice;

  const subscription = await prisma.subscription.create({
    data: {
      householdId: household.id,
      planId: plan.id,
      status: input.status ?? 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      monthlyPrice: price,
      isDemo: household.isDemo,
    },
  });

  let order = null;
  if (input.createOrder !== false) {
    order = await prisma.order.create({
      data: {
        orderNo: await nextOrderNo(now),
        householdId: household.id,
        subscriptionId: subscription.id,
        type: 'NEW_SUBSCRIPTION',
        status: 'PAID',
        amount: price * months,
        description: `${plan.name} × ${months} 个月`,
        paidAt: now,
        isDemo: household.isDemo,
      },
    });
  }

  await prisma.timelineEvent.create({
    data: {
      householdId: household.id,
      title: `已开通${plan.name}`,
      refType: 'subscription',
      refId: subscription.id,
      requiredPermission: 'SERVICE_SCHEDULE',
      isDemo: household.isDemo,
    },
  });

  await auditAs(user, {
    action: 'CREATE_SUBSCRIPTION',
    resource: 'Subscription',
    resourceId: subscription.id,
    after: { planId: plan.id, price, months, orderId: order?.id ?? null },
  });

  return { subscription, order };
}

export async function renewSubscription(
  user: CurrentUser,
  subscriptionId: string,
  months = 1,
) {
  assertCan(user, 'subscription.manage');

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, household: { select: { id: true, isDemo: true } } },
  });
  if (!subscription) throw new Error('订阅不存在');

  const filter = householdScopeFilter(user, subscription.householdId);
  if (!filter) throw new Error('不在数据范围内');
  const inScope = await prisma.household.findFirst({ where: filter, select: { id: true } });
  if (!inScope) throw new Error('不在数据范围内');

  const base =
    subscription.currentPeriodEnd > new Date() ? subscription.currentPeriodEnd : new Date();
  const nextEnd = new Date(base);
  nextEnd.setMonth(nextEnd.getMonth() + months);

  const [updated, order] = await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: base,
        currentPeriodEnd: nextEnd,
        // 新周期权益计数归零
        usedVisits: 0,
        usedPhoneCare: 0,
        usedReports: 0,
      },
    }),
    prisma.order.create({
      data: {
        orderNo: await nextOrderNo(),
        householdId: subscription.householdId,
        subscriptionId,
        type: 'RENEWAL',
        status: 'PAID',
        amount: subscription.monthlyPrice * months,
        description: `${subscription.plan.name} 续费 ${months} 个月`,
        paidAt: new Date(),
        isDemo: subscription.household.isDemo,
      },
    }),
    prisma.household.update({
      where: { id: subscription.householdId },
      data: { status: 'ACTIVE_MEMBER' },
    }),
  ]);

  await auditAs(user, {
    action: 'RENEW_SUBSCRIPTION',
    resource: 'Subscription',
    resourceId: subscriptionId,
    after: { months, currentPeriodEnd: nextEnd, orderId: order.id },
  });

  return { subscription: updated, order };
}

export async function refundOrder(user: CurrentUser, orderId: string, reason: string) {
  assertCan(user, 'order.refund');
  if (!reason.trim()) throw new Error('退款必须填写原因');

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('订单不存在');
  if (order.status !== 'PAID') throw new Error('只有已付款订单可以退款');

  const [updated, refundOrderRow] = await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: 'REFUNDED', refundedAt: new Date(), refundReason: reason },
    }),
    prisma.order.create({
      data: {
        orderNo: await nextOrderNo(),
        householdId: order.householdId,
        subscriptionId: order.subscriptionId,
        type: 'REFUND',
        status: 'PAID',
        amount: -Math.abs(order.amount),
        description: `退款：${order.orderNo}`,
        paidAt: new Date(),
        refundReason: reason,
        isDemo: order.isDemo,
      },
    }),
  ]);

  await auditAs(user, {
    action: 'REFUND',
    resource: 'Order',
    resourceId: orderId,
    before: { status: 'PAID', amount: order.amount },
    after: { status: 'REFUNDED', reason, refundOrderId: refundOrderRow.id },
  });

  return { updated, refundOrder: refundOrderRow };
}

export async function listOrders(user: CurrentUser, filters: { type?: OrderType } = {}) {
  assertCan(user, 'order.read');
  const scope = orderScopeWhere(user);
  if (!scope) return [];

  return prisma.order.findMany({
    where: { AND: [scope, filters.type ? { type: filters.type } : {}] },
    include: {
      household: { select: { id: true, name: true, householdCode: true } },
      subscription: { include: { plan: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

/** 本月收入构成（新订阅 / 续费 / 增值服务），单位：分 */
export async function monthlyRevenue(ref: Date = new Date()) {
  const { start, end } = monthRange(ref);
  const rows = await prisma.order.groupBy({
    by: ['type'],
    where: { status: 'PAID', paidAt: { gte: start, lt: end } },
    _sum: { amount: true },
  });

  const byType = new Map(rows.map((r) => [r.type, r._sum.amount ?? 0]));
  const newSub = byType.get('NEW_SUBSCRIPTION') ?? 0;
  const renewal = byType.get('RENEWAL') ?? 0;
  const addOn = byType.get('ADD_ON') ?? 0;
  const refund = byType.get('REFUND') ?? 0;

  return {
    total: newSub + renewal + addOn + refund,
    newSubscription: newSub,
    renewal,
    addOn,
    refund,
  };
}

/** MRR / ARPU —— 以生效中的订阅月费为基础 */
export async function revenueMetrics() {
  const active = await prisma.subscription.findMany({
    where: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
    select: { monthlyPrice: true },
  });
  const mrr = active.reduce((sum, s) => sum + s.monthlyPrice, 0);
  const arpu = active.length > 0 ? Math.round(mrr / active.length) : 0;
  return { mrr, arpu, activeCount: active.length };
}

/** 本月待续费家庭 */
export async function renewalDueSubscriptions(days = 30) {
  const until = new Date();
  until.setDate(until.getDate() + days);
  return prisma.subscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'TRIAL', 'PAST_DUE'] },
      currentPeriodEnd: { lte: until },
    },
    include: {
      household: { select: { id: true, name: true, householdCode: true, status: true } },
      plan: { select: { name: true } },
    },
    orderBy: { currentPeriodEnd: 'asc' },
  });
}

/* ==========================================================================
 * 发票
 * ======================================================================== */

export type InvoiceRequestInput = {
  orderId: string;
  invoiceType: InvoiceType;
  invoiceTitle: string;
  invoiceTaxNo?: string | null;
  note?: string | null;
};

/**
 * 登记开票申请。
 *
 * 第一版是人工流程：财务在系统里登记家庭要开什么票，线下去税控系统开，
 * 再回来把发票号填上。刻意不做「一键开票」—— 没接税控系统，那会是假功能。
 */
export async function requestInvoice(user: CurrentUser, input: InvoiceRequestInput) {
  assertCan(user, 'invoice.manage');

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: { id: true, orderNo: true, status: true, amount: true, invoiceStatus: true },
  });
  if (!order) throw new Error('订单不存在');
  if (order.status !== 'PAID') throw new Error('只有已付款的订单可以开票');
  if (order.amount <= 0) throw new Error('退款记录不需要开票');
  if (order.invoiceStatus === 'ISSUED') throw new Error('这张订单已经开过票了');
  if (!input.invoiceTitle.trim()) throw new Error('请填写开票名称');

  const isCompany = input.invoiceType !== 'PERSONAL_ELECTRONIC';
  if (isCompany && !input.invoiceTaxNo?.trim()) {
    throw new Error('单位发票必须填写税号');
  }

  const updated = await prisma.order.update({
    where: { id: input.orderId },
    data: {
      invoiceStatus: 'REQUESTED',
      invoiceType: input.invoiceType,
      invoiceTitle: input.invoiceTitle.trim(),
      invoiceTaxNo: input.invoiceTaxNo?.trim() || null,
      invoiceNote: input.note ?? undefined,
    },
  });

  await auditAs(user, {
    action: 'REQUEST_INVOICE',
    resource: 'Order',
    resourceId: input.orderId,
    before: { invoiceStatus: order.invoiceStatus },
    after: { invoiceStatus: 'REQUESTED', invoiceType: input.invoiceType },
  });

  return updated;
}

/** 回填发票号，标记为已开票 */
export async function issueInvoice(user: CurrentUser, orderId: string, invoiceNo: string) {
  assertCan(user, 'invoice.manage');
  if (!invoiceNo.trim()) throw new Error('请填写发票号');

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, invoiceStatus: true, invoiceTitle: true },
  });
  if (!order) throw new Error('订单不存在');
  if (order.invoiceStatus !== 'REQUESTED') {
    throw new Error('只有已申请开票的订单可以回填发票号');
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { invoiceStatus: 'ISSUED', invoiceNo: invoiceNo.trim(), invoicedAt: new Date() },
  });

  await auditAs(user, {
    action: 'ISSUE_INVOICE',
    resource: 'Order',
    resourceId: orderId,
    before: { invoiceStatus: 'REQUESTED' },
    after: { invoiceStatus: 'ISSUED', invoiceNo: invoiceNo.trim() },
  });

  return updated;
}

export async function voidInvoice(user: CurrentUser, orderId: string, reason: string) {
  assertCan(user, 'invoice.manage');
  if (!reason.trim()) throw new Error('作废发票必须填写原因');

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { invoiceStatus: true, invoiceNo: true },
  });
  if (!order) throw new Error('订单不存在');
  if (order.invoiceStatus !== 'ISSUED') throw new Error('只有已开票的订单可以作废');

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { invoiceStatus: 'VOIDED', invoiceNote: `作废原因：${reason}` },
  });

  await auditAs(user, {
    action: 'VOID_INVOICE',
    resource: 'Order',
    resourceId: orderId,
    before: { invoiceStatus: 'ISSUED', invoiceNo: order.invoiceNo },
    after: { invoiceStatus: 'VOIDED', reason },
  });

  return updated;
}

/** 发票页数据源 */
export async function listInvoiceOrders(
  user: CurrentUser,
  filters: { status?: InvoiceStatus | 'PENDING' | 'ALL' } = {},
) {
  assertCan(user, 'invoice.manage');

  const where =
    filters.status === 'PENDING'
      ? { status: 'PAID' as const, amount: { gt: 0 }, invoiceStatus: { in: ['NOT_REQUESTED', 'REQUESTED'] as InvoiceStatus[] } }
      : filters.status && filters.status !== 'ALL'
        ? { invoiceStatus: filters.status }
        : { amount: { gt: 0 } };

  return prisma.order.findMany({
    where,
    include: {
      household: { select: { id: true, name: true, householdCode: true } },
      subscription: { include: { plan: { select: { name: true } } } },
    },
    orderBy: [{ invoiceStatus: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });
}

/* ==========================================================================
 * 服务方案（套餐）后台维护
 *
 * 需求明确要求「套餐配置必须是后台可编辑」。之前只有只读列表，这里补上。
 * 注意：方案是商业产品，改动它不会自动改动任何家庭的执行计划 ——
 * 家庭实际执行的是 HouseholdServicePlan，两者刻意解耦。
 * ======================================================================== */

export type UpsertPlanInput = {
  id?: string;
  code: string;
  name: string;
  tier: PlanTier;
  description?: string | null;
  monthlyPrice: number;
  visitsPerMonth: number;
  phoneCarePerMonth: number;
  reportsPerMonth: number;
  includedServices: ServiceType[];
  isActive: boolean;
  sortOrder?: number;
};

export async function listAllPlans(user: CurrentUser) {
  assertCan(user, 'plan.read');
  return prisma.servicePlan.findMany({
    include: { _count: { select: { subscriptions: true, householdPlans: true } } },
    orderBy: [{ sortOrder: 'asc' }, { monthlyPrice: 'asc' }],
  });
}

export async function upsertPlan(user: CurrentUser, input: UpsertPlanInput) {
  assertCan(user, 'plan.manage');

  if (!input.name.trim()) throw new Error('请填写方案名称');
  if (!/^[A-Z][A-Z0-9_]*$/.test(input.code)) {
    throw new Error('方案代码只能使用大写字母、数字与下划线，且以字母开头');
  }
  if (input.monthlyPrice < 0) throw new Error('月费不能为负');
  for (const [label, v] of [
    ['每月探访', input.visitsPerMonth],
    ['每月电话关怀', input.phoneCarePerMonth],
    ['每月安心报告', input.reportsPerMonth],
  ] as const) {
    if (v < 0 || v > 60) throw new Error(`${label}次数需在 0 到 60 之间`);
  }
  if (input.includedServices.length === 0) {
    throw new Error('至少选择一项包含的服务类型');
  }

  const data = {
    code: input.code,
    name: input.name.trim(),
    tier: input.tier,
    description: input.description ?? undefined,
    monthlyPrice: input.monthlyPrice,
    visitsPerMonth: input.visitsPerMonth,
    phoneCarePerMonth: input.phoneCarePerMonth,
    reportsPerMonth: input.reportsPerMonth,
    includedServices: input.includedServices,
    isActive: input.isActive,
    sortOrder: input.sortOrder ?? 0,
  };

  if (input.id) {
    const before = await prisma.servicePlan.findUnique({
      where: { id: input.id },
      include: { _count: { select: { subscriptions: true } } },
    });
    if (!before) throw new Error('方案不存在');

    // 已有订阅时不允许改价（历史成交价存在 Subscription.monthlyPrice 上，
    // 但改标价会让运营误以为老客户也跟着变了）
    if (before._count.subscriptions > 0 && before.monthlyPrice !== data.monthlyPrice) {
      throw new Error(
        `这个方案已有 ${before._count.subscriptions} 个订阅在用，不能直接改价。` +
          '请新建一个方案并把新客户导到新方案，老客户的成交价保留在各自订阅上。',
      );
    }

    const updated = await prisma.servicePlan.update({ where: { id: input.id }, data });
    await auditAs(user, {
      action: 'UPDATE_SERVICE_PLAN',
      resource: 'ServicePlan',
      resourceId: updated.id,
      before: {
        name: before.name,
        monthlyPrice: before.monthlyPrice,
        visitsPerMonth: before.visitsPerMonth,
        isActive: before.isActive,
      },
      after: {
        name: updated.name,
        monthlyPrice: updated.monthlyPrice,
        visitsPerMonth: updated.visitsPerMonth,
        isActive: updated.isActive,
      },
    });
    return updated;
  }

  const dup = await prisma.servicePlan.findUnique({ where: { code: data.code } });
  if (dup) throw new Error('已有同代码的方案');

  const created = await prisma.servicePlan.create({ data });
  await auditAs(user, {
    action: 'CREATE_SERVICE_PLAN',
    resource: 'ServicePlan',
    resourceId: created.id,
    after: { code: created.code, name: created.name, monthlyPrice: created.monthlyPrice },
  });
  return created;
}
