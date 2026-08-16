import { Card, CardHeader, NonMedicalNotice } from '@/components/ui';
import { PERMISSION_DESCRIPTIONS, PERMISSION_LABELS } from '@/lib/labels';
import { SPECIALIST_ACCESS_WINDOW_DAYS, guardPage } from '@/lib/permissions';

export const dynamic = 'force-dynamic';
export const metadata = { title: '隐私与授权' };

export default async function PrivacyPage() {
  await guardPage('system.settings', { returnTo: '/admin/system/privacy' });

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">隐私与授权</h1>
        <p className="mt-1 text-sm text-ink-500">
          本页说明系统实际执行的隐私规则。这些规则写在服务端，不是界面上的提示文案。
        </p>
      </div>

      <Card>
        <CardHeader title="第一原则：付款权 ≠ 数据查看权" />
        <div className="space-y-2.5 px-5 py-4 text-[13px] leading-relaxed text-ink-600">
          <p>
            子女支付服务费，不代表自动获得父母的全部个人信息。系统里没有任何一处会因为
            <code className="mx-1 rounded bg-cream-100 px-1 font-mono">isPayer = true</code>
            而放宽数据访问。
          </p>
          <p>
            家庭成员对某位长辈某一类数据的每一次访问，都必须能在 Consent 表里找到一条有效
            （未过期、未撤回）的授权记录。授权不足时，数据根本不会进入返回值 —— 而不是返回后由前端隐藏。
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="授权类型与粒度" subtitle="刻意按业务可理解的粒度划分，而不是技术字段级。" />
        <ul className="divide-y divide-cream-100 px-5">
          {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
            <li key={key} className="py-2.5 text-sm">
              <p className="font-medium text-ink-800">{label}</p>
              <p className="mt-0.5 text-[13px] text-ink-500">
                {PERMISSION_DESCRIPTIONS[key as keyof typeof PERMISSION_DESCRIPTIONS]}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="授权记录保留规则" />
        <ul className="list-disc space-y-1.5 px-5 py-4 pl-9 text-[13px] leading-relaxed text-ink-600">
          <li>每次变更以新版本方式写入，旧记录不被覆盖 —— 旧授权是历史事实。</li>
          <li>同一组合（长辈 × 被授权人 × 授权内容）同时只有一条有效版本。</li>
          <li>记录授权人、被授权人、内容、开始时间、截止时间、是否撤回、撤回时间、版本、授权依据。</li>
          <li>授权变更同时写入审计日志与家庭时间线，家庭自己能看到授权被谁在什么时候改过。</li>
        </ul>
      </Card>

      <Card>
        <CardHeader title="一线安心专员的数据范围" />
        <ul className="list-disc space-y-1.5 px-5 py-4 pl-9 text-[13px] leading-relaxed text-ink-600">
          <li>固定专员与备用专员：对所服务家庭保持长期访问。</li>
          <li>
            临时派单：仅在任务未结案，或任务时间落在前后
            {' '}{SPECIALIST_ACCESS_WINDOW_DAYS}{' '}
            天窗口内时可见 —— 一次代班不会换来对该家庭的长期访问权。
          </li>
          <li>专员之间互相看不到对方负责的家庭与任务。</li>
          <li>任务详情不包含：套餐支付价格、家庭财务资料、其他专员的内部评价、无关敏感健康信息。</li>
          <li>健康敏感信息（慢性情况 / 用药 / 健康数值）对一线专员一律不可见。</li>
        </ul>
      </Card>

      <Card>
        <CardHeader title="定位与照片" />
        <ul className="list-disc space-y-1.5 px-5 py-4 pl-9 text-[13px] leading-relaxed text-ink-600">
          <li>定位只在「到达签到」时记录一次，系统不做 24 小时持续定位。</li>
          <li>坐标缺失不阻断服务开始（室内定位常常失败）。</li>
          <li>照片、证书、合同存放在私有对象存储，不建立公开 URL；查看时按权限生成短时效签名地址。</li>
        </ul>
      </Card>

      <Card>
        <CardHeader title="健康信息的表述边界" />
        <div className="space-y-3 px-5 py-4">
          <NonMedicalNotice />
          <ul className="list-disc space-y-1.5 pl-4 text-[13px] leading-relaxed text-ink-600">
            <li>服务记录只允许「观察到的事实」或「本人反映」，不允许诊断性表述。</li>
            <li>每条健康数值必须记录来源（本人测量 / 家庭提供 / 专员协助 / 医疗资料）。</li>
            <li>
              系统只显示「超出家庭设定的提醒范围」，并明确标注这不是医疗诊断；
              不显示任何疾病判断。
            </li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
