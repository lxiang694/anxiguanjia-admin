import { FileQuestion } from 'lucide-react';

import { ButtonLink } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-100 px-4">
      <div className="card max-w-md px-6 py-8 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-cream-200 text-ink-400">
          <FileQuestion className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-semibold text-ink-800">没有找到这个页面</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          链接可能已经失效，或者这条数据不在您的可见范围内。
        </p>
        <div className="mt-6 flex justify-center">
          <ButtonLink href="/" variant="primary">
            回到首页
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
