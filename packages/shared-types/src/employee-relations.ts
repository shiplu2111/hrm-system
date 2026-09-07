/** Employee Relations / Case Management (MODULES.md §28) */

export type HrCaseType = 'grievance' | 'complaint' | 'disciplinary' | 'investigation';

/** Open → Investigating → Resolved → Closed */
export type HrCaseStatus = 'open' | 'investigating' | 'resolved' | 'closed';

export type HrCasePriority = 'low' | 'medium' | 'high' | 'critical';

export type HrCaseOutcome =
  | 'not_determined'
  | 'substantiated'
  | 'partially_substantiated'
  | 'unsubstantiated'
  | 'resolved_informally';

export type HrCasePartyRole =
  | 'reporting_employee'
  | 'subject_employee'
  | 'witness'
  | 'investigator'
  | 'other';

export type DisciplinaryActionType =
  | 'verbal_warning'
  | 'written_warning'
  | 'final_warning'
  | 'suspension'
  | 'termination'
  | 'other';

export type HrInvestigationRecordType =
  | 'interview'
  | 'evidence_review'
  | 'finding'
  | 'legal_review'
  | 'other';

export type HrCaseSensitiveField =
  | 'details'
  | 'resolutionNotes'
  | 'noteContent'
  | 'actionDetails'
  | 'investigationContent';

/** List/summary view — no sensitive narrative fields (SECURITY.md §2). */
export interface HrCaseSummaryRecord {
  id: string;
  companyId: string;
  caseNumber: string;
  title: string;
  caseType: HrCaseType;
  status: HrCaseStatus;
  priority: HrCasePriority;
  outcome: HrCaseOutcome;
  assignedOfficerName: string | null;
  isRestricted: boolean;
  openedAt: string;
  closedAt: string | null;
  updatedAt: string;
}

export interface HrCasePartyRecord {
  id: string;
  partyRole: HrCasePartyRole;
  employeeId: string | null;
  employeeName: string | null;
  departmentName: string | null;
  anonymizedLabel: string | null;
  isAnonymized: boolean;
}

export interface HrCaseNoteRecord {
  id: string;
  caseId: string;
  contentRestricted: true;
  createdByUserId: string;
  createdAt: string;
}

export interface HrCaseDisciplinaryActionRecord {
  id: string;
  caseId: string;
  actionType: DisciplinaryActionType;
  effectiveDate: string;
  letterReference: string | null;
  detailsRestricted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HrCaseInvestigationRecordView {
  id: string;
  caseId: string;
  recordType: HrInvestigationRecordType;
  title: string;
  contentRestricted: true;
  recordedAt: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

/** Detail view — sensitive fields masked until explicit reveal. */
export interface HrCaseDetailRecord extends HrCaseSummaryRecord {
  subjectEmployeeId: string | null;
  subjectEmployeeName: string | null;
  reportingEmployeeId: string | null;
  reportingEmployeeName: string | null;
  hasDetails: boolean;
  hasResolutionNotes: boolean;
  parties: HrCasePartyRecord[];
  notes: HrCaseNoteRecord[];
  disciplinaryActions: HrCaseDisciplinaryActionRecord[];
  investigationRecords: HrCaseInvestigationRecordView[];
}

export interface HrCaseSummary {
  openCaseCount: number;
  investigatingCount: number;
  resolvedThisQuarterCount: number;
}

export interface RevealedHrCaseField {
  field: HrCaseSensitiveField;
  value: string;
  noteId?: string;
  actionId?: string;
  investigationRecordId?: string;
}
