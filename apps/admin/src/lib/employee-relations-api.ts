import type {
  DisciplinaryActionType,
  HrCaseDetailRecord,
  HrCaseInvestigationRecordView,
  HrCaseOutcome,
  HrCasePriority,
  HrCaseSensitiveField,
  HrCaseStatus,
  HrCaseSummary,
  HrCaseSummaryRecord,
  HrCaseType,
  HrInvestigationRecordType,
  RevealedHrCaseField,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export const CASE_TYPE_LABELS: Record<HrCaseType, string> = {
  grievance: 'Grievance',
  complaint: 'Complaint',
  disciplinary: 'Disciplinary',
  investigation: 'Investigation',
};

export const CASE_STATUS_LABELS: Record<HrCaseStatus, string> = {
  open: 'Open',
  investigating: 'Investigating',
  resolved: 'Resolved',
  closed: 'Closed',
};

/** Allowed next statuses from each state (MODULES.md §28). */
export const HR_CASE_NEXT_STATUSES: Record<HrCaseStatus, HrCaseStatus[]> = {
  open: ['investigating'],
  investigating: ['resolved', 'open'],
  resolved: ['closed', 'investigating'],
  closed: [],
};

export const CASE_PRIORITY_LABELS: Record<HrCasePriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const CASE_OUTCOME_LABELS: Record<HrCaseOutcome, string> = {
  not_determined: 'Not determined',
  substantiated: 'Substantiated',
  partially_substantiated: 'Partially substantiated',
  unsubstantiated: 'Unsubstantiated',
  resolved_informally: 'Resolved informally',
};

export const DISCIPLINARY_ACTION_LABELS: Record<DisciplinaryActionType, string> = {
  verbal_warning: 'Verbal warning',
  written_warning: 'Written warning',
  final_warning: 'Final warning',
  suspension: 'Suspension',
  termination: 'Termination',
  other: 'Other',
};

export const INVESTIGATION_RECORD_LABELS: Record<HrInvestigationRecordType, string> = {
  interview: 'Interview',
  evidence_review: 'Evidence review',
  finding: 'Finding',
  legal_review: 'Legal review',
  other: 'Other',
};

export function getEmployeeRelationsSummary(companyId: string): Promise<HrCaseSummary> {
  return tenantApiRequest<HrCaseSummary>(
    `/companies/${companyId}/employee-relations/summary`,
  );
}

export function listHrCases(
  companyId: string,
  params?: {
    caseType?: HrCaseType;
    status?: HrCaseStatus;
    priority?: HrCasePriority;
    search?: string;
  },
): Promise<HrCaseSummaryRecord[]> {
  const search = new URLSearchParams();
  if (params?.caseType) search.set('caseType', params.caseType);
  if (params?.status) search.set('status', params.status);
  if (params?.priority) search.set('priority', params.priority);
  if (params?.search) search.set('search', params.search);
  const query = search.toString();
  return tenantApiRequest<HrCaseSummaryRecord[]>(
    `/companies/${companyId}/employee-relations/cases${query ? `?${query}` : ''}`,
  );
}

export function getHrCase(caseId: string): Promise<HrCaseDetailRecord> {
  return tenantApiRequest<HrCaseDetailRecord>(`/employee-relations/cases/${caseId}`);
}

export function createHrCase(
  companyId: string,
  input: {
    title: string;
    caseType: HrCaseType;
    priority?: HrCasePriority;
    subjectEmployeeId?: string;
    reportingEmployeeId?: string;
    assignedOfficerEmployeeId?: string;
    details?: string;
    isRestricted?: boolean;
  },
): Promise<HrCaseDetailRecord> {
  return tenantApiRequest<HrCaseDetailRecord>(
    `/companies/${companyId}/employee-relations/cases`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateHrCase(
  caseId: string,
  input: {
    title?: string;
    priority?: HrCasePriority;
    outcome?: HrCaseOutcome;
    resolutionNotes?: string;
    details?: string;
    isRestricted?: boolean;
  },
): Promise<HrCaseDetailRecord> {
  return tenantApiRequest<HrCaseDetailRecord>(`/employee-relations/cases/${caseId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function transitionHrCaseStatus(
  caseId: string,
  input: { status: HrCaseStatus; reason?: string },
): Promise<HrCaseDetailRecord> {
  return tenantApiRequest<HrCaseDetailRecord>(
    `/employee-relations/cases/${caseId}/transition`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function revealHrCaseField(
  caseId: string,
  input: {
    field: HrCaseSensitiveField;
    noteId?: string;
    actionId?: string;
    investigationRecordId?: string;
  },
): Promise<RevealedHrCaseField> {
  return tenantApiRequest<RevealedHrCaseField>(
    `/employee-relations/cases/${caseId}/reveal`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function addHrCaseNote(caseId: string, content: string): Promise<unknown> {
  return tenantApiRequest(`/employee-relations/cases/${caseId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export function addDisciplinaryAction(
  caseId: string,
  input: {
    actionType: DisciplinaryActionType;
    effectiveDate: string;
    letterReference?: string;
    details?: string;
  },
): Promise<unknown> {
  return tenantApiRequest(`/employee-relations/cases/${caseId}/disciplinary-actions`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function addInvestigationRecord(
  caseId: string,
  input: {
    recordType: HrInvestigationRecordType;
    title: string;
    content: string;
    recordedAt?: string;
  },
): Promise<HrCaseInvestigationRecordView> {
  return tenantApiRequest<HrCaseInvestigationRecordView>(
    `/employee-relations/cases/${caseId}/investigation-records`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}
