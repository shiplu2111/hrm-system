import type {
  CertificationExpiryState,
  EmployeeCertificationRecord,
  SkillProficiencyLevel,
  TrainingAttendanceStatus,
  TrainingCourseStatus,
  TrainingSessionRecord,
  TrainingSessionStatus,
} from '@hrm/shared-types';
import type { StatusPillTone } from '@/components/ui/StatusPill';
import { formatDateOnly } from '@/lib/currency-display';

/** DESIGN_SYSTEM.md §5: valid = success, attention = warning, overdue = danger, inactive = neutral. */
export const EXPIRY_STATE_TONE: Record<CertificationExpiryState, StatusPillTone> = {
  valid: 'success',
  no_expiry: 'success',
  expiring_soon: 'warning',
  expired: 'error',
  revoked: 'neutral',
};

/** Most urgent first, for sorting and an employee's overall state. */
export const EXPIRY_STATE_PRIORITY: CertificationExpiryState[] = [
  'expired',
  'expiring_soon',
  'valid',
  'no_expiry',
  'revoked',
];

export function compareCertificationUrgency(a: EmployeeCertificationRecord, b: EmployeeCertificationRecord): number {
  const rank = EXPIRY_STATE_PRIORITY.indexOf(a.expiryState) - EXPIRY_STATE_PRIORITY.indexOf(b.expiryState);
  if (rank !== 0) return rank;
  return (a.daysUntilExpiry ?? Infinity) - (b.daysUntilExpiry ?? Infinity) || a.name.localeCompare(b.name);
}

export function certificationTone(row: EmployeeCertificationRecord): StatusPillTone {
  return row.supersededById ? 'neutral' : EXPIRY_STATE_TONE[row.expiryState];
}

export function certificationExpiryText(row: EmployeeCertificationRecord): string {
  if (row.supersededById) return 'Renewed';
  const days = row.daysUntilExpiry;
  switch (row.expiryState) {
    case 'revoked':
      return 'Revoked';
    case 'no_expiry':
      return 'No expiry';
    case 'expired':
      return days === -1 ? 'Expired yesterday' : `Expired ${Math.abs(days ?? 0)} days ago`;
    case 'expiring_soon':
      return days === 0 ? 'Expires today' : days === 1 ? 'Expires tomorrow' : `Expires in ${days} days`;
    default:
      return `Valid until ${formatDateOnly(row.expiryDate)}`;
  }
}

export const SKILL_LEVEL_SCORE: Record<SkillProficiencyLevel, number> = {
  none: 0,
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

/** Proficiency ramp on the primary scale, light to dark; `none` stays neutral. */
export const SKILL_LEVEL_CELL: Record<SkillProficiencyLevel, string> = {
  none: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  beginner: 'bg-accent-100 text-accent-800 dark:bg-accent-950 dark:text-accent-200',
  intermediate: 'bg-accent-300 text-accent-950 dark:bg-accent-800 dark:text-accent-100',
  advanced: 'bg-accent-500 text-white dark:bg-accent-600',
  expert: 'bg-accent-700 text-white dark:bg-accent-400 dark:text-accent-950',
};

export const SKILL_LEVEL_SHORT: Record<SkillProficiencyLevel, string> = {
  none: 'None',
  beginner: 'Beg',
  intermediate: 'Int',
  advanced: 'Adv',
  expert: 'Exp',
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function todayDateOnly(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Adds whole years to a `YYYY-MM-DD` date, clamping 29 Feb. */
export function addYears(value: string, years: number): string {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y + years, m - 1, d));
  if (date.getUTCMonth() !== m - 1) date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

export const COURSE_STATUS_TONE: Record<TrainingCourseStatus, StatusPillTone> = {
  draft: 'neutral',
  active: 'success',
  archived: 'warning',
};

export const SESSION_STATUS_TONE: Record<TrainingSessionStatus, StatusPillTone> = {
  scheduled: 'accent',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'neutral',
};

export const ATTENDANCE_STATUS_TONE: Record<TrainingAttendanceStatus, StatusPillTone> = {
  registered: 'neutral',
  attended: 'accent',
  completed: 'success',
  no_show: 'error',
  cancelled: 'neutral',
};

export const MAX_SESSION_DAYS = 14;

export function isSessionOpen(status: TrainingSessionStatus): boolean {
  return status === 'scheduled' || status === 'in_progress';
}

export function hasStarted(session: Pick<TrainingSessionRecord, 'scheduledStart'>, now = Date.now()): boolean {
  return new Date(session.scheduledStart).getTime() <= now;
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatSessionWindow(start: string, end: string | null): string {
  const from = new Date(start);
  if (!end) return formatDateTime(start);
  const to = new Date(end);
  const sameDay = from.toDateString() === to.toDateString();
  const time = (date: Date) => date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return sameDay ? `${formatDateTime(start)} – ${time(to)}` : `${formatDateTime(start)} – ${formatDateTime(end)}`;
}

/** `datetime-local` value in the browser's time zone. */
export function toLocalInput(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—';
}
