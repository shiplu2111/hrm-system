import {
  buildRequisitionReferenceNumber,
  formatCandidateName,
  resolveApplicationDisplayStage,
  resolveInterviewRoundLabel,
  averageInterviewScore,
  isPositiveRecommendation,
} from './recruitment.utils';

describe('recruitment.utils', () => {
  it('builds sequential requisition reference numbers', () => {
    expect(buildRequisitionReferenceNumber(0, new Date('2026-03-01'))).toBe(
      'REQ-2026-001',
    );
    expect(buildRequisitionReferenceNumber(4, new Date('2026-03-01'))).toBe(
      'REQ-2026-005',
    );
  });

  it('formats candidate full names', () => {
    expect(formatCandidateName('Jennifer', 'Wu')).toBe('Jennifer Wu');
  });

  it('maps application stages to display labels', () => {
    expect(resolveApplicationDisplayStage('interview')).toBe('Interview');
    expect(resolveApplicationDisplayStage('hired')).toBe('Hired');
  });

  it('labels interview rounds in sequence', () => {
    expect(resolveInterviewRoundLabel('technical')).toBe('Technical');
    expect(resolveInterviewRoundLabel('final_decision')).toBe('Final Decision');
  });

  it('averages interview scores', () => {
    expect(averageInterviewScore([4, 5, 4.5])).toBe(4.5);
    expect(averageInterviewScore([])).toBeNull();
  });

  it('detects positive recommendations', () => {
    expect(isPositiveRecommendation('yes')).toBe(true);
    expect(isPositiveRecommendation('no')).toBe(false);
  });
});
