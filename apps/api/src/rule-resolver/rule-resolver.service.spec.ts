import type {
  EffectiveDatedRule,
  RuleResolutionContext,
} from '@hrm/shared-types';
import {
  isEffectiveOn,
  parseDateOnly,
  selectEffectiveRule,
} from './effective-date.utils';
import type { RuleSourcePort } from './rule-source.interface';
import { RuleResolverService } from './rule-resolver.service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const COMPANY = '22222222-2222-4222-8222-222222222222';
const EMPLOYEE = '33333333-3333-4333-8333-333333333333';
const AUS = '44444444-4444-4444-8444-444444444444';
const BGD = '55555555-5555-4555-8555-555555555555';

function rule(
  partial: Omit<EffectiveDatedRule, 'payload'> & {
    payload: Record<string, unknown>;
  },
): EffectiveDatedRule {
  return partial;
}

function context(
  partial: Partial<RuleResolutionContext> & {
    calculationDate: Date;
    countryId: string;
  },
): RuleResolutionContext {
  return {
    tenantId: TENANT,
    companyId: COMPANY,
    employeeId: EMPLOYEE,
    stateCode: null,
    ...partial,
  };
}

class InMemoryRuleSource implements RuleSourcePort {
  constructor(private readonly rules: EffectiveDatedRule[]) {}

  async fetchRules(
    _context: RuleResolutionContext,
    ruleType: string,
  ): Promise<EffectiveDatedRule[]> {
    return this.rules.filter((candidate) => candidate.ruleType === ruleType);
  }
}

describe('RuleResolverService', () => {
  const employeeContext = {
    loadEmployeeContext: jest.fn(),
  };

  function createService(rules: EffectiveDatedRule[]): RuleResolverService {
    return new RuleResolverService(
      new InMemoryRuleSource(rules),
      employeeContext,
    );
  }

  describe('Australia (AUS) — full override chain', () => {
    const ausRules: EffectiveDatedRule[] = [
      rule({
        id: 'global-leave-1',
        layer: 'global',
        ruleType: 'leave',
        effectiveFrom: parseDateOnly('2020-01-01'),
        effectiveTo: null,
        payload: {
          accrualBasis: 'monthly',
          standardWorkHoursPerWeek: 40,
        },
      }),
      rule({
        id: 'aus-country-leave',
        layer: 'country',
        ruleType: 'leave',
        effectiveFrom: parseDateOnly('2020-01-01'),
        effectiveTo: null,
        payload: {
          countryCode: 'AUS',
          annualLeaveMinimumWeeks: 4,
          personalCarersLeaveDaysPerYear: 10,
          longServiceLeaveEligibleYears: 10,
        },
      }),
      rule({
        id: 'NSW-state-leave',
        layer: 'state',
        ruleType: 'leave',
        effectiveFrom: parseDateOnly('2020-01-01'),
        effectiveTo: null,
        payload: {
          stateCode: 'NSW',
          annualLeaveMinimumWeeks: 5,
          longServiceLeaveEligibleYears: 7,
        },
      }),
      rule({
        id: 'company-leave',
        layer: 'company',
        ruleType: 'leave',
        effectiveFrom: parseDateOnly('2020-01-01'),
        effectiveTo: null,
        payload: {
          annualLeaveMinimumWeeks: 6,
          carryForwardMaxDays: 10,
        },
      }),
      rule({
        id: 'contract-leave',
        layer: 'employee_contract',
        ruleType: 'leave',
        effectiveFrom: parseDateOnly('2020-01-01'),
        effectiveTo: null,
        payload: {
          parentalLeaveWeeks: 60,
        },
      }),
    ];

    it('merges Global → Country → State → Company → Employee Contract for NSW', async () => {
      const service = createService(ausRules);

      const resolved = await service.resolve(
        context({
          countryId: AUS,
          stateCode: 'NSW',
          calculationDate: parseDateOnly('2024-07-01'),
        }),
        'leave',
      );

      expect(resolved.payload).toEqual({
        accrualBasis: 'monthly',
        standardWorkHoursPerWeek: 40,
        countryCode: 'AUS',
        annualLeaveMinimumWeeks: 6,
        personalCarersLeaveDaysPerYear: 10,
        longServiceLeaveEligibleYears: 7,
        stateCode: 'NSW',
        carryForwardMaxDays: 10,
        parentalLeaveWeeks: 60,
      });

      expect(resolved.layers.map((layer) => layer.applied)).toEqual([
        true,
        true,
        true,
        true,
        true,
      ]);
    });

    it('skips the state layer when no stateCode is provided', async () => {
      const service = createService(ausRules);

      const resolved = await service.resolve(
        context({
          countryId: AUS,
          stateCode: null,
          calculationDate: parseDateOnly('2024-07-01'),
        }),
        'leave',
      );

      expect(resolved.payload.annualLeaveMinimumWeeks).toBe(6);
      expect(resolved.payload.longServiceLeaveEligibleYears).toBe(10);
      expect(resolved.layers.find((layer) => layer.layer === 'state')).toEqual(
        expect.objectContaining({ applied: false }),
      );
    });
  });

  describe('Australia (AUS) — payroll rule set', () => {
    const ausPayrollRules: EffectiveDatedRule[] = [
      rule({
        id: 'global-payroll',
        layer: 'global',
        ruleType: 'payroll',
        effectiveFrom: parseDateOnly('2020-01-01'),
        effectiveTo: null,
        payload: {
          currencyCode: 'AUD',
          standardPayPeriod: 'fortnightly',
        },
      }),
      rule({
        id: 'aus-country-payroll',
        layer: 'country',
        ruleType: 'payroll',
        effectiveFrom: parseDateOnly('2020-01-01'),
        effectiveTo: null,
        payload: {
          countryCode: 'AUS',
          superannuationGuaranteeRate: 11.5,
          minimumHourlyRateAud: 24.1,
          overtimeWeekdayMultiplier: 1.5,
        },
      }),
      rule({
        id: 'company-payroll-aus',
        layer: 'company',
        ruleType: 'payroll',
        effectiveFrom: parseDateOnly('2020-01-01'),
        effectiveTo: null,
        payload: {
          superannuationGuaranteeRate: 12,
        },
      }),
    ];

    it('merges AUS payroll rules with company override on super rate', async () => {
      const service = createService(ausPayrollRules);

      const resolved = await service.resolve(
        context({
          countryId: AUS,
          calculationDate: parseDateOnly('2024-07-01'),
        }),
        'payroll',
      );

      expect(resolved.payload).toEqual({
        currencyCode: 'AUD',
        standardPayPeriod: 'fortnightly',
        countryCode: 'AUS',
        superannuationGuaranteeRate: 12,
        minimumHourlyRateAud: 24.1,
        overtimeWeekdayMultiplier: 1.5,
      });
    });
  });

  describe('Bangladesh (BGD) — different statutory configuration', () => {
    const bgdRules: EffectiveDatedRule[] = [
      rule({
        id: 'global-leave-1',
        layer: 'global',
        ruleType: 'leave',
        effectiveFrom: parseDateOnly('2020-01-01'),
        effectiveTo: null,
        payload: {
          accrualBasis: 'monthly',
          standardWorkHoursPerWeek: 40,
        },
      }),
      rule({
        id: 'bgd-country-leave',
        layer: 'country',
        ruleType: 'leave',
        effectiveFrom: parseDateOnly('2020-01-01'),
        effectiveTo: null,
        payload: {
          countryCode: 'BGD',
          annualLeaveDaysPerYear: 18,
          festivalLeaveDays: 11,
          earnedLeaveAccrualDaysPerMonth: 1,
          maternityLeaveDays: 112,
        },
      }),
      rule({
        id: 'company-leave-bgd',
        layer: 'company',
        ruleType: 'leave',
        effectiveFrom: parseDateOnly('2020-01-01'),
        effectiveTo: null,
        payload: {
          annualLeaveDaysPerYear: 20,
        },
      }),
    ];

    it('resolves BGD leave rules without state or contract overrides', async () => {
      const service = createService(bgdRules);

      const resolved = await service.resolve(
        context({
          countryId: BGD,
          stateCode: null,
          calculationDate: parseDateOnly('2024-07-01'),
        }),
        'leave',
      );

      expect(resolved.payload).toEqual({
        accrualBasis: 'monthly',
        standardWorkHoursPerWeek: 40,
        countryCode: 'BGD',
        annualLeaveDaysPerYear: 20,
        festivalLeaveDays: 11,
        earnedLeaveAccrualDaysPerMonth: 1,
        maternityLeaveDays: 112,
      });

      expect(resolved.layers).toEqual([
        expect.objectContaining({ layer: 'global', applied: true }),
        expect.objectContaining({ layer: 'country', applied: true }),
        expect.objectContaining({ layer: 'state', applied: false }),
        expect.objectContaining({ layer: 'company', applied: true }),
        expect.objectContaining({ layer: 'employee_contract', applied: false }),
      ]);
    });
  });

  describe('Bangladesh (BGD) — payroll rule set', () => {
    const bgdPayrollRules: EffectiveDatedRule[] = [
      rule({
        id: 'global-payroll',
        layer: 'global',
        ruleType: 'payroll',
        effectiveFrom: parseDateOnly('2020-01-01'),
        effectiveTo: null,
        payload: {
          currencyCode: 'USD',
          standardPayPeriod: 'monthly',
        },
      }),
      rule({
        id: 'bgd-country-payroll',
        layer: 'country',
        ruleType: 'payroll',
        effectiveFrom: parseDateOnly('2020-01-01'),
        effectiveTo: null,
        payload: {
          countryCode: 'BGD',
          incomeTaxSlabVersion: 'FY2024',
          festivalBonusMonths: 2,
          overtimeWeekdayMultiplier: 2,
        },
      }),
      rule({
        id: 'company-payroll-bgd',
        layer: 'company',
        ruleType: 'payroll',
        effectiveFrom: parseDateOnly('2020-01-01'),
        effectiveTo: null,
        payload: {
          festivalBonusMonths: 2.5,
        },
      }),
    ];

    it('resolves BGD payroll rules without state layer', async () => {
      const service = createService(bgdPayrollRules);

      const resolved = await service.resolve(
        context({
          countryId: BGD,
          calculationDate: parseDateOnly('2024-07-01'),
        }),
        'payroll',
      );

      expect(resolved.payload).toEqual({
        currencyCode: 'USD',
        standardPayPeriod: 'monthly',
        countryCode: 'BGD',
        incomeTaxSlabVersion: 'FY2024',
        festivalBonusMonths: 2.5,
        overtimeWeekdayMultiplier: 2,
      });

      expect(resolved.layers.find((layer) => layer.layer === 'state')).toEqual(
        expect.objectContaining({ applied: false }),
      );
    });
  });

  describe('effective-dated versioning (RULES.md §4)', () => {
    it('selects the rule version active on the calculation date', async () => {
      const service = createService([
        rule({
          id: 'aus-country-leave-v1',
          layer: 'country',
          ruleType: 'leave',
          effectiveFrom: parseDateOnly('2020-01-01'),
          effectiveTo: parseDateOnly('2023-12-31'),
          payload: { annualLeaveMinimumWeeks: 4, version: 'v1' },
        }),
        rule({
          id: 'aus-country-leave-v2',
          layer: 'country',
          ruleType: 'leave',
          effectiveFrom: parseDateOnly('2024-01-01'),
          effectiveTo: null,
          payload: { annualLeaveMinimumWeeks: 5, version: 'v2' },
        }),
      ]);

      const beforeReform = await service.resolve(
        context({
          countryId: AUS,
          calculationDate: parseDateOnly('2023-06-15'),
        }),
        'leave',
      );

      const afterReform = await service.resolve(
        context({
          countryId: AUS,
          calculationDate: parseDateOnly('2024-06-15'),
        }),
        'leave',
      );

      expect(beforeReform.payload).toEqual({
        annualLeaveMinimumWeeks: 4,
        version: 'v1',
      });
      expect(afterReform.payload).toEqual({
        annualLeaveMinimumWeeks: 5,
        version: 'v2',
      });
    });
  });
});

describe('effective-date.utils', () => {
  it('treats effective_to as inclusive', () => {
    expect(
      isEffectiveOn(
        parseDateOnly('2024-01-01'),
        parseDateOnly('2024-06-30'),
        parseDateOnly('2024-06-30'),
      ),
    ).toBe(true);
  });

  it('returns null when no version matches the calculation date', () => {
    expect(
      selectEffectiveRule(
        [
          {
            effectiveFrom: parseDateOnly('2024-01-01'),
            effectiveTo: parseDateOnly('2024-03-31'),
          },
        ],
        parseDateOnly('2024-07-01'),
      ),
    ).toBeNull();
  });
});
