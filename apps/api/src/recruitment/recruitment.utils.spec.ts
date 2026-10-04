import { OFFER_LETTER_TEMPLATES, renderOfferTemplateText } from '@hrm/shared-types';
import {
  addMonthsIsoDate,
  buildRequisitionReferenceNumber,
  formatCandidateName,
  matchReportingToEmployee,
  nextEmployeeNumber,
  resolveApplicationDisplayStage,
  resolveInterviewRoundLabel,
  resolveOfferTemplateLabel,
  averageInterviewScore,
  isPositiveRecommendation,
  stageChangeBlockReason,
} from './recruitment.utils';

describe('recruitment.utils', () => {
  describe('stageChangeBlockReason', () => {
    it('allows moves between active and closed stages', () => {
      expect(stageChangeBlockReason('applied', 'interview', null)).toBeNull();
      expect(stageChangeBlockReason('offer', 'rejected', null)).toBeNull();
      expect(stageChangeBlockReason('withdrawn', 'screening', null)).toBeNull();
    });

    it('blocks manual moves into hired', () => {
      expect(stageChangeBlockReason('offer', 'hired', null)).toMatch(/Convert to employee/);
    });

    it('freezes hired applications but allows rating-only updates', () => {
      expect(stageChangeBlockReason('hired', 'offer', 'emp-1')).toMatch(/final/);
      expect(stageChangeBlockReason('hired', 'hired', 'emp-1')).toBeNull();
      expect(stageChangeBlockReason('offer', 'rejected', 'emp-1')).toMatch(/final/);
    });
  });

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

  describe('offer templates', () => {
    it('labels every template from the shared definitions', () => {
      expect(resolveOfferTemplateLabel('senior')).toBe('Senior Role Offer');
      expect(resolveOfferTemplateLabel('unknown')).toBe('unknown');
    });

    it('fills placeholders and blanks missing values', () => {
      const text = renderOfferTemplateText(OFFER_LETTER_TEMPLATES.remote.intro, {
        jobTitle: 'QA Lead',
        companyName: 'Acme',
        startDate: '2026-11-02',
      });
      expect(text).toContain('remote position of QA Lead at Acme, commencing on 2026-11-02');
      expect(renderOfferTemplateText('Hi {{missing}}!', {})).toBe('Hi !');
    });
  });

  describe('matchReportingToEmployee', () => {
    const employees = [
      { id: 'e1', firstName: 'Alex', lastName: 'Thompson' },
      { id: 'e2', firstName: 'Priya', lastName: 'Patel' },
      { id: 'e3', firstName: 'Priya', lastName: 'Patel' },
    ];

    it('matches a unique full name regardless of case and spacing', () => {
      expect(matchReportingToEmployee('  alex   THOMPSON ', employees)?.id).toBe('e1');
    });

    it('ignores a trailing job title', () => {
      expect(matchReportingToEmployee('Alex Thompson, Engineering Manager', employees)?.id).toBe('e1');
      expect(matchReportingToEmployee('Alex Thompson (Eng Manager)', employees)?.id).toBe('e1');
    });

    it('returns null for ambiguous, unknown or empty names', () => {
      expect(matchReportingToEmployee('Priya Patel', employees)).toBeNull();
      expect(matchReportingToEmployee('Head of Engineering', employees)).toBeNull();
      expect(matchReportingToEmployee(null, employees)).toBeNull();
    });
  });

  it('picks the next unused employee number', () => {
    expect(nextEmployeeNumber(['EMP-001', 'EMP-002'], 3)).toBe('EMP-003');
    expect(nextEmployeeNumber(['EMP-001', 'emp-003', 'EMP-004'], 3)).toBe('EMP-005');
    expect(nextEmployeeNumber([], 0)).toBe('EMP-001');
  });

  it('adds whole months to an ISO date', () => {
    expect(addMonthsIsoDate('2026-11-02', 6)).toBe('2027-05-02');
    expect(addMonthsIsoDate('2026-12-15', 3)).toBe('2027-03-15');
  });
});
