import type { AdminExpiryItem, AdminPendingApprovalItem } from '@hrm/shared-types';
import type { ComponentProps } from 'react';
import type { Badge } from '@/components/ui/Badge';

type BadgeTone = NonNullable<ComponentProps<typeof Badge>['tone']>;

export function pendingApprovalBadge(
  type: AdminPendingApprovalItem['type'],
): { label: string; tone: BadgeTone } {
  switch (type) {
    case 'leave_request':
      return { label: 'Pending', tone: 'warning' };
    case 'payroll_adjustment':
      return { label: 'Pending', tone: 'warning' };
    case 'payroll_run':
      return { label: 'In review', tone: 'accent' };
    case 'attendance_review':
      return { label: 'Pending', tone: 'warning' };
    default:
      return { label: 'Pending', tone: 'warning' };
  }
}

export function expiryUrgencyBadge(
  daysUntil: number,
): { label: string; tone: BadgeTone } {
  if (daysUntil <= 7) {
    return {
      label: daysUntil === 0 ? 'Due today' : `${daysUntil}d left`,
      tone: 'error',
    };
  }
  if (daysUntil <= 14) {
    return { label: `${daysUntil}d left`, tone: 'warning' };
  }
  return { label: `${daysUntil}d left`, tone: 'neutral' };
}

export function expiryItemTypeLabel(type: AdminExpiryItem['type']): string {
  switch (type) {
    case 'document':
      return 'Document';
    case 'contract':
      return 'Contract';
    case 'probation':
      return 'Probation';
    case 'certification':
      return 'Certification';
    default:
      return 'Expiry';
  }
}
