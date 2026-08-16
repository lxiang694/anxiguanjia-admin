'use client';

import { useState } from 'react';

import { createHouseholdAction } from '@/app/actions/admin';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';

type City = { id: string; name: string; districts: { id: string; name: string }[] };

export function NewHouseholdForm({
  cities,
  consultants,
}: {
  cities: City[];
  consultants: { id: string; name: string }[];
}) {
  const [cityId, setCityId] = useState(cities[0]?.id ?? '');
  const districts = cities.find((c) => c.id === cityId)?.districts ?? [];

  return (
    <ActionForm action={createHouseholdAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">
          家庭名称 <span className="text-danger-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={60}
          placeholder="例：王家"
          className="field"
        />
        <p className="mt-1 text-xs text-ink-400">
          用家庭姓氏即可，例如「王家」。这是运营内部识别家庭的名称。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="cityId">
            城市 <span className="text-danger-500">*</span>
          </label>
          <select
            id="cityId"
            name="cityId"
            required
            className="field"
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
          <label className="label" htmlFor="districtId">
            区域
          </label>
          <select id="districtId" name="districtId" className="field" defaultValue="">
            <option value="">暂不指定</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="addressLine">
          服务地址
        </label>
        <input
          id="addressLine"
          name="addressLine"
          maxLength={200}
          placeholder="例：岳麓区××路××小区 3 栋 1单元 502"
          className="field"
        />
        <p className="mt-1 text-xs text-ink-400">
          属敏感信息。列表与概览页会脱敏显示，只在派单给具体安心专员时完整展示。
        </p>
      </div>

      <div>
        <label className="label" htmlFor="consultantId">
          家庭安心顾问
        </label>
        <select id="consultantId" name="consultantId" className="field" defaultValue="">
          <option value="">暂不指派</option>
          {consultants.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="serviceNotes">
          家庭注意事项
        </label>
        <textarea
          id="serviceNotes"
          name="serviceNotes"
          rows={3}
          maxLength={1000}
          placeholder="会展示给上门的安心专员，请只写服务必要信息。例：长辈不喜欢频繁更换陌生服务者。"
          className="field"
        />
      </div>

      <div>
        <label className="label" htmlFor="internalNotes">
          内部备注
        </label>
        <textarea
          id="internalNotes"
          name="internalNotes"
          rows={2}
          maxLength={1000}
          placeholder="仅运营可见，不会出现在家庭端与安心专员端。"
          className="field"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <SubmitButton>创建家庭</SubmitButton>
      </div>
    </ActionForm>
  );
}
