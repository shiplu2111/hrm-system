import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RosterRecord } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateRosterDto,
  ListRostersQueryDto,
  UpdateRosterDto,
} from './dto/rosters.dto';
import { formatDateValue, parseDateString } from './roster.utils';

@Injectable()
export class RostersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
  ) {}

  async list(
    companyId: string,
    query: ListRostersQueryDto,
  ): Promise<{ data: RosterRecord[]; total: number }> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));

    const where: Prisma.RosterWhereInput = {
      employee: { companyId, deletedAt: null },
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: parseDateString(query.from) } : {}),
              ...(query.to ? { lte: parseDateString(query.to) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.unscoped.roster.findMany({
        where,
        orderBy: [{ date: 'asc' }, { employeeId: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
            },
          },
          shift: {
            select: { id: true, name: true, startTime: true, endTime: true },
          },
          location: { select: { id: true, name: true } },
        },
      }),
      this.prisma.unscoped.roster.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toRecord(row)),
      total,
    };
  }

  async get(companyId: string, rosterId: string): Promise<RosterRecord> {
    const row = await this.findRosterOrThrow(companyId, rosterId);
    return this.toRecord(row);
  }

  async create(companyId: string, dto: CreateRosterDto): Promise<RosterRecord> {
    await this.companyScope.assertCompanyInTenant(companyId);
    await this.assertEmployee(companyId, dto.employeeId);
    await this.assertShift(companyId, dto.shiftId);
    if (dto.locationId) {
      await this.assertLocation(companyId, dto.locationId);
    }

    const date = parseDateString(dto.date);

    try {
      const row = await this.prisma.unscoped.roster.create({
        data: {
          employeeId: dto.employeeId,
          shiftId: dto.shiftId,
          date,
          locationId: dto.locationId ?? null,
        },
        include: this.includeRelations(),
      });
      return this.toRecord(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Employee already has a roster entry for this date',
        });
      }
      throw error;
    }
  }

  async update(
    companyId: string,
    rosterId: string,
    dto: UpdateRosterDto,
  ): Promise<RosterRecord> {
    const existing = await this.findRosterOrThrow(companyId, rosterId);

    if (dto.shiftId) {
      await this.assertShift(companyId, dto.shiftId);
    }
    if (dto.locationId) {
      await this.assertLocation(companyId, dto.locationId);
    }

    try {
      const row = await this.prisma.unscoped.roster.update({
        where: { id: rosterId },
        data: {
          ...(dto.shiftId !== undefined ? { shiftId: dto.shiftId } : {}),
          ...(dto.date !== undefined ? { date: parseDateString(dto.date) } : {}),
          ...(dto.locationId !== undefined ? { locationId: dto.locationId } : {}),
        },
        include: this.includeRelations(),
      });
      return this.toRecord(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Employee already has a roster entry for this date',
        });
      }
      throw error;
    }
  }

  async remove(companyId: string, rosterId: string): Promise<void> {
    await this.findRosterOrThrow(companyId, rosterId);
    await this.prisma.unscoped.roster.delete({ where: { id: rosterId } });
  }

  private includeRelations() {
    return {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
        },
      },
      shift: {
        select: { id: true, name: true, startTime: true, endTime: true },
      },
      location: { select: { id: true, name: true } },
    } as const;
  }

  private async findRosterOrThrow(companyId: string, rosterId: string) {
    await this.companyScope.assertCompanyInTenant(companyId);
    const row = await this.prisma.unscoped.roster.findFirst({
      where: {
        id: rosterId,
        employee: { companyId, deletedAt: null },
      },
      include: this.includeRelations(),
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Roster entry not found',
      });
    }
    return row;
  }

  private async assertEmployee(companyId: string, employeeId: string) {
    const employee = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Employee not found in this company',
      });
    }
  }

  private async assertShift(companyId: string, shiftId: string) {
    const shift = await this.prisma.unscoped.shift.findFirst({
      where: { id: shiftId, companyId },
      select: { id: true },
    });
    if (!shift) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Shift not found in this company',
      });
    }
  }

  private async assertLocation(companyId: string, locationId: string) {
    const location = await this.prisma.unscoped.location.findFirst({
      where: { id: locationId, companyId },
      select: { id: true },
    });
    if (!location) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Location not found in this company',
      });
    }
  }

  private toRecord(
    row: Prisma.RosterGetPayload<{
      include: ReturnType<RostersService['includeRelations']>;
    }>,
  ): RosterRecord {
    return {
      id: row.id,
      employeeId: row.employeeId,
      shiftId: row.shiftId,
      date: formatDateValue(row.date),
      locationId: row.locationId,
      employee: row.employee
        ? {
            id: row.employee.id,
            firstName: row.employee.firstName,
            lastName: row.employee.lastName,
            employeeNumber: row.employee.employeeNumber,
          }
        : undefined,
      shift: row.shift
        ? {
            id: row.shift.id,
            name: row.shift.name,
            startTime: row.shift.startTime.toISOString().slice(11, 16),
            endTime: row.shift.endTime.toISOString().slice(11, 16),
          }
        : undefined,
      location: row.location
        ? { id: row.location.id, name: row.location.name }
        : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
