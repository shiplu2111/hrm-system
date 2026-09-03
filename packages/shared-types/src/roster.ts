export type ShiftType =
  | 'fixed'
  | 'rotating'
  | 'night'
  | 'split'
  | 'flexible'
  | 'overnight';

export interface ShiftRuleConfig {
  /** Minutes after shift start before marked late */
  graceMinutes?: number;
  /** Minutes late before half-day is recorded */
  halfDayAfterMinutes?: number;
  /** Whether weekend days use this shift */
  appliesOnWeekend?: boolean;
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
  location?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
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
