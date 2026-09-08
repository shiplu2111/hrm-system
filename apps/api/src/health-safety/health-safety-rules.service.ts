import { Injectable } from '@nestjs/common';
import type { HealthSafetyCountryRequirements } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { RuleResolverService } from '../rule-resolver/rule-resolver.service';
import {
  HEALTH_SAFETY_RULE_TYPE,
  parseHealthSafetyRules,
  type HealthSafetyRulePayload,
} from './health-safety.utils';

@Injectable()
export class HealthSafetyRulesService {
  constructor(
    private readonly ruleResolver: RuleResolverService,
    private readonly prisma: PrismaService,
  ) {}

  async resolveForEmployee(
    employeeId: string,
    asOf: Date,
  ): Promise<HealthSafetyRulePayload> {
    const resolved = await this.ruleResolver.resolveForEmployee(
      employeeId,
      HEALTH_SAFETY_RULE_TYPE,
      asOf,
    );
    return parseHealthSafetyRules(resolved.payload);
  }

  async getCountryRequirementsForEmployee(
    employeeId: string,
    asOf = new Date(),
  ): Promise<HealthSafetyCountryRequirements> {
    const rules = await this.resolveForEmployee(employeeId, asOf);

    return {
      regulatorName: rules.incidentReporting?.regulatorName ?? null,
      complianceRequirements:
        rules.complianceRequirements?.map((item) => ({
          key: item.key,
          title: item.title,
          type: item.type,
          renewalMonths: item.renewalMonths,
          frequencyDays: item.frequencyDays,
        })) ?? [],
      injuryLogRequireBodyPart: rules.injuryLog?.requireBodyPart ?? false,
    };
  }

  async getRequirementsForCompany(
    companyId: string,
  ): Promise<HealthSafetyCountryRequirements> {
    const employee = await this.prisma.unscoped.employee.findFirst({
      where: { companyId, deletedAt: null, employmentStatus: 'active' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!employee) {
      return {
        regulatorName: null,
        complianceRequirements: [],
        injuryLogRequireBodyPart: false,
      };
    }

    return this.getCountryRequirementsForEmployee(employee.id);
  }
}
