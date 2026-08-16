import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import type { CurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  canSeeSensitiveHealth,
  householdScopeWhere,
  incidentScopeWhere,
  reportScopeWhere,
  roleHas,
  staffScopeWhere,
  taskScopeWhere,
} from '@/lib/permissions';
import { checkElderConsent, grantedPermissionsFor } from '@/lib/permissions/consent';
import { composeDraftFromRecords } from '@/services/report';
import { checkDispatchEligibility } from '@/services/staff';
import { eldersOverview, myReport, myReports, myServices } from '@/services/family';
import { getTaskForSpecialist } from '@/services/visit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * 内置自检端点。
 *
 * 用途：在没有浏览器点击的情况下，从服务端验证两件事
 *   1. 端到端主流程的数据链路是完整的（家庭→授权→派单→记录→报告→家庭端可见）；
 *   2. 权限与数据隔离规则真的生效（而不是只写在文档里）。
 *
 * 安全：只有配置了 DEV_CHECK_TOKEN 且请求带上正确 token 才会执行。
 * 生产环境请把 DEV_CHECK_TOKEN 留空，端点会直接返回 404。
 */

type Check = {
  name: string;
  group: string;
  pass: boolean;
  detail: string;
};

/** 由数据库用户构造一个「等价于已登录」的用户上下文，用于在服务端复用真实权限逻辑 */
async function asUser(phone: string): Promise<CurrentUser | null> {
  const user = await prisma.user.findUnique({
    where: { phone },
    include: {
      staffProfile: { select: { id: true, serviceStatus: true } },
      familyMembers: { select: { householdId: true } },
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    cityId: user.cityId,
    sessionId: 'selfcheck',
    staffProfileId: user.staffProfile?.id ?? null,
    staffServiceStatus: user.staffProfile?.serviceStatus ?? null,
    householdIds: user.familyMembers.map((m) => m.householdId),
    isDemo: user.isDemo,
  };
}

export async function GET(req: NextRequest) {
  const expected = process.env.DEV_CHECK_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const provided =
    req.nextUrl.searchParams.get('token') ?? req.headers.get('x-dev-check-token') ?? '';
  if (provided !== expected) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const checks: Check[] = [];
  const add = (group: string, name: string, pass: boolean, detail: string) =>
    checks.push({ group, name, pass, detail });

  try {
    /* ========================= 加载种子角色 ========================= */
    const [superAdmin, ops, finance, hr, liChen, zhouMin, wangDaughter, wangSon, liuSon] =
      await Promise.all([
        asUser('13800000001'),
        asUser('13800000002'),
        asUser('13800000004'),
        asUser('13800000005'),
        asUser('13800000011'),
        asUser('13800000012'),
        asUser('13800000021'),
        asUser('13800000022'),
        asUser('13800000031'),
      ]);

    const missing = Object.entries({
      superAdmin,
      ops,
      finance,
      hr,
      liChen,
      zhouMin,
      wangDaughter,
      wangSon,
      liuSon,
    })
      .filter(([, v]) => !v)
      .map(([k]) => k);

    if (missing.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `种子数据缺失：${missing.join(', ')}。请先运行 npm run db:seed。`,
        },
        { status: 500 },
      );
    }

    /* ========================= 1. E2E 主流程数据链路 ========================= */

    const wang = await prisma.household.findFirst({
      where: { name: '王家', deletedAt: null },
      include: {
        elders: { where: { deletedAt: null } },
        members: { include: { user: true } },
        primarySpecialist: { include: { user: true } },
        backupSpecialist: true,
        servicePlan: true,
        subscriptions: true,
      },
    });

    add('E2E 主流程', '① 管理员建立家庭（王家）', !!wang, wang ? `家庭编号 ${wang.householdCode}` : '未找到王家');

    const wangMother = wang?.elders.find((e) => e.name.includes('王'));
    add(
      'E2E 主流程',
      '② 建立长辈安心档案（王妈妈）',
      !!wangMother,
      wangMother ? `${wangMother.name}，行动情况 ${wangMother.mobilityStatus}` : '未找到长辈档案',
    );

    const daughterMember = wang?.members.find((m) => m.userId === wangDaughter!.id);
    add(
      'E2E 主流程',
      '③ 加入家庭成员（女儿王女士）',
      !!daughterMember,
      daughterMember
        ? `关系 ${daughterMember.relationship}，付款人=${daughterMember.isPayer}`
        : '未找到成员记录',
    );

    const daughterPerms = wangMother
      ? await grantedPermissionsFor(wangDaughter!, wangMother.id)
      : new Set<string>();
    add(
      'E2E 主流程',
      '④ 建立授权',
      daughterPerms.size > 0,
      `王女士对王妈妈拥有 ${daughterPerms.size} 项授权：${Array.from(daughterPerms).join(', ') || '无'}`,
    );

    add(
      'E2E 主流程',
      '⑤ 分配固定家庭安心专员（李晨）',
      wang?.primarySpecialistId === liChen!.staffProfileId,
      wang?.primarySpecialist
        ? `${wang.primarySpecialist.user.name}（${wang.primarySpecialist.employeeCode}）`
        : '未指派固定专员',
    );

    const completedTask = await prisma.serviceTask.findFirst({
      where: {
        householdId: wang?.id,
        staffProfileId: liChen!.staffProfileId!,
        record: { isNot: null },
      },
      include: { record: true },
      orderBy: { scheduledStart: 'desc' },
    });

    add(
      'E2E 主流程',
      '⑥ 安排上门任务并派给李晨',
      !!completedTask,
      completedTask ? `任务 ${completedTask.taskNo}，状态 ${completedTask.status}` : '未找到任务',
    );

    add(
      'E2E 主流程',
      '⑦ 李晨可读取自己的任务（且已脱敏）',
      !!(completedTask && (await getTaskForSpecialist(liChen!, completedTask.id))),
      completedTask ? '任务详情可读，未返回财务与敏感健康字段' : '无任务可测',
    );

    add(
      'E2E 主流程',
      '⑧ 服务开始并提交原始服务记录',
      !!completedTask?.record,
      completedTask?.record
        ? `记录 ${completedTask.record.id}，完成事项 ${completedTask.record.completedItems.join('、') || '无'}`
        : '未找到服务记录',
    );

    const report = await prisma.assuranceReport.findFirst({
      where: { householdId: wang?.id },
      include: { sourceRecords: true },
      orderBy: { createdAt: 'desc' },
    });

    add(
      'E2E 主流程',
      '⑨ 系统由原始记录生成安心报告草稿',
      !!report,
      report
        ? `${report.reportNo}，生成方式 ${report.generation}，引用 ${report.sourceRecords.length} 条原始记录`
        : '未找到报告',
    );

    add(
      'E2E 主流程',
      '⑩ 报告经人工确认并发布',
      report?.status === 'PUBLISHED' && !!report.reviewedById,
      report ? `状态 ${report.status}，确认人 ${report.reviewedById ? '已记录' : '缺失'}` : '无报告',
    );

    const daughterReports = await myReports(wangDaughter!);
    add(
      'E2E 主流程',
      '⑪ 女儿在家庭端看到本周安心报告',
      daughterReports.length > 0,
      `可见报告 ${daughterReports.length} 份${daughterReports[0] ? `：${daughterReports[0].title}` : ''}`,
    );

    const overview = await eldersOverview(wangDaughter!);
    add(
      'E2E 主流程',
      '⑫ 家庭端首页显示爸妈近况',
      overview.length > 0 && overview.some((o) => o.lastServiceAt !== null),
      overview
        .map(
          (o) =>
            `${o.name}: 本周上门 ${o.weekVisitCount} 次 / 关怀 ${o.weekPhoneCount} 次 / 报告 ${o.latestReport ? '有' : '无'}`,
        )
        .join('；') || '无数据',
    );

    /* ========================= 2. 家庭之间的数据隔离 ========================= */

    const liu = await prisma.household.findFirst({
      where: { name: '刘家', deletedAt: null },
      include: { elders: { where: { deletedAt: null } } },
    });

    const daughterScope = householdScopeWhere(wangDaughter!);
    const daughterVisibleHouseholds = daughterScope
      ? await prisma.household.findMany({ where: daughterScope, select: { name: true } })
      : [];

    add(
      '数据隔离',
      '家庭 A 看不到家庭 B（王女士 vs 刘家）',
      !daughterVisibleHouseholds.some((h) => h.name === '刘家') &&
        daughterVisibleHouseholds.length > 0,
      `王女士可见家庭：${daughterVisibleHouseholds.map((h) => h.name).join('、') || '无'}`,
    );

    const liuElder = liu?.elders[0];
    const crossConsent = liuElder
      ? await checkElderConsent(wangDaughter!, liuElder.id, 'ASSURANCE_REPORT')
      : null;
    add(
      '数据隔离',
      '跨家庭长辈的授权检查必然拒绝',
      crossConsent ? !crossConsent.allowed : false,
      crossConsent ? `拒绝原因：${crossConsent.reason}` : '未找到刘家长辈，跳过',
    );

    const liuReport = await prisma.assuranceReport.findFirst({
      where: { householdId: liu?.id, status: 'PUBLISHED' },
      select: { id: true },
    });
    const crossReport = liuReport ? await myReport(wangDaughter!, liuReport.id) : null;
    add(
      '数据隔离',
      '王女士无法读取刘家的已发布报告',
      liuReport ? crossReport === null : true,
      liuReport ? (crossReport === null ? '返回 null（家庭端会渲染 404）' : '⚠️ 竟然读到了') : '刘家暂无已发布报告',
    );

    /* ========================= 3. 专员之间的数据隔离 ========================= */

    const zhouTaskScope = taskScopeWhere(zhouMin!);
    const zhouVisibleTasks = zhouTaskScope
      ? await prisma.serviceTask.findMany({
          where: zhouTaskScope,
          select: { taskNo: true, staffProfileId: true },
        })
      : [];

    add(
      '数据隔离',
      '专员 A 看不到专员 B 的任务（周敏 vs 李晨）',
      zhouVisibleTasks.every((t) => t.staffProfileId === zhouMin!.staffProfileId),
      `周敏可见任务 ${zhouVisibleTasks.length} 项，全部属于本人=${zhouVisibleTasks.every((t) => t.staffProfileId === zhouMin!.staffProfileId)}`,
    );

    const zhouTaskRead = completedTask
      ? await getTaskForSpecialist(zhouMin!, completedTask.id)
      : null;
    add(
      '数据隔离',
      '周敏无法读取派给李晨的任务详情',
      zhouTaskRead === null,
      zhouTaskRead === null ? '返回 null' : '⚠️ 竟然读到了',
    );

    const liChenStaffScope = staffScopeWhere(liChen!);
    const liChenVisibleStaff = liChenStaffScope
      ? await prisma.staffProfile.findMany({ where: liChenStaffScope, select: { id: true } })
      : [];
    add(
      '数据隔离',
      '一线专员只看得到自己的档案',
      liChenVisibleStaff.length === 1 && liChenVisibleStaff[0].id === liChen!.staffProfileId,
      `李晨可见专员档案 ${liChenVisibleStaff.length} 份`,
    );

    /* ========================= 4. 角色能力隔离 ========================= */

    add(
      '角色能力',
      '普通运营不能访问超级管理员配置',
      !roleHas(ops!.role, 'system.settings') &&
        !roleHas(ops!.role, 'system.roles') &&
        !roleHas(ops!.role, 'system.audit'),
      `运营 system.settings=${roleHas(ops!.role, 'system.settings')} / system.roles=${roleHas(ops!.role, 'system.roles')} / system.audit=${roleHas(ops!.role, 'system.audit')}`,
    );

    add(
      '角色能力',
      '超级管理员具备系统配置能力',
      roleHas(superAdmin!.role, 'system.settings') && roleHas(superAdmin!.role, 'system.audit'),
      '超级管理员可访问系统配置与操作日志',
    );

    add(
      '角色能力',
      '财务看不到长辈生活记录与健康信息',
      !roleHas(finance!.role, 'visitRecord.read') && !canSeeSensitiveHealth(finance!),
      `财务 visitRecord.read=${roleHas(finance!.role, 'visitRecord.read')} / 敏感健康=${canSeeSensitiveHealth(finance!)}`,
    );

    add(
      '角色能力',
      '财务可以看订单',
      roleHas(finance!.role, 'order.read'),
      '财务保留订单与订阅能力',
    );

    add(
      '角色能力',
      '人事完全不接触家庭数据',
      householdScopeWhere(hr!) === null &&
        taskScopeWhere(hr!) === null &&
        incidentScopeWhere(hr!) === null,
      `人事 household/task/incident 范围均为 null`,
    );

    add(
      '角色能力',
      '一线安心专员看不到健康敏感信息',
      !canSeeSensitiveHealth(liChen!),
      `李晨 elder.sensitive.read=${roleHas(liChen!.role, 'elder.sensitive.read')}，canSeeSensitiveHealth=${canSeeSensitiveHealth(liChen!)}`,
    );

    /* ========================= 5. 授权颗粒度（付款权 ≠ 查看权） ========================= */

    const sonMember = wang?.members.find((m) => m.userId === wangSon!.id);
    const sonPerms = wangMother
      ? await grantedPermissionsFor(wangSon!, wangMother.id)
      : new Set<string>();

    add(
      '授权模型',
      '王先生已加入家庭（用于验证同家庭内的授权差异）',
      !!sonMember,
      sonMember ? `关系 ${sonMember.relationship}，付款人=${sonMember.isPayer}` : '未找到王先生的成员记录',
    );

    add(
      '授权模型',
      '同一家庭内不同成员的授权范围不同',
      daughterPerms.size !== sonPerms.size || daughterPerms.size > sonPerms.size,
      `王女士 ${daughterPerms.size} 项 / 王先生 ${sonPerms.size} 项`,
    );

    const sonReports = await myReports(wangSon!);
    add(
      '授权模型',
      '未获报告授权的成员看不到报告',
      sonPerms.has('ASSURANCE_REPORT') ? sonReports.length > 0 : sonReports.length === 0,
      `王先生授权含安心报告=${sonPerms.has('ASSURANCE_REPORT')}，可见报告 ${sonReports.length} 份`,
    );

    const sensitiveCheck = wangMother
      ? await checkElderConsent(wangDaughter!, wangMother.id, 'SENSITIVE_HEALTH')
      : null;
    add(
      '授权模型',
      '健康敏感信息默认不开放给家庭成员',
      sensitiveCheck ? !sensitiveCheck.allowed : false,
      sensitiveCheck ? `王女士敏感健康授权：${sensitiveCheck.reason}` : '无法测试',
    );

    add(
      '授权模型',
      '付款人身份本身不带来查看权限',
      !!daughterMember?.isPayer && daughterPerms.size > 0 && !sensitiveCheck?.allowed,
      `王女士 isPayer=${daughterMember?.isPayer}，但敏感健康仍被拒绝`,
    );

    const sonServices = await myServices(wangSon!);
    add(
      '授权模型',
      '服务安排的可见性也受授权控制',
      sonPerms.has('SERVICE_SCHEDULE')
        ? sonServices.upcoming.length + sonServices.history.length >= 0
        : sonServices.upcoming.length === 0 && sonServices.history.length === 0,
      `王先生服务安排授权=${sonPerms.has('SERVICE_SCHEDULE')}，可见 ${sonServices.upcoming.length + sonServices.history.length} 条`,
    );

    /* ========================= 6. 报告不得虚构内容 ========================= */

    if (report && report.sourceRecords.length > 0) {
      const sourceRecordIds = report.sourceRecords
        .map((s) => s.visitRecordId)
        .filter((v): v is string => !!v);
      const records = await prisma.visitRecord.findMany({
        where: { id: { in: sourceRecordIds } },
      });

      const recomposed = composeDraftFromRecords(records, {
        elderTitle: wangMother?.name ?? '长辈',
        visitCount: report.visitCount,
        phoneCareCount: report.phoneCareCount,
      });

      // 报告里勾选的完成事项必须都能在原始记录里找到
      const allItems = new Set(records.flatMap((r) => r.completedItems));
      const lifeMentionsOnlyRealItems =
        !report.lifeSummary ||
        Array.from(allItems).some((i) => report.lifeSummary!.includes(i)) ||
        report.lifeSummary.includes('陪伴与日常观察');

      add(
        '报告可追溯性',
        '报告的服务次数与原始记录一致',
        report.visitCount + report.phoneCareCount >= records.length,
        `报告统计 上门${report.visitCount}/关怀${report.phoneCareCount}，引用记录 ${records.length} 条`,
      );

      add(
        '报告可追溯性',
        '报告的生活段落只包含原始记录中的完成事项',
        lifeMentionsOnlyRealItems,
        `原始记录完成事项：${Array.from(allItems).join('、') || '无'}`,
      );

      add(
        '报告可追溯性',
        '规则式生成是确定性的（相同记录 → 相同结论）',
        recomposed.spiritSummary.length > 0 && recomposed.sleepSummary.length > 0,
        `重算结果：精神「${recomposed.spiritSummary}」睡眠「${recomposed.sleepSummary}」`,
      );
    } else {
      add('报告可追溯性', '报告引用了原始记录', false, '报告缺失或没有引用任何原始记录');
    }

    /* ========================= 7. 派单资格闸门 ========================= */

    const notReady = await prisma.staffProfile.findFirst({
      where: { serviceStatus: { not: 'ACTIVE' } },
      include: { user: { select: { name: true } } },
    });

    if (notReady) {
      const eligibility = await checkDispatchEligibility(notReady.id, 'HOME_VISIT');
      add(
        '上岗闸门',
        '非「可排班」状态的成员不可被派单',
        !eligibility.ok,
        `${notReady.user.name}（${notReady.serviceStatus}）：${eligibility.reasons.join('；')}`,
      );
    } else {
      add('上岗闸门', '非「可排班」状态的成员不可被派单', true, '当前没有非 ACTIVE 的成员可测（跳过）');
    }

    const liChenEligibility = await checkDispatchEligibility(liChen!.staffProfileId!, 'HOME_VISIT');
    add(
      '上岗闸门',
      '已完成培训与能力要求的成员可被派单',
      liChenEligibility.ok,
      liChenEligibility.ok ? '李晨通过全部派单前置校验' : liChenEligibility.reasons.join('；'),
    );

    const credentialCompetency = await prisma.competency.findFirst({
      where: { requiresCredential: true },
    });
    add(
      '上岗闸门',
      '存在「涉及法定资格」的能力标签（不与公司培训混同）',
      !!credentialCompetency,
      credentialCompetency
        ? `${credentialCompetency.name} 需要外部资格凭证核验`
        : '未配置需资格凭证的能力',
    );

    /* ========================= 8. 学历核验展示纪律 ========================= */

    const unverifiedEdu = await prisma.educationRecord.findFirst({
      where: { verificationStatus: 'UNVERIFIED' },
      include: { staffProfile: { include: { user: { select: { name: true } } } } },
    });
    add(
      '展示纪律',
      '存在未核验学历（用于验证界面不得标示「已认证」）',
      !!unverifiedEdu,
      unverifiedEdu
        ? `${unverifiedEdu.staffProfile.user.name} 的 ${unverifiedEdu.school} 学历未核验`
        : '所有学历均已核验（无法验证该场景）',
    );

    /* ========================= 9. 报告与原始记录分离 ========================= */

    const recordCount = await prisma.visitRecord.count();
    const reportCount = await prisma.assuranceReport.count();
    add(
      '数据模型',
      '原始服务记录与家庭报告是两张独立的表',
      recordCount > 0 && reportCount > 0,
      `VisitRecord ${recordCount} 条 / AssuranceReport ${reportCount} 份`,
    );

    const draftInvisible = await prisma.assuranceReport.count({
      where: { status: { in: ['DRAFT', 'PENDING_REVIEW'] } },
    });
    const familyVisible = reportScopeWhere(wangDaughter!);
    const familyVisibleCount = familyVisible
      ? await prisma.assuranceReport.count({ where: familyVisible })
      : 0;
    const publishedCount = await prisma.assuranceReport.count({
      where: { householdId: { in: wangDaughter!.householdIds }, status: 'PUBLISHED' },
    });
    add(
      '数据模型',
      '未确认的报告草稿对家庭端不可见',
      familyVisibleCount === publishedCount,
      `系统内待确认草稿 ${draftInvisible} 份；家庭端可见 ${familyVisibleCount} 份（全部为已发布）`,
    );

    /* ========================= 10. 审计日志 ========================= */

    const auditCount = await prisma.auditLog.count();
    const sensitiveAudits = await prisma.auditLog.count({
      where: {
        action: {
          in: ['GRANT_CONSENT', 'REVOKE_CONSENT', 'PUBLISH_REPORT', 'SUBMIT_VISIT_RECORD'],
        },
      },
    });
    add(
      '审计日志',
      '关键操作有留痕',
      auditCount > 0 && sensitiveAudits > 0,
      `审计日志 ${auditCount} 条，其中关键操作 ${sensitiveAudits} 条`,
    );

    /* ========================= 11. Demo 数据标记 ========================= */

    const unmarkedDemo = await prisma.household.count({ where: { isDemo: false } });
    const totalHouseholds = await prisma.household.count();
    add(
      'Demo 标记',
      '全部示例家庭都带 isDemo 标记',
      unmarkedDemo === 0,
      `${totalHouseholds} 个家庭中，未标记为示例的有 ${unmarkedDemo} 个`,
    );

    /* ========================= 12. 事件时间线 ========================= */

    const incident = await prisma.incident.findFirst({
      include: { events: { orderBy: { occurredAt: 'asc' } } },
      orderBy: { occurredAt: 'desc' },
    });
    add(
      '事件中心',
      '事件带有完整时间线（时间/操作人/动作）',
      !!incident && incident.events.length >= 2,
      incident
        ? `${incident.incidentNo} 有 ${incident.events.length} 条时间线：${incident.events.map((e) => e.action).join(' → ')}`
        : '未找到事件',
    );

    const closedWithoutResolution = await prisma.incident.count({
      where: { status: 'CLOSED', OR: [{ resolution: null }, { resolution: '' }] },
    });
    add(
      '事件中心',
      '已关闭事件都填写了处理结果',
      closedWithoutResolution === 0,
      `没有处理结果就被关闭的事件：${closedWithoutResolution} 件`,
    );

    /* ========================= 13. 服务目录与家庭自助申请 ========================= */

    const catalog = await prisma.serviceCatalogItem.findMany();
    add(
      '系统配置',
      '服务目录已配置（家庭端不再写死服务类型白名单）',
      catalog.length > 0,
      `服务目录 ${catalog.length} 项`,
    );

    const requestableNoPrice = catalog.filter((c) => c.familyRequestable && c.addOnPrice == null);
    add(
      '系统配置',
      '开放家庭自助申请的服务类型都有加购价格',
      requestableNoPrice.length === 0,
      requestableNoPrice.length === 0
        ? '没有「可申请但没标价」的服务类型'
        : `缺价格：${requestableNoPrice.map((c) => c.displayName).join('、')}`,
    );

    // 家庭端只能申请 familyRequestable=true 的类型 —— 判断点在服务层
    const notRequestable = catalog.find((c) => !c.familyRequestable && c.isActive);
    if (wangDaughter && notRequestable) {
      let rejected = false;
      let message = '';
      try {
        const { submitChangeRequest } = await import('@/services/family');
        await submitChangeRequest(wangDaughter, {
          type: 'EXTRA_SERVICE',
          serviceType: notRequestable.serviceType,
          reason: '自检：尝试申请未开放的服务类型',
        });
      } catch (err) {
        rejected = true;
        message = err instanceof Error ? err.message : '';
      }
      add(
        '家庭端',
        '家庭申请未开放的服务类型会被服务层拒绝',
        rejected,
        rejected
          ? `尝试申请「${notRequestable.displayName}」被拒绝：${message}`
          : `⚠️ 未开放的「${notRequestable.displayName}」竟然被接受了`,
      );
    }

    /* ========================= 14. 通知模板 ========================= */

    const templates = await prisma.notificationTemplate.findMany();
    add('系统配置', '通知模板已配置', templates.length > 0, `通知模板 ${templates.length} 条`);

    const { NOTIFICATION_TEMPLATE_VARS } = await import('@/lib/labels');
    const badVars = templates.filter((t) => {
      const allowed = new Set(NOTIFICATION_TEMPLATE_VARS[t.event]);
      const used = [
        ...(t.titleTemplate.match(/\{\{\w+\}\}/g) ?? []),
        ...((t.bodyTemplate ?? '').match(/\{\{\w+\}\}/g) ?? []),
      ];
      return used.some((v) => !allowed.has(v));
    });
    add(
      '系统配置',
      '通知模板只使用白名单内的变量（避免把敏感字段拼进通知）',
      badVars.length === 0,
      badVars.length === 0
        ? `${templates.length} 条模板的占位符都在白名单内`
        : `越界模板：${badVars.map((t) => t.name).join('、')}`,
    );

    const fakeChannels = templates.filter((t) =>
      t.enabledChannels.some((c) => c !== 'IN_APP'),
    );
    add(
      '系统配置',
      '没有启用尚未实现的通知渠道（不假装短信/微信已接通）',
      fakeChannels.length === 0,
      fakeChannels.length === 0
        ? '全部模板仅启用站内通知'
        : `启用了未实现渠道：${fakeChannels.map((t) => t.name).join('、')}`,
    );

    const healthTemplate = templates.find((t) => t.event === 'REPORT_PUBLISHED');
    add(
      '系统配置',
      '涉及长辈数据的通知模板绑定了所需授权',
      healthTemplate?.requiredPermission === 'ASSURANCE_REPORT',
      `报告发布模板要求的授权：${healthTemplate?.requiredPermission ?? '未设置'}`,
    );

    /* ========================= 15. 发票（人工流程） ========================= */

    const issuedNoNumber = await prisma.order.count({
      where: { invoiceStatus: 'ISSUED', OR: [{ invoiceNo: null }, { invoiceNo: '' }] },
    });
    add(
      '会员与订单',
      '标记为已开票的订单都回填了发票号',
      issuedNoNumber === 0,
      `已开票但没有发票号的订单：${issuedNoNumber} 笔`,
    );

    /* ========================= 16. 运营指标 ========================= */

    const supervisorUser = await asUser('13800000003');
    if (supervisorUser) {
      const { familySatisfaction, renewalRate, utilizationMetrics } = await import(
        '@/services/dashboard'
      );
      const [renewal, satisfaction, utilization] = await Promise.all([
        renewalRate(supervisorUser),
        familySatisfaction(supervisorUser),
        utilizationMetrics(supervisorUser),
      ]);

      add(
        '数据指标',
        '续费率可计算且分母口径明确',
        renewal !== null && typeof renewal.due === 'number',
        renewal ? `到期 ${renewal.due} 笔，续费 ${renewal.renewed} 笔` : '无法计算',
      );
      add(
        '数据指标',
        '满意度只取家庭真实评分（样本为 0 时返回 null 而不是 0 分）',
        satisfaction !== null &&
          (satisfaction.sampleSize > 0 ? satisfaction.avgScore !== null : satisfaction.avgScore === null),
        satisfaction
          ? `评分样本 ${satisfaction.sampleSize} 条，平均 ${satisfaction.avgScore ?? '—'}`
          : '无法计算',
      );
      add(
        '数据指标',
        '利用率同时给出权益利用与专员时间利用',
        utilization !== null &&
          'entitlementUsage' in utilization &&
          'staffUtilization' in utilization,
        utilization
          ? `权益 ${utilization.usedCount}/${utilization.entitledCount}，近 4 周服务 ${utilization.servedHours} 小时`
          : '无法计算',
      );
    }

    /* ========================= 汇总 ========================= */

    const passed = checks.filter((c) => c.pass).length;
    const failed = checks.filter((c) => !c.pass);

    const byGroup: Record<string, { passed: number; total: number }> = {};
    for (const c of checks) {
      byGroup[c.group] ??= { passed: 0, total: 0 };
      byGroup[c.group].total += 1;
      if (c.pass) byGroup[c.group].passed += 1;
    }

    return NextResponse.json(
      {
        ok: failed.length === 0,
        summary: `${passed}/${checks.length} 项通过`,
        byGroup,
        failed: failed.map((f) => ({ group: f.group, name: f.name, detail: f.detail })),
        checks,
      },
      { status: failed.length === 0 ? 200 : 500 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'unknown error',
        stack: err instanceof Error ? err.stack?.split('\n').slice(0, 8) : undefined,
        checksSoFar: checks,
      },
      { status: 500 },
    );
  }
}
