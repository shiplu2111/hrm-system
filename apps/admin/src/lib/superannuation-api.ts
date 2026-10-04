import type { SuperannuationSettingsRecord } from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function getSuperannuationSettings(
  companyId: string,
  asOf?: string,
): Promise<SuperannuationSettingsRecord> {
  const qs = asOf ? `?asOf=${encodeURIComponent(asOf)}` : '';
  return tenantApiRequest<SuperannuationSettingsRecord>(
    `/companies/${companyId}/superannuation/settings${qs}`,
  );
}
