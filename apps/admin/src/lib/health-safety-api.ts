import type {
  HealthSafetyCountryRequirements,
  HealthSafetySummary,
  InjuryLogEntryRecord,
  SafetyComplianceRecordView,
  SafetyInspectionRecord,
  WorkplaceIncidentRecord,
  WorkplaceIncidentSeverity,
  WorkplaceIncidentStatus,
  WorkplaceIncidentType,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export const INCIDENT_TYPE_LABELS: Record<WorkplaceIncidentType, string> = {
  near_miss: 'Near miss',
  injury: 'Injury',
  first_aid: 'First aid',
  slip_trip: 'Slip / trip',
  equipment_damage: 'Equipment damage',
  environmental: 'Environmental',
  other: 'Other',
};

export const INCIDENT_SEVERITY_LABELS: Record<WorkplaceIncidentSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const INCIDENT_STATUS_LABELS: Record<WorkplaceIncidentStatus, string> = {
  reported: 'Reported',
  under_investigation: 'Under investigation',
  resolved: 'Resolved',
  closed: 'Closed',
};

export function getHealthSafetySummary(companyId: string): Promise<HealthSafetySummary> {
  return tenantApiRequest<HealthSafetySummary>(
    `/companies/${companyId}/health-safety/summary`,
  );
}

export function getHealthSafetyRequirements(
  companyId: string,
): Promise<HealthSafetyCountryRequirements> {
  return tenantApiRequest<HealthSafetyCountryRequirements>(
    `/companies/${companyId}/health-safety/requirements`,
  );
}

export function listIncidents(
  companyId: string,
  params?: { status?: string; severity?: string; search?: string },
): Promise<WorkplaceIncidentRecord[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.severity) query.set('severity', params.severity);
  if (params?.search) query.set('search', params.search);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return tenantApiRequest<WorkplaceIncidentRecord[]>(
    `/companies/${companyId}/health-safety/incidents${suffix}`,
  );
}

export function createIncident(
  companyId: string,
  input: {
    incidentType: WorkplaceIncidentType;
    severity: WorkplaceIncidentSeverity;
    location: string;
    occurredAt: string;
    description: string;
    reportedByEmployeeId?: string;
    parties?: Array<{ employeeId: string; partyRole: string }>;
  },
): Promise<WorkplaceIncidentRecord> {
  return tenantApiRequest<WorkplaceIncidentRecord>(
    `/companies/${companyId}/health-safety/incidents`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateIncident(
  incidentId: string,
  input: {
    status?: WorkplaceIncidentStatus;
    investigationNotes?: string;
    regulatorReportSubmitted?: boolean;
  },
): Promise<WorkplaceIncidentRecord> {
  return tenantApiRequest<WorkplaceIncidentRecord>(
    `/health-safety/incidents/${incidentId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function listInjuryLog(companyId: string): Promise<InjuryLogEntryRecord[]> {
  return tenantApiRequest<InjuryLogEntryRecord[]>(
    `/companies/${companyId}/health-safety/injuries`,
  );
}

export function createInjuryEntry(
  companyId: string,
  input: {
    employeeId: string;
    incidentId?: string;
    injuryType: string;
    bodyPart?: string;
    treatmentSummary?: string;
    medicalAttention?: string;
    daysLost?: number;
    recordedAt: string;
    notes?: string;
  },
): Promise<InjuryLogEntryRecord> {
  return tenantApiRequest<InjuryLogEntryRecord>(
    `/companies/${companyId}/health-safety/injuries`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function listCompliance(companyId: string): Promise<SafetyComplianceRecordView[]> {
  return tenantApiRequest<SafetyComplianceRecordView[]>(
    `/companies/${companyId}/health-safety/compliance`,
  );
}

export function updateCompliance(
  recordId: string,
  input: { status?: string; completedAt?: string },
): Promise<SafetyComplianceRecordView> {
  return tenantApiRequest<SafetyComplianceRecordView>(
    `/health-safety/compliance/${recordId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function listInspections(companyId: string): Promise<SafetyInspectionRecord[]> {
  return tenantApiRequest<SafetyInspectionRecord[]>(
    `/companies/${companyId}/health-safety/inspections`,
  );
}

export function createInspection(
  companyId: string,
  input: {
    title: string;
    inspectedAt: string;
    inspectorEmployeeId?: string;
    checklistItems: Array<{ area: string; item: string; passed: boolean }>;
  },
): Promise<SafetyInspectionRecord> {
  return tenantApiRequest<SafetyInspectionRecord>(
    `/companies/${companyId}/health-safety/inspections`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}
