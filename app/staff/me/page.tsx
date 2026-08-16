import { GraduationCap, LogOut, ShieldCheck } from 'lucide-react';

import { logoutAction } from '@/app/actions/auth';
import { Badge, Card, CardHeader, EmptyState, UnverifiedHint } from '@/components/ui';
import { prisma } from '@/lib/db';
import {
  EDUCATION_LEVEL_LABELS,
  ROLE_LABELS,
  SERVICE_STATUS_FLOW,
  SERVICE_STATUS_LABELS,
  STAFF_LEVEL_LABELS,
  TRAINING_STATUS_LABELS,
  VERIFICATION_LABELS,
} from '@/lib/labels';
import { guardPortal } from '@/lib/permissions';
import { currentWeekRange, formatDate, monthRange } from '@/lib/utils';
import { AvailabilityForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '我的' };

export default async function StaffMePage() {
  const user = await guardPortal('staff');

  const profile = user.staffProfileId
    ? await prisma.staffProfile.findUnique({
        where: { id: user.staffProfileId },
        include: {
          district: { select: { name: true } },
          educations: true,
          competencies: { include: { competency: true } },
          trainings: { include: { course: true }, orderBy: { updatedAt: 'desc' } },
          availability: { orderBy: { startAt: 'desc' }, take: 10 },
          primaryFor: { select: { id: true } },
        },
      })
    : null;

  const month = monthRange();
  const week = currentWeekRange();

  const [monthCount, weekCount, todoTrainings] = await Promise.all([
    user.staffProfileId
      ? prisma.serviceTask.count({
          where: {
            staffProfileId: user.staffProfileId,
            status: { in: ['COMPLETED', 'PENDING_REVIEW'] },
            scheduledStart: { gte: month.start, lt: month.end },
          },
        })
      : 0,
    user.staffProfileId
      ? prisma.serviceTask.count({
          where: {
            staffProfileId: user.staffProfileId,
            deletedAt: null,
            scheduledStart: { gte: week.start, lt: week.end },
            status: { notIn: ['CANCELLED', 'RESCHEDULED'] },
          },
        })
      : 0,
    user.staffProfileId
      ? prisma.trainingRecord.findMany({
          where: {
            staffProfileId: user.staffProfileId,
            status: { in: ['NOT_STARTED', 'IN_PROGRESS', 'PENDING_EXAM', 'NEEDS_RETRAIN', 'FAILED'] },
          },
          include: { course: { select: { title: true, isMandatory: true } } },
        })
      : [],
  ]);

  const currentIndex = profile ? SERVICE_STATUS_FLOW.indexOf(profile.serviceStatus) : -1;

  return (
    <div className="px-4 py-5">
      {/* 个人信息 */}
      <Card className="px-4 py-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[20px] font-semibold text-brand-700">
            {user.name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="text-[19px] font-semibold text-ink-800">{user.name}</p>
            <p className="mt-0.5 text-[14px] text-ink-600">{ROLE_LABELS[user.role]}</p>
            {profile ? (
              <p className="mt-0.5 font-mono text-[12px] text-ink-400">
                {profile.employeeCode} · {STAFF_LEVEL_LABELS[profile.staffLevel]}
                {profile.district ? ` · ${profile.district.name}` : ''}
              </p>
            ) : null}
          </div>
        </div>

        {profile ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge
              tone={
                profile.serviceStatus === 'ACTIVE'
                  ? 'brand'
                  : profile.serviceStatus === 'SUSPENDED' || profile.serviceStatus === 'OFFBOARDED'
                    ? 'danger'
                    : 'warm'
              }
            >
              {SERVICE_STATUS_LABELS[profile.serviceStatus]}
            </Badge>
            {profile.serviceStatus === 'ACTIVE' ? (
              <span className="text-[13px] text-ink-500">可以正常接受派单</span>
            ) : (
              <span className="text-[13px] text-ink-500">
                完成培训与考核后由服务督导开放排班
              </span>
            )}
          </div>
        ) : null}
      </Card>

      {/* 上岗进度 */}
      {profile ? (
        <Card className="mt-3">
          <CardHeader title="上岗进度" />
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-3.5">
            {SERVICE_STATUS_FLOW.map((s, i) => {
              const done = currentIndex >= i && currentIndex !== -1;
              return (
                <span key={s} className="flex items-center gap-1.5">
                  <span
                    className={
                      done
                        ? 'rounded-pill bg-brand-600 px-2.5 py-1 text-[12px] font-medium text-white'
                        : 'rounded-pill bg-cream-200 px-2.5 py-1 text-[12px] text-ink-500'
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
      ) : null}

      {/* 服务数据 */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="card px-3 py-3 text-center">
          <p className="text-[20px] font-semibold tabular-nums text-ink-800">{weekCount}</p>
          <p className="mt-0.5 text-[12px] text-ink-500">本周任务</p>
        </div>
        <div className="card px-3 py-3 text-center">
          <p className="text-[20px] font-semibold tabular-nums text-ink-800">{monthCount}</p>
          <p className="mt-0.5 text-[12px] text-ink-500">本月完成</p>
        </div>
        <div className="card px-3 py-3 text-center">
          <p className="text-[20px] font-semibold tabular-nums text-ink-800">
            {profile?.primaryFor.length ?? 0}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-500">固定服务家庭</p>
        </div>
      </div>

      {/* 专业背景 */}
      {profile ? (
        <Card className="mt-3">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-brand-600" />
                专业背景
              </span>
            }
          />
          <div className="px-4 py-3.5">
            {profile.educations.length === 0 ? (
              <p className="text-[14px] text-ink-400">尚未登记</p>
            ) : (
              <ul className="space-y-2">
                {profile.educations.map((e) => (
                  <li key={e.id} className="text-[14px]">
                    <p className="text-ink-800">
                      {e.school} · {e.major} · {EDUCATION_LEVEL_LABELS[e.level]}
                    </p>
                    <p className="mt-0.5">
                      {e.verificationStatus === 'VERIFIED' ? (
                        <Badge tone="brand">
                          <ShieldCheck className="h-3 w-3" />
                          已核验
                        </Badge>
                      ) : (
                        <UnverifiedHint label="学历" />
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      ) : null}

      {/* 能力标签 */}
      {profile && profile.competencies.length > 0 ? (
        <Card className="mt-3">
          <CardHeader title="能力标签" />
          <div className="flex flex-wrap gap-1.5 px-4 py-3.5">
            {profile.competencies.map((c) => (
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
                  ? `（资格：${VERIFICATION_LABELS[c.credentialStatus]}）`
                  : ''}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}

      {/* 待完成培训 */}
      <Card className="mt-3">
        <CardHeader title="待完成培训" subtitle="必修课程未通过时无法接受派单。" />
        {todoTrainings.length === 0 ? (
          <div className="px-4 py-5 text-center text-[14px] text-brand-700">
            所有必修培训都已完成 ✓
          </div>
        ) : (
          <ul className="divide-y divide-cream-100 px-4">
            {todoTrainings.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-3 text-[14px]">
                <span className="min-w-0">
                  <span className="block text-ink-800">{t.course.title}</span>
                  {t.course.isMandatory ? (
                    <Badge tone="info" className="mt-1">
                      必修
                    </Badge>
                  ) : null}
                </span>
                <Badge tone="warm">{TRAINING_STATUS_LABELS[t.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 已完成培训 */}
      {profile && profile.trainings.filter((t) => t.status === 'PASSED').length > 0 ? (
        <Card className="mt-3">
          <CardHeader title="已完成培训" subtitle="公司培训记录，不代表任何法定资格。" />
          <ul className="divide-y divide-cream-100 px-4">
            {profile.trainings
              .filter((t) => t.status === 'PASSED')
              .map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-3 text-[14px]">
                  <span className="min-w-0 text-ink-800">{t.course.title}</span>
                  <span className="shrink-0 text-[12px] text-ink-400">
                    {formatDate(t.completedAt)}
                    {t.examScore != null ? ` · ${t.examScore} 分` : ''}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      ) : null}

      {/* 不可排班时间 */}
      <Card className="mt-3">
        <CardHeader
          title="提交不可排班时间"
          subtitle="休假或有其他安排时提前提交，排班会自动避开。"
        />
        <div className="px-4 py-4">
          <AvailabilityForm />
        </div>
        {profile && profile.availability.length > 0 ? (
          <ul className="divide-y divide-cream-100 border-t border-cream-200 px-4">
            {profile.availability.map((a) => (
              <li key={a.id} className="py-2.5 text-[13px]">
                <span className="text-ink-800">
                  {formatDate(a.startAt)} → {formatDate(a.endAt)}
                </span>
                {a.reason ? <span className="ml-2 text-ink-500">{a.reason}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="还没有提交过不可排班时间" />
        )}
      </Card>

      {/* 退出 */}
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
