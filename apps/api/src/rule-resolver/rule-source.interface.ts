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

export interface CompanyRuleContext {
  tenantId: string;
  companyId: string;
  countryId: string;
}

export interface EmployeeRuleContext extends CompanyRuleContext {
  employeeId: string;
  stateCode: string | null;
}

export interface EmployeeContextPort {
  loadEmployeeContext(employeeId: string): Promise<EmployeeRuleContext | null>;
  loadCompanyContext(companyId: string): Promise<CompanyRuleContext | null>;
}
