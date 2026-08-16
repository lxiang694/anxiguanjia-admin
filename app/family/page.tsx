import Link from 'next/link';
import { CalendarHeart, ChevronRight, Lock, Phone, ShieldCheck, Sparkles } from 'lucide-react';

import { Badge, Card, CardHeader, EmptyState } from '@/components/ui';
import { BRAND, PERMISSION_LABELS, SERVICE_TYPE_LABELS } from '@/lib/labels';
import { guardPortal } from '@/lib/permissions';
import { formatFriendly, formatMonthDay, formatTime } from '@/lib/utils';
import { eldersOverview, familyTimeline, myCareTeam, myHousehold } from '@/services/family';

export const dynamic = 'force-dynamic';
export const metadata = { title: '爸妈' };

export default async function FamilyHomePage() {
  const user = await guardPortal('family');

  const [household, elders, team, timeline] = await Promise.all([
    myHousehold(user),
    eldersOverview(user),
    myCareTeam(user),
    familyTimeline(user, 12),
  ]);

  if (!household) {
    return (
      <div className="px-4 py-6">
        <Card>
          <EmptyState
            title="还没有找到您的家庭"
            description={`如果您刚完成购买，我们的${BRAND.name}顾问会尽快与您联系并完成建档。`}
          />
        </Card>
      </div>
    );
  }

  const anyOpenIncident = elders.some((e) => e.openIncidentCount > 0);

  return (
    <div className="px-4 py-6">
      {/* 第一屏：爸妈最近怎么样？ */}
      <header className="mb-5">
        <h1 className="text-[26px] font-semibold leading-tight text-ink-800">
          爸妈最近怎么样？
        </h1>
        <p className="mt-1.5 text-[15px] text-ink-500">{BRAND.promise}</p>
      </header>

      {elders.length === 0 ? (
        <Card>
          <EmptyState
            title="长辈档案还在建立中"
            description="我们的家庭安心顾问会在上门评估后完成建档，之后这里就会显示爸妈的近况。"
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {elders.map((elder) => {
            const canSeeSchedule = elder.permissions.includes('SERVICE_SCHEDULE');
            const canSeeReport = elder.permissions.includes('ASSURANCE_REPORT');
            const hasAnyPermission = elder.permissions.length > 0;

            return (
              <Card key={elder.id} className="overflow-hidden">
                <div className="px-5 pt-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-[20px] font-semibold text-ink-800">{elder.name}</h2>
                    {elder.openIncidentCount > 0 ? (
                      <Badge tone="danger">有 {elder.openIncidentCount} 件情况在跟进</Badge>
                    ) : null}
                  </div>

                  {!hasAnyPermission ? (
                    <div className="mt-3 rounded-xl bg-cream-100 px-4 py-3.5">
                      <p className="flex items-center gap-1.5 text-[15px] font-medium text-ink-700">
                        <Lock className="h-4 w-4" />
                        您目前没有查看权限
                      </p>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-500">
                        {elder.name}
                        还没有授权您查看相关信息。支付服务费不会自动获得查看权限 ——
                        这是为了保护长辈自己的意愿。
                      </p>
                      <Link
                        href="/family/consents"
                        className="mt-2.5 inline-block text-[14px] text-brand-700 underline underline-offset-2"
                      >
                        了解授权是怎么运作的
                      </Link>
                    </div>
                  ) : (
                    <>
                      {/* 最近一次服务 */}
                      <div className="mt-3">
                        {canSeeSchedule && elder.lastServiceAt ? (
                          <p className="text-[15px] text-ink-600">
                            最近一次服务：
                            <span className="ml-1 font-medium text-ink-800">
                              {formatFriendly(elder.lastServiceAt)}
                            </span>
                            {elder.lastServiceType ? (
                              <span className="ml-1.5 text-ink-500">
                                {SERVICE_TYPE_LABELS[elder.lastServiceType]}
                              </span>
                            ) : null}
                          </p>
                        ) : canSeeSchedule ? (
                          <p className="text-[15px] text-ink-500">还没有完成过服务</p>
                        ) : null}
                      </div>

                      {/* 状态一句话 */}
                      <div
                        className={
                          elder.openIncidentCount > 0
                            ? 'mt-3 rounded-xl bg-danger-50 px-4 py-3.5'
                            : 'mt-3 rounded-xl bg-brand-50 px-4 py-3.5'
                        }
                      >
                        <p
                          className={
                            elder.openIncidentCount > 0
                              ? 'text-[16px] font-semibold text-danger-700'
                              : 'text-[16px] font-semibold text-brand-700'
                          }
                        >
                          {elder.openIncidentCount > 0
                            ? '有情况正在跟进，我们会与您联系'
                            : '暂无需要您处理的事项'}
                        </p>
                        {elder.openIncidentCount === 0 ? (
                          <p className="mt-1 text-[14px] text-brand-700">
                            一切按计划进行，您可以放心。
                          </p>
                        ) : null}
                      </div>

                      {/* 本周 */}
                      {canSeeSchedule ? (
                        <div className="mt-4 flex gap-6">
                          <div>
                            <p className="text-[13px] text-ink-500">本周上门</p>
                            <p className="text-[20px] font-semibold tabular-nums text-ink-800">
                              {elder.weekVisitCount} 次
                            </p>
                          </div>
                          <div>
                            <p className="text-[13px] text-ink-500">电话关怀</p>
                            <p className="text-[20px] font-semibold tabular-nums text-ink-800">
                              {elder.weekPhoneCount} 次
                            </p>
                          </div>
                          <div>
                            <p className="text-[13px] text-ink-500">下一次</p>
                            <p className="text-[17px] font-semibold text-ink-800">
                              {elder.nextServiceAt
                                ? `${formatMonthDay(elder.nextServiceAt)} ${formatTime(elder.nextServiceAt)}`
                                : '待安排'}
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>

                {/* 报告入口 */}
                {canSeeReport && elder.latestReport ? (
                  <Link
                    href={`/family/reports/${elder.latestReport.id}`}
                    className="mt-4 flex items-center gap-2 border-t border-cream-200 bg-cream-50 px-5 py-4 active:bg-cream-100"
                  >
                    <Sparkles className="h-[18px] w-[18px] shrink-0 text-warm-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-semibold text-ink-800">
                        查看本周安心报告
                      </span>
                      <span className="mt-0.5 block text-[13px] text-ink-500">
                        {elder.latestReport.title}
                      </span>
                    </span>
                    {!elder.latestReport.firstReadAt ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-warm-400" />
                    ) : null}
                    <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
                  </Link>
                ) : canSeeReport ? (
                  <div className="mt-4 border-t border-cream-200 bg-cream-50 px-5 py-4">
                    <p className="text-[14px] text-ink-500">
                      本周的安心报告还在整理中。报告会由我们的同事人工确认后再发给您。
                    </p>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      {anyOpenIncident ? (
        <p className="mt-4 rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-[14px] leading-relaxed text-danger-700">
          我们的服务督导正在处理，处理进展会同步给您。如果您希望现在了解情况，可以直接联系顾问。
        </p>
      ) : null}

      {/* 服务团队 */}
      {team?.primary || team?.consultant ? (
        <Card className="mt-4">
          <CardHeader title="为这个家庭服务的同事" />
          <div className="space-y-4 px-5 py-4">
            {team.primary ? (
              <div className="flex gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[17px] font-semibold text-brand-700">
                  {team.primary.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <p className="text-[17px] font-semibold text-ink-800">{team.primary.name}</p>
                  <p className="text-[14px] text-ink-600">{team.primary.title}</p>

                  {team.primary.educations.length > 0 ? (
                    <p className="mt-2 text-[13.5px] text-ink-600">
                      <span className="text-ink-400">专业背景　</span>
                      {team.primary.educations
                        .map((e) => `${e.school} ${e.major}`)
                        .join('、')}
                    </p>
                  ) : null}

                  {team.primary.onboardingComplete ? (
                    <p className="mt-1 text-[13.5px] text-ink-600">
                      <span className="text-ink-400">公司培训　</span>
                      已完成{BRAND.name}岗前服务培训
                    </p>
                  ) : null}

                  {team.primary.competencies.length > 0 ? (
                    <p className="mt-1 text-[13.5px] text-ink-600">
                      <span className="text-ink-400">擅长　　　</span>
                      {team.primary.competencies.join('、')}
                    </p>
                  ) : null}

                  <p className="mt-1.5 text-[13.5px] text-brand-700">
                    已服务本家庭 {team.primary.servedCount} 次
                  </p>
                </div>
              </div>
            ) : null}

            {team.consultant ? (
              <a
                href={`tel:${team.consultant.phone}`}
                className="flex items-center gap-2.5 rounded-xl bg-cream-100 px-4 py-3 active:bg-cream-200"
              >
                <Phone className="h-[18px] w-[18px] shrink-0 text-brand-600" />
                <span className="min-w-0 text-[15px] text-ink-800">
                  家庭安心顾问 · {team.consultant.name}
                  <span className="mt-0.5 block text-[13px] text-ink-500">
                    有任何问题都可以直接打给我
                  </span>
                </span>
              </a>
            ) : null}

            {team.backup ? (
              <p className="text-[13px] text-ink-400">
                备用安心专员：{team.backup.name}。固定专员临时无法前往时，会由他/她代班，我们会提前通知您。
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* 家庭时间线 */}
      <Card className="mt-4">
        <CardHeader
          title="家庭时间线"
          subtitle="只显示您有权查看的内容。"
          action={
            <Link href="/family/service" className="text-[13px] text-brand-700">
              全部服务
            </Link>
          }
        />
        {timeline.length === 0 ? (
          <EmptyState
            icon={<CalendarHeart className="h-5 w-5" />}
            title="还没有可显示的记录"
            description="服务开始后，这里会按时间记录每一次探访与关怀。"
          />
        ) : (
          <div className="px-5 py-4">
            <ol className="space-y-3.5 border-l border-cream-300 pl-4">
              {timeline.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[1.32rem] top-2 h-2 w-2 rounded-full bg-brand-300" />
                  <p className="text-[12px] text-ink-400">{formatFriendly(e.occurredAt)}</p>
                  <p className="mt-0.5 text-[15px] text-ink-800">{e.title}</p>
                  {e.detail ? (
                    <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-500">{e.detail}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        )}
      </Card>

      {/* 隐私说明 */}
      <Link
        href="/family/consents"
        className="mt-4 flex items-center gap-2.5 rounded-card border border-cream-300 bg-cream-50 px-4 py-3.5 active:bg-cream-100"
      >
        <ShieldCheck className="h-[18px] w-[18px] shrink-0 text-brand-600" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-ink-800">谁可以看到什么</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-ink-500">
            您当前可查看：
            {elders.length > 0 && elders[0].permissions.length > 0
              ? elders[0].permissions.map((p) => PERMISSION_LABELS[p]).join('、')
              : '暂无授权'}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
      </Link>
    </div>
  );
}
