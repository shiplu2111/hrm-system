import { BadRequestException } from '@nestjs/common';
import { startOfUtcDay } from '../attendance/attendance.utils';
import { formatDateValue, parseDateString } from '../leave/leave.utils';

export interface ReportDateRange {
  from: Date;
  to: Date;
}

export function resolveReportDateRange(
  fromInput?: string,
  toInput?: string,
): ReportDateRange {
  const now = new Date();
  const defaultFrom = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const defaultTo = startOfUtcDay(now);

  const from = fromInput ? parseDateString(fromInput) : defaultFrom;
  const to = toInput ? parseDateString(toInput) : defaultTo;

  if (from > to) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'from date must be on or before to date',
    });
  }

  return { from, to };
}

export function periodLabel(range: ReportDateRange): { from: string; to: string } {
  return {
    from: formatDateValue(range.from),
    to: formatDateValue(range.to),
  };
}
