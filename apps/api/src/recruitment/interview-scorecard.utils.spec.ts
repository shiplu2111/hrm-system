import { BadRequestException } from '@nestjs/common';
import { INTERVIEW_SCORECARD_CRITERIA } from '@hrm/shared-types';
import {
  buildInterviewScorecard,
  findInterviewerConflict,
  isRoundNextInLine,
  parseInterviewScorecard,
} from './interview-scorecard.utils';

const at = (iso: string) => new Date(iso);

describe('buildInterviewScorecard', () => {
  const hrKeys = INTERVIEW_SCORECARD_CRITERIA.hr.map((c) => c.key);

  it('averages criterion ratings into the round score', () => {
    const ratings = hrKeys.map((key, i) => ({ key, rating: i < 2 ? 5 : 4 }));
    const { score, scorecard } = buildInterviewScorecard('hr', {
      ratings,
      strengths: '  Clear communicator ',
      concerns: '',
    });

    expect(score).toBe(4.4);
    expect(scorecard.ratings.map((r) => r.key)).toEqual(hrKeys);
    expect(scorecard.strengths).toBe('Clear communicator');
    expect(scorecard.concerns).toBeNull();
  });

  it('rejects criteria from another round', () => {
    expect(() =>
      buildInterviewScorecard('hr', {
        ratings: [{ key: 'system_design', rating: 4 }],
      }),
    ).toThrow(BadRequestException);
  });

  it('requires every criterion to be rated', () => {
    expect(() =>
      buildInterviewScorecard('hr', {
        ratings: [{ key: hrKeys[0], rating: 4 }],
      }),
    ).toThrow(/Rate every criterion/);
  });

  it('rejects duplicate and out-of-range ratings', () => {
    expect(() =>
      buildInterviewScorecard('hr', {
        ratings: [
          { key: hrKeys[0], rating: 4 },
          { key: hrKeys[0], rating: 3 },
        ],
      }),
    ).toThrow(/more than once/);
    expect(() =>
      buildInterviewScorecard('hr', {
        ratings: [{ key: hrKeys[0], rating: 6 }],
      }),
    ).toThrow(/whole numbers/);
  });
});

describe('parseInterviewScorecard', () => {
  it('returns null for legacy rounds without a scorecard', () => {
    expect(parseInterviewScorecard(null)).toBeNull();
    expect(parseInterviewScorecard({ foo: 1 })).toBeNull();
  });

  it('drops malformed rating entries', () => {
    expect(
      parseInterviewScorecard({
        ratings: [{ key: 'leadership', rating: 4 }, { key: 3 }],
        strengths: 'Ownership',
      }),
    ).toEqual({
      ratings: [{ key: 'leadership', rating: 4, comment: null }],
      strengths: 'Ownership',
      concerns: null,
    });
  });
});

describe('findInterviewerConflict', () => {
  const existing = [
    { id: 'a', scheduledStartAt: at('2026-10-05T10:00:00Z'), scheduledEndAt: at('2026-10-05T11:00:00Z') },
    { id: 'b', scheduledStartAt: at('2026-10-05T14:00:00Z'), scheduledEndAt: null },
  ];

  it('detects overlap with a bounded slot', () => {
    expect(
      findInterviewerConflict(
        { start: at('2026-10-05T10:30:00Z'), end: at('2026-10-05T11:30:00Z') },
        existing,
      )?.id,
    ).toBe('a');
  });

  it('treats open-ended bookings as one hour', () => {
    expect(
      findInterviewerConflict({ start: at('2026-10-05T14:45:00Z'), end: null }, existing)?.id,
    ).toBe('b');
    expect(
      findInterviewerConflict({ start: at('2026-10-05T15:00:00Z'), end: null }, existing),
    ).toBeNull();
  });

  it('allows back-to-back interviews', () => {
    expect(
      findInterviewerConflict(
        { start: at('2026-10-05T11:00:00Z'), end: at('2026-10-05T12:00:00Z') },
        existing,
      ),
    ).toBeNull();
  });
});

describe('isRoundNextInLine', () => {
  it('requires all earlier rounds to be completed or skipped', () => {
    const siblings = [
      { roundOrder: 1, status: 'completed' },
      { roundOrder: 2, status: 'skipped' },
      { roundOrder: 3, status: 'pending' },
      { roundOrder: 4, status: 'pending' },
    ];
    expect(isRoundNextInLine({ roundOrder: 1 }, siblings)).toBe(true);
    expect(isRoundNextInLine({ roundOrder: 3 }, siblings)).toBe(true);
    expect(isRoundNextInLine({ roundOrder: 4 }, siblings)).toBe(false);
  });
});
