import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceCorrectionKind,
  AttendanceCorrectionStatus,
  AttendanceRecordStatus,
  AttendanceSource,
  Prisma,
  type Shift,
} from '@prisma/client';
import {
  buildAttendanceDisplay,
  parseLocalDateInput,
  startOfLocalCalendarDay,
} from '@hrm/shared-types';
import type { LocaleContext } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { LocaleContextService } from '../locale/locale-context.service';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import {
  buildAttendanceLateVariables,
  formatNotificationClockTime,
} from '../notifications/notification.helpers';
import { getTenantIdFromSession } from '../tenant/tenant.context';
import {
  computeAttendanceMetrics,
  resolveAttendanceStatus,
} from './attendance.utils';
import type { AttendanceCaptureDto, CorrectAttendanceDto } from './dto/attendance.dto';

type AttendanceWithBreaks = Prisma.AttendanceRecordGetPayload<{
  include: { breaks: true };
}>;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEngine: NotificationEngineService,
    private readonly localeContext: LocaleContextService,
  ) {}

  async getDayRecord(employeeId: string, dateInput?: string) {
    await this.assertEmployee(employeeId);
    const locale = await this.localeContext.forEmployee(employeeId);
    const workDate = dateInput
      ? this.parseDate(dateInput)
      : startOfLocalCalendarDay(new Date(), locale.timezone);

    const record = await this.prisma.unscoped.attendanceRecord.findFirst({
      where: { employeeId, date: workDate },
      include: { breaks: { orderBy: { startAt: 'asc' } } },
    });

    const shift = await this.resolveShiftForDay(employeeId, workDate, record?.status);

    return this.toResponse(record, shift, workDate, locale);
  }

  async clockIn(employeeId: string, dto: AttendanceCaptureDto) {
    await this.assertEmployee(employeeId);
    const at = this.resolveTimestamp(dto);
    const locale = await this.localeContext.forEmployee(employeeId);
    const workDate = startOfLocalCalendarDay(at, locale.timezone);
    const shift = await this.getAssignedShift(employeeId, workDate);

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

    if (status === AttendanceRecordStatus.late) {
      const employee = await this.prisma.unscoped.employee.findUniqueOrThrow({
        where: { id: employeeId },
        select: {
          tenantId: true,
          companyId: true,
          firstName: true,
          lastName: true,
        },
      });

      await this.notificationEngine.emit({
        tenantId: employee.tenantId,
        companyId: employee.companyId,
        eventType: 'attendance.late',
        subjectEmployeeId: employeeId,
        variables: buildAttendanceLateVariables({
          employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
          workDate: workDate.toISOString().slice(0, 10),
          clockInTime: formatNotificationClockTime(at),
        }),
        payload: {
          employeeId,
          workDate: workDate.toISOString().slice(0, 10),
          attendanceRecordId: record.id,
          eventType: 'attendance.late',
        },
      });
    }

    return this.toResponse(record, shift, workDate, locale, at);
  }

  async clockOut(employeeId: string, dto: AttendanceCaptureDto) {
    await this.assertEmployee(employeeId);
    const at = this.resolveTimestamp(dto);
    const locale = await this.localeContext.forEmployee(employeeId);
    const workDate = startOfLocalCalendarDay(at, locale.timezone);
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

    return this.toResponse(updated, shift, workDate, locale, at);
  }

  async breakStart(employeeId: string, dto: AttendanceCaptureDto) {
    await this.assertEmployee(employeeId);
    const at = this.resolveTimestamp(dto);
    const locale = await this.localeContext.forEmployee(employeeId);
    const workDate = startOfLocalCalendarDay(at, locale.timezone);
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

    return this.toResponse(updated, shift, workDate, locale, at);
  }

  async breakEnd(employeeId: string, dto: AttendanceCaptureDto) {
    await this.assertEmployee(employeeId);
    const at = this.resolveTimestamp(dto);
    const locale = await this.localeContext.forEmployee(employeeId);
    const workDate = startOfLocalCalendarDay(at, locale.timezone);
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

    return this.toResponse(updated, shift, workDate, locale, at);
  }

  async correctAttendance(
    employeeId: string,
    dto: CorrectAttendanceDto,
    adminUser: AuthenticatedUser,
  ) {
    const employee = await this.assertEmployee(employeeId);
    const workDate = this.parseDate(dto.date);
    const locale = await this.localeContext.forEmployee(employeeId);
    const shift = await this.resolveShiftForDay(employeeId, workDate);

    const clockInAt = dto.clockInAt ? new Date(dto.clockInAt) : null;
    const clockOutAt = dto.clockOutAt ? new Date(dto.clockOutAt) : null;

    if (clockInAt && clockOutAt && clockOutAt < clockInAt) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Clock out time cannot be earlier than clock in time',
      });
    }

    const existing = await this.prisma.unscoped.attendanceRecord.findFirst({
      where: { employeeId, date: workDate },
      include: { breaks: { orderBy: { startAt: 'asc' } } },
    });

    const originalValues = existing
      ? {
          clockInAt: existing.clockInAt?.toISOString() ?? null,
          clockOutAt: existing.clockOutAt?.toISOString() ?? null,
          status: existing.status,
          source: existing.source,
          breaks: existing.breaks.map((b) => ({
            id: b.id,
            startAt: b.startAt.toISOString(),
            endAt: b.endAt?.toISOString() ?? null,
          })),
        }
      : {
          clockInAt: null,
          clockOutAt: null,
          status: null,
          source: null,
          breaks: [],
        };

    const newBreaks = (dto.breaks ?? []).map((b) => ({
      startAt: new Date(b.startAt),
      endAt: b.endAt ? new Date(b.endAt) : null,
    }));

    let finalStatus: AttendanceRecordStatus;
    if (dto.status) {
      finalStatus = dto.status;
    } else if (clockInAt) {
      const metrics = computeAttendanceMetrics({
        clockInAt,
        clockOutAt,
        breaks: newBreaks,
        shift,
        workDate,
        now: clockOutAt ?? clockInAt,
      });
      finalStatus = resolveAttendanceStatus(metrics, clockInAt);
    } else {
      finalStatus = AttendanceRecordStatus.absent;
    }

    const result = await this.prisma.unscoped.$transaction(async (tx) => {
      let record: AttendanceWithBreaks;

      if (existing) {
        if (dto.breaks !== undefined) {
          await tx.break.deleteMany({
            where: { attendanceRecordId: existing.id },
          });
        }

        record = await tx.attendanceRecord.update({
          where: { id: existing.id },
          data: {
            clockInAt,
            clockOutAt,
            status: finalStatus,
            source: AttendanceSource.manual,
            ...(dto.breaks !== undefined && newBreaks.length > 0
              ? {
                  breaks: {
                    create: newBreaks.map((b) => ({
                      startAt: b.startAt,
                      endAt: b.endAt,
                    })),
                  },
                }
              : {}),
          },
          include: { breaks: { orderBy: { startAt: 'asc' } } },
        });
      } else {
        record = await tx.attendanceRecord.create({
          data: {
            employeeId,
            date: workDate,
            clockInAt,
            clockOutAt,
            status: finalStatus,
            source: AttendanceSource.manual,
            ...(newBreaks.length > 0
              ? {
                  breaks: {
                    create: newBreaks.map((b) => ({
                      startAt: b.startAt,
                      endAt: b.endAt,
                    })),
                  },
                }
              : {}),
          },
          include: { breaks: { orderBy: { startAt: 'asc' } } },
        });
      }

      const correction = await tx.attendanceCorrection.create({
        data: {
          tenantId: employee.tenantId,
          companyId: employee.companyId,
          employeeId,
          attendanceRecordId: record.id,
          date: workDate,
          kind: AttendanceCorrectionKind.regularization,
          status: AttendanceCorrectionStatus.approved,
          reason: dto.reason.trim(),
          originalValues: originalValues as Prisma.InputJsonValue,
          requestedClockInAt: clockInAt,
          requestedClockOutAt: clockOutAt,
          requestedStatus: finalStatus,
          requestedByUserId: adminUser.id,
          reviewedByUserId: adminUser.id,
          reviewedAt: new Date(),
          reviewComment: 'Direct manual correction by administrator',
        },
      });

      return { record, correction };
    });

    return {
      attendance: this.toResponse(result.record, shift, workDate, locale),
      correction: result.correction,
    };
  }

  async getCorrections(employeeId: string, dateInput?: string) {
    await this.assertEmployee(employeeId);
    const workDate = dateInput ? this.parseDate(dateInput) : undefined;

    const corrections = await this.prisma.unscoped.attendanceCorrection.findMany({
      where: {
        employeeId,
        ...(workDate ? { date: workDate } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const userIds = Array.from(
      new Set(
        corrections
          .flatMap((c) => [c.requestedByUserId, c.reviewedByUserId])
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const users = userIds.length
      ? await this.prisma.unscoped.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.email]));

    return corrections.map((c) => ({
      id: c.id,
      date: c.date.toISOString().slice(0, 10),
      reason: c.reason,
      status: c.status,
      kind: c.kind,
      originalValues: c.originalValues,
      requestedClockInAt: c.requestedClockInAt?.toISOString() ?? null,
      requestedClockOutAt: c.requestedClockOutAt?.toISOString() ?? null,
      requestedStatus: c.requestedStatus,
      requestedBy: userMap.get(c.requestedByUserId) ?? c.requestedByUserId,
      reviewedBy: c.reviewedByUserId ? (userMap.get(c.reviewedByUserId) ?? c.reviewedByUserId) : null,
      reviewedAt: c.reviewedAt?.toISOString() ?? null,
      reviewComment: c.reviewComment,
      createdAt: c.createdAt.toISOString(),
    }));
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

  private async resolveShiftForDay(
    employeeId: string,
    workDate: Date,
    status?: AttendanceRecordStatus | null,
  ): Promise<Shift> {
    if (status === AttendanceRecordStatus.leave || status === AttendanceRecordStatus.half_day) {
      try {
        return await this.getAssignedShift(employeeId, workDate);
      } catch {
        return this.placeholderShift();
      }
    }
    return this.getAssignedShift(employeeId, workDate);
  }

  private placeholderShift(): Shift {
    return {
      id: '00000000-0000-4000-8000-000000000099',
      companyId: '00000000-0000-4000-8000-000000000010',
      name: 'Leave day',
      shiftType: 'fixed',
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T17:00:00.000Z'),
      breakMinutes: 0,
      graceMinutes: 0,
      minimumMinutes: null,
      lateRule: null,
      earlyLeaveRule: null,
      weekendRule: null,
      otRuleId: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
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
    try {
      return parseLocalDateInput(value);
    } catch {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid date format, expected YYYY-MM-DD',
      });
    }
  }

  private formatTime(time: Date): string {
    return time.toISOString().slice(11, 16);
  }

  private toResponse(
    record: AttendanceWithBreaks | null,
    shift: Shift,
    workDate: Date,
    locale: LocaleContext,
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

    const dateKey = workDate.toISOString().slice(0, 10);
    const clockInAt = record?.clockInAt?.toISOString() ?? null;
    const clockOutAt = record?.clockOutAt?.toISOString() ?? null;
    const clockInServerAt = record?.clockInServerAt?.toISOString() ?? null;
    const clockOutServerAt = record?.clockOutServerAt?.toISOString() ?? null;
    const shiftInfo = {
      id: shift.id,
      name: shift.name,
      startTime: this.formatTime(shift.startTime),
      endTime: this.formatTime(shift.endTime),
      breakMinutes: shift.breakMinutes,
      graceMinutes: shift.graceMinutes,
      standardMinutes: metrics.standardMinutes,
    };
    const breaks = (record?.breaks ?? []).map((b) => ({
      id: b.id,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt?.toISOString() ?? null,
    }));

    return {
      id: record?.id ?? null,
      employeeId: record?.employeeId ?? null,
      date: dateKey,
      clockInAt,
      clockOutAt,
      clockInServerAt,
      clockOutServerAt,
      status: (record?.status ?? 'absent') as AttendanceRecordStatus,
      source: record?.source ?? null,
      timeAnomaly: record?.timeAnomaly ?? false,
      geofenceMismatch: record?.geofenceMismatch ?? false,
      payrollEligible: record?.payrollEligible ?? true,
      reviewStatus: record?.reviewStatus ?? 'none',
      shift: shiftInfo,
      breaks,
      metrics,
      locale,
      display: buildAttendanceDisplay(
        {
          date: dateKey,
          clockInAt,
          clockOutAt,
          clockInServerAt,
          clockOutServerAt,
          shift: shiftInfo,
          breaks,
        },
        locale,
      ),
    };
  }

  async getCompanyDailyAttendance(companyId: string, dateInput?: string) {
    const defaultDate = dateInput
      ? this.parseDate(dateInput)
      : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));

    const employees = await this.prisma.unscoped.employee.findMany({
      where: {
        companyId,
        deletedAt: null,
      },
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const employeeIds = employees.map((e) => e.id);

    const [records, rosters, leaveRequests] = await Promise.all([
      this.prisma.unscoped.attendanceRecord.findMany({
        where: {
          employeeId: { in: employeeIds },
          date: defaultDate,
        },
        include: { breaks: { orderBy: { startAt: 'asc' } } },
      }),
      this.prisma.unscoped.roster.findMany({
        where: {
          employeeId: { in: employeeIds },
          date: defaultDate,
        },
        include: { shift: true, location: true },
      }),
      this.prisma.unscoped.leaveRequest.findMany({
        where: {
          employeeId: { in: employeeIds },
          status: 'approved',
          startDate: { lte: defaultDate },
          endDate: { gte: defaultDate },
        },
      }),
    ]);

    const recordMap = new Map(records.map((r) => [r.employeeId, r]));
    const rosterMap = new Map(rosters.map((r) => [r.employeeId, r]));
    const onLeaveSet = new Set(leaveRequests.map((l) => l.employeeId));

    const dateKey = defaultDate.toISOString().slice(0, 10);
    const now = new Date();

    const rows = employees.map((emp) => {
      const record = recordMap.get(emp.id) ?? null;
      const roster = rosterMap.get(emp.id) ?? null;
      const shift = roster?.shift ?? this.placeholderShift();
      const isOnLeave = onLeaveSet.has(emp.id);

      const metrics = computeAttendanceMetrics({
        clockInAt: record?.clockInAt ?? null,
        clockOutAt: record?.clockOutAt ?? null,
        breaks: record?.breaks ?? [],
        shift,
        workDate: defaultDate,
        now,
      });

      let status = record?.status ?? (isOnLeave ? ('leave' as AttendanceRecordStatus) : ('absent' as AttendanceRecordStatus));

      const clockInAt = record?.clockInAt?.toISOString() ?? null;
      const clockOutAt = record?.clockOutAt?.toISOString() ?? null;

      const shiftInfo = {
        id: shift.id,
        name: shift.name,
        startTime: this.formatTime(shift.startTime),
        endTime: this.formatTime(shift.endTime),
        breakMinutes: shift.breakMinutes,
        graceMinutes: shift.graceMinutes,
        standardMinutes: metrics.standardMinutes,
      };

      const breaks = (record?.breaks ?? []).map((b) => ({
        id: b.id,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt?.toISOString() ?? null,
      }));

      const personalInfo = (emp.personalInfo as Record<string, any>) ?? {};
      const avatarUrl = (personalInfo.avatarUrl as string) || null;

      return {
        employee: {
          id: emp.id,
          employeeNumber: emp.employeeNumber,
          firstName: emp.firstName,
          lastName: emp.lastName,
          avatarUrl,
          department: emp.department ? { id: emp.department.id, name: emp.department.name } : null,
          designation: emp.designation ? { id: emp.designation.id, title: emp.designation.name } : null,
          employmentStatus: emp.employmentStatus,
        },
        attendance: {
          id: record?.id ?? null,
          employeeId: emp.id,
          date: dateKey,
          clockInAt,
          clockOutAt,
          status,
          source: record?.source ?? null,
          shift: shiftInfo,
          breaks,
          metrics,
        },
      };
    });

    let present = 0;
    let late = 0;
    let earlyLeave = 0;
    let onBreak = 0;
    let absent = 0;
    let onLeave = 0;

    for (const row of rows) {
      const { attendance } = row;
      if (attendance.status === 'leave') {
        onLeave += 1;
      } else if (attendance.metrics.phase === 'on_break') {
        onBreak += 1;
        present += 1;
      } else if (attendance.clockInAt) {
        present += 1;
        if (attendance.metrics.isLate) late += 1;
        if (attendance.metrics.isEarlyLeave) earlyLeave += 1;
      } else {
        absent += 1;
      }
    }

    return {
      date: dateKey,
      kpis: {
        totalStaff: employees.length,
        present,
        late,
        earlyLeave,
        onBreak,
        absent,
        onLeave,
      },
      rows,
    };
  }
}
