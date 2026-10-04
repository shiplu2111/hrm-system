import { Injectable, NotFoundException } from '@nestjs/common';
import { CountryRuleType, EmploymentStatus } from '@prisma/client';
import {
  RULE_LAYERS,
  type EffectiveDatedRule,
  type RuleLayer,
  type SuperannuationEmployeeException,
  type SuperannuationRuleVersion,
  type SuperannuationSettingsRecord,
  type SuperannuationStateRule,
  type SuperannuationVersionTiming,
} from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import {
  normalizeToDateOnly,
  selectEffectiveRule,
} from '../rule-resolver/effective-date.utils';
import { extractStateCode } from '../rule-resolver/prisma-rule-source.repository';
import { toRecordPayload } from '../rule-resolver/rule-merge.utils';
import { RuleResolverService } from '../rule-resolver/rule-resolver.service';
import { SOCIAL_SECURITY_RULE_TYPE } from './superannuation-payroll.service';
import {
  SUPERANNUATION_FIELDS,
  parseSuperannuationRates,
  superannuationValuesOf,
  toSuperannuationRates,
  traceSuperannuationSettings,
} from './superannuation.utils';

type VersionedRule = EffectiveDatedRule & { stateCode: string | null };

function toDateOnlyString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Read-only view of the `social_security` rule chain for a company — MODULES.md §21.
 * The company default comes from the Rule Resolver; per-employee state and contract
 * overrides are resolved with the same resolver against the rules loaded here.
 */
@Injectable()
export class SuperannuationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly ruleResolver: RuleResolverService,
  ) {}

  async getSettings(
    companyId: string,
    asOfInput?: Date,
  ): Promise<SuperannuationSettingsRecord> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const asOf = normalizeToDateOnly(asOfInput ?? new Date());

    const company = await this.prisma.scoped.company.findFirst({
      where: { id: companyId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        payrollBaseCurrency: true,
        country: {
          select: { id: true, name: true, isoCode: true, currency: true },
        },
      },
    });
    if (!company) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Company not found',
      });
    }

    const ruleType = SOCIAL_SECURITY_RULE_TYPE;
    const db = this.prisma.unscoped;

    const employees = await this.prisma.scoped.employee.findMany({
      where: {
        companyId,
        deletedAt: null,
        employmentStatus: { not: EmploymentStatus.terminated },
      },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        personalInfo: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    const [resolved, globalRows, countryRows, stateRows, companyRows, contractRows] =
      await Promise.all([
        this.ruleResolver.resolveForCompany(companyId, ruleType, asOf),
        db.globalRule.findMany({ where: { ruleType } }),
        db.countryRule.findMany({
          where: {
            countryId: company.country.id,
            ruleType: CountryRuleType.social_security,
          },
        }),
        db.stateProvinceRule.findMany({
          where: { countryId: company.country.id, ruleType },
        }),
        db.companyRule.findMany({
          where: { tenantId: company.tenantId, companyId, ruleType },
        }),
        employees.length
          ? db.employeeContractRule.findMany({
              where: {
                tenantId: company.tenantId,
                ruleType,
                employeeId: { in: employees.map((e) => e.id) },
              },
            })
          : Promise.resolve([]),
      ]);

    const toRule = (
      layer: RuleLayer,
      row: {
        id: string;
        payload: unknown;
        effectiveFrom: Date;
        effectiveTo: Date | null;
      },
      stateCode: string | null = null,
    ): VersionedRule => ({
      id: row.id,
      layer,
      ruleType,
      payload: toRecordPayload(row.payload),
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      stateCode,
    });

    const globalRules = globalRows.map((row) => toRule('global', row));
    const countryRules = countryRows.map((row) => toRule('country', row));
    const stateRules = stateRows.map((row) =>
      toRule('state', row, row.stateCode.toUpperCase()),
    );
    const companyRules = companyRows.map((row) => toRule('company', row));
    const contractRulesByEmployee = new Map<string, VersionedRule[]>();
    for (const row of contractRows) {
      const list = contractRulesByEmployee.get(row.employeeId) ?? [];
      list.push(toRule('employee_contract', row));
      contractRulesByEmployee.set(row.employeeId, list);
    }

    const trace = traceSuperannuationSettings(
      resolved.layers.map((layer) => ({
        layer: layer.layer,
        payload: layer.applied ? layer.payload : null,
      })),
    );

    const employeesWithState = employees.map((employee) => ({
      ...employee,
      stateCode: extractStateCode(employee.personalInfo),
    }));

    const effectiveStateRules: SuperannuationStateRule[] = [];
    for (const stateCode of new Set(stateRules.map((rule) => rule.stateCode))) {
      const current = selectEffectiveRule(
        stateRules.filter((rule) => rule.stateCode === stateCode),
        asOf,
      );
      if (!current || !stateCode) continue;
      effectiveStateRules.push({
        stateCode,
        ruleId: current.id,
        effectiveFrom: toDateOnlyString(current.effectiveFrom),
        effectiveTo: current.effectiveTo
          ? toDateOnlyString(current.effectiveTo)
          : null,
        employeeCount: employeesWithState.filter(
          (employee) => employee.stateCode === stateCode,
        ).length,
        payload: current.payload,
      });
    }
    effectiveStateRules.sort((a, b) => a.stateCode.localeCompare(b.stateCode));

    const baseRules = [...globalRules, ...countryRules, ...companyRules];
    const employeeExceptions: SuperannuationEmployeeException[] = [];

    for (const employee of employeesWithState) {
      const ownState = employee.stateCode
        ? stateRules.filter((rule) => rule.stateCode === employee.stateCode)
        : [];
      const ownContract = contractRulesByEmployee.get(employee.id) ?? [];
      if (ownState.length === 0 && ownContract.length === 0) continue;

      const employeeResolved = this.ruleResolver.resolveFromRules(
        asOf,
        ruleType,
        [...baseRules, ...ownState, ...ownContract],
      );
      const appliedLayers = employeeResolved.layers
        .filter(
          (layer) =>
            layer.applied &&
            (layer.layer === 'state' || layer.layer === 'employee_contract'),
        )
        .map((layer) => layer.layer as 'state' | 'employee_contract');
      if (appliedLayers.length === 0) continue;

      const parsed = parseSuperannuationRates(employeeResolved.payload);
      const rates = toSuperannuationRates(parsed);
      const configured = parsed != null;

      employeeExceptions.push({
        employeeId: employee.id,
        employeeNumber: employee.employeeNumber,
        fullName: `${employee.firstName} ${employee.lastName}`.trim(),
        stateCode: employee.stateCode,
        appliedLayers,
        configured,
        rates,
        differingFields:
          configured === trace.configured
            ? SUPERANNUATION_FIELDS.filter(
                (field) => rates[field] !== trace.rates[field],
              )
            : [...SUPERANNUATION_FIELDS],
      });
    }

    return {
      ruleType: 'social_security',
      asOf: toDateOnlyString(asOf),
      company: {
        id: company.id,
        name: company.name,
        currency: company.payrollBaseCurrency ?? company.country.currency,
      },
      country: company.country,
      configured: trace.configured,
      rates: trace.rates,
      fields: trace.fields,
      layers: resolved.layers.map((layer) => ({
        layer: layer.layer,
        applied: layer.applied,
        ruleId: layer.ruleId,
        effectiveFrom: layer.effectiveFrom
          ? toDateOnlyString(layer.effectiveFrom)
          : null,
        effectiveTo: layer.effectiveTo
          ? toDateOnlyString(layer.effectiveTo)
          : null,
        payload: layer.payload,
      })),
      otherSettings: trace.otherSettings,
      warnings: trace.warnings,
      versions: buildVersionHistory(
        [...globalRules, ...countryRules, ...stateRules, ...companyRules],
        asOf,
      ),
      stateRules: effectiveStateRules,
      employeeExceptions,
      employeeCount: employees.length,
    };
  }
}

/** Every global/country/state/company version, newest first within each layer. */
export function buildVersionHistory(
  rules: VersionedRule[],
  asOf: Date,
): SuperannuationRuleVersion[] {
  const groups = new Map<string, VersionedRule[]>();
  for (const rule of rules) {
    const key = `${rule.layer}:${rule.stateCode ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), rule]);
  }

  const versions: SuperannuationRuleVersion[] = [];
  for (const group of groups.values()) {
    const current = selectEffectiveRule(group, asOf);
    for (const rule of group) {
      versions.push({
        id: rule.id,
        layer: rule.layer as SuperannuationRuleVersion['layer'],
        stateCode: rule.stateCode,
        effectiveFrom: toDateOnlyString(rule.effectiveFrom),
        effectiveTo: rule.effectiveTo
          ? toDateOnlyString(rule.effectiveTo)
          : null,
        timing: versionTiming(rule, current, asOf),
        values: superannuationValuesOf(rule.payload),
        payload: rule.payload,
      });
    }
  }

  const layerOrder = (layer: RuleLayer) => RULE_LAYERS.indexOf(layer);
  return versions.sort(
    (a, b) =>
      layerOrder(a.layer) - layerOrder(b.layer) ||
      (a.stateCode ?? '').localeCompare(b.stateCode ?? '') ||
      b.effectiveFrom.localeCompare(a.effectiveFrom),
  );
}

function versionTiming(
  rule: VersionedRule,
  current: VersionedRule | null,
  asOf: Date,
): SuperannuationVersionTiming {
  if (current?.id === rule.id) return 'current';
  const from = normalizeToDateOnly(rule.effectiveFrom);
  if (from > asOf) return 'upcoming';
  if (rule.effectiveTo && normalizeToDateOnly(rule.effectiveTo) < asOf) {
    return 'past';
  }
  return 'superseded';
}
