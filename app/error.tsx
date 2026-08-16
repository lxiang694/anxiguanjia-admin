'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] 未捕获错误:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-100 px-4">
      <div className="card max-w-md px-6 py-8 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-danger-50 text-danger-500">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-semibold text-ink-800">出了点问题</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          这次操作没有完成。您可以重试一次；如果反复出现，请把下面的编号告知技术支持。
        </p>
        {error.digest ? (
          <p className="mt-3 rounded-lg bg-cream-100 px-3 py-2 font-mono text-xs text-ink-400">
            {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex justify-center">
          <Button onClick={reset}>重试</Button>
        </div>
      </div>
    </main>
  );
}
