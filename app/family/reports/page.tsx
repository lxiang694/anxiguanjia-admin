import Link from 'next/link';
import { ChevronRight, FileHeart, Lock } from 'lucide-react';

import { Card, CardHeader, EmptyState } from '@/components/ui';
import { guardPortal } from '@/lib/permissions';
import { formatDate } from '@/lib/utils';
import { myReports } from '@/services/family';

export const dynamic = 'force-dynamic';
export const metadata = { title: '安心报告' };

export default async function FamilyReportsPage() {
  const user = await guardPortal('family');
  const reports = await myReports(user);

  return (
    <div className="px-4 py-6">
      <header className="mb-5">
        <h1 className="text-[24px] font-semibold text-ink-800">安心报告</h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-500">
          每份报告都由我们的同事根据安心专员的服务记录整理，并经人工确认后才发给您。
        </p>
      </header>

      {reports.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Lock className="h-5 w-5" />}
            title="目前没有可查看的报告"
            description="可能是本周报告还在整理，也可能是您还没有获得「安心报告」的查看授权。可以到「我的 → 谁可以看到什么」了解。"
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id}>
              <Link
                href={`/family/reports/${r.id}`}
                className="card flex items-center gap-3 px-5 py-4 active:scale-[0.995]"
              >
                <FileHeart className="h-5 w-5 shrink-0 text-warm-500" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-semibold text-ink-800">{r.title}</span>
                  <span className="mt-0.5 block text-[13.5px] text-ink-500">
                    {formatDate(r.periodStart)} — {formatDate(r.periodEnd)}
                    {r.elder ? ` · ${r.elder.name}` : ''}
                  </span>
                  <span className="mt-1 block text-[13px] text-ink-500">
                    本周上门 {r.visitCount} 次 · 电话关怀 {r.phoneCareCount} 次
                  </span>
                </span>
                {!r.firstReadAt ? (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-warm-400" />
                ) : null}
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-5">
        <CardHeader title="关于这些报告" />
        <ul className="list-disc space-y-1.5 px-5 py-4 pl-9 text-[13.5px] leading-relaxed text-ink-600">
          <li>报告内容全部来自安心专员当天的服务记录，我们不会写入没有发生过的事。</li>
          <li>每份报告在发给您之前，都由公司同事逐句核对原始记录后确认。</li>
          <li>报告描述的是我们看到的情况与长辈本人的说法，不构成任何医疗诊断。</li>
        </ul>
      </Card>
    </div>
  );
}
