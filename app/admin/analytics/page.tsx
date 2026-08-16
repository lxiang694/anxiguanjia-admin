import { Card, CardHeader, StatTile } from '@/components/ui';
import { guardPage } from '@/lib/permissions';
import { pct } from '@/lib/utils';
import {
  dashboardSummary,
  familySatisfaction,
  renewalRate,
  utilizationMetrics,
} from '@/services/dashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: '运营指标' };

export default async function AnalyticsPage() {
  const user = await guardPage('dashboard.operations', { returnTo: '/admin/analytics' });
  const [{ households, quality, incidents, efficiency, today }, renewal, satisfaction, utilization] =
    await Promise.all([
      dashboardSummary(user),
      renewalRate(user),
      familySatisfaction(user),
      utilizationMetrics(user),
    ]);

  // 先取成局部变量再判空：样本不足时这些值是 null，界面必须显示「—」而不是 0%
  const renewalValue = renewal?.rate ?? null;
  const avgScore = satisfaction?.avgScore ?? null;
  const entitlementUsage = utilization?.entitlementUsage ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">运营指标</h1>
        <p className="mt-1 text-sm text-ink-500">
          全部指标都在您的数据范围内计算 —— 城市负责人看到的只是自己城市的数字。
        </p>
      </div>

      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-ink-700">家庭</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="正式会员" value={households.activeMember} tone="brand" />
          <StatTile label="体验中" value={households.trial} tone="info" />
          <StatTile label="待续费" value={households.renewalDue} tone="warm" />
          <StatTile label="暂停" value={households.paused} />
          <StatTile label="潜在" value={households.lead} />
          <StatTile label="本月新增" value={households.newThisMonth} />
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-ink-700">
          服务质量<span className="ml-2 text-xs font-normal text-ink-400">近 30 天</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="准时率" value={pct(quality?.onTimeRate)} hint="到达不晚于预约 15 分钟" />
          <StatTile label="完成率" value={pct(quality?.completionRate)} />
          <StatTile label="记录及时率" value={pct(quality?.recordTimelyRate)} hint="结束后 24h 内" />
          <StatTile label="报告准时率" value={pct(quality?.reportOnTimeRate)} />
          <StatTile label="取消率" value={pct(quality?.cancelRate)} />
        </div>
        <p className="mt-2 text-xs text-ink-400">
          样本量：{quality?.sampleSize ?? 0} 项任务。样本过小时比率仅供参考。
        </p>
      </section>

      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-ink-700">
          续费<span className="ml-2 text-xs font-normal text-ink-400">近 90 天到期的订阅</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="续费率"
            value={pct(renewalValue)}
            tone={renewalValue != null && renewalValue >= 0.7 ? 'brand' : 'neutral'}
            hint="周期结束日落在区间内的订阅中，产生了续费订单的比例"
          />
          <StatTile label="到期订阅" value={renewal?.due ?? 0} />
          <StatTile label="已续费" value={renewal?.renewed ?? 0} tone="brand" />
          <StatTile
            label="未续费"
            value={renewal?.churned ?? 0}
            tone={(renewal?.churned ?? 0) > 0 ? 'warm' : 'neutral'}
          />
        </div>
        {renewal?.note ? <p className="mt-2 text-xs text-ink-400">{renewal.note}</p> : null}
      </section>

      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-ink-700">
          家庭满意度<span className="ml-2 text-xs font-normal text-ink-400">近 90 天</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="报告平均评分"
            value={avgScore != null ? avgScore.toFixed(1) : '—'}
            hint="家庭对安心报告的 1-5 分评价"
          />
          <StatTile label="评分条数" value={satisfaction?.sampleSize ?? 0} />
          <StatTile
            label="报告已读率"
            value={pct(satisfaction?.readRate ?? null)}
            hint="家庭是否真的在看报告"
          />
          <StatTile label="已发布报告" value={satisfaction?.publishedCount ?? 0} />
        </div>
        <p className="mt-2 text-xs text-ink-400">
          {satisfaction?.note ??
            '满意度只取家庭真实提交的报告评分，系统不生成任何推算分数。'}
        </p>
      </section>

      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-ink-700">利用率</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile
            label="权益利用率"
            value={pct(entitlementUsage)}
            hint="家庭买的次数有没有真的用掉"
            tone={entitlementUsage != null && entitlementUsage < 0.6 ? 'warm' : 'neutral'}
          />
          <StatTile
            label="本期权益/已用"
            value={`${utilization?.usedCount ?? 0} / ${utilization?.entitledCount ?? 0}`}
          />
          <StatTile
            label="专员时间利用率"
            value={pct(utilization?.staffUtilization ?? null)}
            hint="近 4 周实际服务时长 / 名义产能"
          />
          <StatTile label="近 4 周服务时长" value={`${utilization?.servedHours ?? 0} h`} />
          <StatTile label="名义产能" value={`${utilization?.capacityHours ?? 0} h`} />
        </div>
        {utilization?.note ? <p className="mt-2 text-xs text-ink-400">{utilization.note}</p> : null}
      </section>

      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-ink-700">异常事件</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="近 30 天事件数" value={incidents?.total ?? 0} />
          <StatTile
            label="未关闭"
            value={incidents?.open ?? 0}
            tone={(incidents?.open ?? 0) > 0 ? 'danger' : 'neutral'}
          />
          <StatTile
            label="平均处理时长"
            value={
              incidents?.avgHandlingMinutes != null
                ? `${Math.floor(incidents.avgHandlingMinutes / 60)}h ${incidents.avgHandlingMinutes % 60}m`
                : '—'
            }
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-ink-700">人效</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="可排班专员" value={efficiency?.activeStaff ?? 0} />
          <StatTile label="每名专员服务家庭数" value={efficiency?.householdsPerStaff ?? '—'} />
          <StatTile label="每名专员每周任务数" value={efficiency?.tasksPerStaffPerWeek ?? '—'} />
        </div>
      </section>

      <Card>
        <CardHeader title="今日执行情况" />
        <div className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-5">
          <StatTile label="今日服务" value={today.total} />
          <StatTile label="已完成" value={today.completed} tone="brand" />
          <StatTile label="服务中" value={today.inService} tone="info" />
          <StatTile label="未开始" value={today.notStarted} />
          <StatTile label="异常" value={today.abnormal} tone={today.abnormal > 0 ? 'danger' : 'neutral'} />
        </div>
      </Card>
    </div>
  );
}
