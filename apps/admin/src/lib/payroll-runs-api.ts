import type {
  BulkPayrollRunTransitionRequest,
  CalculatePayrollRunsRequest,
  CreatePayrollPeriodRequest,
  GeneratePayrollRunsRequest,
  GeneratePayrollRunsResult,
  PayrollBulkResult,
  PayrollPeriodRecord,
  PayrollRunBreakdown,
  PayrollRunRecord,
  PayslipListItem,
  PayslipRecord,
  UpdatePayrollPeriodRequest,
} from '@hrm/shared-types';
import { fetchTenantFile, type DownloadedFile } from './download';
import { tenantApiRequest } from './tenant-api-client';

const periodsPath = (companyId: string) => `/companies/${companyId}/payroll-periods`;
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export function listPayrollPeriods(companyId: string): Promise<PayrollPeriodRecord[]> {
  return tenantApiRequest<PayrollPeriodRecord[]>(periodsPath(companyId));
}

export function getPayrollPeriod(companyId: string, periodId: string): Promise<PayrollPeriodRecord> {
  return tenantApiRequest<PayrollPeriodRecord>(`${periodsPath(companyId)}/${periodId}`);
}

export function createPayrollPeriod(
  companyId: string,
  input: CreatePayrollPeriodRequest,
): Promise<PayrollPeriodRecord> {
  return tenantApiRequest<PayrollPeriodRecord>(periodsPath(companyId), json('POST', input));
}

export function updatePayrollPeriod(
  companyId: string,
  periodId: string,
  input: UpdatePayrollPeriodRequest,
): Promise<PayrollPeriodRecord> {
  return tenantApiRequest<PayrollPeriodRecord>(`${periodsPath(companyId)}/${periodId}`, json('PATCH', input));
}

export function listPayrollRuns(companyId: string, periodId: string): Promise<PayrollRunRecord[]> {
  return tenantApiRequest<PayrollRunRecord[]>(`${periodsPath(companyId)}/${periodId}/runs`);
}

export function generatePayrollRuns(
  companyId: string,
  periodId: string,
  input: GeneratePayrollRunsRequest = {},
): Promise<GeneratePayrollRunsResult> {
  return tenantApiRequest<GeneratePayrollRunsResult>(
    `${periodsPath(companyId)}/${periodId}/runs/generate`,
    json('POST', input),
  );
}

export function calculatePayrollRuns(
  companyId: string,
  periodId: string,
  input: CalculatePayrollRunsRequest = {},
): Promise<PayrollBulkResult> {
  return tenantApiRequest<PayrollBulkResult>(`${periodsPath(companyId)}/${periodId}/runs/calculate`, json('POST', input));
}

export function transitionPayrollRuns(
  companyId: string,
  periodId: string,
  input: BulkPayrollRunTransitionRequest,
): Promise<PayrollBulkResult> {
  return tenantApiRequest<PayrollBulkResult>(`${periodsPath(companyId)}/${periodId}/runs/transition`, json('POST', input));
}

export function getPayrollRunBreakdown(companyId: string, runId: string): Promise<PayrollRunBreakdown> {
  return tenantApiRequest<PayrollRunBreakdown>(`/companies/${companyId}/payroll-runs/${runId}/breakdown`);
}

export function getPayslipForRun(companyId: string, runId: string): Promise<PayslipRecord> {
  return tenantApiRequest<PayslipRecord>(`/companies/${companyId}/payroll-runs/${runId}/payslip`);
}

export function listPayslips(
  companyId: string,
  filters: { payrollPeriodId?: string; employeeId?: string } = {},
): Promise<PayslipListItem[]> {
  const params = new URLSearchParams();
  if (filters.payrollPeriodId) params.set('payrollPeriodId', filters.payrollPeriodId);
  if (filters.employeeId) params.set('employeeId', filters.employeeId);
  const qs = params.toString();
  return tenantApiRequest<PayslipListItem[]>(`/companies/${companyId}/payslips${qs ? `?${qs}` : ''}`);
}

export function generatePayslip(companyId: string, runId: string): Promise<PayslipRecord> {
  return tenantApiRequest<PayslipRecord>(`/companies/${companyId}/payroll-runs/${runId}/payslip`, { method: 'POST' });
}

export function fetchPayslipPdf(employeeId: string, payslipId: string): Promise<DownloadedFile> {
  return fetchTenantFile(`/employees/${employeeId}/payslips/${payslipId}/download`, {
    filename: 'payslip.pdf',
    errorMessage: (status) => `Could not load the payslip (${status})`,
  });
}

export async function openPayslipPdf(employeeId: string, payslipId: string): Promise<void> {
  const preview = window.open('', '_blank');
  try {
    const { blob } = await fetchPayslipPdf(employeeId, payslipId);
    const url = URL.createObjectURL(blob);
    if (preview) preview.location.href = url;
    else window.location.assign(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    preview?.close();
    throw err;
  }
}
