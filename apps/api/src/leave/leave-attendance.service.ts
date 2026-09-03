import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceSource, AttendanceRecordStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../database/prisma.service';
import {
  eachDateInRange,
  formatDateValue,
  parseDateString,
} from './leave.utils';

@Injectable()
export class LeaveAttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async applyApprovedLeave(input: {
    employeeId: string;
    startDate: Date;
    endDate: Date;
    halfDay: boolean;
    isPaid: boolean;
  }): Promise<void> {
    const status: AttendanceRecordStatus = input.halfDay ? 'half_day' : 'leave';
    const dates = input.halfDay
      ? [input.startDate]
      : eachDateInRange(input.startDate, input.endDate);

    for (const date of dates) {
      const existing = await this.prisma.unscoped.attendanceRecord.findFirst({
        where: { employeeId: input.employeeId, date },
      });

      if (existing) {
        await this.prisma.unscoped.attendanceRecord.update({
          where: { id: existing.id },
          data: {
            status,
            payrollEligible: input.isPaid,
            clockInAt: null,
            clockOutAt: null,
          },
        });
      } else {
        await this.prisma.unscoped.attendanceRecord.create({
          data: {
            employeeId: input.employeeId,
            date,
            status,
            source: AttendanceSource.manual,
            payrollEligible: input.isPaid,
          },
        });
      }
    }
  }

  async clearLeaveFromAttendance(input: {
    employeeId: string;
    startDate: Date;
    endDate: Date;
    halfDay: boolean;
  }): Promise<void> {
    const dates = input.halfDay
      ? [input.startDate]
      : eachDateInRange(input.startDate, input.endDate);

    await this.prisma.unscoped.attendanceRecord.updateMany({
      where: {
        employeeId: input.employeeId,
        date: { in: dates },
        status: { in: ['leave', 'half_day'] },
      },
      data: {
        status: AttendanceRecordStatus.absent,
        payrollEligible: true,
      },
    });
  }

  async getHolidayDatesForEmployee(
    companyId: string,
    from: Date,
    to: Date,
  ): Promise<Set<string>> {
    const company = await this.prisma.unscoped.company.findUnique({
      where: { id: companyId },
      select: { countryId: true },
    });
    if (!company) return new Set();

    const countryRules = await this.prisma.unscoped.countryRule.findMany({
      where: {
        countryId: company.countryId,
        ruleType: 'public_holiday',
        effectiveFrom: { lte: to },
      },
      orderBy: { effectiveFrom: 'desc' },
      take: 1,
    });

    const dates = new Set<string>();
    for (const rule of countryRules) {
      const holidays = (rule.payload as { holidays?: Array<{ date: string; recurring?: boolean }> })
        .holidays;
      if (!Array.isArray(holidays)) continue;
      for (const holiday of holidays) {
        if (holiday.recurring) {
          for (let year = from.getUTCFullYear(); year <= to.getUTCFullYear(); year += 1) {
            const base = parseDateString(holiday.date);
            const occurrence = new Date(
              Date.UTC(year, base.getUTCMonth(), base.getUTCDate()),
            );
            if (occurrence >= from && occurrence <= to) {
              dates.add(formatDateValue(occurrence));
            }
          }
        } else {
          const d = parseDateString(holiday.date);
          if (d >= from && d <= to) {
            dates.add(holiday.date);
          }
        }
      }
    }

    const companyHolidays = await this.prisma.unscoped.holiday.findMany({
      where: {
        companyId,
        date: { gte: from, lte: to },
      },
    });
    for (const row of companyHolidays) {
      dates.add(formatDateValue(row.date));
    }

    return dates;
  }
}
