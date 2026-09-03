import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Shift } from '@prisma/client';
import type { ShiftRecord } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type { CreateShiftDto, UpdateShiftDto } from './dto/shifts.dto';
import { formatTimeValue, parseTimeString } from './roster.utils';

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
  ) {}

  async list(companyId: string): Promise<ShiftRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const rows = await this.prisma.unscoped.shift.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async get(companyId: string, shiftId: string): Promise<ShiftRecord> {
    const row = await this.findShiftOrThrow(companyId, shiftId);
    return this.toRecord(row);
  }

  async create(companyId: string, dto: CreateShiftDto): Promise<ShiftRecord> {
    await this.companyScope.assertCompanyInTenant(companyId);
    if (dto.otRuleId) {
      await this.assertOtRule(companyId, dto.otRuleId);
    }

    try {
      const row = await this.prisma.unscoped.shift.create({
        data: {
          companyId,
          name: dto.name.trim(),
          shiftType: dto.shiftType,
          startTime: parseTimeString(dto.startTime),
          endTime: parseTimeString(dto.endTime),
          breakMinutes: dto.breakMinutes ?? 0,
          graceMinutes: dto.graceMinutes ?? 0,
          minimumMinutes: dto.minimumMinutes ?? null,
          lateRule: (dto.lateRule ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          earlyLeaveRule: (dto.earlyLeaveRule ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          weekendRule: (dto.weekendRule ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          otRuleId: dto.otRuleId ?? null,
        },
      });
      return this.toRecord(row);
    } catch (error) {
      this.handlePrismaError(error);
      throw error;
    }
  }

  async update(
    companyId: string,
    shiftId: string,
    dto: UpdateShiftDto,
  ): Promise<ShiftRecord> {
    await this.findShiftOrThrow(companyId, shiftId);

    if (dto.otRuleId) {
      await this.assertOtRule(companyId, dto.otRuleId);
    }

    const row = await this.prisma.unscoped.shift.update({
      where: { id: shiftId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.shiftType !== undefined ? { shiftType: dto.shiftType } : {}),
        ...(dto.startTime !== undefined
          ? { startTime: parseTimeString(dto.startTime) }
          : {}),
        ...(dto.endTime !== undefined
          ? { endTime: parseTimeString(dto.endTime) }
          : {}),
        ...(dto.breakMinutes !== undefined
          ? { breakMinutes: dto.breakMinutes }
          : {}),
        ...(dto.graceMinutes !== undefined
          ? { graceMinutes: dto.graceMinutes }
          : {}),
        ...(dto.minimumMinutes !== undefined
          ? { minimumMinutes: dto.minimumMinutes }
          : {}),
        ...(dto.lateRule !== undefined
          ? {
              lateRule: (dto.lateRule ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            }
          : {}),
        ...(dto.earlyLeaveRule !== undefined
          ? {
              earlyLeaveRule: (dto.earlyLeaveRule ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            }
          : {}),
        ...(dto.weekendRule !== undefined
          ? {
              weekendRule: (dto.weekendRule ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            }
          : {}),
        ...(dto.otRuleId !== undefined ? { otRuleId: dto.otRuleId } : {}),
      },
    });

    return this.toRecord(row);
  }

  async remove(companyId: string, shiftId: string): Promise<void> {
    await this.findShiftOrThrow(companyId, shiftId);

    const rosterCount = await this.prisma.unscoped.roster.count({
      where: { shiftId },
    });
    if (rosterCount > 0) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Shift is assigned on rosters and cannot be deleted',
      });
    }

    await this.prisma.unscoped.shift.delete({ where: { id: shiftId } });
  }

  private async findShiftOrThrow(companyId: string, shiftId: string) {
    await this.companyScope.assertCompanyInTenant(companyId);
    const row = await this.prisma.unscoped.shift.findFirst({
      where: { id: shiftId, companyId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Shift not found',
      });
    }
    return row;
  }

  private async assertOtRule(companyId: string, otRuleId: string) {
    const company = await this.prisma.unscoped.company.findUnique({
      where: { id: companyId },
      select: { countryId: true },
    });
    if (!company) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Company not found',
      });
    }

    const rule = await this.prisma.unscoped.payrollRule.findFirst({
      where: {
        id: otRuleId,
        OR: [{ companyId }, { companyId: null, countryId: company.countryId }],
      },
    });

    if (!rule) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'OT rule not found for this company',
      });
    }
  }

  private toRecord(row: Shift): ShiftRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      shiftType: row.shiftType,
      startTime: formatTimeValue(row.startTime),
      endTime: formatTimeValue(row.endTime),
      breakMinutes: row.breakMinutes,
      graceMinutes: row.graceMinutes,
      minimumMinutes: row.minimumMinutes,
      lateRule: row.lateRule as ShiftRecord['lateRule'],
      earlyLeaveRule: row.earlyLeaveRule as ShiftRecord['earlyLeaveRule'],
      weekendRule: row.weekendRule as ShiftRecord['weekendRule'],
      otRuleId: row.otRuleId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private handlePrismaError(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'A shift with this configuration already exists',
      });
    }
  }
}
