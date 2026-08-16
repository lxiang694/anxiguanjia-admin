import Link from 'next/link';
import { CalendarPlus, CheckCircle2 } from 'lucide-react';

import { Badge, Card, CardHeader, EmptyState } from '@/components/ui';
import { prisma } from '@/lib/db';
import { SERVICE_TYPE_LABELS } from '@/lib/labels';
import { guardPage, householdScopeWhere } from '@/lib/permissions';
import { formatDateTime } from '@/lib/utils';
import { pendingAssignTasks } from '@/services/scheduling';
import { AssignForm, NewTaskForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '排班与派单' };

export default async function DispatchPage() {
  const user = await guardPage('task.assign', { returnTo: '/admin/service/dispatch' });
  const scope = householdScopeWhere(user);

  const [pending, households, staff] = await Promise.all([
    pendingAssignTasks(user),
    scope
      ? prisma.household.findMany({
          where: {
            AND: [scope, { status: { in: ['TRIAL', 'ACTIVE_MEMBER', 'RENEWAL_DUE', 'PENDING_ASSESSMENT'] } }],
          },
          select: {
            id: true,
            name: true,
            householdCode: true,
            primarySpecialistId: true,
            backupSpecialistId: true,
            elders: { where: { deletedAt: null }, select: { id: true, name: true } },
            servicePlan: { select: { preferredWeekday: true, preferredWindow: true } },
          },
          orderBy: { householdCode: 'asc' },
        })
      : [],
    prisma.staffProfile.findMany({
      where: { serviceStatus: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        employeeCode: true,
        staffLevel: true,
        user: { select: { name: true } },
        district: { select: { name: true } },
      },
      orderBy: { employeeCode: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">排班与派单</h1>
        <p className="mt-1 text-sm text-ink-500">
          正常情况优先安排固定家庭安心专员。固定专员不可用时系统会尝试备用专员，并自动通知家庭。
        </p>
      </div>

      {staff.length === 0 ? (
        <Card>
          <EmptyState
            title="目前没有可排班的安心专员"
            description="只有服务状态为「可排班」且已通过必修培训、具备对应能力的成员才能被派单。请先到「安心专员」页完成上岗流程。"
          />
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        {/* 新建任务 */}
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <CalendarPlus className="h-4 w-4 text-brand-600" />
                安排一次服务
              </span>
            }
            subtitle="不指定专员时，系统会默认派给该家庭的固定安心专员。"
          />
          <div className="px-5 py-4">
            {households.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-400">
                还没有可排班的家庭。请先建立家庭与长辈档案。
              </p>
            ) : (
              <NewTaskForm households={households} staff={staff} />
            )}
          </div>
        </Card>

        {/* 待派单队列 */}
        <Card className="overflow-hidden">
          <CardHeader title="待派单" subtitle={`${pending.length} 项任务还没有指派安心专员`} />
          {pending.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5 text-brand-500" />}
              title="没有待派单的任务"
              description="所有已安排的服务都已经指派到具体的安心专员。"
            />
          ) : (
            <ul className="divide-y divide-cream-200">
              {pending.map((t) => (
                <li key={t.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-800">
                        <Link href={`/admin/households/${t.household.id}`} className="hover:text-brand-700">
                          {t.household.name}
                        </Link>
                        <span className="ml-2 font-normal text-ink-500">
                          {t.elder?.name ?? '未指定长辈'}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[13px] text-ink-500">
                        {SERVICE_TYPE_LABELS[t.serviceType]} · {formatDateTime(t.scheduledStart)}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-ink-400">
                        {t.taskNo}
                        {t.household.district ? ` · ${t.household.district.name}` : ''}
                      </p>
                      {t.household.primarySpecialistId ? (
                        <Badge tone="brand" className="mt-1.5">
                          该家庭有固定专员
                        </Badge>
                      ) : (
                        <Badge tone="warm" className="mt-1.5">
                          该家庭尚未指派固定专员
                        </Badge>
                      )}
                    </div>
                    <AssignForm taskId={t.id} staff={staff} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
