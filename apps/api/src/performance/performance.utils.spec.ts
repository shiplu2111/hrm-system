import { computeKpiProgressPercent } from './performance.utils';

describe('computeKpiProgressPercent', () => {
  it('computes higher-is-better progress', () => {
    expect(computeKpiProgressPercent(80, 72, 'higher_is_better')).toBe(90);
    expect(computeKpiProgressPercent(80, 100, 'higher_is_better')).toBe(100);
  });

  it('computes lower-is-better progress', () => {
    expect(computeKpiProgressPercent(4, 5.8, 'lower_is_better')).toBe(69);
    expect(computeKpiProgressPercent(4, 3, 'lower_is_better')).toBe(100);
  });

  it('returns null when current value is missing', () => {
    expect(computeKpiProgressPercent(80, null, 'higher_is_better')).toBeNull();
  });
});
