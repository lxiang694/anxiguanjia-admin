import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Lock, ShieldAlert } from 'lucide-react';

import { Badge, Card, CardHeader, DescRow, NonMedicalNotice } from '@/components/ui';
import {
  CONSENT_STATUS_LABELS,
  GENDER_LABELS,
  LIVING_STATUS_LABELS,
  MOBILITY_STATUS_LABELS,
  PERMISSION_LABELS,
  READING_SOURCE_LABELS,
  READING_TYPE_LABELS,
} from '@/lib/labels';
import { can, canSeeSensitiveHealth, guardPage } from '@/lib/permissions';
import { ageFromBirthday, formatDate, formatDateTime, maskAddress, maskPhone } from '@/lib/utils';
import { getElder } from '@/services/elder';
import { EditElderForm, SensitiveInfoForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '长辈安心档案' };

export default async function ElderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await guardPage('elder.read');
  const { id } = await params;

  const elder = await getElder(user, id);
  if (!elder) notFound();

  const showSensitive = canSeeSensitiveHealth(user);
  const age = ageFromBirthday(elder.birthday);

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <Link
          href={`/admin/households/${elder.household.id}`}
          className="inline-flex items-center gap-1 text-[13px] text-ink-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {elder.household.name}
        </Link>
        <h1 className="mt-2.5 flex flex-wrap items-center gap-2 text-xl font-semibold text-ink-800">
          {elder.name}
          <span className="text-sm font-normal text-ink-500">
            {GENDER_LABELS[elder.gender]}
            {age ? ` · ${age} 岁` : ''}
          </span>
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {elder.household.householdCode}
          {elder.household.district ? ` · ${elder.household.district.name}` : ''}
          {elder.household.primarySpecialist
            ? ` · 固定安心专员 ${elder.household.primarySpecialist.user.name}`
            : ''}
        </p>
      </div>

      <NonMedicalNotice />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="基本信息" />
            <div className="px-5 py-3">
              <dl className="divide-y divide-cream-100">
                <DescRow label="联系电话">{maskPhone(elder.phone)}</DescRow>
                <DescRow label="居住地址">{maskAddress(elder.address)}</DescRow>
                <DescRow label="出生日期">{formatDate(elder.birthday)}</DescRow>
                <DescRow label="居住情况">
                  {elder.livingStatus ? LIVING_STATUS_LABELS[elder.livingStatus] : '—'}
                </DescRow>
                <DescRow label="行动情况">{MOBILITY_STATUS_LABELS[elder.mobilityStatus]}</DescRow>
              </dl>
            </div>
          </Card>

          {can(user, 'elder.update') ? (
            <EditElderForm
              elder={{
                id: elder.id,
                name: elder.name,
                gender: elder.gender,
                birthday: elder.birthday ? elder.birthday.toISOString().slice(0, 10) : null,
                phone: elder.phone,
                address: elder.address,
                livingStatus: elder.livingStatus,
                mobilityStatus: elder.mobilityStatus,
                livingArrangement: elder.livingArrangement,
                familyRelations: elder.familyRelations,
                dailyRoutine: elder.dailyRoutine,
                activityNotes: elder.activityNotes,
                dietNotes: elder.dietNotes,
                sleepNotes: elder.sleepNotes,
                communicationPrefs: elder.communicationPrefs,
                dailyNeeds: elder.dailyNeeds,
                attentionNotes: elder.attentionNotes,
                emergencyArrangement: elder.emergencyArrangement,
                generalNotes: elder.generalNotes,
              }}
            />
          ) : null}

          <Card>
            <CardHeader
              title="生活情况"
              subtitle="这些是服务必要信息，一线安心专员在任务详情中会看到相关部分。"
            />
            <div className="px-5 py-3">
              <dl className="divide-y divide-cream-100">
                <DescRow label="居住安排">{elder.livingArrangement || '—'}</DescRow>
                <DescRow label="家庭关系">{elder.familyRelations || '—'}</DescRow>
                <DescRow label="日常习惯">{elder.dailyRoutine || '—'}</DescRow>
                <DescRow label="活动情况">{elder.activityNotes || '—'}</DescRow>
                <DescRow label="饮食习惯">{elder.dietNotes || '—'}</DescRow>
                <DescRow label="睡眠情况">{elder.sleepNotes || '—'}</DescRow>
                <DescRow label="沟通偏好">{elder.communicationPrefs || '—'}</DescRow>
                <DescRow label="生活需要">{elder.dailyNeeds || '—'}</DescRow>
                <DescRow label="需要注意事项">{elder.attentionNotes || '—'}</DescRow>
                <DescRow label="紧急联络安排">{elder.emergencyArrangement || '—'}</DescRow>
                <DescRow label="其他备注">{elder.generalNotes || '—'}</DescRow>
              </dl>
            </div>
          </Card>

          {/* 健康敏感信息 —— 按能力裁剪，无权限时数据根本没被查出来 */}
          <Card className={showSensitive ? 'border-warm-200' : undefined}>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  {showSensitive ? (
                    <ShieldAlert className="h-4 w-4 text-warm-500" />
                  ) : (
                    <Lock className="h-4 w-4 text-ink-400" />
                  )}
                  健康敏感信息
                </span>
              }
              subtitle={
                showSensitive
                  ? '本次访问已写入操作日志。请仅在服务必要范围内查看。'
                  : '您的角色不具备查看权限，服务端未返回该部分数据。'
              }
            />
            <div className="px-5 py-4">
              {showSensitive ? (
                elder.sensitive ? (
                  <dl className="divide-y divide-cream-100">
                    <DescRow label="慢性情况">{elder.sensitive.chronicConditions || '—'}</DescRow>
                    <DescRow label="用药情况">{elder.sensitive.medications || '—'}</DescRow>
                    <DescRow label="过敏">{elder.sensitive.allergies || '—'}</DescRow>
                    <DescRow label="医疗资料备注">
                      {elder.sensitive.medicalDocsNotes || '—'}
                    </DescRow>
                    <DescRow label="家庭设定的提醒范围">
                      {[
                        elder.sensitive.bpSystolicMax
                          ? `收缩压 ≤ ${elder.sensitive.bpSystolicMax}`
                          : null,
                        elder.sensitive.bpDiastolicMax
                          ? `舒张压 ≤ ${elder.sensitive.bpDiastolicMax}`
                          : null,
                        elder.sensitive.glucoseMax ? `血糖 ≤ ${elder.sensitive.glucoseMax}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '未设定'}
                      <span className="mt-1 block text-xs text-ink-400">
                        这是家庭自行设定的提醒范围，不是医疗诊断标准。
                      </span>
                    </DescRow>
                  </dl>
                ) : (
                  <p className="text-sm text-ink-400">尚未登记健康敏感信息</p>
                )
              ) : null}

              {showSensitive && can(user, 'elder.sensitive.update') ? (
                <div className="mt-4 border-t border-cream-200 pt-4">
                  <SensitiveInfoForm
                    elderId={elder.id}
                    current={
                      elder.sensitive
                        ? {
                            chronicConditions: elder.sensitive.chronicConditions,
                            medications: elder.sensitive.medications,
                            allergies: elder.sensitive.allergies,
                            medicalDocsNotes: elder.sensitive.medicalDocsNotes,
                            bpSystolicMax: elder.sensitive.bpSystolicMax,
                            bpDiastolicMax: elder.sensitive.bpDiastolicMax,
                            glucoseMax: elder.sensitive.glucoseMax,
                          }
                        : null
                    }
                  />
                </div>
              ) : null}

              {!showSensitive ? (
                <p className="text-sm text-ink-500">
                  慢性情况、用药、健康数值等信息仅对具备相应权限的角色开放。一线安心专员一律不可见。
                </p>
              ) : null}
            </div>
          </Card>

          {showSensitive && elder.readings && elder.readings.length > 0 ? (
            <Card>
              <CardHeader
                title="健康数值记录"
                subtitle="每条数值都记录来源；系统不显示任何疾病诊断。"
              />
              <ul className="divide-y divide-cream-100 px-5">
                {elder.readings.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
                    <span className="font-medium text-ink-800">{READING_TYPE_LABELS[r.type]}</span>
                    <span className="tabular-nums text-ink-700">
                      {r.valuePrimary}
                      {r.valueSecondary != null ? ` / ${r.valueSecondary}` : ''} {r.unit}
                    </span>
                    <Badge tone="neutral">{READING_SOURCE_LABELS[r.source]}</Badge>
                    {r.outsideFamilyRange ? (
                      <Badge tone="warm">超出家庭设定的提醒范围</Badge>
                    ) : null}
                    <span className="ml-auto text-xs text-ink-400">
                      {formatDateTime(r.measuredAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="授权情况" subtitle="谁可以看这位长辈的哪些数据。" />
            <div className="px-5 py-4">
              {elder.consents.length === 0 ? (
                <p className="text-sm text-ink-400">尚未建立授权</p>
              ) : (
                <ul className="space-y-2.5 text-sm">
                  {elder.consents.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-1.5">
                      <span className="text-ink-800">{c.grantee.name}</span>
                      <span className="text-ink-400">·</span>
                      <span className="text-[13px] text-ink-600">
                        {PERMISSION_LABELS[c.permissionType]}
                      </span>
                      <Badge
                        tone={
                          c.status === 'ACTIVE'
                            ? 'brand'
                            : c.status === 'REVOKED'
                              ? 'danger'
                              : 'neutral'
                        }
                      >
                        {CONSENT_STATUS_LABELS[c.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={`/admin/consents?household=${elder.household.id}`}
                className="link mt-3 inline-block text-[13px]"
              >
                管理这个家庭的授权
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="家庭成员" />
            <div className="px-5 py-4">
              {elder.familyMembers.length === 0 ? (
                <p className="text-sm text-ink-400">尚无对应成员</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {elder.familyMembers.map((m) => (
                    <li key={m.id}>
                      {m.user.name}
                      <span className="ml-2 text-xs text-ink-400">{maskPhone(m.user.phone)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="服务概况" />
            <div className="grid grid-cols-3 gap-2 px-5 py-4 text-center">
              <div>
                <p className="text-lg font-semibold tabular-nums text-ink-800">
                  {elder._count.tasks}
                </p>
                <p className="text-xs text-ink-500">服务任务</p>
              </div>
              <div>
                <p className="text-lg font-semibold tabular-nums text-ink-800">
                  {elder._count.visitRecords}
                </p>
                <p className="text-xs text-ink-500">服务记录</p>
              </div>
              <div>
                <p className="text-lg font-semibold tabular-nums text-ink-800">
                  {elder._count.reports}
                </p>
                <p className="text-xs text-ink-500">安心报告</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
