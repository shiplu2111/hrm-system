import { Decimal } from '@prisma/client/runtime/library';
import {
  applySuperannuationToPreview,
  parseSuperannuationRates,
  superannuationValuesOf,
  traceSuperannuationSettings,
} from './superannuation.utils';

const COUNTRY_SG = {
  schemeName: 'Superannuation Guarantee',
  employerContributionRate: 11,
  employeeContributionRate: 0,
  contributionBase: 'gross',
};

describe('traceSuperannuationSettings', () => {
  it('attributes every field to the country when the company has no override', () => {
    const trace = traceSuperannuationSettings([
      { layer: 'global', payload: null },
      { layer: 'country', payload: COUNTRY_SG },
      { layer: 'company', payload: null },
    ]);

    expect(trace.configured).toBe(true);
    expect(trace.rates).toEqual({
      schemeName: 'Superannuation Guarantee',
      employerContributionRate: 11,
      employeeContributionRate: 0,
      contributionBase: 'gross',
    });
    expect(trace.fields.map((f) => f.source)).toEqual([
      'country',
      'country',
      'country',
      'country',
    ]);
    expect(trace.fields.every((f) => f.inheritedValue === null)).toBe(true);
    expect(trace.warnings).toEqual([]);
  });

  it('shows a company override with the country value it replaces', () => {
    const trace = traceSuperannuationSettings([
      { layer: 'country', payload: COUNTRY_SG },
      { layer: 'company', payload: { employerContributionRate: 12.5 } },
    ]);

    const employer = trace.fields.find((f) => f.field === 'employerContributionRate');
    expect(employer).toEqual({
      field: 'employerContributionRate',
      value: 12.5,
      source: 'company',
      sourceKey: 'employerContributionRate',
      inheritedValue: 11,
      inheritedSource: 'country',
      layerValues: { country: 11, company: 12.5 },
    });
    expect(trace.fields.find((f) => f.field === 'schemeName')?.source).toBe('country');
  });

  it('reports the inherited value from the nearest lower layer', () => {
    const trace = traceSuperannuationSettings([
      { layer: 'global', payload: { employerContributionRate: 10 } },
      { layer: 'country', payload: { employerContributionRate: 11 } },
      { layer: 'company', payload: { employerContributionRate: 12 } },
    ]);

    const employer = trace.fields.find((f) => f.field === 'employerContributionRate');
    expect(employer?.inheritedValue).toBe(11);
    expect(employer?.inheritedSource).toBe('country');
  });

  it('flags a company alias that payroll ignores because a higher-priority key exists', () => {
    const trace = traceSuperannuationSettings([
      { layer: 'country', payload: COUNTRY_SG },
      { layer: 'company', payload: { employerRate: 15 } },
    ]);

    const employer = trace.fields.find((f) => f.field === 'employerContributionRate');
    expect(employer?.value).toBe(11);
    expect(employer?.source).toBe('country');
    expect(employer?.layerValues).toEqual({ country: 11, company: 15 });
    expect(trace.warnings).toEqual([
      expect.objectContaining({
        layer: 'company',
        key: 'employerRate',
        message: expect.stringContaining('payroll reads "employerContributionRate" first'),
      }),
    ]);
  });

  it('falls back to system defaults and reports unconfigured when no layer sets a rate', () => {
    const trace = traceSuperannuationSettings([
      { layer: 'country', payload: { schemeName: 'Provident Fund' } },
    ]);

    expect(trace.configured).toBe(false);
    const employer = trace.fields.find((f) => f.field === 'employerContributionRate');
    expect(employer?.source).toBe('system_default');
    expect(employer?.value).toBe(0);
    expect(trace.fields.find((f) => f.field === 'schemeName')?.source).toBe('country');
  });

  it('warns about unusable values and keeps payroll behaviour (non-number rate, unknown base)', () => {
    const trace = traceSuperannuationSettings([
      {
        layer: 'country',
        payload: {
          employerContributionRate: 'eleven',
          employeeContributionRate: 2,
          contributionBase: 'net',
        },
      },
    ]);

    expect(trace.configured).toBe(true);
    expect(trace.rates.employerContributionRate).toBe(0);
    expect(trace.rates.contributionBase).toBe('gross');
    expect(trace.warnings.map((w) => w.key).sort()).toEqual([
      'contributionBase',
      'employerContributionRate',
    ]);
  });

  it('lists payload keys payroll does not use, with the layer that set them', () => {
    const trace = traceSuperannuationSettings([
      { layer: 'country', payload: { ...COUNTRY_SG, maximumContributionBase: 62270 } },
      { layer: 'company', payload: { fundName: 'AustralianSuper' } },
    ]);

    expect(trace.otherSettings).toEqual([
      { key: 'maximumContributionBase', value: 62270, source: 'country' },
      { key: 'fundName', value: 'AustralianSuper', source: 'company' },
    ]);
  });
});

describe('superannuationValuesOf', () => {
  it('returns only the fields a payload sets, normalised', () => {
    expect(superannuationValuesOf({ superannuationGuaranteeRate: '12' })).toEqual({
      employerContributionRate: 12,
    });
  });
});

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
