import Link from 'next/link';
import { FileText, Sparkles } from 'lucide-react';

import { Badge, Card, CardHeader, EmptyState, Table, Td } from '@/components/ui';
import { prisma } from '@/lib/db';
import { REPORT_GENERATION_LABELS, REPORT_STATUS_LABELS } from '@/lib/labels';
import { can, guardPage, householdScopeWhere } from '@/lib/permissions';
import { formatDate, formatDateTime } from '@/lib/utils';
import { listReports } from '@/services/report';
import { GenerateReportForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '安心报告' };

export default async function ReportsPage() {
  const user = await guardPage('report.read', { returnTo: '/admin/service/reports' });
  const scope = householdScopeWhere(user);

  const [reports, candidates] = await Promise.all([
    listReports(user),
    can(user, 'report.generate') && scope
      ? prisma.household.findMany({
          where: {
            AND: [
              scope,
              {
                tasks: {
                  some: {
                    deletedAt: null,
                    status: { in: ['PENDING_REVIEW', 'COMPLETED'] },
                    record: { isNot: null },
                  },
                },
              },
            ],
          },
          select: {
            id: true,
            name: true,
            householdCode: true,
            elders: { where: { deletedAt: null }, select: { id: true, name: true } },
          },
          orderBy: { householdCode: 'asc' },
        })
      : [],
  ]);

  const pendingReports = reports.filter((r) =>
    ['DRAFT', 'PENDING_REVIEW', 'REJECTED'].includes(r.status),
  );
  const doneReports = reports.filter((r) => ['APPROVED', 'PUBLISHED'].includes(r.status));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">家庭安心报告</h1>
        <p className="mt-1 text-sm text-ink-500">
          报告与原始记录是两回事。报告由原始记录汇总生成，必须经人工确认才能发布给家庭。
        </p>
      </div>

      {can(user, 'report.generate') ? (
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-600" />
                生成本周报告草稿
              </span>
            }
            subtitle="只汇总本周期内已提交的服务记录。没有记录时会直接拒绝生成，不允许凭空产生内容。"
          />
          <div className="px-5 py-4">
            {candidates.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-400">
                目前没有可生成报告的家庭（需要至少一条已提交的服务记录）。
              </p>
            ) : (
              <GenerateReportForm households={candidates} />
            )}
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader title="待人工确认" subtitle={`${pendingReports.length} 份`} />
        {pendingReports.length === 0 ? (
          <EmptyState icon={<FileText className="h-5 w-5" />} title="没有待确认的报告" />
        ) : (
          <Table head={['报告编号', '家庭', '长辈', '周期', '服务次数', '生成方式', '状态', '']}>
            {pendingReports.map((r) => (
              <tr key={r.id}>
                <Td className="font-mono text-[13px]">{r.reportNo}</Td>
                <Td>
                  <Link href={`/admin/households/${r.household.id}`} className="link">
                    {r.household.name}
                  </Link>
                </Td>
                <Td>{r.elder?.name ?? '—'}</Td>
                <Td className="whitespace-nowrap text-[13px]">
                  {formatDate(r.periodStart)} → {formatDate(r.periodEnd)}
                </Td>
                <Td className="text-[13px]">
                  上门 {r.visitCount} · 关怀 {r.phoneCareCount}
                </Td>
                <Td className="text-[13px]">
                  {REPORT_GENERATION_LABELS[r.generation]}
                  {r.aiGenerated ? (
                    <Badge tone="warm" className="ml-1.5">
                      AI 参与
                    </Badge>
                  ) : null}
                </Td>
                <Td>
                  <Badge tone={r.status === 'REJECTED' ? 'danger' : 'warm'}>
                    {REPORT_STATUS_LABELS[r.status]}
                  </Badge>
                </Td>
                <Td>
                  <Link href={`/admin/service/reports/${r.id}`} className="link text-[13px]">
                    审核并确认
                  </Link>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="已确认 / 已发布" />
        {doneReports.length === 0 ? (
          <EmptyState title="还没有已确认的报告" />
        ) : (
          <Table head={['报告编号', '家庭', '长辈', '周期', '确认人', '发布时间', '家庭是否已读']}>
            {doneReports.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link href={`/admin/service/reports/${r.id}`} className="link font-mono text-[13px]">
                    {r.reportNo}
                  </Link>
                </Td>
                <Td>{r.household.name}</Td>
                <Td>{r.elder?.name ?? '—'}</Td>
                <Td className="whitespace-nowrap text-[13px]">
                  {formatDate(r.periodStart)} → {formatDate(r.periodEnd)}
                </Td>
                <Td className="text-[13px]">{r.reviewedBy?.name ?? '—'}</Td>
                <Td className="whitespace-nowrap text-[13px]">
                  {r.publishedAt ? formatDateTime(r.publishedAt) : <Badge tone="info">待发布</Badge>}
                </Td>
                <Td>
                  {r.firstReadAt ? (
                    <Badge tone="brand">已读</Badge>
                  ) : r.publishedAt ? (
                    <Badge tone="neutral">未读</Badge>
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
