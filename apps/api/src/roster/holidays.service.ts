import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CountryRuleType, HolidayScope, Prisma, type Holiday } from '@prisma/client';
import type {
  HolidayEntry,
  HolidayRecord,
  ResolvedHolidayCalendar,
} from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateHolidayDto,
  ListHolidaysQueryDto,
  ResolveHolidayCalendarQueryDto,
  UpdateHolidayDto,
} from './dto/holidays.dto';
import {
  expandCountryAndStateHolidays,
  expandStoredHolidayDates,
  mergeHolidayEntries,
} from './holiday-calendar.utils';
import { formatDateValue, parseDateString } from './roster.utils';

@Injectable()
export class HolidaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
  ) {}

  async list(
    companyId: string,
    query: ListHolidaysQueryDto,
  ): Promise<{ data: HolidayRecord[]; total: number }> {
    const tenantId = this.companyScope.requireTenantId();
    await this.companyScope.assertCompanyInTenant(companyId);

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));

    const where: Prisma.HolidayWhereInput = {
      tenantId,
      companyId,
      ...(query.scope ? { scope: query.scope } : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
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
      this.prisma.scoped.holiday.findMany({
        where,
        orderBy: [{ date: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.scoped.holiday.count({ where }),
    ]);

    return { data: rows.map((row) => this.toRecord(row)), total };
  }

  async create(companyId: string, dto: CreateHolidayDto): Promise<HolidayRecord> {
    const tenantId = this.companyScope.requireTenantId();
    await this.companyScope.assertCompanyInTenant(companyId);
    this.validateScopeFields(dto.scope, dto.locationId, dto.employeeId);
    await this.assertScopeReferences(companyId, dto);

    const row = await this.prisma.scoped.holiday.create({
      data: {
        tenantId,
        companyId,
        scope: dto.scope,
        locationId: dto.scope === HolidayScope.branch ? dto.locationId! : null,
        employeeId: dto.scope === HolidayScope.employee ? dto.employeeId! : null,
        name: dto.name.trim(),
        date: parseDateString(dto.date),
        recurring: dto.recurring ?? false,
      },
    });

    return this.toRecord(row);
  }

  async update(
    companyId: string,
    holidayId: string,
    dto: UpdateHolidayDto,
  ): Promise<HolidayRecord> {
    const existing = await this.findHolidayOrThrow(companyId, holidayId);

    if (dto.locationId) {
      await this.assertLocation(companyId, dto.locationId);
    }
    if (dto.employeeId) {
      await this.assertEmployee(companyId, dto.employeeId);
    }

    const row = await this.prisma.scoped.holiday.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.date !== undefined ? { date: parseDateString(dto.date) } : {}),
        ...(dto.recurring !== undefined ? { recurring: dto.recurring } : {}),
        ...(dto.locationId !== undefined ? { locationId: dto.locationId } : {}),
        ...(dto.employeeId !== undefined ? { employeeId: dto.employeeId } : {}),
      },
    });

    return this.toRecord(row);
  }

  async remove(companyId: string, holidayId: string): Promise<void> {
    const existing = await this.findHolidayOrThrow(companyId, holidayId);
    await this.prisma.scoped.holiday.delete({ where: { id: existing.id } });
  }

  async resolveCalendar(
    companyId: string,
    query: ResolveHolidayCalendarQueryDto,
  ): Promise<ResolvedHolidayCalendar> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const from = parseDateString(query.from);
    const to = parseDateString(query.to);
    if (from > to) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'from must be on or before to',
      });
    }

    const company = await this.prisma.unscoped.company.findUnique({
      where: { id: companyId },
      select: { id: true, countryId: true },
    });
    if (!company) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Company not found',
      });
    }

    const asOf = to;
    const [countryRules, stateRules, storedHolidays] = await Promise.all([
      this.prisma.unscoped.countryRule.findMany({
        where: {
          countryId: company.countryId,
          ruleType: CountryRuleType.public_holiday,
          effectiveFrom: { lte: asOf },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
        },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
      }),
      this.prisma.unscoped.stateProvinceRule.findMany({
        where: {
          countryId: company.countryId,
          ruleType: 'public_holiday',
          effectiveFrom: { lte: asOf },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
          ...(query.stateCode ? { stateCode: query.stateCode.toUpperCase() } : {}),
        },
        orderBy: { effectiveFrom: 'desc' },
      }),
      this.prisma.scoped.holiday.findMany({
        where: {
          companyId,
          OR: [
            { scope: HolidayScope.company },
            ...(query.locationId
              ? [{ scope: HolidayScope.branch, locationId: query.locationId }]
              : [{ scope: HolidayScope.branch }]),
            ...(query.employeeId
              ? [{ scope: HolidayScope.employee, employeeId: query.employeeId }]
              : []),
          ],
        },
      }),
    ]);

    const inherited = expandCountryAndStateHolidays({
      from,
      to,
      countryId: company.countryId,
      stateCode: query.stateCode?.toUpperCase() ?? null,
      countryRules,
      stateRules,
    });

    const tenantEntries: HolidayEntry[] = [];
    for (const holiday of storedHolidays) {
      if (
        holiday.scope === HolidayScope.branch &&
        query.locationId &&
        holiday.locationId !== query.locationId
      ) {
        continue;
      }

      const scope =
        holiday.scope === HolidayScope.branch
          ? 'branch'
          : holiday.scope === HolidayScope.employee
            ? 'employee'
            : 'company';

      for (const occurrence of expandStoredHolidayDates(
        holiday.date,
        holiday.recurring,
        from,
        to,
      )) {
        tenantEntries.push({
          id: holiday.id,
          name: holiday.name,
          date: formatDateValue(occurrence),
          scope,
          recurring: holiday.recurring,
          source: 'holiday_record',
          companyId,
          locationId: holiday.locationId,
          employeeId: holiday.employeeId,
          countryId: null,
          stateCode: null,
        });
      }
    }

    return {
      companyId,
      from: query.from,
      to: query.to,
      stateCode: query.stateCode?.toUpperCase() ?? null,
      locationId: query.locationId ?? null,
      employeeId: query.employeeId ?? null,
      entries: mergeHolidayEntries([...inherited, ...tenantEntries]),
    };
  }

  private validateScopeFields(
    scope: HolidayScope,
    locationId?: string,
    employeeId?: string,
  ) {
    if (scope === HolidayScope.branch && !locationId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'locationId is required for branch holidays',
      });
    }
    if (scope === HolidayScope.employee && !employeeId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'employeeId is required for employee holiday overrides',
      });
    }
    if (scope === HolidayScope.company && (locationId || employeeId)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Company holidays cannot target a location or employee',
      });
    }
  }

  private async assertScopeReferences(
    companyId: string,
    dto: CreateHolidayDto,
  ) {
    if (dto.locationId) {
      await this.assertLocation(companyId, dto.locationId);
    }
    if (dto.employeeId) {
      await this.assertEmployee(companyId, dto.employeeId);
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

  private async findHolidayOrThrow(companyId: string, holidayId: string) {
    await this.companyScope.assertCompanyInTenant(companyId);
    const row = await this.prisma.scoped.holiday.findFirst({
      where: { id: holidayId, companyId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Holiday not found',
      });
    }
    return row;
  }

  private toRecord(row: Holiday): HolidayRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      scope: row.scope,
      locationId: row.locationId,
      employeeId: row.employeeId,
      name: row.name,
      date: formatDateValue(row.date),
      recurring: row.recurring,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
