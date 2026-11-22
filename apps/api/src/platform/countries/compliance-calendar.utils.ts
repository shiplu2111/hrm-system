import type {
  ComplianceDueDateRule,
  ComplianceRecurrence,
} from '@hrm/shared-types';

export interface NextDueDateResult {
  dueDate: string; // YYYY-MM-DD
  noticeStartDate: string; // YYYY-MM-DD (dueDate - noticeDaysBefore)
  daysRemaining: number;
  isNoticeDue: boolean; // whether asOfDate is in [noticeStartDate, dueDate]
}

/**
 * Returns the last calendar day of a given year and month (1-12).
 */
export function getLastDayOfMonth(year: number, month: number): number {
  // Day 0 of next month is the last day of month
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Formats a Date object to YYYY-MM-DD string in UTC.
 */
export function formatDateUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses YYYY-MM-DD to UTC midnight Date.
 */
export function parseDateUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Adds days to UTC date.
 */
export function addDaysUtc(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Resolves the next upcoming due date for a compliance event given an authoritative reference date.
 */
export function resolveNextDueDate(
  recurrence: ComplianceRecurrence,
  rule: ComplianceDueDateRule,
  asOfDate: Date | string,
  noticeDaysBefore: number = 7,
): NextDueDateResult | null {
  const asOf = typeof asOfDate === 'string' ? parseDateUtc(asOfDate) : new Date(asOfDate);
  const asOfUtc = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));

  let targetDate: Date | null = null;

  switch (recurrence) {
    case 'fixed_date': {
      if (!rule.specificDate) return null;
      targetDate = parseDateUtc(rule.specificDate);
      break;
    }

    case 'monthly': {
      const year = asOfUtc.getUTCFullYear();
      const month = asOfUtc.getUTCMonth() + 1; // 1-12

      // Check this month's date
      const thisMonthTarget = createMonthTargetDate(year, month, rule);

      if (thisMonthTarget.getTime() >= asOfUtc.getTime()) {
        targetDate = thisMonthTarget;
      } else {
        // Next month
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        targetDate = createMonthTargetDate(nextYear, nextMonth, rule);
      }
      break;
    }

    case 'quarterly': {
      // Default quarter months: [1, 4, 7, 10] or [3, 6, 9, 12] or user specified
      const quarterMonths = rule.quarterMonthOffsets?.length
        ? [...rule.quarterMonthOffsets].sort((a, b) => a - b)
        : [1, 4, 7, 10]; // e.g. Australian BAS: Jan 28, Apr 28, Jul 28, Oct 28

      const year = asOfUtc.getUTCFullYear();
      const month = asOfUtc.getUTCMonth() + 1;

      // Find the first quarter month >= current month where due date >= asOfUtc
      for (const qm of quarterMonths) {
        if (qm >= month) {
          const candidate = createMonthTargetDate(year, qm, rule);
          if (candidate.getTime() >= asOfUtc.getTime()) {
            targetDate = candidate;
            break;
          }
        }
      }

      // If not found in current year, pick the first quarter month of next year
      if (!targetDate) {
        targetDate = createMonthTargetDate(year + 1, quarterMonths[0], rule);
      }
      break;
    }

    case 'yearly': {
      const targetMonth = rule.month || 12;
      const year = asOfUtc.getUTCFullYear();
      const thisYearCandidate = createMonthTargetDate(year, targetMonth, rule);

      if (thisYearCandidate.getTime() >= asOfUtc.getTime()) {
        targetDate = thisYearCandidate;
      } else {
        targetDate = createMonthTargetDate(year + 1, targetMonth, rule);
      }
      break;
    }

    default:
      return null;
  }

  if (!targetDate) return null;

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffTime = targetDate.getTime() - asOfUtc.getTime();
  const daysRemaining = Math.round(diffTime / msPerDay);

  const noticeStart = addDaysUtc(targetDate, -noticeDaysBefore);
  const isNoticeDue = daysRemaining >= 0 && daysRemaining <= noticeDaysBefore;

  return {
    dueDate: formatDateUtc(targetDate),
    noticeStartDate: formatDateUtc(noticeStart),
    daysRemaining,
    isNoticeDue,
  };
}

function createMonthTargetDate(
  year: number,
  month: number,
  rule: ComplianceDueDateRule,
): Date {
  const maxDay = getLastDayOfMonth(year, month);
  let day = rule.dayOfMonth || 21;

  if (rule.lastDayOfMonth) {
    day = maxDay;
  } else {
    day = Math.min(day, maxDay);
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (rule.businessDaysOffset) {
    // Basic day adjustment
    date.setUTCDate(date.getUTCDate() + rule.businessDaysOffset);
  }

  return date;
}
