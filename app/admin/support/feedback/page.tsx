import Link from 'next/link';
import { MessageSquareHeart } from 'lucide-react';

import { Badge, Card, CardHeader, EmptyState, Table, Td } from '@/components/ui';
import { FEEDBACK_CATEGORY_LABELS, FEEDBACK_STATUS_LABELS } from '@/lib/labels';
import { can, guardPage } from '@/lib/permissions';
import { formatDateTime } from '@/lib/utils';
import { listFeedback } from '@/services/support';
import { HandleFeedbackForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '家庭反馈' };

const KINDS = [
  { value: 'all', label: '全部' },
  { value: 'feedback', label: '一般反馈' },
  { value: 'complaint', label: '投诉' },
  { value: 'consultation', label: '咨询' },
] as const;

const STATUSES = [
  { value: 'OPEN', label: '未结' },
  { value: 'NEW', label: '新建' },
  { value: 'IN_PROGRESS', label: '处理中' },
  { value: 'AWAITING_FAMILY', label: '等待家庭确认' },
  { value: 'RESOLVED', label: '已解决' },
  { value: 'CLOSED', label: '已关闭' },
  { value: 'ALL', label: '全部状态' },
] as const;

const TITLES: Record<string, string> = {
  all: '家庭反馈与投诉',
  feedback: '家庭反馈',
  complaint: '投诉',
  consultation: '咨询',
};

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; status?: string }>;
}) {
  const user = await guardPage('feedback.read', { returnTo: '/admin/support/feedback' });
  const sp = await searchParams;

  const kind = KINDS.find((k) => k.value === sp.kind)?.value ?? 'all';
  const status = STATUSES.find((s) => s.value === sp.status)?.value ?? 'OPEN';

  const cases = await listFeedback(user, { kind, status });

  function href(nextKind: string, nextStatus: string) {
    const p = new URLSearchParams();
    if (nextKind !== 'all') p.set('kind', nextKind);
    if (nextStatus !== 'OPEN') p.set('status', nextStatus);
    const qs = p.toString();
    return `/admin/support/feedback${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">{TITLES[kind]}</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-500">
          反馈与投诉分开统计：投诉率是服务质量指标之一，会影响专员的服务表现评估。
          标记为已解决或关闭时必须写处理结果 —— 与事件中心同一条纪律。
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <Link
              key={k.value}
              href={href(k.value, status)}
              className={
                k.value === kind
                  ? 'rounded-pill bg-brand-700 px-3 py-1.5 text-[13px] font-medium text-white'
                  : 'rounded-pill border border-cream-400 bg-white px-3 py-1.5 text-[13px] text-ink-600 hover:border-brand-300'
              }
            >
              {k.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <Link
              key={s.value}
              href={href(kind, s.value)}
              className={
                s.value === status
                  ? 'rounded-pill bg-ink-700 px-2.5 py-1 text-[12px] font-medium text-white'
                  : 'rounded-pill border border-cream-300 bg-white px-2.5 py-1 text-[12px] text-ink-500 hover:border-brand-300'
              }
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="工单列表" subtitle={`共 ${cases.length} 条`} />
        {cases.length === 0 ? (
          <EmptyState icon={<MessageSquareHeart className="h-5 w-5" />} title="没有符合条件的工单" />
        ) : (
          <Table
            head={['工单号', '提交时间', '家庭', '提交人', '类别', '内容', '性质', '负责人', '状态', '']}
          >
            {cases.map((c) => (
              <tr key={c.id}>
                <Td className="font-mono text-[13px]">{c.caseNo}</Td>
                <Td className="whitespace-nowrap text-[13px]">{formatDateTime(c.createdAt)}</Td>
                <Td>
                  <Link href={`/admin/households/${c.household.id}`} className="link text-[13px]">
                    {c.household.name}
                  </Link>
                </Td>
                <Td className="text-[13px]">{c.submittedBy?.name ?? '—'}</Td>
                <Td className="text-[13px]">{FEEDBACK_CATEGORY_LABELS[c.category]}</Td>
                <Td className="max-w-[18rem]">
                  <span className="block text-[13px] font-medium text-ink-800">{c.subject}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-ink-500">{c.content}</span>
                  {c.resolution ? (
                    <span className="mt-1 block rounded bg-cream-100 px-2 py-1 text-xs text-ink-700">
                      处理结果：{c.resolution}
                    </span>
                  ) : null}
                </Td>
                <Td>
                  {c.isComplaint ? (
                    <Badge tone="danger">投诉</Badge>
                  ) : c.category === 'CONSULTATION' ? (
                    <Badge tone="info">咨询</Badge>
                  ) : (
                    <Badge tone="neutral">反馈</Badge>
                  )}
                </Td>
                <Td className="text-[13px]">{c.assignee?.name ?? '待指派'}</Td>
                <Td>
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
                </Td>
                <Td>
                  {can(user, 'feedback.handle') ? (
                    <HandleFeedbackForm caseId={c.id} status={c.status} />
                  ) : null}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
