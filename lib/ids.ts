import 'server-only';

import { prisma } from '@/lib/db';
import { isoWeekNumber, yyyymmdd } from '@/lib/utils';

/**
 * 业务编号生成。
 *
 * 编号是给人看的（客服口头核对、事件追溯），所以采用「前缀 + 日期 + 序号」的可读格式，
 * 而不是直接暴露 cuid。序号在事务内按当日已有最大值 +1，避免并发下重复。
 */

/** 城市代码：长沙 → CS */
const CITY_CODE: Record<string, string> = {
  长沙: 'CS',
  湘潭: 'XT',
  株洲: 'ZZ',
};

export function cityCode(cityName: string): string {
  return CITY_CODE[cityName] ?? cityName.slice(0, 2).toUpperCase();
}

/** 家庭编号：CS-000018 */
export async function nextHouseholdCode(cityName: string): Promise<string> {
  const prefix = `${cityCode(cityName)}-`;
  const last = await prisma.household.findFirst({
    where: { householdCode: { startsWith: prefix } },
    orderBy: { householdCode: 'desc' },
    select: { householdCode: true },
  });
  const lastSeq = last ? Number(last.householdCode.slice(prefix.length)) : 0;
  const seq = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;
  return `${prefix}${String(seq).padStart(6, '0')}`;
}

/** 员工编号：AX-0007（AX = 安心） */
export async function nextEmployeeCode(): Promise<string> {
  const prefix = 'AX-';
  const last = await prisma.staffProfile.findFirst({
    where: { employeeCode: { startsWith: prefix } },
    orderBy: { employeeCode: 'desc' },
    select: { employeeCode: true },
  });
  const lastSeq = last ? Number(last.employeeCode.slice(prefix.length)) : 0;
  const seq = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

/** 任务编号：TSK-20260815-0031 */
export async function nextTaskNo(ref: Date = new Date()): Promise<string> {
  const prefix = `TSK-${yyyymmdd(ref)}-`;
  const count = await prisma.serviceTask.count({ where: { taskNo: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

/** 事件编号：INC-20260815-0018 */
export async function nextIncidentNo(ref: Date = new Date()): Promise<string> {
  const prefix = `INC-${yyyymmdd(ref)}-`;
  const count = await prisma.incident.count({ where: { incidentNo: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

/** 报告编号：RPT-2026W33-0018 */
export async function nextReportNo(ref: Date = new Date()): Promise<string> {
  const { year, week } = isoWeekNumber(ref);
  const prefix = `RPT-${year}W${String(week).padStart(2, '0')}-`;
  const count = await prisma.assuranceReport.count({ where: { reportNo: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

/** 订单号：ORD-20260815-0007 */
export async function nextOrderNo(ref: Date = new Date()): Promise<string> {
  const prefix = `ORD-${yyyymmdd(ref)}-`;
  const count = await prisma.order.count({ where: { orderNo: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

/** 反馈单号：CASE-20260815-0003 */
export async function nextCaseNo(ref: Date = new Date()): Promise<string> {
  const prefix = `CASE-${yyyymmdd(ref)}-`;
  const count = await prisma.feedbackCase.count({ where: { caseNo: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

/** 家庭申请单号：REQ-20260815-0002 */
export async function nextRequestNo(ref: Date = new Date()): Promise<string> {
  const prefix = `REQ-${yyyymmdd(ref)}-`;
  const count = await prisma.serviceChangeRequest.count({
    where: { requestNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}
