import Link from 'next/link';
import { Bell } from 'lucide-react';

import { Badge, EmptyState } from '@/components/ui';
import { prisma } from '@/lib/db';
import { NOTIFICATION_LEVEL_LABELS } from '@/lib/labels';
import { guardPortal } from '@/lib/permissions';
import { formatFriendly } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: '消息' };

export default async function StaffMessagesPage() {
  const user = await guardPortal('staff');

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });

  return (
    <div className="px-4 py-5">
      <header className="mb-5">
        <h1 className="text-[22px] font-semibold text-ink-800">消息</h1>
        <p className="mt-1 text-sm text-ink-500">新任务、任务调整与公司公告都会出现在这里。</p>
      </header>

      {notifications.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Bell className="h-5 w-5" />} title="暂时没有消息" />
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const body = (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {n.level !== 'NORMAL' ? (
                    <Badge tone={n.level === 'URGENT' ? 'danger' : 'warm'}>
                      {NOTIFICATION_LEVEL_LABELS[n.level]}
                    </Badge>
                  ) : null}
                  <span className="text-[15px] font-medium text-ink-800">{n.title}</span>
                  {n.readAt ? null : <span className="h-2 w-2 rounded-full bg-warm-400" />}
                </div>
                {n.body ? (
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-600">{n.body}</p>
                ) : null}
                <p className="mt-1 text-[12px] text-ink-400">{formatFriendly(n.createdAt)}</p>
              </>
            );

            return (
              <li key={n.id}>
                {n.linkUrl ? (
                  <Link href={n.linkUrl} className="card block px-4 py-3.5 active:scale-[0.995]">
                    {body}
                  </Link>
                ) : (
                  <div className="card px-4 py-3.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
