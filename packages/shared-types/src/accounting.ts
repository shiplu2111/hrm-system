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
  createdAt: string;
  updatedAt: string;
}

export interface GlPayrollMappingRecord {
  id: string;
  companyId: string;
  payComponentId: string | null;
  payComponentName?: string | null;
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
}

export interface PayrollJournalUnmappedItem {
  source: string;
  category: 'earning' | 'deduction' | 'expense' | 'liability';
  amount: string;
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
