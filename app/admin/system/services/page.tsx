import { Badge, Card, CardHeader, NonMedicalNotice } from '@/components/ui';
import { SERVICE_TYPE_LABELS } from '@/lib/labels';
import { guardPage } from '@/lib/permissions';
import { listServiceCatalog } from '@/services/settings';
import { CatalogForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '服务类型与价格' };

const ALL_TYPES = Object.keys(SERVICE_TYPE_LABELS) as (keyof typeof SERVICE_TYPE_LABELS)[];

export default async function ServiceCatalogPage() {
  await guardPage('system.settings', { returnTo: '/admin/system/services' });
  const items = await listServiceCatalog();
  const byType = new Map(items.map((i) => [i.serviceType, i]));

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">服务类型与价格</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-500">
          服务类型本身是固定的（这样派单能力校验才有确定的对应关系），但
          <strong>对外名称、默认时长、增值服务单价、是否开放家庭端申请</strong>
          都在这里配置，不写死在代码里。
        </p>
      </div>

      <Card>
        <CardHeader title="一条重要的联动" />
        <ul className="list-disc space-y-1.5 px-5 py-4 pl-9 text-[13px] leading-relaxed text-ink-600">
          <li>
            勾选「开放家庭端申请」的服务，会出现在家庭端的「申请额外服务」里；必须先设单价，
            否则家庭看不到价钱。
          </li>
          <li>
            勾选「需要对应能力」时，派单会校验专员是否具备该服务对应的能力标签
            —— 涉及法定资格的能力还需另有已核验凭证。
          </li>
          <li>改价不会影响已有订阅的成交价，成交价保存在每个订阅上。</li>
        </ul>
      </Card>

      <div className="space-y-4">
        {ALL_TYPES.map((t) => {
          const item = byType.get(t);
          return (
            <Card key={t}>
              <CardHeader
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {SERVICE_TYPE_LABELS[t]}
                    <span className="font-mono text-xs font-normal text-ink-400">{t}</span>
                    {item?.isActive ? (
                      <Badge tone="brand">启用</Badge>
                    ) : item ? (
                      <Badge tone="neutral">停用</Badge>
                    ) : (
                      <Badge tone="warm">未配置</Badge>
                    )}
                    {item?.familyRequestable ? <Badge tone="info">家庭端可申请</Badge> : null}
                  </span>
                }
                subtitle={item?.description ?? undefined}
              />
              <div className="px-5 py-4">
                <CatalogForm
                  serviceType={t}
                  current={
                    item
                      ? {
                          displayName: item.displayName,
                          description: item.description,
                          defaultMinutes: item.defaultMinutes,
                          addOnPrice: item.addOnPrice,
                          familyRequestable: item.familyRequestable,
                          requiresCompetency: item.requiresCompetency,
                          isActive: item.isActive,
                          sortOrder: item.sortOrder,
                        }
                      : null
                  }
                  defaultLabel={SERVICE_TYPE_LABELS[t]}
                />
              </div>
            </Card>
          );
        })}
      </div>

      <NonMedicalNotice />
    </div>
  );
}
