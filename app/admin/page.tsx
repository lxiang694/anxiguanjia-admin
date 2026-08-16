import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Siren,
  TriangleAlert,
  Users,
} from 'lucide-react';

import { Badge, ButtonLink, Card, CardHeader, EmptyState, StatTile } from '@/components/ui';
import {
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_TYPE_LABELS,
  SERVICE_TYPE_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_TONE,
} from '@/lib/labels';
import { can, guardPortal } from '@/lib/permissions';
import { formatMoneyCNY, formatTime, pct } from '@/lib/utils';
import { dashboardSummary } from '@/services/dashboard';
import { urgentIncidents } from '@/services/incident';
import { todayTasks } from '@/services/scheduling';

export const dynamic = 'force-dynamic';

export const metadata = { title: '运营总览' };

export default async function AdminDashboard() {
  const user = await guardPortal('admin');

  const [summary, urgent, tasks] = await Promise.all([
    dashboardSummary(user),
    can(user, 'incident.read') ? urgentIncidents(user) : Promise.resolve([]),
    can(user, 'task.read') ? todayTasks(user) : Promise.resolve([]),
  ]);

  const { today, households, pending, quality, finance } = summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">今天需要处理什么</h1>
        <p className="mt-1 text-sm text-ink-500">
          先看需要现在动手的事，再看指标。
        </p>
      </div>

      {/* ============ 需要现在处理 ============ */}
      {can(user, 'incident.read') ? (
        <Card className="overflow-hidden border-danger-100">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Siren className="h-4 w-4 text-danger-500" />
                需要现在处理
              </span>
            }
            subtitle={
              urgent.length > 0
                ? `${urgent.length} 件异常事件等待响应`
                : '目前没有需要立即处理的异常事件'
            }
            action={
              urgent.length > 0 ? (
                <ButtonLink href="/admin/incidents?status=NEW" size="sm">
                  全部事件
                </ButtonLink>
              ) : null
            }
          />
          {urgent.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5 text-brand-500" />}
              title="暂无需要立即处理的事项"
              description="有新的异常事件时，这里会第一时间显示，并同时通知服务督导。"
            />
          ) : (
            <ul className="divide-y divide-cream-200">
              {urgent.map((inc) => (
                <li key={inc.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink-800">
                          {inc.household.name}
                        </span>
                        <span className="font-mono text-xs tabular-nums text-ink-400">
                          {formatTime(inc.occurredAt)}
                        </span>
                        <Badge
                          tone={
                            inc.severity === 'CRITICAL' || inc.severity === 'HIGH'
                              ? 'danger'
                              : 'warm'
                          }
                        >
                          {INCIDENT_SEVERITY_LABELS[inc.severity]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[13.5px] text-ink-700">
                        {INCIDENT_TYPE_LABELS[inc.type]}
                        {inc.description ? `：${inc.description}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-ink-400">
                        负责人：
                        {inc.owner?.name ?? (
                          <span className="font-medium text-warm-600">尚未指定</span>
                        )}
                        {inc.reportedBy ? ` · 由 ${inc.reportedBy.name} 上报` : ''}
                      </p>
                    </div>
                    <ButtonLink href={`/admin/incidents/${inc.id}`} variant="danger" size="sm">
                      立即处理
                      <ArrowRight className="h-3.5 w-3.5" />
                    </ButtonLink>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {/* ============ 今日服务 ============ */}
      {can(user, 'task.read') ? (
        <section>
          <h2 className="mb-2.5 text-sm font-semibold text-ink-700">今日服务</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile label="今日服务" value={today.total} href="/admin/service/today" />
            <StatTile label="已完成" value={today.completed} tone="brand" />
            <StatTile label="服务中" value={today.inService} tone="info" />
            <StatTile label="未开始" value={today.notStarted} tone="neutral" />
            <StatTile
              label="异常"
              value={today.abnormal}
              tone={today.abnormal > 0 ? 'danger' : 'neutral'}
            />
          </div>
        </section>
      ) : null}

      {/* ============ 待办队列 ============ */}
      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-ink-700">待办队列</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {can(user, 'task.assign') ? (
            <StatTile
              label="待派单"
              value={pending.pendingAssign}
              tone={pending.pendingAssign > 0 ? 'warm' : 'neutral'}
              href="/admin/service/dispatch"
            />
          ) : null}
          {can(user, 'visitRecord.review') ? (
            <StatTile
              label="服务记录待审核"
              value={pending.pendingRecordReview}
              tone={pending.pendingRecordReview > 0 ? 'warm' : 'neutral'}
              href="/admin/service/records"
            />
          ) : null}
          {can(user, 'report.read') ? (
            <StatTile
              label="安心报告待确认"
              value={pending.pendingReports}
              tone={pending.pendingReports > 0 ? 'warm' : 'neutral'}
              href="/admin/service/reports"
            />
          ) : null}
          {can(user, 'incident.read') ? (
            <StatTile
              label="未关闭事件"
              value={pending.openIncidents}
              tone={pending.openIncidents > 0 ? 'danger' : 'neutral'}
              href="/admin/incidents?status=NEW"
            />
          ) : null}
          {can(user, 'feedback.read') ? (
            <StatTile
              label="待处理反馈"
              value={pending.openFeedback}
              tone={pending.openFeedback > 0 ? 'warm' : 'neutral'}
              href="/admin/support/feedback"
            />
          ) : null}
        </div>
      </section>

      {/* ============ 家庭 ============ */}
      {can(user, 'household.read') ? (
        <section>
          <h2 className="mb-2.5 text-sm font-semibold text-ink-700">家庭</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile
              label="正式会员家庭"
              value={households.activeMember}
              tone="brand"
              href="/admin/households?status=ACTIVE_MEMBER"
            />
            <StatTile
              label="体验家庭"
              value={households.trial}
              tone="info"
              href="/admin/households?status=TRIAL"
            />
            <StatTile
              label="本月待续费"
              value={finance?.renewalCount ?? households.renewalDue}
              tone="warm"
              href="/admin/billing/subscriptions"
            />
            <StatTile
              label="暂停家庭"
              value={households.paused}
              href="/admin/households?status=PAUSED"
            />
            <StatTile label="本月新增" value={households.newThisMonth} hint="含潜在家庭" />
          </div>
        </section>
      ) : null}

      {/* ============ 收入（仅具备财务视图权限时出现） ============ */}
      {finance?.revenue && finance.metrics ? (
        <section>
          <h2 className="mb-2.5 text-sm font-semibold text-ink-700">本月收入</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile label="本月收入" value={formatMoneyCNY(finance.revenue.total)} tone="brand" />
            <StatTile label="新订阅" value={formatMoneyCNY(finance.revenue.newSubscription)} />
            <StatTile label="续费" value={formatMoneyCNY(finance.revenue.renewal)} />
            <StatTile label="增值服务" value={formatMoneyCNY(finance.revenue.addOn)} />
            <StatTile
              label="MRR"
              value={formatMoneyCNY(finance.metrics.mrr)}
              hint={`ARPU ${formatMoneyCNY(finance.metrics.arpu)}`}
            />
          </div>
        </section>
      ) : null}

      {/* ============ 服务质量 ============ */}
      {quality ? (
        <section>
          <h2 className="mb-2.5 text-sm font-semibold text-ink-700">
            服务质量
            <span className="ml-2 text-xs font-normal text-ink-400">近 30 天</span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile label="准时率" value={pct(quality.onTimeRate)} hint="到达不晚于预约 15 分钟" />
            <StatTile label="服务完成率" value={pct(quality.completionRate)} />
            <StatTile label="记录及时率" value={pct(quality.recordTimelyRate)} hint="结束后 24h 内提交" />
            <StatTile label="报告准时率" value={pct(quality.reportOnTimeRate)} />
            <StatTile label="取消率" value={pct(quality.cancelRate)} />
          </div>
        </section>
      ) : null}

      {/* ============ 今日服务明细 ============ */}
      {can(user, 'task.read') ? (
        <Card>
          <CardHeader
            title="今日服务安排"
            subtitle={`共 ${tasks.length} 项`}
            action={
              <ButtonLink href="/admin/service/today" size="sm">
                查看全部
              </ButtonLink>
            }
          />
          {tasks.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="h-5 w-5" />}
              title="今天还没有安排服务"
              description="可以到「排班与派单」为家庭安排本周的上门探访与电话关怀。"
              action={
                can(user, 'task.assign') ? (
                  <ButtonLink href="/admin/service/dispatch" variant="primary" size="sm">
                    去排班
                  </ButtonLink>
                ) : null
              }
            />
          ) : (
            <ul className="divide-y divide-cream-200">
              {tasks.slice(0, 8).map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-12 shrink-0 font-mono text-sm tabular-nums text-ink-500">
                    {formatTime(t.scheduledStart)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink-800">
                      {t.elder?.name ?? t.household.name}
                      <span className="ml-2 text-[13px] text-ink-500">
                        {SERVICE_TYPE_LABELS[t.serviceType]}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-400">
                      {t.household.district?.name ?? '—'}
                      {t.staffProfile ? ` · ${t.staffProfile.user.name}` : ' · 待派单'}
                    </p>
                  </div>
                  <Badge tone={TASK_STATUS_TONE[t.status]}>{TASK_STATUS_LABELS[t.status]}</Badge>
                  <Link
                    href={`/admin/households/${t.household.id}`}
                    className="shrink-0 text-ink-300 hover:text-brand-600"
                    aria-label="查看家庭"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {/* ============ 快捷入口 ============ */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {can(user, 'household.create') ? (
          <QuickLink href="/admin/households/new" icon={<Users className="h-4 w-4" />} label="新建家庭" />
        ) : null}
        {can(user, 'task.assign') ? (
          <QuickLink
            href="/admin/service/dispatch"
            icon={<ClipboardList className="h-4 w-4" />}
            label="排班与派单"
          />
        ) : null}
        {can(user, 'report.read') ? (
          <QuickLink
            href="/admin/service/reports"
            icon={<FileCheck2 className="h-4 w-4" />}
            label="确认安心报告"
          />
        ) : null}
        {can(user, 'incident.read') ? (
          <QuickLink
            href="/admin/incidents"
            icon={<TriangleAlert className="h-4 w-4" />}
            label="事件中心"
          />
        ) : null}
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="card flex items-center gap-3 px-4 py-3 transition hover:border-brand-300 hover:shadow-lift"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        {icon}
      </span>
      <span className="text-sm font-medium text-ink-700">{label}</span>
      <ArrowRight className="ml-auto h-4 w-4 text-ink-300" />
    </Link>
  );
}
