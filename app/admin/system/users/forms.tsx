'use client';

import { useState } from 'react';

import { createUserAction, resetPasswordAction, setUserStatusAction } from '@/app/actions/settings';
import { ActionForm, InlineAction, SubmitButton } from '@/components/shared/action-form';
import { ROLE_LABELS, STAFF_LEVEL_LABELS } from '@/lib/labels';

type City = { id: string; name: string; districts: { id: string; name: string }[] };

const STAFF_ROLES = ['CARE_SPECIALIST', 'SENIOR_CARE_SPECIALIST', 'FAMILY_CONSULTANT'];

const ASSIGNABLE_ROLES = [
  'OPERATIONS',
  'SERVICE_SUPERVISOR',
  'AREA_MANAGER',
  'CUSTOMER_SERVICE',
  'FINANCE',
  'HR',
  'CITY_LEAD',
  'FAMILY_CONSULTANT',
  'SENIOR_CARE_SPECIALIST',
  'CARE_SPECIALIST',
] as const;

const LEVEL_KEYS = Object.keys(STAFF_LEVEL_LABELS) as (keyof typeof STAFF_LEVEL_LABELS)[];

export function CreateUserForm({
  cities,
  isSuperAdmin,
}: {
  cities: City[];
  isSuperAdmin: boolean;
}) {
  const [role, setRole] = useState<string>('CARE_SPECIALIST');
  const [cityId, setCityId] = useState(cities[0]?.id ?? '');
  const isStaff = STAFF_ROLES.includes(role);
  const districts = cities.find((c) => c.id === cityId)?.districts ?? [];

  return (
    <ActionForm action={createUserAction} successMessage="帐号已创建">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label" htmlFor="u-name">
            姓名 <span className="text-danger-500">*</span>
          </label>
          <input id="u-name" name="name" required maxLength={40} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="u-phone">
            手机号 <span className="text-danger-500">*</span>
          </label>
          <input id="u-phone" name="phone" required maxLength={20} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="u-email">
            邮箱
          </label>
          <input id="u-email" name="email" type="email" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="u-role">
            角色 <span className="text-danger-500">*</span>
          </label>
          <select
            id="u-role"
            name="role"
            required
            className="field"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
            {isSuperAdmin ? <option value="SUPER_ADMIN">{ROLE_LABELS.SUPER_ADMIN}</option> : null}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="u-city">
            所属城市{isStaff ? <span className="text-danger-500"> *</span> : null}
          </label>
          <select
            id="u-city"
            name="cityId"
            className="field"
            required={isStaff}
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
          >
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="u-password">
            初始密码 <span className="text-danger-500">*</span>
          </label>
          <input
            id="u-password"
            name="password"
            type="text"
            required
            minLength={10}
            className="field"
            placeholder="至少 10 位，含三类字符"
          />
        </div>
      </div>

      {isStaff ? (
        <div className="grid gap-3 rounded-lg bg-cream-50 px-3 py-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="u-district">
              服务区域
            </label>
            <select id="u-district" name="districtId" className="field" defaultValue="">
              <option value="">暂不指定</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="u-level">
              职级
            </label>
            <select id="u-level" name="staffLevel" className="field" defaultValue="TRAINEE">
              {LEVEL_KEYS.map((k) => (
                <option key={k} value={k}>
                  {STAFF_LEVEL_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="u-bio">
              简介
            </label>
            <input id="u-bio" name="bio" maxLength={500} className="field" />
          </div>
          <p className="text-xs leading-relaxed text-ink-500 sm:col-span-3">
            新建的一线成员服务状态一律是「未开始」，必须走完培训与考核才可能被派单 ——
            系统不允许一入职就上岗。
          </p>
        </div>
      ) : null}

      <SubmitButton>创建帐号</SubmitButton>
    </ActionForm>
  );
}

export function UserRowActions({ userId, status }: { userId: string; status: string }) {
  const [showReset, setShowReset] = useState(false);

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex gap-1.5">
        {status === 'ACTIVE' ? (
          <InlineAction
            action={setUserStatusAction}
            label="暂停"
            variant="ghost"
            size="sm"
            fields={{ userId, status: 'SUSPENDED' }}
            confirm="暂停后该帐号立即无法登录，且现有会话会被吊销。确认？"
          />
        ) : (
          <InlineAction
            action={setUserStatusAction}
            label="启用"
            variant="secondary"
            size="sm"
            fields={{ userId, status: 'ACTIVE' }}
          />
        )}
        <button
          type="button"
          onClick={() => setShowReset((v) => !v)}
          className="rounded-lg px-2 py-1 text-[13px] text-ink-500 hover:bg-cream-200"
        >
          重置密码
        </button>
      </div>

      {showReset ? (
        <ActionForm
          action={resetPasswordAction}
          className="w-52 space-y-1.5"
          successMessage="已重置"
          hiddenFields={{ userId }}
        >
          <input
            name="password"
            type="text"
            required
            minLength={10}
            placeholder="新密码，至少 10 位"
            className="field text-[13px]"
          />
          <SubmitButton size="sm" variant="warm" confirm="重置后该帐号所有登录会话会立即失效。确认？">
            确认重置
          </SubmitButton>
        </ActionForm>
      ) : null}
    </div>
  );
}
