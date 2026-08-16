import Link from 'next/link';
import { ClipboardCheck } from 'lucide-react';

import { Badge, Card, CardHeader, EmptyState, Table, Td } from '@/components/ui';
import { TRAINING_STATUS_LABELS } from '@/lib/labels';
import { guardPage } from '@/lib/permissions';
import { formatDate } from '@/lib/utils';
import { gradedExams, pendingExams } from '@/services/training';
import { GradeForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '考核管理' };

export default async function ExamsPage() {
  const user = await guardPage('staff.training.manage', { returnTo: '/admin/staff/exams' });
  const [pending, graded] = await Promise.all([pendingExams(user), gradedExams(user)]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">考核管理</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-500">
          录入成绩时，通过与否由课程的及格分自动判定 ——
          <strong>系统不允许在未达及格分的情况下手动标「通过」</strong>。
          这是为了让「已通过培训」这句话在对家庭展示时是可信的。
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="待考核" subtitle={`${pending.length} 条`} />
        {pending.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="h-5 w-5 text-brand-500" />}
            title="没有待考核的记录"
            description="在「培训管理」为成员登记课程后，需要考核的课程会出现在这里。"
          />
        ) : (
          <Table head={['成员', '区域', '课程', '必修', '及格分', '当前状态', '录入成绩']}>
            {pending.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link href={`/admin/staff/${r.staffProfileId}`} className="link font-medium">
                    {r.staffProfile.user.name}
                  </Link>
                  <span className="mt-0.5 block font-mono text-xs text-ink-400">
                    {r.staffProfile.employeeCode}
                  </span>
                </Td>
                <Td className="text-[13px]">{r.staffProfile.district?.name ?? '—'}</Td>
                <Td className="text-[13px]">{r.course.title}</Td>
                <Td>{r.course.isMandatory ? <Badge tone="info">必修</Badge> : '—'}</Td>
                <Td className="text-[13px] tabular-nums">{r.course.passingScore ?? 60}</Td>
                <Td>
                  <Badge tone={r.status === 'NEEDS_RETRAIN' || r.status === 'FAILED' ? 'danger' : 'warm'}>
                    {TRAINING_STATUS_LABELS[r.status]}
                  </Badge>
                </Td>
                <Td>
                  <GradeForm recordId={r.id} passingScore={r.course.passingScore ?? 60} />
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="已完成考核" subtitle="近 100 条" />
        {graded.length === 0 ? (
          <EmptyState title="还没有已完成的考核" />
        ) : (
          <Table head={['成员', '课程', '成绩', '及格分', '结果', '完成日期', '有效期至']}>
            {graded.map((r) => (
              <tr key={r.id}>
                <Td className="font-medium">{r.staffProfile.user.name}</Td>
                <Td className="text-[13px]">{r.course.title}</Td>
                <Td className="tabular-nums font-medium">{r.examScore}</Td>
                <Td className="text-[13px] tabular-nums">{r.course.passingScore ?? 60}</Td>
                <Td>
                  <Badge tone={r.status === 'PASSED' ? 'brand' : 'danger'}>
                    {TRAINING_STATUS_LABELS[r.status]}
                  </Badge>
                </Td>
                <Td className="text-[13px]">{formatDate(r.completedAt)}</Td>
                <Td className="text-[13px]">{r.expiresAt ? formatDate(r.expiresAt) : '长期'}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
