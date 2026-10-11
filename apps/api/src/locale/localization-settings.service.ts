import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus } from '@prisma/client';
import {
  LOCALIZATION_FIELDS,
  countryLocalization,
  isUiLanguage,
  isValidTimezone,
  resolveLocalization,
  type BranchLocalizationView,
  type CompanyLocalizationView,
  type LocalizationOverrides,
  type LocalizationSettingsOverview,
  type MyLocalization,
  type UiLanguage,
  type UpdateLocalizationInput,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';

const OVERRIDE_SELECT = {
  timezone: true,
  defaultLanguage: true,
  dateFormat: true,
  numberFormat: true,
} as const;

const COUNTRY_SELECT = {
  name: true,
  isoCode: true,
  timezone: true,
  dateFormat: true,
  numberFormat: true,
} as const;

const COMPANY_SELECT = {
  id: true,
  name: true,
  ...OVERRIDE_SELECT,
  country: { select: COUNTRY_SELECT },
  locations: { orderBy: { name: 'asc' }, select: { id: true, name: true, ...OVERRIDE_SELECT } },
} as const;

type OverrideRow = {
  timezone: string | null;
  defaultLanguage: string | null;
  dateFormat: string | null;
  numberFormat: string | null;
};

const ACTIVE_EMPLOYEE_WHERE = {
  deletedAt: null,
  employmentStatus: { not: EmploymentStatus.terminated },
} as const;

/** Platform-level fallback for users outside any company (e.g. super admins). */
const PLATFORM_DEFAULTS = {
  isoCode: '',
  timezone: 'UTC',
  dateFormat: 'DD/MM/YYYY',
  numberFormat: '1,234.56',
};

function toOverrides(row: OverrideRow): LocalizationOverrides {
  return {
    language: isUiLanguage(row.defaultLanguage) ? row.defaultLanguage : null,
    timezone: row.timezone || null,
    dateFormat: row.dateFormat || null,
    numberFormat: row.numberFormat || null,
  };
}

@Injectable()
export class LocalizationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getOverview(tenantId: string): Promise<LocalizationSettingsOverview> {
    const companies = await this.prisma.unscoped.company.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      select: COMPANY_SELECT,
    });
    const counts = await this.employeeCounts(tenantId);
    return { companies: companies.map((company) => this.toCompanyView(company, counts)) };
  }

  async updateCompany(
    tenantId: string,
    companyId: string,
    input: UpdateLocalizationInput,
    user: AuthenticatedUser,
  ): Promise<CompanyLocalizationView> {
    const data = this.toColumns(input);
    const before = await this.prisma.unscoped.company.findFirst({
      where: { id: companyId, tenantId },
      select: OVERRIDE_SELECT,
    });
    if (!before) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Company not found' });
    }
    await this.prisma.unscoped.company.update({ where: { id: companyId }, data });
    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'update',
      module: 'settings',
      recordId: companyId,
      oldValue: { companyLocalization: toOverrides(before) },
      newValue: { companyLocalization: toOverrides({ ...before, ...data }) },
    });
    return this.companyView(tenantId, companyId);
  }

  async updateBranch(
    tenantId: string,
    locationId: string,
    input: UpdateLocalizationInput,
    user: AuthenticatedUser,
  ): Promise<CompanyLocalizationView> {
    const data = this.toColumns(input);
    const before = await this.prisma.unscoped.location.findFirst({
      where: { id: locationId, company: { tenantId } },
      select: { companyId: true, ...OVERRIDE_SELECT },
    });
    if (!before) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Branch not found' });
    }
    await this.prisma.unscoped.location.update({ where: { id: locationId }, data });
    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'update',
      module: 'settings',
      recordId: locationId,
      oldValue: { branchLocalization: toOverrides(before) },
      newValue: { branchLocalization: toOverrides({ ...before, ...data }) },
    });
    return this.companyView(tenantId, before.companyId);
  }

  /** Branch → company → country, with the user's own language choice on top. */
  async forUser(user: AuthenticatedUser, companyIdHint?: string): Promise<MyLocalization> {
    const userRow = await this.prisma.unscoped.user.findUnique({
      where: { id: user.id },
      select: { preferredLanguage: true },
    });
    const preferredLanguage = isUiLanguage(userRow?.preferredLanguage) ? userRow.preferredLanguage : null;

    const context = await this.userContext(user, companyIdHint);
    const resolved = context
      ? resolveLocalization({
          country: context.company.country,
          company: toOverrides(context.company),
          branch: context.branch ? toOverrides(context.branch) : null,
        })
      : resolveLocalization({ country: PLATFORM_DEFAULTS });

    return {
      ...resolved.effective,
      language: preferredLanguage ?? resolved.effective.language,
      preferredLanguage,
      organizationLanguage: resolved.effective.language,
      languageSource: preferredLanguage ? 'user' : resolved.sources.language,
      sources: resolved.sources,
      companyId: context?.company.id ?? null,
      companyName: context?.company.name ?? null,
      branchName: context?.branch?.name ?? null,
    };
  }

  async setPreferredLanguage(
    user: AuthenticatedUser,
    language: UiLanguage | null | undefined,
    companyIdHint?: string,
  ): Promise<MyLocalization> {
    if (language === undefined) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Send a language code, or null to follow the organization default',
      });
    }
    await this.prisma.unscoped.user.update({
      where: { id: user.id },
      data: { preferredLanguage: language },
    });
    return this.forUser(user, companyIdHint);
  }

  private async userContext(user: AuthenticatedUser, companyIdHint?: string) {
    const companySelect = {
      id: true,
      name: true,
      ...OVERRIDE_SELECT,
      country: { select: COUNTRY_SELECT },
    } as const;

    if (user.employeeId) {
      const employee = await this.prisma.unscoped.employee.findFirst({
        where: { id: user.employeeId, deletedAt: null },
        select: {
          company: { select: companySelect },
          workLocation: {
            select: { id: true, name: true, ...OVERRIDE_SELECT, company: { select: companySelect } },
          },
        },
      });
      if (employee) {
        return {
          company: employee.workLocation?.company ?? employee.company,
          branch: employee.workLocation,
        };
      }
    }

    if (!user.tenantId) return null;
    const company =
      (companyIdHint
        ? await this.prisma.unscoped.company.findFirst({
            where: { id: companyIdHint, tenantId: user.tenantId },
            select: companySelect,
          })
        : null) ??
      (await this.prisma.unscoped.company.findFirst({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: 'asc' },
        select: companySelect,
      }));
    return company ? { company, branch: null } : null;
  }

  private toColumns(input: UpdateLocalizationInput): Partial<OverrideRow> {
    const data: Partial<OverrideRow> = {};
    if (input.language !== undefined) data.defaultLanguage = input.language;
    if (input.dateFormat !== undefined) data.dateFormat = input.dateFormat;
    if (input.numberFormat !== undefined) data.numberFormat = input.numberFormat;
    if (input.timezone !== undefined) {
      const timezone = input.timezone?.trim() || null;
      if (timezone && !isValidTimezone(timezone)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `"${timezone}" is not a valid IANA timezone (e.g. Asia/Dhaka)`,
        });
      }
      data.timezone = timezone;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Send at least one of ${LOCALIZATION_FIELDS.join(', ')}`,
      });
    }
    return data;
  }

  private async companyView(tenantId: string, companyId: string): Promise<CompanyLocalizationView> {
    const company = await this.prisma.unscoped.company.findFirstOrThrow({
      where: { id: companyId, tenantId },
      select: COMPANY_SELECT,
    });
    return this.toCompanyView(company, await this.employeeCounts(tenantId, companyId));
  }

  private async employeeCounts(tenantId: string, companyId?: string) {
    const rows = await this.prisma.unscoped.employee.groupBy({
      by: ['companyId', 'workLocationId'],
      where: { tenantId, ...(companyId ? { companyId } : {}), ...ACTIVE_EMPLOYEE_WHERE },
      _count: { _all: true },
    });
    const byCompany = new Map<string, number>();
    const byLocation = new Map<string, number>();
    for (const row of rows) {
      byCompany.set(row.companyId, (byCompany.get(row.companyId) ?? 0) + row._count._all);
      if (row.workLocationId) {
        byLocation.set(row.workLocationId, (byLocation.get(row.workLocationId) ?? 0) + row._count._all);
      }
    }
    return { byCompany, byLocation };
  }

  private toCompanyView(
    company: {
      id: string;
      name: string;
      country: { name: string; isoCode: string; timezone: string; dateFormat: string; numberFormat: string };
      locations: Array<{ id: string; name: string } & OverrideRow>;
    } & OverrideRow,
    counts: { byCompany: Map<string, number>; byLocation: Map<string, number> },
  ): CompanyLocalizationView {
    const companyOverrides = toOverrides(company);
    const resolved = resolveLocalization({ country: company.country, company: companyOverrides });
    const branches: BranchLocalizationView[] = company.locations.map((location) => {
      const overrides = toOverrides(location);
      const branchResolved = resolveLocalization({
        country: company.country,
        company: companyOverrides,
        branch: overrides,
      });
      return {
        locationId: location.id,
        name: location.name,
        employeeCount: counts.byLocation.get(location.id) ?? 0,
        overrides,
        effective: branchResolved.effective,
        sources: branchResolved.sources,
      };
    });
    return {
      companyId: company.id,
      companyName: company.name,
      countryName: company.country.name,
      countryIsoCode: company.country.isoCode,
      countryDefaults: countryLocalization(company.country),
      overrides: companyOverrides,
      effective: resolved.effective,
      sources: resolved.sources,
      employeeCount: counts.byCompany.get(company.id) ?? 0,
      branches,
    };
  }
}