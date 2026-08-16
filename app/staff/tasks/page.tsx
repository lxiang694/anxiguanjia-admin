import Link from 'next/link';
import { ChevronRight, ListChecks } from 'lucide-react';

import { Badge, EmptyState } from '@/components/ui';
import { SERVICE_TYPE_LABELS, TASK_STATUS_LABELS, TASK_STATUS_TONE } from '@/lib/labels';
import { guardPortal } from '@/lib/permissions';
import { formatTime } from '@/lib/utils';
import { myUpcomingTasks } from '@/services/scheduling';

export const dynamic = 'force-dynamic';
export const metadata = { title: '任务' };

export default async function StaffTasksPage() {
  const user = await guardPortal('staff');
  const tasks = await myUpcomingTasks(user, 14);

  // 按天分组
  const groups = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const key = new Intl.DateTimeFormat('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      timeZone: 'Asia/Shanghai',
    }).format(t.scheduledStart);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const todayKey = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Shanghai',
  }).format(new Date());

  return (
    <div className="px-4 py-5">
      <header className="mb-5">
        <h1 className="text-[22px] font-semibold text-ink-800">我的任务</h1>
        <p className="mt-1 text-sm text-ink-500">未来两周共 {tasks.length} 项服务。</p>
      </header>

      {tasks.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<ListChecks className="h-5 w-5" />}
            title="未来两周还没有安排"
            description="有新任务时会在「消息」里通知您。"
          />
        </div>
      ) : (
        <div className="space-y-5">
          {Array.from(groups.entries()).map(([day, items]) => (
            <section key={day}>
              <h2 className="mb-2 px-1 text-[13px] font-semibold text-ink-600">
                {day === todayKey ? `今天 · ${day}` : day}
                <span className="ml-2 font-normal text-ink-400">{items.length} 项</span>
              </h2>
              <ul className="space-y-2">
                {items.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/staff/tasks/${t.id}`}
                      className="card flex items-center gap-3 px-4 py-3.5 active:scale-[0.995]"
                    >
                      <span className="w-[3.4rem] shrink-0 text-[17px] font-semibold tabular-nums text-ink-800">
                        {formatTime(t.scheduledStart)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] font-medium text-ink-800">
                          {t.elder?.name ?? t.household.name}
                        </span>
                        <span className="mt-0.5 block text-[13px] text-ink-500">
                          {SERVICE_TYPE_LABELS[t.serviceType]}
                        </span>
                        <span className="mt-1.5 flex flex-wrap gap-1.5">
                          <Badge tone={TASK_STATUS_TONE[t.status]}>
                            {TASK_STATUS_LABELS[t.status]}
                          </Badge>
                          {t.isBackupAssignment ? <Badge tone="warm">代班</Badge> : null}
                        </span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
