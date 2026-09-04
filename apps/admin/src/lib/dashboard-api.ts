import type { AdminDashboardView } from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function getAdminDashboard(companyId: string): Promise<AdminDashboardView> {
  return tenantApiRequest<AdminDashboardView>(
    `/companies/${companyId}/dashboard/admin`,
  );
}

export function formatDashboardCurrency(
  amount: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: amount >= 1000 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
