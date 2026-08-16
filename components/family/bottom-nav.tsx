'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileHeart, HeartHandshake, CalendarHeart, UserRound } from 'lucide-react';

import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/family', label: '爸妈', icon: HeartHandshake, exact: true },
  { href: '/family/service', label: '服务', icon: CalendarHeart },
  { href: '/family/reports', label: '报告', icon: FileHeart },
  { href: '/family/me', label: '我的', icon: UserRound },
];

export function FamilyBottomNav() {
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
                  'flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition',
                  active ? 'text-brand-700' : 'text-ink-400',
                )}
              >
                <Icon className={cn('h-[22px] w-[22px]', active ? 'stroke-[2.2]' : '')} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
