import Link from 'next/link';
import { Users } from 'lucide-react';

import type { ServiceStatus } from '@prisma/client';

import { Badge, Card, CardHeader, EmptyState, Table, Td, UnverifiedHint } from '@/components/ui';
import {
  EMPLOYMENT_STATUS_LABELS,
  SERVICE_STATUS_LABELS,
  STAFF_LEVEL_LABELS,
} from '@/lib/labels';
import { guardPage } from '@/lib/permissions';
import { maskPhone } from '@/lib/utils';
import { listStaff } from '@/services/staff';

export const dynamic = 'force-dynamic';
export const metadata = { title: '安心专员' };

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await guardPage('staff.read', { returnTo: '/admin/staff' });
  const sp = await searchParams;

  const staff = await listStaff(user, {
    q: sp.q,
    serviceStatus: (sp.status as ServiceStatus | 'ALL' | undefined) ?? 'ALL',
  });

  const active = staff.filter((s) => s.serviceStatus === 'ACTIVE');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">家庭安心专员</h1>
        <p className="mt-1 text-sm text-ink-500">
          只有服务状态为「可排班」、且通过必修培训与能力要求的成员才能被派单。共 {staff.length} 人，
          其中 {active.length} 人可排班。
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="专员列表"
          subtitle="学历未核验时不会显示「已认证」；涉及法定资格的能力必须另有已核验凭证。"
        />
        {staff.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="还没有安心专员档案"
            description="人员档案由人事或服务督导建立，经培训与考核后开放排班。"
          />
        ) : (
          <Table
            head={['姓名', '员工编号', '职级', '服务区域', '专业背景', '能力标签', '在职状态', '服务状态', '固定服务家庭']}
          >
            {staff.map((s) => (
              <tr key={s.id}>
                <Td>
                  <Link href={`/admin/staff/${s.id}`} className="link font-medium">
                    {s.user.name}
                  </Link>
                  <span className="mt-0.5 block text-xs text-ink-400">
                    {maskPhone(s.user.phone)}
                  </span>
                </Td>
                <Td className="font-mono text-[13px]">{s.employeeCode}</Td>
                <Td className="text-[13px]">{STAFF_LEVEL_LABELS[s.staffLevel]}</Td>
                <Td className="text-[13px]">{s.district?.name ?? '—'}</Td>
                <Td className="text-[13px]">
                  {s.educations.length === 0 ? (
                    <span className="text-ink-400">未登记</span>
                  ) : (
                    <div className="space-y-1">
                      {s.educations.map((e) => (
                        <div key={e.id}>
                          <span className="text-ink-700">
                            {e.school} · {e.major}
                          </span>
                          {e.verificationStatus === 'VERIFIED' ? (
                            <Badge tone="brand" className="ml-1.5">
                              已核验
                            </Badge>
                          ) : (
                            <span className="ml-1.5 inline-block">
                              <UnverifiedHint label="学历" />
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Td>
                <Td>
                  <div className="flex max-w-[12rem] flex-wrap gap-1">
                    {s.competencies.length === 0 ? (
                      <span className="text-[13px] text-ink-400">—</span>
                    ) : (
                      s.competencies.map((c) => (
                        <Badge
                          key={c.id}
                          tone={
                            c.competency.requiresCredential && c.credentialStatus !== 'VERIFIED'
                              ? 'warm'
                              : 'neutral'
                          }
                        >
                          {c.competency.name}
                        </Badge>
                      ))
                    )}
                  </div>
                </Td>
                <Td className="text-[13px]">{EMPLOYMENT_STATUS_LABELS[s.employmentStatus]}</Td>
                <Td>
                  <Badge
                    tone={
                      s.serviceStatus === 'ACTIVE'
                        ? 'brand'
                        : s.serviceStatus === 'SUSPENDED' || s.serviceStatus === 'OFFBOARDED'
                          ? 'danger'
                          : 'warm'
                    }
                  >
                    {SERVICE_STATUS_LABELS[s.serviceStatus]}
                  </Badge>
                </Td>
                <Td className="text-[13px] tabular-nums">
                  固定 {s._count.primaryFor} · 备用 {s._count.backupFor}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
