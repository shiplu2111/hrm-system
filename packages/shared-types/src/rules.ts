/** Rule Resolver types — ARCHITECTURE.md §3, RULES.md §2 */

export const RULE_LAYERS = [
  'global',
  'country',
  'state',
  'company',
  'employee_contract',
] as const;

export type RuleLayer = (typeof RULE_LAYERS)[number];

export interface RuleResolutionContext {
  tenantId: string;
  companyId: string;
  employeeId: string;
  countryId: string;
  /** ISO-style subdivision code, e.g. NSW, CA, DHAKA */
  stateCode?: string | null;
  calculationDate: Date;
}

export interface EffectiveDatedRule<TPayload = Record<string, unknown>> {
  id: string;
  layer: RuleLayer;
  ruleType: string;
  payload: TPayload;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

export interface ResolvedRuleLayerTrace {
  layer: RuleLayer;
  applied: boolean;
  ruleId: string | null;
  payload: Record<string, unknown> | null;
}

export interface ResolvedRule {
  ruleType: string;
  calculationDate: Date;
  /** Deep-merged payload from Global → … → Employee Contract */
  payload: Record<string, unknown>;
  layers: ResolvedRuleLayerTrace[];
}
