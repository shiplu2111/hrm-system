import type {
  EmploymentContractDisplayStatus,
  EmploymentContractStatus,
  OvertimeRule,
} from '@hrm/shared-types';

export const EXPIRY_WARNING_DAYS = 30;

export function parseDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date "${value}", expected YYYY-MM-DD`);
  }
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function computeDisplayStatus(input: {
  status: EmploymentContractStatus;
  startDate: Date;
  endDate: Date | null;
  renewalWorkflowStatus?: 'pending' | 'approved' | 'rejected' | 'cancelled' | null;
  asOf?: Date;
}): EmploymentContractDisplayStatus {
  if (
    input.status === 'draft' &&
    input.renewalWorkflowStatus === 'pending'
  ) {
    return 'pending_approval';
  }

  const asOf = input.asOf ?? new Date();
  const today = Date.UTC(
    asOf.getUTCFullYear(),
    asOf.getUTCMonth(),
    asOf.getUTCDate(),
  );

  if (input.status === 'draft') return 'draft';
  if (input.status === 'terminated') return 'terminated';

  if (input.endDate) {
    const end = Date.UTC(
      input.endDate.getUTCFullYear(),
      input.endDate.getUTCMonth(),
      input.endDate.getUTCDate(),
    );
    if (end < today) return 'expired';
    const daysUntil = Math.ceil((end - today) / (24 * 60 * 60 * 1000));
    if (daysUntil <= EXPIRY_WARNING_DAYS) return 'expiring_soon';
  }

  return 'active';
}

export function parseOvertimeRule(value: unknown): OvertimeRule | null {
  if (value == null || typeof value !== 'object') return null;
  const record = value as Partial<OvertimeRule>;
  if (
    record.type !== 'none' &&
    record.type !== 'multiplier_after_weekly_hours' &&
    record.type !== 'multiplier_after_daily_hours'
  ) {
    return null;
  }
  return {
    type: record.type,
    thresholdHours:
      typeof record.thresholdHours === 'number' ? record.thresholdHours : undefined,
    multiplier: typeof record.multiplier === 'number' ? record.multiplier : undefined,
    description: typeof record.description === 'string' ? record.description : undefined,
  };
}

export function formatPayRate(
  payRate: number | null,
  payFrequency: string | null,
  currency: string,
): string | null {
  if (payRate == null) return null;
  const formatted = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(payRate);
  if (!payFrequency) return formatted;
  const suffix: Record<string, string> = {
    hourly: '/hr',
    weekly: '/wk',
    biweekly: '/fortnight',
    monthly: '/mo',
    annual: '/yr',
  };
  return `${formatted}${suffix[payFrequency] ?? ''}`;
}
