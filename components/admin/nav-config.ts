import type { Capability } from '@/lib/permissions/capabilities';

/**
 * 总后台导航。
 *
 * 每个条目都绑定一个 capability —— 导航是否出现由角色能力决定，
 * 而不是「渲染出来再拦」。这样财务不会在侧边栏看到长辈档案入口，
 * 普通运营也不会看到系统配置入口。
 */

export type NavItem = {
  label: string;
  href: string;
  capability: Capability;
  /** 待办计数的字段名，对应 services/dashboard.pendingCounts 的返回值 */
  badgeKey?:
    | 'pendingAssign'
    | 'pendingRecordReview'
    | 'pendingReports'
    | 'openIncidents'
    | 'openFeedback'
    | 'openRequests'
    | 'pendingExams'
    | 'pendingInvoices';
};

export type NavGroup = {
  title: string;
  icon: string;
  items: NavItem[];
};

export const ADMIN_NAV: NavGroup[] = [
  {
    title: '首页',
    icon: 'LayoutDashboard',
    items: [{ label: '运营总览', href: '/admin', capability: 'household.read' }],
  },
  {
    title: '家庭',
    icon: 'Home',
    items: [
      { label: '家庭列表', href: '/admin/households', capability: 'household.read' },
      { label: '潜在家庭', href: '/admin/households?status=LEAD', capability: 'household.read' },
      { label: '长辈档案', href: '/admin/elders', capability: 'elder.read' },
      { label: '家庭成员', href: '/admin/members', capability: 'familyMember.read' },
      { label: '授权管理', href: '/admin/consents', capability: 'consent.read' },
    ],
  },
  {
    title: '服务',
    icon: 'CalendarCheck',
    items: [
      { label: '今日服务', href: '/admin/service/today', capability: 'task.read' },
      { label: '服务日历', href: '/admin/service/calendar', capability: 'task.read' },
      { label: '排班与派单', href: '/admin/service/dispatch', capability: 'task.assign', badgeKey: 'pendingAssign' },
      {
        label: '服务记录',
        href: '/admin/service/records',
        capability: 'visitRecord.read',
        badgeKey: 'pendingRecordReview',
      },
      {
        label: '安心报告',
        href: '/admin/service/reports',
        capability: 'report.read',
        badgeKey: 'pendingReports',
      },
      {
        label: '家庭申请',
        href: '/admin/service/requests',
        capability: 'task.read',
        badgeKey: 'openRequests',
      },
    ],
  },
  {
    title: '事件中心',
    icon: 'Siren',
    items: [
      { label: '未处理', href: '/admin/incidents?status=NEW', capability: 'incident.read', badgeKey: 'openIncidents' },
      { label: '处理中', href: '/admin/incidents?status=IN_PROGRESS', capability: 'incident.read' },
      { label: '待跟进', href: '/admin/incidents?status=PENDING_FOLLOW_UP', capability: 'incident.read' },
      { label: '已关闭', href: '/admin/incidents?status=CLOSED', capability: 'incident.read' },
    ],
  },
  {
    title: '安心专员',
    icon: 'Users',
    items: [
      { label: '专员列表', href: '/admin/staff', capability: 'staff.read' },
      { label: '培训管理', href: '/admin/staff/training', capability: 'staff.training.manage' },
      { label: '考核管理', href: '/admin/staff/exams', capability: 'staff.training.manage', badgeKey: 'pendingExams' },
      { label: '能力标签', href: '/admin/staff/competencies', capability: 'staff.competency.manage' },
      { label: '服务表现', href: '/admin/staff/performance', capability: 'staff.performance.read' },
    ],
  },
  {
    title: '会员与订单',
    icon: 'Wallet',
    items: [
      { label: '服务方案', href: '/admin/billing/plans', capability: 'plan.read' },
      { label: '订阅', href: '/admin/billing/subscriptions', capability: 'subscription.read' },
      { label: '订单', href: '/admin/billing/orders', capability: 'order.read' },
      { label: '退款', href: '/admin/billing/orders?type=REFUND', capability: 'order.refund' },
      { label: '发票', href: '/admin/billing/invoices', capability: 'invoice.manage', badgeKey: 'pendingInvoices' },
    ],
  },
  {
    title: '客服',
    icon: 'MessageSquareHeart',
    items: [
      {
        label: '家庭反馈',
        href: '/admin/support/feedback?kind=feedback',
        capability: 'feedback.read',
        badgeKey: 'openFeedback',
      },
      { label: '投诉', href: '/admin/support/feedback?kind=complaint', capability: 'feedback.read' },
      { label: '咨询', href: '/admin/support/feedback?kind=consultation', capability: 'feedback.read' },
    ],
  },
  {
    title: '数据',
    icon: 'BarChart3',
    items: [
      { label: '运营指标', href: '/admin/analytics', capability: 'dashboard.operations' },
      { label: '财务指标', href: '/admin/analytics/finance', capability: 'dashboard.finance' },
    ],
  },
  {
    title: '系统',
    icon: 'Settings',
    items: [
      { label: '帐号管理', href: '/admin/system/users', capability: 'user.read' },
      { label: '角色权限', href: '/admin/system/roles', capability: 'system.roles' },
      { label: '服务类型与价格', href: '/admin/system/services', capability: 'system.settings' },
      { label: '通知模板', href: '/admin/system/templates', capability: 'system.settings' },
      { label: '城市与区域', href: '/admin/system/regions', capability: 'system.settings' },
      { label: '隐私与授权', href: '/admin/system/privacy', capability: 'system.settings' },
      { label: '操作日志', href: '/admin/system/audit', capability: 'system.audit' },
    ],
  },
];
