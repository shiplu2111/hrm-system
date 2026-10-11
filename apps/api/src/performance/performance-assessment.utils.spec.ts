import { Decimal } from '@prisma/client/runtime/library';
import { assessmentCompletion, assessmentScore } from '@hrm/shared-types';
import {
  applyAssessmentPatch,
  emptyAssessmentPayload,
  managerAssessmentView,
  syncKpiItems,
  type ReviewKpiGoal,
} from './performance-assessment.utils';

function goal(id: string, overrides: Partial<ReviewKpiGoal> = {}): ReviewKpiGoal {
  return {
    id,
    title: `Goal ${id}`,
    unit: 'percentage',
    direction: 'higher_is_better',
    targetValue: new Decimal(80),
    currentValue: new Decimal(60),
    weightPercent: new Decimal(50),
    measurementPeriodStart: new Date('2026-07-01'),
    measurementPeriodEnd: new Date('2026-09-30'),
    status: 'active',
    ...overrides,
  };
}

describe('syncKpiItems', () => {
  it('keeps ratings by goal, drops cancelled goals and adds newly active ones', () => {
    const items = syncKpiItems([], [goal('a'), goal('b')]).map((item) => ({
      ...item,
      selfRating: 4,
      selfComment: 'ok',
    }));
    const synced = syncKpiItems(items, [
      goal('a', { currentValue: new Decimal(80) }),
      goal('b', { status: 'cancelled' }),
      goal('c'),
      goal('d', { status: 'draft' }),
    ]);
    expect(synced.map((item) => item.kpiAssignmentId)).toEqual(['a', 'c']);
    expect(synced[0]).toMatchObject({ selfRating: 4, selfComment: 'ok', currentValue: 80, progressPercent: 100 });
    expect(synced[1].selfRating).toBeUndefined();
    expect(synced[0]).toMatchObject({ weightPercent: 50, measurementPeriodStart: '2026-07-01' });
  });
});

describe('applyAssessmentPatch', () => {
  const base = { ...emptyAssessmentPayload(), kpiAssessments: syncKpiItems([], [goal('a')]) };

  it('sets only the given side and trims comments', () => {
    const next = applyAssessmentPatch(base, 'self', {
      competencies: [{ key: 'impact', rating: 4, comment: '  shipped onboarding  ' }],
      kpiAssessments: [{ kpiAssignmentId: 'a', rating: 3 }],
      overallComment: '   ',
    });
    expect(next.competencies[0]).toMatchObject({ selfRating: 4, selfComment: 'shipped onboarding' });
    expect(next.competencies[0].managerRating).toBeUndefined();
    expect(next.kpiAssessments[0].selfRating).toBe(3);
    expect(next.overallSelfComment).toBeNull();
  });

  it('rejects items that are not on the review', () => {
    expect(() => applyAssessmentPatch(base, 'self', { competencies: [{ key: 'charisma', rating: 5 }] })).toThrow(
      /not a competency/,
    );
    expect(() =>
      applyAssessmentPatch(base, 'manager', { kpiAssessments: [{ kpiAssignmentId: 'zzz', rating: 5 }] }),
    ).toThrow(/no longer part of the review/);
  });
});

describe('managerAssessmentView', () => {
  it('takes self fields from the self assessment, never from the manager payload', () => {
    const self = applyAssessmentPatch(emptyAssessmentPayload(), 'self', {
      competencies: [{ key: 'impact', rating: 4 }],
      overallComment: 'mine',
    });
    const tampered = {
      ...emptyAssessmentPayload(),
      competencies: [{ key: 'impact', label: 'Business impact', selfRating: 1, managerRating: 3 }],
      overallSelfComment: 'changed',
      overallManagerComment: 'theirs',
    };
    const view = managerAssessmentView(self, tampered);
    expect(view.competencies[0]).toMatchObject({ selfRating: 4, managerRating: 3 });
    expect(view.overallSelfComment).toBe('mine');
    expect(view.overallManagerComment).toBe('theirs');
  });
});

describe('assessment completion and score', () => {
  it('lists unrated items and weights KPI ratings by goal weight', () => {
    const payload = applyAssessmentPatch(
      {
        ...emptyAssessmentPayload(),
        kpiAssessments: syncKpiItems([], [
          goal('a', { weightPercent: new Decimal(75) }),
          goal('b', { weightPercent: new Decimal(25) }),
        ]),
      },
      'manager',
      {
        competencies: ['impact', 'ownership', 'collaboration', 'craft'].map((key) => ({ key, rating: 3 })),
        kpiAssessments: [
          { kpiAssignmentId: 'a', rating: 5 },
          { kpiAssignmentId: 'b', rating: 1 },
        ],
      },
    );
    expect(assessmentCompletion(payload, 'manager')).toEqual({ rated: 6, total: 6, missing: [] });
    expect(assessmentCompletion(payload, 'self').missing).toHaveLength(6);
    // KPI average = (5×75 + 1×25) / 100 = 4; score = 3×0.6 + 4×0.4 = 3.4
    expect(assessmentScore(payload, 'manager')).toBeCloseTo(3.4);
  });
});
