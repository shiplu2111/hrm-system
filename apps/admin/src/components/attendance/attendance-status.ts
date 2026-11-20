import type {
  AttendanceCorrectionStatus,
  AttendanceDayStatus,
} from '@hrm/shared-types';

export type StatusBadgeTone =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

/** Shared status badge tone mapping aligned with DESIGN_SYSTEM.md §5. */
export function attendanceDayBadgeTone(status: AttendanceDayStatus): StatusBadgeTone {
  switch (status) {
    case 'present':
      return 'success';
    case 'late':
    case 'early_leave':
    case 'half_day':
      return 'warning';
    case 'absent':
      return 'error';
    case 'wfh':
    case 'business_trip':
    case 'scheduled':
      return 'accent';
    case 'holiday':
    case 'leave':
    case 'weekend':
    case 'off':
    default:
      return 'neutral';
  }
}

/** Calendar day cell tint matching DESIGN_SYSTEM.md §5 semantic status tokens. */
export function attendanceCalendarTileClass(status: AttendanceDayStatus): string {
  switch (status) {
    case 'present':
      return 'border-success-200 bg-success-50/70 dark:border-success-800/60 dark:bg-success-950/30';
    case 'late':
    case 'early_leave':
    case 'half_day':
      return 'border-warning-200 bg-warning-50/70 dark:border-warning-800/60 dark:bg-warning-950/30';
    case 'absent':
      return 'border-error-200 bg-error-50/70 dark:border-error-800/60 dark:bg-error-950/30';
    case 'wfh':
    case 'business_trip':
    case 'scheduled':
      return 'border-accent-200 bg-accent-50/50 dark:border-accent-800/60 dark:bg-accent-950/25';
    default:
      return 'border-base surface';
  }
}

export function correctionStatusTone(
  status: AttendanceCorrectionStatus | string,
): StatusBadgeTone {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'error';
  if (status === 'pending') return 'warning';
  return 'neutral';
}

