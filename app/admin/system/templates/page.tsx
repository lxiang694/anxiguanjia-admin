import { Badge, Card, CardHeader } from '@/components/ui';
import {
  NOTIFICATION_TEMPLATE_EVENT_LABELS,
  NOTIFICATION_TEMPLATE_VARS,
} from '@/lib/labels';
import { guardPage } from '@/lib/permissions';
import { listNotificationTemplates } from '@/services/settings';
import { TemplateForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: '通知模板' };

const EVENTS = Object.keys(
  NOTIFICATION_TEMPLATE_EVENT_LABELS,
) as (keyof typeof NOTIFICATION_TEMPLATE_EVENT_LABELS)[];

/** 各场景的默认文案建议，仅在未配置时作为占位提示 */
const SUGGESTED: Record<string, { title: string; body: string }> = {
  SERVICE_COMPLETED: {
    title: '本次{{serviceType}}已完成',
    body: '{{specialistName}}于{{serviceTime}}完成了对{{elderName}}的服务。',
  },
  REPORT_PUBLISHED: { title: '本周安心报告已生成', body: '{{reportTitle}}' },
  NEXT_SERVICE_REMINDER: {
    title: '下一次服务安排',
    body: '{{elderName}}的{{serviceType}}安排在{{serviceTime}}，由{{specialistName}}前往。',
  },
  SPECIALIST_CHANGED: {
    title: '固定家庭安心专员有调整',
    body: '{{elderName}}的服务由{{fromSpecialist}}调整为{{toSpecialist}}。原因：{{reason}}',
  },
  SCHEDULE_CHANGED: {
    title: '服务时间有调整',
    body: '{{elderName}}的服务时间由{{oldTime}}调整为{{newTime}}。',
  },
  MEMBERSHIP_EXPIRING: {
    title: '会员即将到期',
    body: '{{householdName}}的{{planName}}将于{{expireDate}}到期。',
  },
  INCIDENT_URGENT: {
    title: '需要您立即确认的现场情况',
    body: '{{occurredAt}} {{elderName}}处发生{{incidentType}}：{{description}}',
  },
  CANNOT_REACH_ELDER: {
    title: '安心专员到达后无法联系长辈',
    body: '{{specialistName}}于{{occurredAt}}到达后未能联系上{{elderName}}，服务督导正在处理。',
  },
};

export default async function TemplatesPage() {
  await guardPage('system.settings', { returnTo: '/admin/system/templates' });
  const templates = await listNotificationTemplates();
  const byEvent = new Map(templates.map((t) => [t.event, t]));

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-800">通知模板</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-500">
          按场景配置通知的标题与正文。
          <strong>第一版只有站内通知会真正送达</strong>
          ；短信、微信、企业微信可以先勾上，但界面会明确标注渠道尚未接入，系统不会假装已发送。
        </p>
      </div>

      <Card>
        <CardHeader title="占位符规则" />
        <div className="px-5 py-4 text-[13px] leading-relaxed text-ink-600">
          <p>
            模板里用 <code className="rounded bg-cream-100 px-1 font-mono">{'{{变量名}}'}</code>{' '}
            插入内容。保存时系统会校验变量是否属于该场景 —— 写了不支持的变量会被拒绝，
            避免家庭真的收到一条带 <code className="font-mono">{'{{xxx}}'}</code> 的通知。
          </p>
          <p className="mt-2 text-ink-500">
            另外：家庭端能不能收到某条通知，最终仍由 Consent 授权决定。
            这里的「所需授权」只是把这层关系写清楚，真正的过滤在发送逻辑里。
          </p>
        </div>
      </Card>

      {EVENTS.map((ev) => {
        const t = byEvent.get(ev);
        return (
          <Card key={ev}>
            <CardHeader
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {NOTIFICATION_TEMPLATE_EVENT_LABELS[ev]}
                  {t?.isActive ? (
                    <Badge tone="brand">启用</Badge>
                  ) : t ? (
                    <Badge tone="neutral">停用</Badge>
                  ) : (
                    <Badge tone="warm">未配置</Badge>
                  )}
                </span>
              }
              subtitle={`可用变量：${NOTIFICATION_TEMPLATE_VARS[ev].join(' ')}`}
            />
            <div className="px-5 py-4">
              <TemplateForm
                event={ev}
                vars={NOTIFICATION_TEMPLATE_VARS[ev]}
                current={
                  t
                    ? {
                        name: t.name,
                        level: t.level,
                        titleTemplate: t.titleTemplate,
                        bodyTemplate: t.bodyTemplate,
                        enabledChannels: t.enabledChannels,
                        requiredPermission: t.requiredPermission,
                        isActive: t.isActive,
                      }
                    : null
                }
                suggested={SUGGESTED[ev]}
                defaultName={NOTIFICATION_TEMPLATE_EVENT_LABELS[ev]}
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
