import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';

import { StaffBottomNav } from '@/components/staff/bottom-nav';
import { DemoBanner } from '@/components/ui';
import { unreadCount } from '@/lib/notifications';
import { guardPortal } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/**
 * 安心专员工作台。
 *
 * Mobile First：这不是 ERP。一线成员大多在路上、在电梯里、在长辈家门口使用，
 * 所以布局按手机单手操作设计，桌面端只是居中放大，不额外增加信息密度。
 */
export default async function StaffLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await guardPortal('staff');
  const unread = await unreadCount(user.id);

  return (
    <div className="portal-staff min-h-screen bg-cream-100">
      <DemoBanner />

      <div className="mx-auto max-w-lg pb-24">{children}</div>

      {/* 常驻「需要协助」入口 —— 全程可用，不需要先找到某个任务 */}
      <Link
        href="/staff/help"
        className="fixed bottom-[5.5rem] right-4 z-30 flex h-12 items-center gap-2 rounded-pill bg-danger-600 px-4 py-3 text-sm font-semibold text-white shadow-lift active:scale-[0.98]"
      >
        <LifeBuoy className="h-5 w-5" />
        需要协助
      </Link>

      <StaffBottomNav unread={unread} />
    </div>
  );
}
