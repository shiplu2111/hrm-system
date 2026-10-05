import { useCallback, useMemo } from 'react';
import { useAppTranslation } from '@hrm/i18n';
import type { LeaveRequestIssue } from '@hrm/shared-types';

type TFunction = ReturnType<typeof useAppTranslation>['t'];

function parseDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function useLeaveFormat() {
  const { t, i18n } = useAppTranslation();
  const locale = i18n.language?.startsWith('bn') ? 'bn-BD' : 'en-GB';

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }),
    [locale],
  );
  const shortFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }),
    [locale],
  );
  const numberFormat = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale],
  );

  const days = useCallback(
    (count: number) => t('leave.days', { count, formattedCount: numberFormat.format(count) }),
    [numberFormat, t],
  );

  const number = useCallback((value: number) => numberFormat.format(value), [numberFormat]);

  const date = useCallback((value: string) => dateFormat.format(parseDate(value)), [dateFormat]);

  const range = useCallback(
    (start: string, end: string) => {
      if (start.slice(0, 10) === end.slice(0, 10)) return dateFormat.format(parseDate(start));
      const a = parseDate(start);
      const b = parseDate(end);
      const first = a.getFullYear() === b.getFullYear() ? shortFormat.format(a) : dateFormat.format(a);
      return `${first} – ${dateFormat.format(b)}`;
    },
    [dateFormat, shortFormat],
  );

  return { t, days, number, date, range };
}

export function approverLabel(t: TFunction, roleName: string): string {
  if (roleName === 'Manager' || roleName === 'Direct Manager') {
    return t('leave.request.approverDirectManager');
  }
  if (roleName === 'Skip-level Manager' || roleName === 'Skip Level Manager') {
    return t('leave.request.approverSkipLevel');
  }
  return roleName;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

export function issueMessage(
  t: TFunction,
  issue: LeaveRequestIssue,
  format?: { date: (value: string) => string; number: (value: number) => string },
): string {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(issue.params ?? {})) {
    if (format && typeof value === 'number') params[key] = format.number(value);
    else if (format && typeof value === 'string' && ISO_DATE.test(value)) params[key] = format.date(value);
    else params[key] = value;
  }
  if (issue.code === 'invalid_range' && params.max !== undefined) {
    return t('leave.issue.range_too_long', { ...params, defaultValue: issue.message });
  }
  if (issue.code === 'overlap' && typeof params.status === 'string') {
    return t('leave.issue.overlap', {
      ...params,
      status: t(`leave.status.${params.status}`).toLowerCase(),
      defaultValue: issue.message,
    });
  }
  return t(`leave.issue.${issue.code}`, { ...params, defaultValue: issue.message });
}
