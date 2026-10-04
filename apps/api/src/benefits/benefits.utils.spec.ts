import {
  findDependentRuleConflict,
  isWithinWindow,
  monthlyEmployeeCost,
  parseDateOnly,
  validateDependents,
  type PlanDependentRules,
} from './benefits.utils';

const health: PlanDependentRules = {
  name: 'Gold Health',
  category: 'health_insurance',
  allowsDependents: true,
  maxDependents: 3,
  eligibleRelationships: ['spouse', 'domestic_partner', 'child'],
};

const life: PlanDependentRules = {
  name: 'Group Life',
  category: 'life_insurance',
  allowsDependents: true,
  maxDependents: null,
  eligibleRelationships: [],
};

const today = parseDateOnly('2026-10-04', 'today');

function expectInvalid(fn: () => void, message: string | RegExp) {
  try {
    fn();
  } catch (err) {
    const response = (err as { getResponse(): { message: string } }).getResponse();
    if (typeof message === 'string') expect(response.message).toBe(message);
    else expect(response.message).toMatch(message);
    return;
  }
  throw new Error('Expected a validation error');
}

describe('validateDependents', () => {
  it('accepts a spouse and children within the plan limit', () => {
    expect(() =>
      validateDependents(
        health,
        [],
        [
          { fullName: 'Alex Lee', relationship: 'spouse', dateOfBirth: '1990-03-15' },
          { fullName: 'Sam Lee', relationship: 'child', dateOfBirth: '2020-01-01' },
        ],
        today,
      ),
    ).not.toThrow();
  });

  it('rejects dependents on a plan that does not cover them', () => {
    expectInvalid(
      () =>
        validateDependents(
          { ...health, allowsDependents: false },
          [],
          [{ fullName: 'Alex Lee', relationship: 'spouse' }],
          today,
        ),
      'Gold Health does not cover dependents',
    );
  });

  it('counts existing dependents towards the maximum', () => {
    expectInvalid(
      () =>
        validateDependents(
          health,
          [
            { fullName: 'A', relationship: 'spouse' },
            { fullName: 'B', relationship: 'child' },
            { fullName: 'C', relationship: 'child' },
          ],
          [{ fullName: 'D', relationship: 'child' }],
          today,
        ),
      'Gold Health covers at most 3 dependents',
    );
  });

  it('rejects relationships the plan does not cover', () => {
    expectInvalid(
      () => validateDependents(health, [], [{ fullName: 'Pat Lee', relationship: 'parent' }], today),
      /only covers these relationships: spouse, domestic partner, child\. Pat Lee is listed as parent/,
    );
  });

  it('allows only one spouse or domestic partner', () => {
    expectInvalid(
      () =>
        validateDependents(
          health,
          [{ fullName: 'Alex Lee', relationship: 'spouse' }],
          [{ fullName: 'Jo Smith', relationship: 'domestic_partner' }],
          today,
        ),
      'Only one spouse or domestic partner can be covered',
    );
  });

  it('rejects the same person twice and future dates of birth', () => {
    expectInvalid(
      () =>
        validateDependents(health, [{ fullName: 'Sam Lee', relationship: 'child' }], [
          { fullName: ' sam lee ', relationship: 'child' },
        ], today),
      'sam lee is already listed on this enrollment',
    );
    expectInvalid(
      () =>
        validateDependents(health, [], [
          { fullName: 'Baby Lee', relationship: 'child', dateOfBirth: '2026-12-01' },
        ], today),
      "Baby Lee's date of birth cannot be in the future",
    );
  });

  it('rejects beneficiary shares on non-life plans', () => {
    expectInvalid(
      () =>
        validateDependents(health, [], [
          { fullName: 'Alex Lee', relationship: 'spouse', beneficiarySharePercent: 50 },
        ], today),
      'Beneficiary shares only apply to life insurance plans',
    );
  });

  describe('life insurance beneficiaries', () => {
    it('requires a share for each beneficiary', () => {
      expectInvalid(
        () => validateDependents(life, [], [{ fullName: 'Alex Lee', relationship: 'spouse' }], today),
        "Enter Alex Lee's share of the life insurance payout",
      );
    });

    it('caps total shares at 100% including existing beneficiaries', () => {
      expectInvalid(
        () =>
          validateDependents(
            life,
            [{ fullName: 'Alex Lee', relationship: 'spouse', beneficiarySharePercent: 60 }],
            [{ fullName: 'Pat Lee', relationship: 'parent', beneficiarySharePercent: 50 }],
            today,
          ),
        'Beneficiary shares add up to 110%; the total cannot exceed 100%',
      );
    });

    it('allows a split that totals 100% and more than one partner-type beneficiary', () => {
      expect(() =>
        validateDependents(
          life,
          [],
          [
            { fullName: 'Alex Lee', relationship: 'spouse', beneficiarySharePercent: 66.67 },
            { fullName: 'Jo Lee', relationship: 'domestic_partner', beneficiarySharePercent: 33.33 },
          ],
          today,
        ),
      ).not.toThrow();
    });
  });
});

describe('findDependentRuleConflict', () => {
  const enrollments = [
    [
      { fullName: 'Alex', relationship: 'spouse' },
      { fullName: 'Sam', relationship: 'child' },
    ],
    [],
  ];

  it('blocks turning off dependents while an enrollment covers some', () => {
    expect(findDependentRuleConflict({ ...health, allowsDependents: false }, enrollments)).toBe(
      '1 active enrollment covers dependents. Remove them before turning off dependents.',
    );
  });

  it('blocks lowering the maximum below what an enrollment covers', () => {
    expect(findDependentRuleConflict({ ...health, maxDependents: 1 }, enrollments)).toBe(
      '1 active enrollment covers more than 1 dependents (up to 2).',
    );
  });

  it('blocks removing a relationship that is still covered', () => {
    expect(
      findDependentRuleConflict({ ...health, eligibleRelationships: ['spouse'] }, enrollments),
    ).toBe('Active enrollments still cover child dependents.');
  });

  it('returns null when every enrollment still fits', () => {
    expect(findDependentRuleConflict(health, enrollments)).toBeNull();
  });
});

describe('isWithinWindow', () => {
  it('includes both the start and end date', () => {
    const start = parseDateOnly('2026-09-01', 'start');
    const end = parseDateOnly('2026-09-30', 'end');
    expect(isWithinWindow(start, end, parseDateOnly('2026-09-30', 'd'))).toBe(true);
    expect(isWithinWindow(start, end, parseDateOnly('2026-10-01', 'd'))).toBe(false);
  });
});

describe('monthlyEmployeeCost', () => {
  it('adds the per-dependent cost for each active dependent', () => {
    expect(monthlyEmployeeCost(150, 45.5, 2)).toBe(241);
    expect(monthlyEmployeeCost(null, null, 3)).toBe(0);
  });
});
