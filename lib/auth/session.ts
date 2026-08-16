import { SignJWT, jwtVerify } from 'jose';

/**
 * 会话令牌。
 *
 * 设计：
 *  - httpOnly + sameSite=lax + secure(生产) Cookie，前端 JS 无法读取。
 *  - JWT 内只放最小信息（用户 id / 角色 / 会话 id），不放敏感资料。
 *  - 数据库另存 Session 记录（只存 token 哈希），支持单点撤销与「查看登录记录」。
 *  - Edge Runtime（middleware）只做 JWT 验签做粗粒度拦截；
 *    真正的数据权限判定一律在服务端（Node runtime）重新查库执行。
 */

export const SESSION_COOKIE = 'axgj_session';

export type SessionPayload = {
  sub: string; // userId
  sid: string; // session id
  role: string;
  name: string;
};

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error(
      'AUTH_SECRET 未设置或长度不足（至少 24 字符）。请参考 .env.example 配置后重启。',
    );
  }
  return new TextEncoder().encode(secret);
}

export function sessionMaxAgeSeconds(): number {
  const raw = Number(process.env.AUTH_SESSION_MAX_AGE ?? '28800');
  return Number.isFinite(raw) && raw > 60 ? raw : 28800;
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const maxAge = sessionMaxAgeSeconds();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('jiating-anxin-guanjia')
    .setExpirationTime(`${maxAge}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: 'jiating-anxin-guanjia',
    });
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      sid: payload.sid,
      role: payload.role,
      name: typeof payload.name === 'string' ? payload.name : '',
    };
  } catch {
    return null;
  }
}

/** Web Crypto SHA-256，Edge / Node 通用。数据库只保存 token 哈希。 */
export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
