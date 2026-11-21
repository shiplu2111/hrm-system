import type { PlatformRevenueReportView } from '@hrm/shared-types';
import { apiRequest, getPlatformAccessToken } from './api-client';

export async function fetchPlatformRevenueReport(): Promise<PlatformRevenueReportView> {
  return apiRequest<PlatformRevenueReportView>('/platform/revenue/report');
}

export async function downloadRevenueCsv(): Promise<void> {
  const token = getPlatformAccessToken();
  const res = await fetch('/api/v1/platform/revenue/export', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    throw new Error(`Failed to download revenue CSV: ${res.statusText}`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `platform-revenue-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
