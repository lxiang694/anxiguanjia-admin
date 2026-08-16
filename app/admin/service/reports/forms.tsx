'use client';

import { useState } from 'react';

import { generateReportAction } from '@/app/actions/admin';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';

type HouseholdOption = {
  id: string;
  name: string;
  householdCode: string;
  elders: { id: string; name: string }[];
};

export function GenerateReportForm({ households }: { households: HouseholdOption[] }) {
  const [householdId, setHouseholdId] = useState(households[0]?.id ?? '');
  const elders = households.find((h) => h.id === householdId)?.elders ?? [];

  return (
    <ActionForm action={generateReportAction} successMessage="草稿已生成，请在下方列表中确认">
      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="householdId">
            家庭
          </label>
          <select
            id="householdId"
            name="householdId"
            required
            className="field"
            value={householdId}
            onChange={(e) => setHouseholdId(e.target.value)}
          >
            {households.map((h) => (
              <option key={h.id} value={h.id}>
                {h.householdCode} · {h.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="elderId">
            长辈
          </label>
          <select id="elderId" name="elderId" className="field" defaultValue="">
            <option value="">该家庭第一位长辈</option>
            {elders.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        <SubmitButton>生成草稿</SubmitButton>
      </div>
    </ActionForm>
  );
}
