import type {
  AccountingConnectionRecord,
  AccountingSyncJobRecord,
  ContractorJournalExportRecord,
  GlAccountRecord,
  GlAccountType,
  GlContractorMappingRecord,
  GlContractorSystemMappingKey,
  GlCostCentreMappingGroup,
  GlExportKind,
  GlExportStatusDetail,
  GlExportStatusList,
  GlExportStatusRecord,
  GlPayrollMappingRecord,
  GlSystemMappingKey,
  PayrollJournalExportRecord,
  PayrollJournalPreview,
  PayrollPeriodRecord,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function listGlAccounts(
  companyId: string,
  options: { includeInactive?: boolean } = {},
): Promise<GlAccountRecord[]> {
  const qs = options.includeInactive ? '?includeInactive=true' : '';
  return tenantApiRequest<GlAccountRecord[]>(
    `/companies/${companyId}/gl-accounts${qs}`,
  );
}

export interface GlAccountInput {
  code: string;
  name: string;
  accountType: GlAccountType;
}

export function createGlAccount(
  companyId: string,
  input: GlAccountInput,
): Promise<GlAccountRecord> {
  return tenantApiRequest<GlAccountRecord>(`/companies/${companyId}/gl-accounts`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateGlAccount(
  accountId: string,
  input: Partial<GlAccountInput> & { isActive?: boolean },
): Promise<GlAccountRecord> {
  return tenantApiRequest<GlAccountRecord>(`/gl-accounts/${accountId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listCostCentreMappings(
  companyId: string,
): Promise<GlCostCentreMappingGroup[]> {
  return tenantApiRequest<GlCostCentreMappingGroup[]>(
    `/companies/${companyId}/gl-cost-centre-mappings`,
  );
}

export function replaceCostCentreMappings(
  companyId: string,
  costCentreId: string,
  overrides: Array<{ sourceKey: string; glAccountId: string }>,
): Promise<GlCostCentreMappingGroup> {
  return tenantApiRequest<GlCostCentreMappingGroup>(
    `/companies/${companyId}/gl-cost-centre-mappings/${costCentreId}`,
    { method: 'PUT', body: JSON.stringify({ overrides }) },
  );
}

export type GlExportOutcomeFilter = 'succeeded' | 'failed' | 'in_progress' | 'needs_attention';

export function listGlExports(
  companyId: string,
  query: { outcome?: GlExportOutcomeFilter; kind?: GlExportKind; page?: number; pageSize?: number } = {},
): Promise<GlExportStatusList> {
  const params = new URLSearchParams();
  if (query.outcome) params.set('outcome', query.outcome);
  if (query.kind) params.set('kind', query.kind);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  const qs = params.toString();
  return tenantApiRequest<GlExportStatusList>(
    `/companies/${companyId}/gl-exports${qs ? `?${qs}` : ''}`,
  );
}

export function getGlExport(
  companyId: string,
  kind: GlExportKind,
  exportId: string,
): Promise<GlExportStatusDetail> {
  return tenantApiRequest<GlExportStatusDetail>(
    `/companies/${companyId}/gl-exports/${kind}/${exportId}`,
  );
}

export function listGlPayrollMappings(
  companyId: string,
): Promise<GlPayrollMappingRecord[]> {
  return tenantApiRequest<GlPayrollMappingRecord[]>(
    `/companies/${companyId}/gl-payroll-mappings`,
  );
}

export function saveGlPayrollMappings(
  companyId: string,
  mappings: Array<{
    payComponentId?: string;
    systemKey?: GlSystemMappingKey;
    postingSide: 'debit' | 'credit';
    glAccountId: string;
  }>,
  remove: Array<{ payComponentId?: string; systemKey?: GlSystemMappingKey }> = [],
): Promise<GlPayrollMappingRecord[]> {
  return tenantApiRequest<GlPayrollMappingRecord[]>(
    `/companies/${companyId}/gl-payroll-mappings`,
    { method: 'POST', body: JSON.stringify({ mappings, remove }) },
  );
}

export function listGlContractorMappings(
  companyId: string,
): Promise<GlContractorMappingRecord[]> {
  return tenantApiRequest<GlContractorMappingRecord[]>(
    `/companies/${companyId}/gl-contractor-mappings`,
  );
}

export function saveGlContractorMappings(
  companyId: string,
  mappings: Array<{
    systemKey: GlContractorSystemMappingKey;
    postingSide: 'debit' | 'credit';
    glAccountId: string;
  }>,
): Promise<GlContractorMappingRecord[]> {
  return tenantApiRequest<GlContractorMappingRecord[]>(
    `/companies/${companyId}/gl-contractor-mappings`,
    { method: 'POST', body: JSON.stringify({ mappings }) },
  );
}

export function listContractorJournalExports(
  companyId: string,
): Promise<ContractorJournalExportRecord[]> {
  return tenantApiRequest<ContractorJournalExportRecord[]>(
    `/companies/${companyId}/contractor-journal-exports`,
  );
}

export function listPayrollPeriods(
  companyId: string,
): Promise<PayrollPeriodRecord[]> {
  return tenantApiRequest<PayrollPeriodRecord[]>(
    `/companies/${companyId}/payroll-periods`,
  );
}

export function previewPayrollJournal(
  companyId: string,
  periodId: string,
): Promise<PayrollJournalPreview> {
  return tenantApiRequest<PayrollJournalPreview>(
    `/companies/${companyId}/payroll-periods/${periodId}/journal-preview`,
  );
}

export function exportPayrollJournal(
  companyId: string,
  periodId: string,
): Promise<PayrollJournalExportRecord> {
  return tenantApiRequest<PayrollJournalExportRecord>(
    `/companies/${companyId}/payroll-periods/${periodId}/journal-export`,
    { method: 'POST' },
  );
}

export function listJournalExports(
  companyId: string,
  payrollPeriodId?: string,
): Promise<PayrollJournalExportRecord[]> {
  const qs = payrollPeriodId
    ? `?payrollPeriodId=${encodeURIComponent(payrollPeriodId)}`
    : '';
  return tenantApiRequest<PayrollJournalExportRecord[]>(
    `/companies/${companyId}/journal-exports${qs}`,
  );
}

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function listAccountingConnections(
  companyId: string,
): Promise<AccountingConnectionRecord[]> {
  return tenantApiRequest<AccountingConnectionRecord[]>(
    `/companies/${companyId}/accounting-connections`,
  );
}

export function beginXeroConnect(
  companyId: string,
): Promise<{ authorizeUrl: string }> {
  return tenantApiRequest<{ authorizeUrl: string }>(
    `/companies/${companyId}/accounting/xero/connect`,
    { method: 'POST' },
  );
}

export function disconnectXero(
  companyId: string,
): Promise<AccountingConnectionRecord> {
  return tenantApiRequest<AccountingConnectionRecord>(
    `/companies/${companyId}/accounting/xero/disconnect`,
    { method: 'DELETE' },
  );
}

export function listAccountingSyncJobs(
  companyId: string,
  payrollPeriodId?: string,
): Promise<AccountingSyncJobRecord[]> {
  const qs = payrollPeriodId
    ? `?payrollPeriodId=${encodeURIComponent(payrollPeriodId)}`
    : '';
  return tenantApiRequest<AccountingSyncJobRecord[]>(
    `/companies/${companyId}/accounting-sync-jobs${qs}`,
  );
}

export function retryAccountingSyncJob(
  companyId: string,
  jobId: string,
): Promise<{ retried: boolean; export: GlExportStatusRecord | null }> {
  return tenantApiRequest<{ retried: boolean; export: GlExportStatusRecord | null }>(
    `/companies/${companyId}/accounting-sync-jobs/${jobId}/retry`,
    { method: 'POST' },
  );
}
