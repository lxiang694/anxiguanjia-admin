'use client';

import { useState } from 'react';

import {
  issueInvoiceAction,
  requestInvoiceAction,
  voidInvoiceAction,
} from '@/app/actions/support';
import { ActionForm, SubmitButton } from '@/components/shared/action-form';
import { INVOICE_TYPE_LABELS } from '@/lib/labels';

const TYPES = Object.keys(INVOICE_TYPE_LABELS) as (keyof typeof INVOICE_TYPE_LABELS)[];

export function InvoiceActions({
  orderId,
  invoiceStatus,
}: {
  orderId: string;
  invoiceStatus: string;
}) {
  const [mode, setMode] = useState<'none' | 'request' | 'issue' | 'void'>('none');

  if (invoiceStatus === 'NOT_REQUESTED') {
    if (mode !== 'request') {
      return (
        <button
          type="button"
          onClick={() => setMode('request')}
          className="text-[13px] text-brand-700 underline underline-offset-2"
        >
          登记开票
        </button>
      );
    }
    return (
      <ActionForm
        action={requestInvoiceAction}
        className="w-56 space-y-1.5"
        successMessage="已登记"
        hiddenFields={{ orderId }}
      >
        <select name="invoiceType" required className="field text-[13px]" defaultValue="PERSONAL_ELECTRONIC">
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {INVOICE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <input name="invoiceTitle" required maxLength={80} placeholder="开票名称" className="field text-[13px]" />
        <input name="invoiceTaxNo" maxLength={40} placeholder="税号（单位发票必填）" className="field text-[13px]" />
        <input name="note" maxLength={200} placeholder="备注" className="field text-[13px]" />
        <SubmitButton size="sm">提交申请</SubmitButton>
      </ActionForm>
    );
  }

  if (invoiceStatus === 'REQUESTED') {
    if (mode !== 'issue') {
      return (
        <button
          type="button"
          onClick={() => setMode('issue')}
          className="text-[13px] text-brand-700 underline underline-offset-2"
        >
          回填发票号
        </button>
      );
    }
    return (
      <ActionForm
        action={issueInvoiceAction}
        className="w-48 space-y-1.5"
        successMessage="已标记为已开票"
        hiddenFields={{ orderId }}
      >
        <input name="invoiceNo" required maxLength={40} placeholder="发票号" className="field text-[13px]" />
        <SubmitButton size="sm">确认已开票</SubmitButton>
      </ActionForm>
    );
  }

  if (invoiceStatus === 'ISSUED') {
    if (mode !== 'void') {
      return (
        <button
          type="button"
          onClick={() => setMode('void')}
          className="text-[13px] text-ink-500 underline underline-offset-2"
        >
          作废
        </button>
      );
    }
    return (
      <ActionForm
        action={voidInvoiceAction}
        className="w-48 space-y-1.5"
        successMessage="已作废"
        hiddenFields={{ orderId }}
      >
        <input name="reason" required maxLength={200} placeholder="作废原因" className="field text-[13px]" />
        <SubmitButton size="sm" variant="danger">
          确认作废
        </SubmitButton>
      </ActionForm>
    );
  }

  return <span className="text-[13px] text-ink-400">—</span>;
}
