import type {
  TrainingAttendanceStatus,
  TrainingCourseStatus,
  TrainingSessionRecord,
  TrainingSessionStatus,
} from '@hrm/shared-types';
import type { StatusPillTone } from '@/components/ui/StatusPill';

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
