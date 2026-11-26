import type { PublicPlanPriceView, PublicPlanView } from '../api/types';

export type BillingCycle = 'monthly' | 'annual';

export interface PlanEstimateResult {
  hasPublishedPrice: boolean;
  pricingModel: PublicPlanView['pricingModel'];
  currency: string;
  billingCycle: BillingCycle;
  employeeCount: number;
  employeeCap: number | null;
  exceedsCap: boolean;
  baseAmount: number;
  perSeatAmount: number | null;
  includedSeats: number;
  billableExtraSeats: number;
  extraSeatsAmount: number;
  cycleTotal: number;
  estimatedMonthlyTotal: number;
}

/**
 * Resolves the exact price row for the selected currency & billing cycle,
 * returning null if no published price exists (never fabricates a number).
 */
export function findPublishedPlanPrice(
  plan: PublicPlanView,
  currency: string,
  billingCycle: BillingCycle,
): PublicPlanPriceView | null {
  const targetCurrency = currency.trim().toUpperCase();
  const exact = plan.prices.find(
    (p) => p.currency.toUpperCase() === targetCurrency && p.billingCycle === billingCycle,
  );
  return exact ?? null;
}

export function getPlanEmployeeCap(plan: PublicPlanView): number | null {
  const empLimit = plan.limits.find((l) => l.key === 'employees');
  return empLimit?.value ?? null;
}

/**
 * Mirrors BillingInvoicingService.calculateCycleAmounts from apps/api so
 * public Pricing estimates match invoice amounts for identical inputs.
 */
export function calculatePlanEstimate(
  plan: PublicPlanView,
  currency: string,
  billingCycle: BillingCycle,
  rawEmployeeCount: number,
): PlanEstimateResult {
  const employeeCount = Math.max(1, Math.floor(Number.isFinite(rawEmployeeCount) ? rawEmployeeCount : 1));
  const employeeCap = getPlanEmployeeCap(plan);
  const exceedsCap = employeeCap !== null && employeeCount > employeeCap;

  if (plan.pricingModel === 'custom') {
    return {
      hasPublishedPrice: false,
      pricingModel: 'custom',
      currency,
      billingCycle,
      employeeCount,
      employeeCap,
      exceedsCap,
      baseAmount: 0,
      perSeatAmount: null,
      includedSeats: 0,
      billableExtraSeats: 0,
      extraSeatsAmount: 0,
      cycleTotal: 0,
      estimatedMonthlyTotal: 0,
    };
  }

  const price = findPublishedPlanPrice(plan, currency, billingCycle);
  if (!price) {
    return {
      hasPublishedPrice: false,
      pricingModel: plan.pricingModel,
      currency,
      billingCycle,
      employeeCount,
      employeeCap,
      exceedsCap,
      baseAmount: 0,
      perSeatAmount: null,
      includedSeats: 0,
      billableExtraSeats: 0,
      extraSeatsAmount: 0,
      cycleTotal: 0,
      estimatedMonthlyTotal: 0,
    };
  }

  const baseAmount = Number(price.amount);
  const perSeatAmount =
    price.perSeatAmount !== null && price.perSeatAmount !== undefined
      ? Number(price.perSeatAmount)
      : null;

  const threshold =
    baseAmount === 0
      ? 0
      : plan.includedSeats > 0
        ? plan.includedSeats
        : employeeCap !== null
          ? Math.min(10, employeeCap)
          : 10;

  const includedSeats = baseAmount === 0 ? 0 : Math.min(employeeCount, threshold);

  let billableExtraSeats = 0;
  let extraSeatsAmount = 0;

  if (perSeatAmount && perSeatAmount > 0) {
    billableExtraSeats = Math.max(0, employeeCount - includedSeats);
    extraSeatsAmount = Math.round(billableExtraSeats * perSeatAmount * 100) / 100;
  }

  const cycleTotal = Math.round((baseAmount + extraSeatsAmount) * 100) / 100;
  const estimatedMonthlyTotal =
    billingCycle === 'annual' ? Math.round((cycleTotal / 12) * 100) / 100 : cycleTotal;

  return {
    hasPublishedPrice: true,
    pricingModel: plan.pricingModel,
    currency: price.currency,
    billingCycle,
    employeeCount,
    employeeCap,
    exceedsCap,
    baseAmount,
    perSeatAmount,
    includedSeats,
    billableExtraSeats,
    extraSeatsAmount,
    cycleTotal,
    estimatedMonthlyTotal,
  };
}
