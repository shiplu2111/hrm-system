import { Injectable } from '@nestjs/common';
import type {
  HealthSafetyCountryRequirements,
  HealthSafetyRuleLayerSummary,
} from '@hrm/shared-types';
import { RuleResolverService } from '../rule-resolver/rule-resolver.service';
import {
  HEALTH_SAFETY_RULE_TYPE,
  buildIncidentReportingConfig,
  parseHealthSafetyRules,
  type HealthSafetyRulePayload,
} from './health-safety.utils';

@Injectable()
export class HealthSafetyRulesService {
  constructor(private readonly ruleResolver: RuleResolverService) {}

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

  async resolveWithMetadataForEmployee(
    employeeId: string,
    asOf: Date,
  ): Promise<{
    rules: HealthSafetyRulePayload;
    layers: HealthSafetyRuleLayerSummary[];
  }> {
    const resolved = await this.ruleResolver.resolveForEmployee(
      employeeId,
      HEALTH_SAFETY_RULE_TYPE,
      asOf,
    );
    return {
      rules: parseHealthSafetyRules(resolved.payload),
      layers: resolved.layers.map((layer) => ({
        layer: layer.layer,
        applied: layer.applied,
        ruleId: layer.ruleId,
      })),
    };
  }

  async resolveWithMetadataForCompany(
    companyId: string,
    asOf = new Date(),
  ): Promise<{
    rules: HealthSafetyRulePayload;
    layers: HealthSafetyRuleLayerSummary[];
  }> {
    const resolved = await this.ruleResolver.resolveForCompany(
      companyId,
      HEALTH_SAFETY_RULE_TYPE,
      asOf,
    );
    return {
      rules: parseHealthSafetyRules(resolved.payload),
      layers: resolved.layers.map((layer) => ({
        layer: layer.layer,
        applied: layer.applied,
        ruleId: layer.ruleId,
      })),
    };
  }

  async getCountryRequirementsForEmployee(
    employeeId: string,
    asOf = new Date(),
  ): Promise<HealthSafetyCountryRequirements> {
    const { rules, layers } = await this.resolveWithMetadataForEmployee(employeeId, asOf);
    return this.toCountryRequirements(rules, layers, asOf);
  }

  async getRequirementsForCompany(
    companyId: string,
    options?: { employeeId?: string; asOf?: Date },
  ): Promise<HealthSafetyCountryRequirements> {
    const asOf = options?.asOf ?? new Date();
    if (options?.employeeId) {
      return this.getCountryRequirementsForEmployee(options.employeeId, asOf);
    }
    const { rules, layers } = await this.resolveWithMetadataForCompany(companyId, asOf);
    return this.toCountryRequirements(rules, layers, asOf);
  }

  private toCountryRequirements(
    rules: HealthSafetyRulePayload,
    layers: HealthSafetyRuleLayerSummary[],
    asOf: Date,
  ): HealthSafetyCountryRequirements {
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
      incidentReporting: buildIncidentReportingConfig(rules, layers, asOf),
    };
  }
}
