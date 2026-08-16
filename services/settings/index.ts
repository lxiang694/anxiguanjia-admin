import 'server-only';

import type {
  NotificationChannel,
  NotificationLevel,
  NotificationTemplateEvent,
  PermissionType,
  ServiceType,
} from '@prisma/client';

import type { CurrentUser } from '@/lib/auth';
import { auditAs } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { assertCan } from '@/lib/permissions';
import { NOTIFICATION_TEMPLATE_VARS } from '@/lib/labels';

/**
 * 系统配置：服务类型与价格、通知模板。
 *
 * 需求里「系统 → 服务类型 / 价格 / 通知模板」这三项指的就是这里。
 *
 * 一个刻意的取舍：ServiceType 本身仍然是枚举（保证代码里的语义稳定，
 * 也保证派单能力校验有确定的对应关系），但**对外名称、默认时长、
 * 增值服务单价、是否开放给家庭端申请**全部存库、后台可改。
 * 这样运营能调口径与价格，而不会有人在界面上凭空造出一种系统不认识的服务。
 */

/* ============================ 服务类型与价格 ============================ */

export async function listServiceCatalog() {
  return prisma.serviceCatalogItem.findMany({
    orderBy: [{ sortOrder: 'asc' }, { serviceType: 'asc' }],
  });
}

/** 家庭端「申请额外服务」的可选项 —— 完全由后台配置决定，代码里不写死品类 */
export async function familyRequestableServices() {
  return prisma.serviceCatalogItem.findMany({
    where: { isActive: true, familyRequestable: true },
    orderBy: [{ sortOrder: 'asc' }],
    select: {
      serviceType: true,
      displayName: true,
      description: true,
      addOnPrice: true,
      defaultMinutes: true,
    },
  });
}

/** 取某个服务类型的默认时长；没有配置时回落到合理默认值 */
export async function defaultMinutesFor(serviceType: ServiceType): Promise<number> {
  const item = await prisma.serviceCatalogItem.findUnique({
    where: { serviceType },
    select: { defaultMinutes: true },
  });
  if (item) return item.defaultMinutes;
  return serviceType === 'PHONE_CARE' ? 15 : serviceType === 'MEDICAL_ESCORT' ? 180 : 60;
}

export type UpsertCatalogInput = {
  serviceType: ServiceType;
  displayName: string;
  description?: string | null;
  defaultMinutes: number;
  addOnPrice?: number | null;
  familyRequestable: boolean;
  requiresCompetency: boolean;
  isActive: boolean;
  sortOrder?: number;
};

export async function upsertServiceCatalogItem(user: CurrentUser, input: UpsertCatalogInput) {
  assertCan(user, 'system.settings');

  if (!input.displayName.trim()) throw new Error('请填写对外显示名称');
  if (input.defaultMinutes < 5 || input.defaultMinutes > 600) {
    throw new Error('默认时长需在 5 到 600 分钟之间');
  }
  if (input.addOnPrice != null && input.addOnPrice < 0) throw new Error('价格不能为负');
  if (input.familyRequestable && input.addOnPrice == null) {
    throw new Error('开放给家庭端申请的服务必须先设定单价，否则家庭看不到价钱');
  }

  const before = await prisma.serviceCatalogItem.findUnique({
    where: { serviceType: input.serviceType },
  });

  const data = {
    displayName: input.displayName.trim(),
    description: input.description ?? undefined,
    defaultMinutes: input.defaultMinutes,
    addOnPrice: input.addOnPrice ?? null,
    familyRequestable: input.familyRequestable,
    requiresCompetency: input.requiresCompetency,
    isActive: input.isActive,
    sortOrder: input.sortOrder ?? 0,
    updatedById: user.id,
  };

  const result = await prisma.serviceCatalogItem.upsert({
    where: { serviceType: input.serviceType },
    create: { serviceType: input.serviceType, ...data },
    update: data,
  });

  await auditAs(user, {
    action: 'UPDATE_SERVICE_CATALOG',
    resource: 'ServiceCatalogItem',
    resourceId: result.id,
    before: before
      ? {
          displayName: before.displayName,
          addOnPrice: before.addOnPrice,
          familyRequestable: before.familyRequestable,
          isActive: before.isActive,
        }
      : { existed: false },
    after: {
      displayName: result.displayName,
      addOnPrice: result.addOnPrice,
      familyRequestable: result.familyRequestable,
      isActive: result.isActive,
    },
  });

  return result;
}

/* ============================== 通知模板 ============================== */

export async function listNotificationTemplates() {
  return prisma.notificationTemplate.findMany({ orderBy: { event: 'asc' } });
}

export type UpsertTemplateInput = {
  event: NotificationTemplateEvent;
  name: string;
  level: NotificationLevel;
  titleTemplate: string;
  bodyTemplate?: string | null;
  enabledChannels: NotificationChannel[];
  requiredPermission?: PermissionType | null;
  isActive: boolean;
};

/** 模板里出现的占位符 */
export function extractPlaceholders(text: string): string[] {
  return Array.from(new Set(text.match(/\{\{\s*\w+\s*\}\}/g) ?? [])).map((x) =>
    x.replace(/\s+/g, ''),
  );
}

export async function upsertNotificationTemplate(user: CurrentUser, input: UpsertTemplateInput) {
  assertCan(user, 'system.settings');

  if (!input.name.trim()) throw new Error('请填写模板名称');
  if (!input.titleTemplate.trim()) throw new Error('请填写标题模板');

  // 校验占位符：不允许出现系统不认识的变量，否则家庭会收到 {{xxx}} 这样的原文
  const allowed = new Set(NOTIFICATION_TEMPLATE_VARS[input.event]);
  const used = [
    ...extractPlaceholders(input.titleTemplate),
    ...extractPlaceholders(input.bodyTemplate ?? ''),
  ];
  const unknown = used.filter((v) => !allowed.has(v));
  if (unknown.length > 0) {
    throw new Error(
      `模板里出现了这个场景不支持的变量：${unknown.join('、')}。可用变量：${Array.from(allowed).join('、')}`,
    );
  }

  if (!input.enabledChannels.includes('IN_APP')) {
    throw new Error('站内通知是第一版唯一真正会送达的渠道，必须保持启用');
  }

  const before = await prisma.notificationTemplate.findUnique({ where: { event: input.event } });

  const data = {
    name: input.name.trim(),
    level: input.level,
    titleTemplate: input.titleTemplate.trim(),
    bodyTemplate: input.bodyTemplate ?? undefined,
    availableVars: NOTIFICATION_TEMPLATE_VARS[input.event],
    enabledChannels: input.enabledChannels,
    requiredPermission: input.requiredPermission ?? null,
    isActive: input.isActive,
    updatedById: user.id,
  };

  const result = await prisma.notificationTemplate.upsert({
    where: { event: input.event },
    create: { event: input.event, ...data },
    update: data,
  });

  await auditAs(user, {
    action: 'UPDATE_NOTIFICATION_TEMPLATE',
    resource: 'NotificationTemplate',
    resourceId: result.id,
    before: before ? { titleTemplate: before.titleTemplate, isActive: before.isActive } : { existed: false },
    after: { titleTemplate: result.titleTemplate, isActive: result.isActive },
  });

  return result;
}

/** 用模板渲染一条通知文案。缺失变量会原样保留，便于运营在预览里立刻看出漏配。 */
export function renderTemplate(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) => vars[key] ?? whole);
}
