import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  BulkAssignRosterResult,
  BulkClearRosterResult,
  LocationOption,
  RosterRecord,
} from '@hrm/shared-types';
import { buildRosterDisplay, ROSTER_BULK_MAX_CELLS } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { LocaleContextService } from '../locale/locale-context.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  BulkAssignRosterDto,
  BulkClearRosterDto,
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
    private readonly localeContext: LocaleContextService,
  ) {}

  async list(
    companyId: string,
    query: ListRostersQueryDto,
  ): Promise<{ data: RosterRecord[]; total: number }> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(1000, Math.max(1, query.pageSize ?? 50));

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
          location: { select: { id: true, name: true, timezone: true } },
        },
      }),
      this.prisma.unscoped.roster.count({ where }),
    ]);

    return {
      data: await Promise.all(rows.map((row) => this.toRecord(row))),
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

  async listLocations(companyId: string): Promise<LocationOption[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    return this.prisma.unscoped.location.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, timezone: true },
    });
  }

  /** Assigns every (employee, date) pair; existing entries are skipped unless `overwrite`. */
  async bulkAssign(
    companyId: string,
    dto: BulkAssignRosterDto,
  ): Promise<BulkAssignRosterResult> {
    await this.companyScope.assertCompanyInTenant(companyId);
    this.assertBulkSize(dto.employeeIds.length, dto.dates.length);
    await this.assertEmployees(companyId, dto.employeeIds);
    await this.assertShift(companyId, dto.shiftId);
    if (dto.locationId) {
      await this.assertLocation(companyId, dto.locationId);
    }

    const dates = dto.dates.map((d) => parseDateString(d));
    const locationId = dto.locationId ?? null;

    return this.prisma.unscoped.$transaction(async (tx) => {
      const existing = await tx.roster.findMany({
        where: { employeeId: { in: dto.employeeIds }, date: { in: dates } },
        select: { id: true, employeeId: true, date: true, shiftId: true, locationId: true },
      });
      const taken = new Set(
        existing.map((row) => `${row.employeeId}:${formatDateValue(row.date)}`),
      );

      const toCreate: Prisma.RosterCreateManyInput[] = [];
      for (const employeeId of dto.employeeIds) {
        for (const date of dates) {
          if (!taken.has(`${employeeId}:${formatDateValue(date)}`)) {
            toCreate.push({ employeeId, shiftId: dto.shiftId, date, locationId });
          }
        }
      }

      const toUpdate = dto.overwrite
        ? existing.filter(
            (row) => row.shiftId !== dto.shiftId || row.locationId !== locationId,
          )
        : [];

      const created = toCreate.length
        ? (await tx.roster.createMany({ data: toCreate, skipDuplicates: true })).count
        : 0;
      const updated = toUpdate.length
        ? (
            await tx.roster.updateMany({
              where: { id: { in: toUpdate.map((row) => row.id) } },
              data: { shiftId: dto.shiftId, locationId },
            })
          ).count
        : 0;

      return {
        created,
        updated,
        skipped: dto.employeeIds.length * dates.length - created - updated,
      };
    });
  }

  async bulkClear(
    companyId: string,
    dto: BulkClearRosterDto,
  ): Promise<BulkClearRosterResult> {
    await this.companyScope.assertCompanyInTenant(companyId);
    this.assertBulkSize(dto.employeeIds.length, dto.dates.length);

    const { count } = await this.prisma.unscoped.roster.deleteMany({
      where: {
        employeeId: { in: dto.employeeIds },
        employee: { companyId },
        date: { in: dto.dates.map((d) => parseDateString(d)) },
      },
    });
    return { deleted: count };
  }

  private assertBulkSize(employeeCount: number, dateCount: number) {
    if (employeeCount * dateCount > ROSTER_BULK_MAX_CELLS) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Bulk roster changes are limited to ${ROSTER_BULK_MAX_CELLS} employee-days per request`,
      });
    }
  }

  private async assertEmployees(companyId: string, employeeIds: string[]) {
    const found = await this.prisma.scoped.employee.count({
      where: { id: { in: employeeIds }, companyId, deletedAt: null },
    });
    if (found !== employeeIds.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'One or more employees were not found in this company',
      });
    }
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
      location: { select: { id: true, name: true, timezone: true } },
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

  private async toRecord(
    row: Prisma.RosterGetPayload<{
      include: ReturnType<RostersService['includeRelations']>;
    }>,
  ): Promise<RosterRecord> {
    const locale = await this.localeContext.forRosterEntry({
      employeeId: row.employeeId,
      rosterLocationId: row.locationId,
    });

    const date = formatDateValue(row.date);
    const shift = row.shift
      ? {
          id: row.shift.id,
          name: row.shift.name,
          startTime: row.shift.startTime.toISOString().slice(11, 16),
          endTime: row.shift.endTime.toISOString().slice(11, 16),
        }
      : undefined;

    return {
      id: row.id,
      employeeId: row.employeeId,
      shiftId: row.shiftId,
      date,
      locationId: row.locationId,
      employee: row.employee
        ? {
            id: row.employee.id,
            firstName: row.employee.firstName,
            lastName: row.employee.lastName,
            employeeNumber: row.employee.employeeNumber,
          }
        : undefined,
      shift,
      location: row.location
        ? {
            id: row.location.id,
            name: row.location.name,
            timezone: row.location.timezone,
          }
        : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      locale,
      display: buildRosterDisplay({ date, shift }, locale),
    };
  }
}
