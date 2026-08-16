'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BarChart3,
  CalendarCheck,
  HeartHandshake,
  Home,
  LayoutDashboard,
  Menu,
  MessageSquareHeart,
  Settings,
  Siren,
  Users,
  Wallet,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { NavGroup } from './nav-config';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Home,
  CalendarCheck,
  Siren,
  Users,
  Wallet,
  MessageSquareHeart,
  BarChart3,
  Settings,
};

export type SidebarGroup = NavGroup & {
  items: (NavGroup['items'][number] & { badge?: number })[];
};

export function Sidebar({ groups }: { groups: SidebarGroup[] }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    const base = href.split('?')[0];
    if (base === '/admin') return pathname === '/admin';
    return pathname === base || pathname.startsWith(`${base}/`);
  }

  const nav = (
    <nav className="flex flex-col gap-5 px-3 pb-8">
      {groups.map((group) => {
        if (group.items.length === 0) return null;
        const Icon = ICONS[group.icon] ?? Home;
        return (
          <div key={group.title}>
            <div className="mb-1.5 flex items-center gap-2 px-2">
              <Icon className="h-3.5 w-3.5 text-ink-300" />
              <span className="section-title">{group.title}</span>
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[13.5px] transition',
                        active
                          ? 'bg-brand-50 font-medium text-brand-700'
                          : 'text-ink-600 hover:bg-cream-200 hover:text-ink-800',
                      )}
                    >
                      <span className="truncate">{item.label}</span>
                      {item.badge && item.badge > 0 ? (
                        <span className="shrink-0 rounded-pill bg-warm-400 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* 移动端顶栏 */}
      <div className="flex items-center gap-2 border-b border-cream-300 bg-white px-3 py-2.5 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-1.5 text-ink-500 hover:bg-cream-200"
          aria-label="打开菜单"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-ink-800">家庭安心管家</span>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink-900/30"
            onClick={() => setMobileOpen(false)}
            aria-label="关闭菜单"
          />
          <div className="absolute left-0 top-0 h-full w-[17rem] overflow-y-auto bg-white shadow-lift">
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm font-semibold text-ink-800">导航</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-ink-500 hover:bg-cream-200"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {nav}
          </div>
        </div>
      ) : null}

      {/* 桌面侧栏 */}
      <aside className="hidden w-[15.5rem] shrink-0 flex-col border-r border-cream-300 bg-white lg:flex">
        <Link href="/admin" className="flex items-center gap-2.5 px-4 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-white">
            <HeartHandshake className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold text-ink-800">
              家庭安心管家
            </span>
            <span className="block text-[11px] text-ink-400">业务后台</span>
          </span>
        </Link>
        <div className="flex-1 overflow-y-auto scrollbar-thin">{nav}</div>
      </aside>
    </>
  );
}
