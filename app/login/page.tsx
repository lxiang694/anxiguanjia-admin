import type { Metadata } from 'next';
import { HeartHandshake } from 'lucide-react';

import { BRAND } from '@/lib/labels';
import { LoginForm } from './login-form';
import { DemoAccounts } from './demo-accounts';

export const metadata: Metadata = { title: '登录' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  return (
    <main className="flex min-h-screen flex-col bg-cream-100">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[26rem]">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-700 text-white">
              <HeartHandshake className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold text-ink-800">{BRAND.name}</h1>
            <p className="mt-1.5 text-sm text-ink-500">{BRAND.tagline}</p>
          </div>

          <div className="card px-6 py-6">
            <LoginForm next={next} />
          </div>

          {demoMode ? <DemoAccounts /> : null}

          <p className="mt-7 text-center text-xs leading-relaxed text-ink-400">
            系统会记录登录与敏感信息访问日志。
            <br />
            请勿与他人共用帐号。
          </p>
        </div>
      </div>
    </main>
  );
}
