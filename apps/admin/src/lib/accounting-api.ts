import type {
  AccountingConnectionRecord,
  AccountingSyncJobRecord,
  GlAccountRecord,
  GlPayrollMappingRecord,
  GlSystemMappingKey,
  PayrollJournalExportRecord,
  PayrollJournalPreview,
  PayrollPeriodRecord,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function listGlAccounts(companyId: string): Promise<GlAccountRecord[]> {
  return tenantApiRequest<GlAccountRecord[]>(
    `/companies/${companyId}/gl-accounts`,
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
): Promise<GlPayrollMappingRecord[]> {
  return tenantApiRequest<GlPayrollMappingRecord[]>(
    `/companies/${companyId}/gl-payroll-mappings`,
    { method: 'POST', body: JSON.stringify({ mappings }) },
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
): Promise<{ retried: boolean }> {
  return tenantApiRequest<{ retried: boolean }>(
    `/companies/${companyId}/accounting-sync-jobs/${jobId}/retry`,
    { method: 'POST' },
  );
}
