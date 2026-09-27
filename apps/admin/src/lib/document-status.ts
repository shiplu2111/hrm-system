import type { EmployeeDocumentStatus } from '@hrm/shared-types';
import type { ComponentProps } from 'react';
import type { Badge } from '@/components/ui/Badge';

type BadgeTone = NonNullable<ComponentProps<typeof Badge>['tone']>;

export function employeeDocumentStatusBadge(
  status: EmployeeDocumentStatus,
): { label: string; tone: BadgeTone } {
  switch (status) {
    case 'verified':
      return { label: 'Verified', tone: 'success' };
    case 'pending':
      return { label: 'Pending review', tone: 'warning' };
    case 'expiring_soon':
      return { label: 'Expiring soon', tone: 'error' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

export function documentExpiryBadge(expiryDate: string | null): {
  label: string;
  tone: BadgeTone;
} | null {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${expiryDate}T00:00:00`);
  const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (daysUntil < 0) {
    return { label: 'Expired', tone: 'error' };
  }
  if (daysUntil === 0) {
    return { label: 'Expires today', tone: 'error' };
  }
  if (daysUntil <= 7) {
    return { label: `${daysUntil}d left`, tone: 'error' };
  }
  if (daysUntil <= 30) {
    return { label: `${daysUntil}d left`, tone: 'warning' };
  }
  return { label: expiryDate, tone: 'neutral' };
}
