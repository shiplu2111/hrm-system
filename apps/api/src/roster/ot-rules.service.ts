import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type PayrollRule } from '@prisma/client';
import type { OvertimeRuleConfig, OvertimeRuleRecord } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type { CreateOtRuleDto } from './dto/ot-rules.dto';
import { formatDateValue, parseDateString } from './roster.utils';

export const OVERTIME_RULE_KIND = 'overtime';

@Injectable()
export class OtRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
  ) {}

  /** Company rules plus country defaults that are in effect today or later. */
  async list(companyId: string): Promise<OvertimeRuleRecord[]> {
    const company = await this.findCompanyOrThrow(companyId);
    const today = parseDateString(formatDateValue(new Date()));

    const rows = await this.prisma.unscoped.payrollRule.findMany({
      where: {
        OR: [{ companyId }, { companyId: null, countryId: company.countryId }],
        ruleJson: { path: ['kind'], equals: OVERTIME_RULE_KIND },
        AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }] }],
      },
      orderBy: [{ companyId: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }],
    });

    return rows.map((row) => this.toRecord(row));
  }

  async create(companyId: string, dto: CreateOtRuleDto): Promise<OvertimeRuleRecord> {
    await this.findCompanyOrThrow(companyId);

    const name = dto.name.trim();
    const existing = await this.list(companyId);
    if (
      existing.some(
        (rule) => rule.scope === 'company' && rule.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `An overtime rule named "${name}" already exists`,
      });
    }

    const ruleJson: OvertimeRuleConfig = {
      kind: OVERTIME_RULE_KIND,
      name,
      dailyThresholdMinutes: dto.dailyThresholdMinutes ?? null,
      maxDailyMinutes: dto.maxDailyMinutes ?? null,
      multipliers: {
        weekday: dto.multipliers.weekday,
        ...(dto.multipliers.weekend != null ? { weekend: dto.multipliers.weekend } : {}),
        ...(dto.multipliers.publicHoliday != null
          ? { publicHoliday: dto.multipliers.publicHoliday }
          : {}),
      },
    };

    const row = await this.prisma.unscoped.payrollRule.create({
      data: {
        companyId,
        ruleJson: ruleJson as unknown as Prisma.InputJsonValue,
        effectiveFrom: dto.effectiveFrom
          ? parseDateString(dto.effectiveFrom)
          : parseDateString(formatDateValue(new Date())),
      },
    });
    return this.toRecord(row);
  }

  private async findCompanyOrThrow(companyId: string) {
    await this.companyScope.assertCompanyInTenant(companyId);
    const company = await this.prisma.unscoped.company.findUnique({
      where: { id: companyId },
      select: { countryId: true },
    });
    if (!company) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Company not found' });
    }
    return company;
  }

  private toRecord(row: PayrollRule): OvertimeRuleRecord {
    const json = (row.ruleJson ?? {}) as Partial<OvertimeRuleConfig>;
    return {
      id: row.id,
      scope: row.companyId ? 'company' : 'country',
      companyId: row.companyId,
      countryId: row.countryId,
      name: json.name ?? 'Overtime rule',
      dailyThresholdMinutes: json.dailyThresholdMinutes ?? null,
      maxDailyMinutes: json.maxDailyMinutes ?? null,
      multipliers: {
        weekday: json.multipliers?.weekday ?? 1,
        ...(json.multipliers?.weekend != null ? { weekend: json.multipliers.weekend } : {}),
        ...(json.multipliers?.publicHoliday != null
          ? { publicHoliday: json.multipliers.publicHoliday }
          : {}),
      },
      effectiveFrom: formatDateValue(row.effectiveFrom),
      effectiveTo: row.effectiveTo ? formatDateValue(row.effectiveTo) : null,
    };
  }
}
