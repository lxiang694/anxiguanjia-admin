import Link from 'next/link';

import { Badge, Card, CardHeader, EmptyState } from '@/components/ui';
import { prisma } from '@/lib/db';
import { SERVICE_TYPE_LABELS, TASK_STATUS_LABELS, TASK_STATUS_TONE } from '@/lib/labels';
import { guardPage, taskScopeWhere } from '@/lib/permissions';
import { formatTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: '服务日历' };

/** 未来 14 天的服务安排，按天分组。第一版刻意不做复杂日历控件。 */
export default async function CalendarPage() {
  const user = await guardPage('task.read', { returnTo: '/admin/service/calendar' });
  const scope = taskScopeWhere(user);

  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 14);

  const tasks = scope
    ? await prisma.serviceTask.findMany({
        where: {
          AND: [scope, { scheduledStart: { gte: from, lt: to }, status: { notIn: ['CANCELLED'] } }],
        },
        include: {
          household: { select: { id: true, name: true } },
          elder: { select: { name: true } },
          staffProfile: { include: { user: { select: { name: true } } } },
        },
        orderBy: { scheduledStart: 'asc' },
      })
    : [];

  const days: { key: string; label: string; items: typeof tasks }[] = [];
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const label = new Intl.DateTimeFormat('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      timeZone: 'Asia/Shanghai',
    }).format(d);
    const key = d.toISOString().slice(0, 10);
    days.push({
      key,
      label: i === 0 ? `今天 · ${label}` : i === 1 ? `明天 · ${label}` : label,
      items: tasks.filter(
        (t) =>
          t.scheduledStart.getFullYear() === d.getFullYear() &&
          t.scheduledStart.getMonth() === d.getMonth() &&
          t.scheduledStart.getDate() === d.getDate(),
      ),
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">服务日历</h1>
        <p className="mt-1 text-sm text-ink-500">未来 14 天的服务安排，共 {tasks.length} 项。</p>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <EmptyState title="未来两周还没有服务安排" description="到「排班与派单」安排服务。" />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {days.map((d) => (
            <Card key={d.key} className={d.items.length === 0 ? 'opacity-60' : undefined}>
              <CardHeader title={d.label} subtitle={`${d.items.length} 项`} />
              {d.items.length === 0 ? (
                <p className="px-5 py-4 text-[13px] text-ink-400">没有安排</p>
              ) : (
                <ul className="divide-y divide-cream-100">
                  {d.items.map((t) => (
                    <li key={t.id} className="px-5 py-2.5">
                      <p className="text-[13px] text-ink-800">
                        <span className="mr-1.5 font-mono tabular-nums text-ink-500">
                          {formatTime(t.scheduledStart)}
                        </span>
                        <Link href={`/admin/households/${t.household.id}`} className="hover:text-brand-700">
                          {t.elder?.name ?? t.household.name}
                        </Link>
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-400">
                        {SERVICE_TYPE_LABELS[t.serviceType]}
                        {t.staffProfile ? ` · ${t.staffProfile.user.name}` : ' · 待派单'}
                        <Badge tone={TASK_STATUS_TONE[t.status]}>{TASK_STATUS_LABELS[t.status]}</Badge>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
