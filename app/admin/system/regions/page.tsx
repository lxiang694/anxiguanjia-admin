import { Badge, Card, CardHeader, EmptyState } from '@/components/ui';
import { prisma } from '@/lib/db';
import { guardPage } from '@/lib/permissions';

export const dynamic = 'force-dynamic';
export const metadata = { title: '城市与区域' };

export default async function RegionsPage() {
  await guardPage('system.settings', { returnTo: '/admin/system/regions' });

  const cities = await prisma.city.findMany({
    include: {
      districts: {
        include: { _count: { select: { households: true, staffProfile: true } } },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">城市与区域</h1>
        <p className="mt-1 text-sm text-ink-500">
          首个运营城市为长沙。数据模型从第一版就按多城市设计，但第一版不做加盟或跨城调度。
        </p>
      </div>

      {cities.length === 0 ? (
        <Card>
          <EmptyState title="还没有配置城市" />
        </Card>
      ) : (
        cities.map((c) => (
          <Card key={c.id}>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  {c.name}
                  <span className="text-[13px] font-normal text-ink-500">{c.province}</span>
                  {c.isActive ? <Badge tone="brand">运营中</Badge> : <Badge tone="neutral">未开通</Badge>}
                </span>
              }
              subtitle={`${c.districts.length} 个区域`}
            />
            <ul className="divide-y divide-cream-100 px-5">
              {c.districts.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-ink-800">{d.name}</span>
                  <span className="text-[13px] tabular-nums text-ink-500">
                    {d._count.households} 个家庭 · {d._count.staffProfile} 名安心专员
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
