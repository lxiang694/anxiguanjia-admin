import { Fragment } from 'react';

import { Badge, Card, CardHeader } from '@/components/ui';
import { ROLE_LABELS } from '@/lib/labels';
import { CAPABILITIES, ROLE_CAPABILITIES, guardPage } from '@/lib/permissions';

export const dynamic = 'force-dynamic';
export const metadata = { title: '角色权限' };

const ROLE_ORDER = Object.keys(ROLE_LABELS) as (keyof typeof ROLE_LABELS)[];

/** 能力分组，方便阅读 */
function groupOf(cap: string): string {
  const [head] = cap.split('.');
  const map: Record<string, string> = {
    household: '家庭',
    elder: '长辈档案',
    familyMember: '家庭成员',
    consent: '授权',
    staff: '安心专员',
    task: '排班派单',
    visitRecord: '服务记录',
    incident: '异常事件',
    report: '安心报告',
    plan: '会员方案',
    subscription: '订阅',
    order: '订单',
    invoice: '发票',
    feedback: '客服',
    dashboard: '数据看板',
    system: '系统',
    family: '家庭端',
  };
  return map[head] ?? head;
}

export default async function RolesPage() {
  await guardPage('system.roles', { returnTo: '/admin/system/roles' });

  const groups = new Map<string, string[]>();
  for (const cap of CAPABILITIES) {
    const g = groupOf(cap);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(cap);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">角色权限</h1>
        <p className="mt-1 text-sm text-ink-500">
          权限由两个独立维度共同决定：<strong>能力</strong>（能不能做这类动作）×{' '}
          <strong>数据范围</strong>（这条数据是不是他该看的）。本页展示第一个维度；数据范围规则见
          「隐私与授权」。
        </p>
        <p className="mt-2 rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-xs leading-relaxed text-ink-500">
          第一版权限矩阵在代码中集中定义（lib/permissions/capabilities.ts），本页为只读展示。
          这样做是为了避免有人在界面上误改权限而无法审计；后续版本会加入带审批与版本记录的可编辑角色。
        </p>
      </div>

      <Card className="overflow-x-auto scrollbar-thin">
        <CardHeader title="能力矩阵" subtitle="✓ 表示该角色具备此能力" />
        <table className="w-full min-w-[64rem] text-sm">
          <thead>
            <tr className="border-b border-cream-300 bg-cream-50">
              <th className="sticky left-0 z-10 bg-cream-50 px-4 py-2.5 text-left text-[13px] font-medium text-ink-500">
                能力
              </th>
              {ROLE_ORDER.map((r) => (
                <th
                  key={r}
                  className="px-2 py-2.5 text-center text-[11px] font-medium leading-tight text-ink-500"
                >
                  {ROLE_LABELS[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(groups.entries()).map(([group, caps]) => (
              <Fragment key={group}>
                <tr className="bg-cream-100">
                  <td
                    colSpan={ROLE_ORDER.length + 1}
                    className="px-4 py-1.5 text-[12px] font-semibold text-ink-600"
                  >
                    {group}
                  </td>
                </tr>
                {caps.map((cap) => (
                  <tr key={cap} className="border-b border-cream-100">
                    <td className="sticky left-0 z-10 bg-white px-4 py-2 font-mono text-[12px] text-ink-600">
                      {cap}
                    </td>
                    {ROLE_ORDER.map((r) => {
                      const has = ROLE_CAPABILITIES[r].includes(cap as never);
                      return (
                        <td key={r} className="px-2 py-2 text-center">
                          {has ? (
                            <span className="text-brand-600">✓</span>
                          ) : (
                            <span className="text-ink-200">·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHeader title="几条刻意的设计" />
        <ul className="space-y-2 px-5 py-4 text-[13px] leading-relaxed text-ink-600">
          <li>
            <Badge tone="warm">财务</Badge> 可以看订单与订阅，但不具备 elder.read 之外的任何长辈数据能力，
            也没有 visitRecord.read —— 财务不需要看长辈的生活记录。
          </li>
          <li>
            <Badge tone="warm">运营</Badge> 拥有日常业务全流程能力，但没有 system.* —— 普通运营无法访问
            超级管理员的系统配置与操作日志。
          </li>
          <li>
            <Badge tone="warm">一线安心专员</Badge> 没有 elder.sensitive.read，
            即使被派到该家庭也看不到慢性病与用药资料。
          </li>
          <li>
            <Badge tone="warm">人事</Badge> 只有 staff.* 能力，数据范围里也完全不返回家庭数据。
          </li>
          <li>
            <Badge tone="warm">家庭成员</Badge> 只有 family.portal，
            其可见内容再由 Consent 授权逐项决定。
          </li>
        </ul>
      </Card>
    </div>
  );
}
