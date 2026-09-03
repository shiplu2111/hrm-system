import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  EffectiveDatedRule,
  ResolvedRule,
  RuleLayer,
  RuleResolutionContext,
} from '@hrm/shared-types';
import { selectEffectiveRule } from './effective-date.utils';
import { mergeRulePayloads } from './rule-merge.utils';
import {
  EMPLOYEE_CONTEXT,
  RULE_LAYER_ORDER,
  RULE_SOURCE,
} from './rule-resolver.constants';
import type {
  EmployeeContextPort,
  RuleSourcePort,
} from './rule-source.interface';

@Injectable()
export class RuleResolverService {
  constructor(
    @Inject(RULE_SOURCE)
    private readonly ruleSource: RuleSourcePort,
    @Inject(EMPLOYEE_CONTEXT)
    private readonly employeeContext: EmployeeContextPort,
  ) {}

  /**
   * Resolve the effective rule for a known tenant/company/employee context and date.
   * Walks Global → Country → State → Company → Employee Contract (ARCHITECTURE.md §3).
   */
  async resolve(
    context: RuleResolutionContext,
    ruleType: string,
  ): Promise<ResolvedRule> {
    let rules = await this.ruleSource.fetchRules(context, ruleType);

    if (!context.stateCode) {
      rules = rules.filter((rule) => rule.layer !== 'state');
    }

    return this.buildResolvedRule(context.calculationDate, ruleType, rules);
  }

  /** Convenience wrapper that loads employee → company → country context from the database. */
  async resolveForEmployee(
    employeeId: string,
    ruleType: string,
    calculationDate: Date,
    overrides?: Partial<
      Pick<RuleResolutionContext, 'stateCode' | 'calculationDate'>
    >,
  ): Promise<ResolvedRule> {
    const employee = await this.employeeContext.loadEmployeeContext(employeeId);

    if (!employee) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    const context: RuleResolutionContext = {
      tenantId: employee.tenantId,
      companyId: employee.companyId,
      employeeId: employee.employeeId,
      countryId: employee.countryId,
      stateCode: overrides?.stateCode ?? employee.stateCode,
      calculationDate: overrides?.calculationDate ?? calculationDate,
    };

    return this.resolve(context, ruleType);
  }

  private buildResolvedRule(
    calculationDate: Date,
    ruleType: string,
    rules: EffectiveDatedRule[],
  ): ResolvedRule {
    const layerRules = RULE_LAYER_ORDER.map((layer) =>
      selectEffectiveRule(
        rules.filter((rule) => rule.layer === layer),
        calculationDate,
      ),
    );

    const layers = RULE_LAYER_ORDER.map((layer, index) => {
      const rule = layerRules[index];

      return {
        layer,
        applied: rule != null,
        ruleId: rule?.id ?? null,
        payload: rule?.payload ?? null,
      };
    });

    const payload = mergeRulePayloads(
      layerRules.map((rule) => rule?.payload ?? null),
    );

    return {
      ruleType,
      calculationDate,
      payload,
      layers,
    };
  }

  /** Exposed for unit tests — pure resolution without I/O. */
  resolveFromRules(
    calculationDate: Date,
    ruleType: string,
    rules: EffectiveDatedRule[],
  ): ResolvedRule {
    return this.buildResolvedRule(calculationDate, ruleType, rules);
  }
}

export type { RuleLayer, RuleResolutionContext, ResolvedRule };
