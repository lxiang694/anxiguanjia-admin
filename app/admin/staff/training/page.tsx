import { Card, CardHeader, EmptyState, Badge, Table, Td } from '@/components/ui';
import { prisma } from '@/lib/db';
import { TRAINING_STATUS_LABELS, TRAINING_TYPE_LABELS } from '@/lib/labels';
import { guardPage } from '@/lib/permissions';
import { formatDate } from '@/lib/utils';
import { EditCourseForm, EnrollForm, NewCourseForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '培训管理' };

export default async function TrainingPage() {
  await guardPage('staff.training.manage', { returnTo: '/admin/staff/training' });

  const [courses, records, staff] = await Promise.all([
    prisma.trainingCourse.findMany({
      where: { isActive: true },
      include: { _count: { select: { records: true } } },
      orderBy: [{ isMandatory: 'desc' }, { title: 'asc' }],
    }),
    prisma.trainingRecord.findMany({
      include: {
        course: { select: { title: true, isMandatory: true } },
        staffProfile: { include: { user: { select: { name: true } } } },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 200,
    }),
    prisma.staffProfile.findMany({
      where: { deletedAt: null, employmentStatus: { not: 'RESIGNED' } },
      select: { id: true, employeeCode: true, user: { select: { name: true } } },
      orderBy: { employeeCode: 'asc' },
    }),
  ]);

  const staffOptions = staff.map((s) => ({
    id: s.id,
    name: s.user.name,
    employeeCode: s.employeeCode,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">培训管理</h1>
        <p className="mt-1 text-sm text-ink-500">
          公司培训只代表公司内部完成了相应课程与考核，不等同于任何法定资格。
        </p>
      </div>

      <NewCourseForm />

      {staffOptions.length > 0 && courses.length > 0 ? (
        <Card>
          <CardHeader title="为成员登记培训" subtitle="登记后，需要考核的课程会出现在「考核管理」里等待录入成绩。" />
          <div className="px-5 py-4">
            <EnrollForm
              staff={staffOptions}
              courses={courses.map((c) => ({ id: c.id, title: c.title }))}
            />
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader title="课程" subtitle="必修课程未通过（或已过期）的成员不可被派单。" />
        {courses.length === 0 ? (
          <EmptyState title="还没有课程" />
        ) : (
          <Table head={['课程名称', '类型', '学时', '必修', '需考核', '及格分', '有效期', '已登记记录', '']}>
            {courses.map((c) => (
              <tr key={c.id}>
                <Td className="font-medium">{c.title}</Td>
                <Td className="text-[13px]">{TRAINING_TYPE_LABELS[c.type]}</Td>
                <Td className="text-[13px] tabular-nums">{c.creditHours}</Td>
                <Td>{c.isMandatory ? <Badge tone="info">必修</Badge> : '—'}</Td>
                <Td className="text-[13px]">{c.requiresExam ? '是' : '否'}</Td>
                <Td className="text-[13px] tabular-nums">{c.passingScore ?? '—'}</Td>
                <Td className="text-[13px]">{c.validMonths ? `${c.validMonths} 个月` : '长期'}</Td>
                <Td className="text-[13px] tabular-nums">{c._count.records}</Td>
                <Td>
                  <EditCourseForm
                    course={{
                      id: c.id,
                      title: c.title,
                      type: c.type,
                      description: c.description,
                      creditHours: c.creditHours,
                      isMandatory: c.isMandatory,
                      validMonths: c.validMonths,
                      requiresExam: c.requiresExam,
                      passingScore: c.passingScore,
                      isActive: c.isActive,
                    }}
                  />
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="培训记录" subtitle={`共 ${records.length} 条`} />
        {records.length === 0 ? (
          <EmptyState title="还没有培训记录" />
        ) : (
          <Table head={['成员', '课程', '必修', '状态', '成绩', '完成日期', '有效期至', '培训负责人']}>
            {records.map((r) => (
              <tr key={r.id}>
                <Td className="font-medium">{r.staffProfile.user.name}</Td>
                <Td className="text-[13px]">{r.course.title}</Td>
                <Td>{r.course.isMandatory ? <Badge tone="info">必修</Badge> : '—'}</Td>
                <Td>
                  <Badge
                    tone={
                      r.status === 'PASSED'
                        ? 'brand'
                        : r.status === 'FAILED' || r.status === 'NEEDS_RETRAIN'
                          ? 'danger'
                          : 'warm'
                    }
                  >
                    {TRAINING_STATUS_LABELS[r.status]}
                  </Badge>
                </Td>
                <Td className="text-[13px] tabular-nums">{r.examScore ?? '—'}</Td>
                <Td className="text-[13px]">{formatDate(r.completedAt)}</Td>
                <Td className="text-[13px]">{r.expiresAt ? formatDate(r.expiresAt) : '长期'}</Td>
                <Td className="text-[13px]">{r.instructorName ?? '—'}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
