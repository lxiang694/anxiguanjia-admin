import Link from 'next/link';

import { Card, CardHeader, EmptyState, Table, Td } from '@/components/ui';
import { prisma } from '@/lib/db';
import { guardPage } from '@/lib/permissions';
import { formatDate, pct } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: '服务表现' };

export default async function PerformancePage() {
  await guardPage('staff.performance.read', { returnTo: '/admin/staff/performance' });

  const snapshots = await prisma.staffPerformanceSnapshot.findMany({
    include: { staffProfile: { include: { user: { select: { name: true } } } } },
    orderBy: [{ periodStart: 'desc' }],
    take: 200,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">服务表现</h1>
        <p className="mt-1 text-sm text-ink-500">
          我们衡量服务质量，不做单量排行榜 —— 刻意不提供「接单最多」这类排序，避免鼓励抢单。
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="绩效快照" subtitle={`共 ${snapshots.length} 条`} />
        {snapshots.length === 0 ? (
          <EmptyState
            title="还没有绩效快照"
            description="绩效按统计周期生成快照，避免每次打开页面都重算历史数据。"
          />
        ) : (
          <Table
            head={['成员', '统计期间', '准时率', '完成率', '记录及时率', '报告质量', '家庭评价', '投诉', '培训完成率', '固定家庭续约']}
          >
            {snapshots.map((s) => (
              <tr key={s.id}>
                <Td>
                  <Link href={`/admin/staff/${s.staffProfileId}`} className="link font-medium">
                    {s.staffProfile.user.name}
                  </Link>
                </Td>
                <Td className="whitespace-nowrap text-[13px]">
                  {formatDate(s.periodStart)} → {formatDate(s.periodEnd)}
                </Td>
                <Td className="text-[13px] tabular-nums">{pct(s.onTimeRate)}</Td>
                <Td className="text-[13px] tabular-nums">{pct(s.completionRate)}</Td>
                <Td className="text-[13px] tabular-nums">{pct(s.recordTimelyRate)}</Td>
                <Td className="text-[13px] tabular-nums">{s.reportQualityScore?.toFixed(1) ?? '—'}</Td>
                <Td className="text-[13px] tabular-nums">{s.familyRatingAvg?.toFixed(1) ?? '—'}</Td>
                <Td className="text-[13px] tabular-nums">{s.complaintCount}</Td>
                <Td className="text-[13px] tabular-nums">{pct(s.trainingCompletion)}</Td>
                <Td className="text-[13px] tabular-nums">{s.retainedHouseholds}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
