import Link from 'next/link';

export const TAB_KEYS = [
  'overview',
  'elders',
  'members',
  'staff',
  'consents',
  'plan',
  'tasks',
  'reports',
  'incidents',
  'orders',
  'timeline',
  'internal',
] as const;

export type TabKey = (typeof TAB_KEYS)[number];

const TAB_LABELS: Record<TabKey, string> = {
  overview: '概览',
  elders: '长辈',
  members: '家庭成员',
  staff: '安心专员',
  consents: '授权',
  plan: '服务方案',
  tasks: '服务记录',
  reports: '安心报告',
  incidents: '事件',
  orders: '订单',
  timeline: '时间线',
  internal: '内部备注',
};

/** Household 360° 的 Tab 导航。用 URL query 驱动，刷新与分享链接都能保持位置。 */
export function HouseholdTabs({
  householdId,
  active,
}: {
  householdId: string;
  active: TabKey;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 scrollbar-thin lg:mx-0 lg:px-0">
      <div className="flex min-w-max gap-1 border-b border-cream-300">
        {TAB_KEYS.map((key) => {
          const isActive = key === active;
          return (
            <Link
              key={key}
              href={`/admin/households/${householdId}?tab=${key}`}
              className={
                isActive
                  ? 'border-b-2 border-brand-600 px-3 py-2.5 text-[13.5px] font-medium text-brand-700'
                  : 'border-b-2 border-transparent px-3 py-2.5 text-[13.5px] text-ink-500 transition hover:text-ink-800'
              }
            >
              {TAB_LABELS[key]}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
