import 'server-only';

import { createHmac, randomUUID } from 'node:crypto';

/**
 * 私有文件访问。
 *
 * 产品硬性要求：上门照片、合同、证书、附件不得建立公开 URL。
 * 因此本层只对外暴露「存储 key」，读取时按权限换取短时效的签名地址。
 *
 * 第一版实现 local 驱动（签名由本地 HMAC 生成，由 /api/files/[...key] 校验），
 * 接口形状与 S3/OSS 兼容，后续替换驱动不需要改调用方。
 */

export type StorageDriver = 'local' | 's3' | 'oss';

export function currentDriver(): StorageDriver {
  const raw = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();
  return raw === 's3' || raw === 'oss' ? raw : 'local';
}

function signingSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET 未设置，无法生成签名地址');
  return secret;
}

export function signedUrlTtl(): number {
  const raw = Number(process.env.STORAGE_SIGNED_URL_TTL ?? '300');
  return Number.isFinite(raw) && raw > 0 ? raw : 300;
}

/** 生成存储 key。key 本身不包含可猜测的业务语义。 */
export function buildStorageKey(
  category: 'visit-photo' | 'certificate' | 'contract' | 'consent-evidence' | 'incident-attachment',
  ext = 'jpg',
): string {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `${category}/${ym}/${randomUUID()}.${ext}`;
}

/**
 * 生成带签名的临时访问地址。
 * 注意：调用前必须已经完成权限判定 —— 本函数不做任何授权检查。
 */
export function createSignedUrl(key: string, ttlSeconds = signedUrlTtl()): string {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = createHmac('sha256', signingSecret())
    .update(`${key}:${expires}`)
    .digest('hex');
  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const qs = new URLSearchParams({ expires: String(expires), signature });
  return `${base}/api/files/${key}?${qs.toString()}`;
}

export function verifySignedUrl(key: string, expires: string, signature: string): boolean {
  const exp = Number(expires);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = createHmac('sha256', signingSecret())
    .update(`${key}:${exp}`)
    .digest('hex');
  // 长度一致时做逐字符比较，避免因提前返回造成的时序差异
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * 第一版未接入真实对象存储，因此上传是「登记 key」而非真正落盘。
 * 接入 S3/OSS 时在此实现 putObject 并保持返回值不变。
 */
export async function registerUpload(key: string): Promise<{ key: string; driver: StorageDriver }> {
  return { key, driver: currentDriver() };
}
