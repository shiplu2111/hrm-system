import { combineOverallRating, ratingLabelForScore } from '@hrm/shared-types';
import {
  assertCanCalibrate,
  assertPromotionConvertible,
  assertRecommendationAwaitingDecision,
  assertRecommendationEditable,
  assertRecommendationSubmittable,
  noteWithRejection,
} from './promotion.rules';

describe('overall rating', () => {
  it('combines manager score and 360 average 60/40', () => {
    expect(combineOverallRating(4.55, 4.25)).toBe(4.43);
    expect(combineOverallRating(3.2, null)).toBe(3.2);
    expect(combineOverallRating(null, null)).toBeNull();
  });

  it('labels from the score', () => {
    expect(ratingLabelForScore(4.7)).toBe('outstanding');
    expect(ratingLabelForScore(3.5)).toBe('exceeds_expectations');
    expect(ratingLabelForScore(2.49)).toBe('needs_improvement');
  });
});

describe('calibration', () => {
  const base = { reviewStatus: 'approved', cycleStatus: 'active', promotionStatus: 'none' } as const;

  it('is allowed after the manager submits while the cycle runs', () => {
    expect(() => assertCanCalibrate(base)).not.toThrow();
    expect(() => assertCanCalibrate({ ...base, reviewStatus: 'pending_approval' })).not.toThrow();
  });

  it('is blocked before manager submission, after close, or after a promotion', () => {
    expect(() => assertCanCalibrate({ ...base, reviewStatus: 'manager_review' })).toThrow('once the manager has submitted');
    expect(() => assertCanCalibrate({ ...base, cycleStatus: 'closed' })).toThrow('review cycle is closed');
    expect(() => assertCanCalibrate({ ...base, promotionStatus: 'executed' })).toThrow('promotion has been recorded');
  });
});

describe('promotion recommendation', () => {
  const editable = { reviewStatus: 'manager_review', cycleStatus: 'active', promotionStatus: 'none' } as const;

  it('can be edited until it is submitted, and again after rejection', () => {
    expect(() => assertRecommendationEditable(editable)).not.toThrow();
    expect(() => assertRecommendationEditable({ ...editable, promotionStatus: 'rejected' })).not.toThrow();
    expect(() => assertRecommendationEditable({ ...editable, promotionStatus: 'submitted' })).toThrow('is with HR');
    expect(() => assertRecommendationEditable({ ...editable, promotionStatus: 'approved' })).toThrow('has been approved');
    expect(() => assertRecommendationEditable({ ...editable, reviewStatus: 'self_assessment_draft' })).toThrow(
      'submitted their self-assessment',
    );
  });

  it('needs a designation, draft status and a justification to submit', () => {
    const ready = { promotionStatus: 'draft', promotionRecommended: true, recommendedDesignationId: 'd1', note: 'Led launch' } as const;
    expect(() => assertRecommendationSubmittable(ready)).not.toThrow();
    expect(() => assertRecommendationSubmittable({ ...ready, recommendedDesignationId: null })).toThrow('with a designation');
    expect(() => assertRecommendationSubmittable({ ...ready, note: '  ' })).toThrow('Add a justification');
    expect(() => assertRecommendationSubmittable({ ...ready, promotionStatus: 'rejected' })).toThrow('Revise the rejected');
  });

  it('is decided only while submitted', () => {
    expect(() => assertRecommendationAwaitingDecision('submitted')).not.toThrow();
    expect(() => assertRecommendationAwaitingDecision('draft')).toThrow('not awaiting a decision');
  });

  it('converts only when the review and recommendation are approved', () => {
    expect(() => assertPromotionConvertible({ reviewStatus: 'approved', promotionStatus: 'approved' })).not.toThrow();
    expect(() => assertPromotionConvertible({ reviewStatus: 'approved', promotionStatus: 'submitted' })).toThrow(
      'must be approved before converting',
    );
    expect(() => assertPromotionConvertible({ reviewStatus: 'pending_approval', promotionStatus: 'approved' })).toThrow(
      'review must be approved',
    );
    expect(() => assertPromotionConvertible({ reviewStatus: 'approved', promotionStatus: 'executed' })).toThrow(
      'already been recorded',
    );
  });

  it('appends dated rejection reasons', () => {
    expect(noteWithRejection('Strong year', 'Wait for budget', '2026-10-11')).toBe(
      'Strong year\n\nRejected 2026-10-11: Wait for budget',
    );
  });
});
