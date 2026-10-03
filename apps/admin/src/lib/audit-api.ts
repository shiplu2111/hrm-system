import type { AuditLogEntry, AuditLogFilterOptions, AuditLogQuery } from '@hrm/shared-types';
import { tenantApiRequest, tenantApiRequestWithMeta } from './tenant-api-client';

export interface AuditLogPage {
  entries: AuditLogEntry[];
  total: number;
}

export async function listAuditLogs(query: AuditLogQuery): Promise<AuditLogPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  const { data, meta } = await tenantApiRequestWithMeta<AuditLogEntry[]>(
    `/tenant/audit-logs${qs ? `?${qs}` : ''}`,
  );
  return { entries: data, total: meta?.total ?? data.length };
}

export function getAuditLogFilters(): Promise<AuditLogFilterOptions> {
  return tenantApiRequest<AuditLogFilterOptions>('/tenant/audit-logs/filters');
}
