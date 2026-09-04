import { Decimal } from '@prisma/client/runtime/library';
import { addMonths, decimal, minDecimal, startOfMonth } from './leave.utils';

/** Monthly accrual with entitlement cap (LEAVE_LOGIC.md §3). */
export function computeMonthlyAccrual(input: {
  entitlementDays: Decimal;
  currentBalanceDays: Decimal;
  carriedForwardDays: Decimal;
  lastAccrualAt: Date | null;
  hireDate: Date;
  fyStart: Date;
  asOfDate: Date;
}): { balanceDays: Decimal; lastAccrualAt: Date | null } {
  const monthlyRate = input.entitlementDays.div(12);
  let cursor = input.lastAccrualAt
    ? startOfMonth(addMonths(input.lastAccrualAt, 1))
    : startOfMonth(
        input.hireDate > input.fyStart ? input.hireDate : input.fyStart,
      );
  let currentBalance = input.currentBalanceDays;
  let lastProcessed: Date | null = input.lastAccrualAt;

  while (cursor <= startOfMonth(input.asOfDate)) {
    currentBalance = currentBalance.plus(monthlyRate);
    const carried = input.carriedForwardDays;
    const currentYearPool = currentBalance.minus(carried);
    if (currentYearPool.greaterThan(input.entitlementDays)) {
      currentBalance = carried.plus(input.entitlementDays);
    }
    lastProcessed = cursor;
    cursor = addMonths(cursor, 1);
  }

  if (lastProcessed && lastProcessed !== input.lastAccrualAt) {
    return { balanceDays: currentBalance, lastAccrualAt: lastProcessed };
  }

  return {
    balanceDays: input.currentBalanceDays,
    lastAccrualAt: input.lastAccrualAt,
  };
}

/** Year-end carry-forward and expiry setup (LEAVE_LOGIC.md §4). */
export function computeYearEndBalance(input: {
  remainingBalance: Decimal;
  carryForwardMax: Decimal | null;
  entitlementDays: Decimal;
  expiryMonths: number | null;
  yearEndDate: Date;
}): {
  balanceDays: Decimal;
  carriedForwardDays: Decimal;
  carriedForwardExpiresAt: Date | null;
} {
  const carryMax = input.carryForwardMax ?? decimal(0);
  const carried = minDecimal(input.remainingBalance, carryMax);
  const expiresAt =
    input.expiryMonths && carried.greaterThan(0)
      ? addMonths(input.yearEndDate, input.expiryMonths)
      : null;

  return {
    balanceDays: input.entitlementDays.plus(carried),
    carriedForwardDays: carried,
    carriedForwardExpiresAt: expiresAt,
  };
}

/** Zero carried-forward days after expiry date (LEAVE_LOGIC.md §4 FIFO). */
export function applyCarriedForwardExpiry(input: {
  balanceDays: Decimal;
  carriedForwardDays: Decimal;
  carriedForwardExpiresAt: Date | null;
  asOfDate: Date;
}): {
  balanceDays: Decimal;
  carriedForwardDays: Decimal;
  carriedForwardExpiresAt: Date | null;
} {
  if (
    input.carriedForwardExpiresAt &&
    input.carriedForwardExpiresAt < input.asOfDate &&
    input.carriedForwardDays.greaterThan(0)
  ) {
    return {
      balanceDays: input.balanceDays.minus(input.carriedForwardDays),
      carriedForwardDays: decimal(0),
      carriedForwardExpiresAt: null,
    };
  }

  return input;
}

/** Deduct approved leave — carried-forward pool consumed first (LEAVE_LOGIC.md §4). */
export function deductLeaveDays(input: {
  balanceDays: Decimal;
  carriedForwardDays: Decimal;
  days: Decimal;
}): { balanceDays: Decimal; carriedForwardDays: Decimal } {
  let remaining = input.days;
  let carried = input.carriedForwardDays;
  let pool = input.balanceDays.minus(carried);

  if (carried.greaterThan(0)) {
    const fromCarried = minDecimal(carried, remaining);
    carried = carried.minus(fromCarried);
    remaining = remaining.minus(fromCarried);
  }

  if (remaining.greaterThan(0)) {
    pool = pool.minus(remaining);
  }

  return {
    carriedForwardDays: carried,
    balanceDays: carried.plus(pool),
  };
}
