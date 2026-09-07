import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function parseDateOnly(value: string, field: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `Invalid date for ${field}`,
    });
  }
  return parsed;
}

export function decimalToNumber(value: Decimal | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  return value.toNumber();
}

export function toDecimal(value: number | undefined | null): Decimal | undefined {
  if (value == null) {
    return undefined;
  }
  return new Decimal(value);
}

export const BENEFIT_CATEGORY_LABELS: Record<string, string> = {
  health_insurance: 'Health Insurance',
  life_insurance: 'Life Insurance',
  dental_vision: 'Dental & Vision',
  wellness: 'Wellness',
  other: 'Other',
};

export const BENEFIT_PLAN_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  inactive: 'Inactive',
};

export const OPEN_ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  open: 'Open Enrollment',
  closed: 'Closed',
  cancelled: 'Cancelled',
};
