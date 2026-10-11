import {
  assertCertificationDates,
  certificationExpiryState,
  parseDateOnly,
  signedDaysUntil,
  supersededBy,
  type CertificationForRanking,
} from './certification.rules';

function code(fn: () => void): string | undefined {
  try {
    fn();
    return undefined;
  } catch (error) {
    return (error as { response?: { code?: string } }).response?.code;
  }
}

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const today = new Date('2026-10-11T15:30:00.000Z');

describe('certification dates', () => {
  it('parses calendar dates only', () => {
    expect(parseDateOnly('2026-02-28', 'expiryDate')).toEqual(day('2026-02-28'));
    expect(code(() => parseDateOnly('2026-02-30', 'expiryDate'))).toBe('VALIDATION_ERROR');
    expect(code(() => parseDateOnly('2026-02-28T00:00:00Z', 'expiryDate'))).toBe('VALIDATION_ERROR');
  });

  it('rejects future issue dates and expiry on or before issue', () => {
    expect(code(() => assertCertificationDates(day('2026-10-12'), null, today))).toBe('VALIDATION_ERROR');
    expect(code(() => assertCertificationDates(day('2026-01-01'), day('2026-01-01'), today))).toBe('VALIDATION_ERROR');
    expect(code(() => assertCertificationDates(day('2026-10-11'), day('2027-10-11'), today))).toBeUndefined();
    expect(code(() => assertCertificationDates(day('2020-01-01'), day('2023-01-01'), today))).toBeUndefined();
  });
});

describe('expiry state', () => {
  it('is valid through the expiry date and expired the day after', () => {
    expect(certificationExpiryState('active', day('2026-10-11'), today)).toBe('expiring_soon');
    expect(certificationExpiryState('active', day('2026-10-10'), today)).toBe('expired');
    expect(certificationExpiryState('expired', day('2027-06-01'), today)).toBe('valid');
  });

  it('warns within 30 days', () => {
    expect(certificationExpiryState('active', day('2026-11-10'), today)).toBe('expiring_soon');
    expect(certificationExpiryState('active', day('2026-11-11'), today)).toBe('valid');
  });

  it('keeps revoked and open-ended certificates apart', () => {
    expect(certificationExpiryState('revoked', day('2026-10-20'), today)).toBe('revoked');
    expect(certificationExpiryState('active', null, today)).toBe('no_expiry');
  });

  it('counts days signed', () => {
    expect(signedDaysUntil(today, day('2026-10-21'))).toBe(10);
    expect(signedDaysUntil(today, day('2026-10-01'))).toBe(-10);
  });
});

describe('renewals', () => {
  const cert = (id: string, overrides: Partial<CertificationForRanking>): CertificationForRanking => ({
    id,
    employeeId: 'emp-1',
    name: 'First Aid at Work',
    status: 'active',
    issuedAt: null,
    expiryDate: null,
    createdAt: day('2026-01-01'),
    ...overrides,
  });

  it('marks older certificates with the same name as replaced by the longest-running one', () => {
    const result = supersededBy([
      cert('old', { expiryDate: day('2026-10-20') }),
      cert('new', { name: ' first aid  at work', expiryDate: day('2029-10-20') }),
      cert('other', { name: 'Forklift licence', expiryDate: day('2026-10-01') }),
      cert('someone-else', { employeeId: 'emp-2', expiryDate: day('2025-01-01') }),
    ]);
    expect([...result]).toEqual([['old', 'new']]);
  });

  it('ignores revoked certificates', () => {
    const result = supersededBy([
      cert('old', { expiryDate: day('2026-10-20') }),
      cert('revoked', { status: 'revoked', expiryDate: day('2029-10-20') }),
    ]);
    expect(result.size).toBe(0);
  });

  it('treats no expiry as the longest-running', () => {
    const result = supersededBy([cert('dated', { expiryDate: day('2030-01-01') }), cert('open', {})]);
    expect(result.get('dated')).toBe('open');
  });
});
