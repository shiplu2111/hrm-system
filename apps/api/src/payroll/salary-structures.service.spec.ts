import { changedDateRanges } from './salary-structures.service';

const d = (value: string) => new Date(`${value}T00:00:00.000Z`);
const iso = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);

describe('changedDateRanges', () => {
  it('returns nothing when the range is unchanged', () => {
    expect(
      changedDateRanges(
        { from: d('2026-01-01'), to: null },
        { from: d('2026-01-01'), to: null },
      ),
    ).toEqual([]);
  });

  it('covers only the days gained or lost when the start moves', () => {
    const ranges = changedDateRanges(
      { from: d('2026-03-01'), to: null },
      { from: d('2026-01-15'), to: null },
    );
    expect(ranges.map((r) => [iso(r.from), iso(r.to)])).toEqual([
      ['2026-01-15', '2026-02-28'],
    ]);
  });

  it('treats ending an open assignment as affecting only the days after the new end', () => {
    const ranges = changedDateRanges(
      { from: d('2026-01-01'), to: null },
      { from: d('2026-01-01'), to: d('2026-09-30') },
    );
    expect(ranges.map((r) => [iso(r.from), iso(r.to)])).toEqual([['2026-10-01', null]]);
  });

  it('covers the gap between two finite end dates', () => {
    const ranges = changedDateRanges(
      { from: d('2026-01-01'), to: d('2026-06-30') },
      { from: d('2026-01-01'), to: d('2026-04-30') },
    );
    expect(ranges.map((r) => [iso(r.from), iso(r.to)])).toEqual([
      ['2026-05-01', '2026-06-30'],
    ]);
  });
});
