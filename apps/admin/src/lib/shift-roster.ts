import {
  computeShiftDuration,
  type CreateOvertimeRuleInput,
  type OvertimeRuleRecord,
  type ShiftRecord,
  type ShiftType,
} from '@hrm/shared-types';
import type { FormErrors } from '@/hooks/useOrgForm';
import type { ShiftInput } from '@/lib/roster-api';
import { addDaysIso, todayIso } from '@/lib/leave-policy';

export { addDaysIso, todayIso };

export const SHIFT_TYPE_META: Record<ShiftType, { label: string; hint: string }> = {
  fixed: { label: 'Fixed', hint: 'Same hours every working day' },
  rotating: { label: 'Rotating', hint: 'Teams cycle through shifts on a schedule' },
  night: { label: 'Night', hint: 'Worked mainly overnight' },
  split: { label: 'Split', hint: 'Two blocks with a long unpaid gap' },
  flexible: { label: 'Flexible', hint: 'Core hours with flexible start and finish' },
  overnight: { label: 'Overnight', hint: 'Starts one day and ends the next' },
};

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const DEFAULT_WEEKEND_DAYS = [0, 6];

/** Chip, dot and timeline-bar classes; a shift keeps its colour on every screen. */
export const SHIFT_PALETTE = [
  {
    chip: 'bg-accent-50 text-accent-800 border-accent-200 dark:bg-accent-950/50 dark:text-accent-200 dark:border-accent-800',
    dot: 'bg-accent-500',
  },
  {
    chip: 'bg-success-50 text-success-800 border-success-200 dark:bg-success-950/40 dark:text-success-200 dark:border-success-800/60',
    dot: 'bg-success-500',
  },
  {
    chip: 'bg-warning-50 text-warning-800 border-warning-200 dark:bg-warning-950/40 dark:text-warning-200 dark:border-warning-800/60',
    dot: 'bg-warning-500',
  },
  {
    chip: 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-800/60',
    dot: 'bg-violet-500',
  },
  {
    chip: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800/60',
    dot: 'bg-sky-500',
  },
  {
    chip: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800/60',
    dot: 'bg-rose-500',
  },
  {
    chip: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-800/60',
    dot: 'bg-teal-500',
  },
  {
    chip: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600',
    dot: 'bg-slate-500',
  },
] as const;

export type ShiftColor = (typeof SHIFT_PALETTE)[number];

/** Colours assigned by creation order so adding a shift never recolours existing ones. */
export function buildShiftColors(shifts: ShiftRecord[]): Map<string, ShiftColor> {
  const ordered = [...shifts].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  return new Map(ordered.map((s, i) => [s.id, SHIFT_PALETTE[i % SHIFT_PALETTE.length]]));
}

export function formatMinutes(total: number): string {
  const sign = total < 0 ? '−' : '';
  const abs = Math.abs(Math.round(total));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}m`;
  return m === 0 ? `${sign}${h}h` : `${sign}${h}h ${m}m`;
}

export function shiftDurationLabel(shift: Pick<ShiftRecord, 'startTime' | 'endTime' | 'breakMinutes'>) {
  const d = computeShiftDuration(shift.startTime, shift.endTime, shift.breakMinutes);
  return d ? formatMinutes(d.netMinutes) : '—';
}

export function shiftWeekendDays(shift: Pick<ShiftRecord, 'weekendRule'>): number[] {
  return shift.weekendRule?.weekendDays ?? DEFAULT_WEEKEND_DAYS;
}

/** False only when the shift explicitly excludes its weekend days. */
export function shiftRunsOnWeekends(shift: Pick<ShiftRecord, 'weekendRule'>): boolean {
  return shift.weekendRule?.appliesOnWeekend ?? false;
}

export function weekdayOfIso(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

export function otRuleSummary(rule: OvertimeRuleRecord): string {
  const threshold =
    rule.dailyThresholdMinutes == null
      ? 'after shift hours'
      : `after ${formatMinutes(rule.dailyThresholdMinutes)} worked`;
  const rates = [
    `${rule.multipliers.weekday}× weekdays`,
    rule.multipliers.weekend != null ? `${rule.multipliers.weekend}× weekends` : null,
    rule.multipliers.publicHoliday != null ? `${rule.multipliers.publicHoliday}× holidays` : null,
  ].filter(Boolean);
  const cap = rule.maxDailyMinutes != null ? `, max ${formatMinutes(rule.maxDailyMinutes)}/day` : '';
  return `${threshold} · ${rates.join(', ')}${cap}`;
}

// ---------------------------------------------------------------------------
// Shift form
// ---------------------------------------------------------------------------

export interface ShiftFormValues {
  name: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  graceMinutes: string;
  /** Hours, decimals allowed; blank = no minimum */
  minimumHours: string;
  /** Minutes late before the day counts as a half day; blank = never */
  halfDayAfterMinutes: string;
  /** Minutes before shift end an employee may leave without an early-leave flag; blank = none */
  earlyLeaveGraceMinutes: string;
  weekendDays: number[];
  worksWeekends: boolean;
  otRuleId: string;
}

export function defaultShiftValues(): ShiftFormValues {
  return {
    name: '',
    shiftType: 'fixed',
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: '60',
    graceMinutes: '10',
    minimumHours: '',
    halfDayAfterMinutes: '',
    earlyLeaveGraceMinutes: '',
    weekendDays: [...DEFAULT_WEEKEND_DAYS],
    worksWeekends: false,
    otRuleId: '',
  };
}

const optionalNumber = (n: number | null | undefined) => (n == null ? '' : String(n));

export function shiftToFormValues(shift: ShiftRecord): ShiftFormValues {
  return {
    name: shift.name,
    shiftType: shift.shiftType,
    startTime: shift.startTime,
    endTime: shift.endTime,
    breakMinutes: String(shift.breakMinutes),
    graceMinutes: String(shift.graceMinutes),
    minimumHours:
      shift.minimumMinutes == null ? '' : String(Number((shift.minimumMinutes / 60).toFixed(2))),
    halfDayAfterMinutes: optionalNumber(shift.lateRule?.halfDayAfterMinutes),
    earlyLeaveGraceMinutes: optionalNumber(shift.earlyLeaveRule?.graceMinutes),
    weekendDays: [...shiftWeekendDays(shift)],
    worksWeekends: shiftRunsOnWeekends(shift),
    otRuleId: shift.otRuleId ?? '',
  };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function intInRange(raw: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw);
  return n >= min && n <= max ? n : null;
}

export function validateShiftValues(
  values: ShiftFormValues,
  takenNames: string[],
): FormErrors<ShiftFormValues> {
  const errors: FormErrors<ShiftFormValues> = {};
  const name = values.name.trim();
  if (!name) errors.name = 'Name is required';
  else if (name.length > 100) errors.name = 'Name must be 100 characters or fewer';
  else if (takenNames.some((n) => n.trim().toLowerCase() === name.toLowerCase()))
    errors.name = `A shift named "${name}" already exists`;

  if (!TIME_RE.test(values.startTime)) errors.startTime = 'Enter a start time';
  if (!TIME_RE.test(values.endTime)) errors.endTime = 'Enter an end time';
  else if (values.startTime === values.endTime)
    errors.endTime = 'End time must differ from start time';

  const breakMinutes = intInRange(values.breakMinutes, 0, 480);
  const duration =
    !errors.startTime && !errors.endTime
      ? computeShiftDuration(values.startTime, values.endTime, breakMinutes ?? 0)
      : null;
  if (breakMinutes === null) errors.breakMinutes = 'Whole minutes between 0 and 480';
  else if (duration && breakMinutes >= duration.grossMinutes)
    errors.breakMinutes = 'Break must be shorter than the shift';

  const grace = intInRange(values.graceMinutes, 0, 120);
  if (grace === null) errors.graceMinutes = 'Whole minutes between 0 and 120';

  if (values.minimumHours.trim()) {
    const hours = Number(values.minimumHours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24)
      errors.minimumHours = 'Hours between 0 and 24';
    else if (duration && Math.round(hours * 60) > duration.netMinutes)
      errors.minimumHours = `Cannot exceed the ${formatMinutes(duration.netMinutes)} net shift`;
  }

  if (values.halfDayAfterMinutes.trim()) {
    const halfDay = intInRange(values.halfDayAfterMinutes, 1, 1440);
    if (halfDay === null) errors.halfDayAfterMinutes = 'Whole minutes between 1 and 1440';
    else if (grace !== null && halfDay <= grace)
      errors.halfDayAfterMinutes = 'Must be longer than the grace period';
  }

  if (values.earlyLeaveGraceMinutes.trim()) {
    if (intInRange(values.earlyLeaveGraceMinutes, 0, 240) === null)
      errors.earlyLeaveGraceMinutes = 'Whole minutes between 0 and 240';
  }

  return errors;
}

export function formValuesToShiftInput(values: ShiftFormValues): ShiftInput {
  const halfDay = values.halfDayAfterMinutes.trim();
  const earlyGrace = values.earlyLeaveGraceMinutes.trim();
  return {
    name: values.name.trim(),
    shiftType: values.shiftType,
    startTime: values.startTime,
    endTime: values.endTime,
    breakMinutes: Number(values.breakMinutes),
    graceMinutes: Number(values.graceMinutes),
    minimumMinutes: values.minimumHours.trim()
      ? Math.round(Number(values.minimumHours) * 60)
      : null,
    lateRule: halfDay ? { halfDayAfterMinutes: Number(halfDay) } : null,
    earlyLeaveRule: earlyGrace ? { graceMinutes: Number(earlyGrace) } : null,
    weekendRule: {
      weekendDays: [...values.weekendDays].sort((a, b) => a - b),
      appliesOnWeekend: values.worksWeekends,
    },
    otRuleId: values.otRuleId || null,
  };
}

// ---------------------------------------------------------------------------
// Overtime rule form
// ---------------------------------------------------------------------------

export interface OtRuleFormValues {
  name: string;
  /** 'shift' = overtime starts once the shift's net hours are exceeded */
  thresholdMode: 'shift' | 'custom';
  thresholdHours: string;
  maxDailyHours: string;
  weekday: string;
  weekend: string;
  publicHoliday: string;
}

export function defaultOtRuleValues(): OtRuleFormValues {
  return {
    name: '',
    thresholdMode: 'shift',
    thresholdHours: '8',
    maxDailyHours: '',
    weekday: '1.5',
    weekend: '2',
    publicHoliday: '2.5',
  };
}

function multiplierError(raw: string, required: boolean): string | undefined {
  if (!raw.trim()) return required ? 'Required' : undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 10) return 'Between 1 and 10';
  if (!/^\d+(\.\d{1,2})?$/.test(raw.trim())) return 'Up to 2 decimals';
  return undefined;
}

export function validateOtRuleValues(
  values: OtRuleFormValues,
  takenNames: string[],
): FormErrors<OtRuleFormValues> {
  const errors: FormErrors<OtRuleFormValues> = {};
  const name = values.name.trim();
  if (!name) errors.name = 'Name is required';
  else if (name.length > 100) errors.name = 'Name must be 100 characters or fewer';
  else if (takenNames.some((n) => n.toLowerCase() === name.toLowerCase()))
    errors.name = `An overtime rule named "${name}" already exists`;

  if (values.thresholdMode === 'custom') {
    const h = Number(values.thresholdHours);
    if (!values.thresholdHours.trim() || !Number.isFinite(h) || h < 0 || h > 24)
      errors.thresholdHours = 'Hours between 0 and 24';
  }
  if (values.maxDailyHours.trim()) {
    const h = Number(values.maxDailyHours);
    if (!Number.isFinite(h) || h <= 0 || h > 24) errors.maxDailyHours = 'Hours between 0 and 24';
  }
  errors.weekday = multiplierError(values.weekday, true);
  errors.weekend = multiplierError(values.weekend, false);
  errors.publicHoliday = multiplierError(values.publicHoliday, false);
  return errors;
}

export function formValuesToOtRuleInput(values: OtRuleFormValues): CreateOvertimeRuleInput {
  return {
    name: values.name.trim(),
    dailyThresholdMinutes:
      values.thresholdMode === 'custom' ? Math.round(Number(values.thresholdHours) * 60) : null,
    maxDailyMinutes: values.maxDailyHours.trim()
      ? Math.round(Number(values.maxDailyHours) * 60)
      : null,
    multipliers: {
      weekday: Number(values.weekday),
      ...(values.weekend.trim() ? { weekend: Number(values.weekend) } : {}),
      ...(values.publicHoliday.trim() ? { publicHoliday: Number(values.publicHoliday) } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Roster selection
// ---------------------------------------------------------------------------

export const cellKey = (employeeId: string, date: string) => `${employeeId}|${date}`;

export function parseCellKey(key: string): { employeeId: string; date: string } {
  const [employeeId, date] = key.split('|');
  return { employeeId, date };
}

const BULK_MAX_EMPLOYEES = 500;
const BULK_MAX_DATES = 62;

/**
 * Turns an arbitrary set of cells into employees × dates blocks for the bulk endpoints:
 * employees sharing the same selected dates go in one request, split to stay within limits.
 */
export function planRosterBatches(
  keys: Iterable<string>,
  maxCells: number,
): { employeeIds: string[]; dates: string[] }[] {
  const datesByEmployee = new Map<string, string[]>();
  for (const key of keys) {
    const { employeeId, date } = parseCellKey(key);
    const list = datesByEmployee.get(employeeId);
    if (list) list.push(date);
    else datesByEmployee.set(employeeId, [date]);
  }

  const employeesBySignature = new Map<string, { dates: string[]; employeeIds: string[] }>();
  for (const [employeeId, dates] of datesByEmployee) {
    const sorted = [...dates].sort();
    const signature = sorted.join(',');
    const group = employeesBySignature.get(signature);
    if (group) group.employeeIds.push(employeeId);
    else employeesBySignature.set(signature, { dates: sorted, employeeIds: [employeeId] });
  }

  const batches: { employeeIds: string[]; dates: string[] }[] = [];
  for (const { dates, employeeIds } of employeesBySignature.values()) {
    for (let d = 0; d < dates.length; d += BULK_MAX_DATES) {
      const dateChunk = dates.slice(d, d + BULK_MAX_DATES);
      const perBatch = Math.max(
        1,
        Math.min(BULK_MAX_EMPLOYEES, Math.floor(maxCells / dateChunk.length)),
      );
      for (let e = 0; e < employeeIds.length; e += perBatch) {
        batches.push({ employeeIds: employeeIds.slice(e, e + perBatch), dates: dateChunk });
      }
    }
  }
  return batches;
}

export function shiftAbbreviation(name: string): string {
  const words = name
    .replace(/\bshift\b/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return name.slice(0, 3).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Roster dates
// ---------------------------------------------------------------------------

/** Monday of the week containing the date. */
export function startOfWeekIso(iso: string): string {
  const day = weekdayOfIso(iso);
  return addDaysIso(iso, day === 0 ? -6 : 1 - day);
}

export function startOfMonthIso(iso: string): string {
  return `${iso.slice(0, 8)}01`;
}

export function endOfMonthIso(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${iso.slice(0, 8)}${String(last).padStart(2, '0')}`;
}

export function eachIsoDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDaysIso(d, 1)) days.push(d);
  return days;
}

export function formatRangeLabel(from: string, to: string): string {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  const sameYear = a.getFullYear() === b.getFullYear();
  const sameMonth = sameYear && a.getMonth() === b.getMonth();
  const right = b.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  if (sameMonth) return `${a.getDate()} – ${right}`;
  const left = a.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return `${left} – ${right}`;
}
