import { Decimal } from '@prisma/client/runtime/library';
import type {
  PayrollCalculationLine,
  PayrollCalculationPreview,
  SuperannuationContributionPreview,
} from '@hrm/shared-types';
import { formatMoney, parseMoney } from './payroll.utils';

export type SuperannuationContributionBase = 'gross' | 'basic';

export interface ResolvedSuperannuationRates {
  schemeName: string;
  employerContributionRate: Decimal;
  employeeContributionRate: Decimal;
  contributionBase: SuperannuationContributionBase;
}

/** Parse merged `social_security` rule payload from the country-rule engine. */
export function parseSuperannuationRates(
  payload: Record<string, unknown>,
): ResolvedSuperannuationRates | null {
  const employerRate = readRate(
    payload.employerContributionRate ??
      payload.superannuationGuaranteeRate ??
      payload.employerRate,
  );
  const employeeRate = readRate(
    payload.employeeContributionRate ?? payload.employeeRate,
  );

  if (employerRate == null && employeeRate == null) {
    return null;
  }

  const contributionBase =
    payload.contributionBase === 'basic' ? 'basic' : 'gross';

  const schemeName =
    typeof payload.schemeName === 'string' && payload.schemeName.trim()
      ? payload.schemeName.trim()
      : typeof payload.scheme === 'string' && payload.scheme.trim()
        ? payload.scheme.trim()
        : 'Superannuation / Pension';

  return {
    schemeName,
    employerContributionRate: employerRate ?? new Decimal(0),
    employeeContributionRate: employeeRate ?? new Decimal(0),
    contributionBase,
  };
}

export function applySuperannuationToPreview(input: {
  preview: PayrollCalculationPreview;
  rates: ResolvedSuperannuationRates;
  basicAmount: Decimal;
  grossAmount: Decimal;
}): PayrollCalculationPreview {
  const { preview, rates, basicAmount, grossAmount } = input;

  const baseAmount =
    rates.contributionBase === 'basic' ? basicAmount : grossAmount;

  if (baseAmount.isZero()) {
    return { ...preview, superannuation: null };
  }

  const employerContribution = baseAmount
    .mul(rates.employerContributionRate)
    .div(100);
  const employeeContribution = baseAmount
    .mul(rates.employeeContributionRate)
    .div(100);

  if (employerContribution.isZero() && employeeContribution.isZero()) {
    return { ...preview, superannuation: null };
  }

  const deductions = [...preview.deductions];
  let totalDeductions = parseMoney(preview.totalDeductions);
  let netPay = parseMoney(preview.netPay);

  if (employeeContribution.gt(0)) {
    deductions.push({
      salaryStructureId: 'superannuation-employee',
      componentId: 'superannuation-employee',
      componentName: `${rates.schemeName} (employee)`,
      componentType: 'deduction',
      calculationType: 'percentage',
      baseAmount: formatMoney(baseAmount),
      percentage: rates.employeeContributionRate.toNumber(),
      amount: formatMoney(employeeContribution),
      formulaDescription: 'Country social_security rule — employee contribution',
    });
    totalDeductions = totalDeductions.plus(employeeContribution);
    netPay = netPay.minus(employeeContribution);
  }

  const superannuation: SuperannuationContributionPreview = {
    schemeName: rates.schemeName,
    contributionBase: rates.contributionBase,
    employerContributionRate: rates.employerContributionRate.toNumber(),
    employeeContributionRate: rates.employeeContributionRate.toNumber(),
    baseAmount: formatMoney(baseAmount),
    employerContribution: formatMoney(employerContribution),
    employeeContribution: formatMoney(employeeContribution),
    totalContribution: formatMoney(employerContribution.plus(employeeContribution)),
    ruleType: 'social_security',
  };

  return {
    ...preview,
    totalDeductions: formatMoney(totalDeductions),
    netPay: formatMoney(netPay),
    deductions,
    superannuation,
  };
}

function readRate(value: unknown): Decimal | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Decimal(value);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      return new Decimal(value);
    } catch {
      return null;
    }
  }
  return null;
}
