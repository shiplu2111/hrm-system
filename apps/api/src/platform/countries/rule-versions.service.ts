import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CountryRule,
  CountryRuleType,
  Prisma,
  RuleVersionStatus,
} from '@prisma/client';
import {
  type AffectedPayrollTenantCompanySummary,
  type AffectedPayrollTenantSummary,
  type FilingStatusTaxConfig,
  type PendingRuleVersionView,
  type PublishRuleVersionInput,
  type RejectRuleVersionInput,
  type RuleVersionDiffResult,
  type RuleVersionMetadataDiff,
  type RuleVersionPayloadFieldDiff,
  type RuleVersionPayrollImpact,
  type RuleVersionTimelineEntry,
  type RuleVersionTimelineResponse,
  type RuleVersionView,
  type SocialSecurityRulePayload,
  type SubmitRuleVersionInput,
  type TaxBracketRow,
  validateLeaveRulePayload,
  validateSocialSecurityPayload,
  validateTaxBrackets,
  validateWorkingHoursOtPayload,
  validateEmploymentTerminationPayload,
  validatePublicHolidayPayload,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import {
  CreateRuleVersionDto,
  PublishRuleVersionDto,
  QueryPendingApprovalsDto,
  QueryRuleVersionsDto,
  QueryRuleVersionTimelineDto,
  RejectRuleVersionDto,
  SubmitRuleVersionDto,
  UpdateRuleVersionDto,
} from './dto/rule-version.dto';

const RULE_TYPE_LABELS: Record<string, string> = {
  tax: 'Tax & Brackets',
  social_security: 'Social Security',
  leave: 'Statutory Leave',
  working_hours: 'Working Hours',
  ot: 'Overtime Multipliers & Caps',
  employment_rules: 'Employment Standards',
  termination: 'Termination & Severance',
  public_holiday: 'Public Holidays',
  pension: 'Pension & Superannuation',
  payroll: 'Payroll Frequency & Currency',
  health_safety: 'Health & Safety',
  compliance: 'Statutory Compliance',
};

function getCountryFlagEmoji(isoCode: string): string {
  if (!isoCode) return '🌐';
  const code2Map: Record<string, string> = {
    AUS: 'AU',
    BGD: 'BD',
    USA: 'US',
    GBR: 'GB',
    CAN: 'CA',
    IND: 'IN',
    SGP: 'SG',
    DEU: 'DE',
    FRA: 'FR',
    NZL: 'NZ',
    ARE: 'AE',
    JPN: 'JP',
  };
  const code2 = code2Map[isoCode.toUpperCase()] || isoCode.slice(0, 2).toUpperCase();
  if (code2.length !== 2) return '🌐';
  return String.fromCodePoint(...[...code2].map((c) => 127397 + c.charCodeAt(0)));
}

@Injectable()
export class RuleVersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: PlatformAuditService,
  ) { }

  /**
   * List all versions for a rule set and scope.
   */
  async listVersions(
    countryId: string,
    query: QueryRuleVersionsDto,
  ): Promise<RuleVersionView[]> {
    await this.assertCountryExists(countryId);

    const where: Prisma.CountryRuleWhereInput = { countryId };

    if (query.ruleType) {
      where.ruleType = query.ruleType as CountryRuleType;
    }

    if (query.stateProvinceId !== undefined) {
      where.stateProvinceId =
        query.stateProvinceId === 'null' || query.stateProvinceId === ''
          ? null
          : query.stateProvinceId;
    }

    if (query.status) {
      where.status = query.status as RuleVersionStatus;
    }

    const rules = await this.prisma.unscoped.countryRule.findMany({
      where,
      include: {
        stateProvince: { select: { code: true } },
      },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
    });

    return rules.map((r) => this.toView(r));
  }

  /**
   * Get single rule version by ID.
   */
  async getVersion(
    countryId: string,
    versionId: string,
  ): Promise<RuleVersionView> {
    const rule = await this.assertRuleVersionOwned(countryId, versionId);
    return this.toView(rule);
  }

  /**
   * Create a new rule version.
   */
  async createVersion(
    countryId: string,
    dto: CreateRuleVersionDto,
    userId: string,
  ): Promise<RuleVersionView> {
    await this.assertCountryExists(countryId);

    if (dto.stateProvinceId) {
      const state = await this.prisma.unscoped.stateProvince.findFirst({
        where: { id: dto.stateProvinceId, countryId },
      });
      if (!state) {
        throw new NotFoundException({
          code: 'STATE_NOT_FOUND',
          message: 'State/province subdivision not found for this country',
        });
      }
    }

    const effectiveFrom = this.parseDateOnly(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? this.parseDateOnly(dto.effectiveTo) : null;

    if (effectiveTo && effectiveFrom > effectiveTo) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'effectiveFrom cannot be after effectiveTo',
      });
    }

    if (!dto.sourceReference || !dto.sourceReference.trim()) {
      throw new BadRequestException({
        code: 'MISSING_SOURCE_REFERENCE',
        message: 'sourceReference is mandatory (URL or statutory document name and date)',
      });
    }

    if (!dto.changeNote || !dto.changeNote.trim()) {
      throw new BadRequestException({
        code: 'MISSING_CHANGE_NOTE',
        message: 'changeNote is mandatory',
      });
    }

    const ruleType = dto.ruleType as CountryRuleType;
    const stateProvinceId = dto.stateProvinceId || null;
    const initialStatus: RuleVersionStatus = dto.status ?? 'draft';

    // Validate tax bracket structure if tax rule
    if (ruleType === 'tax' && dto.payload) {
      this.validateTaxPayload(dto.payload);
    }
    // Validate social security / pension rule structure
    if (
      (ruleType === 'social_security' || ruleType === 'pension') &&
      dto.payload
    ) {
      this.validateSocialSecurityPayload(dto.payload);
    }
    // Validate statutory leave rule structure
    if (ruleType === 'leave' && dto.payload) {
      this.validateLeavePayload(dto.payload);
    }
    // Validate working hours / overtime rule structure
    if (
      (ruleType === 'ot' || ruleType === 'working_hours') &&
      dto.payload
    ) {
      this.validateWorkingHoursOtPayload(dto.payload);
    }
    // Validate employment & termination rule structure
    if (ruleType === 'employment_rules' && dto.payload) {
      this.validateEmploymentTerminationPayload(dto.payload);
    }
    // Validate public holiday rule structure
    if (ruleType === 'public_holiday' && dto.payload) {
      this.validatePublicHolidayPayload(dto.payload);
    }

    // Calculate incremental version number
    const maxVersionRecord = await this.prisma.unscoped.countryRule.findFirst({
      where: {
        countryId,
        stateProvinceId,
        ruleType,
      },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (maxVersionRecord?.version ?? 0) + 1;

    // Check overlap if creating directly as published
    if (initialStatus === 'published') {
      await this.assertNoPublishedOverlap(
        countryId,
        stateProvinceId,
        ruleType,
        effectiveFrom,
        effectiveTo,
      );
    }

    const created = await this.prisma.unscoped.countryRule.create({
      data: {
        countryId,
        stateProvinceId,
        ruleType,
        version: nextVersion,
        payload: dto.payload as Prisma.InputJsonValue,
        effectiveFrom,
        effectiveTo,
        status: initialStatus,
        sourceReference: dto.sourceReference.trim(),
        changeNote: dto.changeNote.trim(),
        createdBy: userId || 'system',
      },
      include: {
        stateProvince: { select: { code: true } },
      },
    });

    const view = this.toView(created);

    // Synchronize tax_brackets table if tax rule
    if (ruleType === 'tax') {
      await this.syncTaxBracketTable(countryId, created);
    }

    // Audit log write
    await this.auditService.log({
      userId,
      action: 'country_rule_version.create',
      module: 'country_rules',
      recordId: created.id,
      reason: dto.changeNote.trim(),
      oldValue: null,
      newValue: view,
    });

    return view;
  }

  /**
   * Update an existing rule version.
   * Enforces immutability on published versions.
   */
  async updateVersion(
    countryId: string,
    versionId: string,
    dto: UpdateRuleVersionDto,
    userId: string,
  ): Promise<RuleVersionView> {
    const existing = await this.assertRuleVersionOwned(countryId, versionId);
    const oldView = this.toView(existing);

    // IMMUTABILITY CHECK: Published versions are strictly immutable.
    if (existing.status === 'published') {
      const isAlteringContent =
        dto.payload !== undefined ||
        dto.effectiveFrom !== undefined ||
        (dto.sourceReference !== undefined &&
          dto.sourceReference.trim() !== existing.sourceReference);

      if (isAlteringContent) {
        throw new BadRequestException({
          code: 'PUBLISHED_VERSION_IMMUTABLE',
          message:
            'Published rule versions are immutable. To change a published rule, create a new version.',
        });
      }

      if (
        dto.status !== undefined &&
        dto.status !== 'published' &&
        dto.status !== 'superseded'
      ) {
        throw new BadRequestException({
          code: 'INVALID_STATUS_TRANSITION',
          message: 'A published rule version can only transition to superseded.',
        });
      }
    }

    if (existing.ruleType === 'tax' && dto.payload) {
      this.validateTaxPayload(dto.payload);
    }
    if (
      (existing.ruleType === 'social_security' ||
        existing.ruleType === 'pension') &&
      dto.payload
    ) {
      this.validateSocialSecurityPayload(dto.payload);
    }
    if (existing.ruleType === 'leave' && dto.payload) {
      this.validateLeavePayload(dto.payload);
    }
    if (
      (existing.ruleType === 'ot' || existing.ruleType === 'working_hours') &&
      dto.payload
    ) {
      this.validateWorkingHoursOtPayload(dto.payload);
    }
    if (existing.ruleType === 'employment_rules' && dto.payload) {
      this.validateEmploymentTerminationPayload(dto.payload);
    }
    if (existing.ruleType === 'public_holiday' && dto.payload) {
      this.validatePublicHolidayPayload(dto.payload);
    }

    const effectiveFrom = dto.effectiveFrom
      ? this.parseDateOnly(dto.effectiveFrom)
      : existing.effectiveFrom;
    const effectiveTo =
      dto.effectiveTo !== undefined
        ? dto.effectiveTo
          ? this.parseDateOnly(dto.effectiveTo)
          : null
        : existing.effectiveTo;

    if (effectiveTo && effectiveFrom > effectiveTo) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'effectiveFrom cannot be after effectiveTo',
      });
    }

    const targetStatus = dto.status ?? existing.status;

    // Check overlap if transitioning to published
    if (targetStatus === 'published' && existing.status !== 'published') {
      await this.assertNoPublishedOverlap(
        countryId,
        existing.stateProvinceId,
        existing.ruleType,
        effectiveFrom,
        effectiveTo,
        existing.id,
      );
    }

    const updated = await this.prisma.unscoped.countryRule.update({
      where: { id: versionId },
      data: {
        ...(dto.payload !== undefined
          ? { payload: dto.payload as Prisma.InputJsonValue }
          : {}),
        ...(dto.effectiveFrom !== undefined ? { effectiveFrom } : {}),
        ...(dto.effectiveTo !== undefined ? { effectiveTo } : {}),
        ...(dto.sourceReference !== undefined
          ? { sourceReference: dto.sourceReference.trim() }
          : {}),
        ...(dto.changeNote !== undefined
          ? { changeNote: dto.changeNote.trim() }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: {
        stateProvince: { select: { code: true } },
      },
    });

    const newView = this.toView(updated);

    // Synchronize tax_brackets table if tax rule
    if (existing.ruleType === 'tax') {
      await this.syncTaxBracketTable(countryId, updated);
    }

    // Audit log write
    await this.auditService.log({
      userId,
      action:
        targetStatus === 'superseded' && existing.status !== 'superseded'
          ? 'country_rule_version.supersede'
          : 'country_rule_version.update',
      module: 'country_rules',
      recordId: updated.id,
      reason: dto.changeNote || 'Rule version updated',
      oldValue: oldView,
      newValue: newView,
    });

    return newView;
  }

  /**
   * Submit a rule version for approval (transition from draft/rejected to pending_approval).
   * Typically initiated by Compliance Admin or authoring staff.
   */
  async submitForApproval(
    countryId: string,
    versionId: string,
    actor: { id: string; roleName?: string },
    submissionNote?: string,
  ): Promise<RuleVersionView> {
    const existing = await this.assertRuleVersionOwned(countryId, versionId);

    if (existing.status === 'published' || existing.status === 'superseded') {
      throw new BadRequestException({
        code: 'CANNOT_SUBMIT_PUBLISHED',
        message: 'Published or superseded rule versions cannot be submitted for approval.',
      });
    }

    if (existing.status === 'pending_approval') {
      throw new BadRequestException({
        code: 'ALREADY_PENDING_APPROVAL',
        message: 'This rule version is already pending compliance approval.',
      });
    }

    // Validate payload according to rule type before submission
    if (existing.ruleType === 'tax' && existing.payload) {
      this.validateTaxPayload(existing.payload as Record<string, unknown>);
    }
    if (
      (existing.ruleType === 'social_security' || existing.ruleType === 'pension') &&
      existing.payload
    ) {
      this.validateSocialSecurityPayload(existing.payload as Record<string, unknown>);
    }
    if (existing.ruleType === 'leave' && existing.payload) {
      this.validateLeavePayload(existing.payload as Record<string, unknown>);
    }
    if (
      (existing.ruleType === 'ot' || existing.ruleType === 'working_hours') &&
      existing.payload
    ) {
      this.validateWorkingHoursOtPayload(existing.payload as Record<string, unknown>);
    }
    if (existing.ruleType === 'employment_rules' && existing.payload) {
      this.validateEmploymentTerminationPayload(existing.payload as Record<string, unknown>);
    }
    if (existing.ruleType === 'public_holiday' && existing.payload) {
      this.validatePublicHolidayPayload(existing.payload as Record<string, unknown>);
    }

    const oldView = this.toView(existing);

    const updated = await this.prisma.unscoped.countryRule.update({
      where: { id: versionId },
      data: {
        status: 'pending_approval',
        submittedBy: actor.id,
        submittedAt: new Date(),
        submissionNote: submissionNote?.trim() || null,
        rejectionReason: null,
        rejectedBy: null,
        rejectedAt: null,
      },
      include: {
        stateProvince: { select: { code: true } },
      },
    });

    const newView = this.toView(updated);

    await this.auditService.log({
      userId: actor.id,
      action: 'country_rule_version.submit_for_approval',
      module: 'country_rules',
      recordId: updated.id,
      reason: submissionNote?.trim() || `Submitted version ${updated.version} for compliance approval`,
      oldValue: oldView,
      newValue: newView,
    });

    return newView;
  }

  /**
   * Assesses retroactive backdated payroll impact for a rule version.
   * If effectiveFrom is in the past, lists how many finalized payroll runs across tenants
   * would fall into the backdated window.
   */
  async getPayrollImpact(
    countryId: string,
    versionId: string,
  ): Promise<RuleVersionPayrollImpact> {
    const rule = await this.assertRuleVersionOwned(countryId, versionId);

    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const effectiveFromDate = new Date(rule.effectiveFrom);
    const isBackdated = effectiveFromDate.getTime() < todayUtc.getTime();

    const effectiveFromStr = rule.effectiveFrom.toISOString().slice(0, 10);
    const effectiveToStr = rule.effectiveTo ? rule.effectiveTo.toISOString().slice(0, 10) : null;
    const calculationDateStr = todayUtc.toISOString().slice(0, 10);

    if (!isBackdated) {
      return {
        isBackdated: false,
        effectiveFrom: effectiveFromStr,
        effectiveTo: effectiveToStr,
        calculationDate: calculationDateStr,
        affectedFinalizedPayrollRunsCount: 0,
        affectedTenantsCount: 0,
        affectedCompaniesCount: 0,
        tenants: [],
        warning: null,
      };
    }

    // Find all companies in country (and state, if rule has stateProvinceId)
    const companies = await this.prisma.unscoped.company.findMany({
      where: {
        countryId,
        ...(rule.stateProvinceId ? { stateProvinceId: rule.stateProvinceId } : {}),
      },
      select: {
        id: true,
        name: true,
        tenantId: true,
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
      },
    });

    if (companies.length === 0) {
      return {
        isBackdated: true,
        effectiveFrom: effectiveFromStr,
        effectiveTo: effectiveToStr,
        calculationDate: calculationDateStr,
        affectedFinalizedPayrollRunsCount: 0,
        affectedTenantsCount: 0,
        affectedCompaniesCount: 0,
        tenants: [],
        warning: `Rule effective date (${effectiveFromStr}) is backdated before current date (${calculationDateStr}), but no tenant companies are currently registered under this jurisdiction.`,
      };
    }

    const companyIds = companies.map((c) => c.id);

    // Find finalized or locked payroll runs overlapping with [rule.effectiveFrom, todayUtc]
    const finalizedRuns = await this.prisma.unscoped.payrollRun.findMany({
      where: {
        payrollPeriod: {
          companyId: { in: companyIds },
          startDate: { lte: rule.effectiveTo ?? todayUtc },
          endDate: { gte: rule.effectiveFrom },
        },
        OR: [{ status: 'finalized' }, { locked: true }],
      },
      select: {
        id: true,
        employeeId: true,
        payrollPeriod: {
          select: {
            companyId: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    // Group by tenant and company
    const tenantMap = new Map<
      string,
      {
        tenantId: string;
        tenantName: string;
        subdomain: string;
        companyMap: Map<
          string,
          {
            companyId: string;
            companyName: string;
            runIds: Set<string>;
            employeeIds: Set<string>;
          }
        >;
      }
    >();

    for (const comp of companies) {
      if (!tenantMap.has(comp.tenantId)) {
        tenantMap.set(comp.tenantId, {
          tenantId: comp.tenantId,
          tenantName: comp.tenant.name,
          subdomain: comp.tenant.subdomain,
          companyMap: new Map(),
        });
      }
      const tEntry = tenantMap.get(comp.tenantId)!;
      if (!tEntry.companyMap.has(comp.id)) {
        tEntry.companyMap.set(comp.id, {
          companyId: comp.id,
          companyName: comp.name,
          runIds: new Set(),
          employeeIds: new Set(),
        });
      }
    }

    for (const run of finalizedRuns) {
      const compId = run.payrollPeriod.companyId;
      for (const tEntry of tenantMap.values()) {
        if (tEntry.companyMap.has(compId)) {
          const cEntry = tEntry.companyMap.get(compId)!;
          cEntry.runIds.add(run.id);
          cEntry.employeeIds.add(run.employeeId);
        }
      }
    }

    const tenantSummaries: AffectedPayrollTenantSummary[] = [];
    let affectedCompaniesCount = 0;

    for (const tEntry of tenantMap.values()) {
      const companySummaries: AffectedPayrollTenantCompanySummary[] = [];
      let tenantRunCount = 0;

      for (const cEntry of tEntry.companyMap.values()) {
        if (cEntry.runIds.size > 0) {
          companySummaries.push({
            companyId: cEntry.companyId,
            companyName: cEntry.companyName,
            affectedRunsCount: cEntry.runIds.size,
            affectedEmployeesCount: cEntry.employeeIds.size,
          });
          tenantRunCount += cEntry.runIds.size;
          affectedCompaniesCount++;
        }
      }

      if (tenantRunCount > 0) {
        tenantSummaries.push({
          tenantId: tEntry.tenantId,
          tenantName: tEntry.tenantName,
          subdomain: tEntry.subdomain,
          companies: companySummaries,
          totalAffectedRuns: tenantRunCount,
        });
      }
    }

    const warning =
      finalizedRuns.length > 0
        ? `WARNING: Backdated statutory rule change effective from ${effectiveFromStr}. There are ${finalizedRuns.length} finalized payroll run(s) across ${tenantSummaries.length} tenant workspace(s) in this period. Under RULES.md §3, finalized payroll rows are immutable and will NOT be modified. Publishing will flag these runs for compliance review.`
        : `Backdated statutory rule effective from ${effectiveFromStr}, but no finalized payroll runs exist in the backdated interval.`;

    return {
      isBackdated: true,
      effectiveFrom: effectiveFromStr,
      effectiveTo: effectiveToStr,
      calculationDate: calculationDateStr,
      affectedFinalizedPayrollRunsCount: finalizedRuns.length,
      affectedTenantsCount: tenantSummaries.length,
      affectedCompaniesCount,
      tenants: tenantSummaries,
      warning,
    };
  }

  /**
   * Publish a rule version (transition to published).
   * Enforces:
   * 1. Approver Role: Must be Platform Owner or Platform Admin.
   * 2. Separation of Duties: Submitter can NEVER approve their own change.
   * 3. Backdated Confirmation: If effectiveFrom is in past, requires explicit backdated confirmation.
   * 4. Payroll Immutability: Never alters finalized payroll data (RULES.md §3); only flags affected runs for review.
   * 5. Date Interval Overlap Integrity: Rejects overlapping published ranges; sunsets older open-ended versions if needed.
   */
  async publishVersion(
    countryId: string,
    versionId: string,
    actorOrUserId: string | { id: string; roleName?: string },
    options?: PublishRuleVersionInput,
  ): Promise<RuleVersionView> {
    const actor =
      typeof actorOrUserId === 'string'
        ? { id: actorOrUserId, roleName: 'Platform Owner' }
        : actorOrUserId;

    const existing = await this.assertRuleVersionOwned(countryId, versionId);
    if (existing.status === 'published') {
      return this.toView(existing);
    }

    if (existing.status !== 'pending_approval') {
      throw new BadRequestException({
        code: 'CANNOT_PUBLISH_STATUS',
        message: `Cannot publish rule version in '${existing.status}' status. Version must be 'pending_approval' before publishing.`,
      });
    }

    // 1. Role validation: Must be Platform Owner or Platform Admin
    if (
      actor.roleName &&
      actor.roleName !== 'Platform Owner' &&
      actor.roleName !== 'Platform Admin'
    ) {
      throw new ForbiddenException({
        code: 'APPROVAL_ROLE_REQUIRED',
        message:
          'Separation of duties: Only a Platform Owner or Platform Admin can approve and publish statutory rule versions.',
      });
    }

    // 2. Separation of duties: Submitter can NEVER approve their own change
    if (existing.submittedBy && existing.submittedBy === actor.id) {
      throw new ForbiddenException({
        code: 'SELF_APPROVAL_FORBIDDEN',
        message:
          'Separation of duties violation: The submitter cannot approve their own rule version change. A different Platform Owner or Platform Admin must review and approve.',
      });
    }

    // 3. Backdated Payroll Assessment & Confirmation Requirement
    const impact = await this.getPayrollImpact(countryId, versionId);
    if (impact.isBackdated && impact.affectedFinalizedPayrollRunsCount > 0) {
      if (!options?.confirmBackdated) {
        throw new BadRequestException({
          code: 'BACKDATED_CONFIRMATION_REQUIRED',
          message: `Rule version effective date (${impact.effectiveFrom}) is backdated and affects ${impact.affectedFinalizedPayrollRunsCount} finalized payroll run(s) across ${impact.affectedTenantsCount} tenant(s). An explicit backdated confirmation is required.`,
          details: impact,
        });
      }
    }

    // 4. Overlap validation & automatic sunsetting / bounding of versions
    let boundedEffectiveTo = existing.effectiveTo;
    if (existing.effectiveFrom) {
      // 4a. Sunset preceding or superseded versions
      const publishedOlder = await this.prisma.unscoped.countryRule.findMany({
        where: {
          countryId,
          stateProvinceId: existing.stateProvinceId ?? null,
          ruleType: existing.ruleType,
          status: 'published',
          id: { not: existing.id },
          effectiveFrom: { lte: existing.effectiveFrom },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: existing.effectiveFrom } },
          ],
        },
      });

      for (const older of publishedOlder) {
        if (older.effectiveFrom.getTime() === existing.effectiveFrom.getTime()) {
          // Exact same effective start date -> superseded by newly published version
          await this.prisma.unscoped.countryRule.update({
            where: { id: older.id },
            data: { status: 'superseded' },
          });
        } else {
          const fromDate = new Date(existing.effectiveFrom);
          fromDate.setUTCDate(fromDate.getUTCDate() - 1);
          await this.prisma.unscoped.countryRule.update({
            where: { id: older.id },
            data: {
              effectiveTo: fromDate,
            },
          });
        }
      }

      // 4b. If this version is open-ended (effectiveTo is null), check if a subsequent published version exists.
      // If so, bound this version's effectiveTo to 1 day before the subsequent version starts.
      if (!boundedEffectiveTo) {
        const publishedNewer = await this.prisma.unscoped.countryRule.findFirst({
          where: {
            countryId,
            stateProvinceId: existing.stateProvinceId ?? null,
            ruleType: existing.ruleType,
            status: 'published',
            id: { not: existing.id },
            effectiveFrom: { gt: existing.effectiveFrom },
          },
          orderBy: { effectiveFrom: 'asc' },
        });

        if (publishedNewer) {
          const nextStart = new Date(publishedNewer.effectiveFrom);
          nextStart.setUTCDate(nextStart.getUTCDate() - 1);
          boundedEffectiveTo = nextStart;
        }
      }
    }

    await this.assertNoPublishedOverlap(
      countryId,
      existing.stateProvinceId,
      existing.ruleType,
      existing.effectiveFrom,
      boundedEffectiveTo,
      existing.id,
    );

    const oldView = this.toView(existing);

    // 5. If backdated, flag affected finalized payroll runs for review (RULES.md §3)
    if (impact.isBackdated && impact.affectedFinalizedPayrollRunsCount > 0) {
      await this.flagAffectedPayrollRunsForReview(
        countryId,
        { ...existing, effectiveTo: boundedEffectiveTo },
        actor.id,
        options?.backdatedReason,
      );
    }

    // 6. Transition to Published
    const updated = await this.prisma.unscoped.countryRule.update({
      where: { id: versionId },
      data: {
        status: 'published',
        effectiveTo: boundedEffectiveTo,
        approvedBy: actor.id,
        approvedAt: new Date(),
        rejectionReason: null,
        rejectedBy: null,
        rejectedAt: null,
      },
      include: {
        stateProvince: { select: { code: true } },
      },
    });

    const newView = this.toView(updated);

    // Synchronize tax_brackets table if tax rule
    if (existing.ruleType === 'tax') {
      await this.syncTaxBracketTable(countryId, updated);
    }

    await this.auditService.log({
      userId: actor.id,
      action:
        impact.isBackdated && impact.affectedFinalizedPayrollRunsCount > 0
          ? 'country_rule_version.publish_backdated'
          : 'country_rule_version.publish',
      module: 'country_rules',
      recordId: updated.id,
      reason:
        options?.approvalNote ||
        `Approved and published version ${updated.version} (${updated.effectiveFrom.toISOString().slice(0, 10)})`,
      oldValue: oldView,
      newValue: newView,
    });

    return newView;
  }

  /**
   * Reject a pending rule version (transitions back to draft with mandatory reason).
   */
  async rejectVersion(
    countryId: string,
    versionId: string,
    actor: { id: string; roleName?: string },
    reason: string,
  ): Promise<RuleVersionView> {
    const existing = await this.assertRuleVersionOwned(countryId, versionId);

    if (existing.status !== 'pending_approval') {
      throw new BadRequestException({
        code: 'INVALID_STATUS_FOR_REJECTION',
        message: 'Only rule versions pending approval can be rejected.',
      });
    }

    // Role check: Must be Platform Owner or Platform Admin
    if (
      actor.roleName &&
      actor.roleName !== 'Platform Owner' &&
      actor.roleName !== 'Platform Admin'
    ) {
      throw new ForbiddenException({
        code: 'APPROVAL_ROLE_REQUIRED',
        message: 'Only a Platform Owner or Platform Admin can reject rule version changes.',
      });
    }

    // Separation of duties check
    if (existing.submittedBy && existing.submittedBy === actor.id) {
      throw new ForbiddenException({
        code: 'SELF_APPROVAL_FORBIDDEN',
        message: 'Separation of duties violation: Submitter cannot reject their own submission.',
      });
    }

    if (!reason || !reason.trim()) {
      throw new BadRequestException({
        code: 'REJECTION_REASON_REQUIRED',
        message: 'A rejection reason is mandatory when rejecting a rule version.',
      });
    }

    const oldView = this.toView(existing);

    const updated = await this.prisma.unscoped.countryRule.update({
      where: { id: versionId },
      data: {
        status: 'draft',
        rejectionReason: reason.trim(),
        rejectedBy: actor.id,
        rejectedAt: new Date(),
      },
      include: {
        stateProvince: { select: { code: true } },
      },
    });

    const newView = this.toView(updated);

    await this.auditService.log({
      userId: actor.id,
      action: 'country_rule_version.reject',
      module: 'country_rules',
      recordId: updated.id,
      reason: `Rejected version ${updated.version}: ${reason.trim()}`,
      oldValue: oldView,
      newValue: newView,
    });

    return newView;
  }

  /**
   * Flags affected finalized payroll runs for compliance review without modifying financial data (RULES.md §3).
   */
  private async flagAffectedPayrollRunsForReview(
    countryId: string,
    rule: CountryRule,
    actorId: string,
    backdatedReason?: string,
  ): Promise<number> {
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const companies = await this.prisma.unscoped.company.findMany({
      where: {
        countryId,
        ...(rule.stateProvinceId ? { stateProvinceId: rule.stateProvinceId } : {}),
      },
      select: { id: true },
    });
    if (companies.length === 0) return 0;

    const companyIds = companies.map((c) => c.id);

    const runs = await this.prisma.unscoped.payrollRun.findMany({
      where: {
        payrollPeriod: {
          companyId: { in: companyIds },
          startDate: { lte: rule.effectiveTo ?? todayUtc },
          endDate: { gte: rule.effectiveFrom },
        },
        OR: [{ status: 'finalized' }, { locked: true }],
      },
      select: { id: true, calculationSnapshot: true },
    });

    const effectiveFromStr = rule.effectiveFrom.toISOString().slice(0, 10);
    const flaggedAt = new Date().toISOString();

    for (const r of runs) {
      const existingSnapshot = (r.calculationSnapshot as Record<string, any>) || {};
      const existingFlags = Array.isArray(existingSnapshot.complianceReviewFlags)
        ? (existingSnapshot.complianceReviewFlags as any[])
        : [];
      const newFlag = {
        flagType: 'backdated_statutory_rule_update',
        ruleType: rule.ruleType,
        ruleVersionId: rule.id,
        ruleVersionNumber: rule.version,
        ruleEffectiveFrom: effectiveFromStr,
        flaggedAt,
        flaggedBy: actorId,
        reason:
          backdatedReason ||
          'Statutory rule revision published with retroactive effective date.',
        regulatoryNote:
          'Per RULES.md §3, finalized payroll rows are locked and cannot be mutated. Adjustments must be processed via payroll_adjustments if necessary.',
      };

      await this.prisma.unscoped.payrollRun.update({
        where: { id: r.id },
        data: {
          calculationSnapshot: {
            ...existingSnapshot,
            complianceReviewRequired: true,
            complianceReviewFlags: [...existingFlags, newFlag],
          } as any,
        },
      });
    }

    return runs.length;
  }

  /**
   * Delete a draft / pending_approval version.
   * Published or superseded versions cannot be deleted.
   */
  async deleteVersion(
    countryId: string,
    versionId: string,
    userId: string,
  ): Promise<void> {
    const existing = await this.assertRuleVersionOwned(countryId, versionId);

    if (existing.status === 'published' || existing.status === 'superseded') {
      throw new BadRequestException({
        code: 'CANNOT_DELETE_PUBLISHED',
        message: 'Published or superseded rule versions cannot be deleted.',
      });
    }

    const oldView = this.toView(existing);

    await this.prisma.unscoped.countryRule.delete({
      where: { id: versionId },
    });

    // Delete synchronized tax_brackets record if tax rule
    if (existing.ruleType === 'tax') {
      await this.prisma.unscoped.taxBracket.deleteMany({
        where: {
          countryId,
          stateProvinceId: existing.stateProvinceId,
          version: existing.version,
        },
      });
    }

    await this.auditService.log({
      userId,
      action: 'country_rule_version.delete',
      module: 'country_rules',
      recordId: versionId,
      reason: `Deleted ${existing.status} version ${existing.version}`,
      oldValue: oldView,
      newValue: null,
    });
  }

  /**
   * Calculate a structured side-by-side diff between two versions.
   */
  async compareVersions(
    countryId: string,
    baseVersionId: string,
    compareVersionId: string,
  ): Promise<RuleVersionDiffResult> {
    const [baseRecord, compareRecord] = await Promise.all([
      this.assertRuleVersionOwned(countryId, baseVersionId),
      this.assertRuleVersionOwned(countryId, compareVersionId),
    ]);

    const baseView = this.toView(baseRecord);
    const compareView = this.toView(compareRecord);

    const metadataDiff: RuleVersionMetadataDiff[] = [
      {
        field: 'status',
        label: 'Status',
        baseValue: baseView.status,
        compareValue: compareView.status,
        hasChanged: baseView.status !== compareView.status,
      },
      {
        field: 'effectiveFrom',
        label: 'Effective From',
        baseValue: baseView.effectiveFrom,
        compareValue: compareView.effectiveFrom,
        hasChanged: baseView.effectiveFrom !== compareView.effectiveFrom,
      },
      {
        field: 'effectiveTo',
        label: 'Effective To',
        baseValue: baseView.effectiveTo || 'Indefinite',
        compareValue: compareView.effectiveTo || 'Indefinite',
        hasChanged: baseView.effectiveTo !== compareView.effectiveTo,
      },
      {
        field: 'sourceReference',
        label: 'Source Reference',
        baseValue: baseView.sourceReference,
        compareValue: compareView.sourceReference,
        hasChanged: baseView.sourceReference !== compareView.sourceReference,
      },
      {
        field: 'changeNote',
        label: 'Change Note',
        baseValue: baseView.changeNote,
        compareValue: compareView.changeNote,
        hasChanged: baseView.changeNote !== compareView.changeNote,
      },
      {
        field: 'createdBy',
        label: 'Created By',
        baseValue: baseView.createdBy,
        compareValue: compareView.createdBy,
        hasChanged: baseView.createdBy !== compareView.createdBy,
      },
    ];

    const payloadDiff: RuleVersionPayloadFieldDiff[] = [];
    const basePayload = baseView.payload || {};
    const comparePayload = compareView.payload || {};

    const allKeys = Array.from(
      new Set([...Object.keys(basePayload), ...Object.keys(comparePayload)]),
    ).sort();

    let added = 0;
    let removed = 0;
    let modified = 0;
    let unchanged = 0;

    for (const key of allKeys) {
      const inBase = Object.prototype.hasOwnProperty.call(basePayload, key);
      const inCompare = Object.prototype.hasOwnProperty.call(comparePayload, key);

      if (!inBase && inCompare) {
        payloadDiff.push({
          path: key,
          type: 'added',
          compareValue: comparePayload[key],
        });
        added++;
      } else if (inBase && !inCompare) {
        payloadDiff.push({
          path: key,
          type: 'removed',
          baseValue: basePayload[key],
        });
        removed++;
      } else {
        const baseValJson = JSON.stringify(basePayload[key]);
        const compareValJson = JSON.stringify(comparePayload[key]);
        if (baseValJson !== compareValJson) {
          payloadDiff.push({
            path: key,
            type: 'modified',
            baseValue: basePayload[key],
            compareValue: comparePayload[key],
          });
          modified++;
        } else {
          payloadDiff.push({
            path: key,
            type: 'unchanged',
            baseValue: basePayload[key],
            compareValue: comparePayload[key],
          });
          unchanged++;
        }
      }
    }

    return {
      baseVersion: baseView,
      compareVersion: compareView,
      metadataDiff,
      payloadDiff,
      stats: { added, removed, modified, unchanged },
      rawBaseJson: JSON.stringify(basePayload, null, 2),
      rawCompareJson: JSON.stringify(comparePayload, null, 2),
    };
  }

  /**
   * Helper to resolve platform staff user identities for audit tracking and timeline display.
   */
  private async resolvePlatformUsersMap(
    userIds: string[],
  ): Promise<Map<string, { id: string; name: string; email?: string }>> {
    const map = new Map<string, { id: string; name: string; email?: string }>();
    const cleanIds = Array.from(new Set(userIds.filter((id) => id && id !== 'system')));

    if (userIds.includes('system')) {
      map.set('system', { id: 'system', name: 'System Seeder', email: 'system@platform.local' });
    }

    if (cleanIds.length === 0) return map;

    const users = await this.prisma.unscoped.platformUser.findMany({
      where: { id: { in: cleanIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    for (const u of users) {
      const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
      map.set(u.id, {
        id: u.id,
        name: fullName || u.email,
        email: u.email,
      });
    }

    return map;
  }

  /**
   * Get all pending rule versions awaiting compliance approval across countries.
   * Includes diff against the currently published active version.
   */
  async getPendingApprovals(
    filters?: QueryPendingApprovalsDto,
  ): Promise<PendingRuleVersionView[]> {
    const where: Prisma.CountryRuleWhereInput = {
      status: 'pending_approval',
    };
    if (filters?.countryId) {
      where.countryId = filters.countryId;
    }
    if (filters?.ruleType) {
      where.ruleType = filters.ruleType as CountryRuleType;
    }

    const pendingRules = await this.prisma.unscoped.countryRule.findMany({
      where,
      include: {
        country: { select: { id: true, name: true, isoCode: true } },
        stateProvince: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (pendingRules.length === 0) return [];

    // Collect submitter user IDs
    const submitterIds = pendingRules
      .map((r) => r.submittedBy || r.createdBy)
      .filter(Boolean) as string[];
    const userMap = await this.resolvePlatformUsersMap(submitterIds);

    const now = new Date();
    const todayUtc = now.toISOString().slice(0, 10);

    const results: PendingRuleVersionView[] = [];

    for (const rule of pendingRules) {
      const submitter =
        (rule.submittedBy ? userMap.get(rule.submittedBy) : null) ||
        (rule.createdBy ? userMap.get(rule.createdBy) : null) ||
        null;

      // Find current published version for this country/state/ruleType
      const currentPublished = await this.prisma.unscoped.countryRule.findFirst({
        where: {
          countryId: rule.countryId,
          stateProvinceId: rule.stateProvinceId,
          ruleType: rule.ruleType,
          status: 'published',
        },
        orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
        include: { stateProvince: { select: { code: true } } },
      });

      let diffAgainstPublished: RuleVersionDiffResult | null = null;
      if (currentPublished) {
        try {
          diffAgainstPublished = await this.compareVersions(
            rule.countryId,
            currentPublished.id,
            rule.id,
          );
        } catch {
          diffAgainstPublished = null;
        }
      }

      const effectiveFromStr = rule.effectiveFrom.toISOString().slice(0, 10);
      const isBackdated = effectiveFromStr < todayUtc;

      results.push({
        id: rule.id,
        countryId: rule.countryId,
        countryName: rule.country.name,
        countryCode: rule.country.isoCode,
        flagEmoji: getCountryFlagEmoji(rule.country.isoCode),
        stateProvinceId: rule.stateProvinceId,
        stateProvinceCode: rule.stateProvince?.code || null,
        stateProvinceName: rule.stateProvince?.name || null,
        ruleType: rule.ruleType,
        ruleTypeLabel: RULE_TYPE_LABELS[rule.ruleType] || rule.ruleType,
        version: rule.version,
        status: rule.status as RuleVersionStatus,
        effectiveFrom: effectiveFromStr,
        effectiveTo: rule.effectiveTo
          ? rule.effectiveTo.toISOString().slice(0, 10)
          : null,
        isBackdated,
        sourceReference: rule.sourceReference,
        changeNote: rule.changeNote,
        submittedBy: rule.submittedBy,
        submittedByName: submitter ? submitter.name : rule.submittedBy || 'Compliance Author',
        submittedByEmail: submitter?.email,
        submittedAt: rule.submittedAt ? rule.submittedAt.toISOString() : null,
        submissionNote: rule.submissionNote,
        currentPublishedVersion: currentPublished
          ? {
              id: currentPublished.id,
              version: currentPublished.version,
              effectiveFrom: currentPublished.effectiveFrom.toISOString().slice(0, 10),
              effectiveTo: currentPublished.effectiveTo
                ? currentPublished.effectiveTo.toISOString().slice(0, 10)
                : null,
              sourceReference: currentPublished.sourceReference,
              changeNote: currentPublished.changeNote,
            }
          : null,
        diffAgainstPublished,
      });
    }

    return results;
  }

  /**
   * Get chronological timeline of all rule versions for a country and rule category.
   * Details creator, submitter, approver, rejecter, effective dates, and changes.
   */
  async getTimeline(
    countryId: string,
    ruleType: string,
    stateProvinceId?: string | null,
  ): Promise<RuleVersionTimelineResponse> {
    const country = await this.prisma.unscoped.country.findUnique({
      where: { id: countryId },
      select: { id: true, name: true, isoCode: true },
    });
    if (!country) {
      throw new NotFoundException({
        code: 'COUNTRY_NOT_FOUND',
        message: 'Country jurisdiction not found',
      });
    }

    const stateProvince = stateProvinceId
      ? await this.prisma.unscoped.stateProvince.findFirst({
          where: { id: stateProvinceId, countryId },
          select: { id: true, code: true, name: true },
        })
      : null;

    const where: Prisma.CountryRuleWhereInput = {
      countryId,
      ruleType: ruleType as CountryRuleType,
      stateProvinceId: stateProvinceId ? stateProvinceId : null,
    };

    const rules = await this.prisma.unscoped.countryRule.findMany({
      where,
      orderBy: [{ version: 'asc' }],
      include: {
        stateProvince: { select: { code: true } },
      },
    });

    const now = new Date();
    const todayUtc = now.toISOString().slice(0, 10);

    // Identify current active published version
    let currentPublishedVersion = rules
      .filter((r) => r.status === 'published')
      .find((r) => {
        const from = r.effectiveFrom.toISOString().slice(0, 10);
        const to = r.effectiveTo ? r.effectiveTo.toISOString().slice(0, 10) : null;
        return from <= todayUtc && (!to || to >= todayUtc);
      });
    if (!currentPublishedVersion) {
      const allPublished = rules.filter((r) => r.status === 'published');
      currentPublishedVersion = allPublished[allPublished.length - 1];
    }

    // Collect all involved user IDs
    const userIds: string[] = [];
    for (const r of rules) {
      if (r.createdBy) userIds.push(r.createdBy);
      if (r.submittedBy) userIds.push(r.submittedBy);
      if (r.approvedBy) userIds.push(r.approvedBy);
      if (r.rejectedBy) userIds.push(r.rejectedBy);
    }
    const userMap = await this.resolvePlatformUsersMap(userIds);

    const timelineEntries: RuleVersionTimelineEntry[] = [];

    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      const prevRule = i > 0 ? rules[i - 1] : null;

      const effectiveFromStr = r.effectiveFrom.toISOString().slice(0, 10);
      const isBackdated = effectiveFromStr < todayUtc;
      const isCurrentPublished = currentPublishedVersion?.id === r.id;

      const creatorUser = userMap.get(r.createdBy) || {
        id: r.createdBy,
        name: r.createdBy === 'system' ? 'System Seeder' : 'Staff Author',
      };
      const submitterUser = r.submittedBy ? userMap.get(r.submittedBy) : null;
      const approverUser = r.approvedBy ? userMap.get(r.approvedBy) : null;
      const rejecterUser = r.rejectedBy ? userMap.get(r.rejectedBy) : null;

      let diffSummary: RuleVersionTimelineEntry['diffSummary'] = null;
      if (prevRule) {
        try {
          const diff = await this.compareVersions(countryId, prevRule.id, r.id);
          diffSummary = {
            fieldsAdded: diff.stats.added,
            fieldsRemoved: diff.stats.removed,
            fieldsModified: diff.stats.modified,
            totalChanges: diff.stats.added + diff.stats.removed + diff.stats.modified,
          };
        } catch {
          diffSummary = null;
        }
      }

      timelineEntries.push({
        id: r.id,
        version: r.version,
        status: r.status as RuleVersionStatus,
        effectiveFrom: effectiveFromStr,
        effectiveTo: r.effectiveTo ? r.effectiveTo.toISOString().slice(0, 10) : null,
        isCurrentPublished,
        isBackdated,
        sourceReference: r.sourceReference,
        changeNote: r.changeNote,
        payload: (r.payload as Record<string, unknown>) || {},
        creator: {
          id: creatorUser.id,
          name: creatorUser.name,
          email: creatorUser.email,
          at: r.createdAt.toISOString(),
        },
        submitter: r.submittedBy
          ? {
              id: r.submittedBy,
              name: submitterUser ? submitterUser.name : r.submittedBy,
              email: submitterUser?.email,
              at: r.submittedAt ? r.submittedAt.toISOString() : r.updatedAt.toISOString(),
              note: r.submissionNote,
            }
          : null,
        approver: r.approvedBy
          ? {
              id: r.approvedBy,
              name: approverUser ? approverUser.name : r.approvedBy,
              email: approverUser?.email,
              at: r.approvedAt ? r.approvedAt.toISOString() : r.updatedAt.toISOString(),
            }
          : null,
        rejecter: r.rejectedBy
          ? {
              id: r.rejectedBy,
              name: rejecterUser ? rejecterUser.name : r.rejectedBy,
              email: rejecterUser?.email,
              at: r.rejectedAt ? r.rejectedAt.toISOString() : r.updatedAt.toISOString(),
              reason: r.rejectionReason,
            }
          : null,
        diffSummary,
      });
    }

    return {
      countryId: country.id,
      countryName: country.name,
      countryCode: country.isoCode,
      flagEmoji: getCountryFlagEmoji(country.isoCode),
      ruleType,
      ruleTypeLabel: RULE_TYPE_LABELS[ruleType] || ruleType,
      stateProvinceId: stateProvince?.id || null,
      stateProvinceCode: stateProvince?.code || null,
      currentPublishedVersionId: currentPublishedVersion?.id || null,
      currentPublishedVersionNumber: currentPublishedVersion?.version || null,
      totalVersions: timelineEntries.length,
      versions: timelineEntries,
    };
  }

  // --- Helper Validation Methods ---

  /**
   * Overlap validation for published versions.
   * Only one published version may cover any given date for the same rule set and scope.
   */
  async assertNoPublishedOverlap(
    countryId: string,
    stateProvinceId: string | null,
    ruleType: CountryRuleType,
    candidateStart: Date,
    candidateEnd: Date | null,
    excludeId?: string,
  ): Promise<void> {
    const publishedVersions = await this.prisma.unscoped.countryRule.findMany({
      where: {
        countryId,
        stateProvinceId: stateProvinceId ?? null,
        ruleType,
        status: 'published',
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    for (const existing of publishedVersions) {
      const existStart = existing.effectiveFrom;
      const existEnd = existing.effectiveTo;

      // Intervals [S1, E1] and [S2, E2] overlap iff (S1 <= E2 or E2 is null) AND (S2 <= E1 or E1 is null)
      const candStartsBeforeExistEnds =
        existEnd === null || candidateStart <= existEnd;
      const existStartsBeforeCandEnds =
        candidateEnd === null || existStart <= candidateEnd;

      if (candStartsBeforeExistEnds && existStartsBeforeCandEnds) {
        const existEndStr = existEnd ? existEnd.toISOString().slice(0, 10) : 'indefinite';
        const existStartStr = existStart.toISOString().slice(0, 10);
        const scopeLabel = stateProvinceId ? 'state scope' : 'country scope';

        throw new ConflictException({
          code: 'RULE_VERSION_OVERLAP',
          message: `Conflict: Overlapping published version exists for ${ruleType} (${scopeLabel}, Version ${existing.version}, effective ${existStartStr} to ${existEndStr}). Only one published version may cover any given date for the same rule set and scope.`,
          conflictingVersionId: existing.id,
          conflictingVersionNumber: existing.version,
          conflictingEffectiveRange: `${existStartStr} to ${existEndStr}`,
        });
      }
    }
  }

  private async assertCountryExists(countryId: string): Promise<void> {
    const country = await this.prisma.unscoped.country.findUnique({
      where: { id: countryId },
    });
    if (!country) {
      throw new NotFoundException({
        code: 'COUNTRY_NOT_FOUND',
        message: 'Country jurisdiction not found',
      });
    }
  }

  private async assertRuleVersionOwned(
    countryId: string,
    versionId: string,
  ): Promise<CountryRule & { stateProvince?: { code: string } | null }> {
    await this.assertCountryExists(countryId);

    const rule = await this.prisma.unscoped.countryRule.findFirst({
      where: { id: versionId, countryId },
      include: {
        stateProvince: { select: { code: true } },
      },
    });

    if (!rule) {
      throw new NotFoundException({
        code: 'RULE_VERSION_NOT_FOUND',
        message: 'Rule version not found for this country',
      });
    }

    return rule;
  }

  private parseDateOnly(value: string): Date {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (isNaN(parsed.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_DATE',
        message: `Invalid date format: "${value}". Expected YYYY-MM-DD.`,
      });
    }
    return parsed;
  }

  private toView(
    record: CountryRule & { stateProvince?: { code: string } | null },
  ): RuleVersionView {
    return {
      id: record.id,
      countryId: record.countryId,
      stateProvinceId: record.stateProvinceId,
      stateProvinceCode: record.stateProvince?.code || null,
      ruleType: record.ruleType,
      version: record.version,
      status: record.status as RuleVersionStatus,
      effectiveFrom: record.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: record.effectiveTo
        ? record.effectiveTo.toISOString().slice(0, 10)
        : null,
      sourceReference: record.sourceReference,
      changeNote: record.changeNote,
      createdBy: record.createdBy,
      payload: (record.payload as Record<string, unknown>) || {},
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      submittedBy: record.submittedBy ?? null,
      submittedAt: record.submittedAt ? record.submittedAt.toISOString() : null,
      submissionNote: record.submissionNote ?? null,
      approvedBy: record.approvedBy ?? null,
      approvedAt: record.approvedAt ? record.approvedAt.toISOString() : null,
      rejectionReason: record.rejectionReason ?? null,
      rejectedBy: record.rejectedBy ?? null,
      rejectedAt: record.rejectedAt ? record.rejectedAt.toISOString() : null,
    };
  }

  /**
   * Inline validation for Tax Rules (PAYROLL_LOGIC.md §10 & DATABASE_SCHEMA.md §8):
   * Contiguous, ascending, non-overlapping bracket table; open-ended last bracket.
   */
  private validateTaxPayload(payload: Record<string, unknown>): void {
    if (!payload || typeof payload !== 'object') return;

    // 1. Unified / Default Brackets validation
    if (Array.isArray(payload.brackets)) {
      const res = validateTaxBrackets(payload.brackets as TaxBracketRow[]);
      if (!res.isValid) {
        throw new BadRequestException({
          code: 'INVALID_TAX_BRACKETS',
          message: res.summaryError || 'Invalid tax brackets structure.',
          details: res.errors,
        });
      }
    }

    // 2. Filing Status variants validation
    if (payload.hasFilingStatuses && Array.isArray(payload.filingStatuses)) {
      for (const fs of payload.filingStatuses as FilingStatusTaxConfig[]) {
        if (Array.isArray(fs.brackets)) {
          const res = validateTaxBrackets(fs.brackets);
          if (!res.isValid) {
            throw new BadRequestException({
              code: 'INVALID_TAX_BRACKETS',
              message: `Filing Status "${fs.label || fs.statusKey}": ${res.summaryError}`,
              details: res.errors,
            });
          }
        }
      }
    }
  }

  /**
   * Inline validation for Social Security / Pension Rules (MODULES.md §21 & PAYROLL_LOGIC.md §4):
   * Employee and employer rates, wage ceilings/floors, contribution frequency, and fund details.
   */
  private validateSocialSecurityPayload(
    payload: Record<string, unknown>,
  ): void {
    if (!payload || typeof payload !== 'object') return;

    const typedPayload =
      payload as unknown as Partial<SocialSecurityRulePayload>;
    const employerRate =
      typedPayload.employerContributionRate ?? typedPayload.employerRate;
    const employeeRate =
      typedPayload.employeeContributionRate ?? typedPayload.employeeRate;

    const res = validateSocialSecurityPayload({
      ...typedPayload,
      employerContributionRate: employerRate,
      employeeContributionRate: employeeRate,
    });

    if (!res.isValid) {
      throw new BadRequestException({
        code: 'INVALID_SOCIAL_SECURITY_RULES',
        message:
          res.summaryError ||
          'Invalid social security or pension rules configuration.',
        details: res.errors,
      });
    }
  }

  private validateLeavePayload(payload: unknown): void {
    const res = validateLeaveRulePayload(payload);
    if (!res.isValid) {
      throw new BadRequestException({
        code: 'INVALID_LEAVE_RULE_PAYLOAD',
        message:
          res.summaryError ||
          'Invalid statutory leave rules configuration.',
        details: res.errors,
      });
    }
  }

  private validateWorkingHoursOtPayload(payload: unknown): void {
    const res = validateWorkingHoursOtPayload(payload);
    if (!res.isValid) {
      throw new BadRequestException({
        code: 'INVALID_WORKING_HOURS_OT_PAYLOAD',
        message:
          res.summaryError ||
          'Invalid working hours and overtime rules configuration.',
        details: res.errors,
      });
    }
  }

  private validateEmploymentTerminationPayload(payload: unknown): void {
    const res = validateEmploymentTerminationPayload(payload);
    if (!res.isValid) {
      throw new BadRequestException({
        code: 'INVALID_EMPLOYMENT_TERMINATION_PAYLOAD',
        message:
          res.summaryError ||
          'Invalid employment and termination rules configuration.',
        details: res.errors,
      });
    }
  }

  private validatePublicHolidayPayload(payload: unknown): void {
    const res = validatePublicHolidayPayload(payload);
    if (!res.isValid) {
      throw new BadRequestException({
        code: 'INVALID_PUBLIC_HOLIDAY_PAYLOAD',
        message: res.summaryError || 'Invalid public holiday configuration.',
        details: res.errors,
      });
    }
  }

  /**
   * Synchronize published or draft tax rule to tax_brackets table.
   */
  private async syncTaxBracketTable(
    countryId: string,
    rule: CountryRule,
  ): Promise<void> {
    if (rule.ruleType !== 'tax') return;
    const payload = (rule.payload as Record<string, unknown>) || {};
    const taxYear =
      typeof payload.taxYear === 'number'
        ? payload.taxYear
        : rule.effectiveFrom.getFullYear();

    const existing = await this.prisma.unscoped.taxBracket.findFirst({
      where: {
        countryId,
        stateProvinceId: rule.stateProvinceId,
        version: rule.version,
      },
    });

    if (existing) {
      await this.prisma.unscoped.taxBracket.update({
        where: { id: existing.id },
        data: {
          taxYear,
          bracketJson: rule.payload as Prisma.InputJsonValue,
          effectiveFrom: rule.effectiveFrom,
          effectiveTo: rule.effectiveTo,
          status: rule.status,
          sourceReference: rule.sourceReference,
          changeNote: rule.changeNote,
          createdBy: rule.createdBy,
        },
      });
    } else {
      await this.prisma.unscoped.taxBracket.create({
        data: {
          countryId,
          stateProvinceId: rule.stateProvinceId,
          taxYear,
          bracketJson: rule.payload as Prisma.InputJsonValue,
          effectiveFrom: rule.effectiveFrom,
          effectiveTo: rule.effectiveTo,
          status: rule.status,
          sourceReference: rule.sourceReference,
          changeNote: rule.changeNote,
          createdBy: rule.createdBy,
          version: rule.version,
        },
      });
    }
  }
}
