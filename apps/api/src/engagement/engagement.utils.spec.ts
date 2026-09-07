import { computeEnps, resolveKudosType } from './engagement.utils';

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
});
