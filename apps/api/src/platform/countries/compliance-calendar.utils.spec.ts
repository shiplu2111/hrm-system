import {
  formatDateUtc,
  getLastDayOfMonth,
  parseDateUtc,
  resolveNextDueDate,
} from './compliance-calendar.utils';

describe('compliance-calendar.utils', () => {
  describe('getLastDayOfMonth', () => {
    it('should return 31 for January', () => {
      expect(getLastDayOfMonth(2026, 1)).toBe(31);
    });

    it('should return 28 for February in non-leap year 2026', () => {
      expect(getLastDayOfMonth(2026, 2)).toBe(28);
    });

    it('should return 29 for February in leap year 2028', () => {
      expect(getLastDayOfMonth(2028, 2)).toBe(29);
    });

    it('should return 30 for April', () => {
      expect(getLastDayOfMonth(2026, 4)).toBe(30);
    });
  });

  describe('resolveNextDueDate', () => {
    describe('monthly recurrence', () => {
      it('should resolve current month if day has not yet passed', () => {
        const result = resolveNextDueDate(
          'monthly',
          { dayOfMonth: 21 },
          '2026-11-15',
          7,
        );
        expect(result).not.toBeNull();
        expect(result?.dueDate).toBe('2026-11-21');
        expect(result?.daysRemaining).toBe(6);
        expect(result?.isNoticeDue).toBe(true);
      });

      it('should resolve next month if current month day has passed', () => {
        const result = resolveNextDueDate(
          'monthly',
          { dayOfMonth: 21 },
          '2026-11-22',
          7,
        );
        expect(result).not.toBeNull();
        expect(result?.dueDate).toBe('2026-12-21');
        expect(result?.daysRemaining).toBe(29);
        expect(result?.isNoticeDue).toBe(false);
      });

      it('should handle last day of month correctly in February', () => {
        const result = resolveNextDueDate(
          'monthly',
          { lastDayOfMonth: true },
          '2026-02-10',
          7,
        );
        expect(result).not.toBeNull();
        expect(result?.dueDate).toBe('2026-02-28');
        expect(result?.daysRemaining).toBe(18);
        expect(result?.isNoticeDue).toBe(false);
      });

      it('should roll over from December to January of next year', () => {
        const result = resolveNextDueDate(
          'monthly',
          { dayOfMonth: 15 },
          '2026-12-20',
          7,
        );
        expect(result).not.toBeNull();
        expect(result?.dueDate).toBe('2027-01-15');
        expect(result?.daysRemaining).toBe(26);
      });
    });

    describe('quarterly recurrence', () => {
      it('should resolve next quarter month correctly', () => {
        // BAS due 28th of Jan, Apr, Jul, Oct
        const result = resolveNextDueDate(
          'quarterly',
          { dayOfMonth: 28, quarterMonthOffsets: [1, 4, 7, 10] },
          '2026-02-15',
          14,
        );
        expect(result).not.toBeNull();
        expect(result?.dueDate).toBe('2026-04-28');
        expect(result?.daysRemaining).toBe(72);
        expect(result?.isNoticeDue).toBe(false);
      });

      it('should trigger notice when within notice window', () => {
        const result = resolveNextDueDate(
          'quarterly',
          { dayOfMonth: 28, quarterMonthOffsets: [1, 4, 7, 10] },
          '2026-04-20',
          14,
        );
        expect(result).not.toBeNull();
        expect(result?.dueDate).toBe('2026-04-28');
        expect(result?.daysRemaining).toBe(8);
        expect(result?.isNoticeDue).toBe(true);
      });

      it('should roll over into Q1 of next year', () => {
        const result = resolveNextDueDate(
          'quarterly',
          { dayOfMonth: 28, quarterMonthOffsets: [1, 4, 7, 10] },
          '2026-11-01',
          14,
        );
        expect(result).not.toBeNull();
        expect(result?.dueDate).toBe('2027-01-28');
      });
    });

    describe('yearly recurrence', () => {
      it('should resolve yearly return date', () => {
        const result = resolveNextDueDate(
          'yearly',
          { month: 10, dayOfMonth: 31 },
          '2026-08-15',
          30,
        );
        expect(result).not.toBeNull();
        expect(result?.dueDate).toBe('2026-10-31');
        expect(result?.isNoticeDue).toBe(false);
      });

      it('should trigger notice when within yearly notice window', () => {
        const result = resolveNextDueDate(
          'yearly',
          { month: 10, dayOfMonth: 31 },
          '2026-10-15',
          30,
        );
        expect(result).not.toBeNull();
        expect(result?.dueDate).toBe('2026-10-31');
        expect(result?.daysRemaining).toBe(16);
        expect(result?.isNoticeDue).toBe(true);
      });

      it('should roll over to next year if date has passed', () => {
        const result = resolveNextDueDate(
          'yearly',
          { month: 10, dayOfMonth: 31 },
          '2026-11-05',
          30,
        );
        expect(result).not.toBeNull();
        expect(result?.dueDate).toBe('2027-10-31');
      });
    });

    describe('fixed_date recurrence', () => {
      it('should resolve specific fixed date', () => {
        const result = resolveNextDueDate(
          'fixed_date',
          { specificDate: '2026-12-31' },
          '2026-12-25',
          7,
        );
        expect(result).not.toBeNull();
        expect(result?.dueDate).toBe('2026-12-31');
        expect(result?.daysRemaining).toBe(6);
        expect(result?.isNoticeDue).toBe(true);
      });
    });
  });
});
