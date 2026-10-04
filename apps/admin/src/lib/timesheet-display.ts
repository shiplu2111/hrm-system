import type { TimesheetEntryRecord, TimesheetEntryStatus } from '@hrm/shared-types';

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';

export function toLocalIsoDate(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function fromIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export type DateRangePreset = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';

export const DATE_RANGE_PRESETS: Array<{ value: DateRangePreset; label: string }> = [
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'custom', label: 'Custom range' },
];

/** Weeks run Monday–Sunday. */
export function presetRange(
  preset: Exclude<DateRangePreset, 'custom'>,
  today = new Date(),
): { from: string; to: string } {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (preset === 'this_week' || preset === 'last_week') {
    const monday = new Date(base);
    monday.setDate(base.getDate() - ((base.getDay() + 6) % 7) - (preset === 'last_week' ? 7 : 0));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: toLocalIsoDate(monday), to: toLocalIsoDate(sunday) };
  }
  const offset = preset === 'last_month' ? -1 : 0;
  const first = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const last = new Date(base.getFullYear(), base.getMonth() + offset + 1, 0);
  return { from: toLocalIsoDate(first), to: toLocalIsoDate(last) };
}

/** Which preset (if any) a from/to pair matches. */
export function detectPreset(from: string, to: string): DateRangePreset {
  for (const { value } of DATE_RANGE_PRESETS) {
    if (value === 'custom') continue;
    const range = presetRange(value);
    if (range.from === from && range.to === to) return value;
  }
  return 'custom';
}

export function formatRangeLabel(from: string, to: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const fromDate = fromIsoDate(from);
  const toDate = fromIsoDate(to);
  const sameYear = fromDate.getFullYear() === toDate.getFullYear();
  return `${fromDate.toLocaleDateString(undefined, sameYear ? opts : { ...opts, year: 'numeric' })} – ${toDate.toLocaleDateString(undefined, { ...opts, year: 'numeric' })}`;
}

export function formatEntryDate(value: string): string {
  return fromIsoDate(value).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatHours(hours: number): string {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(2).replace(/0$/, '')}h`;
}

export function formatTimeRange(entry: Pick<TimesheetEntryRecord, 'startTime' | 'endTime'>): string {
  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  return `${new Date(entry.startTime).toLocaleTimeString([], opts)} – ${new Date(entry.endTime).toLocaleTimeString([], opts)}`;
}

/** Local wall-clock time on `date` as an ISO timestamp. */
export function localDateTimeIso(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes).toISOString();
}

export function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export const TIMESHEET_STATUS_OPTIONS: Array<{ value: TimesheetEntryStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'draft', label: 'Draft' },
];

export function timesheetStatusTone(entry: Pick<TimesheetEntryRecord, 'status'>): BadgeTone {
  switch (entry.status) {
    case 'approved':
      return 'success';
    case 'rejected':
      return 'error';
    case 'pending_approval':
      return 'warning';
    default:
      return 'neutral';
  }
}

/** "Step 1 of 2 · Manager" for pending entries; null otherwise. */
export function currentStepLabel(entry: Pick<TimesheetEntryRecord, 'workflow'>): string | null {
  const workflow = entry.workflow;
  if (!workflow || workflow.status !== 'pending') return null;
  const step = workflow.steps.find((s) => s.order === workflow.currentStepOrder);
  if (!step) return null;
  const who =
    step.assigneeType === 'direct_manager'
      ? "Employee's manager"
      : step.assigneeType === 'skip_level_manager'
        ? "Manager's manager"
        : step.roleName;
  return `Step ${step.order} of ${workflow.steps.length} · ${who}`;
}

/** Latest comment left on a decided step, e.g. the rejection reason. */
export function latestDecisionComment(entry: Pick<TimesheetEntryRecord, 'workflow'>): string | null {
  const steps = entry.workflow?.steps ?? [];
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    if (steps[i].status !== 'pending' && steps[i].comment) return steps[i].comment;
  }
  return null;
}
