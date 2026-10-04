import {
  INTERVIEW_SCORECARD_CRITERIA,
  type InterviewRecommendation,
  type InterviewRoundRecord,
  type InterviewRoundType,
} from '@hrm/shared-types';

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';

export const ROUND_STATUS_TONE: Record<InterviewRoundRecord['status'], BadgeTone> = {
  pending: 'neutral',
  scheduled: 'info',
  completed: 'success',
  cancelled: 'error',
  skipped: 'neutral',
};

export const RECOMMENDATION_TONE: Record<InterviewRecommendation, BadgeTone> = {
  strong_yes: 'success',
  yes: 'success',
  neutral: 'warning',
  no: 'error',
  strong_no: 'error',
};

export const ROUND_TYPE_ACCENT: Record<InterviewRoundType, string> = {
  technical: 'border-l-sky-500',
  hr: 'border-l-purple-500',
  management: 'border-l-warning-500',
  final_decision: 'border-l-success-500',
};

export const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Below bar',
  3: 'Meets bar',
  4: 'Strong',
  5: 'Exceptional',
};

export const INTERVIEW_DURATION_OPTIONS = [30, 45, 60, 90, 120] as const;

export function criterionLabel(roundType: InterviewRoundType, key: string): string {
  return INTERVIEW_SCORECARD_CRITERIA[roundType].find((c) => c.key === key)?.label ?? key;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** `YYYY-MM-DD` in the browser's local time zone. */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `HH:mm` in the browser's local time zone. */
export function toTimeInput(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDateTimeInputs(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatInterviewWhen(
  startIso: string | null,
  endIso: string | null,
): string {
  if (!startIso) return 'Not scheduled';
  const start = new Date(startIso);
  const day = start.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return endIso
    ? `${day}, ${formatTime(startIso)} – ${formatTime(endIso)}`
    : `${day}, ${formatTime(startIso)}`;
}

export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const startLabel = weekStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  if (weekStart.getMonth() === end.getMonth()) {
    return `${startLabel} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  const endLabel = end.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${startLabel} – ${endLabel}, ${end.getFullYear()}`;
}

export function isSafeMeetingUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}
