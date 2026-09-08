import type {
  SafetyComplianceRequirementType,
  WorkplaceIncidentSeverity,
  WorkplaceIncidentType,
} from '@hrm/shared-types';

export const HEALTH_SAFETY_RULE_TYPE = 'health_safety';

export interface HealthSafetyRulePayload {
  incidentReporting?: {
    regulatorReportRequiredSeverities?: string[];
    regulatorReportDeadlineHours?: number;
    notifiableIncidentTypes?: string[];
    regulatorName?: string;
  };
  injuryLog?: {
    retentionYears?: number;
    requireBodyPart?: boolean;
  };
  complianceRequirements?: Array<{
    key: string;
    title: string;
    type: SafetyComplianceRequirementType;
    description?: string;
    renewalMonths?: number;
    frequencyDays?: number;
  }>;
}

export function parseHealthSafetyRules(
  payload: Record<string, unknown>,
): HealthSafetyRulePayload {
  const incidentReportingRaw = payload.incidentReporting;
  const injuryLogRaw = payload.injuryLog;
  const complianceRaw = payload.complianceRequirements;

  const incidentReporting =
    incidentReportingRaw && typeof incidentReportingRaw === 'object'
      ? (incidentReportingRaw as HealthSafetyRulePayload['incidentReporting'])
      : undefined;

  const injuryLog =
    injuryLogRaw && typeof injuryLogRaw === 'object'
      ? (injuryLogRaw as HealthSafetyRulePayload['injuryLog'])
      : undefined;

  const complianceRequirements = Array.isArray(complianceRaw)
    ? complianceRaw
        .filter((item) => item && typeof item === 'object')
        .map(
          (item) =>
            item as NonNullable<HealthSafetyRulePayload['complianceRequirements']>[number],
        )
        .filter((item) => typeof item.key === 'string' && typeof item.title === 'string')
    : undefined;

  return { incidentReporting, injuryLog, complianceRequirements };
}

export function resolveRegulatorReporting(input: {
  rules: HealthSafetyRulePayload;
  severity: WorkplaceIncidentSeverity;
  incidentType: WorkplaceIncidentType;
  occurredAt: Date;
}): {
  required: boolean;
  dueAt: Date | null;
  regulatorName: string | null;
} {
  const reporting = input.rules.incidentReporting;
  if (!reporting) {
    return { required: false, dueAt: null, regulatorName: null };
  }

  const severityMatch =
    reporting.regulatorReportRequiredSeverities?.includes(input.severity) ?? false;
  const typeMatch =
    reporting.notifiableIncidentTypes?.includes(input.incidentType) ?? false;
  const required = severityMatch || typeMatch;

  if (!required) {
    return {
      required: false,
      dueAt: null,
      regulatorName: reporting.regulatorName ?? null,
    };
  }

  const deadlineHours =
    typeof reporting.regulatorReportDeadlineHours === 'number' &&
    reporting.regulatorReportDeadlineHours > 0
      ? reporting.regulatorReportDeadlineHours
      : 24;

  const dueAt = new Date(input.occurredAt.getTime() + deadlineHours * 60 * 60 * 1000);

  return {
    required: true,
    dueAt,
    regulatorName: reporting.regulatorName ?? null,
  };
}

export function generateIncidentNumber(
  countForYear: number,
  year = new Date().getUTCFullYear(),
): string {
  const sequence = String(countForYear + 1).padStart(3, '0');
  return `WSH-${year}-${sequence}`;
}

export function computeDaysIncidentFree(
  lastIncidentOccurredAt: Date | null,
  asOf = new Date(),
): number {
  if (!lastIncidentOccurredAt) {
    return 0;
  }
  const diffMs = asOf.getTime() - lastIncidentOccurredAt.getTime();
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}
