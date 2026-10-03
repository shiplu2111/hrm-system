import {
  hasSeatsFor,
  nextPlanId,
  normalizePlanId,
  PLAN_CATALOG,
  planDefinition,
  tenantHasFeature,
  usageLevel,
} from '../billing/plan-features.constants';

describe('plan feature gating', () => {
  it('enables api_access only on enterprise', () => {
    expect(tenantHasFeature('enterprise', 'api_access')).toBe(true);
    expect(tenantHasFeature('business', 'api_access')).toBe(false);
    expect(tenantHasFeature('starter', 'api_access')).toBe(false);
  });

  it('normalizes unknown plan ids to starter', () => {
    expect(normalizePlanId('unknown-plan')).toBe('starter');
    expect(normalizePlanId(null)).toBe('starter');
  });
});

describe('plan catalog', () => {
  it('makes each tier include every feature of the tier below', () => {
    for (let i = 1; i < PLAN_CATALOG.length; i++) {
      const lower = PLAN_CATALOG[i - 1].features;
      expect(PLAN_CATALOG[i].features).toEqual(expect.arrayContaining(lower));
      expect(PLAN_CATALOG[i].features.length).toBeGreaterThan(lower.length);
    }
  });

  it('matches the tier contents in BILLING_SUBSCRIPTION.md §1', () => {
    expect(planDefinition('free').features).toEqual(['core_hr']);
    expect(planDefinition('starter').features).toEqual(
      expect.arrayContaining(['attendance', 'leave', 'basic_payroll']),
    );
    expect(planDefinition('starter').features).not.toContain('roster');
    expect(planDefinition('business').features).toEqual(
      expect.arrayContaining(['roster', 'timesheets', 'advanced_reports']),
    );
    expect(planDefinition('business').features).not.toContain('sso');
    expect(planDefinition('enterprise').features).toEqual(
      expect.arrayContaining(['api_access', 'sso', 'advanced_workflow', 'custom_payroll_rules']),
    );
  });

  it('agrees with feature gating for enterprise features', () => {
    for (const plan of PLAN_CATALOG) {
      expect(plan.features.includes('api_access')).toBe(
        tenantHasFeature(plan.planId, 'api_access'),
      );
    }
  });

  it('raises the employee limit with each tier and leaves enterprise unlimited', () => {
    const limits = PLAN_CATALOG.map((plan) => plan.limits.employees);
    expect(limits[limits.length - 1]).toBeNull();
    const finite = limits.filter((limit): limit is number => limit !== null);
    expect([...finite].sort((a, b) => a - b)).toEqual(finite);
  });

  it('points to the next tier up', () => {
    expect(nextPlanId('free')).toBe('starter');
    expect(nextPlanId('business')).toBe('enterprise');
    expect(nextPlanId('enterprise')).toBeNull();
  });
});

describe('usage level', () => {
  it('starts approaching at 80% of the limit', () => {
    expect(usageLevel(39, 50)).toBe('ok');
    expect(usageLevel(40, 50)).toBe('approaching');
    expect(usageLevel(49, 50)).toBe('approaching');
  });

  it('separates reached from exceeded', () => {
    expect(usageLevel(50, 50)).toBe('reached');
    expect(usageLevel(51, 50)).toBe('exceeded');
  });

  it('is never limited without a cap', () => {
    expect(usageLevel(10_000, null)).toBe('ok');
  });
});

describe('seat check', () => {
  it('allows filling the last seat but not going past it', () => {
    expect(hasSeatsFor(49, 50, 1)).toBe(true);
    expect(hasSeatsFor(50, 50, 1)).toBe(false);
    expect(hasSeatsFor(48, 50, 3)).toBe(false);
  });

  it('always allows unlimited plans', () => {
    expect(hasSeatsFor(10_000, null, 500)).toBe(true);
  });
});
