import type {
  ReportCatalogView,
  ReportDefinition,
  ReportExportFormat,
  ReportResult,
} from '@hrm/shared-types';
import { getTenantAccessToken } from './tenant-api-client';
import { tenantApiRequest } from './tenant-api-client';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export function getReportCatalog(companyId: string): Promise<ReportCatalogView> {
  return tenantApiRequest<ReportCatalogView>(
    `/companies/${companyId}/reports/catalog`,
  );
}

export function runReport(
  companyId: string,
  reportId: string,
  params?: { from?: string; to?: string },
): Promise<ReportResult> {
  const search = new URLSearchParams();
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);
  const qs = search.toString();
  return tenantApiRequest<ReportResult>(
    `/companies/${companyId}/reports/${encodeURIComponent(reportId)}${qs ? `?${qs}` : ''}`,
  );
}

export async function downloadReportExport(
  companyId: string,
  reportId: string,
  format: ReportExportFormat,
  params?: { from?: string; to?: string },
): Promise<void> {
  const search = new URLSearchParams({ format });
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);

  const token = getTenantAccessToken();
  const response = await fetch(
    `${API_BASE}/companies/${companyId}/reports/${encodeURIComponent(reportId)}/export?${search}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );

  if (!response.ok) {
    throw new Error(`Export failed (${response.status})`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `${reportId}.${format === 'xlsx' ? 'xlsx' : 'csv'}`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function categoryLabel(category: ReportDefinition['category']): string {
  switch (category) {
    case 'payroll':
      return 'Payroll';
    case 'attendance':
      return 'Attendance';
    case 'hr':
      return 'HR & People';
    default:
      return category;
  }
}

export function defaultReportPeriod(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}
