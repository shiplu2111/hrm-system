import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  normalizeWorkingHoursOtPayload,
  normalizeEmploymentTerminationPayload,
  type EffectiveDatedRule,
  type ResolvedRule,
  type RuleLayer,
  type RuleResolutionContext,
  type WorkingHoursOtRulePayload,
  type EmploymentTerminationRulePayload,
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
    if (!context.employeeId) {
      rules = rules.filter((rule) => rule.layer !== 'employee_contract');
    }

    return this.buildResolvedRule(context.calculationDate, ruleType, rules);
  }

  /**
   * Resolve the company default: Global → Country → (State, when given) → Company.
   * The employee contract layer never applies because no employee is involved.
   */
  async resolveForCompany(
    companyId: string,
    ruleType: string,
    calculationDate: Date,
    options?: { stateCode?: string | null },
  ): Promise<ResolvedRule> {
    const company = await this.employeeContext.loadCompanyContext(companyId);

    if (!company) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Company not found',
      });
    }

    return this.resolve(
      {
        tenantId: company.tenantId,
        companyId: company.companyId,
        employeeId: null,
        countryId: company.countryId,
        stateCode: options?.stateCode ?? null,
        calculationDate,
      },
      ruleType,
    );
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
        effectiveFrom: rule?.effectiveFrom ?? null,
        effectiveTo: rule?.effectiveTo ?? null,
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

  /**
   * Resolves Working Hours & Overtime rules across the resolution chain:
   * Global -> Country -> State -> Company -> Employee Contract.
   * Merges and normalizes the payload into WorkingHoursOtRulePayload.
   * Conforms to ATTENDANCE_LOGIC.md §4 and PAYROLL_LOGIC.md §9.
   */
  async resolveWorkingHoursAndOvertime(
    context: RuleResolutionContext,
  ): Promise<{ resolved: ResolvedRule; config: WorkingHoursOtRulePayload }> {
    const otResolved = await this.resolve(context, 'ot');
    let combinedPayload = { ...otResolved.payload };
    try {
      const whResolved = await this.resolve(context, 'working_hours');
      if (whResolved && Object.keys(whResolved.payload).length > 0) {
        combinedPayload = { ...whResolved.payload, ...otResolved.payload };
      }
    } catch {
      // Ignore if working_hours doesn't exist
    }

    const config = normalizeWorkingHoursOtPayload(combinedPayload);
    return {
      resolved: {
        ...otResolved,
        payload: combinedPayload,
      },
      config,
    };
  }

  async resolveWorkingHoursAndOvertimeForCompany(
    companyId: string,
    calculationDate: Date,
    options?: { stateCode?: string | null },
  ): Promise<{ resolved: ResolvedRule; config: WorkingHoursOtRulePayload }> {
    const company = await this.employeeContext.loadCompanyContext(companyId);
    if (!company) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Company not found',
      });
    }

    return this.resolveWorkingHoursAndOvertime({
      tenantId: company.tenantId,
      companyId: company.companyId,
      employeeId: null,
      countryId: company.countryId,
      stateCode: options?.stateCode ?? null,
      calculationDate,
    });
  }

  async resolveWorkingHoursAndOvertimeForEmployee(
    employeeId: string,
    calculationDate: Date,
    overrides?: Partial<Pick<RuleResolutionContext, 'stateCode' | 'calculationDate'>>,
  ): Promise<{ resolved: ResolvedRule; config: WorkingHoursOtRulePayload }> {
    const employee = await this.employeeContext.loadEmployeeContext(employeeId);
    if (!employee) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    return this.resolveWorkingHoursAndOvertime({
      tenantId: employee.tenantId,
      companyId: employee.companyId,
      employeeId: employee.employeeId,
      countryId: employee.countryId,
      stateCode: overrides?.stateCode ?? employee.stateCode,
      calculationDate: overrides?.calculationDate ?? calculationDate,
    });
  }

  /**
   * Resolves Employment & Termination rules across the resolution chain:
   * Global -> Country -> State -> Company -> Employee Contract.
   * Merges and normalizes the payload into EmploymentTerminationRulePayload.
   * Conforms to PAYROLL_LOGIC.md §5 and MODULES.md §32.
   */
  async resolveEmploymentAndTermination(
    context: RuleResolutionContext,
  ): Promise<{ resolved: ResolvedRule; config: EmploymentTerminationRulePayload }> {
    const resolved = await this.resolve(context, 'employment_rules');
    const config = normalizeEmploymentTerminationPayload(resolved.payload);
    return {
      resolved,
      config,
    };
  }

  async resolveEmploymentAndTerminationForCompany(
    companyId: string,
    calculationDate: Date,
    options?: { stateCode?: string | null },
  ): Promise<{ resolved: ResolvedRule; config: EmploymentTerminationRulePayload }> {
    const company = await this.employeeContext.loadCompanyContext(companyId);
    if (!company) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Company not found',
      });
    }

    return this.resolveEmploymentAndTermination({
      tenantId: company.tenantId,
      companyId: company.companyId,
      employeeId: null,
      countryId: company.countryId,
      stateCode: options?.stateCode ?? null,
      calculationDate,
    });
  }

  async resolveEmploymentAndTerminationForEmployee(
    employeeId: string,
    calculationDate: Date,
    overrides?: Partial<Pick<RuleResolutionContext, 'stateCode' | 'calculationDate'>>,
  ): Promise<{ resolved: ResolvedRule; config: EmploymentTerminationRulePayload }> {
    const employee = await this.employeeContext.loadEmployeeContext(employeeId);
    if (!employee) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    return this.resolveEmploymentAndTermination({
      tenantId: employee.tenantId,
      companyId: employee.companyId,
      employeeId: employee.employeeId,
      countryId: employee.countryId,
      stateCode: overrides?.stateCode ?? employee.stateCode,
      calculationDate: overrides?.calculationDate ?? calculationDate,
    });
  }
}

export type { RuleLayer, RuleResolutionContext, ResolvedRule };
