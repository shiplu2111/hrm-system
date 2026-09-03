import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceRecordStatus,
  AttendanceSource,
  Prisma,
  type Shift,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { getTenantIdFromSession } from '../tenant/tenant.context';
import {
  computeAttendanceMetrics,
  resolveAttendanceStatus,
  startOfUtcDay,
} from './attendance.utils';
import type { AttendanceCaptureDto } from './dto/attendance.dto';

type AttendanceWithBreaks = Prisma.AttendanceRecordGetPayload<{
  include: { breaks: true };
}>;

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getDayRecord(employeeId: string, dateInput?: string) {
    await this.assertEmployee(employeeId);
    const workDate = dateInput ? this.parseDate(dateInput) : startOfUtcDay();
    const shift = await this.getAssignedShift(employeeId, workDate);

    const record = await this.prisma.unscoped.attendanceRecord.findFirst({
      where: { employeeId, date: workDate },
      include: { breaks: { orderBy: { startAt: 'asc' } } },
    });

    return this.toResponse(record, shift, workDate);
  }

  async clockIn(employeeId: string, dto: AttendanceCaptureDto) {
    await this.assertEmployee(employeeId);
    const workDate = startOfUtcDay(this.resolveTimestamp(dto));
    const shift = await this.getAssignedShift(employeeId, workDate);
    const at = this.resolveTimestamp(dto);

    const existing = await this.prisma.unscoped.attendanceRecord.findFirst({
      where: { employeeId, date: workDate },
      include: { breaks: true },
    });

    if (existing?.clockInAt) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Already clocked in for this date',
      });
    }

    const metrics = computeAttendanceMetrics({
      clockInAt: at,
      clockOutAt: null,
      breaks: [],
      shift,
      workDate,
      now: at,
    });

    const status = resolveAttendanceStatus(metrics, at);

    const record = existing
      ? await this.prisma.unscoped.attendanceRecord.update({
          where: { id: existing.id },
          data: {
            clockInAt: at,
            clockOutAt: null,
            status,
            source: dto.source ?? AttendanceSource.manual,
            gpsLat: dto.gpsLat ?? null,
            gpsLng: dto.gpsLng ?? null,
            deviceId: dto.deviceId ?? null,
          },
          include: { breaks: { orderBy: { startAt: 'asc' } } },
        })
      : await this.prisma.unscoped.attendanceRecord.create({
          data: {
            employeeId,
            date: workDate,
            clockInAt: at,
            source: dto.source ?? AttendanceSource.manual,
            status,
            gpsLat: dto.gpsLat ?? null,
            gpsLng: dto.gpsLng ?? null,
            deviceId: dto.deviceId ?? null,
          },
          include: { breaks: { orderBy: { startAt: 'asc' } } },
        });

    return this.toResponse(record, shift, workDate, at);
  }

  async clockOut(employeeId: string, dto: AttendanceCaptureDto) {
    await this.assertEmployee(employeeId);
    const at = this.resolveTimestamp(dto);
    const workDate = startOfUtcDay(at);
    const shift = await this.getAssignedShift(employeeId, workDate);

    const record = await this.requireActiveRecord(employeeId, workDate);
    this.assertNoOpenBreak(record);

    if (record.clockOutAt) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Already clocked out for this date',
      });
    }

    const metrics = computeAttendanceMetrics({
      clockInAt: record.clockInAt,
      clockOutAt: at,
      breaks: record.breaks,
      shift,
      workDate,
      now: at,
    });

    const updated = await this.prisma.unscoped.attendanceRecord.update({
      where: { id: record.id },
      data: {
        clockOutAt: at,
        status: resolveAttendanceStatus(metrics, record.clockInAt),
      },
      include: { breaks: { orderBy: { startAt: 'asc' } } },
    });

    return this.toResponse(updated, shift, workDate, at);
  }

  async breakStart(employeeId: string, dto: AttendanceCaptureDto) {
    await this.assertEmployee(employeeId);
    const at = this.resolveTimestamp(dto);
    const workDate = startOfUtcDay(at);
    const shift = await this.getAssignedShift(employeeId, workDate);

    const record = await this.requireActiveRecord(employeeId, workDate);
    this.assertNoOpenBreak(record);

    if (record.clockOutAt) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Cannot start break after clock out',
      });
    }

    const updated = await this.prisma.unscoped.attendanceRecord.update({
      where: { id: record.id },
      data: {
        breaks: {
          create: { startAt: at },
        },
      },
      include: { breaks: { orderBy: { startAt: 'asc' } } },
    });

    return this.toResponse(updated, shift, workDate, at);
  }

  async breakEnd(employeeId: string, dto: AttendanceCaptureDto) {
    await this.assertEmployee(employeeId);
    const at = this.resolveTimestamp(dto);
    const workDate = startOfUtcDay(at);
    const shift = await this.getAssignedShift(employeeId, workDate);

    const record = await this.requireActiveRecord(employeeId, workDate);
    const openBreak = record.breaks.find((b) => !b.endAt);

    if (!openBreak) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No active break to end',
      });
    }

    await this.prisma.unscoped.break.update({
      where: { id: openBreak.id },
      data: { endAt: at },
    });

    const updated = await this.prisma.unscoped.attendanceRecord.findUniqueOrThrow({
      where: { id: record.id },
      include: { breaks: { orderBy: { startAt: 'asc' } } },
    });

    return this.toResponse(updated, shift, workDate, at);
  }

  private async requireActiveRecord(employeeId: string, workDate: Date) {
    const record = await this.prisma.unscoped.attendanceRecord.findFirst({
      where: { employeeId, date: workDate },
      include: { breaks: { orderBy: { startAt: 'asc' } } },
    });

    if (!record?.clockInAt) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Must clock in before this action',
      });
    }

    return record;
  }

  private assertNoOpenBreak(record: AttendanceWithBreaks): void {
    if (record.breaks.some((b) => !b.endAt)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'End the active break before continuing',
      });
    }
  }

  private async getAssignedShift(
    employeeId: string,
    workDate: Date,
  ): Promise<Shift> {
    const roster = await this.prisma.unscoped.roster.findUnique({
      where: {
        employeeId_date: { employeeId, date: workDate },
      },
      include: { shift: true },
    });

    if (!roster?.shift) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No shift assigned for this date (roster entry required)',
      });
    }

    return roster.shift;
  }

  private async assertEmployee(employeeId: string) {
    const tenantId = getTenantIdFromSession();
    const row = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true, tenantId: true, companyId: true },
    });

    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    if (tenantId && row.tenantId !== tenantId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    return row;
  }

  private resolveTimestamp(dto: AttendanceCaptureDto): Date {
    return dto.timestamp ? new Date(dto.timestamp) : new Date();
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid date format, expected YYYY-MM-DD',
      });
    }
    return new Date(Date.UTC(year, month - 1, day));
  }

  private formatTime(time: Date): string {
    return time.toISOString().slice(11, 16);
  }

  private toResponse(
    record: AttendanceWithBreaks | null,
    shift: Shift,
    workDate: Date,
    now: Date = new Date(),
  ) {
    const metrics = computeAttendanceMetrics({
      clockInAt: record?.clockInAt ?? null,
      clockOutAt: record?.clockOutAt ?? null,
      breaks: record?.breaks ?? [],
      shift,
      workDate,
      now,
    });

    return {
      id: record?.id ?? null,
      employeeId: record?.employeeId ?? null,
      date: workDate.toISOString().slice(0, 10),
      clockInAt: record?.clockInAt?.toISOString() ?? null,
      clockOutAt: record?.clockOutAt?.toISOString() ?? null,
      clockInServerAt: record?.clockInServerAt?.toISOString() ?? null,
      clockOutServerAt: record?.clockOutServerAt?.toISOString() ?? null,
      status: (record?.status ?? 'absent') as AttendanceRecordStatus,
      source: record?.source ?? null,
      timeAnomaly: record?.timeAnomaly ?? false,
      geofenceMismatch: record?.geofenceMismatch ?? false,
      payrollEligible: record?.payrollEligible ?? true,
      reviewStatus: record?.reviewStatus ?? 'none',
      shift: {
        id: shift.id,
        name: shift.name,
        startTime: this.formatTime(shift.startTime),
        endTime: this.formatTime(shift.endTime),
        breakMinutes: shift.breakMinutes,
        graceMinutes: shift.graceMinutes,
        standardMinutes: metrics.standardMinutes,
      },
      breaks: (record?.breaks ?? []).map((b) => ({
        id: b.id,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt?.toISOString() ?? null,
      })),
      metrics,
    };
  }
}
