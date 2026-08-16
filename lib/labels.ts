/**
 * 全站中文文案字典。
 *
 * 术语纪律（产品要求，不可违反）：
 *  - 一线成员统一称「家庭安心专员」／简称「安心专员」。
 *  - 界面严禁出现：阿姨、服务阿姨、护工、陪护、陪诊阿姨、工作人员。
 *  - `care_specialist` 只是程序内部命名，不代表任何医疗护理资质。
 *  - 不使用诊断性表述；一切健康相关文字都必须是「观察到的事实」或「本人反映」。
 */

import type {
  ChangeRequestStatus,
  ChangeRequestType,
  ConsentBasis,
  ConsentStatus,
  EducationLevel,
  EmploymentStatus,
  FeedbackCategory,
  FeedbackStatus,
  Gender,
  HouseholdStatus,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  InvoiceStatus,
  InvoiceType,
  LivingStatus,
  MobilityStatus,
  NotificationChannel,
  NotificationLevel,
  NotificationTemplateEvent,
  ObservationLevel,
  OrderStatus,
  OrderType,
  PermissionType,
  PlanTier,
  ReadingSource,
  ReadingType,
  RelationshipType,
  ReportGeneration,
  ReportStatus,
  Role,
  ServiceStatus,
  ServiceType,
  StaffLevel,
  SubscriptionStatus,
  TaskStatus,
  TrainingStatus,
  TrainingType,
  UserStatus,
  VerificationStatus,
} from '@prisma/client';

export const BRAND = {
  name: '家庭安心管家',
  tagline: '父母身边的家庭健康生活助理',
  promise: '替不在身边的子女，多照看一下爸妈',
  city: '长沙',
} as const;

/** 岗位名称 —— 唯一合法的对外称呼 */
export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: '超级管理员',
  OPERATIONS: '运营',
  SERVICE_SUPERVISOR: '服务督导',
  AREA_MANAGER: '区域服务主管',
  CUSTOMER_SERVICE: '客服',
  FINANCE: '财务',
  HR: '人事',
  CITY_LEAD: '城市负责人',
  FAMILY_CONSULTANT: '家庭安心顾问',
  SENIOR_CARE_SPECIALIST: '资深家庭安心专员',
  CARE_SPECIALIST: '家庭安心专员',
  FAMILY_MEMBER: '家庭成员',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  INVITED: '已邀请',
  ACTIVE: '正常',
  SUSPENDED: '已暂停',
  DISABLED: '已停用',
};

export const HOUSEHOLD_STATUS_LABELS: Record<HouseholdStatus, string> = {
  LEAD: '潜在',
  PENDING_ASSESSMENT: '待评估',
  TRIAL: '体验中',
  ACTIVE_MEMBER: '正式会员',
  RENEWAL_DUE: '待续费',
  PAUSED: '暂停',
  TERMINATED: '终止',
};

export const HOUSEHOLD_STATUS_TONE: Record<HouseholdStatus, 'neutral' | 'brand' | 'warm' | 'danger' | 'info'> = {
  LEAD: 'neutral',
  PENDING_ASSESSMENT: 'info',
  TRIAL: 'info',
  ACTIVE_MEMBER: 'brand',
  RENEWAL_DUE: 'warm',
  PAUSED: 'warm',
  TERMINATED: 'danger',
};

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: '男',
  FEMALE: '女',
  UNDISCLOSED: '未填写',
};

export const LIVING_STATUS_LABELS: Record<LivingStatus, string> = {
  ALONE: '独居',
  WITH_SPOUSE: '与配偶同住',
  WITH_CHILDREN: '与子女同住',
  WITH_CAREGIVER: '与照护者同住',
  OTHER: '其他',
};

export const MOBILITY_STATUS_LABELS: Record<MobilityStatus, string> = {
  INDEPENDENT: '行动自如',
  SLOW_BUT_INDEPENDENT: '较慢但可自理',
  NEEDS_AID: '需使用辅具',
  NEEDS_ASSISTANCE: '需他人协助',
  MOSTLY_BEDBOUND: '多在床上',
  UNKNOWN: '暂未了解',
};

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  SON: '儿子',
  DAUGHTER: '女儿',
  SPOUSE: '配偶',
  DAUGHTER_IN_LAW: '儿媳',
  SON_IN_LAW: '女婿',
  GRANDCHILD: '孙辈',
  SIBLING: '兄弟姐妹',
  RELATIVE: '亲属',
  FRIEND: '朋友',
  OTHER: '其他',
};

export const PERMISSION_LABELS: Record<PermissionType, string> = {
  ASSURANCE_REPORT: '安心报告',
  LIFE_RECORD: '生活记录',
  PHOTO: '服务照片',
  INCIDENT_ALERT: '异常通知',
  SENSITIVE_HEALTH: '健康敏感信息',
  SERVICE_SCHEDULE: '服务安排',
  CONTACT_INFO: '联络方式',
};

export const PERMISSION_DESCRIPTIONS: Record<PermissionType, string> = {
  ASSURANCE_REPORT: '每周由公司整理、经人工确认后的家庭安心报告。',
  LIFE_RECORD: '安心专员上门时记录的精神、饮食、睡眠、活动等生活观察。',
  PHOTO: '服务过程中征得同意后拍摄的照片。',
  INCIDENT_ALERT: '发生异常情况时的即时通知。',
  SENSITIVE_HEALTH: '慢性情况、用药、血压血糖等敏感信息。默认不开放。',
  SERVICE_SCHEDULE: '上门与关怀的时间安排。',
  CONTACT_INFO: '长辈的联络方式与地址。',
};

export const CONSENT_STATUS_LABELS: Record<ConsentStatus, string> = {
  ACTIVE: '有效',
  EXPIRED: '已过期',
  REVOKED: '已撤回',
};

export const CONSENT_BASIS_LABELS: Record<ConsentBasis, string> = {
  ELDER_SELF_SIGNED: '长辈本人签署',
  ELDER_VERBAL_WITNESSED: '长辈口头同意（有见证记录）',
  LEGAL_GUARDIAN: '法定监护人代为同意',
  SERVICE_NECESSITY: '服务履行必要（最小范围）',
};

export const STAFF_LEVEL_LABELS: Record<StaffLevel, string> = {
  TRAINEE: '实习',
  JUNIOR: '初级',
  INTERMEDIATE: '中级',
  SENIOR: '资深',
  SUPERVISOR: '督导',
};

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  CANDIDATE: '候选人',
  ONBOARDED: '已入职',
  RESIGNED: '离职',
};

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  NOT_STARTED: '未开始',
  IN_TRAINING: '培训中',
  PENDING_ASSESSMENT: '待考核',
  PASSED: '已通过',
  ACTIVE: '可排班',
  SUSPENDED: '暂停服务',
  OFFBOARDED: '已离职',
};

/** 上岗状态机的推进顺序，用于界面展示流程条 */
export const SERVICE_STATUS_FLOW: ServiceStatus[] = [
  'NOT_STARTED',
  'IN_TRAINING',
  'PENDING_ASSESSMENT',
  'PASSED',
  'ACTIVE',
];

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  UNVERIFIED: '未核验',
  PENDING: '核验中',
  VERIFIED: '已核验',
  REJECTED: '核验未通过',
};

export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  SECONDARY_VOCATIONAL: '中专',
  JUNIOR_COLLEGE: '大专',
  BACHELOR: '本科',
  MASTER: '硕士',
  OTHER: '其他',
};

export const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  ONBOARDING: '入职培训',
  SERVICE_PHILOSOPHY: '服务理念',
  ELDER_COMMUNICATION: '长者沟通',
  SERVICE_PROCESS: '服务流程',
  SAFETY: '安全',
  PRIVACY: '隐私保护',
  INCIDENT_HANDLING: '异常事件处理',
  PRACTICAL_ASSESSMENT: '实操考核',
  OTHER: '其他',
};

export const TRAINING_STATUS_LABELS: Record<TrainingStatus, string> = {
  NOT_STARTED: '未开始',
  IN_PROGRESS: '培训中',
  PENDING_EXAM: '待考核',
  PASSED: '通过',
  FAILED: '未通过',
  NEEDS_RETRAIN: '需复训',
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  HOME_VISIT: '安心探访',
  PHONE_CARE: '电话关怀',
  MEDICAL_ESCORT: '陪诊协助',
  DAILY_ASSISTANCE: '生活协助',
  ASSESSMENT: '家庭安心评估',
  EXTRA_VISIT: '额外探访',
};

export const PLAN_TIER_LABELS: Record<PlanTier, string> = {
  CARE: '关怀版',
  ASSURANCE: '安心版',
  STEWARD: '管家版',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING_ASSIGN: '待派单',
  ASSIGNED: '已派单',
  ACCEPTED: '已接受',
  READY_TO_DEPART: '待出发',
  ARRIVED: '已到达',
  IN_SERVICE: '服务中',
  PENDING_RECORD: '待提交记录',
  PENDING_REVIEW: '待审核',
  COMPLETED: '已完成',
  CANCELLED: '取消',
  RESCHEDULED: '改期',
  DECLINED: '拒绝',
  NOT_COMPLETED: '服务未完成',
};

export const TASK_STATUS_TONE: Record<TaskStatus, 'neutral' | 'brand' | 'warm' | 'danger' | 'info'> = {
  PENDING_ASSIGN: 'warm',
  ASSIGNED: 'info',
  ACCEPTED: 'info',
  READY_TO_DEPART: 'info',
  ARRIVED: 'brand',
  IN_SERVICE: 'brand',
  PENDING_RECORD: 'warm',
  PENDING_REVIEW: 'warm',
  COMPLETED: 'brand',
  CANCELLED: 'neutral',
  RESCHEDULED: 'neutral',
  DECLINED: 'danger',
  NOT_COMPLETED: 'danger',
};

/** 服务记录卡片的可选项文案 —— 全部使用观察性措辞 */
export const OBSERVATION_LABELS: Record<ObservationLevel, string> = {
  NORMAL: '正常',
  FAIR: '一般',
  SELF_REPORTED_ISSUE: '本人反映有变化',
  REDUCED: '较平常减少',
  UNKNOWN: '不清楚',
  OTHER: '其他',
};

/** 各观察维度在服务记录表单中的具体选项（措辞按业务要求逐项定制） */
export const SPIRIT_OPTIONS: { value: ObservationLevel; label: string }[] = [
  { value: 'NORMAL', label: '正常交流' },
  { value: 'FAIR', label: '较平常安静' },
  { value: 'REDUCED', label: '较疲倦' },
  { value: 'OTHER', label: '其他' },
];

export const DIET_OPTIONS: { value: ObservationLevel; label: string }[] = [
  { value: 'NORMAL', label: '正常' },
  { value: 'FAIR', label: '一般' },
  { value: 'SELF_REPORTED_ISSUE', label: '本人反映食欲减少' },
  { value: 'UNKNOWN', label: '不清楚' },
];

export const SLEEP_OPTIONS: { value: ObservationLevel; label: string }[] = [
  { value: 'NORMAL', label: '正常' },
  { value: 'FAIR', label: '一般' },
  { value: 'SELF_REPORTED_ISSUE', label: '本人反映近期睡不好' },
  { value: 'UNKNOWN', label: '不清楚' },
];

export const ACTIVITY_OPTIONS: { value: ObservationLevel; label: string }[] = [
  { value: 'NORMAL', label: '正常' },
  { value: 'REDUCED', label: '减少' },
  { value: 'FAIR', label: '活动不便' },
  { value: 'OTHER', label: '其他' },
];

/** 今日完成事项（多选） */
export const COMPLETED_ITEM_OPTIONS = [
  '陪伴聊天',
  '散步',
  '购买生活用品',
  '手机使用协助',
  '陪诊',
  '协助整理居家环境',
  '其他',
] as const;

export const READING_TYPE_LABELS: Record<ReadingType, string> = {
  BLOOD_PRESSURE: '血压',
  BLOOD_GLUCOSE: '血糖',
  WEIGHT: '体重',
  TEMPERATURE: '体温',
  HEART_RATE: '心率',
};

export const READING_SOURCE_LABELS: Record<ReadingSource, string> = {
  ELDER_SELF_MEASURED: '本人自行测量',
  FAMILY_PROVIDED: '家庭成员提供',
  SPECIALIST_ASSISTED: '安心专员协助记录',
  MEDICAL_DOCUMENT: '医疗资料提供',
};

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  CANNOT_REACH_ELDER: '无法联系长辈',
  ELDER_FEELS_UNWELL: '长辈表示身体不适',
  FALL: '跌倒',
  ENVIRONMENT_SAFETY: '生活环境安全问题',
  SERVICE_CONFLICT: '服务冲突',
  FAMILY_DISPUTE: '家庭纠纷',
  OTHER: '其他',
};

export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  LOW: '轻微',
  MEDIUM: '一般',
  HIGH: '较严重',
  CRITICAL: '紧急',
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  NEW: '新事件',
  ACKNOWLEDGED: '已接单',
  IN_PROGRESS: '处理中',
  PENDING_FOLLOW_UP: '待跟进',
  CLOSED: '已关闭',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  DRAFT: '草稿',
  PENDING_REVIEW: '待审核',
  APPROVED: '已确认',
  PUBLISHED: '已发布',
  REJECTED: '已退回',
};

export const REPORT_GENERATION_LABELS: Record<ReportGeneration, string> = {
  RULE_BASED_DRAFT: '系统依原始记录汇总生成',
  AI_ASSISTED: 'AI 辅助整理（已人工确认）',
  HUMAN_WRITTEN: '人工撰写',
};

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  TRIAL: '体验期',
  ACTIVE: '生效中',
  PAST_DUE: '待付款',
  PAUSED: '已暂停',
  CANCELLED: '已取消',
  EXPIRED: '已到期',
};

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  NEW_SUBSCRIPTION: '新订阅',
  RENEWAL: '续费',
  ADD_ON: '增值服务',
  REFUND: '退款',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: '待付款',
  PAID: '已付款',
  REFUNDED: '已退款',
  CANCELLED: '已取消',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  NOT_REQUESTED: '未申请',
  REQUESTED: '已申请',
  ISSUED: '已开票',
  VOIDED: '已作废',
};

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  PERSONAL_ELECTRONIC: '个人电子发票',
  COMPANY_ELECTRONIC: '单位电子发票',
  COMPANY_SPECIAL: '单位专用发票',
};

export const NOTIFICATION_TEMPLATE_EVENT_LABELS: Record<NotificationTemplateEvent, string> = {
  SERVICE_COMPLETED: '服务完成',
  REPORT_PUBLISHED: '安心报告生成',
  NEXT_SERVICE_REMINDER: '下一次服务提醒',
  SPECIALIST_CHANGED: '专员调整',
  SCHEDULE_CHANGED: '服务时间更改',
  MEMBERSHIP_EXPIRING: '会员即将到期',
  INCIDENT_URGENT: '需家庭立即确认的现场事件',
  CANNOT_REACH_ELDER: '无法联系长辈',
};

/** 通知模板里可用的占位符。界面会照这份清单提示运营，避免写出系统不认识的变量。 */
export const NOTIFICATION_TEMPLATE_VARS: Record<NotificationTemplateEvent, string[]> = {
  SERVICE_COMPLETED: ['{{elderName}}', '{{serviceType}}', '{{specialistName}}', '{{serviceTime}}'],
  REPORT_PUBLISHED: ['{{elderName}}', '{{reportTitle}}', '{{periodStart}}', '{{periodEnd}}'],
  NEXT_SERVICE_REMINDER: ['{{elderName}}', '{{serviceType}}', '{{serviceTime}}', '{{specialistName}}'],
  SPECIALIST_CHANGED: ['{{elderName}}', '{{fromSpecialist}}', '{{toSpecialist}}', '{{reason}}'],
  SCHEDULE_CHANGED: ['{{elderName}}', '{{oldTime}}', '{{newTime}}', '{{reason}}'],
  MEMBERSHIP_EXPIRING: ['{{householdName}}', '{{planName}}', '{{expireDate}}'],
  INCIDENT_URGENT: ['{{elderName}}', '{{incidentType}}', '{{description}}', '{{occurredAt}}'],
  CANNOT_REACH_ELDER: ['{{elderName}}', '{{specialistName}}', '{{occurredAt}}'],
};

export const NOTIFICATION_LEVEL_LABELS: Record<NotificationLevel, string> = {
  NORMAL: '普通',
  IMPORTANT: '重要',
  URGENT: '紧急',
};

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  IN_APP: '站内通知',
  SMS: '短信',
  WECHAT: '微信',
  WECOM: '企业微信',
};

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  SERVICE_ATTITUDE: '服务态度',
  TIMING: '时间问题',
  SERVICE_CONTENT: '服务内容',
  SAFETY: '安全问题',
  PAYMENT: '付款',
  CONSULTATION: '咨询',
  OTHER: '其他',
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  NEW: '新建',
  IN_PROGRESS: '处理中',
  AWAITING_FAMILY: '等待家庭确认',
  RESOLVED: '已解决',
  CLOSED: '已关闭',
};

export const CHANGE_REQUEST_TYPE_LABELS: Record<ChangeRequestType, string> = {
  RESCHEDULE: '申请改期',
  CANCEL: '取消申请',
  EXTRA_SERVICE: '申请额外服务',
};

export const CHANGE_REQUEST_STATUS_LABELS: Record<ChangeRequestStatus, string> = {
  SUBMITTED: '已提交',
  APPROVED: '已同意',
  DECLINED: '未通过',
  CANCELLED: '已取消',
};

/**
 * 家庭端可自助申请的额外服务品类，已改为由「系统 → 服务类型与价格」
 * （ServiceCatalogItem.familyRequestable）配置，不再在前端写死白名单。
 * 判断点在 services/family.submitChangeRequest。
 */

/** 非医疗声明 —— 出现健康相关内容的页面必须展示 */
export const NON_MEDICAL_DISCLAIMER =
  '本系统记录的是安心专员的服务观察与家庭提供的信息，不构成任何医疗诊断、治疗建议或医疗结论。如有健康疑虑，请咨询专业医疗机构。';

export const DEMO_DISCLAIMER =
  '本环境中的家庭、长辈、安心专员、学历、培训与服务数据均为便于演示而虚构的示例数据，不代表公司真实客户或真实案例。';
