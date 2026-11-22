import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CountryRuleType } from '@prisma/client';
import type {
  CountryRuleKind,
  FilingStatusTaxConfig,
  PublicHolidayRulePayload,
  RuleSandboxContributionItem,
  RuleSandboxContributionsBreakdown,
  RuleSandboxDraftCandidate,
  RuleSandboxGrossBreakdown,
  RuleSandboxLeaveDeductionLine,
  RuleSandboxOvertimeCapBreach,
  RuleSandboxOvertimeLine,
  RuleSandboxResolvedCategory,
  RuleSandboxResolvedLayer,
  RuleSandboxSimulationInput,
  RuleSandboxSimulationResult,
  RuleSandboxSubFundContribution,
  RuleSandboxSummary,
  RuleSandboxTaxBracketStep,
  RuleSandboxTaxBreakdown,
  SocialSecurityRulePayload,
  StatutoryFundItem,
  TaxBracketRow,
  TaxRebateAllowance,
  TaxRulePayload,
  WorkingHoursOtRulePayload,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { selectEffectiveRule } from '../../rule-resolver/effective-date.utils';

const STATUTORY_CATEGORIES: { type: CountryRuleType; label: string }[] = [
  { type: 'tax', label: 'Income Tax & Brackets' },
  { type: 'social_security', label: 'Social Security' },
  { type: 'pension', label: 'Pension & Superannuation' },
  { type: 'ot', label: 'Working Hours & Overtime' },
  { type: 'leave', label: 'Statutory Leave Entitlements' },
  { type: 'public_holiday', label: 'Public Holidays' },
];

@Injectable()
export class RuleSandboxService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run the full Rule Resolver and payroll calculation simulation without saving anything.
   * Completely deterministic, zero-mutation calculation per RULES.md §1-3 and PAYROLL_LOGIC.md §2, §8, §9, §10.
   */
  async simulate(input: RuleSandboxSimulationInput): Promise<RuleSandboxSimulationResult> {
    const { countryId, stateProvinceId, calculationDate, draftRuleVersionId, employeeProfile } =
      input;

    // 1. Fetch Country
    const country = await this.prisma.unscoped.country.findUnique({
      where: { id: countryId },
      select: {
        id: true,
        name: true,
        isoCode: true,
        currency: true,
      },
    });

    if (!country) {
      throw new NotFoundException({
        code: 'COUNTRY_NOT_FOUND',
        message: 'Country jurisdiction not found for sandbox simulation',
      });
    }

    // Optional State/Province
    let stateProvinceName: string | null = null;
    let stateCode: string | null = null;
    if (stateProvinceId) {
      const state = await this.prisma.unscoped.stateProvince.findFirst({
        where: { id: stateProvinceId, countryId },
        select: { id: true, name: true, code: true },
      });
      if (state) {
        stateProvinceName = state.name;
        stateCode = state.code;
      }
    }

    const calcDate = new Date(`${calculationDate}T00:00:00.000Z`);
    if (isNaN(calcDate.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_DATE',
        message: 'Invalid calculation date format (must be YYYY-MM-DD)',
      });
    }

    // 2. Fetch tested draft version if specified
    let draftOverrideRule: any | null = null;
    if (draftRuleVersionId) {
      draftOverrideRule = await this.prisma.unscoped.countryRule.findFirst({
        where: { id: draftRuleVersionId, countryId },
        include: {
          stateProvince: { select: { id: true, code: true, name: true } },
        },
      });
    }

    // 3. Resolve rules for all statutory categories across resolution layers
    const resolvedCategories: Record<string, RuleSandboxResolvedCategory> = {};

    for (const cat of STATUTORY_CATEGORIES) {
      resolvedCategories[cat.type] = await this.resolveCategoryForSandbox(
        countryId,
        stateProvinceId ?? null,
        stateCode,
        cat.type,
        cat.label,
        calcDate,
        draftOverrideRule,
      );
    }

    // 4. Compute Gross Earnings & Overtime breakdown
    const gross = this.computeGrossEarnings(employeeProfile, resolvedCategories['ot']?.mergedPayload);

    // 5. Compute Statutory Contributions (Social Security & Pension/Superannuation)
    const contributions = this.computeContributions(
      employeeProfile,
      gross.totalGrossPay,
      resolvedCategories['social_security']?.mergedPayload,
      resolvedCategories['pension']?.mergedPayload,
    );

    // 6. Compute Progressive Income Tax with Brackets
    const taxableIncomeForTax = Math.max(
      0,
      gross.totalGrossPay - contributions.totalPreTaxDeductions,
    );
    const tax = this.computeTax(
      taxableIncomeForTax,
      employeeProfile,
      resolvedCategories['tax']?.mergedPayload,
    );

    // 7. Summarize Net Pay & Employer Total Cost
    const totalDeductions = Math.round((tax.periodTaxDeduction + contributions.totalEmployeeContributions) * 100) / 100;
    const netPay = Math.round((gross.totalGrossPay - totalDeductions) * 100) / 100;
    const totalEmployerCost =
      Math.round((gross.totalGrossPay + contributions.totalEmployerContributions) * 100) / 100;
    const netToGrossRatio =
      gross.totalGrossPay > 0
        ? Math.round((netPay / gross.totalGrossPay) * 10000) / 100
        : 0;

    const summary: RuleSandboxSummary = {
      grossEarnings: gross.totalGrossPay,
      totalDeductions,
      netPay,
      totalEmployerContributions: contributions.totalEmployerContributions,
      totalEmployerCost,
      netToGrossRatio,
      effectiveTaxRate: tax.effectiveTaxRate,
    };

    const isDraftTest = !!draftOverrideRule;

    const resolutionChainOverview = [
      {
        level: '1. Global Default',
        status: 'Active Baseline',
        description: 'Built-in statutory labor fallback defaults applied across all platform tenants.',
      },
      {
        level: '2. Country Jurisdiction',
        status: isDraftTest ? 'Draft Override Active' : 'Statutory Match',
        description: `${country.name} (${country.isoCode}) statutory rules resolved for calculation date ${calculationDate}.`,
      },
      {
        level: '3. State / Province Rule',
        status: stateProvinceName ? 'Regional Scope' : 'National Scope',
        description: stateProvinceName
          ? `Subdivision ${stateProvinceName} (${stateCode}) specific statutory regulations evaluated.`
          : 'National federal rules applied uniformly.',
      },
      {
        level: '4. Company Policy',
        status: 'Sample Policy',
        description: 'Standard company pay frequencies, payroll schedule, and standard working week policy.',
      },
      {
        level: '5. Employee Contract',
        status: 'Sample Profile',
        description: `Contracted base salary of ${country.currency} ${employeeProfile.baseSalary.toLocaleString()} with simulated attendance.`,
      },
    ];

    return {
      countryId: country.id,
      countryName: country.name,
      countryCode: country.isoCode,
      currency: country.currency || 'USD',
      stateProvinceId: stateProvinceId ?? null,
      stateProvinceName,
      calculationDate,
      testedDraftVersionId: draftOverrideRule ? draftOverrideRule.id : null,
      isDraftTest,
      resolvedCategories,
      resolutionChainOverview,
      gross,
      tax,
      contributions,
      summary,
    };
  }

  /**
   * Retrieves unpublished rule versions ('draft' or 'pending_approval') for a country
   * so platform staff can test them in the sandbox before publishing.
   */
  async getDraftCandidates(
    countryId: string,
    stateProvinceId?: string | null,
  ): Promise<RuleSandboxDraftCandidate[]> {
    const where: any = {
      countryId,
      status: { in: ['draft', 'pending_approval'] },
    };

    if (stateProvinceId !== undefined) {
      where.stateProvinceId = stateProvinceId;
    }

    const rules = await this.prisma.unscoped.countryRule.findMany({
      where,
      include: {
        stateProvince: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ ruleType: 'asc' }, { version: 'desc' }],
    });

    return rules.map((r) => {
      const cat = STATUTORY_CATEGORIES.find((c) => c.type === r.ruleType);
      return {
        id: r.id,
        ruleType: r.ruleType as CountryRuleKind,
        ruleTypeLabel: cat ? cat.label : r.ruleType,
        version: r.version,
        status: r.status as any,
        effectiveFrom: r.effectiveFrom.toISOString().slice(0, 10),
        effectiveTo: r.effectiveTo ? r.effectiveTo.toISOString().slice(0, 10) : null,
        sourceReference: r.sourceReference,
        changeNote: r.changeNote,
        stateProvinceId: r.stateProvinceId,
        stateProvinceName: r.stateProvince ? r.stateProvince.name : null,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Resolution Helpers
  // ---------------------------------------------------------------------------

  private async resolveCategoryForSandbox(
    countryId: string,
    stateProvinceId: string | null,
    stateCode: string | null,
    ruleType: CountryRuleType,
    ruleTypeLabel: string,
    calcDate: Date,
    draftOverrideRule: any | null,
  ): Promise<RuleSandboxResolvedCategory> {
    // 1. Check if draft override matches this category
    if (draftOverrideRule && draftOverrideRule.ruleType === ruleType) {
      const fromStr = draftOverrideRule.effectiveFrom.toISOString().slice(0, 10);
      const toStr = draftOverrideRule.effectiveTo
        ? draftOverrideRule.effectiveTo.toISOString().slice(0, 10)
        : null;

      const chain: RuleSandboxResolvedLayer[] = [
        {
          layer: 'global',
          layerLabel: 'Global Default',
          ruleType,
          applied: false,
          notes: 'Overridden by Draft Sandbox Version',
        },
        {
          layer: 'country',
          layerLabel: 'Country Statutory Rule',
          ruleType,
          applied: true,
          version: draftOverrideRule.version,
          status: draftOverrideRule.status,
          isDraftOverride: true,
          effectiveFrom: fromStr,
          effectiveTo: toStr,
          sourceReference: draftOverrideRule.sourceReference,
          changeNote: draftOverrideRule.changeNote,
          notes: `Explicit draft version ${draftOverrideRule.version} selected in Sandbox for pre-publish testing.`,
        },
        {
          layer: 'state',
          layerLabel: 'State/Province Rule',
          ruleType,
          applied: !!draftOverrideRule.stateProvinceId,
          version: draftOverrideRule.stateProvinceId ? draftOverrideRule.version : null,
          status: draftOverrideRule.status,
          notes: draftOverrideRule.stateProvinceId
            ? `Subdivision override: ${draftOverrideRule.stateProvince?.name || stateCode}`
            : 'Inherited at national level',
        },
        {
          layer: 'company',
          layerLabel: 'Company Policy',
          ruleType,
          applied: false,
          notes: 'Standard company statutory compliance policy inherited.',
        },
        {
          layer: 'employee_contract',
          layerLabel: 'Employee Contract',
          ruleType,
          applied: true,
          notes: 'Sample employee profile parameters applied.',
        },
      ];

      return {
        ruleType,
        ruleTypeLabel,
        resolvedVersionNumber: draftOverrideRule.version,
        resolvedStatus: draftOverrideRule.status,
        isDraftOverride: true,
        effectiveFrom: fromStr,
        effectiveTo: toStr,
        sourceReference: draftOverrideRule.sourceReference,
        changeNote: draftOverrideRule.changeNote,
        resolutionChain: chain,
        mergedPayload: (draftOverrideRule.payload as Record<string, unknown>) || {},
      };
    }

    // 2. Query published versions for this category
    // Try state-specific first if stateProvinceId provided
    let candidateRules: any[] = [];
    if (stateProvinceId) {
      candidateRules = await this.prisma.unscoped.countryRule.findMany({
        where: {
          countryId,
          stateProvinceId,
          ruleType,
          status: 'published',
        },
        orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
      });
    }

    // Fallback to national published versions
    if (candidateRules.length === 0) {
      candidateRules = await this.prisma.unscoped.countryRule.findMany({
        where: {
          countryId,
          stateProvinceId: null,
          ruleType,
          status: 'published',
        },
        orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
      });
    }

    // Select effective rule for calcDate
    const matched = selectEffectiveRule(candidateRules, calcDate);

    if (matched) {
      const fromStr = matched.effectiveFrom.toISOString().slice(0, 10);
      const toStr = matched.effectiveTo
        ? matched.effectiveTo.toISOString().slice(0, 10)
        : null;

      const chain: RuleSandboxResolvedLayer[] = [
        {
          layer: 'global',
          layerLabel: 'Global Default',
          ruleType,
          applied: false,
          notes: 'Overridden by published Country Rule',
        },
        {
          layer: 'country',
          layerLabel: 'Country Statutory Rule',
          ruleType,
          applied: true,
          version: matched.version,
          status: matched.status,
          isDraftOverride: false,
          effectiveFrom: fromStr,
          effectiveTo: toStr,
          sourceReference: matched.sourceReference,
          changeNote: matched.changeNote,
          notes: `Version ${matched.version} effective from ${fromStr} active on calculation date.`,
        },
        {
          layer: 'state',
          layerLabel: 'State/Province Rule',
          ruleType,
          applied: !!matched.stateProvinceId,
          version: matched.stateProvinceId ? matched.version : null,
          status: matched.status,
          notes: matched.stateProvinceId
            ? `Regional state override applied.`
            : 'Inherited at national federal level.',
        },
        {
          layer: 'company',
          layerLabel: 'Company Policy',
          ruleType,
          applied: false,
          notes: 'Standard company compliance policy defaults.',
        },
        {
          layer: 'employee_contract',
          layerLabel: 'Employee Contract',
          ruleType,
          applied: true,
          notes: 'Sample employee profile parameters applied.',
        },
      ];

      return {
        ruleType,
        ruleTypeLabel,
        resolvedVersionNumber: matched.version,
        resolvedStatus: matched.status,
        isDraftOverride: false,
        effectiveFrom: fromStr,
        effectiveTo: toStr,
        sourceReference: matched.sourceReference,
        changeNote: matched.changeNote,
        resolutionChain: chain,
        mergedPayload: (matched.payload as Record<string, unknown>) || {},
      };
    }

    // 3. Fallback to Global Built-in Baseline
    const chain: RuleSandboxResolvedLayer[] = [
      {
        layer: 'global',
        layerLabel: 'Global Default',
        ruleType,
        applied: true,
        notes: 'Platform fallback baseline active — no country rule published for this period.',
      },
      {
        layer: 'country',
        layerLabel: 'Country Statutory Rule',
        ruleType,
        applied: false,
        notes: 'No matching published rule version found.',
      },
      {
        layer: 'state',
        layerLabel: 'State/Province Rule',
        ruleType,
        applied: false,
        notes: 'None configured.',
      },
      {
        layer: 'company',
        layerLabel: 'Company Policy',
        ruleType,
        applied: false,
        notes: 'Standard fallback.',
      },
      {
        layer: 'employee_contract',
        layerLabel: 'Employee Contract',
        ruleType,
        applied: true,
        notes: 'Sample employee profile parameters applied.',
      },
    ];

    return {
      ruleType,
      ruleTypeLabel,
      resolvedVersionNumber: null,
      resolvedStatus: 'global_default',
      isDraftOverride: false,
      effectiveFrom: null,
      effectiveTo: null,
      sourceReference: 'Global Built-In Statutory Default',
      changeNote: 'Default fallback values applied when jurisdiction rule is missing.',
      resolutionChain: chain,
      mergedPayload: {},
    };
  }

  // ---------------------------------------------------------------------------
  // Gross & Overtime Calculation (PAYROLL_LOGIC.md §9 & ATTENDANCE_LOGIC.md §4)
  // ---------------------------------------------------------------------------

  private computeGrossEarnings(
    profile: any,
    otPayload?: Record<string, unknown>,
  ): RuleSandboxGrossBreakdown {
    const baseSalary = Number(profile.baseSalary) || 0;

    // Working hours & multipliers from resolved OT rule or standard defaults
    const otConfig = (otPayload as unknown as Partial<WorkingHoursOtRulePayload>) || {};
    const standardDailyHours = Number(otConfig.standardDailyHours) || 8.0;
    const standardWeeklyHours = Number(otConfig.standardWeeklyHours) || 40.0;
    const weekdayMultiplier = Number(otConfig.weekdayMultiplier) || 1.5;
    const weekendMultiplier = Number(otConfig.weekendMultiplier) || 2.0;
    const holidayMultiplier = Number(otConfig.holidayMultiplier) || 2.5;
    const nightMultiplier = Number(otConfig.nightMultiplier) || 1.15;

    // Standard monthly hours = (standardWeeklyHours * 52) / 12
    const standardMonthlyHours = Math.round(((standardWeeklyHours * 52) / 12) * 100) / 100;
    const hourlyRate =
      standardMonthlyHours > 0
        ? Math.round((baseSalary / standardMonthlyHours) * 100) / 100
        : 0;

    // Overtime hours
    const ot = profile.overtime || {};
    const weekdayHours = Number(ot.weekdayHours) || 0;
    const weekendHours = Number(ot.weekendHours) || 0;
    const holidayHours = Number(ot.holidayHours) || 0;
    const nightHours = Number(ot.nightHours) || 0;
    const totalActualOtHours = weekdayHours + weekendHours + holidayHours + nightHours;

    // Overtime cap check
    const maxMonthlyOt = otConfig.maxMonthlyOvertimeHours;
    const actionOnBreach = otConfig.actionOnCapBreach || 'flag';
    let overtimeCapBreach: RuleSandboxOvertimeCapBreach | null = null;
    let payableOtFactor = 1.0;

    if (maxMonthlyOt && totalActualOtHours > maxMonthlyOt) {
      if (actionOnBreach === 'auto_cap') {
        payableOtFactor = maxMonthlyOt / totalActualOtHours;
        overtimeCapBreach = {
          breached: true,
          capHours: maxMonthlyOt,
          actualHours: totalActualOtHours,
          action: 'auto_cap',
          message: `Total overtime (${totalActualOtHours}h) exceeded monthly statutory cap (${maxMonthlyOt}h). Payable hours automatically capped per policy.`,
        };
      } else {
        overtimeCapBreach = {
          breached: true,
          capHours: maxMonthlyOt,
          actualHours: totalActualOtHours,
          action: 'flag',
          message: `Statutory overtime ceiling breached: ${totalActualOtHours}h logged against monthly cap of ${maxMonthlyOt}h. Flagged for compliance review.`,
        };
      }
    }

    const overtimeLines: RuleSandboxOvertimeLine[] = [];
    let totalOvertimePay = 0;

    if (weekdayHours > 0) {
      const payableHours = Math.round(weekdayHours * payableOtFactor * 100) / 100;
      const amt = Math.round(payableHours * hourlyRate * weekdayMultiplier * 100) / 100;
      overtimeLines.push({
        category: 'weekday',
        label: 'Weekday Overtime',
        hours: payableHours,
        multiplier: weekdayMultiplier,
        rate: hourlyRate,
        amount: amt,
      });
      totalOvertimePay += amt;
    }

    if (weekendHours > 0) {
      const payableHours = Math.round(weekendHours * payableOtFactor * 100) / 100;
      const amt = Math.round(payableHours * hourlyRate * weekendMultiplier * 100) / 100;
      overtimeLines.push({
        category: 'weekend',
        label: 'Weekend Overtime',
        hours: payableHours,
        multiplier: weekendMultiplier,
        rate: hourlyRate,
        amount: amt,
      });
      totalOvertimePay += amt;
    }

    if (holidayHours > 0) {
      const payableHours = Math.round(holidayHours * payableOtFactor * 100) / 100;
      const amt = Math.round(payableHours * hourlyRate * holidayMultiplier * 100) / 100;
      overtimeLines.push({
        category: 'holiday',
        label: 'Public Holiday Work',
        hours: payableHours,
        multiplier: holidayMultiplier,
        rate: hourlyRate,
        amount: amt,
      });
      totalOvertimePay += amt;
    }

    if (nightHours > 0) {
      const payableHours = Math.round(nightHours * payableOtFactor * 100) / 100;
      const differential = Math.max(0, nightMultiplier - 1.0);
      const amt = Math.round(payableHours * hourlyRate * differential * 100) / 100;
      overtimeLines.push({
        category: 'night',
        label: 'Night Shift Differential',
        hours: payableHours,
        multiplier: nightMultiplier,
        rate: hourlyRate,
        amount: amt,
      });
      totalOvertimePay += amt;
    }

    totalOvertimePay = Math.round(totalOvertimePay * 100) / 100;

    // Leave deductions
    const leave = profile.leave || {};
    const leaveDeductionLines: RuleSandboxLeaveDeductionLine[] = [];
    let totalLeaveDeductions = 0;

    const unpaidDays = Number(leave.unpaidLeaveDays) || 0;
    const unpaidHours =
      Number(leave.unpaidLeaveHours) || unpaidDays * standardDailyHours;

    if (unpaidHours > 0) {
      const unpaidAmt = Math.round(unpaidHours * hourlyRate * 100) / 100;
      leaveDeductionLines.push({
        leaveType: 'Unpaid Leave / Authorized Absence',
        daysOrHours: `${unpaidHours} hrs (${(unpaidHours / standardDailyHours).toFixed(1)} days)`,
        amount: unpaidAmt,
      });
      totalLeaveDeductions += unpaidAmt;
    }

    totalLeaveDeductions = Math.round(totalLeaveDeductions * 100) / 100;
    const totalGrossPay = Math.max(
      0,
      Math.round((baseSalary + totalOvertimePay - totalLeaveDeductions) * 100) / 100,
    );

    return {
      baseSalary,
      hourlyRate,
      standardMonthlyHours,
      overtimeLines,
      totalOvertimePay,
      overtimeCapBreach,
      leaveDeductionLines,
      totalLeaveDeductions,
      totalGrossPay,
    };
  }

  // ---------------------------------------------------------------------------
  // Statutory Contributions Calculation (Social Security & Pension/Superannuation)
  // ---------------------------------------------------------------------------

  private computeContributions(
    profile: any,
    totalGrossPay: number,
    ssPayload?: Record<string, unknown>,
    pensionPayload?: Record<string, unknown>,
  ): RuleSandboxContributionsBreakdown {
    const items: RuleSandboxContributionItem[] = [];
    let totalEmployeeContributions = 0;
    let totalEmployerContributions = 0;
    let totalPreTaxDeductions = 0;

    const baseSalary = Number(profile.baseSalary) || 0;

    // 1. Social Security Scheme
    if (ssPayload && Object.keys(ssPayload).length > 0) {
      const ss = ssPayload as unknown as Partial<SocialSecurityRulePayload>;
      const schemeName = ss.schemeName || 'Statutory Social Security';
      const code = ss.fundCode || 'SOC-SEC';
      const baseType = ss.contributionBase || 'gross';
      const rawBase = baseType === 'basic' ? baseSalary : totalGrossPay;

      // Floor & ceiling
      let assessedBase = rawBase;
      if (ss.wageFloor && assessedBase < ss.wageFloor) {
        if (ss.exemptBelowFloor) assessedBase = 0;
      }
      if (ss.wageCeiling && assessedBase > ss.wageCeiling) {
        assessedBase = ss.wageCeiling;
      }

      const empRate = Number(ss.employeeContributionRate ?? ss.employeeRate) || 0;
      const emprRate = Number(ss.employerContributionRate ?? ss.employerRate) || 0;

      const empAmt = Math.round(assessedBase * (empRate / 100) * 100) / 100;
      const emprAmt = Math.round(assessedBase * (emprRate / 100) * 100) / 100;
      const isPreTax = ss.preTax ?? true;

      // Sub-funds
      let subFunds: RuleSandboxSubFundContribution[] | undefined;
      if (ss.funds && Array.isArray(ss.funds) && ss.funds.length > 0) {
        subFunds = ss.funds.map((f: StatutoryFundItem) => ({
          name: f.name,
          employeeRate: f.employeeRate,
          employeeAmount: Math.round(assessedBase * (f.employeeRate / 100) * 100) / 100,
          employerRate: f.employerRate,
          employerAmount: Math.round(assessedBase * (f.employerRate / 100) * 100) / 100,
        }));
      }

      items.push({
        name: schemeName,
        code,
        schemeName,
        contributionBase: baseType,
        assessedBase,
        employeeRate: empRate,
        employeeAmount: empAmt,
        employerRate: emprRate,
        employerAmount: emprAmt,
        isPreTax,
        subFunds,
      });

      totalEmployeeContributions += empAmt;
      totalEmployerContributions += emprAmt;
      if (isPreTax) totalPreTaxDeductions += empAmt;
    }

    // 2. Pension / Superannuation Scheme
    if (pensionPayload && Object.keys(pensionPayload).length > 0) {
      const pen = pensionPayload as unknown as Partial<SocialSecurityRulePayload>;
      const schemeName = pen.schemeName || 'Superannuation / Statutory Pension';
      const code = pen.fundCode || 'PENSION';
      const baseType = pen.contributionBase || 'basic';
      const rawBase = baseType === 'basic' ? baseSalary : totalGrossPay;

      let assessedBase = rawBase;
      if (pen.wageFloor && assessedBase < pen.wageFloor) {
        if (pen.exemptBelowFloor) assessedBase = 0;
      }
      if (pen.wageCeiling && assessedBase > pen.wageCeiling) {
        assessedBase = pen.wageCeiling;
      }

      const empRate = Number(pen.employeeContributionRate ?? pen.employeeRate) || 0;
      const emprRate =
        Number(pen.superannuationGuaranteeRate ?? pen.employerContributionRate ?? pen.employerRate) || 0;

      const empAmt = Math.round(assessedBase * (empRate / 100) * 100) / 100;
      const emprAmt = Math.round(assessedBase * (emprRate / 100) * 100) / 100;
      const isPreTax = pen.preTax ?? true;

      // Voluntary employee addition
      const voluntaryRate = Number(profile.voluntaryPensionRate) || 0;
      let finalEmpRate = empRate;
      let finalEmpAmt = empAmt;
      if (voluntaryRate > 0) {
        finalEmpRate += voluntaryRate;
        finalEmpAmt = Math.round(assessedBase * (finalEmpRate / 100) * 100) / 100;
      }

      items.push({
        name: schemeName,
        code,
        schemeName,
        contributionBase: baseType,
        assessedBase,
        employeeRate: finalEmpRate,
        employeeAmount: finalEmpAmt,
        employerRate: emprRate,
        employerAmount: emprAmt,
        isPreTax,
      });

      totalEmployeeContributions += finalEmpAmt;
      totalEmployerContributions += emprAmt;
      if (isPreTax) totalPreTaxDeductions += finalEmpAmt;
    }

    // Default Australia Super Guarantee if no pension/ss resolved
    if (items.length === 0) {
      // Default standard employer 11.5% SG
      const emprRate = 11.5;
      const emprAmt = Math.round(baseSalary * (emprRate / 100) * 100) / 100;
      items.push({
        name: 'Superannuation Guarantee (Statutory Standard)',
        code: 'SG-DEFAULT',
        schemeName: 'Superannuation Guarantee',
        contributionBase: 'basic',
        assessedBase: baseSalary,
        employeeRate: 0,
        employeeAmount: 0,
        employerRate: emprRate,
        employerAmount: emprAmt,
        isPreTax: true,
      });
      totalEmployerContributions += emprAmt;
    }

    return {
      items,
      totalEmployeeContributions: Math.round(totalEmployeeContributions * 100) / 100,
      totalEmployerContributions: Math.round(totalEmployerContributions * 100) / 100,
      totalPreTaxDeductions: Math.round(totalPreTaxDeductions * 100) / 100,
    };
  }

  // ---------------------------------------------------------------------------
  // Progressive Income Tax Calculation (PAYROLL_LOGIC.md §10)
  // ---------------------------------------------------------------------------

  private computeTax(
    taxableIncome: number,
    profile: any,
    taxPayload?: Record<string, unknown>,
  ): RuleSandboxTaxBreakdown {
    const annualTaxableIncome = Math.round(taxableIncome * 12 * 100) / 100;

    let brackets: TaxBracketRow[] = [];
    let rebates: TaxRebateAllowance[] = [];
    let taxYear = new Date().getFullYear();
    let filingStatus: string | null = profile.filingStatus || null;

    if (taxPayload && Object.keys(taxPayload).length > 0) {
      const tp = taxPayload as unknown as Partial<TaxRulePayload>;
      taxYear = tp.taxYear || taxYear;
      rebates = tp.rebates || [];

      if (tp.hasFilingStatuses && tp.filingStatuses && filingStatus) {
        const matchedFs = tp.filingStatuses.find(
          (fs: FilingStatusTaxConfig) => fs.statusKey.toLowerCase() === filingStatus!.toLowerCase(),
        );
        if (matchedFs) {
          brackets = matchedFs.brackets || [];
          if (matchedFs.rebates) rebates = matchedFs.rebates;
        }
      }

      if (brackets.length === 0) {
        brackets = tp.brackets || [];
      }
    }

    // Baseline fallback Australia Stage 3 tax brackets if empty
    if (brackets.length === 0) {
      brackets = [
        { from: 0, to: 18200, rate: 0, fixedAmount: 0 },
        { from: 18200, to: 45000, rate: 16, fixedAmount: 0 },
        { from: 45000, to: 135000, rate: 30, fixedAmount: 4288 },
        { from: 135000, to: 190000, rate: 37, fixedAmount: 31288 },
        { from: 190000, to: null, rate: 45, fixedAmount: 51638 },
      ];
    }

    // Progressive calculation across brackets
    const bracketSteps: RuleSandboxTaxBracketStep[] = [];
    let annualGrossTax = 0;

    for (let i = 0; i < brackets.length; i++) {
      const b = brackets[i];
      const from = Number(b.from) || 0;
      const to = b.to != null ? Number(b.to) : null;
      const rate = Number(b.rate) || 0;
      const fixedAmount = Number(b.fixedAmount) || 0;

      let taxableInBracket = 0;
      if (annualTaxableIncome > from) {
        if (to == null) {
          taxableInBracket = annualTaxableIncome - from;
        } else {
          taxableInBracket = Math.min(annualTaxableIncome, to) - from;
        }
      }

      taxableInBracket = Math.max(0, Math.round(taxableInBracket * 100) / 100);
      const taxForBracket = Math.round(taxableInBracket * (rate / 100) * 100) / 100;
      annualGrossTax += taxForBracket;

      const toLabel = to != null ? `$${to.toLocaleString()}` : 'Unlimited';
      const explanation =
        taxableInBracket > 0
          ? `${rate}% on $${taxableInBracket.toLocaleString()} in tier $${from.toLocaleString()} – ${toLabel}`
          : `Income does not reach this tier (starts at $${from.toLocaleString()})`;

      bracketSteps.push({
        bracketIndex: i + 1,
        from,
        to,
        rate,
        fixedAmount,
        taxableAmountInBracket: taxableInBracket,
        taxAmount: taxForBracket,
        explanation,
      });
    }

    annualGrossTax = Math.round(annualGrossTax * 100) / 100;

    // Apply Rebates / Allowances
    const rebatesApplied: { name: string; code: string; amount: number }[] = [];
    let totalRebates = 0;

    for (const r of rebates) {
      let rebateAmount = 0;
      if (r.type === 'fixed_amount') {
        rebateAmount = r.amount;
      } else if (r.type === 'tapered') {
        const threshold = r.threshold || 0;
        const phaseOutRate = r.phaseOutRate || 0.015;
        if (annualTaxableIncome > threshold) {
          const reduction = (annualTaxableIncome - threshold) * phaseOutRate;
          rebateAmount = Math.max(0, r.amount - reduction);
        } else {
          rebateAmount = r.amount;
        }
      }

      rebateAmount = Math.round(rebateAmount * 100) / 100;
      if (rebateAmount > 0) {
        rebatesApplied.push({
          name: r.name,
          code: r.code,
          amount: rebateAmount,
        });
        totalRebates += rebateAmount;
      }
    }

    totalRebates = Math.round(totalRebates * 100) / 100;
    const annualNetTax = Math.max(0, Math.round((annualGrossTax - totalRebates) * 100) / 100);
    const periodTaxDeduction = Math.round((annualNetTax / 12) * 100) / 100;

    const effectiveTaxRate =
      taxableIncome > 0
        ? Math.round((periodTaxDeduction / taxableIncome) * 10000) / 100
        : 0;

    return {
      taxYear,
      filingStatus,
      annualTaxableIncome,
      periodTaxableIncome: taxableIncome,
      brackets: bracketSteps,
      annualGrossTax,
      rebatesApplied,
      totalRebates,
      annualNetTax,
      periodTaxDeduction,
      effectiveTaxRate,
    };
  }
}
