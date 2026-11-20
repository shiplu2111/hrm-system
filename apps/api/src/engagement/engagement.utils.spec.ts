import {
  DEFAULT_KUDOS_REMOVAL_REASON,
  computeEnps,
  formatModeratorName,
  normalizeRemovalReason,
  resolveKudosType,
} from './engagement.utils';

describe('engagement.utils', () => {
  describe('computeEnps', () => {
    it('returns zero for empty scores', () => {
      expect(computeEnps([])).toEqual({
        score: 0,
        promoters: 0,
        passives: 0,
        detractors: 0,
        total: 0,
        distribution: Array.from({ length: 11 }, (_, score) => ({ score, count: 0 })),
      });
    });

    it('computes eNPS from 0–10 scores', () => {
      const result = computeEnps([10, 9, 8, 7, 6, 0]);
      expect(result.promoters).toBe(2);
      expect(result.passives).toBe(2);
      expect(result.detractors).toBe(2);
      expect(result.score).toBe(0);
    });

    it('returns positive eNPS when promoters dominate', () => {
      const result = computeEnps([10, 10, 10, 9, 9]);
      expect(result.score).toBe(100);
    });
  });

  describe('resolveKudosType', () => {
    const managerId = '11111111-1111-4111-8111-111111111111';
    const peerId = '22222222-2222-4222-8222-222222222222';

    it('returns manager when sender is recipient direct manager', () => {
      expect(resolveKudosType(managerId, managerId)).toBe('manager');
    });

    it('returns peer when sender is not the recipient manager', () => {
      expect(resolveKudosType(peerId, managerId)).toBe('peer');
    });

    it('returns peer when recipient has no manager', () => {
      expect(resolveKudosType(peerId, null)).toBe('peer');
    });
  });

  describe('normalizeRemovalReason', () => {
    it('trims non-empty moderation reasons', () => {
      expect(normalizeRemovalReason('  Inappropriate language  ')).toBe('Inappropriate language');
    });

    it('falls back to default reason when empty or omitted', () => {
      expect(normalizeRemovalReason(undefined)).toBe(DEFAULT_KUDOS_REMOVAL_REASON);
      expect(normalizeRemovalReason(null)).toBe(DEFAULT_KUDOS_REMOVAL_REASON);
      expect(normalizeRemovalReason('   ')).toBe(DEFAULT_KUDOS_REMOVAL_REASON);
    });
  });

  describe('formatModeratorName', () => {
    it('prefers employee full name when linked', () => {
      expect(
        formatModeratorName({
          email: 'hr@cmsnbd.com',
          employee: { firstName: 'Sadia', lastName: 'Rahman' },
        }),
      ).toBe('Sadia Rahman');
    });

    it('falls back to email when user has no linked employee record', () => {
      expect(formatModeratorName({ email: 'admin@cmsnbd.com', employee: null })).toBe(
        'admin@cmsnbd.com',
      );
    });

    it('returns null when moderator is null or undefined', () => {
      expect(formatModeratorName(null)).toBeNull();
    });
  });
});
