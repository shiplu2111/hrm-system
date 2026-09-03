import type { HolidayEntry } from '@hrm/shared-types';
import { eachDateInRange, formatDateValue, parseDateString } from './roster.utils';

interface RuleHolidayPayload {
  name: string;
  date: string;
  recurring?: boolean;
}

function readRuleHolidays(payload: unknown): RuleHolidayPayload[] {
  if (!payload || typeof payload !== 'object') return [];
  const holidays = (payload as { holidays?: unknown }).holidays;
  if (!Array.isArray(holidays)) return [];
  return holidays.filter(
    (row): row is RuleHolidayPayload =>
      typeof row === 'object' &&
      row !== null &&
      typeof (row as RuleHolidayPayload).name === 'string' &&
      typeof (row as RuleHolidayPayload).date === 'string',
  );
}

function expandRuleHoliday(
  holiday: RuleHolidayPayload,
  scope: HolidayEntry['scope'],
  source: HolidayEntry['source'],
  from: Date,
  to: Date,
  meta: Omit<HolidayEntry, 'id' | 'name' | 'date' | 'scope' | 'recurring' | 'source'>,
): HolidayEntry[] {
  const entries: HolidayEntry[] = [];
  const baseDate = parseDateString(holiday.date);

  if (holiday.recurring) {
    for (let year = from.getUTCFullYear(); year <= to.getUTCFullYear(); year += 1) {
      const occurrence = new Date(
        Date.UTC(year, baseDate.getUTCMonth(), baseDate.getUTCDate()),
      );
      if (occurrence >= from && occurrence <= to) {
        entries.push({
          id: `${source}:${meta.countryId ?? meta.stateCode ?? 'x'}:${holiday.name}:${formatDateValue(occurrence)}`,
          name: holiday.name,
          date: formatDateValue(occurrence),
          scope,
          recurring: true,
          source,
          ...meta,
        });
      }
    }
    return entries;
  }

  if (baseDate >= from && baseDate <= to) {
    entries.push({
      id: `${source}:${meta.countryId ?? meta.stateCode ?? 'x'}:${holiday.name}:${holiday.date}`,
      name: holiday.name,
      date: holiday.date,
      scope,
      recurring: false,
      source,
      ...meta,
    });
  }

  return entries;
}

export function expandCountryAndStateHolidays(input: {
  from: Date;
  to: Date;
  countryId: string;
  stateCode: string | null;
  countryRules: Array<{ id: string; payload: unknown }>;
  stateRules: Array<{ id: string; stateCode: string; payload: unknown }>;
}): HolidayEntry[] {
  const entries: HolidayEntry[] = [];

  for (const rule of input.countryRules) {
    for (const holiday of readRuleHolidays(rule.payload)) {
      entries.push(
        ...expandRuleHoliday(holiday, 'country', 'country_rule', input.from, input.to, {
          countryId: input.countryId,
          stateCode: null,
          companyId: null,
          locationId: null,
          employeeId: null,
        }),
      );
    }
  }

  const stateRules = input.stateCode
    ? input.stateRules.filter((rule) => rule.stateCode === input.stateCode)
    : input.stateRules;

  for (const rule of stateRules) {
    for (const holiday of readRuleHolidays(rule.payload)) {
      entries.push(
        ...expandRuleHoliday(holiday, 'state', 'state_rule', input.from, input.to, {
          countryId: input.countryId,
          stateCode: rule.stateCode,
          companyId: null,
          locationId: null,
          employeeId: null,
        }),
      );
    }
  }

  return entries;
}

export function mergeHolidayEntries(entries: HolidayEntry[]): HolidayEntry[] {
  const byKey = new Map<string, HolidayEntry>();
  const priority: Record<HolidayEntry['scope'], number> = {
    employee: 5,
    branch: 4,
    company: 3,
    state: 2,
    country: 1,
  };

  for (const entry of entries) {
    const key = entry.date;
    const existing = byKey.get(key);
    if (!existing || priority[entry.scope] >= priority[existing.scope]) {
      byKey.set(key, entry);
    }
  }

  return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function expandStoredHolidayDates(
  date: Date,
  recurring: boolean,
  from: Date,
  to: Date,
): Date[] {
  if (!recurring) {
    return date >= from && date <= to ? [date] : [];
  }

  const dates: Date[] = [];
  for (let year = from.getUTCFullYear(); year <= to.getUTCFullYear(); year += 1) {
    const occurrence = new Date(
      Date.UTC(year, date.getUTCMonth(), date.getUTCDate()),
    );
    if (occurrence >= from && occurrence <= to) {
      dates.push(occurrence);
    }
  }
  return dates;
}

export { eachDateInRange };
