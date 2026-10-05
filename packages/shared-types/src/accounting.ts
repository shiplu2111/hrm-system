/** Accounting / GL integration (MODULES.md §36) */

export type GlAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type GlMappingPostingSide = 'debit' | 'credit';

export type PayrollJournalExportStatus = 'pending' | 'completed' | 'failed';

export type AccountingProvider = 'xero' | 'quickbooks' | 'tally';

export type AccountingConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'token_expired';

export type AccountingSyncJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

/** Built-in payroll journal mapping keys (not tied to a pay component). */
export type GlSystemMappingKey =
  | 'net_pay_salary_payable'
  | 'employer_superannuation_expense'
  | 'employer_superannuation_liability';

export interface GlAccountRecord {
  id: string;
  companyId: string;
  code: string;
  name: string;
  accountType: GlAccountType;
  isActive: boolean;
  /** Payroll, contractor and cost-centre mappings that post to this account (list endpoint only) */
  mappingCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GlPayrollMappingRecord {
  id: string;
  companyId: string;
  payComponentId: string | null;
  payComponentName?: string | null;
  payComponentType?: 'earning' | 'deduction' | null;
  systemKey: GlSystemMappingKey | null;
  postingSide: GlMappingPostingSide;
  glAccountId: string;
  glAccountCode?: string;
  glAccountName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollJournalLine {
  glAccountCode: string;
  glAccountName: string;
  description: string;
  debit: string;
  credit: string;
  mappingSource: string;
  category: 'earning' | 'deduction' | 'expense' | 'liability';
  /** Set on employee-cost lines (earnings, employer super expense) for staff in a cost centre. */
  costCentreCode?: string | null;
  costCentreName?: string | null;
}

export interface PayrollJournalUnmappedItem {
  source: string;
  category: 'earning' | 'deduction' | 'expense' | 'liability';
  amount: string;
  costCentreCode?: string | null;
}

export interface PayrollJournalPreview {
  payrollPeriodId: string;
  periodLabel: string;
  postingDate: string;
  runCount: number;
  referenceNumber: string;
  lines: PayrollJournalLine[];
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
  unmapped: PayrollJournalUnmappedItem[];
}

export interface PayrollJournalExportRecord {
  id: string;
  companyId: string;
  payrollPeriodId: string;
  referenceNumber: string;
  status: PayrollJournalExportStatus;
  provider: AccountingProvider | null;
  journal: PayrollJournalPreview;
  totalDebit: string;
  totalCredit: string;
  unmappedCount: number;
  errorMessage: string | null;
  externalReferenceId: string | null;
  csvContent: string | null;
  exportedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountingConnectionRecord {
  id: string;
  companyId: string;
  provider: AccountingProvider;
  status: AccountingConnectionStatus;
  externalOrgName: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: AccountingSyncJobStatus | null;
  lastSyncError: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
  oauthConfigured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountingSyncJobRecord {
  id: string;
  companyId: string;
  payrollPeriodId: string;
  provider: AccountingProvider;
  status: AccountingSyncJobStatus;
  attempts: number;
  errorMessage: string | null;
  externalJournalId: string | null;
  payrollJournalExportId: string | null;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const GL_SYSTEM_MAPPING_LABELS: Record<GlSystemMappingKey, string> = {
  net_pay_salary_payable: 'Net pay (salaries payable)',
  employer_superannuation_expense: 'Employer superannuation expense',
  employer_superannuation_liability: 'Employer superannuation liability',
};

/**
 * Cost-centre overrides apply to employee-cost lines only. `default` covers every cost line
 * in the cost centre; a component or employer super override wins over `default`.
 */
export const GL_COST_CENTRE_DEFAULT_SOURCE = 'default';
export const GL_COST_CENTRE_SUPER_SOURCE = 'system:employer_superannuation_expense';

export interface GlCostCentreOverrideRecord {
  id: string;
  /** `default`, `component:<payComponentId>` or `system:employer_superannuation_expense` */
  sourceKey: string;
  payComponentId: string | null;
  payComponentName: string | null;
  glAccountId: string;
  glAccountCode: string;
  glAccountName: string;
  updatedAt: string;
}

export interface GlCostCentreMappingGroup {
  costCentreId: string;
  costCentreCode: string;
  costCentreName: string;
  employeeCount: number;
  overrides: GlCostCentreOverrideRecord[];
}

export type GlExportKind = 'payroll' | 'contractor';

export type GlExportDestination = 'csv' | AccountingProvider;

/** Outcome shown to the Payroll Admin — derived from the export row and its sync job. */
export type GlExportOutcome = 'succeeded' | 'failed' | 'in_progress';

export interface GlExportStatusRecord {
  /** Stable row id: `payroll:<exportId>`, `contractor:<exportId>` or `sync:<syncJobId>` */
  id: string;
  kind: GlExportKind;
  destination: GlExportDestination;
  outcome: GlExportOutcome;
  exportId: string | null;
  syncJobId: string | null;
  referenceNumber: string;
  /** Payroll period dates or contractor batch reference */
  subjectLabel: string;
  payrollPeriodId: string | null;
  contractorPaymentBatchId: string | null;
  totalDebit: string | null;
  totalCredit: string | null;
  lineCount: number;
  unmappedCount: number;
  errorMessage: string | null;
  externalReferenceId: string | null;
  /** Null when the export was triggered automatically by payroll finalization */
  exportedByName: string | null;
  automatic: boolean;
  syncAttempts: number | null;
  startedAt: string;
  finishedAt: string | null;
  /** A later export exists for the same period/batch and destination */
  superseded: boolean;
  canRetrySync: boolean;
  canDownloadCsv: boolean;
}

export interface GlExportStatusSummary {
  total: number;
  succeeded: number;
  failed: number;
  inProgress: number;
  /** Latest export per period/batch and destination that failed */
  needsAttention: number;
  lastSucceededAt: string | null;
  /** Background queue (Redis) is running, so Xero syncs can be retried */
  queueAvailable: boolean;
}

export interface GlExportStatusList {
  items: GlExportStatusRecord[];
  summary: GlExportStatusSummary;
  page: number;
  pageSize: number;
  total: number;
}

export interface GlExportStatusDetail extends GlExportStatusRecord {
  postingDate: string | null;
  balanced: boolean;
  lines: PayrollJournalLine[];
  unmapped: PayrollJournalUnmappedItem[];
  csvContent: string | null;
}

/** Contractor payment GL keys — separate from payroll journal mappings. */
export type GlContractorSystemMappingKey =
  | 'contractor_expense'
  | 'contractor_payable';

export interface GlContractorMappingRecord {
  id: string;
  companyId: string;
  systemKey: GlContractorSystemMappingKey;
  postingSide: GlMappingPostingSide;
  glAccountId: string;
  glAccountCode?: string;
  glAccountName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractorJournalPreview {
  contractorPaymentBatchId: string;
  batchReference: string;
  periodLabel: string;
  postingDate: string;
  invoiceCount: number;
  referenceNumber: string;
  lines: PayrollJournalLine[];
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
  unmapped: PayrollJournalUnmappedItem[];
}

export interface ContractorJournalExportRecord {
  id: string;
  companyId: string;
  contractorPaymentBatchId: string;
  referenceNumber: string;
  status: PayrollJournalExportStatus;
  provider: AccountingProvider | null;
  journal: ContractorJournalPreview;
  totalDebit: string;
  totalCredit: string;
  unmappedCount: number;
  errorMessage: string | null;
  externalReferenceId: string | null;
  csvContent: string | null;
  exportedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const GL_CONTRACTOR_MAPPING_LABELS: Record<
  GlContractorSystemMappingKey,
  string
> = {
  contractor_expense: 'Contractor services expense',
  contractor_payable: 'Contractor payments payable',
};
