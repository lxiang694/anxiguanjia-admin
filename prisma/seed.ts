/**
 * ============================================================================
 * 家庭安心管家 — Demo 种子数据
 * ============================================================================
 *
 * ⚠️ 重要声明
 *
 * 本文件生成的全部家庭、长辈、家庭成员、安心专员、学历、培训、服务记录、
 * 报告与订单都是【为便于演示而虚构的示例数据】。
 *
 * 每一条记录都带 isDemo = true，界面上会显示「示例数据」标记。
 * 这些内容不代表公司真实客户、真实员工背景或真实服务案例，
 * 不得用于对外宣传、招商或作为公司业绩案例展示。
 *
 * 密码：所有演示帐号统一使用 Demo@2026，仅适用于本地/演示环境。
 * 正式部署必须重置全部密码，并把 NEXT_PUBLIC_DEMO_MODE 设为 false。
 * ============================================================================
 */

import { PrismaClient, type Prisma, type TrainingCourse } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo@2026';

/** 相对今天的偏移，保证种子数据永远落在「本周」，Demo 打开就有内容 */
function daysAgo(days: number, hour = 9, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function daysAhead(days: number, hour = 9, minute = 0): Date {
  return daysAgo(-days, hour, minute);
}

function yyyymmdd(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function isoWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

/** 本周一 00:00 与下周一 00:00 */
function thisWeek(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return { start, end };
}

/** 让「本周内的第 n 天」始终是已经过去的时间，避免报告统计到未来的服务 */
function earlierThisWeek(offsetDays: number, hour: number, minute = 0): Date {
  const { start } = thisWeek();
  const candidate = new Date(start);
  candidate.setDate(candidate.getDate() + offsetDays);
  candidate.setHours(hour, minute, 0, 0);
  const now = new Date();
  if (candidate > now) {
    // 若该时间点还没到，就退回到今天更早的时刻
    const fallback = new Date(now);
    fallback.setHours(Math.max(0, now.getHours() - 3), 0, 0, 0);
    return fallback;
  }
  return candidate;
}

async function main() {
  console.log('🌱 开始生成示例数据…\n');

  /* =========================================================================
   * 0. 清空（仅示例数据环境使用）
   * ======================================================================= */
  console.log('  清理旧数据…');
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.timelineEvent.deleteMany(),
    prisma.incidentEvent.deleteMany(),
    prisma.incident.deleteMany(),
    prisma.assuranceVisitRecordLink.deleteMany(),
    prisma.assuranceReport.deleteMany(),
    prisma.healthReading.deleteMany(),
    prisma.visitRecord.deleteMany(),
    prisma.serviceChangeRequest.deleteMany(),
    prisma.serviceTask.deleteMany(),
    prisma.feedbackCase.deleteMany(),
    prisma.order.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.householdServicePlan.deleteMany(),
    prisma.householdAssessment.deleteMany(),
    prisma.specialistChangeLog.deleteMany(),
    prisma.consent.deleteMany(),
    prisma.elderSensitiveInfo.deleteMany(),
  ]);
  await prisma.$transaction([
    prisma.staffPerformanceSnapshot.deleteMany(),
    prisma.staffAvailability.deleteMany(),
    prisma.staffCompetency.deleteMany(),
    prisma.trainingRecord.deleteMany(),
    prisma.educationRecord.deleteMany(),
  ]);
  // 先解开 Household 对 FamilyMember / StaffProfile 的引用，避免外键顺序问题
  await prisma.household.updateMany({
    data: {
      primaryContactId: null,
      primarySpecialistId: null,
      backupSpecialistId: null,
      consultantId: null,
    },
  });
  await prisma.$transaction([
    prisma.familyMember.deleteMany(),
    prisma.elder.deleteMany(),
    prisma.household.deleteMany(),
    prisma.staffProfile.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
    prisma.competency.deleteMany(),
    prisma.trainingCourse.deleteMany(),
    prisma.servicePlan.deleteMany(),
    prisma.serviceCatalogItem.deleteMany(),
    prisma.notificationTemplate.deleteMany(),
    prisma.district.deleteMany(),
    prisma.city.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  /* =========================================================================
   * 1. 城市与区域 —— 首个运营城市：湖南长沙
   * ======================================================================= */
  console.log('  城市与区域…');
  const changsha = await prisma.city.create({
    data: {
      name: '长沙',
      province: '湖南',
      isActive: true,
      districts: {
        create: [
          { name: '岳麓区' },
          { name: '开福区' },
          { name: '天心区' },
          { name: '雨花区' },
          { name: '芙蓉区' },
        ],
      },
    },
    include: { districts: true },
  });
  const yuelu = changsha.districts.find((d) => d.name === '岳麓区')!;
  const kaifu = changsha.districts.find((d) => d.name === '开福区')!;

  /* =========================================================================
   * 2. 培训课程 —— 公司培训，不等同任何法定资格
   * ======================================================================= */
  console.log('  培训课程…');
  const courseData: Prisma.TrainingCourseCreateInput[] = [
    {
      title: '家庭安心服务理念',
      type: 'SERVICE_PHILOSOPHY',
      description: '我们做什么、不做什么。为什么替不在身边的子女多照看一下爸妈，是一件需要专业的事。',
      creditHours: 4,
      isMandatory: true,
      requiresExam: true,
      passingScore: 80,
    },
    {
      title: '长者沟通基础',
      type: 'ELDER_COMMUNICATION',
      description: '如何与长辈建立信任、如何倾听、如何避免让长辈感到被审视。',
      creditHours: 6,
      isMandatory: true,
      requiresExam: true,
      passingScore: 80,
    },
    {
      title: '上门服务标准流程',
      type: 'SERVICE_PROCESS',
      description: '到达、问候、观察、协助、记录、告别的标准动作与边界。',
      creditHours: 6,
      isMandatory: true,
      requiresExam: true,
      passingScore: 85,
    },
    {
      title: '个人信息保护',
      type: 'PRIVACY',
      description: '哪些信息可以记录、哪些不能；为什么付款人也不能自动看到长辈的全部信息。',
      creditHours: 4,
      isMandatory: true,
      requiresExam: true,
      passingScore: 90,
      validMonths: 12,
    },
    {
      title: '陪诊服务边界',
      type: 'SERVICE_PROCESS',
      description: '陪诊协助的具体内容与明确不做的事：不提供医疗判断、不代替家属做医疗决定。',
      creditHours: 4,
      isMandatory: true,
      requiresExam: true,
      passingScore: 85,
    },
    {
      title: '异常事件处理',
      type: 'INCIDENT_HANDLING',
      description: '遇到无法联系长辈、长辈不适、跌倒时的处理顺序与上报要求。',
      creditHours: 5,
      isMandatory: true,
      requiresExam: true,
      passingScore: 90,
      validMonths: 12,
    },
    {
      title: '服务记录规范',
      type: 'SERVICE_PROCESS',
      description: '如何写客观事实而不是诊断：「本人表示昨晚约凌晨一点入睡」与「患有严重失眠」的区别。',
      creditHours: 3,
      isMandatory: true,
      requiresExam: true,
      passingScore: 85,
    },
    {
      title: '安全培训（居家环境与自我保护）',
      type: 'SAFETY',
      description: '识别居家安全风险，以及专员自身的安全边界。',
      creditHours: 3,
      isMandatory: true,
      requiresExam: true,
      passingScore: 80,
    },
    {
      title: '实操考核',
      type: 'PRACTICAL_ASSESSMENT',
      description: '模拟上门全流程，由服务督导现场评分。通过后才可正式安排上门服务。',
      creditHours: 4,
      isMandatory: true,
      requiresExam: true,
      passingScore: 85,
    },
  ];
  const courses: TrainingCourse[] = [];
  for (const c of courseData) {
    courses.push(await prisma.trainingCourse.create({ data: c }));
  }

  /* =========================================================================
   * 3. 能力标签 —— 区分公司内部认定与法定资格
   * ======================================================================= */
  console.log('  能力标签…');
  const competencyData: Prisma.CompetencyCreateInput[] = [
    {
      name: '长辈沟通',
      code: 'elder_communication',
      description: '能与长辈建立信任关系，识别情绪与真实需求。',
      requiresCredential: false,
      requiredForServices: ['HOME_VISIT', 'PHONE_CARE', 'EXTRA_VISIT'],
    },
    {
      name: '上门探访',
      code: 'home_visit',
      description: '独立完成一次标准上门安心探访并规范提交记录。',
      requiresCredential: false,
      requiredForServices: ['HOME_VISIT', 'EXTRA_VISIT'],
    },
    {
      name: '陪诊协助',
      code: 'medical_escort',
      description:
        '陪同长辈完成就诊流程的协助工作。注意：本能力不代表任何医疗或护理资质，涉及资格的部分需另有外部凭证。',
      requiresCredential: true,
      requiredForServices: ['MEDICAL_ESCORT'],
    },
    {
      name: '生活协助',
      code: 'daily_assistance',
      description: '代购生活用品、协助日常事务办理。',
      requiresCredential: false,
      requiredForServices: ['DAILY_ASSISTANCE'],
    },
    {
      name: '手机使用协助',
      code: 'phone_assistance',
      description: '协助长辈使用智能手机与常用应用。',
      requiresCredential: false,
      requiredForServices: [],
    },
    {
      name: '情绪陪伴',
      code: 'emotional_support',
      description: '识别长辈的情绪变化并给予适当陪伴。不含任何心理治疗性质的服务。',
      requiresCredential: false,
      requiredForServices: [],
    },
    {
      name: '家庭沟通',
      code: 'family_communication',
      description: '与家庭成员沟通服务安排与观察情况。',
      requiresCredential: false,
      requiredForServices: [],
    },
    {
      name: '家庭安心评估',
      code: 'household_assessment',
      description: '完成家庭前期需求了解与安心评估。',
      requiresCredential: false,
      requiredForServices: ['ASSESSMENT'],
    },
  ];
  const competencies = [];
  for (const c of competencyData) {
    competencies.push(await prisma.competency.create({ data: c }));
  }
  const byCode = new Map(competencies.map((c) => [c.code, c]));

  /* =========================================================================
   * 4. 服务方案 —— 权益全部存库，后台可编辑
   * ======================================================================= */
  console.log('  服务方案…');
  const carePlan = await prisma.servicePlan.create({
    data: {
      code: 'CARE',
      name: '关怀版',
      tier: 'CARE',
      description: '以电话关怀为主，每月一次上门。适合子女在本地、但工作日无法常回家的家庭。',
      monthlyPrice: 39900,
      visitsPerMonth: 1,
      phoneCarePerMonth: 8,
      reportsPerMonth: 4,
      includedServices: ['HOME_VISIT', 'PHONE_CARE'],
      sortOrder: 1,
    },
  });
  const assurancePlan = await prisma.servicePlan.create({
    data: {
      code: 'ASSURANCE',
      name: '安心版',
      tier: 'ASSURANCE',
      description: '每周一次上门探访、每周两次电话关怀、每周一份安心报告。我们最推荐的方案。',
      monthlyPrice: 79900,
      visitsPerMonth: 4,
      phoneCarePerMonth: 8,
      reportsPerMonth: 4,
      includedServices: ['HOME_VISIT', 'PHONE_CARE', 'DAILY_ASSISTANCE'],
      sortOrder: 2,
    },
  });
  const stewardPlan = await prisma.servicePlan.create({
    data: {
      code: 'STEWARD',
      name: '管家版',
      tier: 'STEWARD',
      description: '每周两次上门、含陪诊协助与生活代办。适合子女在外地、长辈行动不便的家庭。',
      monthlyPrice: 159900,
      visitsPerMonth: 8,
      phoneCarePerMonth: 12,
      reportsPerMonth: 4,
      includedServices: ['HOME_VISIT', 'PHONE_CARE', 'MEDICAL_ESCORT', 'DAILY_ASSISTANCE'],
      sortOrder: 3,
    },
  });

  console.log(
    `    在售方案：${[carePlan, assurancePlan, stewardPlan].map((p) => p.name).join('、')}`,
  );

  /* =========================================================================
   * 4b. 服务目录 —— 服务类型的展示名、默认时长、是否开放家庭自助申请
   *
   * 这张表是「家庭端能申请哪几类额外服务」的唯一来源，前端不再写死白名单。
   * requiresCompetency=true 表示派单时会校验专员是否具备对应能力标签。
   * ======================================================================= */
  console.log('  服务目录…');
  const catalog: Prisma.ServiceCatalogItemCreateInput[] = [
    {
      serviceType: 'HOME_VISIT',
      displayName: '上门安心探访',
      description: '安心专员上门陪伴、生活观察与协助，服务结束后形成服务记录。',
      defaultMinutes: 60,
      familyRequestable: false,
      requiresCompetency: true,
      sortOrder: 1,
    },
    {
      serviceType: 'PHONE_CARE',
      displayName: '电话关怀',
      description: '定期电话问候，确认长辈近况与需求。',
      defaultMinutes: 15,
      familyRequestable: false,
      requiresCompetency: false,
      sortOrder: 2,
    },
    {
      serviceType: 'ASSESSMENT',
      displayName: '家庭安心评估',
      description: '由家庭安心顾问上门完成，用于确定服务方案与注意事项。',
      defaultMinutes: 90,
      familyRequestable: false,
      requiresCompetency: true,
      sortOrder: 3,
    },
    // ↓ 以下三类开放家庭自助申请，必须有加购价格（服务层会校验）
    {
      serviceType: 'MEDICAL_ESCORT',
      displayName: '陪诊协助',
      description: '陪同挂号、就诊流程协助与陪伴，不提供任何医疗判断或用药建议。',
      defaultMinutes: 180,
      addOnPrice: 29900,
      familyRequestable: true,
      requiresCompetency: true,
      sortOrder: 4,
    },
    {
      serviceType: 'EXTRA_VISIT',
      displayName: '额外探访',
      description: '在原有方案之外增加一次上门陪伴与生活协助。',
      defaultMinutes: 60,
      addOnPrice: 12900,
      familyRequestable: true,
      requiresCompetency: true,
      sortOrder: 5,
    },
    {
      serviceType: 'DAILY_ASSISTANCE',
      displayName: '生活代办',
      description: '代购生活用品、协助日常事务办理。',
      defaultMinutes: 60,
      addOnPrice: 9900,
      familyRequestable: true,
      requiresCompetency: false,
      sortOrder: 6,
    },
  ];
  for (const item of catalog) {
    await prisma.serviceCatalogItem.create({ data: item });
  }
  console.log(
    `    服务类型 ${catalog.length} 项，其中开放家庭自助申请 ${catalog.filter((c) => c.familyRequestable).length} 项`,
  );

  /* =========================================================================
   * 4c. 通知模板
   *
   * 关键约束：
   *  - 变量只能取 lib/labels.NOTIFICATION_TEMPLATE_VARS 白名单里的占位符，
   *    服务层会拒绝未知变量，避免把敏感字段拼进短信。
   *  - requiredPermission 表示这条通知要发给家庭成员时，必须先有对应授权；
   *    没有授权的成员不会收到 —— 通知也是一种数据出口。
   *  - 第一版只真正实现站内通知，其他渠道保持关闭而不是假装已接通。
   * ======================================================================= */
  console.log('  通知模板…');
  const templates: Prisma.NotificationTemplateCreateInput[] = [
    {
      event: 'SERVICE_COMPLETED',
      name: '服务完成',
      level: 'NORMAL',
      titleTemplate: '{{elderName}}的{{serviceType}}已完成',
      bodyTemplate: '{{specialistName}} 于 {{serviceTime}} 完成本次服务，服务记录审核后会同步给您。',
      availableVars: ['{{elderName}}', '{{serviceType}}', '{{specialistName}}', '{{serviceTime}}'],
      enabledChannels: ['IN_APP'],
      requiredPermission: 'SERVICE_SCHEDULE',
    },
    {
      event: 'REPORT_PUBLISHED',
      name: '安心报告已发布',
      level: 'NORMAL',
      titleTemplate: '{{elderName}}的安心报告已经可以查看',
      bodyTemplate: '{{periodStart}} 至 {{periodEnd}} 的《{{reportTitle}}》已发布。',
      availableVars: ['{{elderName}}', '{{reportTitle}}', '{{periodStart}}', '{{periodEnd}}'],
      enabledChannels: ['IN_APP'],
      requiredPermission: 'ASSURANCE_REPORT',
    },
    {
      event: 'NEXT_SERVICE_REMINDER',
      name: '下次服务提醒',
      level: 'NORMAL',
      titleTemplate: '{{elderName}}下次服务：{{serviceTime}}',
      bodyTemplate: '{{specialistName}} 将上门进行{{serviceType}}。如需改期可在服务页面提交申请。',
      availableVars: ['{{elderName}}', '{{serviceType}}', '{{serviceTime}}', '{{specialistName}}'],
      enabledChannels: ['IN_APP'],
      requiredPermission: 'SERVICE_SCHEDULE',
    },
    {
      event: 'SPECIALIST_CHANGED',
      name: '安心专员变更',
      level: 'IMPORTANT',
      titleTemplate: '{{elderName}}的安心专员有调整',
      bodyTemplate: '由 {{fromSpecialist}} 调整为 {{toSpecialist}}。原因：{{reason}}。',
      availableVars: ['{{elderName}}', '{{fromSpecialist}}', '{{toSpecialist}}', '{{reason}}'],
      enabledChannels: ['IN_APP'],
      requiredPermission: 'SERVICE_SCHEDULE',
    },
    {
      event: 'SCHEDULE_CHANGED',
      name: '服务时间调整',
      level: 'IMPORTANT',
      titleTemplate: '{{elderName}}的服务时间已调整',
      bodyTemplate: '原定 {{oldTime}}，调整为 {{newTime}}。原因：{{reason}}。',
      availableVars: ['{{elderName}}', '{{oldTime}}', '{{newTime}}', '{{reason}}'],
      enabledChannels: ['IN_APP'],
      requiredPermission: 'SERVICE_SCHEDULE',
    },
    {
      event: 'MEMBERSHIP_EXPIRING',
      name: '会员即将到期',
      level: 'IMPORTANT',
      titleTemplate: '{{householdName}}的{{planName}}将于 {{expireDate}} 到期',
      bodyTemplate: '如需继续服务，可以联系我们办理续费。',
      availableVars: ['{{householdName}}', '{{planName}}', '{{expireDate}}'],
      enabledChannels: ['IN_APP'],
      // 会员到期是合约信息，不涉及长辈健康数据，因此不要求数据授权
      requiredPermission: null,
    },
    {
      event: 'INCIDENT_URGENT',
      name: '紧急异常通知',
      level: 'URGENT',
      titleTemplate: '{{elderName}}发生{{incidentType}}，请尽快查看',
      bodyTemplate: '{{occurredAt}}：{{description}}。我们已在处理，会持续与您同步。',
      availableVars: ['{{elderName}}', '{{incidentType}}', '{{description}}', '{{occurredAt}}'],
      enabledChannels: ['IN_APP'],
      requiredPermission: 'INCIDENT_ALERT',
    },
    {
      event: 'CANNOT_REACH_ELDER',
      name: '联系不上长辈',
      level: 'URGENT',
      titleTemplate: '暂时联系不上{{elderName}}',
      bodyTemplate: '{{specialistName}} 于 {{occurredAt}} 未能联系到长辈，正在按流程核实，请留意来电。',
      availableVars: ['{{elderName}}', '{{specialistName}}', '{{occurredAt}}'],
      enabledChannels: ['IN_APP'],
      requiredPermission: 'INCIDENT_ALERT',
    },
  ];
  for (const t of templates) {
    await prisma.notificationTemplate.create({ data: t });
  }
  console.log(`    通知模板 ${templates.length} 条（第一版仅站内通知渠道启用）`);

  /* =========================================================================
   * 5. 内部帐号
   * ======================================================================= */
  console.log('  内部帐号…');

  const mkUser = (
    name: string,
    phone: string,
    role: Prisma.UserCreateInput['role'],
    extra: Partial<Prisma.UserCreateInput> = {},
  ): Prisma.UserCreateInput => ({
    name,
    phone,
    role,
    passwordHash,
    status: 'ACTIVE',
    isDemo: true,
    cityId: changsha.id,
    lastLoginAt: daysAgo(1, 8, 30),
    ...extra,
  });

  const superAdmin = await prisma.user.create({
    data: mkUser('示例·超级管理员', '13800000001', 'SUPER_ADMIN', {
      email: 'admin@example.invalid',
      twoFactorEnabled: false,
    }),
  });
  const opsUser = await prisma.user.create({
    data: mkUser('示例·运营 张敏', '13800000002', 'OPERATIONS'),
  });
  const supervisor = await prisma.user.create({
    data: mkUser('示例·服务督导 陈静', '13800000003', 'SERVICE_SUPERVISOR'),
  });
  const financeUser = await prisma.user.create({
    data: mkUser('示例·财务 赵磊', '13800000004', 'FINANCE'),
  });
  const hrUser = await prisma.user.create({
    data: mkUser('示例·人事 孙悦', '13800000005', 'HR'),
  });
  const csUser = await prisma.user.create({
    data: mkUser('示例·客服 何雨', '13800000006', 'CUSTOMER_SERVICE'),
  });
  const cityLead = await prisma.user.create({
    data: mkUser('示例·长沙城市负责人 罗成', '13800000007', 'CITY_LEAD'),
  });
  const areaManager = await prisma.user.create({
    data: mkUser('示例·岳麓区服务主管 邓琳', '13800000008', 'AREA_MANAGER'),
  });

  console.log(
    `    内部帐号：${[superAdmin, opsUser, supervisor, financeUser, hrUser, csUser, cityLead, areaManager]
      .map((u) => u.name)
      .join('、')}`,
  );

  // 家庭安心顾问（有专员档案，可上门做评估）
  const consultantUser = await prisma.user.create({
    data: mkUser('示例·家庭安心顾问 张宁', '13800000010', 'FAMILY_CONSULTANT'),
  });

  // 一线安心专员
  const liChenUser = await prisma.user.create({
    data: mkUser('示例·李晨', '13800000011', 'CARE_SPECIALIST'),
  });
  const zhouMinUser = await prisma.user.create({
    data: mkUser('示例·周敏', '13800000012', 'CARE_SPECIALIST'),
  });
  const traineeUser = await prisma.user.create({
    data: mkUser('示例·培训中 吴桐', '13800000013', 'CARE_SPECIALIST'),
  });

  /* =========================================================================
   * 6. 专员档案 + 专业背景 + 培训 + 能力
   * ======================================================================= */
  console.log('  专员档案与专业背景…');

  const consultantProfile = await prisma.staffProfile.create({
    data: {
      userId: consultantUser.id,
      employeeCode: 'AX-0001',
      staffLevel: 'SENIOR',
      cityId: changsha.id,
      districtId: yuelu.id,
      employmentStatus: 'ONBOARDED',
      serviceStatus: 'ACTIVE',
      hiredAt: daysAgo(400),
      bio: '（示例数据）负责家庭前期沟通、需求了解与家庭安心评估。',
      isDemo: true,
    },
  });

  const liChen = await prisma.staffProfile.create({
    data: {
      userId: liChenUser.id,
      employeeCode: 'AX-0007',
      staffLevel: 'INTERMEDIATE',
      cityId: changsha.id,
      districtId: yuelu.id,
      employmentStatus: 'ONBOARDED',
      serviceStatus: 'ACTIVE',
      hiredAt: daysAgo(300),
      bio: '（示例数据）擅长与长辈建立稳定的日常关系，习惯把观察到的细节写清楚。',
      isDemo: true,
    },
  });

  const zhouMin = await prisma.staffProfile.create({
    data: {
      userId: zhouMinUser.id,
      employeeCode: 'AX-0009',
      staffLevel: 'JUNIOR',
      cityId: changsha.id,
      districtId: kaifu.id,
      employmentStatus: 'ONBOARDED',
      serviceStatus: 'ACTIVE',
      hiredAt: daysAgo(180),
      bio: '（示例数据）主要负责开福区，兼任部分家庭的备用安心专员。',
      isDemo: true,
    },
  });

  const trainee = await prisma.staffProfile.create({
    data: {
      userId: traineeUser.id,
      employeeCode: 'AX-0014',
      staffLevel: 'TRAINEE',
      cityId: changsha.id,
      districtId: yuelu.id,
      employmentStatus: 'ONBOARDED',
      // 刻意保留一个未上岗的人，用来验证「非可排班状态不可派单」
      serviceStatus: 'IN_TRAINING',
      hiredAt: daysAgo(20),
      isDemo: true,
    },
  });

  // 学历：李晨已核验；周敏未核验（用于验证界面不得标示「已认证」）
  await prisma.educationRecord.create({
    data: {
      staffProfileId: liChen.id,
      school: '示例大学（演示用虚构学校）',
      major: '社会工作',
      level: 'BACHELOR',
      graduationYear: 2019,
      verificationStatus: 'VERIFIED',
      verifiedById: hrUser.id,
      verifiedAt: daysAgo(295),
      isDemo: true,
    },
  });
  await prisma.educationRecord.create({
    data: {
      staffProfileId: zhouMin.id,
      school: '示例职业学院（演示用虚构学校）',
      major: '老年服务与管理',
      level: 'JUNIOR_COLLEGE',
      graduationYear: 2021,
      // 未核验 —— 前端只会显示「学历未核验」，绝不显示「已认证」
      verificationStatus: 'UNVERIFIED',
      isDemo: true,
    },
  });
  await prisma.educationRecord.create({
    data: {
      staffProfileId: consultantProfile.id,
      school: '示例大学（演示用虚构学校）',
      major: '社会工作',
      level: 'MASTER',
      graduationYear: 2017,
      verificationStatus: 'VERIFIED',
      verifiedById: hrUser.id,
      verifiedAt: daysAgo(395),
      isDemo: true,
    },
  });

  // 培训记录：李晨/周敏/顾问全部必修通过；吴桐仍在培训中
  async function grantAllTrainings(
    profileId: string,
    opts: { completedDaysAgo: number; score: number },
  ) {
    for (const course of courses) {
      await prisma.trainingRecord.create({
        data: {
          staffProfileId: profileId,
          courseId: course.id,
          status: 'PASSED',
          startedAt: daysAgo(opts.completedDaysAgo + 10),
          completedAt: daysAgo(opts.completedDaysAgo),
          creditHours: course.creditHours,
          examScore: opts.score,
          instructorName: '示例·服务督导 陈静',
          expiresAt: course.validMonths
            ? new Date(
                daysAgo(opts.completedDaysAgo).getTime() +
                  course.validMonths * 30 * 86400000,
              )
            : null,
          isDemo: true,
        },
      });
    }
  }

  await grantAllTrainings(liChen.id, { completedDaysAgo: 280, score: 93 });
  await grantAllTrainings(zhouMin.id, { completedDaysAgo: 160, score: 88 });
  await grantAllTrainings(consultantProfile.id, { completedDaysAgo: 380, score: 95 });

  // 吴桐：部分课程仍在进行中
  for (const [i, course] of courses.entries()) {
    await prisma.trainingRecord.create({
      data: {
        staffProfileId: trainee.id,
        courseId: course.id,
        status: i < 3 ? 'PASSED' : i === 3 ? 'IN_PROGRESS' : 'NOT_STARTED',
        startedAt: i <= 3 ? daysAgo(15) : null,
        completedAt: i < 3 ? daysAgo(10) : null,
        examScore: i < 3 ? 86 : null,
        instructorName: '示例·服务督导 陈静',
        isDemo: true,
      },
    });
  }

  // 能力标签
  async function grantCompetencies(
    profileId: string,
    codes: string[],
    opts: { escortVerified?: boolean } = {},
  ) {
    for (const code of codes) {
      const comp = byCode.get(code)!;
      await prisma.staffCompetency.create({
        data: {
          staffProfileId: profileId,
          competencyId: comp.id,
          credentialStatus: comp.requiresCredential
            ? opts.escortVerified
              ? 'VERIFIED'
              : 'UNVERIFIED'
            : 'UNVERIFIED',
          credentialNo: comp.requiresCredential && opts.escortVerified ? 'DEMO-CRED-0001' : null,
          credentialExpiry:
            comp.requiresCredential && opts.escortVerified ? daysAhead(600) : null,
          isDemo: true,
        },
      });
    }
  }

  await grantCompetencies(
    liChen.id,
    [
      'elder_communication',
      'home_visit',
      'daily_assistance',
      'phone_assistance',
      'emotional_support',
      'family_communication',
      'medical_escort',
    ],
    // 李晨的陪诊相关外部资格凭证已核验，因此可以被派陪诊任务
    { escortVerified: true },
  );
  await grantCompetencies(zhouMin.id, [
    'elder_communication',
    'home_visit',
    'daily_assistance',
    'phone_assistance',
  ]);
  await grantCompetencies(consultantProfile.id, [
    'elder_communication',
    'home_visit',
    'household_assessment',
    'family_communication',
  ]);
  await grantCompetencies(trainee.id, ['elder_communication']);

  // 绩效快照（以服务质量为主，不做单量排行）
  const { start: weekStart } = thisWeek();
  const perfStart = new Date(weekStart);
  perfStart.setDate(perfStart.getDate() - 28);
  await prisma.staffPerformanceSnapshot.create({
    data: {
      staffProfileId: liChen.id,
      periodStart: perfStart,
      periodEnd: weekStart,
      onTimeRate: 0.97,
      completionRate: 1.0,
      recordTimelyRate: 1.0,
      reportQualityScore: 4.6,
      familyRatingAvg: 4.8,
      complaintCount: 0,
      incidentCooperation: 1.0,
      trainingCompletion: 1.0,
      retainedHouseholds: 3,
      taskCount: 24,
    },
  });
  await prisma.staffPerformanceSnapshot.create({
    data: {
      staffProfileId: zhouMin.id,
      periodStart: perfStart,
      periodEnd: weekStart,
      onTimeRate: 0.91,
      completionRate: 0.96,
      recordTimelyRate: 0.92,
      reportQualityScore: 4.1,
      familyRatingAvg: 4.4,
      complaintCount: 1,
      incidentCooperation: 0.9,
      trainingCompletion: 1.0,
      retainedHouseholds: 2,
      taskCount: 18,
    },
  });

  await prisma.staffAvailability.create({
    data: {
      staffProfileId: zhouMin.id,
      startAt: daysAhead(10, 0),
      endAt: daysAhead(12, 23),
      reason: '（示例）家中有事',
      isBlocked: true,
    },
  });

  /* =========================================================================
   * 7. 家庭一：王家 —— 完整跑通端到端主流程
   * ======================================================================= */
  console.log('  家庭：王家（完整主流程）…');

  const wangDaughterUser = await prisma.user.create({
    data: mkUser('示例·王女士', '13800000021', 'FAMILY_MEMBER', {
      email: 'wang.daughter@example.invalid',
    }),
  });
  const wangSonUser = await prisma.user.create({
    data: mkUser('示例·王先生', '13800000022', 'FAMILY_MEMBER'),
  });

  const wang = await prisma.household.create({
    data: {
      householdCode: 'CS-000018',
      name: '王家',
      cityId: changsha.id,
      districtId: yuelu.id,
      addressLine: '岳麓区示例路 88 号示例小区 3 栋 1 单元 502（演示用虚构地址）',
      status: 'ACTIVE_MEMBER',
      consultantId: consultantUser.id,
      primarySpecialistId: liChen.id,
      backupSpecialistId: zhouMin.id,
      serviceNotes:
        '（示例）王妈妈不喜欢频繁更换陌生服务者，请尽量由固定专员前往。进门先在门口说明身份，不要直接进屋。',
      internalNotes: '（示例·内部）女儿在深圳工作，沟通首选微信；儿子较少参与，联系前先与女儿确认。',
      joinedAt: daysAgo(120),
      isDemo: true,
    },
  });

  const wangMother = await prisma.elder.create({
    data: {
      householdId: wang.id,
      name: '王秀兰',
      gender: 'FEMALE',
      birthday: new Date(1948, 4, 12),
      phone: '13900000021',
      address: wang.addressLine,
      livingStatus: 'ALONE',
      mobilityStatus: 'SLOW_BUT_INDEPENDENT',
      livingArrangement: '独居于三楼，无电梯。日常自己买菜做饭，重物由邻居或专员协助。',
      familyRelations: '一女一子。女儿在深圳工作，每周视频一次；儿子在长沙，约两周回家一次。',
      dailyRoutine: '早上六点左右起床，上午在小区散步，下午看电视或与邻居聊天，晚上九点半左右休息。',
      activityNotes: '每天在小区内步行约二十分钟。走久后膝盖会不舒服，需要中途坐下休息。',
      dietNotes: '口味偏清淡，早餐固定稀饭配咸菜。不太喜欢吃肉。',
      sleepNotes: '一般能睡，偶尔说夜里会醒来一两次。',
      communicationPrefs: '说话请慢一些、音量稍大。不喜欢被追问身体，可以先聊家常再自然问到。',
      dailyNeeds: '协助购买米面油等重物；协助使用手机与女儿视频；陪同散步。',
      attentionNotes:
        '（示例）膝盖走久后不舒服，散步时请注意让老人中途休息。不喜欢频繁更换陌生服务者。',
      emergencyArrangement:
        '优先联系女儿王女士（主要联络人）；如联系不上，联系儿子王先生；隔壁 501 邻居有备用钥匙。',
      generalNotes: '（示例数据）',
      isDemo: true,
    },
  });

  // 健康敏感信息 —— 单独一张表，一线专员看不到
  await prisma.elderSensitiveInfo.create({
    data: {
      elderId: wangMother.id,
      chronicConditions: '（示例·由家庭提供）高血压，多年，社区医院随访中。',
      medications: '（示例·由家庭提供）每日早晨服用降压药一次。具体名称与剂量以医院处方为准。',
      allergies: '无已知过敏',
      medicalDocsNotes: '家庭提供了社区医院随访记录复印件（存于私有存储）。',
      // 家庭自行设定的提醒范围 —— 不是医疗诊断标准
      bpSystolicMax: 150,
      bpDiastolicMax: 95,
      updatedById: opsUser.id,
    },
  });

  const wangDaughterMember = await prisma.familyMember.create({
    data: {
      userId: wangDaughterUser.id,
      householdId: wang.id,
      elderId: wangMother.id,
      relationship: 'DAUGHTER',
      isPayer: true,
      isPrimaryContact: true,
      isEmergencyContact: true,
      isDemo: true,
    },
  });
  const wangSonMember = await prisma.familyMember.create({
    data: {
      userId: wangSonUser.id,
      householdId: wang.id,
      elderId: wangMother.id,
      relationship: 'SON',
      isPayer: false,
      isPrimaryContact: false,
      isEmergencyContact: true,
      isDemo: true,
    },
  });
  await prisma.household.update({
    where: { id: wang.id },
    data: { primaryContactId: wangDaughterMember.id },
  });
  console.log(
    `    王家成员：${wangDaughterMember.relationship}（付款人/主要联络人）、${wangSonMember.relationship}（紧急联络人）`,
  );

  /* --- 授权：这是整个系统最重要的一段种子数据 -------------------------------
   * 王女士（付款人）拿到 5 项授权，但【没有】健康敏感信息授权
   *   —— 这正是「付款权 ≠ 数据查看权」的体现。
   * 王先生只有服务安排与异常通知
   *   —— 用来验证同一家庭内不同成员看到的东西确实不同。
   * ------------------------------------------------------------------------ */
  console.log('  授权（付款权 ≠ 数据查看权）…');
  const daughterConsents: {
    permissionType: Prisma.ConsentCreateInput['permissionType'];
    scope?: string;
  }[] = [
    { permissionType: 'ASSURANCE_REPORT' },
    { permissionType: 'LIFE_RECORD' },
    { permissionType: 'SERVICE_SCHEDULE' },
    { permissionType: 'INCIDENT_ALERT' },
    { permissionType: 'CONTACT_INFO' },
  ];
  for (const c of daughterConsents) {
    await prisma.consent.create({
      data: {
        elderId: wangMother.id,
        // 授权人是长辈本人 —— 通过家庭成员帐号体系记录时，用长辈的主要联络人代为登记，
        // 但依据（basis）明确写为「长辈本人签署」，并保留纸质签署凭证 key。
        grantorId: wangDaughterUser.id,
        granteeId: wangDaughterUser.id,
        permissionType: c.permissionType,
        scope: c.scope,
        basis: 'ELDER_SELF_SIGNED',
        evidenceKey: 'consent-evidence/demo/wang-2026-signed.pdf',
        status: 'ACTIVE',
        grantedAt: daysAgo(120),
        version: 1,
        isDemo: true,
      },
    });
  }
  // 王先生：只有服务安排 + 异常通知
  for (const p of ['SERVICE_SCHEDULE', 'INCIDENT_ALERT'] as const) {
    await prisma.consent.create({
      data: {
        elderId: wangMother.id,
        grantorId: wangDaughterUser.id,
        granteeId: wangSonUser.id,
        permissionType: p,
        basis: 'ELDER_VERBAL_WITNESSED',
        scope: '（示例）长辈口头同意，由家庭安心顾问在场见证并记录。',
        status: 'ACTIVE',
        grantedAt: daysAgo(118),
        version: 1,
        isDemo: true,
      },
    });
  }
  // 一条已撤回的历史授权 —— 证明撤回不会删除历史记录
  await prisma.consent.create({
    data: {
      elderId: wangMother.id,
      grantorId: wangDaughterUser.id,
      granteeId: wangSonUser.id,
      permissionType: 'LIFE_RECORD',
      basis: 'ELDER_VERBAL_WITNESSED',
      status: 'REVOKED',
      grantedAt: daysAgo(100),
      revokedAt: daysAgo(60),
      scope: '（示例）长辈后来表示希望生活记录只给女儿看，已按其意愿撤回。',
      version: 1,
      isDemo: true,
    },
  });

  // 家庭安心评估
  await prisma.householdAssessment.create({
    data: {
      householdId: wang.id,
      elderId: wangMother.id,
      assessorName: '示例·家庭安心顾问 张宁',
      assessedAt: daysAgo(122),
      livingSummary: '独居三楼无电梯，生活基本自理，重物搬运与手机使用需要协助。',
      needsSummary:
        '核心需求是「有人固定来看看、有事能及时知道」。子女最在意的是夜间与突发情况能不能第一时间联系上。',
      riskNotes: '楼道照明偏暗；浴室无扶手，已建议家庭加装。膝盖走久不适，需注意活动强度。',
      recommendedTier: 'ASSURANCE',
      recommendation:
        '建议安心版：每周一次上门、每周两次电话关怀、每周一份安心报告。固定专员安排在岳麓区常驻的李晨。',
      isDemo: true,
    },
  });

  // 家庭执行计划
  await prisma.householdServicePlan.create({
    data: {
      householdId: wang.id,
      planId: assurancePlan.id,
      visitsPerWeek: 1,
      phoneCarePerWeek: 2,
      reportsPerWeek: 1,
      preferredWeekday: 4,
      preferredWindow: '下午 14:00-17:00',
      executionNotes:
        '（示例）偏好周四下午。膝盖不舒服，散步请安排休息。不喜欢频繁更换陌生服务者，尽量由李晨前往。',
      startDate: daysAgo(120),
      isActive: true,
      isDemo: true,
    },
  });

  // 订阅与订单
  const wangSubscription = await prisma.subscription.create({
    data: {
      householdId: wang.id,
      planId: assurancePlan.id,
      status: 'ACTIVE',
      startDate: daysAgo(120),
      currentPeriodStart: daysAgo(20),
      currentPeriodEnd: daysAhead(10),
      monthlyPrice: assurancePlan.monthlyPrice,
      autoRenew: true,
      usedVisits: 3,
      usedPhoneCare: 6,
      usedReports: 3,
      isDemo: true,
    },
  });
  await prisma.order.create({
    data: {
      orderNo: `ORD-${yyyymmdd(daysAgo(120))}-0001`,
      householdId: wang.id,
      subscriptionId: wangSubscription.id,
      type: 'NEW_SUBSCRIPTION',
      status: 'PAID',
      amount: assurancePlan.monthlyPrice * 3,
      description: '安心版 × 3 个月',
      paidAt: daysAgo(120),
      // 已开票：发票号是在税控系统实际开出后人工回填的，系统不生成发票号
      invoiceStatus: 'ISSUED',
      invoiceType: 'PERSONAL_ELECTRONIC',
      invoiceTitle: '王秀兰',
      invoiceNo: 'DEMO-00000001',
      invoicedAt: daysAgo(118),
      isDemo: true,
    },
  });
  await prisma.order.create({
    data: {
      orderNo: `ORD-${yyyymmdd(daysAgo(20))}-0001`,
      householdId: wang.id,
      subscriptionId: wangSubscription.id,
      type: 'RENEWAL',
      status: 'PAID',
      amount: assurancePlan.monthlyPrice,
      description: '安心版 续费 1 个月',
      paidAt: daysAgo(20),
      // 已申请、尚未开出 —— 发票页面的「已申请待开票」待办就是这一条
      invoiceStatus: 'REQUESTED',
      invoiceType: 'COMPANY_ELECTRONIC',
      invoiceTitle: '长沙示例科技有限公司',
      invoiceTaxNo: '91430100DEMO0000XX',
      invoiceNote: '示例数据：税号为占位内容，不对应任何真实企业',
      isDemo: true,
    },
  });

  /* --- 任务与原始服务记录（本周） -------------------------------------- */
  console.log('  任务与原始服务记录…');

  const visitAt = earlierThisWeek(3, 14, 2); // 本周四下午（若未到则退回今天更早）
  const homeVisitTask = await prisma.serviceTask.create({
    data: {
      taskNo: `TSK-${yyyymmdd(visitAt)}-0031`,
      householdId: wang.id,
      elderId: wangMother.id,
      staffProfileId: liChen.id,
      serviceType: 'HOME_VISIT',
      status: 'COMPLETED',
      scheduledStart: visitAt,
      estimatedMinutes: 60,
      addressLine: wang.addressLine,
      taskItems: '陪伴聊天；陪同小区散步（注意膝盖，中途休息）；协助购买米面油；协助与女儿视频。',
      attentionSnapshot: wangMother.attentionNotes,
      acceptedAt: new Date(visitAt.getTime() - 20 * 3600000),
      arrivedAt: new Date(visitAt.getTime() - 2 * 60000),
      startedAt: visitAt,
      endedAt: new Date(visitAt.getTime() + 78 * 60000),
      checkinLat: 28.2282,
      checkinLng: 112.9388,
      checkinAccuracy: 24,
      isDemo: true,
    },
  });

  const visitRecord = await prisma.visitRecord.create({
    data: {
      taskId: homeVisitTask.id,
      householdId: wang.id,
      elderId: wangMother.id,
      staffProfileId: liChen.id,
      spiritLevel: 'NORMAL',
      spiritNote: '',
      dietLevel: 'NORMAL',
      dietNote: '',
      sleepLevel: 'SELF_REPORTED_ISSUE',
      sleepNote: '王阿姨表示周三晚上约凌晨一点才入睡，说是看电视看久了。',
      activityLevel: 'NORMAL',
      activityNote: '',
      completedItems: ['陪伴聊天', '散步', '购买生活用品', '手机使用协助'],
      observationText:
        '今天到达时王阿姨在门口等着。一起在小区走了约二十分钟，走到第二圈时她说膝盖有点酸，我们在长椅坐了五分钟再慢慢走回来。回来后帮她买了米和食用油放到厨房。她提到最近膝盖走久后不太舒服，问我要不要去看看，我说这个我不能判断，建议她跟女儿说一声、由家里安排去医院看。离开前协助她和女儿视频了大约十分钟。',
      photoKeys: ['visit-photo/demo/wang-visit-1.jpg'],
      submittedAt: new Date(visitAt.getTime() + 85 * 60000),
      reviewedById: supervisor.id,
      reviewedAt: new Date(visitAt.getTime() + 4 * 3600000),
      reviewNote: '记录规范，措辞得当（未做任何医疗判断）。已通过。',
      isDemo: true,
    },
  });

  // 健康数值：血压，来源为「专员协助记录」，并标记是否超出家庭设定范围
  await prisma.healthReading.create({
    data: {
      elderId: wangMother.id,
      visitRecordId: visitRecord.id,
      type: 'BLOOD_PRESSURE',
      source: 'SPECIALIST_ASSISTED',
      valuePrimary: 152,
      valueSecondary: 88,
      unit: 'mmHg',
      measuredAt: new Date(visitAt.getTime() + 15 * 60000),
      note: '在家中使用长辈自己的电子血压计测量，静坐五分钟后测。',
      // 家庭设定的收缩压提醒上限为 150，因此标记为超出提醒范围（不是诊断）
      outsideFamilyRange: true,
      isDemo: true,
    },
  });

  // 本周两次电话关怀
  const phone1At = earlierThisWeek(1, 10, 30);
  const phoneTask1 = await prisma.serviceTask.create({
    data: {
      taskNo: `TSK-${yyyymmdd(phone1At)}-0012`,
      householdId: wang.id,
      elderId: wangMother.id,
      staffProfileId: liChen.id,
      serviceType: 'PHONE_CARE',
      status: 'COMPLETED',
      scheduledStart: phone1At,
      estimatedMinutes: 15,
      taskItems: '确认近期饮食与睡眠情况；提醒周四下午上门。',
      acceptedAt: new Date(phone1At.getTime() - 3600000),
      startedAt: phone1At,
      endedAt: new Date(phone1At.getTime() + 12 * 60000),
      isDemo: true,
    },
  });
  await prisma.visitRecord.create({
    data: {
      taskId: phoneTask1.id,
      householdId: wang.id,
      elderId: wangMother.id,
      staffProfileId: liChen.id,
      spiritLevel: 'NORMAL',
      dietLevel: 'NORMAL',
      sleepLevel: 'NORMAL',
      activityLevel: 'NORMAL',
      completedItems: ['陪伴聊天'],
      observationText: '电话中声音有力，说这两天都按平时作息。已告知周四下午会上门。',
      submittedAt: new Date(phone1At.getTime() + 20 * 60000),
      reviewedById: supervisor.id,
      reviewedAt: new Date(phone1At.getTime() + 3 * 3600000),
      isDemo: true,
    },
  });

  const phone2At = earlierThisWeek(5, 16, 0);
  const phoneTask2 = await prisma.serviceTask.create({
    data: {
      taskNo: `TSK-${yyyymmdd(phone2At)}-0021`,
      householdId: wang.id,
      elderId: wangMother.id,
      staffProfileId: liChen.id,
      serviceType: 'PHONE_CARE',
      status: 'COMPLETED',
      scheduledStart: phone2At,
      estimatedMinutes: 15,
      taskItems: '回访膝盖情况；确认是否已与女儿沟通就医安排。',
      acceptedAt: new Date(phone2At.getTime() - 3600000),
      startedAt: phone2At,
      endedAt: new Date(phone2At.getTime() + 14 * 60000),
      isDemo: true,
    },
  });
  await prisma.visitRecord.create({
    data: {
      taskId: phoneTask2.id,
      householdId: wang.id,
      elderId: wangMother.id,
      staffProfileId: liChen.id,
      spiritLevel: 'NORMAL',
      dietLevel: 'NORMAL',
      sleepLevel: 'NORMAL',
      sleepNote: '本人说这两晚十点前就睡了。',
      activityLevel: 'FAIR',
      activityNote: '本人表示膝盖比前几天好一些，但走久还是会酸。',
      completedItems: ['陪伴聊天'],
      observationText: '王阿姨说已经跟女儿讲过膝盖的事，女儿说下周回长沙时带她去看。',
      submittedAt: new Date(phone2At.getTime() + 18 * 60000),
      reviewedById: supervisor.id,
      reviewedAt: new Date(phone2At.getTime() + 2 * 3600000),
      isDemo: true,
    },
  });

  // 下周的安排（家庭端「下一次」）
  await prisma.serviceTask.create({
    data: {
      taskNo: `TSK-${yyyymmdd(daysAhead(3))}-0001`,
      householdId: wang.id,
      elderId: wangMother.id,
      staffProfileId: liChen.id,
      serviceType: 'HOME_VISIT',
      status: 'ASSIGNED',
      scheduledStart: daysAhead(3, 14, 0),
      estimatedMinutes: 60,
      addressLine: wang.addressLine,
      taskItems: '常规探访；关注膝盖情况与是否已就医；协助采购。',
      attentionSnapshot: wangMother.attentionNotes,
      isDemo: true,
    },
  });
  // 一个待派单任务（后台「待派单」队列有内容）
  await prisma.serviceTask.create({
    data: {
      taskNo: `TSK-${yyyymmdd(daysAhead(6))}-0002`,
      householdId: wang.id,
      elderId: wangMother.id,
      serviceType: 'PHONE_CARE',
      status: 'PENDING_ASSIGN',
      scheduledStart: daysAhead(6, 10, 0),
      estimatedMinutes: 15,
      taskItems: '常规电话关怀。',
      isDemo: true,
    },
  });

  /* --- 安心报告（已发布） --------------------------------------------- */
  console.log('  安心报告（原始记录 → 草稿 → 人工确认 → 发布）…');
  const { start: wkStart, end: wkEnd } = thisWeek();
  const { year: isoY, week: isoW } = isoWeek(wkStart);

  const wangReport = await prisma.assuranceReport.create({
    data: {
      reportNo: `RPT-${isoY}W${String(isoW).padStart(2, '0')}-0018`,
      householdId: wang.id,
      elderId: wangMother.id,
      periodStart: wkStart,
      periodEnd: wkEnd,
      status: 'PUBLISHED',
      generation: 'RULE_BASED_DRAFT',
      title: '妈妈这周过得怎么样？',
      visitCount: 1,
      phoneCareCount: 2,
      spiritSummary: '交流正常，整体不错。',
      dietSummary: '正常。',
      sleepSummary: '本人反映周三入睡稍晚（约凌晨一点），后两天已恢复十点前休息。',
      activitySummary: '活动正常，本周陪同散步 1 次。',
      lifeSummary: '本周协助：陪伴聊天、散步、购买生活用品、手机使用协助。',
      attentionSummary:
        '妈妈最近提到膝盖走久后不舒服，散步时我们已安排中途休息。她说已经和您讲过这件事。\n本周协助测量的血压为 152/88 mmHg（专员协助记录），超出您家设定的提醒范围（收缩压 150）。这不是诊断结论，建议由家里安排去医院看一次。',
      familyTip: '周末有时间可以多和妈妈视频聊聊，问问膝盖和睡觉的情况。',
      aiGenerated: false,
      reviewedById: opsUser.id,
      reviewedAt: new Date(visitAt.getTime() + 6 * 3600000),
      reviewNote: '已逐句对照三条原始记录，内容一致。血压表述已确认为「超出家庭设定范围」而非诊断。',
      publishedAt: new Date(visitAt.getTime() + 6.5 * 3600000),
      isDemo: true,
    },
  });
  for (const rid of [visitRecord.id]) {
    await prisma.assuranceVisitRecordLink.create({
      data: { reportId: wangReport.id, visitRecordId: rid },
    });
  }
  // 电话关怀的记录也作为报告依据
  const phoneRecords = await prisma.visitRecord.findMany({
    where: { taskId: { in: [phoneTask1.id, phoneTask2.id] } },
    select: { id: true },
  });
  for (const r of phoneRecords) {
    await prisma.assuranceVisitRecordLink.create({
      data: { reportId: wangReport.id, visitRecordId: r.id },
    });
  }

  /* --- 异常事件（含完整时间线） -------------------------------------- */
  console.log('  异常事件与时间线…');
  const incidentAt = earlierThisWeek(2, 13, 42);
  const incident = await prisma.incident.create({
    data: {
      incidentNo: `INC-${yyyymmdd(incidentAt)}-0018`,
      householdId: wang.id,
      elderId: wangMother.id,
      type: 'CANNOT_REACH_ELDER',
      severity: 'HIGH',
      status: 'CLOSED',
      description:
        '（示例）13:40 到达后按门铃与敲门均无回应，拨打王阿姨手机两次无人接听。已在门口等待，未擅自进入。',
      occurredAt: incidentAt,
      needsImmediateFamilyContact: true,
      reportedById: liChenUser.id,
      ownerId: supervisor.id,
      acknowledgedAt: new Date(incidentAt.getTime() + 60000),
      closedAt: new Date(incidentAt.getTime() + 138 * 60000),
      resolution:
        '（示例）13:45 督导联系主要联络人王女士；14:10 王女士确认妈妈临时去了隔壁邻居家，手机静音未听到；14:20 王阿姨回电确认平安；16:00 完成回访，未发现异常。已提醒家庭考虑把手机铃声调大。',
      isDemo: true,
    },
  });

  const timelineSteps: { offsetMin: number; actor: string; actorId?: string; action: string; note?: string }[] = [
    {
      offsetMin: 0,
      actor: '示例·李晨',
      actorId: liChenUser.id,
      action: '示例·李晨提交事件',
      note: '按门铃与敲门无回应，拨打手机两次无人接听。',
    },
    { offsetMin: 1, actor: '系统', action: '系统通知服务督导' },
    {
      offsetMin: 3,
      actor: '示例·服务督导 陈静',
      actorId: supervisor.id,
      action: '示例·服务督导 陈静接单',
    },
    {
      offsetMin: 5,
      actor: '示例·服务督导 陈静',
      actorId: supervisor.id,
      action: '督导联系家庭主要联络人',
      note: '致电王女士说明现场情况。',
    },
    {
      offsetMin: 28,
      actor: '示例·服务督导 陈静',
      actorId: supervisor.id,
      action: '家庭确认后续处理',
      note: '王女士确认妈妈在隔壁邻居家，手机静音。',
    },
    {
      offsetMin: 38,
      actor: '示例·李晨',
      actorId: liChenUser.id,
      action: '现场确认长辈平安',
      note: '王阿姨回到家门口，状态正常，服务照常进行。',
    },
    {
      offsetMin: 138,
      actor: '示例·服务督导 陈静',
      actorId: supervisor.id,
      action: '示例·服务督导 陈静完成跟进并关闭事件',
      note: '已完成回访，并提醒家庭把手机铃声调大。',
    },
  ];
  for (const step of timelineSteps) {
    await prisma.incidentEvent.create({
      data: {
        incidentId: incident.id,
        actorId: step.actorId,
        actorName: step.actor,
        action: step.action,
        note: step.note,
        occurredAt: new Date(incidentAt.getTime() + step.offsetMin * 60000),
      },
    });
  }

  /* --- 家庭时间线 ----------------------------------------------------- */
  const timelineEvents: Prisma.TimelineEventCreateManyInput[] = [
    {
      householdId: wang.id,
      title: '家庭建档完成',
      detail: '家庭编号 CS-000018',
      occurredAt: daysAgo(122, 10),
      refType: 'household',
      refId: wang.id,
      requiredPermission: 'SERVICE_SCHEDULE',
      isDemo: true,
    },
    {
      householdId: wang.id,
      elderId: wangMother.id,
      title: '长辈安心档案已建立',
      detail: '王秀兰',
      occurredAt: daysAgo(122, 11),
      refType: 'elder',
      refId: wangMother.id,
      requiredPermission: 'SERVICE_SCHEDULE',
      isDemo: true,
    },
    {
      householdId: wang.id,
      title: '已开通安心版',
      occurredAt: daysAgo(120, 15),
      refType: 'subscription',
      refId: wangSubscription.id,
      requiredPermission: 'SERVICE_SCHEDULE',
      isDemo: true,
    },
    {
      householdId: wang.id,
      elderId: wangMother.id,
      title: '完成电话关怀',
      occurredAt: new Date(phone1At.getTime() + 12 * 60000),
      refType: 'task',
      refId: phoneTask1.id,
      requiredPermission: 'SERVICE_SCHEDULE',
      isDemo: true,
    },
    {
      householdId: wang.id,
      elderId: wangMother.id,
      title: '发生异常情况：无法联系长辈',
      detail: '已由服务督导接手处理并完成回访。',
      occurredAt: incidentAt,
      refType: 'incident',
      refId: incident.id,
      requiredPermission: 'INCIDENT_ALERT',
      isDemo: true,
    },
    {
      householdId: wang.id,
      elderId: wangMother.id,
      title: '异常情况已完成跟进',
      occurredAt: new Date(incidentAt.getTime() + 138 * 60000),
      refType: 'incident',
      refId: incident.id,
      requiredPermission: 'INCIDENT_ALERT',
      isDemo: true,
    },
    {
      householdId: wang.id,
      elderId: wangMother.id,
      title: '安心专员开始安心探访',
      occurredAt: visitAt,
      refType: 'task',
      refId: homeVisitTask.id,
      requiredPermission: 'SERVICE_SCHEDULE',
      isDemo: true,
    },
    {
      householdId: wang.id,
      elderId: wangMother.id,
      title: '本次安心探访完成',
      occurredAt: new Date(visitAt.getTime() + 78 * 60000),
      refType: 'visit_record',
      refId: visitRecord.id,
      requiredPermission: 'LIFE_RECORD',
      isDemo: true,
    },
    {
      householdId: wang.id,
      elderId: wangMother.id,
      title: '完成电话关怀',
      occurredAt: new Date(phone2At.getTime() + 14 * 60000),
      refType: 'task',
      refId: phoneTask2.id,
      requiredPermission: 'SERVICE_SCHEDULE',
      isDemo: true,
    },
    {
      householdId: wang.id,
      elderId: wangMother.id,
      title: '本周安心报告已生成',
      detail: '妈妈这周过得怎么样？',
      occurredAt: new Date(visitAt.getTime() + 6.5 * 3600000),
      refType: 'report',
      refId: wangReport.id,
      requiredPermission: 'ASSURANCE_REPORT',
      isDemo: true,
    },
    {
      householdId: wang.id,
      title: '内部：本月续费已完成',
      occurredAt: daysAgo(20, 11),
      internalOnly: true,
      requiredPermission: 'SERVICE_SCHEDULE',
      isDemo: true,
    },
  ];
  await prisma.timelineEvent.createMany({ data: timelineEvents });

  /* =========================================================================
   * 8. 家庭二：刘家 —— 用于验证家庭之间的数据隔离
   * ======================================================================= */
  console.log('  家庭：刘家（数据隔离验证）…');
  const liuSonUser = await prisma.user.create({
    data: mkUser('示例·刘先生', '13800000031', 'FAMILY_MEMBER'),
  });

  const liu = await prisma.household.create({
    data: {
      householdCode: 'CS-000024',
      name: '刘家',
      cityId: changsha.id,
      districtId: kaifu.id,
      addressLine: '开福区示例大道 12 号示例花园 7 栋 2 单元 803（演示用虚构地址）',
      status: 'ACTIVE_MEMBER',
      consultantId: consultantUser.id,
      primarySpecialistId: zhouMin.id,
      serviceNotes: '（示例）刘叔叔听力稍弱，说话请靠近一些、放慢速度。',
      joinedAt: daysAgo(60),
      isDemo: true,
    },
  });

  const liuFather = await prisma.elder.create({
    data: {
      householdId: liu.id,
      name: '刘建国',
      gender: 'MALE',
      birthday: new Date(1945, 8, 3),
      phone: '13900000031',
      address: liu.addressLine,
      livingStatus: 'WITH_SPOUSE',
      mobilityStatus: 'NEEDS_AID',
      livingArrangement: '与配偶同住，八楼有电梯。',
      familyRelations: '一子，在上海工作。',
      dailyRoutine: '作息规律，上午在楼下花园坐着晒太阳。',
      communicationPrefs: '听力稍弱，说话请靠近一些、放慢速度。',
      dailyNeeds: '陪同就医；协助取药。',
      attentionNotes: '（示例）使用助行器，上下楼需陪同。',
      emergencyArrangement: '优先联系儿子刘先生；配偶在家时可直接沟通。',
      isDemo: true,
    },
  });

  const liuMember = await prisma.familyMember.create({
    data: {
      userId: liuSonUser.id,
      householdId: liu.id,
      elderId: liuFather.id,
      relationship: 'SON',
      isPayer: true,
      isPrimaryContact: true,
      isEmergencyContact: true,
      isDemo: true,
    },
  });
  await prisma.household.update({
    where: { id: liu.id },
    data: { primaryContactId: liuMember.id },
  });

  for (const p of ['ASSURANCE_REPORT', 'SERVICE_SCHEDULE', 'LIFE_RECORD', 'INCIDENT_ALERT'] as const) {
    await prisma.consent.create({
      data: {
        elderId: liuFather.id,
        grantorId: liuSonUser.id,
        granteeId: liuSonUser.id,
        permissionType: p,
        basis: 'ELDER_SELF_SIGNED',
        status: 'ACTIVE',
        grantedAt: daysAgo(60),
        version: 1,
        isDemo: true,
      },
    });
  }

  await prisma.householdServicePlan.create({
    data: {
      householdId: liu.id,
      planId: stewardPlan.id,
      visitsPerWeek: 2,
      phoneCarePerWeek: 3,
      reportsPerWeek: 1,
      preferredWeekday: 2,
      preferredWindow: '上午 9:00-11:00',
      executionNotes: '（示例）陪诊需提前一周告知，以便安排具备相应能力的专员。',
      startDate: daysAgo(60),
      isDemo: true,
    },
  });
  const liuSubscription = await prisma.subscription.create({
    data: {
      householdId: liu.id,
      planId: stewardPlan.id,
      status: 'ACTIVE',
      startDate: daysAgo(60),
      currentPeriodStart: daysAgo(5),
      currentPeriodEnd: daysAhead(25),
      monthlyPrice: stewardPlan.monthlyPrice,
      usedVisits: 2,
      usedPhoneCare: 3,
      usedReports: 1,
      isDemo: true,
    },
  });
  await prisma.order.create({
    data: {
      orderNo: `ORD-${yyyymmdd(daysAgo(5))}-0002`,
      householdId: liu.id,
      subscriptionId: liuSubscription.id,
      type: 'RENEWAL',
      status: 'PAID',
      amount: stewardPlan.monthlyPrice,
      description: '管家版 续费 1 个月',
      paidAt: daysAgo(5),
      isDemo: true,
    },
  });

  // 刘家：一次已完成服务 + 一份已发布报告（用于验证「王女士看不到刘家报告」）
  const liuVisitAt = earlierThisWeek(1, 9, 30);
  const liuTask = await prisma.serviceTask.create({
    data: {
      taskNo: `TSK-${yyyymmdd(liuVisitAt)}-0044`,
      householdId: liu.id,
      elderId: liuFather.id,
      staffProfileId: zhouMin.id,
      serviceType: 'HOME_VISIT',
      status: 'COMPLETED',
      scheduledStart: liuVisitAt,
      estimatedMinutes: 60,
      addressLine: liu.addressLine,
      taskItems: '陪伴聊天；协助整理居家环境；确认助行器状况。',
      attentionSnapshot: liuFather.attentionNotes,
      acceptedAt: new Date(liuVisitAt.getTime() - 20 * 3600000),
      arrivedAt: new Date(liuVisitAt.getTime() - 60000),
      startedAt: liuVisitAt,
      endedAt: new Date(liuVisitAt.getTime() + 62 * 60000),
      isDemo: true,
    },
  });
  const liuRecord = await prisma.visitRecord.create({
    data: {
      taskId: liuTask.id,
      householdId: liu.id,
      elderId: liuFather.id,
      staffProfileId: zhouMin.id,
      spiritLevel: 'NORMAL',
      dietLevel: 'FAIR',
      dietNote: '本人说这两天胃口一般。',
      sleepLevel: 'NORMAL',
      activityLevel: 'FAIR',
      activityNote: '使用助行器在客厅走动，室内活动为主。',
      completedItems: ['陪伴聊天', '协助整理居家环境'],
      observationText:
        '刘叔叔今天精神不错，主动讲了很多以前的事。助行器胶垫有磨损，已告知家属需要更换，并记录在待跟进事项。',
      submittedAt: new Date(liuVisitAt.getTime() + 70 * 60000),
      reviewedById: supervisor.id,
      reviewedAt: new Date(liuVisitAt.getTime() + 3 * 3600000),
      isDemo: true,
    },
  });
  const liuReport = await prisma.assuranceReport.create({
    data: {
      reportNo: `RPT-${isoY}W${String(isoW).padStart(2, '0')}-0024`,
      householdId: liu.id,
      elderId: liuFather.id,
      periodStart: wkStart,
      periodEnd: wkEnd,
      status: 'PUBLISHED',
      generation: 'RULE_BASED_DRAFT',
      title: '爸爸这周过得怎么样？',
      visitCount: 1,
      phoneCareCount: 0,
      spiritSummary: '交流正常。',
      dietSummary: '一般（本人说这两天胃口一般）。',
      sleepSummary: '正常。',
      activitySummary: '活动时略感不便，以室内活动为主。',
      lifeSummary: '本周协助：陪伴聊天、协助整理居家环境。',
      attentionSummary: '助行器胶垫有磨损，已提醒家里更换。',
      familyTip: '有空可以给爸爸打个电话，他今天讲了很多以前的事，很愿意聊。',
      reviewedById: opsUser.id,
      reviewedAt: new Date(liuVisitAt.getTime() + 5 * 3600000),
      publishedAt: new Date(liuVisitAt.getTime() + 5.2 * 3600000),
      isDemo: true,
    },
  });
  await prisma.assuranceVisitRecordLink.create({
    data: { reportId: liuReport.id, visitRecordId: liuRecord.id },
  });
  await prisma.timelineEvent.createMany({
    data: [
      {
        householdId: liu.id,
        elderId: liuFather.id,
        title: '本次安心探访完成',
        occurredAt: new Date(liuVisitAt.getTime() + 62 * 60000),
        refType: 'visit_record',
        refId: liuRecord.id,
        requiredPermission: 'LIFE_RECORD',
        isDemo: true,
      },
      {
        householdId: liu.id,
        elderId: liuFather.id,
        title: '本周安心报告已生成',
        occurredAt: new Date(liuVisitAt.getTime() + 5.2 * 3600000),
        refType: 'report',
        refId: liuReport.id,
        requiredPermission: 'ASSURANCE_REPORT',
        isDemo: true,
      },
    ],
  });

  // 刘家：未来的陪诊任务（李晨具备已核验的陪诊资格）
  await prisma.serviceTask.create({
    data: {
      taskNo: `TSK-${yyyymmdd(daysAhead(5))}-0003`,
      householdId: liu.id,
      elderId: liuFather.id,
      staffProfileId: liChen.id,
      serviceType: 'MEDICAL_ESCORT',
      status: 'ASSIGNED',
      scheduledStart: daysAhead(5, 8, 30),
      estimatedMinutes: 180,
      addressLine: liu.addressLine,
      taskItems: '陪同前往医院复查：协助挂号、陪同候诊、协助取药。不提供任何医疗判断。',
      attentionSnapshot: liuFather.attentionNotes,
      isBackupAssignment: true,
      reassignReason: '（示例）固定专员周敏尚未取得陪诊相关资格凭证，本次由具备资格的李晨前往。',
      isDemo: true,
    },
  });

  /* =========================================================================
   * 9. 家庭三：陈家 —— 潜在家庭（CRM 漏斗前段）
   * ======================================================================= */
  console.log('  家庭：陈家（潜在）…');
  await prisma.household.create({
    data: {
      householdCode: 'CS-000031',
      name: '陈家',
      cityId: changsha.id,
      districtId: changsha.districts.find((d) => d.name === '天心区')!.id,
      status: 'PENDING_ASSESSMENT',
      consultantId: consultantUser.id,
      serviceNotes: '（示例）子女来电咨询，已约本周上门做家庭安心评估。',
      internalNotes: '（示例·内部）预算敏感，先介绍关怀版。',
      isDemo: true,
    },
  });

  /* =========================================================================
   * 10. 客服工单、家庭申请、通知、审计日志
   * ======================================================================= */
  console.log('  工单、申请、通知、审计日志…');

  await prisma.feedbackCase.create({
    data: {
      caseNo: `CASE-${yyyymmdd(daysAgo(9))}-0003`,
      householdId: wang.id,
      submittedById: wangDaughterUser.id,
      assigneeId: csUser.id,
      category: 'TIMING',
      status: 'RESOLVED',
      isComplaint: false,
      subject: '（示例）希望把上门时间固定在周四下午',
      content: '妈妈习惯周四下午在家，其他时间常出门找邻居聊天，希望尽量固定这个时段。',
      resolution: '已在家庭执行计划中把偏好时间设为周四下午 14:00-17:00，后续排班会优先按此安排。',
      resolvedAt: daysAgo(8),
      isDemo: true,
    },
  });
  await prisma.feedbackCase.create({
    data: {
      caseNo: `CASE-${yyyymmdd(daysAgo(3))}-0001`,
      householdId: liu.id,
      submittedById: liuSonUser.id,
      category: 'SERVICE_CONTENT',
      status: 'IN_PROGRESS',
      isComplaint: false,
      subject: '（示例）下次复查希望有人陪同',
      content: '爸爸下周要去医院复查，我在上海赶不回来，希望安排陪诊。',
      isDemo: true,
    },
  });

  await prisma.serviceChangeRequest.create({
    data: {
      requestNo: `REQ-${yyyymmdd(daysAgo(2))}-0001`,
      requestedById: liuSonUser.id,
      type: 'EXTRA_SERVICE',
      status: 'SUBMITTED',
      serviceType: 'MEDICAL_ESCORT',
      preferredAt: daysAhead(5, 8, 30),
      reason: '（示例）爸爸下周三上午要去医院复查，希望有人陪同挂号与取药。',
      isDemo: true,
    },
  });

  const notifications: Prisma.NotificationCreateManyInput[] = [
    {
      userId: wangDaughterUser.id,
      level: 'NORMAL',
      channel: 'IN_APP',
      title: '本周安心报告已生成',
      body: '妈妈这周过得怎么样？',
      linkUrl: `/family/reports/${wangReport.id}`,
      refType: 'report',
      refId: wangReport.id,
      createdAt: new Date(visitAt.getTime() + 6.5 * 3600000),
      dispatchedAt: new Date(visitAt.getTime() + 6.5 * 3600000),
      isDemo: true,
    },
    {
      userId: wangDaughterUser.id,
      level: 'URGENT',
      channel: 'IN_APP',
      title: '需要您立即确认的现场情况',
      body: '安心专员到达后无法联系王阿姨，已由服务督导接手处理。',
      linkUrl: '/family',
      refType: 'incident',
      refId: incident.id,
      readAt: new Date(incidentAt.getTime() + 20 * 60000),
      createdAt: incidentAt,
      dispatchedAt: incidentAt,
      isDemo: true,
    },
    {
      userId: liChenUser.id,
      level: 'NORMAL',
      channel: 'IN_APP',
      title: '新任务：安心探访',
      body: '王家 · 下周四 14:00',
      linkUrl: '/staff/tasks',
      refType: 'task',
      createdAt: daysAgo(1, 18),
      dispatchedAt: daysAgo(1, 18),
      isDemo: true,
    },
    {
      userId: supervisor.id,
      level: 'URGENT',
      channel: 'IN_APP',
      title: '🚨 王家：无法联系长辈',
      body: '13:40 到达后按门铃与敲门均无回应。',
      linkUrl: `/admin/incidents/${incident.id}`,
      refType: 'incident',
      refId: incident.id,
      readAt: new Date(incidentAt.getTime() + 90000),
      createdAt: incidentAt,
      dispatchedAt: incidentAt,
      isDemo: true,
    },
    {
      userId: opsUser.id,
      level: 'NORMAL',
      channel: 'IN_APP',
      title: '有安心报告草稿待人工确认',
      body: '王家 · 本周安心报告',
      linkUrl: `/admin/service/reports/${wangReport.id}`,
      refType: 'report',
      refId: wangReport.id,
      createdAt: new Date(visitAt.getTime() + 5 * 3600000),
      dispatchedAt: new Date(visitAt.getTime() + 5 * 3600000),
      isDemo: true,
    },
    {
      userId: liuSonUser.id,
      level: 'NORMAL',
      channel: 'IN_APP',
      title: '本周安心报告已生成',
      body: '爸爸这周过得怎么样？',
      linkUrl: `/family/reports/${liuReport.id}`,
      refType: 'report',
      refId: liuReport.id,
      createdAt: new Date(liuVisitAt.getTime() + 5.2 * 3600000),
      dispatchedAt: new Date(liuVisitAt.getTime() + 5.2 * 3600000),
      isDemo: true,
    },
  ];
  await prisma.notification.createMany({ data: notifications });

  // 审计日志 —— 关键操作留痕
  const auditRows: Prisma.AuditLogCreateManyInput[] = [
    {
      userId: opsUser.id,
      actorName: opsUser.name,
      actorRole: 'OPERATIONS',
      action: 'CREATE_HOUSEHOLD',
      resource: 'Household',
      resourceId: wang.id,
      after: { householdCode: 'CS-000018', name: '王家' },
      ipAddress: '10.0.0.11',
      createdAt: daysAgo(122, 10),
    },
    {
      userId: consultantUser.id,
      actorName: consultantUser.name,
      actorRole: 'FAMILY_CONSULTANT',
      action: 'UPDATE_ELDER',
      resource: 'Elder',
      resourceId: wangMother.id,
      after: { created: true, name: '王秀兰' },
      ipAddress: '10.0.0.12',
      createdAt: daysAgo(122, 11),
    },
    {
      userId: consultantUser.id,
      actorName: consultantUser.name,
      actorRole: 'FAMILY_CONSULTANT',
      action: 'GRANT_CONSENT',
      resource: 'Consent',
      resourceId: wangMother.id,
      after: { granteeName: '示例·王女士', permissions: 5, basis: 'ELDER_SELF_SIGNED' },
      permissionNote: '长辈本人签署，纸质凭证已存档',
      ipAddress: '10.0.0.12',
      createdAt: daysAgo(120, 9),
    },
    {
      userId: consultantUser.id,
      actorName: consultantUser.name,
      actorRole: 'FAMILY_CONSULTANT',
      action: 'REVOKE_CONSENT',
      resource: 'Consent',
      resourceId: wangMother.id,
      before: { status: 'ACTIVE', permissionType: 'LIFE_RECORD', grantee: '示例·王先生' },
      after: { status: 'REVOKED', reason: '长辈表示希望生活记录只给女儿看' },
      permissionNote: '依长辈本人意愿撤回',
      ipAddress: '10.0.0.12',
      createdAt: daysAgo(60, 15),
    },
    {
      userId: opsUser.id,
      actorName: opsUser.name,
      actorRole: 'OPERATIONS',
      action: 'ASSIGN_TASK',
      resource: 'ServiceTask',
      resourceId: homeVisitTask.id,
      after: { taskNo: homeVisitTask.taskNo, staffName: '示例·李晨' },
      ipAddress: '10.0.0.11',
      createdAt: new Date(visitAt.getTime() - 24 * 3600000),
    },
    {
      userId: liChenUser.id,
      actorName: liChenUser.name,
      actorRole: 'CARE_SPECIALIST',
      action: 'SUBMIT_VISIT_RECORD',
      resource: 'VisitRecord',
      resourceId: visitRecord.id,
      after: { taskId: homeVisitTask.id, completedItems: visitRecord.completedItems },
      ipAddress: '10.0.0.31',
      createdAt: visitRecord.submittedAt,
    },
    {
      userId: liChenUser.id,
      actorName: liChenUser.name,
      actorRole: 'CARE_SPECIALIST',
      action: 'CREATE_INCIDENT',
      resource: 'Incident',
      resourceId: incident.id,
      after: { incidentNo: incident.incidentNo, type: 'CANNOT_REACH_ELDER', severity: 'HIGH' },
      ipAddress: '10.0.0.31',
      createdAt: incidentAt,
    },
    {
      userId: supervisor.id,
      actorName: supervisor.name,
      actorRole: 'SERVICE_SUPERVISOR',
      action: 'UPDATE_INCIDENT',
      resource: 'Incident',
      resourceId: incident.id,
      before: { status: 'IN_PROGRESS' },
      after: { status: 'CLOSED' },
      ipAddress: '10.0.0.21',
      createdAt: new Date(incidentAt.getTime() + 138 * 60000),
    },
    {
      userId: opsUser.id,
      actorName: opsUser.name,
      actorRole: 'OPERATIONS',
      action: 'GENERATE_REPORT',
      resource: 'AssuranceReport',
      resourceId: wangReport.id,
      after: { reportNo: wangReport.reportNo, generation: 'RULE_BASED_DRAFT', sourceRecordCount: 3 },
      ipAddress: '10.0.0.11',
      createdAt: new Date(visitAt.getTime() + 5 * 3600000),
    },
    {
      userId: opsUser.id,
      actorName: opsUser.name,
      actorRole: 'OPERATIONS',
      action: 'REVIEW_REPORT',
      resource: 'AssuranceReport',
      resourceId: wangReport.id,
      after: { status: 'APPROVED' },
      ipAddress: '10.0.0.11',
      createdAt: new Date(visitAt.getTime() + 6 * 3600000),
    },
    {
      userId: opsUser.id,
      actorName: opsUser.name,
      actorRole: 'OPERATIONS',
      action: 'PUBLISH_REPORT',
      resource: 'AssuranceReport',
      resourceId: wangReport.id,
      after: { status: 'PUBLISHED', notifiedGrantees: 1 },
      permissionNote: '只通知拥有 ASSURANCE_REPORT 授权的家庭成员',
      ipAddress: '10.0.0.11',
      createdAt: new Date(visitAt.getTime() + 6.5 * 3600000),
    },
    {
      userId: opsUser.id,
      actorName: opsUser.name,
      actorRole: 'OPERATIONS',
      action: 'VIEW_SENSITIVE_HEALTH',
      resource: 'Elder',
      resourceId: wangMother.id,
      permissionNote: 'role=OPERATIONS 不具备 elder.sensitive.read，本次访问被拒绝',
      ipAddress: '10.0.0.11',
      createdAt: daysAgo(10, 14),
    },
    {
      userId: hrUser.id,
      actorName: hrUser.name,
      actorRole: 'HR',
      action: 'VERIFY_EDUCATION',
      resource: 'EducationRecord',
      resourceId: liChen.id,
      after: { verificationStatus: 'VERIFIED' },
      ipAddress: '10.0.0.41',
      createdAt: daysAgo(295, 10),
    },
    {
      userId: financeUser.id,
      actorName: financeUser.name,
      actorRole: 'FINANCE',
      action: 'PERMISSION_DENIED',
      resource: 'Page',
      resourceId: null,
      permissionNote: '缺少 visitRecord.read —— 财务尝试访问服务记录页面被拦截',
      ipAddress: '10.0.0.51',
      createdAt: daysAgo(7, 11),
    },
  ];
  await prisma.auditLog.createMany({ data: auditRows });

  /* =========================================================================
   * 汇总
   * ======================================================================= */
  const counts = {
    城市: await prisma.city.count(),
    区域: await prisma.district.count(),
    用户: await prisma.user.count(),
    安心专员档案: await prisma.staffProfile.count(),
    培训课程: await prisma.trainingCourse.count(),
    培训记录: await prisma.trainingRecord.count(),
    能力标签: await prisma.competency.count(),
    家庭: await prisma.household.count(),
    长辈: await prisma.elder.count(),
    家庭成员: await prisma.familyMember.count(),
    授权记录: await prisma.consent.count(),
    服务方案: await prisma.servicePlan.count(),
    订阅: await prisma.subscription.count(),
    订单: await prisma.order.count(),
    服务任务: await prisma.serviceTask.count(),
    原始服务记录: await prisma.visitRecord.count(),
    健康数值: await prisma.healthReading.count(),
    安心报告: await prisma.assuranceReport.count(),
    异常事件: await prisma.incident.count(),
    事件时间线: await prisma.incidentEvent.count(),
    家庭时间线: await prisma.timelineEvent.count(),
    通知: await prisma.notification.count(),
    审计日志: await prisma.auditLog.count(),
  };

  console.log('\n✅ 示例数据生成完成\n');
  for (const [k, v] of Object.entries(counts)) {
    console.log(`   ${k.padEnd(14, '　')} ${v}`);
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  演示帐号（统一密码：${DEMO_PASSWORD}）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  总后台 /admin
    13800000001  超级管理员      全部权限，含系统配置与操作日志
    13800000002  运营            日常业务全流程，看不到系统配置
    13800000003  服务督导        培训、质控、服务审核、事件处理
    13800000004  财务            只看订单与订阅，看不到长辈生活记录
    13800000005  人事            只看人员档案，完全不接触家庭数据
    13800000006  客服            反馈与投诉处理
    13800000007  城市负责人      只看长沙的数据
    13800000008  区域服务主管    只看本区域

  安心专员工作台 /staff
    13800000010  家庭安心顾问 张宁
    13800000011  家庭安心专员 李晨   固定服务王家（主线演示帐号）
    13800000012  家庭安心专员 周敏   用于验证专员之间的数据隔离
    13800000013  培训中 吴桐         用于验证「非可排班不可派单」

  家庭端 /family
    13800000021  王女士   王家付费子女，拥有 5 项授权（不含健康敏感信息）
    13800000022  王先生   王家儿子，仅 2 项授权，用于对比授权差异
    13800000031  刘先生   刘家，用于验证家庭之间的数据隔离
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  以上全部为虚构的示例数据，不代表公司真实客户或真实案例。
⚠️  正式部署前请重置所有密码，并将 NEXT_PUBLIC_DEMO_MODE 设为 false。
`);
}

main()
  .catch((e) => {
    console.error('❌ 种子数据生成失败：', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
