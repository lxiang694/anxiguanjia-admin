import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Phone, ShieldCheck, UserRound } from 'lucide-react';

import { Badge, Card, CardHeader, DemoBadge, DescRow, NonMedicalNotice } from '@/components/ui';
import { HOUSEHOLD_STATUS_LABELS, HOUSEHOLD_STATUS_TONE, PLAN_TIER_LABELS } from '@/lib/labels';
import { can, canSeeInternalNotes, guardPage } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { formatDate, maskAddress, maskPhone } from '@/lib/utils';
import { getHousehold360 } from '@/services/household';

import { HouseholdTabs, TAB_KEYS, type TabKey } from './tabs';
import {
  AddElderForm,
  AddMemberForm,
  ChangeSpecialistForm,
  CreateSubscriptionForm,
  HouseholdPlanForm,
  HouseholdStatusForm,
} from './manage-forms';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `家庭 ${id.slice(0, 6)}` };
}

export default async function Household360Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await guardPage('household.read');
  const { id } = await params;
  const { tab } = await searchParams;

  const household = await getHousehold360(user, id);
  if (!household) notFound();

  // 表单用到的下拉数据：只列可排班的专员与在售方案
  const [activeStaff, activePlans] = await Promise.all([
    can(user, 'household.update')
      ? prisma.staffProfile.findMany({
          where: { serviceStatus: 'ACTIVE', deletedAt: null },
          select: { id: true, employeeCode: true, user: { select: { name: true } } },
          orderBy: { employeeCode: 'asc' },
        })
      : [],
    can(user, 'plan.read')
      ? prisma.servicePlan.findMany({
          where: { isActive: true },
          select: { id: true, name: true, monthlyPrice: true },
          orderBy: [{ sortOrder: 'asc' }],
        })
      : [],
  ]);
  const staffOptions = activeStaff.map((s) => ({
    id: s.id,
    name: s.user.name,
    employeeCode: s.employeeCode,
  }));
  const elderOptions = household.elders.map((e) => ({ id: e.id, name: e.name }));

  const activeTab: TabKey = (TAB_KEYS as readonly string[]).includes(tab ?? '')
    ? (tab as TabKey)
    : 'overview';

  const elderNames = household.elders.map((e) => e.name).join('、');

  return (
    <div className="space-y-5">
      {/* 返回 + 标题 */}
      <div>
        <Link
          href="/admin/households"
          className="inline-flex items-center gap-1 text-[13px] text-ink-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          家庭列表
        </Link>

        <div className="mt-2.5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-ink-800">
              {household.name}
              <span className="font-mono text-sm font-normal text-ink-400">
                {household.householdCode}
              </span>
              <Badge tone={HOUSEHOLD_STATUS_TONE[household.status]}>
                {HOUSEHOLD_STATUS_LABELS[household.status]}
              </Badge>
              {household.isDemo ? <DemoBadge /> : null}
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              {household.city.name}
              {household.district ? ` · ${household.district.name}` : ''}
              {elderNames ? ` · 长辈：${elderNames}` : ' · 尚未建立长辈档案'}
            </p>
          </div>
        </div>
      </div>

      {/* 关键关系速览 —— 让运营一眼看懂这个家庭是谁在服务 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <RelationCard
          label="家庭安心顾问"
          name={household.consultant?.name ?? null}
          note={household.consultant ? maskPhone(household.consultant.phone) : '未指派'}
        />
        <RelationCard
          label="固定家庭安心专员"
          name={household.primarySpecialist?.user.name ?? null}
          note={
            household.primarySpecialist
              ? `${household.primarySpecialist.employeeCode}`
              : '未指派'
          }
          highlight
        />
        <RelationCard
          label="备用家庭安心专员"
          name={household.backupSpecialist?.user.name ?? null}
          note={household.backupSpecialist?.employeeCode ?? '未指派'}
        />
        <RelationCard
          label="主要联络人"
          name={household.primaryContact?.user.name ?? null}
          note={
            household.primaryContact
              ? maskPhone(household.primaryContact.user.phone)
              : '未指定'
          }
        />
      </div>

      {/* Tabs */}
      <HouseholdTabs householdId={household.id} active={activeTab} />

      {/* Tab 内容 */}
      {activeTab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="家庭概览" />
            <div className="px-5 py-3">
              <dl className="divide-y divide-cream-100">
                <DescRow label="家庭编号">{household.householdCode}</DescRow>
                <DescRow label="所在城市">
                  {household.city.name}
                  {household.district ? ` · ${household.district.name}` : ''}
                </DescRow>
                <DescRow label="服务地址">
                  {maskAddress(household.addressLine)}
                  <span className="ml-2 text-xs text-ink-400">（已脱敏，派单时对专员完整展示）</span>
                </DescRow>
                <DescRow label="加入时间">
                  {household.joinedAt ? formatDate(household.joinedAt) : '尚未成为会员'}
                </DescRow>
                <DescRow label="建档时间">{formatDate(household.createdAt)}</DescRow>
                <DescRow label="服务方案">
                  {household.servicePlan?.plan
                    ? `${household.servicePlan.plan.name}（${PLAN_TIER_LABELS[household.servicePlan.plan.tier]}）`
                    : '尚未制定'}
                </DescRow>
                <DescRow label="家庭注意事项">
                  {household.serviceNotes || '—'}
                </DescRow>
              </dl>
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader title="数据概况" />
              <div className="grid grid-cols-2 gap-y-3 px-5 py-4 text-sm">
                <Stat label="长辈" value={household.elders.length} />
                <Stat label="家庭成员" value={household.members.length} />
                <Stat label="服务任务" value={household._count.tasks} />
                <Stat label="安心报告" value={household._count.reports} />
                <Stat label="异常事件" value={household._count.incidents} />
                <Stat label="反馈工单" value={household._count.feedbackCases} />
              </div>
            </Card>

            {can(user, 'household.update') ? (
              <HouseholdStatusForm householdId={household.id} current={household.status} />
            ) : null}

            <Card>
              <CardHeader title="最近一次家庭安心评估" />
              <div className="px-5 py-4 text-sm">
                {household.assessments[0] ? (
                  <div className="space-y-2">
                    <p className="text-ink-500">
                      {formatDate(household.assessments[0].assessedAt)} ·{' '}
                      {household.assessments[0].assessorName}
                    </p>
                    <p className="whitespace-pre-wrap leading-relaxed text-ink-700">
                      {household.assessments[0].needsSummary ??
                        household.assessments[0].recommendation ??
                        '—'}
                    </p>
                  </div>
                ) : (
                  <p className="text-ink-400">尚未完成家庭安心评估</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === 'elders' ? (
        <div className="space-y-4">
          <NonMedicalNotice />
          {can(user, 'elder.update') ? <AddElderForm householdId={household.id} /> : null}
          {household.elders.length === 0 ? (
            <Card>
              <div className="px-5 py-10 text-center text-sm text-ink-400">
                尚未建立长辈安心档案
              </div>
            </Card>
          ) : (
            household.elders.map((e) => (
              <Card key={e.id}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-brand-600" />
                      {e.name}
                    </span>
                  }
                  subtitle={`${e.gender === 'MALE' ? '男' : e.gender === 'FEMALE' ? '女' : '未填写'} · ${e._count.consents} 条授权记录`}
                  action={
                    <Link href={`/admin/elders/${e.id}`} className="link text-[13px]">
                      查看完整档案
                    </Link>
                  }
                />
                <div className="px-5 py-3">
                  <dl className="divide-y divide-cream-100">
                    <DescRow label="联系电话">{maskPhone(e.phone)}</DescRow>
                    <DescRow label="居住情况">{e.livingArrangement || '—'}</DescRow>
                    <DescRow label="日常习惯">{e.dailyRoutine || '—'}</DescRow>
                    <DescRow label="沟通偏好">{e.communicationPrefs || '—'}</DescRow>
                    <DescRow label="生活需要">{e.dailyNeeds || '—'}</DescRow>
                    <DescRow label="需要注意">{e.attentionNotes || '—'}</DescRow>
                    <DescRow label="紧急联络安排">{e.emergencyArrangement || '—'}</DescRow>
                  </dl>
                </div>
              </Card>
            ))
          )}
        </div>
      ) : null}

      {activeTab === 'members' ? (
        <div className="space-y-4">
        {can(user, 'familyMember.manage') ? (
          <AddMemberForm householdId={household.id} elders={elderOptions} />
        ) : null}
        <Card className="overflow-hidden">
          <CardHeader
            title="家庭成员"
            subtitle="付款人不会因为付款而自动获得查看权限 —— 查看范围由「授权」页决定。"
          />
          <ul className="divide-y divide-cream-200">
            {household.members.length === 0 ? (
              <li className="px-5 py-10 text-center text-sm text-ink-400">尚未加入家庭成员</li>
            ) : (
              household.members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-800">
                      {m.user.name}
                      <span className="text-[13px] font-normal text-ink-500">
                        {relationshipText(m.relationship)}
                      </span>
                      {m.isPayer ? <Badge tone="info">付款人</Badge> : null}
                      {m.isPrimaryContact ? <Badge tone="brand">主要联络人</Badge> : null}
                      {m.isEmergencyContact ? <Badge tone="warm">紧急联络人</Badge> : null}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-400">
                      <Phone className="h-3 w-3" />
                      {maskPhone(m.user.phone)}
                      {m.elder ? ` · 主要对应 ${m.elder.name}` : ''}
                    </p>
                  </div>
                  <Link
                    href={`/admin/households/${household.id}?tab=consents`}
                    className="link text-[13px]"
                  >
                    查看其授权
                  </Link>
                </li>
              ))
            )}
          </ul>
        </Card>
        </div>
      ) : null}

      {activeTab === 'internal' ? (
        <Card>
          <CardHeader
            title="内部备注"
            subtitle="仅运营可见，不会出现在家庭端与安心专员端。"
          />
          <div className="px-5 py-4">
            {canSeeInternalNotes(user) ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
                {household.internalNotes || '—'}
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-ink-400">
                <ShieldCheck className="h-4 w-4" />
                您的角色没有查看内部备注的权限。
              </p>
            )}
          </div>
        </Card>
      ) : null}

      {/* 其余 Tab 的内容由各自的子路由段渲染，保持本页体积可控 */}
      {['consents', 'plan', 'tasks', 'reports', 'incidents', 'orders', 'timeline', 'staff'].includes(
        activeTab,
      ) ? (
        <div className="space-y-4">
          {activeTab === 'staff' && can(user, 'household.update') ? (
            <ChangeSpecialistForm
              householdId={household.id}
              staff={staffOptions}
              currentId={household.primarySpecialistId}
            />
          ) : null}

          {activeTab === 'plan' ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {can(user, 'household.update') ? (
                <HouseholdPlanForm
                  householdId={household.id}
                  plans={activePlans}
                  current={
                    household.servicePlan
                      ? {
                          planId: household.servicePlan.planId,
                          visitsPerWeek: household.servicePlan.visitsPerWeek,
                          phoneCarePerWeek: household.servicePlan.phoneCarePerWeek,
                          reportsPerWeek: household.servicePlan.reportsPerWeek,
                          preferredWeekday: household.servicePlan.preferredWeekday,
                          preferredWindow: household.servicePlan.preferredWindow,
                          executionNotes: household.servicePlan.executionNotes,
                        }
                      : null
                  }
                />
              ) : null}
              {can(user, 'subscription.manage') && activePlans.length > 0 ? (
                <CreateSubscriptionForm householdId={household.id} plans={activePlans} />
              ) : null}
            </div>
          ) : null}

          <TabRedirectHint householdId={household.id} tab={activeTab} />
        </div>
      ) : null}
    </div>
  );
}

function relationshipText(r: string): string {
  const map: Record<string, string> = {
    SON: '儿子',
    DAUGHTER: '女儿',
    SPOUSE: '配偶',
    DAUGHTER_IN_LAW: '儿媳',
    SON_IN_LAW: '女婿',
    GRANDCHILD: '孙辈',
    SIBLING: '兄弟姐妹',
    RELATIVE: '亲属',
    FRIEND: '朋友',
    OTHER: '其他',
  };
  return map[r] ?? r;
}

function RelationCard({
  label,
  name,
  note,
  highlight,
}: {
  label: string;
  name: string | null;
  note: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? 'rounded-card border border-brand-200 bg-brand-50/60 px-4 py-3'
          : 'card px-4 py-3'
      }
    >
      <p className="text-[12px] text-ink-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink-800">
        {name ?? <span className="font-normal text-warm-600">未指派</span>}
      </p>
      <p className="mt-0.5 font-mono text-[11px] text-ink-400">{note}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[12px] text-ink-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-ink-800">{value}</p>
    </div>
  );
}

async function TabRedirectHint({ householdId, tab }: { householdId: string; tab: string }) {
  const { HouseholdTabContent } = await import('./tab-content');
  return <HouseholdTabContent householdId={householdId} tab={tab} />;
}
