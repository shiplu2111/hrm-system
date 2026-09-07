import { BadRequestException } from '@nestjs/common';
import {
  HR_CASE_STATUS_TRANSITIONS,
  assertHrCaseStatusTransition,
  isHrCaseTerminal,
} from './hr-case.utils';

describe('hr-case.utils', () => {
  describe('HR_CASE_STATUS_TRANSITIONS', () => {
    it('defines Open -> Investigating -> Resolved -> Closed flow', () => {
      expect(HR_CASE_STATUS_TRANSITIONS.open).toEqual(['investigating']);
      expect(HR_CASE_STATUS_TRANSITIONS.investigating).toEqual(['resolved', 'open']);
      expect(HR_CASE_STATUS_TRANSITIONS.resolved).toEqual(['closed', 'investigating']);
      expect(HR_CASE_STATUS_TRANSITIONS.closed).toEqual([]);
    });
  });

  describe('assertHrCaseStatusTransition', () => {
    it('allows valid forward transitions', () => {
      expect(() => assertHrCaseStatusTransition('open', 'investigating')).not.toThrow();
      expect(() => assertHrCaseStatusTransition('investigating', 'resolved')).not.toThrow();
      expect(() => assertHrCaseStatusTransition('resolved', 'closed')).not.toThrow();
    });

    it('allows reopening from resolved to investigating', () => {
      expect(() => assertHrCaseStatusTransition('resolved', 'investigating')).not.toThrow();
    });

    it('allows returning to open from investigating', () => {
      expect(() => assertHrCaseStatusTransition('investigating', 'open')).not.toThrow();
    });

    it('no-ops when status is unchanged', () => {
      expect(() => assertHrCaseStatusTransition('open', 'open')).not.toThrow();
    });

    it('rejects invalid transitions', () => {
      expect(() => assertHrCaseStatusTransition('open', 'closed')).toThrow(BadRequestException);
      expect(() => assertHrCaseStatusTransition('closed', 'open')).toThrow(BadRequestException);
      expect(() => assertHrCaseStatusTransition('open', 'resolved')).toThrow(BadRequestException);
    });
  });

  describe('isHrCaseTerminal', () => {
    it('returns true only for closed', () => {
      expect(isHrCaseTerminal('closed')).toBe(true);
      expect(isHrCaseTerminal('open')).toBe(false);
      expect(isHrCaseTerminal('investigating')).toBe(false);
      expect(isHrCaseTerminal('resolved')).toBe(false);
    });
  });
});
