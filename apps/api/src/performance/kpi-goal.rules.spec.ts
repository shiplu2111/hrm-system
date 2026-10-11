import { kpiMeasurementWindows } from '@hrm/shared-types';
import {
  assertStatusTransition,
  assertTargetFieldsUnchanged,
  assertTargetValue,
  assertWeightWithinLimit,
  kpiAssignmentLockState,
  resolveMeasurementPeriod,
} from './kpi-goal.rules';
import { computeKpiProgressPercent } from './performance.utils';

const h2Cycle = {
  periodStart: '2026-07-01',
  periodEnd: '2026-12-31',
  measurementPeriod: 'semi_annual' as const,
};

describe('kpiMeasurementWindows', () => {
  it('steps quarters from the cycle start', () => {
    const windows = kpiMeasurementWindows('2026-07-01', '2027-06-30', 'quarterly');
    expect(windows.map((w) => [w.start, w.end])).toEqual([
      ['2026-07-01', '2026-09-30'],
      ['2026-10-01', '2026-12-31'],
      ['2027-01-01', '2027-03-31'],
      ['2027-04-01', '2027-06-30'],
    ]);
    expect(windows[0].label).toBe('Q1 · 1 Jul – 30 Sep 2026');
    expect(windows.every((w) => !w.partial)).toBe(true);
  });

  it('clips the last window at the cycle end', () => {
    const windows = kpiMeasurementWindows('2026-07-01', '2026-11-15', 'quarterly');
    expect(windows[1]).toMatchObject({ start: '2026-10-01', end: '2026-11-15', partial: true });
  });

  it('keeps month-end anchors in the shortest months', () => {
    const windows = kpiMeasurementWindows('2026-01-31', '2026-04-29', 'monthly');
    expect(windows.map((w) => w.start)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(windows[0].end).toBe('2026-02-27');
  });

  it('labels a window that spans the whole cycle', () => {
    expect(kpiMeasurementWindows('2026-07-01', '2026-12-31', 'semi_annual')[0].label).toBe(
      'Full cycle · 1 Jul – 31 Dec 2026',
    );
  });

  it('has no fixed windows for custom periods', () => {
    expect(kpiMeasurementWindows('2026-07-01', '2026-12-31', 'custom')).toEqual([]);
  });
});

describe('resolveMeasurementPeriod', () => {
  it('defaults to the whole cycle using the cycle period type', () => {
    expect(resolveMeasurementPeriod(h2Cycle, {})).toEqual({
      measurementPeriod: 'semi_annual',
      start: '2026-07-01',
      end: '2026-12-31',
    });
  });

  it('labels dates that fit no cycle window as custom', () => {
    expect(
      resolveMeasurementPeriod(h2Cycle, { start: '2026-08-01', end: '2026-08-20' }).measurementPeriod,
    ).toBe('custom');
  });

  it('accepts a quarter window and rejects misaligned quarterly dates', () => {
    expect(
      resolveMeasurementPeriod(h2Cycle, {
        measurementPeriod: 'quarterly',
        start: '2026-10-01',
        end: '2026-12-31',
      }).measurementPeriod,
    ).toBe('quarterly');
    expect(() =>
      resolveMeasurementPeriod(h2Cycle, {
        measurementPeriod: 'quarterly',
        start: '2026-08-01',
        end: '2026-10-31',
      }),
    ).toThrow(/quarterly window/);
  });

  it('rejects dates outside the cycle or reversed', () => {
    expect(() => resolveMeasurementPeriod(h2Cycle, { start: '2026-06-01' })).toThrow(/within the review cycle/);
    expect(() =>
      resolveMeasurementPeriod(h2Cycle, { start: '2026-09-01', end: '2026-08-01' }),
    ).toThrow(/on or before/);
  });
});

describe('KPI goal guards', () => {
  it('requires a positive target unless lower is better', () => {
    expect(() => assertTargetValue(0, 'higher_is_better')).toThrow(/greater than zero/);
    expect(() => assertTargetValue(0, 'lower_is_better')).not.toThrow();
    expect(() => assertTargetValue(-1, 'lower_is_better')).toThrow(/zero or more/);
  });

  it('caps the weight total at 100%', () => {
    expect(() => assertWeightWithinLimit(70, 30, 'Jordan Lee')).not.toThrow();
    expect(() => assertWeightWithinLimit(70, 40, 'Jordan Lee')).toThrow(/total 110%.*30% available/);
  });

  it('never reopens cancelled goals or returns active goals to draft', () => {
    expect(() => assertStatusTransition('cancelled', 'active')).toThrow(/cannot be reopened/);
    expect(() => assertStatusTransition('active', 'draft')).toThrow(/back to draft/);
    expect(() => assertStatusTransition('completed', 'active')).not.toThrow();
  });

  it('derives the lock state from the cycle and review', () => {
    expect(kpiAssignmentLockState('active', false)).toBe('open');
    expect(kpiAssignmentLockState('active', true)).toBe('targets_locked');
    expect(kpiAssignmentLockState('closed', false)).toBe('cycle_locked');
    expect(() =>
      assertTargetFieldsUnchanged(['targetValue', 'measurementPeriodStart', 'measurementPeriodEnd']),
    ).toThrow(/goal's target, measurement period can no longer change/);
    expect(() => assertTargetFieldsUnchanged([])).not.toThrow();
  });

  it('scores a zero lower-is-better target', () => {
    expect(computeKpiProgressPercent(0, 0, 'lower_is_better')).toBe(100);
    expect(computeKpiProgressPercent(0, 2, 'lower_is_better')).toBe(0);
    expect(computeKpiProgressPercent(0, 2, 'higher_is_better')).toBeNull();
  });
});
