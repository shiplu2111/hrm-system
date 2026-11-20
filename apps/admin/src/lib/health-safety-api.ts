import type {
  HealthSafetyCountryRequirements,
  HealthSafetySummary,
  IncidentPartyRole,
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

export const PARTY_ROLE_LABELS: Record<IncidentPartyRole, string> = {
  involved: 'Involved',
  witness: 'Witness',
  injured: 'Injured',
};

export function getHealthSafetySummary(companyId: string): Promise<HealthSafetySummary> {
  return tenantApiRequest<HealthSafetySummary>(
    `/companies/${companyId}/health-safety/summary`,
  );
}

export function getHealthSafetyRequirements(
  companyId: string,
  options?: { employeeId?: string; asOf?: string },
): Promise<HealthSafetyCountryRequirements> {
  const query = new URLSearchParams();
  if (options?.employeeId) query.set('employeeId', options.employeeId);
  if (options?.asOf) query.set('asOf', options.asOf);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return tenantApiRequest<HealthSafetyCountryRequirements>(
    `/companies/${companyId}/health-safety/requirements${suffix}`,
  );
}

export function listIncidents(
  companyId: string,
  params?: {
    status?: string;
    severity?: string;
    incidentType?: string;
    regulatorRequiredOnly?: boolean;
    search?: string;
    limit?: number;
  },
): Promise<WorkplaceIncidentRecord[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.severity) query.set('severity', params.severity);
  if (params?.incidentType) query.set('incidentType', params.incidentType);
  if (params?.regulatorRequiredOnly) query.set('regulatorRequiredOnly', 'true');
  if (params?.search) query.set('search', params.search);
  if (params?.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return tenantApiRequest<WorkplaceIncidentRecord[]>(
    `/companies/${companyId}/health-safety/incidents${suffix}`,
  );
}

export function getIncident(incidentId: string): Promise<WorkplaceIncidentRecord> {
  return tenantApiRequest<WorkplaceIncidentRecord>(
    `/health-safety/incidents/${incidentId}`,
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
    gpsLat?: number;
    gpsLng?: number;
    parties?: Array<{ employeeId: string; partyRole: IncidentPartyRole }>;
    countrySpecificData?: Record<string, unknown>;
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
    regulatorReferenceNumber?: string;
    countrySpecificData?: Record<string, unknown>;
    parties?: Array<{ employeeId: string; partyRole: IncidentPartyRole }>;
  },
): Promise<WorkplaceIncidentRecord> {
  return tenantApiRequest<WorkplaceIncidentRecord>(
    `/health-safety/incidents/${incidentId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function listInjuryLog(
  companyId: string,
  params?: { employeeId?: string; incidentId?: string; limit?: number },
): Promise<InjuryLogEntryRecord[]> {
  const query = new URLSearchParams();
  if (params?.employeeId) query.set('employeeId', params.employeeId);
  if (params?.incidentId) query.set('incidentId', params.incidentId);
  if (params?.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return tenantApiRequest<InjuryLogEntryRecord[]>(
    `/companies/${companyId}/health-safety/injuries${suffix}`,
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
