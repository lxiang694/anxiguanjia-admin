'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { landingPathForRole, login, logout } from '@/lib/auth';

const loginSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(6, '请填写手机号')
    .max(20, '手机号格式不正确'),
  password: z.string().min(1, '请填写密码').max(200),
  next: z.string().optional(),
});

export type LoginState = { error?: string } | null;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    phone: formData.get('phone'),
    password: formData.get('password'),
    next: formData.get('next') ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '请检查输入' };
  }

  const result = await login(parsed.data.phone, parsed.data.password);
  if (!result.ok) return { error: result.error };

  const nextPath = parsed.data.next;
  const fallback = landingPathForRole(result.user.role);
  // 只允许站内相对路径回跳，避免开放重定向
  const target =
    nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : fallback;

  redirect(target);
}

export async function logoutAction() {
  await logout();
  redirect('/login');
}
