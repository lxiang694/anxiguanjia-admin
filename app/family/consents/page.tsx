import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

import { Badge, Card, CardHeader, EmptyState } from '@/components/ui';
import { PERMISSION_DESCRIPTIONS, PERMISSION_LABELS } from '@/lib/labels';
import { guardPortal } from '@/lib/permissions';
import { formatDate } from '@/lib/utils';
import { myConsentView } from '@/services/family';
import { RevokeMyConsentButton } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '谁可以看到什么' };

const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS) as (keyof typeof PERMISSION_LABELS)[];

export default async function FamilyConsentsPage() {
  const user = await guardPortal('family');
  const view = await myConsentView(user);

  if (!view) {
    return (
      <div className="px-4 py-6">
        <Card>
          <EmptyState title="还没有找到您的家庭" />
        </Card>
      </div>
    );
  }

  const { elders, members, consents, currentUserId } = view;

  return (
    <div className="px-4 py-6">
      <Link
        href="/family/me"
        className="inline-flex items-center gap-1 text-[13px] text-ink-500 active:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" />
        我的
      </Link>

      <header className="mt-3 mb-5">
        <h1 className="text-[24px] font-semibold text-ink-800">谁可以看到什么</h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-500">
          支付服务费不会自动获得查看权限。每一项都需要长辈本人（或法定监护人）明确同意，
          这是为了保护长辈自己的意愿。
        </p>
      </header>

      {elders.length === 0 ? (
        <Card>
          <EmptyState title="长辈档案还在建立中" />
        </Card>
      ) : (
        elders.map((elder) => (
          <Card key={elder.id} className="mb-4 overflow-hidden">
            <CardHeader title={elder.name} subtitle="下面列出每位家庭成员目前可以看到的内容。" />
            <div className="divide-y divide-cream-200">
              {members.map((m) => {
                const held = consents.filter(
                  (c) => c.elderId === elder.id && c.granteeId === m.user.id,
                );
                const isMe = m.user.id === currentUserId;

                return (
                  <div key={m.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[16px] font-medium text-ink-800">{m.user.name}</span>
                      {isMe ? <Badge tone="brand">我</Badge> : null}
                      {m.isPayer ? <Badge tone="neutral">付款人</Badge> : null}
                    </div>

                    {held.length === 0 ? (
                      <p className="mt-2 text-[14px] text-ink-500">
                        目前没有任何查看权限。
                        {m.isPayer ? '（即使是付款人也需要单独授权）' : ''}
                      </p>
                    ) : (
                      <ul className="mt-2.5 space-y-2">
                        {held.map((c) => (
                          <li
                            key={c.id}
                            className="flex flex-wrap items-center gap-2 rounded-lg bg-cream-100 px-3 py-2.5"
                          >
                            <ShieldCheck className="h-4 w-4 shrink-0 text-brand-600" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[14.5px] font-medium text-ink-800">
                                {PERMISSION_LABELS[c.permissionType]}
                              </span>
                              <span className="mt-0.5 block text-[12.5px] text-ink-500">
                                {c.expiresAt ? `有效至 ${formatDate(c.expiresAt)}` : '长期有效'}
                              </span>
                            </span>
                            {c.grantorId === currentUserId ? (
                              <RevokeMyConsentButton consentId={c.id} />
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))
      )}

      <Card className="mt-4">
        <CardHeader title="七类授权分别是什么" />
        <ul className="divide-y divide-cream-100 px-5">
          {PERMISSION_KEYS.map((k) => (
            <li key={k} className="py-3">
              <p className="text-[15px] font-medium text-ink-800">{PERMISSION_LABELS[k]}</p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-500">
                {PERMISSION_DESCRIPTIONS[k]}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4">
        <CardHeader title="想新增或修改授权？" />
        <div className="px-5 py-4 text-[14px] leading-relaxed text-ink-600">
          <p>
            新增授权需要长辈本人确认意愿，所以不能在 App 上单方面添加。
            请联系您的家庭安心顾问，我们会上门或电话与长辈确认后办理。
          </p>
          <p className="mt-2 text-ink-500">
            您自己给出的授权，可以在上面直接撤回，立即生效。
          </p>
        </div>
      </Card>
    </div>
  );
}
