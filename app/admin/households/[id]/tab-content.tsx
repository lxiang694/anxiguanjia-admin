import Link from 'next/link';
import { CheckCircle2, Clock, FileText, ShieldCheck, Siren, Wallet } from 'lucide-react';

import { Badge, Card, CardHeader, EmptyState, Table, Td, UnverifiedHint } from '@/components/ui';
import { prisma } from '@/lib/db';
import {
  CONSENT_BASIS_LABELS,
  CONSENT_STATUS_LABELS,
  EDUCATION_LEVEL_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  PERMISSION_LABELS,
  PLAN_TIER_LABELS,
  REPORT_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
  STAFF_LEVEL_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_TONE,
  VERIFICATION_LABELS,
} from '@/lib/labels';
import { formatDate, formatDateTime, formatMoneyCNY, weekdayName } from '@/lib/utils';

/**
 * Household 360° 中数据量较大的几个 Tab。
 * 拆到独立文件，避免主页面文件过大、也让每个 Tab 的查询各自独立。
 */
export async function HouseholdTabContent({
  householdId,
  tab,
}: {
  householdId: string;
  tab: string;
}) {
  if (tab === 'consents') return <ConsentsTab householdId={householdId} />;
  if (tab === 'plan') return <PlanTab householdId={householdId} />;
  if (tab === 'tasks') return <TasksTab householdId={householdId} />;
  if (tab === 'reports') return <ReportsTab householdId={householdId} />;
  if (tab === 'incidents') return <IncidentsTab householdId={householdId} />;
  if (tab === 'orders') return <OrdersTab householdId={householdId} />;
  if (tab === 'timeline') return <TimelineTab householdId={householdId} />;
  if (tab === 'staff') return <StaffTab householdId={householdId} />;
  return null;
}

/* -------------------------------------------------------------------------- */

async function ConsentsTab({ householdId }: { householdId: string }) {
  const consents = await prisma.consent.findMany({
    where: { elder: { householdId, deletedAt: null } },
    include: {
      elder: { select: { name: true } },
      grantor: { select: { name: true } },
      grantee: { select: { name: true } },
    },
    orderBy: [{ elderId: 'asc' }, { permissionType: 'asc' }, { version: 'desc' }],
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="授权管理"
        subtitle="付款权 ≠ 数据查看权。家庭成员只能看到自己被明确授权的内容。"
        action={
          <Link href={`/admin/consents?household=${householdId}`} className="link text-[13px]">
            管理授权
          </Link>
        }
      />
      {consents.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-5 w-5" />}
          title="尚未建立任何授权"
          description="在长辈本人（或法定监护人）同意后，为家庭成员逐项建立查看授权。未经授权，家庭端看不到任何长辈数据。"
        />
      ) : (
        <Table head={['长辈', '被授权人', '授权内容', '授权依据', '有效期', '状态', '版本']}>
          {consents.map((c) => (
            <tr key={c.id}>
              <Td>{c.elder.name}</Td>
              <Td>
                {c.grantee.name}
                <span className="mt-0.5 block text-xs text-ink-400">
                  授权人：{c.grantor.name}
                </span>
              </Td>
              <Td>{PERMISSION_LABELS[c.permissionType]}</Td>
              <Td className="text-[13px]">{CONSENT_BASIS_LABELS[c.basis]}</Td>
              <Td className="whitespace-nowrap text-[13px]">
                {formatDate(c.grantedAt)}
                {' → '}
                {c.expiresAt ? formatDate(c.expiresAt) : '长期'}
              </Td>
              <Td>
                <Badge
                  tone={
                    c.status === 'ACTIVE' ? 'brand' : c.status === 'REVOKED' ? 'danger' : 'neutral'
                  }
                >
                  {CONSENT_STATUS_LABELS[c.status]}
                </Badge>
                {c.revokedAt ? (
                  <span className="mt-0.5 block text-xs text-ink-400">
                    {formatDate(c.revokedAt)} 撤回
                  </span>
                ) : null}
              </Td>
              <Td className="font-mono text-xs text-ink-400">v{c.version}</Td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

async function PlanTab({ householdId }: { householdId: string }) {
  const [plan, subscription] = await Promise.all([
    prisma.householdServicePlan.findUnique({
      where: { householdId },
      include: { plan: true },
    }),
    prisma.subscription.findFirst({
      where: { householdId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="家庭执行计划"
          subtitle="套餐只是商业产品；真正执行的是这份家庭计划。"
        />
        <div className="px-5 py-4 text-sm">
          {plan ? (
            <dl className="space-y-2.5">
              <Row label="每周上门">{plan.visitsPerWeek} 次</Row>
              <Row label="每周电话关怀">{plan.phoneCarePerWeek} 次</Row>
              <Row label="每周安心报告">{plan.reportsPerWeek} 份</Row>
              <Row label="偏好时间">
                {plan.preferredWeekday !== null
                  ? `${weekdayName(plan.preferredWeekday)}${plan.preferredWindow ? ` ${plan.preferredWindow}` : ''}`
                  : plan.preferredWindow || '—'}
              </Row>
              <Row label="执行注意事项">
                <span className="whitespace-pre-wrap">{plan.executionNotes || '—'}</span>
              </Row>
              <Row label="生效期间">
                {formatDate(plan.startDate)} → {plan.endDate ? formatDate(plan.endDate) : '持续'}
              </Row>
            </dl>
          ) : (
            <p className="py-6 text-center text-ink-400">尚未制定家庭执行计划</p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="会员订阅" subtitle="核心是订阅，而不是「一个订单 = 一次上门」。" />
        <div className="px-5 py-4 text-sm">
          {subscription ? (
            <dl className="space-y-2.5">
              <Row label="方案">
                {subscription.plan.name}（{PLAN_TIER_LABELS[subscription.plan.tier]}）
              </Row>
              <Row label="状态">
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
              </Row>
              <Row label="月费">{formatMoneyCNY(subscription.monthlyPrice)}</Row>
              <Row label="本周期">
                {formatDate(subscription.currentPeriodStart)} →{' '}
                {formatDate(subscription.currentPeriodEnd)}
              </Row>
              <Row label="本周期权益使用">
                探访 {subscription.usedVisits}/{subscription.plan.visitsPerMonth} · 关怀{' '}
                {subscription.usedPhoneCare}/{subscription.plan.phoneCarePerMonth} · 报告{' '}
                {subscription.usedReports}/{subscription.plan.reportsPerMonth}
              </Row>
            </dl>
          ) : (
            <p className="py-6 text-center text-ink-400">尚无订阅记录</p>
          )}
        </div>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

async function TasksTab({ householdId }: { householdId: string }) {
  const tasks = await prisma.serviceTask.findMany({
    where: { householdId, deletedAt: null },
    include: {
      elder: { select: { name: true } },
      staffProfile: { include: { user: { select: { name: true } } } },
      record: { select: { id: true, submittedAt: true, reviewedAt: true } },
    },
    orderBy: { scheduledStart: 'desc' },
    take: 60,
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader title="服务与记录" subtitle="原始服务记录永久保留，不因报告改写而变动。" />
      {tasks.length === 0 ? (
        <EmptyState icon={<Clock className="h-5 w-5" />} title="还没有服务记录" />
      ) : (
        <Table head={['时间', '服务类型', '长辈', '安心专员', '状态', '原始记录']}>
          {tasks.map((t) => (
            <tr key={t.id}>
              <Td className="whitespace-nowrap text-[13px]">{formatDateTime(t.scheduledStart)}</Td>
              <Td>
                {SERVICE_TYPE_LABELS[t.serviceType]}
                {t.isBackupAssignment ? (
                  <Badge tone="warm" className="ml-1.5">
                    备用专员
                  </Badge>
                ) : null}
              </Td>
              <Td>{t.elder?.name ?? '—'}</Td>
              <Td>{t.staffProfile?.user.name ?? <span className="text-warm-600">待派单</span>}</Td>
              <Td>
                <Badge tone={TASK_STATUS_TONE[t.status]}>{TASK_STATUS_LABELS[t.status]}</Badge>
              </Td>
              <Td>
                {t.record ? (
                  <Link href={`/admin/service/records/${t.record.id}`} className="link text-[13px]">
                    查看记录
                    {t.record.reviewedAt ? null : (
                      <span className="ml-1 text-warm-600">（待审核）</span>
                    )}
                  </Link>
                ) : (
                  <span className="text-ink-400">—</span>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

async function ReportsTab({ householdId }: { householdId: string }) {
  const reports = await prisma.assuranceReport.findMany({
    where: { householdId },
    include: {
      elder: { select: { name: true } },
      reviewedBy: { select: { name: true } },
      _count: { select: { sourceRecords: true } },
    },
    orderBy: { periodStart: 'desc' },
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="家庭安心报告"
        subtitle="报告须经人工确认后才对家庭端可见；每份报告都可追溯到具体的原始记录。"
      />
      {reports.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="还没有安心报告"
          description="服务记录提交后，可在「安心报告」页生成本周草稿并人工确认。"
        />
      ) : (
        <Table head={['报告编号', '周期', '长辈', '服务次数', '状态', '确认人', '引用记录']}>
          {reports.map((r) => (
            <tr key={r.id}>
              <Td>
                <Link href={`/admin/service/reports/${r.id}`} className="link font-mono text-[13px]">
                  {r.reportNo}
                </Link>
              </Td>
              <Td className="whitespace-nowrap text-[13px]">
                {formatDate(r.periodStart)} → {formatDate(r.periodEnd)}
              </Td>
              <Td>{r.elder?.name ?? '—'}</Td>
              <Td className="text-[13px]">
                上门 {r.visitCount} · 关怀 {r.phoneCareCount}
              </Td>
              <Td>
                <Badge
                  tone={
                    r.status === 'PUBLISHED'
                      ? 'brand'
                      : r.status === 'REJECTED'
                        ? 'danger'
                        : r.status === 'APPROVED'
                          ? 'info'
                          : 'warm'
                  }
                >
                  {REPORT_STATUS_LABELS[r.status]}
                </Badge>
              </Td>
              <Td className="text-[13px]">{r.reviewedBy?.name ?? '—'}</Td>
              <Td className="text-[13px] tabular-nums">{r._count.sourceRecords} 条</Td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

async function IncidentsTab({ householdId }: { householdId: string }) {
  const incidents = await prisma.incident.findMany({
    where: { householdId },
    include: {
      elder: { select: { name: true } },
      owner: { select: { name: true } },
      reportedBy: { select: { name: true } },
      _count: { select: { events: true } },
    },
    orderBy: { occurredAt: 'desc' },
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader title="异常事件" />
      {incidents.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-5 w-5 text-brand-500" />}
          title="这个家庭没有异常事件记录"
        />
      ) : (
        <Table head={['事件编号', '发生时间', '类型', '长辈', '上报人', '负责人', '状态']}>
          {incidents.map((i) => (
            <tr key={i.id}>
              <Td>
                <Link href={`/admin/incidents/${i.id}`} className="link font-mono text-[13px]">
                  {i.incidentNo}
                </Link>
              </Td>
              <Td className="whitespace-nowrap text-[13px]">{formatDateTime(i.occurredAt)}</Td>
              <Td>{INCIDENT_TYPE_LABELS[i.type]}</Td>
              <Td>{i.elder?.name ?? '—'}</Td>
              <Td className="text-[13px]">{i.reportedBy?.name ?? '—'}</Td>
              <Td className="text-[13px]">
                {i.owner?.name ?? <span className="text-warm-600">尚未指定</span>}
              </Td>
              <Td>
                <Badge tone={i.status === 'CLOSED' ? 'neutral' : 'danger'}>
                  {INCIDENT_STATUS_LABELS[i.status]}
                </Badge>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

async function OrdersTab({ householdId }: { householdId: string }) {
  const orders = await prisma.order.findMany({
    where: { householdId },
    include: { subscription: { include: { plan: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader title="订单" />
      {orders.length === 0 ? (
        <EmptyState icon={<Wallet className="h-5 w-5" />} title="还没有订单" />
      ) : (
        <Table head={['订单号', '时间', '类型', '说明', '金额', '状态']}>
          {orders.map((o) => (
            <tr key={o.id}>
              <Td className="font-mono text-[13px]">{o.orderNo}</Td>
              <Td className="whitespace-nowrap text-[13px]">{formatDate(o.createdAt)}</Td>
              <Td>{ORDER_TYPE_LABELS[o.type]}</Td>
              <Td className="text-[13px]">{o.description ?? '—'}</Td>
              <Td
                className={
                  o.amount < 0 ? 'tabular-nums text-danger-600' : 'tabular-nums text-ink-800'
                }
              >
                {formatMoneyCNY(o.amount)}
              </Td>
              <Td>
                <Badge
                  tone={
                    o.status === 'PAID' ? 'brand' : o.status === 'REFUNDED' ? 'danger' : 'neutral'
                  }
                >
                  {ORDER_STATUS_LABELS[o.status]}
                </Badge>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

async function TimelineTab({ householdId }: { householdId: string }) {
  const events = await prisma.timelineEvent.findMany({
    where: { householdId },
    orderBy: { occurredAt: 'desc' },
    take: 120,
  });

  // 按日期分组，读起来更像「这个家庭发生过什么」
  const groups = new Map<string, typeof events>();
  for (const e of events) {
    const key = formatDate(e.occurredAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  return (
    <Card>
      <CardHeader title="家庭时间线" subtitle="含内部事件；家庭端看到的版本会再按授权过滤。" />
      {events.length === 0 ? (
        <EmptyState icon={<Clock className="h-5 w-5" />} title="还没有时间线记录" />
      ) : (
        <div className="px-5 py-4">
          {Array.from(groups.entries()).map(([date, items]) => (
            <div key={date} className="mb-5 last:mb-0">
              <p className="mb-2 text-[13px] font-semibold text-ink-700">{date}</p>
              <ul className="space-y-2.5 border-l border-cream-300 pl-4">
                {items.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[1.32rem] top-1.5 h-2 w-2 rounded-full bg-brand-300" />
                    <p className="text-sm text-ink-800">
                      <span className="mr-2 font-mono text-xs tabular-nums text-ink-400">
                        {new Intl.DateTimeFormat('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                          timeZone: 'Asia/Shanghai',
                        }).format(e.occurredAt)}
                      </span>
                      {e.title}
                    </p>
                    {e.detail ? (
                      <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-500">
                        {e.detail}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-ink-300">
                      家庭端需具备「{PERMISSION_LABELS[e.requiredPermission]}」授权才可见
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

async function StaffTab({ householdId }: { householdId: string }) {
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    include: {
      primarySpecialist: {
        include: {
          user: { select: { name: true, phone: true } },
          educations: true,
          competencies: { include: { competency: true } },
        },
      },
      backupSpecialist: {
        include: { user: { select: { name: true } }, educations: true },
      },
      specialistChanges: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!household) return null;

  const staff = household.primarySpecialist;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="固定家庭安心专员" subtitle="固定专员制度是品牌承诺，更换必须留原因并通知家庭。" />
        <div className="px-5 py-4">
          {staff ? (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-ink-800">{staff.user.name}</span>
                <Badge tone="brand">{STAFF_LEVEL_LABELS[staff.staffLevel]}</Badge>
                <span className="font-mono text-xs text-ink-400">{staff.employeeCode}</span>
              </div>

              <div>
                <p className="mb-1.5 section-title">专业背景</p>
                {staff.educations.length === 0 ? (
                  <p className="text-ink-400">未登记</p>
                ) : (
                  <ul className="space-y-1">
                    {staff.educations.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center gap-2">
                        <span className="text-ink-700">
                          {e.school} · {e.major} · {EDUCATION_LEVEL_LABELS[e.level]}
                        </span>
                        {e.verificationStatus === 'VERIFIED' ? (
                          <Badge tone="brand">已核验</Badge>
                        ) : (
                          <UnverifiedHint label="学历" />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-1.5 section-title">能力标签</p>
                {staff.competencies.length === 0 ? (
                  <p className="text-ink-400">未登记</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {staff.competencies.map((c) => (
                      <Badge
                        key={c.id}
                        tone={
                          c.competency.requiresCredential && c.credentialStatus !== 'VERIFIED'
                            ? 'warm'
                            : 'neutral'
                        }
                      >
                        {c.competency.name}
                        {c.competency.requiresCredential
                          ? `（法定资格：${VERIFICATION_LABELS[c.credentialStatus]}）`
                          : ''}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Link
                href={`/admin/staff/${staff.id}`}
                className="link inline-block text-[13px]"
              >
                查看完整专员档案
              </Link>
            </div>
          ) : (
            <p className="py-6 text-center text-warm-600">尚未指派固定家庭安心专员</p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="备用家庭安心专员" />
        <div className="px-5 py-4 text-sm">
          {household.backupSpecialist ? (
            <p className="text-ink-800">
              {household.backupSpecialist.user.name}
              <span className="ml-2 font-mono text-xs text-ink-400">
                {household.backupSpecialist.employeeCode}
              </span>
            </p>
          ) : (
            <p className="text-ink-400">尚未指派</p>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="专员变更记录" />
        {household.specialistChanges.length === 0 ? (
          <EmptyState icon={<Siren className="h-5 w-5" />} title="没有变更记录" />
        ) : (
          <Table head={['时间', '操作人', '原因', '是否已通知家庭']}>
            {household.specialistChanges.map((c) => (
              <tr key={c.id}>
                <Td className="whitespace-nowrap text-[13px]">{formatDateTime(c.createdAt)}</Td>
                <Td className="text-[13px]">{c.changedByName}</Td>
                <Td className="text-[13px]">{c.reason}</Td>
                <Td>
                  {c.familyNotifiedAt ? (
                    <Badge tone="brand">已通知</Badge>
                  ) : (
                    <Badge tone="warm">站内通知已发出</Badge>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="min-w-0 text-ink-800">{children}</dd>
    </div>
  );
}
