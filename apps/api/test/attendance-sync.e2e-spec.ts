import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { createTestApp } from './test-app';
import { startOfUtcDay } from '../src/attendance/attendance.utils';

describe('Attendance offline sync (OFFLINE_SYNC.md §4, §10)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let employeeToken: string;
  let employeeId: string;
  let workDate: string;
  const localIds = {
    clockIn: randomUUID(),
    breakStart: randomUUID(),
    breakEnd: randomUUID(),
    clockOut: randomUUID(),
    replayClockIn: randomUUID(),
  };
  let attendanceRecordId: string | null = null;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'employee@cmsnbd.com',
        password: 'password',
        tenantSubdomain: 'demo',
      })
      .expect(201);
    employeeToken = login.body.data.accessToken as string;
    employeeId = login.body.data.user.employeeId as string;
    workDate = startOfUtcDay().toISOString().slice(0, 10);

    await prisma.attendanceSyncEvent.deleteMany({ where: { employeeId } });
    await prisma.break.deleteMany({
      where: { attendanceRecord: { employeeId, date: startOfUtcDay() } },
    });
    await prisma.attendanceRecord.deleteMany({
      where: { employeeId, date: startOfUtcDay() },
    });
  });

  afterAll(async () => {
    await prisma.attendanceSyncEvent.deleteMany({
      where: { localId: { in: Object.values(localIds) } },
    });
    if (attendanceRecordId) {
      await prisma.break.deleteMany({ where: { attendanceRecordId } });
      await prisma.attendanceRecord
        .delete({ where: { id: attendanceRecordId } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
    await app.close();
  });

  function minutesFromStartOfDay(minutes: number): string {
    const base = startOfUtcDay();
    return new Date(base.getTime() + minutes * 60_000).toISOString();
  }

  function buildSameDayPastBatch() {
    const now = new Date();
    const minutesSinceMidnight =
      (now.getTime() - startOfUtcDay(now).getTime()) / 60_000;
    const clockOutMinute = Math.max(minutesSinceMidnight - 10, 240);

    return {
      clockIn: minutesFromStartOfDay(60),
      breakStart: minutesFromStartOfDay(180),
      breakEnd: minutesFromStartOfDay(210),
      clockOut: minutesFromStartOfDay(clockOutMinute),
    };
  }

  function syncTimestamps(offsetMinutes: number): string {
    return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
  }

  function offlineDayBatch(overrides?: {
    clockIn?: string;
    breakStart?: string;
    breakEnd?: string;
    clockOut?: string;
    clockInLocalId?: string;
  }) {
    const defaults = buildSameDayPastBatch();
    return {
      deviceId: 'mobile-test-device',
      events: [
        {
          local_id: overrides?.clockInLocalId ?? localIds.clockIn,
          employee_id: employeeId,
          type: 'clock_in',
          timestamp_device: overrides?.clockIn ?? defaults.clockIn,
          gps: { lat: -33.8688, lng: 151.2093 },
          geofence_ok: true,
        },
        {
          local_id: localIds.breakStart,
          employee_id: employeeId,
          type: 'break_start',
          timestamp_device: overrides?.breakStart ?? defaults.breakStart,
        },
        {
          local_id: localIds.breakEnd,
          employee_id: employeeId,
          type: 'break_end',
          timestamp_device: overrides?.breakEnd ?? defaults.breakEnd,
        },
        {
          local_id: localIds.clockOut,
          employee_id: employeeId,
          type: 'clock_out',
          timestamp_device: overrides?.clockOut ?? defaults.clockOut,
          gps: { lat: -33.8688, lng: 151.2093 },
          geofence_ok: true,
        },
      ],
    };
  }

  it('syncs offline clock in/out batch into a single attendance record (§10 airplane mode)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/sync/attendance')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send(offlineDayBatch())
      .expect(201);

    const { results } = response.body.data as {
      results: Array<{ local_id: string; status: string; server_id?: string }>;
    };

    expect(results).toHaveLength(4);
    expect(results.every((r) => r.status === 'created')).toBe(true);
    expect(new Set(results.map((r) => r.server_id)).size).toBe(1);

    attendanceRecordId = results[0].server_id as string;

    const records = await prisma.attendanceRecord.findMany({
      where: { employeeId, date: startOfUtcDay() },
      include: { breaks: true },
    });
    expect(records).toHaveLength(1);
    expect(records[0].clockInAt).not.toBeNull();
    expect(records[0].clockOutAt).not.toBeNull();
    expect(records[0].breaks).toHaveLength(1);
    expect(records[0].localId).toBe(localIds.clockIn);
    expect(records[0].payrollEligible).toBe(true);
    expect(records[0].reviewStatus).toBe('none');

    const syncEvents = await prisma.attendanceSyncEvent.count({
      where: { employeeId, localId: { in: Object.values(localIds) } },
    });
    expect(syncEvents).toBe(4);
  });

  it('replays the same payload twice without creating duplicates (§10 retry)', async () => {
    const payload = offlineDayBatch();

    const first = await request(app.getHttpServer())
      .post('/api/v1/sync/attendance')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send(payload)
      .expect(201);

    expect(first.body.data.results.every((r: { status: string }) => r.status === 'duplicate')).toBe(
      true,
    );

    const recordCount = await prisma.attendanceRecord.count({
      where: { employeeId, date: startOfUtcDay() },
    });
    expect(recordCount).toBe(1);

    const eventCount = await prisma.attendanceSyncEvent.count({
      where: { employeeId, localId: { in: Object.values(localIds) } },
    });
    expect(eventCount).toBe(4);
  });

  it('returns per-item status so only failed events need retry (§10 partial batch)', async () => {
    await prisma.attendanceSyncEvent.deleteMany({ where: { employeeId } });
    await prisma.break.deleteMany({
      where: { attendanceRecord: { employeeId, date: startOfUtcDay() } },
    });
    await prisma.attendanceRecord.deleteMany({
      where: { employeeId, date: startOfUtcDay() },
    });
    attendanceRecordId = null;

    const partialLocalIds = {
      clockIn: randomUUID(),
      badBreakEnd: randomUUID(),
      clockOut: randomUUID(),
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/sync/attendance')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        deviceId: 'mobile-test-device',
        events: [
          {
            local_id: partialLocalIds.clockIn,
            employee_id: employeeId,
            type: 'clock_in',
            timestamp_device: `${workDate}T09:00:00.000Z`,
          },
          {
            local_id: partialLocalIds.badBreakEnd,
            employee_id: employeeId,
            type: 'break_end',
            timestamp_device: `${workDate}T12:00:00.000Z`,
          },
          {
            local_id: partialLocalIds.clockOut,
            employee_id: employeeId,
            type: 'clock_out',
            timestamp_device: `${workDate}T17:00:00.000Z`,
          },
        ],
      })
      .expect(201);

    const results = response.body.data.results as Array<{
      local_id: string;
      status: string;
      server_id?: string;
      reason?: string;
    }>;

    expect(results[0]).toMatchObject({ local_id: partialLocalIds.clockIn, status: 'created' });
    expect(results[1]).toMatchObject({
      local_id: partialLocalIds.badBreakEnd,
      status: 'rejected',
      reason: 'no_active_break',
    });
    expect(results[2]).toMatchObject({ local_id: partialLocalIds.clockOut, status: 'created' });

    attendanceRecordId = results[0].server_id as string;

    const retry = await request(app.getHttpServer())
      .post('/api/v1/sync/attendance')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        deviceId: 'mobile-test-device',
        events: [
          {
            local_id: partialLocalIds.badBreakEnd,
            employee_id: employeeId,
            type: 'break_end',
            timestamp_device: `${workDate}T12:00:00.000Z`,
          },
        ],
      })
      .expect(201);

    expect(retry.body.data.results[0]).toMatchObject({
      local_id: partialLocalIds.badBreakEnd,
      status: 'rejected',
      reason: 'no_active_break',
    });

    const recordCount = await prisma.attendanceRecord.count({
      where: { employeeId, date: startOfUtcDay() },
    });
    expect(recordCount).toBe(1);

    await prisma.attendanceSyncEvent.deleteMany({
      where: { localId: { in: Object.values(partialLocalIds) } },
    });
    await prisma.attendanceRecord.deleteMany({
      where: { employeeId, date: startOfUtcDay() },
    });
  });

  it('flags time_anomaly without rejecting the event (§10 skewed device clock)', async () => {
    const anomalyLocalId = randomUUID();
    const skewedTimestamp = syncTimestamps(120);

    const response = await request(app.getHttpServer())
      .post('/api/v1/sync/attendance')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        deviceId: 'mobile-test-device',
        events: [
          {
            local_id: anomalyLocalId,
            employee_id: employeeId,
            type: 'clock_in',
            timestamp_device: skewedTimestamp,
          },
        ],
      })
      .expect(201);

    expect(response.body.data.results[0]).toMatchObject({
      local_id: anomalyLocalId,
      status: 'created',
      reason: 'time_anomaly',
    });

    const syncEvent = await prisma.attendanceSyncEvent.findUnique({
      where: {
        employeeId_localId: { employeeId, localId: anomalyLocalId },
      },
    });
    expect(syncEvent?.timeAnomaly).toBe(true);
    expect(syncEvent?.geofenceMismatch).toBe(false);

    const attendance = await prisma.attendanceRecord.findFirst({
      where: { employeeId, date: startOfUtcDay(new Date(skewedTimestamp)) },
    });
    expect(attendance?.timeAnomaly).toBe(true);
    expect(attendance?.payrollEligible).toBe(false);
    expect(attendance?.reviewStatus).toBe('pending_manager');
    expect(attendance?.clockInAt?.toISOString()).toBe(new Date(skewedTimestamp).toISOString());
    expect(attendance?.clockInServerAt).not.toBeNull();

    await prisma.attendanceSyncEvent.deleteMany({ where: { localId: anomalyLocalId } });
    await prisma.attendanceRecord.deleteMany({
      where: { employeeId, date: startOfUtcDay(new Date(skewedTimestamp)) },
    });
  });

  it('flags geofence_mismatch without rejecting when device and server disagree (§6)', async () => {
    await prisma.attendanceSyncEvent.deleteMany({ where: { employeeId } });
    await prisma.break.deleteMany({
      where: { attendanceRecord: { employeeId, date: startOfUtcDay() } },
    });
    await prisma.attendanceRecord.deleteMany({
      where: { employeeId, date: startOfUtcDay() },
    });

    const localId = randomUUID();
    const response = await request(app.getHttpServer())
      .post('/api/v1/sync/attendance')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        deviceId: 'mobile-test-device',
        events: [
          {
            local_id: localId,
            employee_id: employeeId,
            type: 'clock_in',
            timestamp_device: syncTimestamps(0),
            geofence_ok: true,
            gps: { lat: -33.95, lng: 151.2093 },
          },
        ],
      })
      .expect(201);

    expect(response.body.data.results[0]).toMatchObject({
      local_id: localId,
      status: 'created',
    });
    expect(response.body.data.results[0].reason).toContain('geofence_mismatch');

    const syncEvent = await prisma.attendanceSyncEvent.findUnique({
      where: { employeeId_localId: { employeeId, localId } },
    });
    expect(syncEvent?.deviceGeofenceOk).toBe(true);
    expect(syncEvent?.serverGeofenceOk).toBe(false);
    expect(syncEvent?.geofenceMismatch).toBe(true);

    const attendance = await prisma.attendanceRecord.findFirst({
      where: { employeeId, date: startOfUtcDay() },
    });
    expect(attendance?.geofenceMismatch).toBe(true);
    expect(attendance?.payrollEligible).toBe(false);
    expect(attendance?.reviewStatus).toBe('pending_manager');

    await prisma.attendanceSyncEvent.deleteMany({ where: { localId } });
    await prisma.attendanceRecord.deleteMany({
      where: { employeeId, date: startOfUtcDay() },
    });
  });

  it('respects offline duration when evaluating time anomaly (§5)', async () => {
    await prisma.attendanceSyncEvent.deleteMany({ where: { employeeId } });
    await prisma.break.deleteMany({
      where: { attendanceRecord: { employeeId } },
    });
    await prisma.attendanceRecord.deleteMany({ where: { employeeId } });

    const localId = randomUUID();
    const serverNow = new Date();
    const deviceAt = new Date(serverNow.getTime() - 2 * 60 * 60 * 1000);

    const response = await request(app.getHttpServer())
      .post('/api/v1/sync/attendance')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        deviceId: 'mobile-test-device',
        events: [
          {
            local_id: localId,
            employee_id: employeeId,
            type: 'clock_in',
            timestamp_device: deviceAt.toISOString(),
            offline_duration_seconds: 7200,
          },
        ],
      })
      .expect(201);

    expect(response.body.data.results[0]).toMatchObject({
      status: 'created',
    });
    expect(response.body.data.results[0].reason).toBeUndefined();

    await prisma.attendanceSyncEvent.deleteMany({ where: { localId } });
    await prisma.attendanceRecord.deleteMany({
      where: { employeeId, date: startOfUtcDay(deviceAt) },
    });
  });
});
