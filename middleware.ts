import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

/**
 * 中间件只做「粗粒度拦截」：
 *  - 未登录访问受保护路径 → 送去登录页；
 *  - 已登录但走错端 → 送回自己的落地页。
 *
 * 这里刻意不做任何数据权限判定：Edge Runtime 连不上数据库，
 * 也不该在这一层决定「谁能看哪条长辈资料」。真正的判定全部在
 * 服务端（lib/permissions）重新查库执行，middleware 只是体验优化。
 */

const ADMIN_ROLES = new Set([
  'SUPER_ADMIN',
  'OPERATIONS',
  'SERVICE_SUPERVISOR',
  'AREA_MANAGER',
  'CUSTOMER_SERVICE',
  'FINANCE',
  'HR',
  'CITY_LEAD',
]);
const STAFF_ROLES = new Set(['CARE_SPECIALIST', 'SENIOR_CARE_SPECIALIST', 'FAMILY_CONSULTANT']);
const FAMILY_ROLES = new Set(['FAMILY_MEMBER']);

function landingFor(role: string): string {
  if (FAMILY_ROLES.has(role)) return '/family';
  if (STAFF_ROLES.has(role)) return '/staff';
  return '/admin';
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const isStaff = pathname === '/staff' || pathname.startsWith('/staff/');
  const isFamily = pathname === '/family' || pathname.startsWith('/family/');
  const isProtected = isAdmin || isStaff || isFamily;

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = token ? await verifySessionToken(token) : null;

  if (isProtected && !payload) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (payload) {
    // 已登录用户访问登录页，直接送回落地页
    if (pathname === '/login') {
      const url = req.nextUrl.clone();
      url.pathname = landingFor(payload.role);
      url.search = '';
      return NextResponse.redirect(url);
    }

    const wrongPortal =
      (isAdmin && !ADMIN_ROLES.has(payload.role)) ||
      (isStaff && !STAFF_ROLES.has(payload.role)) ||
      (isFamily && !FAMILY_ROLES.has(payload.role));

    if (wrongPortal) {
      const url = req.nextUrl.clone();
      url.pathname = landingFor(payload.role);
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/staff/:path*', '/family/:path*', '/login'],
};
