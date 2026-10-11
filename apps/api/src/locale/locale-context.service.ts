import { Injectable, NotFoundException } from '@nestjs/common';
import type { LocaleContext, LocalizationOverrides } from '@hrm/shared-types';
import { isUiLanguage, resolveIntlLocale, resolveLocalization } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';

type CountryFields = {
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  currency: string;
  isoCode: string;
};

type OverrideFields = {
  timezone: string | null;
  defaultLanguage: string | null;
  dateFormat: string | null;
  numberFormat: string | null;
};

const OVERRIDE_SELECT = {
  timezone: true,
  defaultLanguage: true,
  dateFormat: true,
  numberFormat: true,
} satisfies Record<keyof OverrideFields, true>;

function toOverrides(row: OverrideFields | null | undefined): Partial<LocalizationOverrides> | null {
  if (!row) return null;
  return {
    language: isUiLanguage(row.defaultLanguage) ? row.defaultLanguage : null,
    timezone: row.timezone,
    dateFormat: row.dateFormat,
    numberFormat: row.numberFormat,
  };
}

@Injectable()
export class LocaleContextService {
  constructor(private readonly prisma: PrismaService) {}

  async forEmployee(employeeId: string): Promise<LocaleContext> {
    const employee = await this.findEmployee(employeeId);
    const company = employee.workLocation?.company ?? employee.company;
    return this.buildContext(company.country, company, employee.workLocation);
  }

  async forRosterEntry(input: {
    employeeId: string;
    rosterLocationId: string | null;
  }): Promise<LocaleContext> {
    const employee = await this.findEmployee(input.employeeId);

    let rosterLocation: OverrideFields | null = null;
    if (input.rosterLocationId) {
      rosterLocation = await this.prisma.unscoped.location.findFirst({
        where: { id: input.rosterLocationId },
        select: OVERRIDE_SELECT,
      });
    }

    const company = employee.workLocation?.company ?? employee.company;
    const home = employee.workLocation;
    const branch: OverrideFields | null =
      rosterLocation || home
        ? {
            timezone: rosterLocation?.timezone ?? home?.timezone ?? null,
            defaultLanguage: rosterLocation?.defaultLanguage ?? home?.defaultLanguage ?? null,
            dateFormat: rosterLocation?.dateFormat ?? home?.dateFormat ?? null,
            numberFormat: rosterLocation?.numberFormat ?? home?.numberFormat ?? null,
          }
        : null;
    return this.buildContext(company.country, company, branch);
  }

  private async findEmployee(employeeId: string) {
    const companySelect = {
      ...OVERRIDE_SELECT,
      country: { select: this.countrySelect() },
    };
    const employee = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: {
        workLocation: {
          select: { ...OVERRIDE_SELECT, company: { select: companySelect } },
        },
        company: { select: companySelect },
      },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }
    return employee;
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

  /** Branch → company → country (MODULES.md §46). */
  private buildContext(
    country: CountryFields,
    company: OverrideFields,
    branch: OverrideFields | null | undefined,
  ): LocaleContext {
    const { effective } = resolveLocalization({
      country,
      company: toOverrides(company),
      branch: toOverrides(branch),
    });
    return {
      timezone: effective.timezone,
      dateFormat: effective.dateFormat,
      numberFormat: effective.numberFormat,
      currency: country.currency,
      locale: resolveIntlLocale(country.isoCode),
      language: effective.language,
    };
  }
}
