/** Health & Safety (MODULES.md §30) */

export type WorkplaceIncidentType =
  | 'near_miss'
  | 'injury'
  | 'first_aid'
  | 'slip_trip'
  | 'equipment_damage'
  | 'environmental'
  | 'other';

export type WorkplaceIncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export type WorkplaceIncidentStatus =
  | 'reported'
  | 'under_investigation'
  | 'resolved'
  | 'closed';

export type IncidentPartyRole = 'involved' | 'witness' | 'injured';

export type InjuryMedicalAttention = 'none' | 'first_aid' | 'clinic' | 'hospital';

export type SafetyComplianceRequirementType =
  | 'training'
  | 'inspection'
  | 'certification'
  | 'reporting';

export type SafetyComplianceStatus = 'pending' | 'compliant' | 'overdue' | 'waived';

export type SafetyInspectionStatus = 'draft' | 'completed';

export type SafetyReportingFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select';

export interface SafetyReportingFieldOption {
  value: string;
  label: string;
}

export interface SafetyReportingFieldDefinition {
  key: string;
  label: string;
  type: SafetyReportingFieldType;
  required?: boolean;
  requiredWhenRegulatorNotifiable?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: SafetyReportingFieldOption[];
}

export interface HealthSafetyRuleLayerSummary {
  layer: 'global' | 'country' | 'state' | 'company' | 'employee_contract';
  applied: boolean;
  ruleId: string | null;
}

export interface IncidentReportingRuleConfig {
  regulatorName: string | null;
  regulatorReferenceLabel: string | null;
  regulatorReportDeadlineHours: number;
  regulatorReportRequiredSeverities: string[];
  notifiableIncidentTypes: string[];
  reportingFields: SafetyReportingFieldDefinition[];
  resolvedAsOf?: string | null;
  resolvedLayers?: HealthSafetyRuleLayerSummary[];
}

export interface WorkplaceIncidentPartyRecord {
  employeeId: string;
  employeeName: string;
  partyRole: IncidentPartyRole;
}

export interface WorkplaceIncidentRecord {
  id: string;
  companyId: string;
  incidentNumber: string;
  incidentType: WorkplaceIncidentType;
  severity: WorkplaceIncidentSeverity;
  status: WorkplaceIncidentStatus;
  location: string;
  occurredAt: string;
  description: string;
  reportedByEmployeeId: string;
  reportedByEmployeeName: string;
  gpsLat: number | null;
  gpsLng: number | null;
  regulatorReportRequired: boolean;
  regulatorReportDueAt: string | null;
  regulatorReportSubmittedAt: string | null;
  regulatorReportSubmittedByName: string | null;
  regulatorReferenceNumber: string | null;
  regulatorName: string | null;
  countrySpecificData: Record<string, unknown>;
  resolvedReportingConfig: IncidentReportingRuleConfig | null;
  investigationNotes: string | null;
  resolvedAt: string | null;
  parties: WorkplaceIncidentPartyRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface InjuryLogEntryRecord {
  id: string;
  companyId: string;
  incidentId: string | null;
  incidentNumber: string | null;
  employeeId: string;
  employeeName: string;
  injuryType: string;
  bodyPart: string | null;
  treatmentSummary: string | null;
  medicalAttention: InjuryMedicalAttention;
  daysLost: number;
  recordedAt: string;
  notes: string | null;
  createdAt: string;
}

export interface SafetyComplianceRecordView {
  id: string;
  companyId: string;
  requirementKey: string;
  title: string;
  description: string | null;
  requirementType: SafetyComplianceRequirementType;
  status: SafetyComplianceStatus;
  dueDate: string | null;
  completedAt: string | null;
  employeeId: string | null;
  employeeName: string | null;
  scopeKey: string;
  sourceRuleType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyInspectionChecklistItem {
  area: string;
  item: string;
  passed: boolean;
  evidence?: string | null;
}

export interface SafetyInspectionRecord {
  id: string;
  companyId: string;
  title: string;
  inspectedAt: string;
  status: SafetyInspectionStatus;
  inspectorEmployeeId: string | null;
  inspectorEmployeeName: string | null;
  scorePercent: number | null;
  checklistItems: SafetyInspectionChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface HealthSafetySummary {
  openIncidentCount: number;
  regulatorReportsDueCount: number;
  injuryLogCountThisYear: number;
  complianceOverdueCount: number;
  complianceCompliantPercent: number;
  daysIncidentFree: number;
}

export interface HealthSafetyCountryRequirements {
  regulatorName: string | null;
  complianceRequirements: Array<{
    key: string;
    title: string;
    type: SafetyComplianceRequirementType;
    renewalMonths?: number;
    frequencyDays?: number;
  }>;
  injuryLogRequireBodyPart: boolean;
  incidentReporting: IncidentReportingRuleConfig;
}
