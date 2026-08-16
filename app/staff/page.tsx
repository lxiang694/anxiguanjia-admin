import Link from 'next/link';
import { ChevronRight, MapPin, Sun } from 'lucide-react';

import { Badge, EmptyState } from '@/components/ui';
import { SERVICE_TYPE_LABELS, TASK_STATUS_LABELS, TASK_STATUS_TONE } from '@/lib/labels';
import { guardPortal } from '@/lib/permissions';
import { formatTime } from '@/lib/utils';
import { myTasksForDay } from '@/services/scheduling';

export const dynamic = 'force-dynamic';
export const metadata = { title: '今天' };

export default async function StaffTodayPage() {
  const user = await guardPortal('staff');
  const tasks = await myTasksForDay(user);

  const today = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'Asia/Shanghai',
  }).format(new Date());

  const done = tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'PENDING_REVIEW').length;

  return (
    <div className="px-4 py-5">
      {/* 问候 */}
      <header className="mb-5">
        <p className="flex items-center gap-1.5 text-[13px] text-ink-500">
          <Sun className="h-4 w-4 text-warm-400" />
          {today}
        </p>
        <h1 className="mt-1.5 text-[22px] font-semibold text-ink-800">
          {user.name}，今天有 {tasks.length} 项服务
        </h1>
        {tasks.length > 0 ? (
          <p className="mt-1 text-sm text-ink-500">
            已完成 {done} 项，还剩 {tasks.length - done} 项。
          </p>
        ) : null}
      </header>

      {user.staffServiceStatus && user.staffServiceStatus !== 'ACTIVE' ? (
        <div className="mb-4 rounded-card border border-warm-200 bg-warm-50 px-4 py-3">
          <p className="text-sm font-medium text-warm-700">您当前不在可排班状态</p>
          <p className="mt-1 text-[13px] leading-relaxed text-warm-700">
            完成培训与考核后，服务督导会为您开放排班。在此期间不会收到新任务。
          </p>
        </div>
      ) : null}

      {tasks.length === 0 ? (
        <div className="card">
          <EmptyState
            title="今天没有安排服务"
            description="可以到「任务」看看未来两周的安排，或到「我的」提交不可排班时间。"
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => {
            const needsAction = [
              'ASSIGNED',
              'ACCEPTED',
              'READY_TO_DEPART',
              'ARRIVED',
              'IN_SERVICE',
              'PENDING_RECORD',
            ].includes(t.status);

            return (
              <li key={t.id}>
                <Link
                  href={`/staff/tasks/${t.id}`}
                  className={
                    needsAction
                      ? 'card block px-4 py-4 transition active:scale-[0.995]'
                      : 'card-muted block px-4 py-4 transition active:scale-[0.995]'
                  }
                >
                  <div className="flex items-start gap-3">
                    {/* 时间 */}
                    <div className="w-[3.6rem] shrink-0">
                      <p className="text-[19px] font-semibold tabular-nums leading-tight text-ink-800">
                        {formatTime(t.scheduledStart)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-400">
                        约 {t.estimatedMinutes} 分钟
                      </p>
                    </div>

                    {/* 内容 */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[17px] font-semibold text-ink-800">
                        {t.elder?.name ?? t.household.name}
                      </p>
                      <p className="mt-0.5 text-[15px] text-ink-600">
                        {SERVICE_TYPE_LABELS[t.serviceType]}
                      </p>
                      {t.addressLine ? (
                        <p className="mt-1 flex items-start gap-1 text-[13px] leading-snug text-ink-500">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-300" />
                          <span className="line-clamp-2">{t.addressLine}</span>
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge tone={TASK_STATUS_TONE[t.status]}>
                          {TASK_STATUS_LABELS[t.status]}
                        </Badge>
                        {t.isBackupAssignment ? <Badge tone="warm">代班</Badge> : null}
                        {t.record ? <Badge tone="brand">记录已提交</Badge> : null}
                      </div>
                    </div>

                    <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-ink-300" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 px-1 text-xs leading-relaxed text-ink-400">
        提醒：服务过程中如遇到无法联系长辈、长辈表示身体不适、跌倒等情况，
        请立刻使用右下角的「需要协助」上报，不要自行判断处理。
      </p>
    </div>
  );
}
