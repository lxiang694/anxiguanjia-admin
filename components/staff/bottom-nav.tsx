'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, CalendarDays, ListChecks, UserRound } from 'lucide-react';

import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/staff', label: '今天', icon: CalendarDays, exact: true },
  { href: '/staff/tasks', label: '任务', icon: ListChecks },
  { href: '/staff/messages', label: '消息', icon: Bell, badge: true },
  { href: '/staff/me', label: '我的', icon: UserRound },
];

export function StaffBottomNav({ unread }: { unread: number }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-cream-300 bg-white/95 backdrop-blur pb-safe">
      <ul className="mx-auto flex max-w-lg">
        {ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition',
                  active ? 'text-brand-700' : 'text-ink-400',
                )}
              >
                <Icon className={cn('h-[22px] w-[22px]', active ? 'stroke-[2.2]' : '')} />
                {item.label}
                {item.badge && unread > 0 ? (
                  <span className="absolute right-[calc(50%-1.4rem)] top-1.5 min-w-[1rem] rounded-pill bg-warm-400 px-1 text-[10px] font-semibold leading-4 text-white">
                    {unread > 99 ? '99+' : unread}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
