import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, GraduationCap, ShieldCheck } from 'lucide-react';

import { Badge, Card, CardHeader, DescRow, EmptyState, Table, Td, UnverifiedHint } from '@/components/ui';
import {
  EDUCATION_LEVEL_LABELS,
  EMPLOYMENT_STATUS_LABELS,
  SERVICE_STATUS_FLOW,
  SERVICE_STATUS_LABELS,
  STAFF_LEVEL_LABELS,
  TRAINING_STATUS_LABELS,
  TRAINING_TYPE_LABELS,
  VERIFICATION_LABELS,
} from '@/lib/labels';
import { can, guardPage } from '@/lib/permissions';
import { formatDate, maskPhone, pct } from '@/lib/utils';
import { prisma } from '@/lib/db';
import { getStaffProfile } from '@/services/staff';
import {
  GrantCompetencyForm,
  RevokeCompetencyButton,
  ServiceStatusForm,
  VerifyEducationForm,
} from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '安心专员档案' };

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await guardPage('staff.read');
  const { id } = await params;

  const staff = await getStaffProfile(user, id);
  if (!staff) notFound();

  // 还没授予的能力标签，供「授予能力」下拉使用
  const held = new Set(staff.competencies.map((c) => c.competencyId));
  const grantable = can(user, 'staff.competency.manage')
    ? (
        await prisma.competency.findMany({
          where: { isActive: true },
          select: { id: true, name: true, requiresCredential: true },
          orderBy: [{ requiresCredential: 'desc' }, { name: 'asc' }],
        })
      ).filter((c) => !held.has(c.id))
    : [];

  const currentIndex = SERVICE_STATUS_FLOW.indexOf(staff.serviceStatus);

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <Link
          href="/admin/staff"
          className="inline-flex items-center gap-1 text-[13px] text-ink-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          安心专员
        </Link>
        <h1 className="mt-2.5 flex flex-wrap items-center gap-2 text-xl font-semibold text-ink-800">
          {staff.user.name}
          <span className="text-sm font-normal text-ink-500">
            {staff.staffLevel === 'SENIOR' ? '资深家庭安心专员' : '家庭安心专员'}
          </span>
          <span className="font-mono text-sm font-normal text-ink-400">{staff.employeeCode}</span>
          <Badge
            tone={
              staff.serviceStatus === 'ACTIVE'
                ? 'brand'
                : staff.serviceStatus === 'SUSPENDED' || staff.serviceStatus === 'OFFBOARDED'
                  ? 'danger'
                  : 'warm'
            }
          >
            {SERVICE_STATUS_LABELS[staff.serviceStatus]}
          </Badge>
        </h1>
      </div>

      {/* 上岗流程条 */}
      <Card>
        <CardHeader
          title="上岗流程"
          subtitle="只有推进到「可排班」才能被派单，且必修培训与能力要求必须同时满足。"
        />
        <div className="flex flex-wrap items-center gap-1.5 px-5 py-4">
          {SERVICE_STATUS_FLOW.map((s, i) => {
            const done = currentIndex >= i && currentIndex !== -1;
            return (
              <span key={s} className="flex items-center gap-1.5">
                <span
                  className={
                    done
                      ? 'rounded-pill bg-brand-600 px-2.5 py-1 text-xs font-medium text-white'
                      : 'rounded-pill bg-cream-200 px-2.5 py-1 text-xs text-ink-500'
                  }
                >
                  {SERVICE_STATUS_LABELS[s]}
                </span>
                {i < SERVICE_STATUS_FLOW.length - 1 ? (
                  <span className="text-ink-300">→</span>
                ) : null}
              </span>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="基本信息" />
            <div className="px-5 py-3">
              <dl className="divide-y divide-cream-100">
                <DescRow label="联系电话">{maskPhone(staff.user.phone)}</DescRow>
                <DescRow label="职级">{STAFF_LEVEL_LABELS[staff.staffLevel]}</DescRow>
                <DescRow label="服务区域">{staff.district?.name ?? '—'}</DescRow>
                <DescRow label="在职状态">
                  {EMPLOYMENT_STATUS_LABELS[staff.employmentStatus]}
                </DescRow>
                <DescRow label="入职日期">{formatDate(staff.hiredAt)}</DescRow>
                <DescRow label="个人简介">{staff.bio || '—'}</DescRow>
              </dl>
            </div>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-brand-600" />
                  专业背景
                </span>
              }
              subtitle="未核验的学历在任何界面都不会显示为「已认证」。"
            />
            {staff.educations.length === 0 ? (
              <EmptyState title="未登记学历信息" />
            ) : (
              <ul className="divide-y divide-cream-200">
                {staff.educations.map((e) => (
                  <li key={e.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink-800">{e.school}</span>
                      <span className="text-[13px] text-ink-600">{e.major}</span>
                      <Badge tone="neutral">{EDUCATION_LEVEL_LABELS[e.level]}</Badge>
                      {e.graduationYear ? (
                        <span className="text-xs text-ink-400">{e.graduationYear} 年毕业</span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {e.verificationStatus === 'VERIFIED' ? (
                        <Badge tone="brand">
                          <ShieldCheck className="h-3 w-3" />
                          已核验
                          {e.verifiedBy ? ` · ${e.verifiedBy.name}` : ''}
                          {e.verifiedAt ? ` · ${formatDate(e.verifiedAt)}` : ''}
                        </Badge>
                      ) : e.verificationStatus === 'REJECTED' ? (
                        <Badge tone="danger">核验未通过</Badge>
                      ) : (
                        <UnverifiedHint label="学历" />
                      )}
                      {can(user, 'staff.education.verify') &&
                      e.verificationStatus !== 'VERIFIED' ? (
                        <VerifyEducationForm educationId={e.id} />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="公司培训" subtitle="公司培训不等同于任何法定资格。" />
            {staff.trainings.length === 0 ? (
              <EmptyState title="未登记培训记录" />
            ) : (
              <Table head={['课程', '类型', '必修', '状态', '成绩', '完成日期', '有效期至']}>
                {staff.trainings.map((t) => (
                  <tr key={t.id}>
                    <Td className="text-[13px]">{t.course.title}</Td>
                    <Td className="text-[13px]">{TRAINING_TYPE_LABELS[t.course.type]}</Td>
                    <Td>{t.course.isMandatory ? <Badge tone="info">必修</Badge> : '—'}</Td>
                    <Td>
                      <Badge
                        tone={
                          t.status === 'PASSED'
                            ? 'brand'
                            : t.status === 'FAILED' || t.status === 'NEEDS_RETRAIN'
                              ? 'danger'
                              : 'warm'
                        }
                      >
                        {TRAINING_STATUS_LABELS[t.status]}
                      </Badge>
                    </Td>
                    <Td className="text-[13px] tabular-nums">{t.examScore ?? '—'}</Td>
                    <Td className="text-[13px]">{formatDate(t.completedAt)}</Td>
                    <Td className="text-[13px]">{t.expiresAt ? formatDate(t.expiresAt) : '长期'}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="能力标签"
              subtitle="涉及法定资格的能力需另有已核验的外部凭证，公司培训不能替代。"
            />
            <div className="space-y-4 px-5 py-4">
              {staff.competencies.length === 0 ? (
                <p className="text-sm text-ink-400">未登记</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {staff.competencies.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-2">
                      <span className="text-ink-800">{c.competency.name}</span>
                      {c.competency.requiresCredential ? (
                        <Badge tone={c.credentialStatus === 'VERIFIED' ? 'brand' : 'warm'}>
                          法定资格：{VERIFICATION_LABELS[c.credentialStatus]}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">公司内部认定</Badge>
                      )}
                      {c.credentialNo ? (
                        <span className="font-mono text-xs text-ink-400">{c.credentialNo}</span>
                      ) : null}
                      {c.credentialExpiry ? (
                        <span className="text-xs text-ink-400">
                          有效至 {formatDate(c.credentialExpiry)}
                        </span>
                      ) : null}
                      {can(user, 'staff.competency.manage') ? (
                        <RevokeCompetencyButton
                          staffProfileId={staff.id}
                          competencyId={c.competencyId}
                          name={c.competency.name}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              {can(user, 'staff.competency.manage') ? (
                <div className="border-t border-cream-200 pt-4">
                  <GrantCompetencyForm staffProfileId={staff.id} options={grantable} />
                </div>
              ) : null}
            </div>
          </Card>

          {can(user, 'staff.update') ? (
            <Card>
              <CardHeader title="调整服务状态" subtitle="必须按流程逐步推进，不可跳级。" />
              <div className="px-5 py-4">
                <ServiceStatusForm
                  staffProfileId={staff.id}
                  currentStatus={staff.serviceStatus}
                />
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="固定服务的家庭" />
            <div className="px-5 py-4">
              {staff.primaryFor.length === 0 ? (
                <p className="text-sm text-ink-400">暂无</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {staff.primaryFor.map((h) => (
                    <li key={h.id}>
                      <Link href={`/admin/households/${h.id}`} className="link">
                        {h.name}
                      </Link>
                      <span className="ml-2 font-mono text-xs text-ink-400">
                        {h.householdCode}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {staff.backupFor.length > 0 ? (
                <p className="mt-3 text-[13px] text-ink-500">
                  另担任 {staff.backupFor.length} 个家庭的备用安心专员。
                </p>
              ) : null}
            </div>
          </Card>

          {can(user, 'staff.performance.read') ? (
            <Card>
              <CardHeader
                title="服务表现"
                subtitle="以服务质量为主，不设单量排行榜。"
              />
              <div className="px-5 py-4">
                {staff.performance.length === 0 ? (
                  <p className="text-sm text-ink-400">尚无绩效快照</p>
                ) : (
                  <dl className="space-y-2 text-sm">
                    {(() => {
                      const p = staff.performance[0];
                      return (
                        <>
                          <DescRow label="统计期间">
                            {formatDate(p.periodStart)} → {formatDate(p.periodEnd)}
                          </DescRow>
                          <DescRow label="准时率">{pct(p.onTimeRate)}</DescRow>
                          <DescRow label="完成率">{pct(p.completionRate)}</DescRow>
                          <DescRow label="记录及时率">{pct(p.recordTimelyRate)}</DescRow>
                          <DescRow label="家庭评价">
                            {p.familyRatingAvg?.toFixed(1) ?? '—'}
                          </DescRow>
                          <DescRow label="投诉次数">{p.complaintCount}</DescRow>
                          <DescRow label="培训完成率">{pct(p.trainingCompletion)}</DescRow>
                          <DescRow label="固定家庭续约">{p.retainedHouseholds}</DescRow>
                        </>
                      );
                    })()}
                  </dl>
                )}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
