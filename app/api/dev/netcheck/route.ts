import net from 'node:net';
import dns from 'node:dns/promises';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * 临时网络诊断端点。
 *
 * 用途：当 /api/health 报 "Can't reach database server" 时，从运行环境内部
 * 观察 DATABASE_URL 里那个主机名到底解析成什么、TCP 能不能连上 ——
 * 而不是靠在别处 dig 出来的结果去推测。
 *
 * 安全：与 selfcheck 一样，只有配置了 DEV_CHECK_TOKEN 且请求带对 token 才执行。
 * 不回显密码：只输出主机名、端口与查询参数。
 *
 * 排障完成后应删除本文件。
 */

type PortProbe = { port: number; ok: boolean; ms: number; detail: string };

function probe(host: string, port: number, timeoutMs = 8000): Promise<PortProbe> {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = new net.Socket();
    const done = (ok: boolean, detail: string) => {
      socket.destroy();
      resolve({ port, ok, ms: Date.now() - started, detail });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true, 'connected'));
    socket.once('timeout', () => done(false, `timeout after ${timeoutMs}ms`));
    socket.once('error', (err: NodeJS.ErrnoException) =>
      done(false, `${err.code ?? 'ERR'}: ${err.message}`),
    );
    socket.connect(port, host);
  });
}

async function resolveAll(host: string) {
  const out: Record<string, unknown> = {};
  try {
    out.A = await dns.resolve4(host);
  } catch (err) {
    out.A = `error: ${err instanceof Error ? err.message : 'unknown'}`;
  }
  try {
    out.AAAA = await dns.resolve6(host);
  } catch (err) {
    out.AAAA = `error: ${err instanceof Error ? err.message : 'unknown'}`;
  }
  try {
    // lookup 走的是 libc 解析路径，也就是 Prisma 引擎实际会拿到的地址
    out.lookup = await dns.lookup(host, { all: true });
  } catch (err) {
    out.lookup = `error: ${err instanceof Error ? err.message : 'unknown'}`;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const expected = process.env.DEV_CHECK_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const provided =
    req.nextUrl.searchParams.get('token') ?? req.headers.get('x-dev-check-token') ?? '';
  if (provided !== expected) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const raw = process.env.DATABASE_URL;
  if (!raw) {
    return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 500 });
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'DATABASE_URL is not a valid URL' }, { status: 500 });
  }

  const host = parsed.hostname;
  const urlPort = Number(parsed.port) || 5432;
  const ports = Array.from(new Set([urlPort, 5432, 6543]));

  return NextResponse.json({
    // 只回显非敏感部分：用户名与密码一律不输出
    databaseUrl: {
      host,
      port: parsed.port,
      database: parsed.pathname.replace(/^\//, ''),
      params: Object.fromEntries(parsed.searchParams),
      userSuffix: parsed.username.includes('.') ? parsed.username.split('.').pop() : '(no dot)',
      passwordSet: parsed.password.length > 0,
    },
    directUrlHost: (() => {
      try {
        return process.env.DIRECT_URL ? new URL(process.env.DIRECT_URL).host : '(unset)';
      } catch {
        return '(invalid)';
      }
    })(),
    dns: await resolveAll(host),
    tcp: await Promise.all(ports.map((p) => probe(host, p))),
  });
}
