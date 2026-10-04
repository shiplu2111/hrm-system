import type { ComponentProps } from 'react';
import { FileText, KeyRound, Package, Shield, Users, type LucideIcon } from 'lucide-react';
import type {
  ExitInterviewStatus,
  OffboardingStatus,
  OffboardingTaskCategory,
  PayrollAdjustmentStatus,
} from '@hrm/shared-types';
import type { Badge } from '@/components/ui/Badge';

type BadgeTone = NonNullable<ComponentProps<typeof Badge>['tone']>;

export const OFFBOARDING_CATEGORY_ICONS: Record<OffboardingTaskCategory, LucideIcon> = {
  clearance: Shield,
  asset_return: Package,
  access_revocation: KeyRound,
  exit_process: Users,
  final_settlement: FileText,
};

export const ASSET_RETURN_CONDITIONS = ['Good', 'Minor wear', 'Damaged', 'Missing parts'];

export function offboardingStatusBadge(status: OffboardingStatus): { label: string; tone: BadgeTone } {
  switch (status) {
    case 'in_progress':
      return { label: 'In progress', tone: 'accent' };
    case 'completed':
      return { label: 'Completed', tone: 'success' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'neutral' };
  }
}

export function exitInterviewStatusBadge(
  status: ExitInterviewStatus,
): { label: string; tone: BadgeTone } {
  switch (status) {
    case 'not_started':
      return { label: 'Not scheduled', tone: 'neutral' };
    case 'scheduled':
      return { label: 'Scheduled', tone: 'info' };
    case 'completed':
      return { label: 'Completed', tone: 'success' };
  }
}

/** Payroll adjustment statuses in settlement terms (PAYROLL_LOGIC.md §11). */
export function settlementStatusBadge(
  status: PayrollAdjustmentStatus,
): { label: string; tone: BadgeTone; help: string } {
  switch (status) {
    case 'draft':
      return {
        label: 'Draft',
        tone: 'neutral',
        help: 'Generated but not yet sent for payroll review.',
      };
    case 'pending':
      return {
        label: 'Submitted',
        tone: 'warning',
        help: 'Waiting for payroll to apply it in the target pay cycle.',
      };
    case 'applied':
      return {
        label: 'Applied',
        tone: 'success',
        help: 'Picked up by payroll. It can no longer be cancelled.',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        tone: 'error',
        help: 'This entry will not be paid. Generate a new one if a settlement is still due.',
      };
  }
}

export function formatCurrencyAmount(value: string | number | null | undefined, currency: string): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function formatSignedCurrency(value: string, currency: string): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return formatCurrencyAmount(0, currency);
  return `${n > 0 ? '+' : '−'}${formatCurrencyAmount(Math.abs(n), currency)}`;
}

export function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** `datetime-local` input value for an ISO timestamp, in local time. */
export function toDateTimeLocal(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
