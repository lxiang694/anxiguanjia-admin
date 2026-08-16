import { CalendarHeart, Clock, Lock } from 'lucide-react';

import { Badge, Card, CardHeader, EmptyState } from '@/components/ui';
import { SERVICE_TYPE_LABELS, TASK_STATUS_LABELS } from '@/lib/labels';
import { guardPortal } from '@/lib/permissions';
import { formatFriendly, formatMonthDay, formatMoneyCNY, formatTime } from '@/lib/utils';
import { myServices } from '@/services/family';
import { familyRequestableServices } from '@/services/settings';
import { ChangeRequestForm, ExtraServiceForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '服务' };

export default async function FamilyServicePage() {
  const user = await guardPortal('family');
  const [{ upcoming, history }, requestable] = await Promise.all([
    myServices(user),
    familyRequestableServices(),
  ]);

  const noAccess = upcoming.length === 0 && history.length === 0;

  return (
    <div className="px-4 py-6">
      <header className="mb-5">
        <h1 className="text-[24px] font-semibold text-ink-800">服务安排</h1>
        <p className="mt-1.5 text-[15px] text-ink-500">
          您可以在这里查看安排、申请改期，或申请额外服务。
        </p>
      </header>

      {noAccess ? (
        <Card>
          <EmptyState
            icon={<Lock className="h-5 w-5" />}
            title="目前没有可查看的服务安排"
            description="可能还没有安排服务，也可能是您还没有获得「服务安排」的查看授权。"
          />
        </Card>
      ) : null}

      {/* 未来的服务 */}
      {upcoming.length > 0 ? (
        <Card>
          <CardHeader title="接下来的安排" subtitle={`${upcoming.length} 次`} />
          <ul className="divide-y divide-cream-200">
            {upcoming.map((t) => (
              <li key={t.id} className="px-5 py-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-[4.2rem] shrink-0">
                    <p className="text-[15px] font-semibold text-ink-800">
                      {formatMonthDay(t.scheduledStart)}
                    </p>
                    <p className="mt-0.5 text-[17px] font-semibold tabular-nums text-brand-700">
                      {formatTime(t.scheduledStart)}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-medium text-ink-800">
                      {SERVICE_TYPE_LABELS[t.serviceType]}
                      {t.elder ? <span className="ml-1.5 text-ink-500">· {t.elder.name}</span> : null}
                    </p>
                    <p className="mt-0.5 text-[13.5px] text-ink-500">
                      {t.staffProfile ? `${t.staffProfile.user.name} 前往` : '安心专员待安排'}
                      {t.estimatedMinutes ? ` · 约 ${t.estimatedMinutes} 分钟` : ''}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone="info">{TASK_STATUS_LABELS[t.status]}</Badge>
                      {t.isBackupAssignment ? <Badge tone="warm">备用专员代班</Badge> : null}
                    </div>
                    <div className="mt-3">
                      <ChangeRequestForm taskId={t.id} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* 申请额外服务 —— 可申请的类型来自服务目录配置，不写死在前端 */}
      <Card className="mt-4">
        <CardHeader
          title="申请额外服务"
          subtitle={
            requestable.length > 0
              ? `目前开放 ${requestable.length} 类，我们希望先把这几件事做扎实。`
              : '目前暂未开放家庭自助申请。'
          }
        />
        <div className="px-5 py-4">
          {requestable.length === 0 ? (
            <p className="text-[14px] leading-relaxed text-ink-500">
              需要额外服务请直接联系我们，会有人与您电话确认后安排。
            </p>
          ) : (
            <>
              <ul className="mb-4 space-y-2">
                {requestable.map((o) => (
                  <li key={o.serviceType} className="text-[14px]">
                    <span className="font-medium text-ink-800">{o.displayName}</span>
                    {o.addOnPrice != null ? (
                      <span className="ml-1.5 text-[13px] text-brand-700">
                        {formatMoneyCNY(o.addOnPrice)} 起
                      </span>
                    ) : null}
                    {o.description ? (
                      <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-500">
                        {o.description}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <ExtraServiceForm
                options={requestable.map((o) => ({
                  value: o.serviceType,
                  label: o.displayName,
                }))}
              />
            </>
          )}
        </div>
      </Card>

      {/* 历史服务 */}
      {history.length > 0 ? (
        <Card className="mt-4">
          <CardHeader
            title="已完成的服务"
            subtitle={
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                最近 {history.length} 次
              </span>
            }
          />
          <ul className="divide-y divide-cream-200">
            {history.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3.5">
                <CalendarHeart className="h-[18px] w-[18px] shrink-0 text-brand-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] text-ink-800">
                    {SERVICE_TYPE_LABELS[t.serviceType]}
                    {t.elder ? <span className="ml-1.5 text-ink-500">· {t.elder.name}</span> : null}
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink-500">
                    {formatFriendly(t.endedAt ?? t.scheduledStart)}
                    {t.staffProfile ? ` · ${t.staffProfile.user.name}` : ''}
                  </p>
                </div>
                <Badge tone={t.status === 'COMPLETED' ? 'brand' : 'neutral'}>
                  {TASK_STATUS_LABELS[t.status]}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
