import { Injectable } from '@nestjs/common';
import { CountryRuleType } from '@prisma/client';
import type {
  EffectiveDatedRule,
  RuleLayer,
  RuleResolutionContext,
} from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { toRecordPayload } from './rule-merge.utils';
import type {
  EmployeeContextPort,
  EmployeeRuleContext,
  RuleSourcePort,
} from './rule-source.interface';

function extractStateCode(personalInfo: unknown): string | null {
  if (typeof personalInfo !== 'object' || personalInfo === null) {
    return null;
  }

  const record = personalInfo as Record<string, unknown>;
  const candidate =
    record.stateCode ?? record.state ?? record.stateProvince ?? record.province;

  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    return null;
  }

  return candidate.trim().toUpperCase();
}

@Injectable()
export class PrismaRuleSourceRepository implements RuleSourcePort {
  constructor(private readonly prisma: PrismaService) {}

  async fetchRules(
    context: RuleResolutionContext,
    ruleType: string,
  ): Promise<EffectiveDatedRule[]> {
    const db = this.prisma.unscoped;
    const countryRuleType = this.toCountryRuleType(ruleType);

    const [
      globalRules,
      countryRules,
      stateRules,
      companyRules,
      contractRules,
    ] = await Promise.all([
      db.globalRule.findMany({ where: { ruleType } }),
      countryRuleType
        ? db.countryRule.findMany({
            where: {
              countryId: context.countryId,
              ruleType: countryRuleType,
            },
          })
        : Promise.resolve([]),
      context.stateCode
        ? db.stateProvinceRule.findMany({
            where: {
              countryId: context.countryId,
              stateCode: context.stateCode,
              ruleType,
            },
          })
        : Promise.resolve([]),
      db.companyRule.findMany({
        where: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          ruleType,
        },
      }),
      db.employeeContractRule.findMany({
        where: {
          tenantId: context.tenantId,
          employeeId: context.employeeId,
          ruleType,
        },
      }),
    ]);

    return [
      ...globalRules.map((rule) =>
        this.toEffectiveRule('global', ruleType, rule),
      ),
      ...countryRules.map((rule) =>
        this.toEffectiveRule('country', ruleType, rule),
      ),
      ...stateRules.map((rule) =>
        this.toEffectiveRule('state', ruleType, rule),
      ),
      ...companyRules.map((rule) =>
        this.toEffectiveRule('company', ruleType, rule),
      ),
      ...contractRules.map((rule) =>
        this.toEffectiveRule('employee_contract', ruleType, rule),
      ),
    ];
  }

  private toEffectiveRule(
    layer: RuleLayer,
    ruleType: string,
    rule: {
      id: string;
      payload: unknown;
      effectiveFrom: Date;
      effectiveTo: Date | null;
    },
  ): EffectiveDatedRule {
    return {
      id: rule.id,
      layer,
      ruleType,
      payload: toRecordPayload(rule.payload),
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
    };
  }

  private toCountryRuleType(ruleType: string): CountryRuleType | null {
    const values = Object.values(CountryRuleType) as string[];
    return values.includes(ruleType)
      ? (ruleType as CountryRuleType)
      : null;
  }
}

@Injectable()
export class PrismaEmployeeContextRepository implements EmployeeContextPort {
  constructor(private readonly prisma: PrismaService) {}

  async loadEmployeeContext(
    employeeId: string,
  ): Promise<EmployeeRuleContext | null> {
    const employee = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: {
        id: true,
        tenantId: true,
        companyId: true,
        personalInfo: true,
        company: { select: { countryId: true } },
      },
    });

    if (!employee) {
      return null;
    }

    return {
      tenantId: employee.tenantId,
      companyId: employee.companyId,
      employeeId: employee.id,
      countryId: employee.company.countryId,
      stateCode: extractStateCode(employee.personalInfo),
    };
  }
}
