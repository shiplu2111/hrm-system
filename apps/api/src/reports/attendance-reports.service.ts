import { Injectable } from '@nestjs/common';
import { AttendanceRecordStatus } from '@prisma/client';
import type { ReportResult } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { sumBreakMinutes } from '../attendance/attendance.utils';
import { formatDateValue } from '../leave/leave.utils';
import type { ReportDateRange } from './report-date.util';
import { periodLabel } from './report-date.util';
import { findReportDefinition } from './reports.constants';

const PRESENT_STATUSES: AttendanceRecordStatus[] = [
  AttendanceRecordStatus.present,
  AttendanceRecordStatus.late,
  AttendanceRecordStatus.early_leave,
  AttendanceRecordStatus.wfh,
  AttendanceRecordStatus.business_trip,
  AttendanceRecordStatus.half_day,
];

function formatTime(value: Date | null | undefined): string {
  if (!value) return '';
  return value.toISOString().slice(11, 16);
}

function grossMinutes(clockIn: Date | null, clockOut: Date | null): number {
  if (!clockIn || !clockOut) return 0;
  return Math.round(((clockOut.getTime() - clockIn.getTime()) / 60_000) * 100) / 100;
}

@Injectable()
export class AttendanceReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(
    companyId: string,
    reportId: string,
    range: ReportDateRange,
  ): Promise<ReportResult> {
    switch (reportId) {
      case 'attendance.daily':
        return this.daily(companyId, range);
      case 'attendance.monthly':
        return this.monthly(companyId, range);
      case 'attendance.late':
        return this.late(companyId, range);
      case 'attendance.early-leave':
        return this.earlyLeave(companyId, range);
      case 'attendance.absence':
        return this.absence(companyId, range);
      case 'attendance.working-hours':
        return this.workingHours(companyId, range);
      case 'attendance.overtime':
        return this.overtime(companyId, range);
      case 'attendance.break':
        return this.breakReport(companyId, range);
      case 'attendance.exception':
        return this.exception(companyId, range);
      default:
        throw new Error(`Unknown attendance report: ${reportId}`);
    }
  }

  private baseMeta(reportId: string, range: ReportDateRange, rowCount: number): ReportResult {
    const def = findReportDefinition(reportId)!;
    return {
      reportId,
      title: def.title,
      category: 'attendance',
      generatedAt: new Date().toISOString(),
      period: periodLabel(range),
      columns: [],
      rows: [],
      rowCount,
    };
  }

  private async loadRecords(companyId: string, range: ReportDateRange) {
    return this.prisma.unscoped.attendanceRecord.findMany({
      where: {
        date: { gte: range.from, lte: range.to },
        employee: { companyId, deletedAt: null },
      },
      include: {
        breaks: true,
        employee: {
          select: {
            employeeNumber: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { employee: { lastName: 'asc' } }],
    });
  }

  private async daily(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const records = await this.loadRecords(companyId, range);
    const columns = [
      { key: 'date', label: 'Date' },
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'department', label: 'Department' },
      { key: 'status', label: 'Status' },
      { key: 'clockIn', label: 'Clock In' },
      { key: 'clockOut', label: 'Clock Out' },
      { key: 'source', label: 'Source' },
    ];
    const rows = records.map((record) => ({
      date: formatDateValue(record.date),
      employeeNumber: record.employee.employeeNumber,
      employeeName: `${record.employee.firstName} ${record.employee.lastName}`.trim(),
      department: record.employee.department?.name ?? 'Unassigned',
      status: record.status,
      clockIn: formatTime(record.clockInAt),
      clockOut: formatTime(record.clockOutAt),
      source: record.source,
    }));
    return { ...this.baseMeta('attendance.daily', range, rows.length), columns, rows };
  }

  private async monthly(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const records = await this.loadRecords(companyId, range);
    const byEmployee = new Map<
      string,
      {
        employeeNumber: string;
        name: string;
        department: string;
        present: number;
        absent: number;
        leave: number;
        other: number;
      }
    >();

    for (const record of records) {
      const bucket = byEmployee.get(record.employeeId) ?? {
        employeeNumber: record.employee.employeeNumber,
        name: `${record.employee.firstName} ${record.employee.lastName}`.trim(),
        department: record.employee.department?.name ?? 'Unassigned',
        present: 0,
        absent: 0,
        leave: 0,
        other: 0,
      };
      if (PRESENT_STATUSES.includes(record.status)) bucket.present += 1;
      else if (record.status === AttendanceRecordStatus.absent) bucket.absent += 1;
      else if (
        record.status === AttendanceRecordStatus.leave ||
        record.status === AttendanceRecordStatus.half_day
      )
        bucket.leave += 1;
      else bucket.other += 1;
      byEmployee.set(record.employeeId, bucket);
    }

    const columns = [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'department', label: 'Department' },
      { key: 'presentDays', label: 'Present Days' },
      { key: 'absentDays', label: 'Absent Days' },
      { key: 'leaveDays', label: 'Leave Days' },
      { key: 'otherDays', label: 'Other Days' },
    ];
    const rows = [...byEmployee.values()].map((row) => ({
      employeeNumber: row.employeeNumber,
      employeeName: row.name,
      department: row.department,
      presentDays: row.present,
      absentDays: row.absent,
      leaveDays: row.leave,
      otherDays: row.other,
    }));
    return { ...this.baseMeta('attendance.monthly', range, rows.length), columns, rows };
  }

  private async late(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const records = await this.loadRecords(companyId, range).then((items) =>
      items.filter((r) => r.status === AttendanceRecordStatus.late),
    );
    const columns = [
      { key: 'date', label: 'Date' },
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'clockIn', label: 'Clock In' },
      { key: 'status', label: 'Status' },
    ];
    const rows = records.map((record) => ({
      date: formatDateValue(record.date),
      employeeNumber: record.employee.employeeNumber,
      employeeName: `${record.employee.firstName} ${record.employee.lastName}`.trim(),
      clockIn: formatTime(record.clockInAt),
      status: record.status,
    }));
    return { ...this.baseMeta('attendance.late', range, rows.length), columns, rows };
  }

  private async earlyLeave(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const records = await this.loadRecords(companyId, range).then((items) =>
      items.filter((r) => r.status === AttendanceRecordStatus.early_leave),
    );
    const columns = [
      { key: 'date', label: 'Date' },
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'clockOut', label: 'Clock Out' },
      { key: 'status', label: 'Status' },
    ];
    const rows = records.map((record) => ({
      date: formatDateValue(record.date),
      employeeNumber: record.employee.employeeNumber,
      employeeName: `${record.employee.firstName} ${record.employee.lastName}`.trim(),
      clockOut: formatTime(record.clockOutAt),
      status: record.status,
    }));
    return { ...this.baseMeta('attendance.early-leave', range, rows.length), columns, rows };
  }

  private async absence(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const records = await this.loadRecords(companyId, range).then((items) =>
      items.filter((r) => r.status === AttendanceRecordStatus.absent),
    );
    const columns = [
      { key: 'date', label: 'Date' },
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'department', label: 'Department' },
    ];
    const rows = records.map((record) => ({
      date: formatDateValue(record.date),
      employeeNumber: record.employee.employeeNumber,
      employeeName: `${record.employee.firstName} ${record.employee.lastName}`.trim(),
      department: record.employee.department?.name ?? 'Unassigned',
    }));
    return { ...this.baseMeta('attendance.absence', range, rows.length), columns, rows };
  }

  private async workingHours(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const records = await this.loadRecords(companyId, range);
    const byEmployee = new Map<
      string,
      { employeeNumber: string; name: string; gross: number; breaks: number; net: number; days: number }
    >();

    for (const record of records) {
      const gross = grossMinutes(record.clockInAt, record.clockOutAt);
      const breaks = record.clockInAt
        ? sumBreakMinutes(record.breaks, record.clockOutAt ?? new Date())
        : 0;
      const net = Math.max(0, gross - breaks);
      const bucket = byEmployee.get(record.employeeId) ?? {
        employeeNumber: record.employee.employeeNumber,
        name: `${record.employee.firstName} ${record.employee.lastName}`.trim(),
        gross: 0,
        breaks: 0,
        net: 0,
        days: 0,
      };
      bucket.gross += gross;
      bucket.breaks += breaks;
      bucket.net += net;
      if (record.clockInAt) bucket.days += 1;
      byEmployee.set(record.employeeId, bucket);
    }

    const columns = [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'daysWorked', label: 'Days Worked' },
      { key: 'grossHours', label: 'Gross Hours' },
      { key: 'breakHours', label: 'Break Hours' },
      { key: 'netHours', label: 'Net Hours' },
    ];
    const rows = [...byEmployee.values()].map((row) => ({
      employeeNumber: row.employeeNumber,
      employeeName: row.name,
      daysWorked: row.days,
      grossHours: (row.gross / 60).toFixed(2),
      breakHours: (row.breaks / 60).toFixed(2),
      netHours: (row.net / 60).toFixed(2),
    }));
    return { ...this.baseMeta('attendance.working-hours', range, rows.length), columns, rows };
  }

  private async overtime(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const records = await this.loadRecords(companyId, range);
    const STANDARD_DAY_MINUTES = 480;
    const columns = [
      { key: 'date', label: 'Date' },
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'netHours', label: 'Net Hours' },
      { key: 'overtimeHours', label: 'Overtime Hours' },
    ];
    const rows: Array<Record<string, string | number | null>> = [];
    for (const record of records) {
      const gross = grossMinutes(record.clockInAt, record.clockOutAt);
      const breaks = record.clockInAt
        ? sumBreakMinutes(record.breaks, record.clockOutAt ?? new Date())
        : 0;
      const net = Math.max(0, gross - breaks);
      const overtime = Math.max(0, net - STANDARD_DAY_MINUTES);
      if (overtime <= 0) continue;
      rows.push({
        date: formatDateValue(record.date),
        employeeNumber: record.employee.employeeNumber,
        employeeName: `${record.employee.firstName} ${record.employee.lastName}`.trim(),
        netHours: (net / 60).toFixed(2),
        overtimeHours: (overtime / 60).toFixed(2),
      });
    }
    return { ...this.baseMeta('attendance.overtime', range, rows.length), columns, rows };
  }

  private async breakReport(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const records = await this.loadRecords(companyId, range);
    const columns = [
      { key: 'date', label: 'Date' },
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'breakStart', label: 'Break Start' },
      { key: 'breakEnd', label: 'Break End' },
      { key: 'breakMinutes', label: 'Break Minutes' },
    ];
    const rows = records.flatMap((record) =>
      record.breaks.map((br) => {
        const minutes =
          br.endAt && br.startAt
            ? Math.round(((br.endAt.getTime() - br.startAt.getTime()) / 60_000) * 100) / 100
            : null;
        return {
          date: formatDateValue(record.date),
          employeeNumber: record.employee.employeeNumber,
          employeeName: `${record.employee.firstName} ${record.employee.lastName}`.trim(),
          breakStart: formatTime(br.startAt),
          breakEnd: formatTime(br.endAt),
          breakMinutes: minutes,
        };
      }),
    );
    return { ...this.baseMeta('attendance.break', range, rows.length), columns, rows };
  }

  private async exception(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const records = await this.loadRecords(companyId, range).then((items) =>
      items.filter(
        (r) =>
          r.timeAnomaly ||
          r.geofenceMismatch ||
          r.reviewStatus !== 'none',
      ),
    );
    const columns = [
      { key: 'date', label: 'Date' },
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'timeAnomaly', label: 'Time Anomaly' },
      { key: 'geofenceMismatch', label: 'Geofence Mismatch' },
      { key: 'reviewStatus', label: 'Review Status' },
    ];
    const rows = records.map((record) => ({
      date: formatDateValue(record.date),
      employeeNumber: record.employee.employeeNumber,
      employeeName: `${record.employee.firstName} ${record.employee.lastName}`.trim(),
      timeAnomaly: record.timeAnomaly ? 'Yes' : 'No',
      geofenceMismatch: record.geofenceMismatch ? 'Yes' : 'No',
      reviewStatus: record.reviewStatus,
    }));
    return { ...this.baseMeta('attendance.exception', range, rows.length), columns, rows };
  }
}
