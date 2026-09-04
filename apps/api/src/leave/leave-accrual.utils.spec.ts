import { decimal } from './leave.utils';
import {
  applyCarriedForwardExpiry,
  computeMonthlyAccrual,
  computeYearEndBalance,
  deductLeaveDays,
} from './leave-accrual.utils';

describe('Leave accrual (LEAVE_LOGIC.md §3–§4)', () => {
  const fyStart = new Date(Date.UTC(2024, 6, 1));
  const hireDate = new Date(Date.UTC(2024, 0, 15));

  it('accrues monthly entitlement and caps at annual entitlement', () => {
    const result = computeMonthlyAccrual({
      entitlementDays: decimal(24),
      currentBalanceDays: decimal(0),
      carriedForwardDays: decimal(0),
      lastAccrualAt: null,
      hireDate,
      fyStart,
      asOfDate: new Date(Date.UTC(2024, 11, 15)),
    });

    expect(result.balanceDays.toFixed(2)).toBe('12.00');
    expect(result.lastAccrualAt?.toISOString()).toBe('2024-12-01T00:00:00.000Z');
  });

  it('caps current-year pool at entitlement when carried-forward days exist', () => {
    const result = computeMonthlyAccrual({
      entitlementDays: decimal(12),
      currentBalanceDays: decimal(15),
      carriedForwardDays: decimal(3),
      lastAccrualAt: new Date(Date.UTC(2024, 10, 1)),
      hireDate,
      fyStart,
      asOfDate: new Date(Date.UTC(2024, 11, 15)),
    });

    expect(result.balanceDays.toFixed(2)).toBe('15.00');
  });

  it('computes year-end carry-forward capped by carry_forward_max', () => {
    const yearEnd = new Date(Date.UTC(2025, 5, 30));

    const result = computeYearEndBalance({
      remainingBalance: decimal(15),
      carryForwardMax: decimal(10),
      entitlementDays: decimal(20),
      expiryMonths: 6,
      yearEndDate: yearEnd,
    });

    expect(result.carriedForwardDays.toFixed(2)).toBe('10.00');
    expect(result.balanceDays.toFixed(2)).toBe('30.00');
    expect(result.carriedForwardExpiresAt?.toISOString()).toBe(
      '2025-12-30T00:00:00.000Z',
    );
  });

  it('expires unused carried-forward days after expiry_months', () => {
    const expired = applyCarriedForwardExpiry({
      balanceDays: decimal(25),
      carriedForwardDays: decimal(5),
      carriedForwardExpiresAt: new Date(Date.UTC(2025, 0, 1)),
      asOfDate: new Date(Date.UTC(2025, 1, 1)),
    });

    expect(expired.balanceDays.toFixed(2)).toBe('20.00');
    expect(expired.carriedForwardDays.toFixed(2)).toBe('0.00');
    expect(expired.carriedForwardExpiresAt).toBeNull();
  });

  it('deducts from carried-forward balance before current-year pool', () => {
    const result = deductLeaveDays({
      balanceDays: decimal(25),
      carriedForwardDays: decimal(5),
      days: decimal(7),
    });

    expect(result.carriedForwardDays.toFixed(2)).toBe('0.00');
    expect(result.balanceDays.toFixed(2)).toBe('18.00');
  });
});
