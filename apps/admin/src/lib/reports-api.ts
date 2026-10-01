import type {
  ReportCatalogView,
  ReportExportFormat,
  ReportPeriod,
  ReportResult,
} from '@hrm/shared-types';
import { fetchTenantFile, type DownloadedFile } from './download';
import { tenantApiRequest } from './tenant-api-client';

const reportPath = (companyId: string, reportId: string) =>
  `/companies/${companyId}/reports/${encodeURIComponent(reportId)}`;

function periodQuery(period: Partial<ReportPeriod> | undefined, extra?: Record<string, string>): string {
  const search = new URLSearchParams(extra);
  if (period?.from) search.set('from', period.from);
  if (period?.to) search.set('to', period.to);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function getReportCatalog(companyId: string): Promise<ReportCatalogView> {
  return tenantApiRequest<ReportCatalogView>(`/companies/${companyId}/reports/catalog`);
}

export function runReport(
  companyId: string,
  reportId: string,
  period?: Partial<ReportPeriod>,
  signal?: AbortSignal,
): Promise<ReportResult> {
  return tenantApiRequest<ReportResult>(`${reportPath(companyId, reportId)}${periodQuery(period)}`, { signal });
}

export function fetchReportExport(
  companyId: string,
  reportId: string,
  format: ReportExportFormat,
  period?: Partial<ReportPeriod>,
): Promise<DownloadedFile> {
  return fetchTenantFile(`${reportPath(companyId, reportId)}/export${periodQuery(period, { format })}`, {
    filename: `${reportId}.${format}`,
    errorMessage: (status) => `Export failed (${status})`,
  });
}
