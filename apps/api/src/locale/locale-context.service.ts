import { Injectable, NotFoundException } from '@nestjs/common';
import type { LocaleContext } from '@hrm/shared-types';
import { resolveIntlLocale } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';

type CountryFields = {
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  currency: string;
  isoCode: string;
};

@Injectable()
export class LocaleContextService {
  constructor(private readonly prisma: PrismaService) {}

  async forEmployee(employeeId: string): Promise<LocaleContext> {
    const employee = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: {
        workLocation: {
          select: {
            timezone: true,
            company: {
              select: {
                timezone: true,
                country: { select: this.countrySelect() },
              },
            },
          },
        },
        company: {
          select: {
            timezone: true,
            country: { select: this.countrySelect() },
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    const company = employee.workLocation?.company ?? employee.company;
    const timezone =
      employee.workLocation?.timezone ??
      company.timezone ??
      company.country.timezone;

    return this.buildContext(company.country, timezone);
  }

  async forRosterEntry(input: {
    employeeId: string;
    rosterLocationId: string | null;
  }): Promise<LocaleContext> {
    const employee = await this.prisma.scoped.employee.findFirst({
      where: { id: input.employeeId, deletedAt: null },
      select: {
        workLocation: {
          select: {
            timezone: true,
            company: {
              select: {
                timezone: true,
                country: { select: this.countrySelect() },
              },
            },
          },
        },
        company: {
          select: {
            timezone: true,
            country: { select: this.countrySelect() },
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    let rosterLocationTimezone: string | null = null;
    if (input.rosterLocationId) {
      const rosterLocation = await this.prisma.unscoped.location.findFirst({
        where: { id: input.rosterLocationId },
        select: { timezone: true },
      });
      rosterLocationTimezone = rosterLocation?.timezone ?? null;
    }

    const company = employee.workLocation?.company ?? employee.company;
    const timezone =
      rosterLocationTimezone ??
      employee.workLocation?.timezone ??
      company.timezone ??
      company.country.timezone;

    return this.buildContext(company.country, timezone);
  }

  private countrySelect() {
    return {
      timezone: true,
      dateFormat: true,
      numberFormat: true,
      currency: true,
      isoCode: true,
    } satisfies Record<keyof CountryFields, true>;
  }

  private buildContext(country: CountryFields, timezone: string): LocaleContext {
    return {
      timezone,
      dateFormat: country.dateFormat,
      numberFormat: country.numberFormat,
      currency: country.currency,
      locale: resolveIntlLocale(country.isoCode),
    };
  }
}
