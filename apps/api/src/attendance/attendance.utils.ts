import type { AttendanceRecordStatus, Break, Shift } from '@prisma/client';

export type AttendancePhase = 'not_started' | 'working' | 'on_break' | 'completed';

export interface ShiftWindow {
  shiftStart: Date;
  shiftEnd: Date;
  standardMinutes: number;
}

export interface AttendanceMetrics {
  grossMinutes: number;
  breakMinutes: number;
  netMinutes: number;
  standardMinutes: number;
  overtimeMinutes: number;
  isLate: boolean;
  isEarlyLeave: boolean;
  phase: AttendancePhase;
}

export function startOfUtcDay(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function combineUtcDateAndTime(day: Date, time: Date): Date {
  return new Date(
    Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      time.getUTCHours(),
      time.getUTCMinutes(),
      time.getUTCSeconds(),
      0,
    ),
  );
}

export function buildShiftWindow(day: Date, shift: Shift): ShiftWindow {
  let shiftStart = combineUtcDateAndTime(day, shift.startTime);
  let shiftEnd = combineUtcDateAndTime(day, shift.endTime);

  if (shiftEnd <= shiftStart) {
    shiftEnd = new Date(shiftEnd.getTime() + 24 * 60 * 60 * 1000);
  }

  const grossShiftMinutes =
    (shiftEnd.getTime() - shiftStart.getTime()) / 60_000;
  const standardMinutes = Math.max(0, grossShiftMinutes - shift.breakMinutes);

  return { shiftStart, shiftEnd, standardMinutes };
}

export function sumBreakMinutes(
  breaks: Pick<Break, 'startAt' | 'endAt'>[],
  now: Date = new Date(),
): number {
  return breaks.reduce((total, br) => {
    if (!br.endAt) {
      return total + (now.getTime() - br.startAt.getTime()) / 60_000;
    }
    return total + (br.endAt.getTime() - br.startAt.getTime()) / 60_000;
  }, 0);
}

export function computeAttendanceMetrics(input: {
  clockInAt: Date | null;
  clockOutAt: Date | null;
  breaks: Pick<Break, 'startAt' | 'endAt'>[];
  shift: Shift;
  workDate: Date;
  now?: Date;
}): AttendanceMetrics {
  const now = input.now ?? new Date();
  const { shiftStart, shiftEnd, standardMinutes } = buildShiftWindow(
    input.workDate,
    input.shift,
  );

  const graceMs = input.shift.graceMinutes * 60_000;
  const lateThreshold = new Date(shiftStart.getTime() + graceMs);
  const earlyThreshold = new Date(shiftEnd.getTime() - graceMs);

  let phase: AttendancePhase = 'not_started';
  if (input.clockInAt && !input.clockOutAt) {
    phase = input.breaks.some((b) => !b.endAt) ? 'on_break' : 'working';
  } else if (input.clockInAt && input.clockOutAt) {
    phase = 'completed';
  }

  const grossMinutes =
    input.clockInAt && input.clockOutAt
      ? (input.clockOutAt.getTime() - input.clockInAt.getTime()) / 60_000
      : input.clockInAt
        ? (now.getTime() - input.clockInAt.getTime()) / 60_000
        : 0;

  const breakMinutes = input.clockInAt
    ? sumBreakMinutes(input.breaks, input.clockOutAt ?? now)
    : 0;
  const netMinutes = Math.max(0, grossMinutes - breakMinutes);
  const overtimeMinutes = Math.max(0, netMinutes - standardMinutes);

  const isLate = input.clockInAt ? input.clockInAt > lateThreshold : false;
  const isEarlyLeave = input.clockOutAt
    ? input.clockOutAt < earlyThreshold
    : false;

  return {
    grossMinutes: roundMinutes(grossMinutes),
    breakMinutes: roundMinutes(breakMinutes),
    netMinutes: roundMinutes(netMinutes),
    standardMinutes: roundMinutes(standardMinutes),
    overtimeMinutes: roundMinutes(overtimeMinutes),
    isLate,
    isEarlyLeave,
    phase,
  };
}

export function resolveAttendanceStatus(
  metrics: Pick<AttendanceMetrics, 'isLate' | 'isEarlyLeave'>,
  clockInAt: Date | null,
): AttendanceRecordStatus {
  if (!clockInAt) {
    return 'absent';
  }
  if (metrics.isLate) {
    return 'late';
  }
  if (metrics.isEarlyLeave) {
    return 'early_leave';
  }
  return 'present';
}

function roundMinutes(value: number): number {
  return Math.round(value * 100) / 100;
}

export function detectTimeAnomaly(
  deviceTimestamp: Date,
  serverTimestamp: Date,
  thresholdMinutes: number,
  offlineDurationSeconds?: number,
): boolean {
  const gapMs = serverTimestamp.getTime() - deviceTimestamp.getTime();

  // Device clock ahead of server at sync — skew (OFFLINE_SYNC.md §5)
  if (gapMs < 0) {
    return Math.abs(gapMs) / 60_000 > thresholdMinutes;
  }

  if (offlineDurationSeconds != null && offlineDurationSeconds > 0) {
    const residualMs = gapMs - offlineDurationSeconds * 1000;
    return Math.abs(residualMs) / 60_000 > thresholdMinutes;
  }

  // Queued historical punches: elapsed time since capture is expected, not skew
  return false;
}

export function getTimeAnomalyThresholdMinutes(): number {
  const raw = process.env.ATTENDANCE_TIME_ANOMALY_THRESHOLD_MINUTES;
  const parsed = raw ? Number.parseInt(raw, 10) : 30;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}
