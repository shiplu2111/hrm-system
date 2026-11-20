import { BadRequestException } from '@nestjs/common';
import {
  buildIncidentReportingConfig,
  parseHealthSafetyRules,
  resolveRegulatorReporting,
  validateAndSanitizeCountrySpecificData,
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

  describe('reportingFields parsing and validation', () => {
    const rules = parseHealthSafetyRules({
      incidentReporting: {
        regulatorName: 'OSHA',
        regulatorReferenceLabel: 'OSHA Case Number',
        regulatorReportRequiredSeverities: ['high', 'critical'],
        regulatorReportDeadlineHours: 8,
        reportingFields: [
          {
            key: 'oshaClassification',
            label: 'OSHA Classification',
            type: 'select',
            requiredWhenRegulatorNotifiable: true,
            options: [
              { value: 'days_away', label: 'Days away from work' },
              { value: 'restricted', label: 'Restricted work' },
            ],
          },
          {
            key: 'daysAwayFromWork',
            label: 'Days Away From Work',
            type: 'number',
          },
          {
            key: 'sitePreserved',
            label: 'Site Preserved',
            type: 'boolean',
            required: true,
          },
          { key: 'badType', label: 'Bad', type: 'unknown_widget' },
        ],
      },
    });

    it('parses valid reporting fields and drops malformed widget types', () => {
      const cfg = buildIncidentReportingConfig(rules);
      expect(cfg.regulatorName).toBe('OSHA');
      expect(cfg.regulatorReferenceLabel).toBe('OSHA Case Number');
      expect(cfg.reportingFields).toHaveLength(3);
      expect(cfg.reportingFields.map((f) => f.key)).toEqual([
        'oshaClassification',
        'daysAwayFromWork',
        'sitePreserved',
      ]);
    });

    it('sanitizes types and strips unknown keys', () => {
      const sanitized = validateAndSanitizeCountrySpecificData({
        data: {
          oshaClassification: 'days_away',
          daysAwayFromWork: '3',
          sitePreserved: true,
          injectedExtraKey: 'should-be-dropped',
        },
        fields: rules.incidentReporting?.reportingFields ?? [],
        regulatorRequired: true,
        enforceRequired: true,
        enforceRegulatorRequired: true,
      });

      expect(sanitized).toEqual({
        oshaClassification: 'days_away',
        daysAwayFromWork: 3,
        sitePreserved: true,
      });
    });

    it('rejects missing requiredWhenRegulatorNotifiable fields on regulator submission', () => {
      expect(() =>
        validateAndSanitizeCountrySpecificData({
          data: { sitePreserved: false },
          fields: rules.incidentReporting?.reportingFields ?? [],
          regulatorRequired: true,
          enforceRequired: true,
          enforceRegulatorRequired: true,
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects invalid select option values', () => {
      expect(() =>
        validateAndSanitizeCountrySpecificData({
          data: { oshaClassification: 'invalid_choice', sitePreserved: true },
          fields: rules.incidentReporting?.reportingFields ?? [],
          regulatorRequired: false,
          enforceRequired: true,
          enforceRegulatorRequired: false,
        }),
      ).toThrow(BadRequestException);
    });
  });
});
