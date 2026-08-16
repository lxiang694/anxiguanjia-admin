'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, LogIn } from 'lucide-react';

import { loginAction, type LoginState } from '@/app/actions/auth';
import { Button, ErrorNotice } from '@/components/ui';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
      {pending ? '登录中…' : '登录'}
    </Button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? <ErrorNotice title="无法登录" message={state.error} /> : null}

      <input type="hidden" name="next" value={next ?? ''} />

      <div>
        <label className="label" htmlFor="phone">
          手机号
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="username"
          required
          placeholder="请输入手机号"
          className="field"
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="请输入密码"
          className="field"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
