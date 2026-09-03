import { Injectable } from '@nestjs/common';
import {
  AttendanceSource,
  AttendanceSyncEventType,
  Prisma,
  type Shift,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  detectTimeAnomaly,
  getTimeAnomalyThresholdMinutes,
  computeAttendanceMetrics,
  resolveAttendanceStatus,
  startOfUtcDay,
} from '../attendance/attendance.utils';
import {
  buildSyncReasons,
  evaluateGeofenceAtSync,
  mergeReviewFlags,
} from '../attendance/geofence.utils';
import { PrismaService } from '../database/prisma.service';
import { getTenantIdFromSession } from '../tenant/tenant.context';
import type { AttendanceSyncEventDto } from './dto/attendance-sync.dto';

export type AttendanceSyncItemStatus = 'created' | 'duplicate' | 'rejected';

export interface AttendanceSyncItemResult {
  local_id: string;
  status: AttendanceSyncItemStatus;
  server_id?: string;
  reason?: string;
}

type AttendanceWithBreaks = Prisma.AttendanceRecordGetPayload<{
  include: { breaks: true };
}>;

interface RosterContext {
  shift: Shift;
  location: import('../attendance/geofence.utils').GeofenceLocation | null;
}

interface EventValidation {
  timeAnomaly: boolean;
  geofenceMismatch: boolean;
  serverGeofenceOk: boolean | null;
  deviceGeofenceOk: boolean | undefined;
}

@Injectable()
export class AttendanceSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async syncBatch(
    deviceId: string,
    events: AttendanceSyncEventDto[],
    user: AuthenticatedUser,
  ): Promise<AttendanceSyncItemResult[]> {
    const results: AttendanceSyncItemResult[] = [];

    for (const event of events) {
      results.push(await this.processEvent(deviceId, event, user));
    }

    return results;
  }

  private async processEvent(
    deviceId: string,
    event: AttendanceSyncEventDto,
    user: AuthenticatedUser,
  ): Promise<AttendanceSyncItemResult> {
    const existing = await this.prisma.unscoped.attendanceSyncEvent.findUnique({
      where: {
        employeeId_localId: {
          employeeId: event.employee_id,
          localId: event.local_id,
        },
      },
    });

    if (existing) {
      return this.toDuplicateResult(event.local_id, existing);
    }

    if (user.employeeId && user.employeeId !== event.employee_id) {
      return {
        local_id: event.local_id,
        status: 'rejected',
        reason: 'forbidden_employee',
      };
    }

    try {
      return await this.applyEvent(deviceId, event);
    } catch (error) {
      return {
        local_id: event.local_id,
        status: 'rejected',
        reason: this.resolveRejectionReason(error),
      };
    }
  }

  private toDuplicateResult(
    localId: string,
    existing: {
      attendanceRecordId: string | null;
      id: string;
      timeAnomaly: boolean;
      geofenceMismatch: boolean;
    },
  ): AttendanceSyncItemResult {
    return {
      local_id: localId,
      status: 'duplicate',
      server_id: existing.attendanceRecordId ?? existing.id,
      reason: buildSyncReasons({
        timeAnomaly: existing.timeAnomaly,
        geofenceMismatch: existing.geofenceMismatch,
      }),
    };
  }

  private async applyEvent(
    deviceId: string,
    event: AttendanceSyncEventDto,
  ): Promise<AttendanceSyncItemResult> {
    await this.assertEmployee(event.employee_id);
    const deviceAt = new Date(event.timestamp_device);
    if (Number.isNaN(deviceAt.getTime())) {
      return {
        local_id: event.local_id,
        status: 'rejected',
        reason: 'invalid_timestamp',
      };
    }

    const serverAt = new Date();
    const workDate = startOfUtcDay(deviceAt);
    const roster = await this.getRosterContext(event.employee_id, workDate);
    const validation = this.validateEvent(event, deviceAt, serverAt, roster);

    const record = await this.prisma.unscoped.$transaction(async (tx) => {
      const duplicate = await tx.attendanceSyncEvent.findUnique({
        where: {
          employeeId_localId: {
            employeeId: event.employee_id,
            localId: event.local_id,
          },
        },
      });
      if (duplicate) {
        return { kind: 'duplicate' as const, syncEvent: duplicate };
      }

      let attendance = await tx.attendanceRecord.findFirst({
        where: { employeeId: event.employee_id, date: workDate },
        include: { breaks: { orderBy: { startAt: 'asc' } } },
      });

      attendance = await this.applyEventToRecord(
        tx,
        event,
        attendance,
        deviceAt,
        serverAt,
        deviceId,
        roster.shift,
        workDate,
        validation,
      );

      const syncEvent = await tx.attendanceSyncEvent.create({
        data: {
          employeeId: event.employee_id,
          localId: event.local_id,
          eventType: event.type,
          attendanceRecordId: attendance.id,
          deviceTimestamp: deviceAt,
          serverTimestamp: serverAt,
          timeAnomaly: validation.timeAnomaly,
          deviceGeofenceOk: validation.deviceGeofenceOk ?? null,
          serverGeofenceOk: validation.serverGeofenceOk,
          geofenceMismatch: validation.geofenceMismatch,
        },
      });

      return { kind: 'created' as const, attendance, syncEvent, validation };
    });

    if (record.kind === 'duplicate') {
      return this.toDuplicateResult(event.local_id, record.syncEvent);
    }

    return {
      local_id: event.local_id,
      status: 'created',
      server_id: record.attendance.id,
      reason: buildSyncReasons(record.validation),
    };
  }

  private validateEvent(
    event: AttendanceSyncEventDto,
    deviceAt: Date,
    serverAt: Date,
    roster: RosterContext,
  ): EventValidation {
    const timeAnomaly = detectTimeAnomaly(
      deviceAt,
      serverAt,
      getTimeAnomalyThresholdMinutes(),
      event.offline_duration_seconds ?? 0,
    );
    const geofence = evaluateGeofenceAtSync(
      event,
      event.type,
      roster.location,
    );

    return {
      timeAnomaly,
      geofenceMismatch: geofence.geofenceMismatch,
      serverGeofenceOk: geofence.serverGeofenceOk,
      deviceGeofenceOk: event.geofence_ok,
    };
  }

  private async applyEventToRecord(
    tx: Prisma.TransactionClient,
    event: AttendanceSyncEventDto,
    record: AttendanceWithBreaks | null,
    deviceAt: Date,
    serverAt: Date,
    deviceId: string,
    shift: Shift,
    workDate: Date,
    validation: EventValidation,
  ): Promise<AttendanceWithBreaks> {
    const gpsLat = event.gps?.lat ?? null;
    const gpsLng = event.gps?.lng ?? null;
    const review = mergeReviewFlags(record, validation);

    const baseData = {
      source: AttendanceSource.mobile,
      gpsLat,
      gpsLng,
      deviceId,
      syncedAt: serverAt,
      syncStatus: 'synced' as const,
      timeAnomaly: review.timeAnomaly,
      geofenceMismatch: review.geofenceMismatch,
      payrollEligible: review.payrollEligible,
      reviewStatus: review.reviewStatus,
    };

    switch (event.type) {
      case AttendanceSyncEventType.clock_in: {
        if (record?.clockInAt) {
          throw new Error('already_clocked_in');
        }

        const metrics = computeAttendanceMetrics({
          clockInAt: deviceAt,
          clockOutAt: null,
          breaks: [],
          shift,
          workDate,
          now: deviceAt,
        });
        const status = resolveAttendanceStatus(metrics, deviceAt);

        if (record) {
          return tx.attendanceRecord.update({
            where: { id: record.id },
            data: {
              ...baseData,
              clockInAt: deviceAt,
              clockInServerAt: serverAt,
              clockOutAt: null,
              clockOutServerAt: null,
              status,
              localId: event.local_id,
            },
            include: { breaks: { orderBy: { startAt: 'asc' } } },
          });
        }

        return tx.attendanceRecord.create({
          data: {
            employeeId: event.employee_id,
            date: workDate,
            clockInAt: deviceAt,
            clockInServerAt: serverAt,
            status,
            localId: event.local_id,
            ...baseData,
          },
          include: { breaks: { orderBy: { startAt: 'asc' } } },
        });
      }

      case AttendanceSyncEventType.clock_out: {
        const active = this.requireActiveRecord(record);
        this.assertNoOpenBreak(active);

        if (active.clockOutAt) {
          throw new Error('already_clocked_out');
        }

        const metrics = computeAttendanceMetrics({
          clockInAt: active.clockInAt,
          clockOutAt: deviceAt,
          breaks: active.breaks,
          shift,
          workDate,
          now: deviceAt,
        });

        return tx.attendanceRecord.update({
          where: { id: active.id },
          data: {
            ...baseData,
            clockOutAt: deviceAt,
            clockOutServerAt: serverAt,
            status: resolveAttendanceStatus(metrics, active.clockInAt),
          },
          include: { breaks: { orderBy: { startAt: 'asc' } } },
        });
      }

      case AttendanceSyncEventType.break_start: {
        const active = this.requireActiveRecord(record);
        this.assertNoOpenBreak(active);

        if (active.clockOutAt) {
          throw new Error('clock_out_completed');
        }

        return tx.attendanceRecord.update({
          where: { id: active.id },
          data: {
            breaks: { create: { startAt: deviceAt } },
          },
          include: { breaks: { orderBy: { startAt: 'asc' } } },
        });
      }

      case AttendanceSyncEventType.break_end: {
        const active = this.requireActiveRecord(record);
        const openBreak = active.breaks.find((b) => !b.endAt);
        if (!openBreak) {
          throw new Error('no_active_break');
        }

        await tx.break.update({
          where: { id: openBreak.id },
          data: { endAt: deviceAt },
        });

        return tx.attendanceRecord.findUniqueOrThrow({
          where: { id: active.id },
          include: { breaks: { orderBy: { startAt: 'asc' } } },
        });
      }

      default:
        throw new Error('unsupported_event_type');
    }
  }

  private requireActiveRecord(
    record: AttendanceWithBreaks | null,
  ): AttendanceWithBreaks {
    if (!record?.clockInAt) {
      throw new Error('must_clock_in_first');
    }
    return record;
  }

  private assertNoOpenBreak(record: AttendanceWithBreaks): void {
    if (record.breaks.some((b) => !b.endAt)) {
      throw new Error('open_break_active');
    }
  }

  private async getRosterContext(
    employeeId: string,
    workDate: Date,
  ): Promise<RosterContext> {
    const roster = await this.prisma.unscoped.roster.findUnique({
      where: { employeeId_date: { employeeId, date: workDate } },
      include: { shift: true, location: true },
    });

    if (!roster?.shift) {
      throw new Error('no_roster_shift');
    }

    return { shift: roster.shift, location: roster.location ? {
      lat: roster.location.lat != null ? Number(roster.location.lat) : null,
      lng: roster.location.lng != null ? Number(roster.location.lng) : null,
      geofenceRadiusM: roster.location.geofenceRadiusM,
    } : null };
  }

  private async assertEmployee(employeeId: string) {
    const tenantId = getTenantIdFromSession();
    const row = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true, tenantId: true },
    });

    if (!row || (tenantId && row.tenantId !== tenantId)) {
      throw new Error('employee_not_found');
    }

    return row;
  }

  private resolveRejectionReason(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'unknown_error';
  }
}
