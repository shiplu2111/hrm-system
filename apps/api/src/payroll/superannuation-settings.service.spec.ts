import type { EffectiveDatedRule } from '@hrm/shared-types';
import { parseDateOnly } from '../rule-resolver/effective-date.utils';
import { buildVersionHistory } from './superannuation-settings.service';

function version(
  id: string,
  layer: EffectiveDatedRule['layer'],
  from: string,
  to: string | null,
  payload: Record<string, unknown>,
  stateCode: string | null = null,
) {
  return {
    id,
    layer,
    ruleType: 'social_security',
    payload,
    effectiveFrom: parseDateOnly(from),
    effectiveTo: to ? parseDateOnly(to) : null,
    stateCode,
  };
}

describe('buildVersionHistory', () => {
  const asOf = parseDateOnly('2026-10-04');

  it('labels past, current and upcoming versions relative to the as-of date', () => {
    const versions = buildVersionHistory(
      [
        version('sg-11', 'country', '2024-07-01', '2025-06-30', { employerContributionRate: 11.5 }),
        version('sg-12', 'country', '2025-07-01', null, { employerContributionRate: 12 }),
        version('co-13', 'company', '2027-01-01', null, { employerContributionRate: 13 }),
      ],
      asOf,
    );

    expect(versions.map((v) => [v.id, v.timing])).toEqual([
      ['sg-12', 'current'],
      ['sg-11', 'past'],
      ['co-13', 'upcoming'],
    ]);
    expect(versions[0].values).toEqual({ employerContributionRate: 12 });
  });

  it('marks an overlapping older version as superseded instead of current', () => {
    const versions = buildVersionHistory(
      [
        version('old-open', 'country', '2020-01-01', null, { employerContributionRate: 9.5 }),
        version('new-open', 'country', '2025-07-01', null, { employerContributionRate: 12 }),
      ],
      asOf,
    );

    expect(versions.find((v) => v.id === 'old-open')?.timing).toBe('superseded');
    expect(versions.find((v) => v.id === 'new-open')?.timing).toBe('current');
  });

  it('keeps state versions separate per state code and orders layers by the resolver chain', () => {
    const versions = buildVersionHistory(
      [
        version('co', 'company', '2025-01-01', null, {}),
        version('vic', 'state', '2025-01-01', null, {}, 'VIC'),
        version('nsw', 'state', '2025-01-01', null, {}, 'NSW'),
        version('glob', 'global', '2020-01-01', null, {}),
      ],
      asOf,
    );

    expect(versions.map((v) => v.id)).toEqual(['glob', 'nsw', 'vic', 'co']);
    expect(versions.every((v) => v.timing === 'current')).toBe(true);
  });
});
