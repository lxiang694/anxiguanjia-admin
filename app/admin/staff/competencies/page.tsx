import { Badge, Card, CardHeader, EmptyState, Table, Td } from '@/components/ui';
import { prisma } from '@/lib/db';
import { SERVICE_TYPE_LABELS } from '@/lib/labels';
import { guardPage } from '@/lib/permissions';
import { EditCompetencyForm, NewCompetencyForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '能力标签' };

export default async function CompetenciesPage() {
  await guardPage('staff.competency.manage', { returnTo: '/admin/staff/competencies' });

  const competencies = await prisma.competency.findMany({
    include: { _count: { select: { staffLinks: true } } },
    orderBy: [{ requiresCredential: 'desc' }, { name: 'asc' }],
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">能力标签</h1>
        <p className="mt-1 text-sm text-ink-500">
          标记为「涉及法定资格」的能力，公司内部培训不足以满足派单条件，必须另有已核验的外部资格凭证。
        </p>
      </div>

      <NewCompetencyForm />

      <Card className="overflow-hidden">
        <CardHeader title="能力字典" subtitle={`共 ${competencies.length} 项`} />
        {competencies.length === 0 ? (
          <EmptyState title="还没有能力标签" />
        ) : (
          <Table head={['能力名称', '代码', '说明', '涉及法定资格', '作为派单前置条件的服务类型', '已认定人数', '']}>
            {competencies.map((c) => (
              <tr key={c.id}>
                <Td className="font-medium">{c.name}</Td>
                <Td className="font-mono text-[13px] text-ink-500">{c.code}</Td>
                <Td className="max-w-[18rem] text-[13px]">{c.description ?? '—'}</Td>
                <Td>
                  {c.requiresCredential ? (
                    <Badge tone="warm">需法定资格凭证</Badge>
                  ) : (
                    <Badge tone="neutral">公司内部认定</Badge>
                  )}
                </Td>
                <Td className="text-[13px]">
                  {c.requiredForServices.length === 0
                    ? '—'
                    : c.requiredForServices.map((s) => SERVICE_TYPE_LABELS[s]).join('、')}
                </Td>
                <Td className="text-[13px] tabular-nums">{c._count.staffLinks}</Td>
                <Td>
                  <EditCompetencyForm
                    competency={{
                      id: c.id,
                      name: c.name,
                      code: c.code,
                      description: c.description,
                      requiresCredential: c.requiresCredential,
                      requiredForServices: c.requiredForServices,
                      isActive: c.isActive,
                    }}
                  />
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
