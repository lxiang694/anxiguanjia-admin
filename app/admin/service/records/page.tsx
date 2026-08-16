import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

import { Badge, Card, CardHeader, EmptyState, Table, Td } from '@/components/ui';
import { prisma } from '@/lib/db';
import { OBSERVATION_LABELS, SERVICE_TYPE_LABELS } from '@/lib/labels';
import { guardPage, taskScopeWhere } from '@/lib/permissions';
import { formatDateTime } from '@/lib/utils';
import { pendingReviewRecords } from '@/services/visit';

export const dynamic = 'force-dynamic';
export const metadata = { title: '服务记录' };

export default async function RecordsPage() {
  const user = await guardPage('visitRecord.read', { returnTo: '/admin/service/records' });

  const scope = taskScopeWhere(user);
  const [pending, recent] = await Promise.all([
    pendingReviewRecords(user).catch(() => []),
    scope
      ? prisma.visitRecord.findMany({
          where: { reviewedAt: { not: null }, task: scope },
          include: {
            task: {
              select: {
                taskNo: true,
                serviceType: true,
                scheduledStart: true,
                household: { select: { id: true, name: true } },
              },
            },
            elder: { select: { name: true } },
            staffProfile: { include: { user: { select: { name: true } } } },
          },
          orderBy: { submittedAt: 'desc' },
          take: 50,
        })
      : [],
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">服务记录</h1>
        <p className="mt-1 text-sm text-ink-500">
          这里是安心专员提交的原始记录。原始记录永久保留，更正只追加修订说明，不覆盖原文。
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="待审核" subtitle={`${pending.length} 条记录等待审核`} />
        {pending.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-5 w-5 text-brand-500" />}
            title="没有待审核的服务记录"
          />
        ) : (
          <Table head={['提交时间', '家庭', '长辈', '安心专员', '服务类型', '精神/饮食/睡眠/活动', '']}>
            {pending.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap text-[13px]">{formatDateTime(r.submittedAt)}</Td>
                <Td>
                  <Link href={`/admin/households/${r.task.household.id}`} className="link">
                    {r.task.household.name}
                  </Link>
                </Td>
                <Td>{r.elder?.name ?? '—'}</Td>
                <Td className="text-[13px]">{r.staffProfile.user.name}</Td>
                <Td className="text-[13px]">{SERVICE_TYPE_LABELS[r.task.serviceType]}</Td>
                <Td className="text-[13px]">
                  {[r.spiritLevel, r.dietLevel, r.sleepLevel, r.activityLevel]
                    .map((l) => OBSERVATION_LABELS[l])
                    .join(' / ')}
                </Td>
                <Td>
                  <Link href={`/admin/service/records/${r.id}`} className="link text-[13px]">
                    审核
                  </Link>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="已审核" subtitle="近 50 条" />
        {recent.length === 0 ? (
          <EmptyState title="还没有已审核的记录" />
        ) : (
          <Table head={['提交时间', '家庭', '长辈', '安心专员', '服务类型', '状态']}>
            {recent.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap text-[13px]">{formatDateTime(r.submittedAt)}</Td>
                <Td>
                  <Link href={`/admin/service/records/${r.id}`} className="link">
                    {r.task.household.name}
                  </Link>
                </Td>
                <Td>{r.elder?.name ?? '—'}</Td>
                <Td className="text-[13px]">{r.staffProfile.user.name}</Td>
                <Td className="text-[13px]">{SERVICE_TYPE_LABELS[r.task.serviceType]}</Td>
                <Td>
                  <Badge tone="brand">已审核</Badge>
                  {r.amendmentNote ? (
                    <Badge tone="warm" className="ml-1.5">
                      有修订说明
                    </Badge>
                  ) : null}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
