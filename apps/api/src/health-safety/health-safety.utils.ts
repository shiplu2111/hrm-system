import { BadRequestException } from '@nestjs/common';
import type {
  HealthSafetyRuleLayerSummary,
  IncidentReportingRuleConfig,
  SafetyComplianceRequirementType,
  SafetyReportingFieldDefinition,
  SafetyReportingFieldOption,
  SafetyReportingFieldType,
  WorkplaceIncidentSeverity,
  WorkplaceIncidentType,
} from '@hrm/shared-types';

export const HEALTH_SAFETY_RULE_TYPE = 'health_safety';

const VALID_REPORTING_FIELD_TYPES = new Set<SafetyReportingFieldType>([
  'text',
  'textarea',
  'number',
  'boolean',
  'date',
  'select',
]);

export interface HealthSafetyRulePayload {
  incidentReporting?: {
    regulatorReportRequiredSeverities?: string[];
    regulatorReportDeadlineHours?: number;
    notifiableIncidentTypes?: string[];
    regulatorName?: string;
    regulatorReferenceLabel?: string;
    reportingFields?: SafetyReportingFieldDefinition[];
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

function parseReportingFieldOptions(raw: unknown): SafetyReportingFieldOption[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const options = raw
    .filter((item) => item && typeof item === 'object')
    .map((item) => item as Record<string, unknown>)
    .filter((item) => typeof item.value === 'string' && typeof item.label === 'string')
    .map((item) => ({ value: item.value as string, label: item.label as string }));
  return options.length > 0 ? options : undefined;
}

export function parseReportingFields(raw: unknown): SafetyReportingFieldDefinition[] {
  if (!Array.isArray(raw)) return [];
  const fields: SafetyReportingFieldDefinition[] = [];
  const seenKeys = new Set<string>();

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    if (typeof item.key !== 'string' || typeof item.label !== 'string') continue;
    const key = item.key.trim();
    const label = item.label.trim();
    const type = item.type as SafetyReportingFieldType;
    if (!key || !label || !VALID_REPORTING_FIELD_TYPES.has(type) || seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    const options = parseReportingFieldOptions(item.options);
    fields.push({
      key,
      label,
      type,
      ...(typeof item.required === 'boolean' ? { required: item.required } : {}),
      ...(typeof item.requiredWhenRegulatorNotifiable === 'boolean'
        ? { requiredWhenRegulatorNotifiable: item.requiredWhenRegulatorNotifiable }
        : {}),
      ...(typeof item.placeholder === 'string' ? { placeholder: item.placeholder } : {}),
      ...(typeof item.helpText === 'string' ? { helpText: item.helpText } : {}),
      ...(options ? { options } : {}),
    });
  }

  return fields;
}

export function parseHealthSafetyRules(
  payload: Record<string, unknown>,
): HealthSafetyRulePayload {
  const incidentReportingRaw = payload.incidentReporting;
  const injuryLogRaw = payload.injuryLog;
  const complianceRaw = payload.complianceRequirements;

  let incidentReporting: HealthSafetyRulePayload['incidentReporting'];
  if (incidentReportingRaw && typeof incidentReportingRaw === 'object') {
    const raw = incidentReportingRaw as Record<string, unknown>;
    incidentReporting = {
      regulatorReportRequiredSeverities: Array.isArray(raw.regulatorReportRequiredSeverities)
        ? raw.regulatorReportRequiredSeverities.filter((s): s is string => typeof s === 'string')
        : undefined,
      notifiableIncidentTypes: Array.isArray(raw.notifiableIncidentTypes)
        ? raw.notifiableIncidentTypes.filter((s): s is string => typeof s === 'string')
        : undefined,
      regulatorReportDeadlineHours:
        typeof raw.regulatorReportDeadlineHours === 'number'
          ? raw.regulatorReportDeadlineHours
          : undefined,
      regulatorName: typeof raw.regulatorName === 'string' ? raw.regulatorName : undefined,
      regulatorReferenceLabel:
        typeof raw.regulatorReferenceLabel === 'string'
          ? raw.regulatorReferenceLabel
          : undefined,
      reportingFields: parseReportingFields(raw.reportingFields),
    };
  }

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

export function buildIncidentReportingConfig(
  rules: HealthSafetyRulePayload,
  layers?: Array<{ layer: HealthSafetyRuleLayerSummary['layer']; applied: boolean; ruleId: string | null }>,
  asOf?: Date,
): IncidentReportingRuleConfig {
  const reporting = rules.incidentReporting;
  return {
    regulatorName: reporting?.regulatorName ?? null,
    regulatorReferenceLabel: reporting?.regulatorReferenceLabel ?? null,
    regulatorReportDeadlineHours:
      typeof reporting?.regulatorReportDeadlineHours === 'number' &&
      reporting.regulatorReportDeadlineHours > 0
        ? reporting.regulatorReportDeadlineHours
        : 24,
    regulatorReportRequiredSeverities: reporting?.regulatorReportRequiredSeverities ?? [],
    notifiableIncidentTypes: reporting?.notifiableIncidentTypes ?? [],
    reportingFields: reporting?.reportingFields ?? [],
    ...(asOf ? { resolvedAsOf: asOf.toISOString() } : {}),
    ...(layers
      ? {
          resolvedLayers: layers.map((entry) => ({
            layer: entry.layer,
            applied: entry.applied,
            ruleId: entry.ruleId,
          })),
        }
      : {}),
  };
}

export function parseStoredReportingConfig(
  snapshot: unknown,
): IncidentReportingRuleConfig | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return null;
  }
  const raw = snapshot as Record<string, unknown>;
  const reportingFields = parseReportingFields(raw.reportingFields);
  return {
    regulatorName: typeof raw.regulatorName === 'string' ? raw.regulatorName : null,
    regulatorReferenceLabel:
      typeof raw.regulatorReferenceLabel === 'string' ? raw.regulatorReferenceLabel : null,
    regulatorReportDeadlineHours:
      typeof raw.regulatorReportDeadlineHours === 'number' &&
      raw.regulatorReportDeadlineHours > 0
        ? raw.regulatorReportDeadlineHours
        : 24,
    regulatorReportRequiredSeverities: Array.isArray(raw.regulatorReportRequiredSeverities)
      ? raw.regulatorReportRequiredSeverities.filter((s): s is string => typeof s === 'string')
      : [],
    notifiableIncidentTypes: Array.isArray(raw.notifiableIncidentTypes)
      ? raw.notifiableIncidentTypes.filter((s): s is string => typeof s === 'string')
      : [],
    reportingFields,
    resolvedAsOf: typeof raw.resolvedAsOf === 'string' ? raw.resolvedAsOf : null,
    resolvedLayers: Array.isArray(raw.resolvedLayers)
      ? (raw.resolvedLayers as HealthSafetyRuleLayerSummary[])
      : undefined,
  };
}

export function validateAndSanitizeCountrySpecificData(input: {
  data: Record<string, unknown> | undefined | null;
  fields: SafetyReportingFieldDefinition[];
  regulatorRequired: boolean;
  enforceRequired: boolean;
  enforceRegulatorRequired: boolean;
}): Record<string, unknown> {
  const source = input.data ?? {};
  const result: Record<string, unknown> = {};
  const missingLabels: string[] = [];

  for (const field of input.fields) {
    const rawValue = source[field.key];
    const normalized = sanitizeReportingFieldValue(field, rawValue);
    if (normalized !== undefined) {
      result[field.key] = normalized;
    }

    const mustFill =
      (input.enforceRequired && Boolean(field.required)) ||
      (input.enforceRegulatorRequired &&
        input.regulatorRequired &&
        Boolean(field.requiredWhenRegulatorNotifiable));

    if (mustFill && isMissingFieldValue(field, normalized)) {
      missingLabels.push(field.label);
    }
  }

  if (missingLabels.length > 0) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `Missing required country reporting field(s): ${missingLabels.join(', ')}`,
    });
  }

  return result;
}

function isMissingFieldValue(
  field: SafetyReportingFieldDefinition,
  value: unknown,
): boolean {
  if (value === undefined || value === null) return true;
  if (field.type === 'boolean') return typeof value !== 'boolean';
  if (field.type === 'number') return typeof value !== 'number' || Number.isNaN(value);
  return typeof value === 'string' && value.trim().length === 0;
}

function sanitizeReportingFieldValue(
  field: SafetyReportingFieldDefinition,
  rawValue: unknown,
): unknown {
  if (rawValue === undefined || rawValue === null) {
    return undefined;
  }

  switch (field.type) {
    case 'boolean': {
      if (typeof rawValue === 'boolean') return rawValue;
      if (rawValue === 'true') return true;
      if (rawValue === 'false') return false;
      throw new BadRequestException(`Field "${field.label}" must be a boolean`);
    }
    case 'number': {
      if (rawValue === '') return undefined;
      const num = typeof rawValue === 'number' ? rawValue : Number(rawValue);
      if (!Number.isFinite(num)) {
        throw new BadRequestException(`Field "${field.label}" must be a valid number`);
      }
      return num;
    }
    case 'select': {
      const str = String(rawValue).trim();
      if (!str) return undefined;
      if (field.options?.length && !field.options.some((opt) => opt.value === str)) {
        throw new BadRequestException(`Invalid option "${str}" for field "${field.label}"`);
      }
      return str;
    }
    case 'date': {
      const str = String(rawValue).trim();
      if (!str) return undefined;
      if (Number.isNaN(Date.parse(str))) {
        throw new BadRequestException(`Field "${field.label}" must be a valid date`);
      }
      return str;
    }
    case 'text':
    case 'textarea':
    default: {
      const str = String(rawValue).trim();
      return str.length > 0 ? str : undefined;
    }
  }
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
