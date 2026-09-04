import type { Shift } from '@prisma/client';
import {
  computeAttendanceMetrics,
  detectTimeAnomaly,
  resolveAttendanceStatus,
} from './attendance.utils';

function shift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: 'shift-1',
    companyId: 'company-1',
    name: 'Standard',
    shiftType: 'fixed',
    startTime: new Date(Date.UTC(1970, 0, 1, 9, 0, 0)),
    endTime: new Date(Date.UTC(1970, 0, 1, 17, 0, 0)),
    breakMinutes: 60,
    graceMinutes: 15,
    minimumMinutes: null,
    lateRule: null,
    earlyLeaveRule: null,
    weekendRule: null,
    otRuleId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('Attendance metrics (ATTENDANCE_LOGIC.md)', () => {
  const workDate = new Date(Date.UTC(2024, 5, 10));

  it('detects late clock-in after grace period', () => {
    const metrics = computeAttendanceMetrics({
      clockInAt: new Date(Date.UTC(2024, 5, 10, 9, 20, 0)),
      clockOutAt: new Date(Date.UTC(2024, 5, 10, 17, 0, 0)),
      breaks: [],
      shift: shift(),
      workDate,
    });

    expect(metrics.isLate).toBe(true);
    expect(metrics.isEarlyLeave).toBe(false);
    expect(
      resolveAttendanceStatus(
        metrics,
        new Date(Date.UTC(2024, 5, 10, 9, 20, 0)),
      ),
    ).toBe('late');
  });

  it('detects early leave before grace-adjusted shift end', () => {
    const metrics = computeAttendanceMetrics({
      clockInAt: new Date(Date.UTC(2024, 5, 10, 9, 0, 0)),
      clockOutAt: new Date(Date.UTC(2024, 5, 10, 16, 30, 0)),
      breaks: [],
      shift: shift(),
      workDate,
    });

    expect(metrics.isLate).toBe(false);
    expect(metrics.isEarlyLeave).toBe(true);
    expect(resolveAttendanceStatus(metrics, new Date())).toBe('early_leave');
  });

  it('computes overtime when net minutes exceed standard shift minutes', () => {
    const metrics = computeAttendanceMetrics({
      clockInAt: new Date(Date.UTC(2024, 5, 10, 9, 0, 0)),
      clockOutAt: new Date(Date.UTC(2024, 5, 10, 18, 0, 0)),
      breaks: [{ startAt: new Date(Date.UTC(2024, 5, 10, 12, 0, 0)), endAt: new Date(Date.UTC(2024, 5, 10, 13, 0, 0)) }],
      shift: shift(),
      workDate,
    });

    expect(metrics.standardMinutes).toBe(420);
    expect(metrics.netMinutes).toBe(480);
    expect(metrics.overtimeMinutes).toBe(60);
  });

  it('marks absent when there is no clock-in', () => {
    const metrics = computeAttendanceMetrics({
      clockInAt: null,
      clockOutAt: null,
      breaks: [],
      shift: shift(),
      workDate,
    });

    expect(metrics.phase).toBe('not_started');
    expect(resolveAttendanceStatus(metrics, null)).toBe('absent');
  });

  it('flags device clock skew as time anomaly', () => {
    const server = new Date(Date.UTC(2024, 5, 10, 9, 0, 0));
    const deviceAhead = new Date(Date.UTC(2024, 5, 10, 10, 0, 0));

    expect(detectTimeAnomaly(deviceAhead, server, 30)).toBe(true);
    expect(detectTimeAnomaly(server, server, 30)).toBe(false);
  });
});
