import type {
  EffectiveDatedRule,
  RuleResolutionContext,
} from '@hrm/shared-types';

export interface RuleSourcePort {
  fetchRules(
    context: RuleResolutionContext,
    ruleType: string,
  ): Promise<EffectiveDatedRule[]>;
}

export interface EmployeeRuleContext {
  tenantId: string;
  companyId: string;
  employeeId: string;
  countryId: string;
  stateCode: string | null;
}

export interface EmployeeContextPort {
  loadEmployeeContext(employeeId: string): Promise<EmployeeRuleContext | null>;
}
