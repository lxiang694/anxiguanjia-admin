import Link from 'next/link';
import { CalendarClock } from 'lucide-react';

import { Badge, Card, CardHeader, EmptyState, StatTile } from '@/components/ui';
import { SERVICE_TYPE_LABELS, TASK_STATUS_LABELS, TASK_STATUS_TONE } from '@/lib/labels';
import { can, guardPage } from '@/lib/permissions';
import { formatTime } from '@/lib/utils';
import { todayServiceStats } from '@/services/dashboard';
import { todayTasks } from '@/services/scheduling';
import { CancelTaskButton } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '今日服务' };

export default async function TodayPage() {
  const user = await guardPage('task.read', { returnTo: '/admin/service/today' });
  const [tasks, stats] = await Promise.all([todayTasks(user), todayServiceStats(user)]);

  const today = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'Asia/Shanghai',
  }).format(new Date());

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">今日服务</h1>
        <p className="mt-1 text-sm text-ink-500">{today}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="今日服务" value={stats.total} />
        <StatTile label="已完成" value={stats.completed} tone="brand" />
        <StatTile label="服务中" value={stats.inService} tone="info" />
        <StatTile label="未开始" value={stats.notStarted} />
        <StatTile label="待记录/待审核" value={stats.pendingRecord} tone="warm" />
        <StatTile label="异常" value={stats.abnormal} tone={stats.abnormal > 0 ? 'danger' : 'neutral'} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="服务安排" subtitle={`共 ${tasks.length} 项`} />
        {tasks.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-5 w-5" />}
            title="今天没有安排服务"
            description="到「排班与派单」为家庭安排本周的上门探访与电话关怀。"
          />
        ) : (
          <ul className="divide-y divide-cream-200">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span className="w-14 shrink-0 font-mono text-sm tabular-nums text-ink-600">
                  {formatTime(t.scheduledStart)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-800">
                    <Link href={`/admin/households/${t.household.id}`} className="hover:text-brand-700">
                      {t.elder?.name ?? t.household.name}
                    </Link>
                    <span className="ml-2 text-[13px] text-ink-500">
                      {SERVICE_TYPE_LABELS[t.serviceType]}
                    </span>
                    {t.isBackupAssignment ? (
                      <Badge tone="warm" className="ml-2">
                        备用专员
                      </Badge>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {t.household.householdCode}
                    {t.household.district ? ` · ${t.household.district.name}` : ''}
                    {t.staffProfile ? ` · ${t.staffProfile.user.name}` : ' · 待派单'}
                    {t.estimatedMinutes ? ` · 预计 ${t.estimatedMinutes} 分钟` : ''}
                  </p>
                </div>
                <Badge tone={TASK_STATUS_TONE[t.status]}>{TASK_STATUS_LABELS[t.status]}</Badge>
                {t.record ? (
                  <Link href={`/admin/service/records/${t.record.id}`} className="link text-[13px]">
                    记录
                  </Link>
                ) : null}
                {can(user, 'task.assign') &&
                !['COMPLETED', 'CANCELLED', 'PENDING_REVIEW'].includes(t.status) ? (
                  <CancelTaskButton taskId={t.id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
