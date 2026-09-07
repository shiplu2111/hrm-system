import {
  normalizePlanId,
  tenantHasFeature,
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
