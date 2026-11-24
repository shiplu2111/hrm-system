/**
 * Platform Backup, Restore & Data Compliance Types
 * Governed by SYSTEM_SETTINGS.md §3-5 and SECURITY.md §7, §9, §10
 */

export type BackupType = 'database' | 'file_storage' | 'full';
export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed';
export type RestoreTestStatus = 'not_tested' | 'pending' | 'passed' | 'failed';

export type RestoreScope = 'full' | 'tenant';
export type RestoreRequestStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'failed';

export type DataRequestType =
  | 'tenant_export'
  | 'employee_anonymization'
  | 'employee_deletion';

export type DataRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'processing'
  | 'completed'
  | 'failed';

export interface BackupRunItem {
  id: string;
  backupType: BackupType;
  storageDriver: string;
  status: BackupStatus;
  sizeBytes: string;
  sizeFormatted: string;
  location: string;
  checksum: string | null;
  includesFileStorage: boolean;
  retentionExpiry: string;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  restoreTestStatus: RestoreTestStatus;
  restoreTestAt: string | null;
  restoreTestDurationMs: number | null;
  restoreTestDetails: {
    checksumVerified?: boolean;
    schemaValidated?: boolean;
    tablesValidated?: number;
    sampleRowsChecked?: number;
    foreignKeysConsistent?: boolean;
    sandboxDurationMs?: number;
    notes?: string;
  } | null;
  createdAt: string;
}

export interface TriggerBackupInput {
  backupType?: BackupType;
  includesFileStorage?: boolean;
  storageDriver?: string;
}

export interface RestoreRequestItem {
  id: string;
  backupRunId: string;
  backupLocation?: string;
  backupType?: BackupType;
  scope: RestoreScope;
  tenantId: string | null;
  tenantName?: string | null;
  tenantSubdomain?: string | null;
  status: RestoreRequestStatus;
  requestedByUserId: string;
  requestedByName: string | null;
  reason: string;
  approvedByUserId: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectedByUserId: string | null;
  rejectedByName: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  jobId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  logs: {
    scope?: string;
    targetTenantId?: string | null;
    targetTenantName?: string | null;
    tablesRestored?: string[];
    recordsRestored?: number;
    isolationGuaranteed?: boolean;
    foreignTenantsModified?: number;
    completedAt?: string;
    [key: string]: any;
  } | null;
  createdAt: string;
}

export interface CreateRestoreRequestInput {
  backupRunId: string;
  scope: RestoreScope;
  tenantId?: string;
  reason: string;
}

export interface RejectRestoreRequestInput {
  reason: string;
}

export interface AnonymizationSummary {
  employeeId?: string;
  employeeNumber?: string;
  scrubbedFields?: string[];
  statutoryPayrollRecordsPreserved?: number;
  payslipsRetained?: number;
  taxSummariesRetained?: number;
  auditLogsRetained?: boolean;
  userAccountDisabled?: boolean;
  anonymizedAt?: string;
}

export interface LegalRetentionException {
  category: 'tax_accounting' | 'statutory_payroll' | 'audit_log' | 'dispute_legal_defense' | 'pension_benefits';
  title: string;
  statutoryBasis: string;
  retentionPeriodYears: number;
  retainedRecordTypes: string[];
  retainedRecordCount: number;
  justification: string;
}

export interface CompletionRecord {
  completedAt: string;
  completedByUserId?: string | null;
  completedByName?: string | null;
  summary: string;
  scrubbedFields?: string[];
  legalExceptionsApplied?: LegalRetentionException[];
  recordsPreservedCount?: number;
  archiveSizeBytes?: string | null;
  archiveSizeFormatted?: string | null;
  archiveUrl?: string | null;
  jobId?: string | null;
  complianceNotes?: string;
}

export interface RequestCountdown {
  days: number;
  hours: number;
  minutes: number;
  isOverdue: boolean;
  formatted: string;
  severity: 'nominal' | 'warning' | 'critical' | 'overdue';
}

export interface DataRequestItem {
  id: string;
  tenantId: string;
  tenantName?: string | null;
  tenantSubdomain?: string | null;
  type: DataRequestType;
  status: DataRequestStatus;
  targetEmployeeId: string | null;
  targetEmployeeName?: string | null;
  requestedByUserId: string;
  requestedByName: string | null;
  reason: string;
  deadline: string | null;
  countdown: RequestCountdown | null;
  approvedByUserId: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectedByUserId: string | null;
  rejectedByName: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  legalRetentionExceptions: LegalRetentionException[] | null;
  completionRecord: CompletionRecord | null;
  archiveUrl: string | null;
  archiveSizeBytes: string | null;
  archiveSizeFormatted?: string | null;
  archiveExpiresAt: string | null;
  anonymizedSummary: AnonymizationSummary | null;
  jobId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  logs: any | null;
  createdAt: string;
}

export interface CreateTenantExportInput {
  tenantId: string;
  reason: string;
  deadlineDays?: number;
}

export interface CreateEmployeeAnonymizationInput {
  tenantId: string;
  targetEmployeeId: string;
  type?: 'employee_anonymization' | 'employee_deletion';
  reason: string;
  deadlineDays?: number;
  retainTaxRecords?: boolean;
  retainPayrollHistory?: boolean;
  retainAuditLogs?: boolean;
  retainPensionRecords?: boolean;
}

export interface ApproveDataRequestInput {
  notes?: string;
}

export interface RejectDataRequestInput {
  reason: string;
}

export interface BackupsComplianceSummary {
  totalBackups: number;
  completedBackups: number;
  lastBackupAt: string | null;
  lastBackupSizeFormatted: string | null;
  lastBackupStatus: BackupStatus | null;
  lastBackupRunId: string | null;
  fileStorageIncludedCount: number;
  restoreTestsCount: number;
  restoreTestsPassed: number;
  lastSuccessfulRestoreTestAt: string | null;
  lastSuccessfulRestoreTestRunId: string | null;
  lastSuccessfulRestoreTestDurationMs: number | null;
  lastRestoreTestStatus: RestoreTestStatus | null;
  pendingRestoreApprovals: number;
  activeDataRequests: number;
  completedExports: number;
  anonymizedEmployees: number;

  // SLA Thresholds & Warning Banner
  backupThresholdHours: number;
  restoreTestThresholdDays: number;
  isBackupOverdue: boolean;
  isRestoreTestOverdue: boolean;
  hasThresholdWarning: boolean;
  backupWarning: string | null;
  restoreTestWarning: string | null;
}
