import { Badge, Card, CardHeader, EmptyState, Table, Td } from '@/components/ui';
import { PLAN_TIER_LABELS, SERVICE_TYPE_LABELS } from '@/lib/labels';
import { can, guardPage } from '@/lib/permissions';
import { formatMoneyCNY } from '@/lib/utils';
import { listAllPlans } from '@/services/subscription';
import { EditPlanForm, NewPlanForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '服务方案' };

export default async function PlansPage() {
  const user = await guardPage('plan.read', { returnTo: '/admin/billing/plans' });
  const plans = await listAllPlans(user);
  const editable = can(user, 'plan.manage');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">服务方案</h1>
        <p className="mt-1 text-sm text-ink-500">
          套餐是商业产品，权益配置全部存在数据库里、可由后台编辑；代码中没有写死任何套餐内容。
          真正执行的是每个家庭的「家庭执行计划」。
        </p>
      </div>

      {editable ? <NewPlanForm /> : null}

      <Card className="overflow-hidden">
        <CardHeader title="方案列表" />
        {plans.length === 0 ? (
          <EmptyState title="还没有服务方案" />
        ) : (
          <Table head={['方案', '档位', '月费', '每月探访', '每月关怀', '每月报告', '包含服务', '订阅数', '状态', '']}>
            {plans.map((p) => (
              <tr key={p.id}>
                <Td>
                  <span className="font-medium text-ink-800">{p.name}</span>
                  <span className="mt-0.5 block font-mono text-xs text-ink-400">{p.code}</span>
                </Td>
                <Td className="text-[13px]">{PLAN_TIER_LABELS[p.tier]}</Td>
                <Td className="tabular-nums font-medium">{formatMoneyCNY(p.monthlyPrice)}</Td>
                <Td className="text-[13px] tabular-nums">{p.visitsPerMonth} 次</Td>
                <Td className="text-[13px] tabular-nums">{p.phoneCarePerMonth} 次</Td>
                <Td className="text-[13px] tabular-nums">{p.reportsPerMonth} 份</Td>
                <Td className="max-w-[14rem] text-[13px]">
                  {p.includedServices.map((s) => SERVICE_TYPE_LABELS[s]).join('、') || '—'}
                </Td>
                <Td className="text-[13px] tabular-nums">{p._count.subscriptions}</Td>
                <Td>
                  {p.isActive ? <Badge tone="brand">在售</Badge> : <Badge tone="neutral">下架</Badge>}
                </Td>
                <Td>
                  {editable ? (
                    <EditPlanForm
                      plan={{
                        id: p.id,
                        code: p.code,
                        name: p.name,
                        tier: p.tier,
                        description: p.description,
                        monthlyPrice: p.monthlyPrice,
                        visitsPerMonth: p.visitsPerMonth,
                        phoneCarePerMonth: p.phoneCarePerMonth,
                        reportsPerMonth: p.reportsPerMonth,
                        includedServices: p.includedServices,
                        isActive: p.isActive,
                        sortOrder: p.sortOrder,
                        subscriptionCount: p._count.subscriptions,
                      }}
                    />
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
