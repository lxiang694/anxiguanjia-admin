'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';

import { Button, ErrorNotice } from '@/components/ui';
import { cn } from '@/lib/utils';

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;
type ActionFn = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function SubmitButton({
  children,
  variant = 'primary',
  size = 'md',
  className,
  confirm,
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'warm';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** 需要二次确认的动作（如退款、撤回授权） */
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      onClick={
        confirm
          ? (e) => {
              if (!window.confirm(confirm)) e.preventDefault();
            }
          : undefined
      }
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}

/**
 * 统一的 Server Action 表单外壳。
 * 负责显示错误与成功提示，避免每个页面各写一遍 useActionState。
 */
export function ActionForm({
  action,
  children,
  className,
  successMessage = '已保存',
  hiddenFields,
}: {
  action: ActionFn;
  children: React.ReactNode;
  className?: string;
  successMessage?: string;
  hiddenFields?: Record<string, string | undefined | null>;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, null);

  return (
    <form action={formAction} className={cn('space-y-3', className)}>
      {hiddenFields
        ? Object.entries(hiddenFields).map(([k, v]) =>
            v === undefined || v === null ? null : (
              <input key={k} type="hidden" name={k} value={v} />
            ),
          )
        : null}

      {state?.error ? <ErrorNotice title="操作未完成" message={state.error} /> : null}
      {state?.ok ? (
        <p className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-[13px] text-brand-700">
          <CheckCircle2 className="h-4 w-4" />
          {state.message ?? successMessage}
        </p>
      ) : null}

      {children}
    </form>
  );
}

/** 只有一个按钮的行内动作（例如「立即接单」「发布报告」） */
export function InlineAction({
  action,
  label,
  fields,
  variant = 'secondary',
  size = 'sm',
  confirm,
}: {
  action: ActionFn;
  label: string;
  fields: Record<string, string | undefined | null>;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'warm';
  size?: 'sm' | 'md' | 'lg';
  confirm?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, null);

  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      {Object.entries(fields).map(([k, v]) =>
        v === undefined || v === null ? null : <input key={k} type="hidden" name={k} value={v} />,
      )}
      <SubmitButton variant={variant} size={size} confirm={confirm}>
        {label}
      </SubmitButton>
      {state?.error ? (
        <span className="max-w-xs text-[11px] leading-snug text-danger-600">{state.error}</span>
      ) : null}
    </form>
  );
}
