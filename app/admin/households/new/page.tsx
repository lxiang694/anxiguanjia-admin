import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Card, CardHeader } from '@/components/ui';
import { prisma } from '@/lib/db';
import { guardPage } from '@/lib/permissions';
import { NewHouseholdForm } from './form';

export const dynamic = 'force-dynamic';
export const metadata = { title: '新建家庭' };

export default async function NewHouseholdPage() {
  const user = await guardPage('household.create', { returnTo: '/admin/households/new' });

  const [cities, consultants] = await Promise.all([
    prisma.city.findMany({
      where: {
        isActive: true,
        ...(user.cityId && (user.role === 'CITY_LEAD' || user.role === 'AREA_MANAGER')
          ? { id: user.cityId }
          : {}),
      },
      include: { districts: { orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { role: 'FAMILY_CONSULTANT', status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          href="/admin/households"
          className="inline-flex items-center gap-1 text-[13px] text-ink-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          家庭列表
        </Link>
        <h1 className="mt-2.5 text-xl font-semibold text-ink-800">新建家庭</h1>
        <p className="mt-1 text-sm text-ink-500">
          先建立家庭，再依次完成：长辈安心档案 → 家庭成员 → 授权 → 家庭安心评估 → 服务方案。
        </p>
      </div>

      <Card>
        <CardHeader title="家庭基本信息" subtitle="家庭编号会在保存时自动生成（例：CS-000018）。" />
        <div className="px-5 py-4">
          <NewHouseholdForm cities={cities} consultants={consultants} />
        </div>
      </Card>
    </div>
  );
}
