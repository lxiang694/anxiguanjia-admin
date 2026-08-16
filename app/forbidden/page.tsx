import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

import { getCurrentUser, landingPathForRole } from '@/lib/auth';
import { ButtonLink } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ cap?: string }>;
}) {
  const { cap } = await searchParams;
  const user = await getCurrentUser();
  const home = user ? landingPathForRole(user.role) : '/login';

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-100 px-4">
      <div className="card max-w-md px-6 py-8 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-danger-50 text-danger-500">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-semibold text-ink-800">您没有访问这个页面的权限</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          这次访问尝试已被记录到操作日志。如果确实需要该权限，请联系管理员调整角色配置。
        </p>
        {cap ? (
          <p className="mt-3 rounded-lg bg-cream-100 px-3 py-2 font-mono text-xs text-ink-400">
            缺少权限：{cap}
          </p>
        ) : null}
        <div className="mt-6 flex justify-center gap-2">
          <ButtonLink href={home} variant="primary">
            回到首页
          </ButtonLink>
          <Link href="/login" className="link inline-flex items-center px-3 text-sm">
            切换帐号
          </Link>
        </div>
      </div>
    </main>
  );
}
