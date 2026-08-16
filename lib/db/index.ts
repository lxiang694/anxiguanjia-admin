import { PrismaClient } from '@prisma/client';

/**
 * Prisma 单例。
 *
 * 两个细节：
 *
 * 1. Next.js 开发模式下模块会被反复热重载，若每次都 new PrismaClient()
 *    会耗尽数据库连接池，所以在非生产环境把实例挂到 globalThis 上复用。
 *
 * 2. `next build` 在收集路由信息时会导入本模块，而构建环境不一定注入了
 *    运行时环境变量。缺少 DATABASE_URL 时 PrismaClient 会在实例化阶段直接抛错，
 *    导致构建失败。这里给一个明显是占位的地址让实例化通过 —— 它不会被真正连接，
 *    因为所有涉及数据的页面都是 force-dynamic，构建期不会发出查询。
 *    真正运行时若仍缺少配置，第一次查询会失败，且 /api/health 会明确报出 db: down。
 */

const BUILD_TIME_PLACEHOLDER =
  'postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder?schema=public';

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url && url.length > 0) return url;
  console.warn(
    '[db] DATABASE_URL 未设置，使用占位连接串实例化 Prisma。' +
      '若这条日志出现在运行时（而不是构建期），请检查环境变量配置。',
  );
  return BUILD_TIME_PLACEHOLDER;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: resolveDatabaseUrl() } },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
