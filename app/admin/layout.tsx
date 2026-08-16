import Link from 'next/link';
import { Bell, LogOut } from 'lucide-react';

import { logoutAction } from '@/app/actions/auth';
import { Sidebar, type SidebarGroup } from '@/components/admin/sidebar';
import { ADMIN_NAV } from '@/components/admin/nav-config';
import { DemoBanner } from '@/components/ui';
import { ROLE_LABELS } from '@/lib/labels';
import { unreadCount } from '@/lib/notifications';
import { can, guardPortal } from '@/lib/permissions';
import { pendingCounts } from '@/services/dashboard';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await guardPortal('admin');
  const [pending, unread] = await Promise.all([pendingCounts(user), unreadCount(user.id)]);

  // 按能力裁剪导航：看不到的入口根本不渲染
  const groups: SidebarGroup[] = ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items
      .filter((item) => can(user, item.capability))
      .map((item) => ({
        ...item,
        badge: item.badgeKey ? pending[item.badgeKey] : undefined,
      })),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="portal-admin flex min-h-screen bg-cream-100">
      <Sidebar groups={groups} />

      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner />

        <header className="flex items-center justify-end gap-3 border-b border-cream-300 bg-white px-4 py-2.5">
          <Link
            href="/admin/notifications"
            className="relative rounded-lg p-1.5 text-ink-500 transition hover:bg-cream-200 hover:text-ink-700"
            aria-label="通知"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 ? (
              <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-warm-400" />
            ) : null}
          </Link>

          <div className="hidden text-right sm:block">
            <p className="text-[13px] font-medium leading-tight text-ink-800">{user.name}</p>
            <p className="text-[11px] leading-tight text-ink-400">{ROLE_LABELS[user.role]}</p>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-ink-500 transition hover:bg-cream-200 hover:text-ink-700"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">退出</span>
            </button>
          </form>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 lg:px-6 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
