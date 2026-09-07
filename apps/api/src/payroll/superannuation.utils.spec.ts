import { Decimal } from '@prisma/client/runtime/library';
import {
  applySuperannuationToPreview,
  parseSuperannuationRates,
} from './superannuation.utils';

describe('parseSuperannuationRates', () => {
  it('returns null when no rates are present', () => {
    expect(parseSuperannuationRates({})).toBeNull();
  });

  it('parses employer and employee rates from social_security payload', () => {
    const rates = parseSuperannuationRates({
      schemeName: 'Superannuation Guarantee',
      employerContributionRate: 11,
      employeeContributionRate: 2.5,
      contributionBase: 'gross',
    });

    expect(rates).toEqual({
      schemeName: 'Superannuation Guarantee',
      employerContributionRate: new Decimal(11),
      employeeContributionRate: new Decimal(2.5),
      contributionBase: 'gross',
    });
  });

  it('accepts alternate field names (superannuationGuaranteeRate, employeeRate)', () => {
    const rates = parseSuperannuationRates({
      superannuationGuaranteeRate: '11.5',
      employeeRate: 0,
    });

    expect(rates?.employerContributionRate.toNumber()).toBe(11.5);
    expect(rates?.employeeContributionRate.toNumber()).toBe(0);
    expect(rates?.contributionBase).toBe('gross');
  });
});

describe('applySuperannuationToPreview', () => {
  const basePreview = {
    employeeId: 'emp-1',
    asOfDate: '2024-06-30',
    grossPay: '6600.00',
    totalDeductions: '0.00',
    netPay: '6600.00',
    earnings: [],
    deductions: [],
  };

  it('adds employer-only super without reducing net pay', () => {
    const result = applySuperannuationToPreview({
      preview: basePreview,
      rates: {
        schemeName: 'Superannuation Guarantee',
        employerContributionRate: new Decimal(11),
        employeeContributionRate: new Decimal(0),
        contributionBase: 'gross',
      },
      basicAmount: new Decimal(6000),
      grossAmount: new Decimal(6600),
    });

    expect(result.netPay).toBe('6600.00');
    expect(result.totalDeductions).toBe('0.00');
    expect(result.superannuation?.employerContribution).toBe('726.00');
    expect(result.deductions).toHaveLength(0);
  });

  it('deducts employee salary-sacrifice super from net pay', () => {
    const result = applySuperannuationToPreview({
      preview: basePreview,
      rates: {
        schemeName: 'Voluntary Super',
        employerContributionRate: new Decimal(11),
        employeeContributionRate: new Decimal(5),
        contributionBase: 'gross',
      },
      basicAmount: new Decimal(6000),
      grossAmount: new Decimal(6600),
    });

    expect(result.superannuation?.employeeContribution).toBe('330.00');
    expect(result.totalDeductions).toBe('330.00');
    expect(result.netPay).toBe('6270.00');
    expect(result.deductions).toHaveLength(1);
  });
});
