import { Badge, Card, CardHeader, EmptyState, Table, Td } from '@/components/ui';
import { prisma } from '@/lib/db';
import { ROLE_LABELS } from '@/lib/labels';
import { guardPage } from '@/lib/permissions';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: '操作日志' };

/** 敏感动作以醒目样式标出，方便合规复查 */
const SENSITIVE = new Set([
  'VIEW_SENSITIVE_HEALTH',
  'UPDATE_SENSITIVE_HEALTH',
  'GRANT_CONSENT',
  'REVOKE_CONSENT',
  'EXPORT',
  'REFUND',
  'PERMISSION_DENIED',
  'LOGIN_FAILED',
]);

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; resource?: string }>;
}) {
  await guardPage('system.audit', { returnTo: '/admin/system/audit' });
  const sp = await searchParams;

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(sp.action ? { action: sp.action } : {}),
      ...(sp.resource ? { resource: sp.resource } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">操作日志</h1>
        <p className="mt-1 text-sm text-ink-500">
          登录、查看敏感信息、修改长辈档案、修改授权、审核报告、退款等操作全部留痕。
          日志会冗余保存操作人姓名与角色，人员离职后记录仍可读。
        </p>
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label" htmlFor="action">
            动作
          </label>
          <input
            id="action"
            name="action"
            defaultValue={sp.action ?? ''}
            placeholder="例：VIEW_SENSITIVE_HEALTH"
            className="field w-64 font-mono text-[13px]"
          />
        </div>
        <div>
          <label className="label" htmlFor="resource">
            资源
          </label>
          <input
            id="resource"
            name="resource"
            defaultValue={sp.resource ?? ''}
            placeholder="例：Elder"
            className="field w-40 font-mono text-[13px]"
          />
        </div>
        <button
          type="submit"
          className="h-10 rounded-lg border border-cream-400 bg-white px-4 text-sm text-ink-700 hover:border-brand-300"
        >
          筛选
        </button>
      </form>

      <Card className="overflow-hidden">
        <CardHeader title="日志" subtitle={`近 ${logs.length} 条`} />
        {logs.length === 0 ? (
          <EmptyState title="没有符合条件的日志" />
        ) : (
          <Table head={['时间', '操作人', '角色', '动作', '资源', '资源 ID', '权限判定', 'IP']}>
            {logs.map((l) => (
              <tr key={l.id} className={SENSITIVE.has(l.action) ? 'bg-warm-50/50' : undefined}>
                <Td className="whitespace-nowrap text-[13px]">{formatDateTime(l.createdAt)}</Td>
                <Td className="text-[13px]">{l.actorName ?? '—'}</Td>
                <Td className="text-[13px]">{l.actorRole ? ROLE_LABELS[l.actorRole] : '—'}</Td>
                <Td>
                  <span className="font-mono text-[12px]">{l.action}</span>
                  {SENSITIVE.has(l.action) ? (
                    <Badge tone="warm" className="ml-1.5">
                      敏感
                    </Badge>
                  ) : null}
                </Td>
                <Td className="font-mono text-[12px]">{l.resource}</Td>
                <Td className="max-w-[10rem] truncate font-mono text-[11px] text-ink-400">
                  {l.resourceId ?? '—'}
                </Td>
                <Td className="max-w-[16rem] text-[12px] text-ink-500">{l.permissionNote ?? '—'}</Td>
                <Td className="font-mono text-[11px] text-ink-400">{l.ipAddress ?? '—'}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
