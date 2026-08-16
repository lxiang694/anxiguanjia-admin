import Link from 'next/link';
import { ChevronRight, LogOut, Phone, ShieldCheck, Wallet } from 'lucide-react';

import { logoutAction } from '@/app/actions/auth';
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui';
import { prisma } from '@/lib/db';
import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_STATUS_LABELS,
  PLAN_TIER_LABELS,
  RELATIONSHIP_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
} from '@/lib/labels';
import { guardPortal } from '@/lib/permissions';
import { formatDate, formatMoneyCNY, maskPhone } from '@/lib/utils';
import { myHousehold } from '@/services/family';
import { FeedbackForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '我的' };

export default async function FamilyMePage() {
  const user = await guardPortal('family');
  const household = await myHousehold(user);

  const [myMembership, feedbackCases] = await Promise.all([
    household
      ? prisma.familyMember.findFirst({
          where: { userId: user.id, householdId: household.id },
        })
      : null,
    prisma.feedbackCase.findMany({
      where: { submittedById: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const subscription = household?.subscriptions[0];

  return (
    <div className="px-4 py-6">
      {/* 个人信息 */}
      <Card className="px-5 py-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-warm-100 text-[20px] font-semibold text-warm-600">
            {user.name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="text-[19px] font-semibold text-ink-800">{user.name}</p>
            <p className="mt-0.5 text-[14px] text-ink-500">
              {household?.name ?? '—'}
              {myMembership ? ` · ${RELATIONSHIP_LABELS[myMembership.relationship]}` : ''}
            </p>
            <p className="mt-0.5 text-[13px] text-ink-400">{maskPhone(user.phone)}</p>
          </div>
        </div>

        {myMembership ? (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {myMembership.isPayer ? <Badge tone="neutral">付款人</Badge> : null}
            {myMembership.isPrimaryContact ? <Badge tone="brand">主要联络人</Badge> : null}
            {myMembership.isEmergencyContact ? <Badge tone="warm">紧急联络人</Badge> : null}
          </div>
        ) : null}
      </Card>

      {/* 授权入口 */}
      <Link
        href="/family/consents"
        className="mt-3 flex items-center gap-3 rounded-card border border-cream-300 bg-white px-5 py-4 shadow-card active:bg-cream-50"
      >
        <ShieldCheck className="h-5 w-5 shrink-0 text-brand-600" />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-medium text-ink-800">谁可以看到什么</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-ink-500">
            查看与撤回授权。付款不等于查看权限。
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
      </Link>

      {/* 会员信息 */}
      {subscription ? (
        <Card className="mt-3">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-brand-600" />
                我的会员
              </span>
            }
          />
          <div className="px-5 py-4 text-[15px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink-800">
                {subscription.plan.name}（{PLAN_TIER_LABELS[subscription.plan.tier]}）
              </span>
              <Badge
                tone={
                  subscription.status === 'ACTIVE'
                    ? 'brand'
                    : subscription.status === 'PAST_DUE'
                      ? 'danger'
                      : 'warm'
                }
              >
                {SUBSCRIPTION_STATUS_LABELS[subscription.status]}
              </Badge>
            </div>
            <dl className="mt-3 space-y-2 text-[14px]">
              <div className="flex justify-between">
                <dt className="text-ink-500">月费</dt>
                <dd className="text-ink-800">{formatMoneyCNY(subscription.monthlyPrice)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">本期至</dt>
                <dd className="text-ink-800">{formatDate(subscription.currentPeriodEnd)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">本期包含</dt>
                <dd className="text-right text-ink-800">
                  上门 {subscription.plan.visitsPerMonth} 次 · 关怀{' '}
                  {subscription.plan.phoneCarePerMonth} 次 · 报告{' '}
                  {subscription.plan.reportsPerMonth} 份
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">本期已用</dt>
                <dd className="text-right text-ink-800">
                  上门 {subscription.usedVisits} · 关怀 {subscription.usedPhoneCare} · 报告{' '}
                  {subscription.usedReports}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-400">
              续费与开票请联系家庭安心顾问办理。第一版尚未开通在线支付。
            </p>
          </div>
        </Card>
      ) : null}

      {/* 联系顾问 */}
      {household?.consultant ? (
        <a
          href={`tel:${household.consultant.phone}`}
          className="mt-3 flex items-center gap-3 rounded-card border border-cream-300 bg-white px-5 py-4 shadow-card active:bg-cream-50"
        >
          <Phone className="h-5 w-5 shrink-0 text-brand-600" />
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-medium text-ink-800">
              联系家庭安心顾问 · {household.consultant.name}
            </span>
            <span className="mt-0.5 block text-[13px] text-ink-500">
              {household.consultant.phone}
            </span>
          </span>
        </a>
      ) : null}

      {/* 服务反馈 */}
      <Card className="mt-3">
        <CardHeader
          title="服务反馈"
          subtitle="不管是表扬还是不满意，都请告诉我们 —— 这会直接影响我们的服务质量评估。"
        />
        <div className="px-5 py-4">
          <FeedbackForm />
        </div>
      </Card>

      {/* 我的反馈记录 */}
      {feedbackCases.length > 0 ? (
        <Card className="mt-3">
          <CardHeader title="我提交过的反馈" />
          <ul className="divide-y divide-cream-100 px-5">
            {feedbackCases.map((c) => (
              <li key={c.id} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] text-ink-800">{c.subject}</p>
                    <p className="mt-0.5 text-[12.5px] text-ink-400">
                      {FEEDBACK_CATEGORY_LABELS[c.category]} · {formatDate(c.createdAt)} ·{' '}
                      {c.caseNo}
                    </p>
                  </div>
                  <Badge
                    tone={
                      c.status === 'RESOLVED' || c.status === 'CLOSED'
                        ? 'brand'
                        : c.status === 'NEW'
                          ? 'warm'
                          : 'info'
                    }
                  >
                    {FEEDBACK_STATUS_LABELS[c.status]}
                  </Badge>
                </div>
                {c.resolution ? (
                  <p className="mt-1.5 rounded-lg bg-cream-100 px-3 py-2 text-[13.5px] leading-relaxed text-ink-700">
                    {c.resolution}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="mt-3">
          <EmptyState title="您还没有提交过反馈" />
        </Card>
      )}

      <form action={logoutAction} className="mt-5">
        <button
          type="submit"
          className="btn-mobile border border-cream-400 bg-white text-ink-600 active:bg-cream-100"
        >
          <LogOut className="h-5 w-5" />
          退出登录
        </button>
      </form>
    </div>
  );
}
