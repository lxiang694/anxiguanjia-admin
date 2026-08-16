import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { auditAs } from '@/lib/audit';
import { verifySignedUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * 私有文件读取端点。
 *
 * 上门照片、证书、合同一律不建立公开 URL：
 *   1. 必须携带有效签名与未过期的 expires；
 *   2. 必须是已登录用户；
 *   3. 每次读取写入审计日志。
 *
 * 第一版尚未接入真实对象存储，因此这里在校验通过后返回 501 并说明原因，
 * 而不是返回一个假的图片 —— 避免让人误以为附件功能已经可用。
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await ctx.params;
  const key = segments.join('/');

  const expires = req.nextUrl.searchParams.get('expires') ?? '';
  const signature = req.nextUrl.searchParams.get('signature') ?? '';

  if (!verifySignedUrl(key, expires, signature)) {
    return NextResponse.json({ error: '链接无效或已过期' }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '需要登录' }, { status: 401 });
  }

  await auditAs(user, {
    action: 'VIEW_PRIVATE_FILE',
    resource: 'File',
    resourceId: key,
    permissionNote: '签名有效且用户已登录',
  });

  return NextResponse.json(
    {
      error: '对象存储尚未接入',
      detail:
        '第一版只实现了权限与签名链路（STORAGE_DRIVER=local）。配置 S3/OSS 后，请在 lib/storage 中实现 getObject 并在此返回文件流。',
      key,
    },
    { status: 501 },
  );
}
