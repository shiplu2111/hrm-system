import {
  computeDisplayStatus,
  formatDateValue,
  formatPayRate,
  parseDateString,
  parseOvertimeRule,
} from './employment-contract.utils';

describe('employment-contract.utils', () => {
  describe('parseDateString / formatDateValue', () => {
    it('round-trips YYYY-MM-DD dates', () => {
      const date = parseDateString('2026-06-15');
      expect(formatDateValue(date)).toBe('2026-06-15');
    });

    it('throws on invalid date strings', () => {
      expect(() => parseDateString('bad')).toThrow(/Invalid date/);
    });
  });

  describe('computeDisplayStatus', () => {
    const asOf = new Date('2026-06-01T12:00:00.000Z');

    it('returns draft and terminated from stored status', () => {
      expect(
        computeDisplayStatus({
          status: 'draft',
          startDate: parseDateString('2026-01-01'),
          endDate: null,
          asOf,
        }),
      ).toBe('draft');

      expect(
        computeDisplayStatus({
          status: 'terminated',
          startDate: parseDateString('2026-01-01'),
          endDate: parseDateString('2026-12-31'),
          asOf,
        }),
      ).toBe('terminated');
    });

    it('marks contracts past end date as expired', () => {
      expect(
        computeDisplayStatus({
          status: 'active',
          startDate: parseDateString('2025-01-01'),
          endDate: parseDateString('2026-05-01'),
          asOf,
        }),
      ).toBe('expired');
    });

    it('returns pending_approval when renewal workflow is pending', () => {
      expect(
        computeDisplayStatus({
          status: 'draft',
          startDate: parseDateString('2026-01-01'),
          endDate: parseDateString('2027-01-01'),
          renewalWorkflowStatus: 'pending',
        }),
      ).toBe('pending_approval');
    });

    it('marks contracts within 30 days of end as expiring_soon', () => {
      expect(
        computeDisplayStatus({
          status: 'active',
          startDate: parseDateString('2025-01-01'),
          endDate: parseDateString('2026-06-20'),
          asOf,
        }),
      ).toBe('expiring_soon');
    });

    it('returns active when no end date or end date is far away', () => {
      expect(
        computeDisplayStatus({
          status: 'active',
          startDate: parseDateString('2026-01-01'),
          endDate: null,
          asOf,
        }),
      ).toBe('active');

      expect(
        computeDisplayStatus({
          status: 'active',
          startDate: parseDateString('2026-01-01'),
          endDate: parseDateString('2027-01-01'),
          asOf,
        }),
      ).toBe('active');
    });
  });

  describe('parseOvertimeRule', () => {
    it('parses valid overtime rules', () => {
      expect(
        parseOvertimeRule({
          type: 'multiplier_after_weekly_hours',
          thresholdHours: 40,
          multiplier: 1.5,
        }),
      ).toEqual({
        type: 'multiplier_after_weekly_hours',
        thresholdHours: 40,
        multiplier: 1.5,
        description: undefined,
      });
    });

    it('returns null for invalid payloads', () => {
      expect(parseOvertimeRule(null)).toBeNull();
      expect(parseOvertimeRule({ type: 'invalid' })).toBeNull();
    });
  });

  describe('formatPayRate', () => {
    it('formats currency with frequency suffix', () => {
      const formatted = formatPayRate(85000, 'annual', 'AUD');
      expect(formatted).toMatch(/\$85,000\.00\/yr/);
    });

    it('returns null when pay rate is missing', () => {
      expect(formatPayRate(null, 'monthly', 'AUD')).toBeNull();
    });
  });
});
