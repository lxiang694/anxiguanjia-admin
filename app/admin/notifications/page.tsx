import { Bell } from 'lucide-react';

import { Badge, Card, CardHeader, EmptyState } from '@/components/ui';
import { prisma } from '@/lib/db';
import { NOTIFICATION_CHANNEL_LABELS, NOTIFICATION_LEVEL_LABELS } from '@/lib/labels';
import { guardPortal } from '@/lib/permissions';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: '通知' };

export default async function NotificationsPage() {
  const user = await guardPortal('admin');

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">通知</h1>
        <p className="mt-1 text-sm text-ink-500">
          第一版仅实现站内通知。短信、微信、企业微信已保留接口与字段，但尚未接入，因此不会显示「已发送短信」这类未发生的状态。
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="全部通知" subtitle={`近 ${notifications.length} 条`} />
        {notifications.length === 0 ? (
          <EmptyState icon={<Bell className="h-5 w-5" />} title="暂无通知" />
        ) : (
          <ul className="divide-y divide-cream-200">
            {notifications.map((n) => (
              <li key={n.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      n.level === 'URGENT' ? 'danger' : n.level === 'IMPORTANT' ? 'warm' : 'neutral'
                    }
                  >
                    {NOTIFICATION_LEVEL_LABELS[n.level]}
                  </Badge>
                  <span className="text-sm font-medium text-ink-800">{n.title}</span>
                  {n.readAt ? null : <span className="h-1.5 w-1.5 rounded-full bg-warm-400" />}
                  <span className="ml-auto text-xs text-ink-400">{formatDateTime(n.createdAt)}</span>
                </div>
                {n.body ? (
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-600">
                    {n.body}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-ink-300">
                  渠道：{NOTIFICATION_CHANNEL_LABELS[n.channel]}
                  {n.dispatchError ? ` · ${n.dispatchError}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
