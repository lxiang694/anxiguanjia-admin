import type { Role } from '@prisma/client';

/**
 * RBAC 能力清单。
 *
 * 刻意不使用 Admin / Staff / Family 三级粗粒度模型 —— 那会让「财务能看到长辈生活记录」
 * 这类越权变得无法阻止。能力粒度按业务动作划分，再配合 scope.ts 的数据范围一起判定：
 *
 *      有能力（能做这类动作） × 在范围内（这条数据属于我该看的） × 有授权（Consent）
 *
 * 三者同时成立才允许访问。
 */
export const CAPABILITIES = [
  // 家庭
  'household.read',
  'household.create',
  'household.update',
  'household.internalNotes.read',
  // 长辈档案
  'elder.read',
  'elder.update',
  'elder.sensitive.read', // 健康敏感信息
  'elder.sensitive.update',
  // 家庭成员与授权
  'familyMember.read',
  'familyMember.manage',
  'consent.read',
  'consent.manage',
  // 安心专员
  'staff.read',
  'staff.update',
  'staff.education.verify',
  'staff.training.manage',
  'staff.competency.manage',
  'staff.performance.read',
  // 排班与派单
  'task.read',
  'task.assign',
  'task.execute', // 一线执行（接受 / 到达 / 开始 / 完成）
  // 服务记录
  'visitRecord.read',
  'visitRecord.submit',
  'visitRecord.review',
  // 异常事件
  'incident.create',
  'incident.read',
  'incident.handle',
  // 安心报告
  'report.read',
  'report.generate',
  'report.review', // 人工确认 / 退回
  'report.publish',
  // 会员与订单
  'plan.read',
  'plan.manage',
  'subscription.read',
  'subscription.manage',
  'order.read',
  'order.refund',
  'invoice.manage',
  // 客服
  'feedback.read',
  'feedback.handle',
  // 数据看板
  'dashboard.operations',
  'dashboard.finance',
  'dashboard.quality',
  // 帐号
  'user.read',
  'user.manage', // 新建内部帐号、重置密码、停用
  // 系统
  'system.settings', // 服务类型 / 价格 / 通知模板 / 城市区域
  'system.roles', // 角色权限
  'system.audit', // 操作日志
  'system.export',
  // 家庭端
  'family.portal',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const ALL: Capability[] = [...CAPABILITIES];

/** 一线专员共有能力（不含查看全部客户、不含财务、不含系统配置） */
const SPECIALIST_BASE: Capability[] = [
  'household.read',
  'elder.read',
  'familyMember.read',
  'task.read',
  'task.execute',
  'visitRecord.read',
  'visitRecord.submit',
  'incident.create',
  'incident.read',
  'staff.read',
];

export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  /** 超级管理员：全部能力 */
  SUPER_ADMIN: ALL,

  /** 运营：日常业务全流程，但不得触碰系统配置与角色权限 */
  OPERATIONS: [
    'household.read',
    'household.create',
    'household.update',
    'household.internalNotes.read',
    'elder.read',
    'elder.update',
    'familyMember.read',
    'familyMember.manage',
    'consent.read',
    'consent.manage',
    'staff.read',
    'staff.performance.read',
    'task.read',
    'task.assign',
    'visitRecord.read',
    'visitRecord.review',
    'incident.read',
    'incident.handle',
    'report.read',
    'report.generate',
    'report.review',
    'report.publish',
    'plan.read',
    'subscription.read',
    'subscription.manage',
    'order.read',
    'feedback.read',
    'feedback.handle',
    'dashboard.operations',
    'dashboard.quality',
  ],

  /** 服务督导：培训、质控、服务审核、事件处理、专员支持 */
  SERVICE_SUPERVISOR: [
    'user.read',
    'household.read',
    'household.internalNotes.read',
    'elder.read',
    'elder.update',
    'familyMember.read',
    'consent.read',
    'staff.read',
    'staff.update',
    'staff.training.manage',
    'staff.competency.manage',
    'staff.performance.read',
    'task.read',
    'task.assign',
    'visitRecord.read',
    'visitRecord.review',
    'incident.read',
    'incident.handle',
    'report.read',
    'report.generate',
    'report.review',
    'report.publish',
    'feedback.read',
    'feedback.handle',
    'dashboard.operations',
    'dashboard.quality',
  ],

  /** 区域服务主管：本区域的服务安排、人员管理、运营指标 */
  AREA_MANAGER: [
    'household.read',
    'household.update',
    'household.internalNotes.read',
    'elder.read',
    'familyMember.read',
    'consent.read',
    'staff.read',
    'staff.update',
    'staff.performance.read',
    'task.read',
    'task.assign',
    'visitRecord.read',
    'visitRecord.review',
    'incident.read',
    'incident.handle',
    'report.read',
    'report.generate',
    'dashboard.operations',
    'dashboard.quality',
  ],

  /** 客服：家庭反馈、投诉、咨询。不进健康敏感信息，不改档案。 */
  CUSTOMER_SERVICE: [
    'household.read',
    'elder.read',
    'familyMember.read',
    'consent.read',
    'task.read',
    'report.read',
    'incident.read',
    'feedback.read',
    'feedback.handle',
    'subscription.read',
    'order.read',
  ],

  /** 财务：订单、订阅、发票、退款。明确不开放长辈生活记录与健康信息。 */
  FINANCE: [
    'household.read', // 仅用于识别家庭编号/名称，配合 scope 的字段裁剪
    'plan.read',
    'plan.manage',
    'subscription.read',
    'subscription.manage',
    'order.read',
    'order.refund',
    'invoice.manage',
    'dashboard.finance',
  ],

  /** 人事：人员档案、学历核验、培训、内部帐号。不进家庭数据。 */
  HR: [
    'user.read',
    'user.manage',
    'staff.read',
    'staff.update',
    'staff.education.verify',
    'staff.training.manage',
    'staff.competency.manage',
    'staff.performance.read',
  ],

  /** 城市负责人：本城市全部业务视图（受 scope 限制在自己城市） */
  CITY_LEAD: [
    'household.read',
    'household.create',
    'household.update',
    'household.internalNotes.read',
    'elder.read',
    'familyMember.read',
    'consent.read',
    'staff.read',
    'staff.update',
    'staff.performance.read',
    'task.read',
    'task.assign',
    'visitRecord.read',
    'visitRecord.review',
    'incident.read',
    'incident.handle',
    'report.read',
    'report.generate',
    'report.review',
    'subscription.read',
    'order.read',
    'feedback.read',
    'dashboard.operations',
    'dashboard.quality',
    'dashboard.finance',
  ],

  /** 家庭安心顾问：前期沟通、评估、方案制定、服务关系建立 */
  FAMILY_CONSULTANT: [
    ...SPECIALIST_BASE,
    'household.create',
    'household.update',
    'elder.update',
    'familyMember.manage',
    'consent.manage',
    'consent.read',
    'report.read',
  ],

  /** 资深家庭安心专员：在专员能力上增加对报告草稿的查看 */
  SENIOR_CARE_SPECIALIST: [...SPECIALIST_BASE, 'report.read'],

  /** 家庭安心专员 */
  CARE_SPECIALIST: SPECIALIST_BASE,

  /** 家庭成员：只有家庭端能力，一切数据再经 Consent 二次过滤 */
  FAMILY_MEMBER: ['family.portal'],
};

export function roleHas(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

/** 后台（/admin）准入角色 */
export const ADMIN_ROLES: Role[] = [
  'SUPER_ADMIN',
  'OPERATIONS',
  'SERVICE_SUPERVISOR',
  'AREA_MANAGER',
  'CUSTOMER_SERVICE',
  'FINANCE',
  'HR',
  'CITY_LEAD',
];

/** 专员工作台（/staff）准入角色 */
export const STAFF_ROLES: Role[] = [
  'CARE_SPECIALIST',
  'SENIOR_CARE_SPECIALIST',
  'FAMILY_CONSULTANT',
];

/** 家庭端（/family）准入角色 */
export const FAMILY_ROLES: Role[] = ['FAMILY_MEMBER'];

/** 仅限本城市数据的角色 */
export const CITY_SCOPED_ROLES: Role[] = ['CITY_LEAD', 'AREA_MANAGER'];
