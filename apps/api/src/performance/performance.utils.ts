import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import type { KpiDirection } from '@hrm/shared-types';

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

/** Progress toward target (0–100), direction-aware. */
export function computeKpiProgressPercent(
  targetValue: number,
  currentValue: number | null | undefined,
  direction: KpiDirection,
): number | null {
  if (currentValue == null || targetValue <= 0) {
    return null;
  }

  if (direction === 'higher_is_better') {
    return Math.min(100, Math.round((currentValue / targetValue) * 100));
  }

  if (currentValue <= 0) {
    return 100;
  }

  return Math.min(100, Math.round((targetValue / currentValue) * 100));
}

export function assertDateRange(
  start: Date,
  end: Date,
  label: string,
): void {
  if (start.getTime() > end.getTime()) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `${label} start must be on or before end`,
    });
  }
}

export function assertWithinCycle(
  value: Date,
  cycleStart: Date,
  cycleEnd: Date,
  field: string,
): void {
  if (value.getTime() < cycleStart.getTime() || value.getTime() > cycleEnd.getTime()) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `${field} must fall within the review cycle period`,
    });
  }
}
