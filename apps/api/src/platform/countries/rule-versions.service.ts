import {
  BadRequestException,
  ConflictException,
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
  type FilingStatusTaxConfig,
  type RuleVersionDiffResult,
  type RuleVersionMetadataDiff,
  type RuleVersionPayloadFieldDiff,
  type RuleVersionView,
  type SocialSecurityRulePayload,
  type TaxBracketRow,
  validateSocialSecurityPayload,
  validateTaxBrackets,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import {
  CreateRuleVersionDto,
  QueryRuleVersionsDto,
  UpdateRuleVersionDto,
} from './dto/rule-version.dto';

@Injectable()
export class RuleVersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: PlatformAuditService,
  ) {}

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
   * Publish a rule version (transition from draft/pending_approval to published).
   */
  async publishVersion(
    countryId: string,
    versionId: string,
    userId: string,
  ): Promise<RuleVersionView> {
    const existing = await this.assertRuleVersionOwned(countryId, versionId);
    if (existing.status === 'published') {
      return this.toView(existing);
    }

    // Overlap validation
    await this.assertNoPublishedOverlap(
      countryId,
      existing.stateProvinceId,
      existing.ruleType,
      existing.effectiveFrom,
      existing.effectiveTo,
      existing.id,
    );

    const oldView = this.toView(existing);

    const updated = await this.prisma.unscoped.countryRule.update({
      where: { id: versionId },
      data: {
        status: 'published',
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
      userId,
      action: 'country_rule_version.publish',
      module: 'country_rules',
      recordId: updated.id,
      reason: `Published version ${updated.version} (${updated.effectiveFrom.toISOString().slice(0, 10)})`,
      oldValue: oldView,
      newValue: newView,
    });

    return newView;
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
