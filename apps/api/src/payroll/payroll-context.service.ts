import { Injectable, Optional } from '@nestjs/common';
import { AttendanceRecordStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { buildShiftWindow } from '../attendance/attendance.utils';
import { PrismaService } from '../database/prisma.service';
import { LoanPayrollService } from '../loans/loan-payroll.service';
import {
  createPayrollFormulaContext,
  type PayrollFormulaContext,
} from './formula/formula-interpreter';

const DEFAULT_STANDARD_HOURS_PER_DAY = new Decimal(8);
const DEFAULT_OT_MULTIPLIER = new Decimal('1.5');
const DEFAULT_WORKING_DAYS = new Decimal(22);
const ZERO = new Decimal(0);

export interface PayrollPeriodRange {
  from: Date;
  to: Date;
}

export interface PayrollFormulaContextOptions {
  employeeId: string;
  companyId: string;
  period: PayrollPeriodRange;
  basicSalary: Decimal;
  grossEarnings: Decimal;
  /** Overrides from salary structure amountOrFormula */
  overrides?: Record<string, unknown>;
}

@Injectable()
export class PayrollContextService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly loanPayroll?: LoanPayrollService,
  ) {}

  async buildContext(
    options: PayrollFormulaContextOptions,
  ): Promise<PayrollFormulaContext> {
    const { employeeId, companyId, period, basicSalary, grossEarnings, overrides } =
      options;

    const [attendanceRows, rosterRows, holidays] = await Promise.all([
      this.prisma.scoped.attendanceRecord.findMany({
        where: {
          employeeId,
          date: { gte: period.from, lte: period.to },
        },
        select: {
          date: true,
          status: true,
          payrollEligible: true,
          clockInAt: true,
          clockOutAt: true,
          clockInServerAt: true,
          clockOutServerAt: true,
          breaks: { select: { startAt: true, endAt: true } },
        },
      }),
      this.prisma.scoped.roster.findMany({
        where: {
          employeeId,
          date: { gte: period.from, lte: period.to },
        },
        include: {
          shift: {
            include: {
              otRule: { select: { ruleJson: true } },
            },
          },
        },
      }),
      this.prisma.scoped.holiday.findMany({
        where: {
          companyId,
          date: { gte: period.from, lte: period.to },
        },
        select: { date: true },
      }),
    ]);

    const holidayDates = new Set(
      holidays.map((h) => h.date.toISOString().slice(0, 10)),
    );

    const workingDaysInPeriod = countWeekdaysInRange(
      period.from,
      period.to,
      holidayDates,
    );

    let workedMinutes = 0;
    let unpaidDays = 0;
    let hasUnpaidLeave = false;

    for (const row of attendanceRows) {
      if (
        row.status === AttendanceRecordStatus.leave &&
        row.payrollEligible === false
      ) {
        unpaidDays += 1;
        hasUnpaidLeave = true;
        continue;
      }

      if (
        row.status === AttendanceRecordStatus.half_day &&
        row.payrollEligible === false
      ) {
        unpaidDays += 0.5;
        hasUnpaidLeave = true;
      }

      const minutes = netWorkedMinutes(row);
      if (minutes > 0) {
        workedMinutes += minutes;
      }
    }

    let standardMinutes = 0;
    let otMultiplierSum = ZERO;
    let otMultiplierCount = 0;

    for (const assignment of rosterRows) {
      const { standardMinutes: shiftStandard } = buildShiftWindow(
        assignment.date,
        assignment.shift,
      );
      standardMinutes += shiftStandard;

      const shiftOt = readOtMultiplierFromRule(assignment.shift.otRule?.ruleJson);
      if (shiftOt != null) {
        otMultiplierSum = otMultiplierSum.plus(shiftOt);
        otMultiplierCount += 1;
      }
    }

    if (standardMinutes === 0) {
      standardMinutes =
        workingDaysInPeriod.toNumber() *
        DEFAULT_STANDARD_HOURS_PER_DAY.mul(60).toNumber();
    }

    const overrideOt = readDecimalOverride(overrides, 'ot_multiplier');
    const otMultiplier =
      overrideOt ??
      (otMultiplierCount > 0
        ? otMultiplierSum.div(otMultiplierCount)
        : DEFAULT_OT_MULTIPLIER);

    const overrideHourly = readDecimalOverride(overrides, 'hourly_rate');
    const workedHours = new Decimal(workedMinutes).div(60);
    const standardHours = new Decimal(standardMinutes).div(60);

    let hourlyRate = overrideHourly ?? ZERO;
    if (hourlyRate.isZero() && !basicSalary.isZero() && !standardHours.isZero()) {
      hourlyRate = basicSalary.div(standardHours);
    }

    const attendanceStatus = hasUnpaidLeave ? 'unpaid_leave' : 'present';

    const loanSnapshot = this.loanPayroll
      ? await this.loanPayroll.getFormulaSnapshot(
          employeeId,
          period.from,
          period.to,
        )
      : {
          installmentAmount: ZERO,
          remainingBalance: ZERO,
          activeCount: ZERO,
        };

    return createPayrollFormulaContext({
      employee: {
        worked_hours: workedHours,
        hourly_rate: hourlyRate,
      },
      shift: {
        standard_hours: standardHours,
        ot_multiplier: otMultiplier,
      },
      attendance: {
        status: attendanceStatus,
        unpaid_days: new Decimal(unpaidDays),
      },
      payroll: {
        basic_salary: basicSalary,
        gross_earnings: grossEarnings,
        working_days_in_period: workingDaysInPeriod,
      },
      loan: {
        installment_amount: loanSnapshot.installmentAmount,
        remaining_balance: loanSnapshot.remainingBalance,
        active_count: loanSnapshot.activeCount,
      },
    });
  }
}

function countWeekdaysInRange(
  from: Date,
  to: Date,
  holidayDates: Set<string>,
): Decimal {
  let count = 0;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    const day = cursor.getDay();
    const iso = cursor.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidayDates.has(iso)) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return count > 0 ? new Decimal(count) : DEFAULT_WORKING_DAYS;
}

function netWorkedMinutes(row: {
  clockInAt: Date | null;
  clockOutAt: Date | null;
  clockInServerAt: Date | null;
  clockOutServerAt: Date | null;
  breaks: { startAt: Date; endAt: Date | null }[];
}): number {
  const clockIn = row.clockInServerAt ?? row.clockInAt;
  const clockOut = row.clockOutServerAt ?? row.clockOutAt;
  if (!clockIn || !clockOut) {
    return 0;
  }

  let totalMs = clockOut.getTime() - clockIn.getTime();
  if (totalMs <= 0) {
    return 0;
  }

  for (const brk of row.breaks) {
    if (!brk.endAt) continue;
    const breakMs = brk.endAt.getTime() - brk.startAt.getTime();
    if (breakMs > 0) {
      totalMs -= breakMs;
    }
  }

  return Math.max(0, Math.round(totalMs / 60_000));
}

function readOtMultiplierFromRule(ruleJson: unknown): Decimal | null {
  if (ruleJson == null || typeof ruleJson !== 'object' || Array.isArray(ruleJson)) {
    return null;
  }

  const multipliers = (ruleJson as Record<string, unknown>).multipliers;
  if (multipliers == null || typeof multipliers !== 'object' || Array.isArray(multipliers)) {
    return null;
  }

  const weekday = (multipliers as Record<string, unknown>).weekday;
  if (typeof weekday === 'number' && Number.isFinite(weekday)) {
    return new Decimal(weekday);
  }

  return null;
}

function readDecimalOverride(
  overrides: Record<string, unknown> | undefined,
  key: string,
): Decimal | null {
  if (!overrides || overrides[key] == null) {
    return null;
  }

  const raw = overrides[key];
  if (typeof raw === 'number' || typeof raw === 'string') {
    try {
      return new Decimal(raw);
    } catch {
      return null;
    }
  }

  return null;
}

export function resolvePayrollPeriod(asOf: Date): PayrollPeriodRange {
  const from = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
  const to = new Date(asOf.getFullYear(), asOf.getMonth() + 1, 0);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}
