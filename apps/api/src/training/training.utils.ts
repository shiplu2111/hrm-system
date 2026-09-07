import { Decimal } from '@prisma/client/runtime/library';
import type { EmployeeCertificationStatus } from '@hrm/shared-types';

export const CERTIFICATION_EXPIRY_WARNING_DAYS = 30;

export function decimalToNumber(value: Decimal | null | undefined): number | null {
  if (value == null) return null;
  return value.toNumber();
}

export function toDecimal(value: number | undefined | null): Decimal | undefined {
  if (value == null) return undefined;
  return new Decimal(value);
}

export function formatDurationMinutes(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function sumCosts(
  costs: Array<{ amount: Decimal; currency: string }>,
  defaultCurrency = 'AUD',
): { total: number; currency: string } {
  if (costs.length === 0) {
    return { total: 0, currency: defaultCurrency };
  }
  const currency = costs[0]?.currency ?? defaultCurrency;
  const total = costs.reduce((sum, row) => sum + row.amount.toNumber(), 0);
  return { total: Math.round(total * 100) / 100, currency };
}

export function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

export function formatTrainingDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function daysUntilExpiry(from: Date, expiry: Date): number {
  const fromDay = startOfUtcDay(from);
  const expiryDay = startOfUtcDay(expiry);
  return Math.max(
    0,
    Math.ceil((expiryDay.getTime() - fromDay.getTime()) / (24 * 60 * 60 * 1000)),
  );
}

export function resolveCertificationStatus(input: {
  storedStatus: EmployeeCertificationStatus;
  expiryDate: Date | null;
  asOf?: Date;
}): EmployeeCertificationStatus {
  if (input.storedStatus === 'revoked') {
    return 'revoked';
  }
  if (input.expiryDate && startOfUtcDay(input.expiryDate) < startOfUtcDay(input.asOf ?? new Date())) {
    return 'expired';
  }
  return 'active';
}
