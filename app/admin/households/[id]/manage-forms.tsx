'use client';

import { useState } from 'react';
import { Plus, UserPlus } from 'lucide-react';

import {
  addFamilyMemberAction,
  changeSpecialistAction,
  createElderAction,
  createSubscriptionAction,
  saveHouseholdPlanAction,
  updateHouseholdStatusAction,
} from '@/app/actions/admin';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';
import { Button } from '@/components/ui';
import {
  HOUSEHOLD_STATUS_LABELS,
  LIVING_STATUS_LABELS,
  MOBILITY_STATUS_LABELS,
  RELATIONSHIP_LABELS,
} from '@/lib/labels';

/**
 * Household 360° 里的写操作表单。
 *
 * 这些表单补的是之前最要紧的缺口：家庭建档之后，运营必须能在界面上
 * 建长辈、加成员、推进状态、制定执行计划、开通订阅、更换固定专员 ——
 * 否则「从零建一户」在界面上是断的，只能靠 seed 数据演示。
 *
 * 统一采用「默认收起、点开才展开」，避免 360° 页面被表单塞满。
 */

function Collapsible({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {icon ?? <Plus className="h-3.5 w-3.5" />}
        {label}
      </Button>
    );
  }
  return (
    <div className="rounded-card border border-cream-300 bg-cream-50 px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-ink-800">{label}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[13px] text-ink-500 hover:text-ink-700"
        >
          收起
        </button>
      </div>
      {children}
    </div>
  );
}

const LIVING_KEYS = Object.keys(LIVING_STATUS_LABELS) as (keyof typeof LIVING_STATUS_LABELS)[];
const MOBILITY_KEYS = Object.keys(MOBILITY_STATUS_LABELS) as (keyof typeof MOBILITY_STATUS_LABELS)[];
const RELATION_KEYS = Object.keys(RELATIONSHIP_LABELS) as (keyof typeof RELATIONSHIP_LABELS)[];
const STATUS_KEYS = Object.keys(HOUSEHOLD_STATUS_LABELS) as (keyof typeof HOUSEHOLD_STATUS_LABELS)[];

/* ============================== 新增长辈 ============================== */

export function AddElderForm({ householdId }: { householdId: string }) {
  return (
    <Collapsible label="新增长辈档案">
      <ActionForm
        action={createElderAction}
        successMessage="长辈档案已建立"
        hiddenFields={{ householdId }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="elder-name">
              姓名 <span className="text-danger-500">*</span>
            </label>
            <input id="elder-name" name="name" required maxLength={40} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="elder-gender">
              性别
            </label>
            <select id="elder-gender" name="gender" className="field" defaultValue="UNDISCLOSED">
              <option value="FEMALE">女</option>
              <option value="MALE">男</option>
              <option value="UNDISCLOSED">未填写</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="elder-birthday">
              出生日期
            </label>
            <input id="elder-birthday" name="birthday" type="date" className="field" />
          </div>
          <div>
            <label className="label" htmlFor="elder-phone">
              联系电话
            </label>
            <input id="elder-phone" name="phone" maxLength={30} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="elder-living">
              居住情况
            </label>
            <select id="elder-living" name="livingStatus" className="field" defaultValue="">
              <option value="">暂未了解</option>
              {LIVING_KEYS.map((k) => (
                <option key={k} value={k}>
                  {LIVING_STATUS_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="elder-mobility">
              行动情况
            </label>
            <select
              id="elder-mobility"
              name="mobilityStatus"
              className="field"
              defaultValue="UNKNOWN"
            >
              {MOBILITY_KEYS.map((k) => (
                <option key={k} value={k}>
                  {MOBILITY_STATUS_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="elder-needs">
            生活需要
          </label>
          <textarea
            id="elder-needs"
            name="dailyNeeds"
            rows={2}
            maxLength={500}
            placeholder="例：协助购买米面油等重物；协助使用手机与子女视频"
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="elder-comm">
            沟通偏好
          </label>
          <input
            id="elder-comm"
            name="communicationPrefs"
            maxLength={300}
            placeholder="例：说话请慢一些、音量稍大；不喜欢被追问身体"
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="elder-attention">
            需要注意事项
          </label>
          <textarea
            id="elder-attention"
            name="attentionNotes"
            rows={2}
            maxLength={500}
            placeholder="会展示给上门的安心专员，只写服务必要信息"
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="elder-emergency">
            紧急联络安排
          </label>
          <input
            id="elder-emergency"
            name="emergencyArrangement"
            maxLength={300}
            className="field"
          />
        </div>

        <p className="rounded-lg bg-white px-3 py-2 text-xs leading-relaxed text-ink-500">
          这里只登记生活情况。慢性情况、用药等健康敏感信息请在长辈档案详情页单独录入 ——
          那部分受更严的权限控制，一线安心专员不可见。
        </p>

        <SubmitButton>建立长辈档案</SubmitButton>
      </ActionForm>
    </Collapsible>
  );
}

/* ============================== 新增家庭成员 ============================== */

export function AddMemberForm({
  householdId,
  elders,
}: {
  householdId: string;
  elders: { id: string; name: string }[];
}) {
  return (
    <Collapsible label="新增家庭成员" icon={<UserPlus className="h-3.5 w-3.5" />}>
      <ActionForm
        action={addFamilyMemberAction}
        successMessage="成员已加入"
        hiddenFields={{ householdId }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="m-name">
              姓名 <span className="text-danger-500">*</span>
            </label>
            <input id="m-name" name="name" required maxLength={40} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="m-relationship">
              与长辈关系 <span className="text-danger-500">*</span>
            </label>
            <select id="m-relationship" name="relationship" required className="field" defaultValue="DAUGHTER">
              {RELATION_KEYS.map((k) => (
                <option key={k} value={k}>
                  {RELATIONSHIP_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="m-phone">
              手机号 <span className="text-danger-500">*</span>
            </label>
            <input id="m-phone" name="phone" required maxLength={20} className="field" />
            <p className="mt-1 text-xs text-ink-400">这也是家庭端的登录帐号。</p>
          </div>
          <div>
            <label className="label" htmlFor="m-email">
              邮箱
            </label>
            <input id="m-email" name="email" type="email" className="field" />
          </div>
          <div>
            <label className="label" htmlFor="m-elder">
              主要对应长辈
            </label>
            <select id="m-elder" name="elderId" className="field" defaultValue="">
              <option value="">整个家庭</option>
              {elders.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="m-password">
              初始密码 <span className="text-danger-500">*</span>
            </label>
            <input
              id="m-password"
              name="password"
              type="text"
              required
              minLength={10}
              className="field"
              placeholder="至少 10 位，含三类字符"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-[13px] text-ink-700">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="isPayer" className="h-4 w-4 rounded" />
            付款人
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="isPrimaryContact" className="h-4 w-4 rounded" />
            主要联络人
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="isEmergencyContact" className="h-4 w-4 rounded" />
            紧急联络人
          </label>
        </div>

        <p className="rounded-lg bg-warm-50 px-3 py-2 text-xs leading-relaxed text-warm-700">
          <strong>注意</strong>：新增成员<strong>不会</strong>附带任何查看授权，勾选「付款人」也不会。
          请在长辈本人（或法定监护人）同意后，到「授权」页逐项建立。
          <br />
          初始密码由您当面或电话告知本人 —— 第一版没有短信渠道，系统不会自动发送。
        </p>

        <SubmitButton>加入家庭并创建帐号</SubmitButton>
      </ActionForm>
    </Collapsible>
  );
}

/* ============================== 家庭状态推进 ============================== */

export function HouseholdStatusForm({
  householdId,
  current,
}: {
  householdId: string;
  current: string;
}) {
  return (
    <Collapsible label="变更家庭状态">
      <ActionForm
        action={updateHouseholdStatusAction}
        successMessage="家庭状态已更新"
        hiddenFields={{ householdId }}
      >
        <div>
          <label className="label" htmlFor="hh-status">
            当前：{HOUSEHOLD_STATUS_LABELS[current as keyof typeof HOUSEHOLD_STATUS_LABELS]}
          </label>
          <select id="hh-status" name="status" className="field" defaultValue={current}>
            {STATUS_KEYS.map((k) => (
              <option key={k} value={k}>
                {HOUSEHOLD_STATUS_LABELS[k]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-400">
            切换到「正式会员」时会记录加入时间。状态只影响 CRM 视图与统计，不会自动改动订阅。
          </p>
        </div>
        <SubmitButton>更新状态</SubmitButton>
      </ActionForm>
    </Collapsible>
  );
}

/* ============================== 更换固定专员 ============================== */

export function ChangeSpecialistForm({
  householdId,
  staff,
  currentId,
}: {
  householdId: string;
  staff: { id: string; name: string; employeeCode: string }[];
  currentId: string | null;
}) {
  return (
    <Collapsible label="更换固定安心专员">
      <ActionForm
        action={changeSpecialistAction}
        successMessage="已更换，并已通知家庭"
        hiddenFields={{ householdId }}
      >
        <div>
          <label className="label" htmlFor="cs-staff">
            新的固定专员
          </label>
          <select
            id="cs-staff"
            name="staffProfileId"
            className="field"
            defaultValue={currentId ?? ''}
          >
            <option value="">暂不指派</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}（{s.employeeCode}）
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-400">只列出服务状态为「可排班」的成员。</p>
        </div>
        <div>
          <label className="label" htmlFor="cs-reason">
            更换原因 <span className="text-danger-500">*</span>
          </label>
          <textarea
            id="cs-reason"
            name="reason"
            rows={2}
            required
            maxLength={300}
            placeholder="例：李晨调整服务区域，由周敏接手，已提前与家庭沟通。"
            className="field"
          />
          <p className="mt-1 text-xs text-warm-600">
            固定专员制度是品牌承诺，更换必须留原因；系统会写入变更记录并通知家庭。
          </p>
        </div>
        <SubmitButton variant="warm">更换并通知家庭</SubmitButton>
      </ActionForm>
    </Collapsible>
  );
}

/* ============================== 家庭执行计划 ============================== */

export function HouseholdPlanForm({
  householdId,
  plans,
  current,
}: {
  householdId: string;
  plans: { id: string; name: string }[];
  current: {
    planId: string | null;
    visitsPerWeek: number;
    phoneCarePerWeek: number;
    reportsPerWeek: number;
    preferredWeekday: number | null;
    preferredWindow: string | null;
    executionNotes: string | null;
  } | null;
}) {
  const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return (
    <Collapsible label={current ? '调整家庭执行计划' : '制定家庭执行计划'}>
      <ActionForm
        action={saveHouseholdPlanAction}
        successMessage="执行计划已保存"
        hiddenFields={{ householdId }}
      >
        <div>
          <label className="label" htmlFor="hp-plan">
            对应商业方案
          </label>
          <select id="hp-plan" name="planId" className="field" defaultValue={current?.planId ?? ''}>
            <option value="">不关联</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-400">
            方案是商业产品；这份执行计划才是排班真正读取的对象，两者刻意解耦。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="hp-visits">
              每周上门
            </label>
            <input
              id="hp-visits"
              name="visitsPerWeek"
              type="number"
              step="0.5"
              min={0}
              max={21}
              defaultValue={current?.visitsPerWeek ?? 1}
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor="hp-phone">
              每周电话关怀
            </label>
            <input
              id="hp-phone"
              name="phoneCarePerWeek"
              type="number"
              step="0.5"
              min={0}
              max={21}
              defaultValue={current?.phoneCarePerWeek ?? 2}
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor="hp-reports">
              每周安心报告
            </label>
            <input
              id="hp-reports"
              name="reportsPerWeek"
              type="number"
              step="0.5"
              min={0}
              max={21}
              defaultValue={current?.reportsPerWeek ?? 1}
              className="field"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="hp-weekday">
              偏好星期
            </label>
            <select
              id="hp-weekday"
              name="preferredWeekday"
              className="field"
              defaultValue={current?.preferredWeekday ?? ''}
            >
              <option value="">不指定</option>
              {WEEKDAYS.map((w, i) => (
                <option key={w} value={i}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="hp-window">
              偏好时段
            </label>
            <input
              id="hp-window"
              name="preferredWindow"
              maxLength={60}
              defaultValue={current?.preferredWindow ?? ''}
              placeholder="例：下午 14:00-17:00"
              className="field"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="hp-notes">
            执行注意事项
          </label>
          <textarea
            id="hp-notes"
            name="executionNotes"
            rows={3}
            maxLength={1000}
            defaultValue={current?.executionNotes ?? ''}
            placeholder="例：膝盖不舒服，散步请安排休息；不喜欢频繁更换陌生服务者。"
            className="field"
          />
        </div>

        <SubmitButton>保存执行计划</SubmitButton>
      </ActionForm>
    </Collapsible>
  );
}

/* ============================== 开通订阅 ============================== */

export function CreateSubscriptionForm({
  householdId,
  plans,
}: {
  householdId: string;
  plans: { id: string; name: string; monthlyPrice: number }[];
}) {
  return (
    <Collapsible label="开通订阅">
      <ActionForm
        action={createSubscriptionAction}
        successMessage="订阅已开通"
        hiddenFields={{ householdId }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="sub-plan">
              方案 <span className="text-danger-500">*</span>
            </label>
            <select id="sub-plan" name="planId" required className="field">
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}（¥{(p.monthlyPrice / 100).toLocaleString('zh-CN')}/月）
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sub-months">
              周期（月）
            </label>
            <select id="sub-months" name="periodMonths" className="field" defaultValue="1">
              <option value="1">1 个月</option>
              <option value="3">3 个月</option>
              <option value="6">6 个月</option>
              <option value="12">12 个月</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sub-status">
              初始状态
            </label>
            <select id="sub-status" name="status" className="field" defaultValue="ACTIVE">
              <option value="ACTIVE">生效中</option>
              <option value="TRIAL">体验期</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-[13px] text-ink-700">
          <input type="checkbox" name="createOrder" defaultChecked className="h-4 w-4 rounded" />
          同时生成一条已付款订单
        </label>
        <p className="text-xs text-ink-400">
          第一版未接在线支付，订单状态由运营/财务在后台登记。
        </p>

        <SubmitButton>开通</SubmitButton>
      </ActionForm>
    </Collapsible>
  );
}
