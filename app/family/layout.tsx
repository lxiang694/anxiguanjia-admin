import { FamilyBottomNav } from '@/components/family/bottom-nav';
import { DemoBanner } from '@/components/ui';
import { guardPortal } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/**
 * 家庭端。
 *
 * 这一端的设计目标只有一个：让付费子女打开时第一感受不是「我买了多少订单」，
 * 而是「爸妈最近过得怎么样」。所以底色更暖、字号更大、信息更少。
 */
export default async function FamilyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await guardPortal('family');

  return (
    <div className="portal-family min-h-screen bg-cream-100">
      <DemoBanner />
      <div className="mx-auto max-w-lg pb-24">{children}</div>
      <FamilyBottomNav />
    </div>
  );
}
