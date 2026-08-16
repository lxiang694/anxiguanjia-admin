import Link from 'next/link';
import { ArrowLeft, LifeBuoy, Phone } from 'lucide-react';

import { Card, CardHeader } from '@/components/ui';
import { prisma } from '@/lib/db';
import { guardPortal } from '@/lib/permissions';
import { HelpForm } from './form';

export const dynamic = 'force-dynamic';
export const metadata = { title: '需要协助' };

/**
 * 「需要协助」上报页。
 *
 * 这是一线成员最重要的安全阀：遇到无法自行判断的情况时，
 * 不应该自己决定怎么处理，而是立刻上报由服务督导接手。
 */
export default async function StaffHelpPage() {
  const user = await guardPortal('staff');

  // 只列出该专员当前有服务关系的家庭 —— 不允许对无关家庭上报
  const households = user.staffProfileId
    ? await prisma.household.findMany({
        where: {
          deletedAt: null,
          OR: [
            { primarySpecialistId: user.staffProfileId },
            { backupSpecialistId: user.staffProfileId },
            { tasks: { some: { staffProfileId: user.staffProfileId } } },
          ],
        },
        select: {
          id: true,
          name: true,
          elders: { where: { deletedAt: null }, select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
      })
    : [];

  const todayTasks = user.staffProfileId
    ? await prisma.serviceTask.findMany({
        where: {
          staffProfileId: user.staffProfileId,
          deletedAt: null,
          status: { in: ['ACCEPTED', 'READY_TO_DEPART', 'ARRIVED', 'IN_SERVICE', 'PENDING_RECORD'] },
        },
        select: {
          id: true,
          taskNo: true,
          householdId: true,
          elderId: true,
          household: { select: { name: true } },
        },
        orderBy: { scheduledStart: 'asc' },
      })
    : [];

  return (
    <div className="px-4 py-5">
      <Link
        href="/staff"
        className="inline-flex items-center gap-1 text-[13px] text-ink-500 active:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </Link>

      <header className="mt-3">
        <h1 className="flex items-center gap-2 text-[22px] font-semibold text-ink-800">
          <LifeBuoy className="h-6 w-6 text-danger-600" />
          需要协助
        </h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-600">
          遇到无法联系长辈、长辈表示身体不适、跌倒等情况，请立刻上报。
          <strong className="text-ink-800">不要自己判断该怎么处理。</strong>
        </p>
      </header>

      <div className="mt-4 rounded-card border border-danger-100 bg-danger-50 px-4 py-3.5">
        <p className="text-sm font-semibold text-danger-700">如果情况紧急，先打急救电话</p>
        <a
          href="tel:120"
          className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-danger-600 py-3 text-[17px] font-semibold text-white active:bg-danger-700"
        >
          <Phone className="h-5 w-5" />
          拨打 120
        </a>
        <p className="mt-2 text-[13px] leading-relaxed text-danger-600">
          先处理眼前的安全，再回来填这张表。上报同样重要，但生命安全优先。
        </p>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="上报情况"
          subtitle="提交后服务督导会立刻收到通知并接手处理，您会在「消息」里看到后续进展。"
        />
        <div className="px-4 py-4">
          {households.length === 0 ? (
            <p className="py-4 text-center text-[14px] text-ink-400">
              您目前没有服务中的家庭，无法上报。如需帮助请直接联系服务督导。
            </p>
          ) : (
            <HelpForm households={households} activeTasks={todayTasks} />
          )}
        </div>
      </Card>
    </div>
  );
}
