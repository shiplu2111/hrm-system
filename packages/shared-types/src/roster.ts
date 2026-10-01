import type { LocaleContext, RosterDisplayFields } from './locale';

export type ShiftType =
  | 'fixed'
  | 'rotating'
  | 'night'
  | 'split'
  | 'flexible'
  | 'overnight';

export const SHIFT_TYPES: readonly ShiftType[] = [
  'fixed',
  'rotating',
  'night',
  'split',
  'flexible',
  'overnight',
];

export interface ShiftRuleConfig {
  /** Minutes after shift start before marked late */
  graceMinutes?: number;
  /** Minutes late before half-day is recorded */
  halfDayAfterMinutes?: number;
  /** Whether weekend days use this shift */
  appliesOnWeekend?: boolean;
  /** Weekend days for this shift, 0 = Sunday … 6 = Saturday */
  weekendDays?: number[];
}

export interface ShiftDuration {
  grossMinutes: number;
  netMinutes: number;
  /** End time is on the following calendar day */
  crossesMidnight: boolean;
}

function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Mirrors the API's shift window: an end at or before the start rolls to the next day. */
export function computeShiftDuration(
  startTime: string,
  endTime: string,
  breakMinutes: number,
): ShiftDuration | null {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start == null || end == null) return null;
  const crossesMidnight = end <= start;
  const grossMinutes = crossesMidnight ? end + 1440 - start : end - start;
  return {
    grossMinutes,
    netMinutes: Math.max(0, grossMinutes - Math.max(0, breakMinutes)),
    crossesMidnight,
  };
}

export interface OvertimeMultipliers {
  weekday: number;
  weekend?: number;
  publicHoliday?: number;
}

/** Shape of `payroll_rules.rule_json` for overtime rules referenced by `shifts.ot_rule_id`. */
export interface OvertimeRuleConfig {
  kind: 'overtime';
  name: string;
  /** Net minutes worked in a day before overtime starts; null = after the shift's standard hours */
  dailyThresholdMinutes: number | null;
  /** Cap on overtime minutes counted per day; null = no cap */
  maxDailyMinutes: number | null;
  multipliers: OvertimeMultipliers;
}

export interface OvertimeRuleRecord {
  id: string;
  scope: 'company' | 'country';
  companyId: string | null;
  countryId: string | null;
  name: string;
  dailyThresholdMinutes: number | null;
  maxDailyMinutes: number | null;
  multipliers: OvertimeMultipliers;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface CreateOvertimeRuleInput {
  name: string;
  dailyThresholdMinutes?: number | null;
  maxDailyMinutes?: number | null;
  multipliers: OvertimeMultipliers;
  effectiveFrom?: string;
}

export interface ShiftRecord {
  id: string;
  companyId: string;
  name: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  graceMinutes: number;
  minimumMinutes: number | null;
  lateRule: ShiftRuleConfig | null;
  earlyLeaveRule: ShiftRuleConfig | null;
  weekendRule: ShiftRuleConfig | null;
  otRuleId: string | null;
  /** Number of roster days using this shift (list endpoint only) */
  assignmentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RosterRecord {
  id: string;
  employeeId: string;
  shiftId: string;
  date: string;
  locationId: string | null;
  employee?: { id: string; firstName: string; lastName: string; employeeNumber: string };
  shift?: Pick<ShiftRecord, 'id' | 'name' | 'startTime' | 'endTime'>;
  location?: { id: string; name: string; timezone?: string | null } | null;
  createdAt: string;
  updatedAt: string;
  locale?: LocaleContext;
  display?: RosterDisplayFields;
}

export const ROSTER_BULK_MAX_CELLS = 2000;

export interface BulkAssignRosterInput {
  employeeIds: string[];
  shiftId: string;
  dates: string[];
  locationId?: string | null;
  /** Replace existing assignments on those dates instead of skipping them */
  overwrite?: boolean;
}

export interface BulkAssignRosterResult {
  created: number;
  updated: number;
  skipped: number;
}

export interface BulkClearRosterInput {
  employeeIds: string[];
  dates: string[];
}

export interface BulkClearRosterResult {
  deleted: number;
}

export interface LocationOption {
  id: string;
  name: string;
  timezone: string | null;
}

export type HolidayCalendarScope =
  | 'country'
  | 'state'
  | 'company'
  | 'branch'
  | 'employee';

export type TenantHolidayScope = 'company' | 'branch' | 'employee';

export interface HolidayEntry {
  id: string;
  name: string;
  date: string;
  scope: HolidayCalendarScope;
  recurring: boolean;
  source: 'country_rule' | 'state_rule' | 'holiday_record';
  countryId?: string | null;
  stateCode?: string | null;
  companyId?: string | null;
  locationId?: string | null;
  employeeId?: string | null;
}

export interface HolidayRecord {
  id: string;
  companyId: string;
  scope: TenantHolidayScope;
  locationId: string | null;
  employeeId: string | null;
  name: string;
  date: string;
  recurring: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedHolidayCalendar {
  companyId: string;
  from: string;
  to: string;
  stateCode: string | null;
  locationId: string | null;
  employeeId: string | null;
  entries: HolidayEntry[];
}
