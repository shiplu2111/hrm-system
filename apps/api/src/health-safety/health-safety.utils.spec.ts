import {
  parseHealthSafetyRules,
  resolveRegulatorReporting,
} from './health-safety.utils';

describe('health-safety.utils', () => {
  describe('parseHealthSafetyRules', () => {
    it('parses incident reporting and compliance requirements', () => {
      const rules = parseHealthSafetyRules({
        incidentReporting: {
          regulatorReportRequiredSeverities: ['high', 'critical'],
          regulatorReportDeadlineHours: 48,
          regulatorName: 'Safe Work Australia',
        },
        complianceRequirements: [
          { key: 'safety_induction', title: 'Safety induction', type: 'training' },
        ],
        injuryLog: { requireBodyPart: true },
      });

      expect(rules.incidentReporting?.regulatorName).toBe('Safe Work Australia');
      expect(rules.complianceRequirements).toHaveLength(1);
      expect(rules.injuryLog?.requireBodyPart).toBe(true);
    });
  });

  describe('resolveRegulatorReporting', () => {
    const baseRules = parseHealthSafetyRules({
      incidentReporting: {
        regulatorReportRequiredSeverities: ['high', 'critical'],
        notifiableIncidentTypes: ['injury'],
        regulatorReportDeadlineHours: 24,
        regulatorName: 'Safe Work Australia',
      },
    });

    it('requires regulator report for high severity', () => {
      const occurredAt = new Date('2026-01-01T10:00:00.000Z');
      const result = resolveRegulatorReporting({
        rules: baseRules,
        severity: 'high',
        incidentType: 'near_miss',
        occurredAt,
      });

      expect(result.required).toBe(true);
      expect(result.regulatorName).toBe('Safe Work Australia');
      expect(result.dueAt?.toISOString()).toBe('2026-01-02T10:00:00.000Z');
    });

    it('requires regulator report for notifiable incident type', () => {
      const result = resolveRegulatorReporting({
        rules: baseRules,
        severity: 'low',
        incidentType: 'injury',
        occurredAt: new Date('2026-01-01T10:00:00.000Z'),
      });

      expect(result.required).toBe(true);
    });

    it('does not require report when rules do not match', () => {
      const result = resolveRegulatorReporting({
        rules: baseRules,
        severity: 'low',
        incidentType: 'near_miss',
        occurredAt: new Date('2026-01-01T10:00:00.000Z'),
      });

      expect(result.required).toBe(false);
      expect(result.dueAt).toBeNull();
    });
  });
});
