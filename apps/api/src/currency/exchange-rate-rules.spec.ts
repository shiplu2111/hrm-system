import {
  addDaysToDateOnly,
  planNewRateVersion,
  planRateVersionUpdate,
  rateVersionEditability,
} from '@hrm/shared-types';

const h1 = { id: 'h1', effectiveFrom: '2026-01-01', effectiveTo: '2026-06-30' };
const h2 = { id: 'h2', effectiveFrom: '2026-07-01', effectiveTo: null };

describe('exchange rate versioning (historical rate lock)', () => {
  it('shifts date-only values across month and year ends', () => {
    expect(addDaysToDateOnly('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDaysToDateOnly('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDateOnly('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('closes the open-ended version the day before a new rate starts', () => {
    const plan = planNewRateVersion([h1, h2], { effectiveFrom: '2026-10-01', effectiveTo: null }, '2026-09-30');
    expect(plan).toEqual({
      ok: true,
      value: { effectiveTo: null, closePrevious: { id: 'h2', effectiveTo: '2026-09-30' } },
    });
  });

  it('rejects new rates on or before the locked-through date', () => {
    const plan = planNewRateVersion([h1, h2], { effectiveFrom: '2026-09-30', effectiveTo: null }, '2026-09-30');
    expect(plan).toMatchObject({ ok: false, code: 'RATE_PERIOD_LOCKED' });
    if (!plan.ok) expect(plan.message).toContain('2026-10-01');
  });

  it('ends a back-filled rate the day before the next version', () => {
    const plan = planNewRateVersion([h2], { effectiveFrom: '2026-03-01', effectiveTo: null }, null);
    expect(plan).toEqual({ ok: true, value: { effectiveTo: '2026-06-30', closePrevious: null } });
  });

  it('rejects overlaps, duplicate start dates and splitting a closed version', () => {
    expect(
      planNewRateVersion([h1, h2], { effectiveFrom: '2026-07-01', effectiveTo: null }, null),
    ).toMatchObject({ ok: false, code: 'RATE_OVERLAP' });
    expect(
      planNewRateVersion([h1, h2], { effectiveFrom: '2026-03-01', effectiveTo: null }, null),
    ).toMatchObject({ ok: false, code: 'RATE_OVERLAP' });
    expect(
      planNewRateVersion([h2], { effectiveFrom: '2026-05-01', effectiveTo: '2026-07-15' }, null),
    ).toMatchObject({ ok: false, code: 'RATE_OVERLAP' });
    expect(
      planNewRateVersion([], { effectiveFrom: '2026-05-01', effectiveTo: '2026-04-01' }, null),
    ).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
  });

  it('freezes versions that were in force on locked payroll dates', () => {
    expect(rateVersionEditability(h1, '2026-09-30')).toMatchObject({
      rate: false,
      effectiveFrom: false,
      effectiveTo: false,
      delete: false,
    });
    expect(rateVersionEditability(h2, '2026-09-30')).toMatchObject({
      rate: false,
      effectiveTo: true,
      minEffectiveTo: '2026-09-30',
    });
    expect(rateVersionEditability(h2, '2026-06-30')).toMatchObject({ rate: true, delete: true });
  });

  it('lets a locked version be closed after the lock but not before it', () => {
    expect(
      planRateVersionUpdate(h2, [h1, h2], { rateChanged: false, effectiveTo: '2026-12-31' }, '2026-09-30'),
    ).toEqual({ ok: true, value: { effectiveFrom: '2026-07-01', effectiveTo: '2026-12-31' } });
    expect(
      planRateVersionUpdate(h2, [h1, h2], { rateChanged: false, effectiveTo: '2026-08-31' }, '2026-09-30'),
    ).toMatchObject({ ok: false, code: 'RATE_PERIOD_LOCKED' });
    expect(
      planRateVersionUpdate(h2, [h1, h2], { rateChanged: true }, '2026-09-30'),
    ).toMatchObject({ ok: false, code: 'RATE_PERIOD_LOCKED' });
  });

  it('allows edits to future versions as long as they stay clear of others', () => {
    const future = { id: 'f', effectiveFrom: '2026-11-01', effectiveTo: null };
    const closed = { ...h2, effectiveTo: '2026-10-31' };
    expect(
      planRateVersionUpdate(future, [h1, closed, future], { rateChanged: true, effectiveFrom: '2026-11-15' }, '2026-09-30'),
    ).toEqual({ ok: true, value: { effectiveFrom: '2026-11-15', effectiveTo: null } });
    expect(
      planRateVersionUpdate(future, [h1, closed, future], { rateChanged: false, effectiveFrom: '2026-10-15' }, '2026-09-30'),
    ).toMatchObject({ ok: false, code: 'RATE_OVERLAP' });
    expect(
      planRateVersionUpdate(future, [h1, closed, future], { rateChanged: false, effectiveFrom: '2026-09-01' }, '2026-09-30'),
    ).toMatchObject({ ok: false, code: 'RATE_PERIOD_LOCKED' });
  });
});
