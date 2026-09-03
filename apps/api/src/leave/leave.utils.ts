import { Decimal } from '@prisma/client/runtime/library';
import type { LeaveApprovalStep } from '@hrm/shared-types';

export function parseDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date "${value}", expected YYYY-MM-DD`);
  }
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function eachDateInRange(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function decimal(value: number | Decimal | string): Decimal {
  return new Decimal(value);
}

export function decimalToNumber(value: Decimal): number {
  return Number(value.toFixed(2));
}

export function getLeaveYear(financialYearStartMonth: number, date: Date): number {
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  return month >= financialYearStartMonth ? year : year - 1;
}

export function getFinancialYearStart(
  financialYearStartMonth: number,
  leaveYear: number,
): Date {
  return new Date(Date.UTC(leaveYear, financialYearStartMonth - 1, 1));
}

export function countWeekdaysInRange(from: Date, to: Date): number {
  return eachDateInRange(from, to).filter((d) => !isWeekend(d)).length;
}

export function calculateLeaveDays(input: {
  startDate: Date;
  endDate: Date;
  halfDay: boolean;
  holidayDates: Set<string>;
  deductPublicHolidays: boolean;
}): number {
  if (input.halfDay) {
    return 0.5;
  }

  let days = 0;
  for (const date of eachDateInRange(input.startDate, input.endDate)) {
    if (isWeekend(date)) continue;
    const key = formatDateValue(date);
    if (!input.deductPublicHolidays && input.holidayDates.has(key)) continue;
    days += 1;
  }
  return days;
}

export interface PolicyApprovalStepTemplate {
  roleName: string;
}

export function buildInitialApprovalChain(
  steps: PolicyApprovalStepTemplate[],
): LeaveApprovalStep[] {
  return steps.map((step) => ({
    roleName: step.roleName,
    status: 'pending',
    actedByUserId: null,
    actedByEmployeeId: null,
    actedAt: null,
    comment: null,
  }));
}

export function parseApprovalChain(value: unknown): LeaveApprovalStep[] {
  if (!Array.isArray(value)) return [];
  return value as LeaveApprovalStep[];
}

export function getCurrentApprovalStep(
  chain: LeaveApprovalStep[],
): LeaveApprovalStep | null {
  return chain.find((step) => step.status === 'pending') ?? null;
}

export function isApprovalComplete(chain: LeaveApprovalStep[]): boolean {
  return chain.every((step) => step.status === 'approved' || step.status === 'skipped');
}

export function monthsBetween(start: Date, end: Date): number {
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1
  );
}

export function addMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()),
  );
}

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function minDecimal(a: Decimal, b: Decimal): Decimal {
  return a.lessThan(b) ? a : b;
}

export function maxDecimal(a: Decimal, b: Decimal): Decimal {
  return a.greaterThan(b) ? a : b;
}
