import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type {
  AvailableTenantLanguage,
  CreateLanguagePackInput,
  ImportTranslationsInput,
  ImportTranslationsResult,
  MissingKeyItem,
  MissingKeysReport,
  NamespaceCompletenessSummary,
  PlatformLanguageDirection,
  PlatformLanguagePackDetail,
  PlatformLanguagePackSummary,
  SetLanguageAvailabilityInput,
  UpdateLanguagePackInput,
} from '@hrm/shared-types';
import { QueryLanguagePacksDto } from './dto/platform-language-packs.dto';

@Injectable()
export class PlatformLanguagePacksService implements OnModuleInit {
  private readonly logger = new Logger(PlatformLanguagePacksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.seedBaselineLanguagePacksIfEmpty();
  }

  // =========================================================================
  // Flatten / Unflatten / Merge Translation Helpers
  // =========================================================================

  flattenTranslations(
    obj: Record<string, any>,
    prefix = '',
  ): Record<string, string> {
    const flat: Record<string, string> = {};
    if (!obj || typeof obj !== 'object') return flat;

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        Object.assign(flat, this.flattenTranslations(value, fullKey));
      } else if (typeof value === 'string') {
        flat[fullKey] = value;
      } else if (value !== null && value !== undefined) {
        flat[fullKey] = String(value);
      }
    }
    return flat;
  }

  unflattenTranslations(flat: Record<string, string>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [flatKey, value] of Object.entries(flat)) {
      const parts = flatKey.split('.');
      let current = result;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part] || typeof current[part] !== 'object') {
          current[part] = {};
        }
        current = current[part];
      }
      current[parts[parts.length - 1]] = value;
    }
    return result;
  }

  deepMerge(target: any, source: any): any {
    if (!source || typeof source !== 'object') return target;
    const output = { ...target };
    for (const key of Object.keys(source)) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        if (key in target && typeof target[key] === 'object') {
          output[key] = this.deepMerge(target[key], source[key]);
        } else {
          output[key] = source[key];
        }
      } else {
        output[key] = source[key];
      }
    }
    return output;
  }

  calculateStats(
    baseFlat: Record<string, string>,
    targetFlat: Record<string, string>,
  ): {
    totalBaseKeys: number;
    translatedKeys: number;
    missingKeysCount: number;
    completenessPercent: number;
  } {
    const totalBaseKeys = Object.keys(baseFlat).length;
    if (totalBaseKeys === 0) {
      return {
        totalBaseKeys: 0,
        translatedKeys: 0,
        missingKeysCount: 0,
        completenessPercent: 100.0,
      };
    }

    let translatedKeys = 0;
    for (const [key, baseVal] of Object.entries(baseFlat)) {
      const targetVal = targetFlat[key];
      if (
        typeof targetVal === 'string' &&
        targetVal.trim().length > 0
      ) {
        translatedKeys++;
      }
    }

    const missingKeysCount = totalBaseKeys - translatedKeys;
    const completenessPercent = Number(
      ((translatedKeys / totalBaseKeys) * 100).toFixed(2),
    );

    return {
      totalBaseKeys,
      translatedKeys,
      missingKeysCount,
      completenessPercent,
    };
  }

  // =========================================================================
  // Baseline Seeder
  // =========================================================================

  async seedBaselineLanguagePacksIfEmpty(): Promise<void> {
    const count = await this.prisma.unscoped.platformLanguagePack.count();
    if (count > 0) {
      return;
    }

    this.logger.log('Seeding baseline platform language packs...');

    // Attempt to load official translation files from packages/i18n
    let enJson: Record<string, any> = {};
    let bnJson: Record<string, any> = {};

    try {
      const enPath = path.resolve(process.cwd(), 'packages/i18n/src/locales/en.json');
      const bnPath = path.resolve(process.cwd(), 'packages/i18n/src/locales/bn.json');

      if (fs.existsSync(enPath)) {
        enJson = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
      }
      if (fs.existsSync(bnPath)) {
        bnJson = JSON.parse(fs.readFileSync(bnPath, 'utf-8'));
      }
    } catch (err) {
      this.logger.warn(`Could not load i18n JSON files from filesystem: ${err}`);
    }

    // Fallback minimal dictionary if filesystem read failed
    if (Object.keys(enJson).length === 0) {
      enJson = {
        common: { save: 'Save', cancel: 'Cancel', search: 'Search', active: 'Active' },
        auth: { login: 'Sign In', logout: 'Sign Out' },
        nav: { dashboard: 'Dashboard', payroll: 'Payroll', attendance: 'Attendance' },
      };
      bnJson = {
        common: { save: 'সংরক্ষণ করুন', cancel: 'বাতিল করুন', search: 'অনুসন্ধান করুন', active: 'সক্রিয়' },
        auth: { login: 'লগইন করুন', logout: 'লগআউট' },
        nav: { dashboard: 'ড্যাশবোর্ড', payroll: 'বেতন বিল', attendance: 'উপস্থিতি' },
      };
    }

    const enFlat = this.flattenTranslations(enJson);
    const bnFlat = this.flattenTranslations(bnJson);

    const enStats = this.calculateStats(enFlat, enFlat);
    const bnStats = this.calculateStats(enFlat, bnFlat);

    // Baseline packs to seed
    const baselinePacks: Array<{
      code: string;
      name: string;
      nativeName: string;
      direction: string;
      isAvailableToTenants: boolean;
      isDefault: boolean;
      translations: Record<string, any>;
      notes: string;
      translatedKeysRatio?: number; // slice of keys to translate for partial packs
    }> = [
      {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        direction: 'ltr',
        isAvailableToTenants: true,
        isDefault: true,
        translations: enJson,
        notes: 'Global platform canonical reference language pack (100% complete).',
      },
      {
        code: 'bn',
        name: 'Bengali',
        nativeName: 'বাংলা',
        direction: 'ltr',
        isAvailableToTenants: true,
        isDefault: false,
        translations: bnJson,
        notes: 'Official localization for Bangladesh statutory jurisdiction (100% complete).',
      },
      {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
        direction: 'ltr',
        isAvailableToTenants: false,
        isDefault: false,
        translations: {},
        notes: 'Spanish language pack for Latin America and Spain (in progress).',
        translatedKeysRatio: 0.68,
      },
      {
        code: 'fr',
        name: 'French',
        nativeName: 'Français',
        direction: 'ltr',
        isAvailableToTenants: false,
        isDefault: false,
        translations: {},
        notes: 'French language pack for France and Francophone regions (in progress).',
        translatedKeysRatio: 0.42,
      },
      {
        code: 'de',
        name: 'German',
        nativeName: 'Deutsch',
        direction: 'ltr',
        isAvailableToTenants: false,
        isDefault: false,
        translations: {},
        notes: 'German language pack (DACH region translation in draft review).',
        translatedKeysRatio: 0.31,
      },
      {
        code: 'ar',
        name: 'Arabic',
        nativeName: 'العربية',
        direction: 'rtl',
        isAvailableToTenants: false,
        isDefault: false,
        translations: {},
        notes: 'Arabic Right-to-Left (RTL) language pack for UAE/GCC compliance.',
        translatedKeysRatio: 0.22,
      },
    ];

    const enKeys = Object.keys(enFlat);

    for (const pack of baselinePacks) {
      let finalTranslations = pack.translations;
      let finalFlat: Record<string, string> = {};

      if (pack.translatedKeysRatio && pack.translatedKeysRatio > 0) {
        // Construct partial translations to reflect realistic completeness
        const targetCount = Math.floor(enKeys.length * pack.translatedKeysRatio);
        const partialFlat: Record<string, string> = {};

        for (let i = 0; i < targetCount; i++) {
          const k = enKeys[i];
          const baseText = enFlat[k];
          // Simple simulated localized string based on language prefix
          partialFlat[k] = `[${pack.code.toUpperCase()}] ${baseText}`;
        }
        finalFlat = partialFlat;
        finalTranslations = this.unflattenTranslations(partialFlat);
      } else {
        finalFlat = this.flattenTranslations(finalTranslations);
      }

      const stats = this.calculateStats(enFlat, finalFlat);

      await this.prisma.unscoped.platformLanguagePack.create({
        data: {
          code: pack.code,
          name: pack.name,
          nativeName: pack.nativeName,
          direction: pack.direction,
          isAvailableToTenants: pack.isAvailableToTenants,
          isDefault: pack.isDefault,
          totalKeys: stats.totalBaseKeys,
          translatedKeys: stats.translatedKeys,
          completenessPercent: new Prisma.Decimal(stats.completenessPercent),
          version: '1.0.0',
          translations: finalTranslations as Prisma.InputJsonValue,
          notes: pack.notes,
        },
      });
    }

    this.logger.log(`Seeded ${baselinePacks.length} baseline platform language packs.`);
  }

  // =========================================================================
  // Query & Read Operations
  // =========================================================================

  async listLanguagePacks(
    query?: QueryLanguagePacksDto,
  ): Promise<PlatformLanguagePackSummary[]> {
    const where: Prisma.PlatformLanguagePackWhereInput = {};

    if (query?.availableOnly) {
      where.isAvailableToTenants = true;
    }

    if (query?.search) {
      const s = query.search.trim().toLowerCase();
      where.OR = [
        { code: { contains: s, mode: 'insensitive' } },
        { name: { contains: s, mode: 'insensitive' } },
        { nativeName: { contains: s, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.unscoped.platformLanguagePack.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { completenessPercent: 'desc' }, { code: 'asc' }],
    });

    return rows.map((r) => this.mapToSummary(r));
  }

  async getLanguagePack(code: string): Promise<PlatformLanguagePackDetail> {
    const pack = await this.prisma.unscoped.platformLanguagePack.findUnique({
      where: { code: code.toLowerCase() },
    });

    if (!pack) {
      throw new NotFoundException(`Language pack with code "${code}" was not found.`);
    }

    const summary = this.mapToSummary(pack);
    return {
      ...summary,
      translations: (pack.translations as Record<string, any>) || {},
    };
  }

  async listAvailableForTenants(): Promise<AvailableTenantLanguage[]> {
    const rows = await this.prisma.unscoped.platformLanguagePack.findMany({
      where: { isAvailableToTenants: true },
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
      select: {
        code: true,
        name: true,
        nativeName: true,
        direction: true,
        isDefault: true,
      },
    });

    return rows.map((r) => ({
      code: r.code,
      name: r.name,
      nativeName: r.nativeName,
      direction: r.direction as PlatformLanguageDirection,
      isDefault: r.isDefault,
    }));
  }

  // =========================================================================
  // Missing-Keys Report
  // =========================================================================

  async getMissingKeysReport(code: string): Promise<MissingKeysReport> {
    const targetPack = await this.prisma.unscoped.platformLanguagePack.findUnique({
      where: { code: code.toLowerCase() },
    });

    if (!targetPack) {
      throw new NotFoundException(`Language pack with code "${code}" was not found.`);
    }

    // Default canonical language is English (or the language marked isDefault)
    const basePack = await this.prisma.unscoped.platformLanguagePack.findFirst({
      where: { isDefault: true },
    });

    if (!basePack) {
      throw new NotFoundException('Base default language pack not configured.');
    }

    const baseTranslations = (basePack.translations as Record<string, any>) || {};
    const targetTranslations = (targetPack.translations as Record<string, any>) || {};

    const baseFlat = this.flattenTranslations(baseTranslations);
    const targetFlat = this.flattenTranslations(targetTranslations);

    const missingKeys: MissingKeyItem[] = [];
    const namespaceMap = new Map<
      string,
      { total: number; translated: number; missing: number }
    >();

    for (const [key, baseValue] of Object.entries(baseFlat)) {
      const ns = key.split('.')[0] || 'common';
      if (!namespaceMap.has(ns)) {
        namespaceMap.set(ns, { total: 0, translated: 0, missing: 0 });
      }
      const nsStats = namespaceMap.get(ns)!;
      nsStats.total++;

      const targetValue = targetFlat[key];
      const isMissing = targetValue === undefined || targetValue === null;
      const isEmpty = typeof targetValue === 'string' && targetValue.trim().length === 0;

      if (isMissing || isEmpty) {
        nsStats.missing++;
        missingKeys.push({
          key,
          namespace: ns,
          baseValue: typeof baseValue === 'string' ? baseValue : String(baseValue),
          status: isMissing ? 'missing' : 'empty',
        });
      } else {
        nsStats.translated++;
      }
    }

    const namespaces: NamespaceCompletenessSummary[] = Array.from(
      namespaceMap.entries(),
    ).map(([namespace, stats]) => ({
      namespace,
      totalKeys: stats.total,
      translatedKeys: stats.translated,
      missingKeys: stats.missing,
      completenessPercent: Number(
        stats.total > 0
          ? ((stats.translated / stats.total) * 100).toFixed(1)
          : 100.0,
      ),
    })).sort((a, b) => a.namespace.localeCompare(b.namespace));

    const totalBaseKeys = Object.keys(baseFlat).length;
    const translatedKeys = totalBaseKeys - missingKeys.length;
    const completenessPercent = Number(
      totalBaseKeys > 0
        ? ((translatedKeys / totalBaseKeys) * 100).toFixed(2)
        : 100.0,
    );

    return {
      languageCode: targetPack.code,
      languageName: targetPack.name,
      baseLanguageCode: basePack.code,
      totalBaseKeys,
      translatedKeys,
      missingKeysCount: missingKeys.length,
      completenessPercent,
      namespaces,
      missingKeys,
    };
  }

  // =========================================================================
  // Import & Export
  // =========================================================================

  async exportTranslations(
    code: string,
    format: 'nested' | 'flat' | 'missing-template' = 'nested',
  ): Promise<{ filename: string; contentType: string; data: Record<string, any> }> {
    const pack = await this.prisma.unscoped.platformLanguagePack.findUnique({
      where: { code: code.toLowerCase() },
    });

    if (!pack) {
      throw new NotFoundException(`Language pack "${code}" was not found.`);
    }

    let payload: Record<string, any> = {};

    if (format === 'missing-template') {
      const report = await this.getMissingKeysReport(code);
      const template: Record<string, string> = {};
      for (const item of report.missingKeys) {
        template[item.key] = '';
      }
      payload = this.unflattenTranslations(template);
    } else if (format === 'flat') {
      payload = this.flattenTranslations((pack.translations as Record<string, any>) || {});
    } else {
      payload = (pack.translations as Record<string, any>) || {};
    }

    // Touch last exported timestamp
    await this.prisma.unscoped.platformLanguagePack.update({
      where: { id: pack.id },
      data: { lastExportedAt: new Date() },
    });

    return {
      filename: `${pack.code}-${format === 'missing-template' ? 'missing-keys' : 'translations'}.json`,
      contentType: 'application/json',
      data: payload,
    };
  }

  async importTranslations(
    code: string,
    input: ImportTranslationsInput,
    userId?: string,
  ): Promise<ImportTranslationsResult> {
    const pack = await this.prisma.unscoped.platformLanguagePack.findUnique({
      where: { code: code.toLowerCase() },
    });

    if (!pack) {
      throw new NotFoundException(`Language pack "${code}" was not found.`);
    }

    if (!input.translations || typeof input.translations !== 'object') {
      throw new BadRequestException('Import data must be a valid JSON object.');
    }

    // Load base language for reference count
    const basePack = await this.prisma.unscoped.platformLanguagePack.findFirst({
      where: { isDefault: true },
    });

    const baseFlat = basePack
      ? this.flattenTranslations((basePack.translations as Record<string, any>) || {})
      : {};

    const incomingFlat = this.flattenTranslations(input.translations);
    const existingTranslations = (pack.translations as Record<string, any>) || {};

    let mergedTranslations: Record<string, any> = {};
    if (input.mode === 'replace') {
      mergedTranslations = input.translations;
    } else {
      // Default: deep merge incoming on top of existing
      mergedTranslations = this.deepMerge(existingTranslations, input.translations);
    }

    const mergedFlat = this.flattenTranslations(mergedTranslations);
    const stats = this.calculateStats(baseFlat, mergedFlat);

    let isAvailableToTenants = pack.isAvailableToTenants;
    if (input.markAvailableIfComplete && stats.completenessPercent >= 95.0) {
      isAvailableToTenants = true;
    }

    // Bump minor version on import
    const versionParts = pack.version.split('.');
    const nextMinor = Number(versionParts[1] || '0') + 1;
    const nextVersion = `${versionParts[0] || '1'}.${nextMinor}.0`;

    const updated = await this.prisma.unscoped.platformLanguagePack.update({
      where: { id: pack.id },
      data: {
        translations: mergedTranslations as Prisma.InputJsonValue,
        totalKeys: stats.totalBaseKeys,
        translatedKeys: stats.translatedKeys,
        completenessPercent: new Prisma.Decimal(stats.completenessPercent),
        version: nextVersion,
        isAvailableToTenants,
        lastImportedAt: new Date(),
        notes: input.notes ?? pack.notes,
      },
    });

    // Record in Audit Log
    if (userId) {
      await this.auditService.log({
        tenantId: null,
        userId,
        action: 'update',
        module: 'PlatformLanguagePacks',
        recordId: pack.id,
        oldValue: {
          completeness: Number(pack.completenessPercent),
          translatedKeys: pack.translatedKeys,
          version: pack.version,
        },
        newValue: {
          completeness: stats.completenessPercent,
          translatedKeys: stats.translatedKeys,
          version: nextVersion,
          importedKeysCount: Object.keys(incomingFlat).length,
        },
      });
    }

    return {
      code: updated.code,
      totalKeys: stats.totalBaseKeys,
      translatedKeys: stats.translatedKeys,
      missingKeysCount: stats.missingKeysCount,
      completenessPercent: stats.completenessPercent,
      importedKeysCount: Object.keys(incomingFlat).length,
      isAvailableToTenants: updated.isAvailableToTenants,
      version: updated.version,
    };
  }

  // =========================================================================
  // Tenant Availability & Mutations
  // =========================================================================

  async setAvailability(
    code: string,
    input: SetLanguageAvailabilityInput,
    userId?: string,
  ): Promise<PlatformLanguagePackSummary> {
    const pack = await this.prisma.unscoped.platformLanguagePack.findUnique({
      where: { code: code.toLowerCase() },
    });

    if (!pack) {
      throw new NotFoundException(`Language pack "${code}" was not found.`);
    }

    // Baseline default language (en) must always remain available to tenants
    if (pack.isDefault && !input.isAvailableToTenants) {
      throw new BadRequestException(
        `Cannot disable tenant availability for the canonical default language pack (${pack.code.toUpperCase()}).`,
      );
    }

    const updated = await this.prisma.unscoped.platformLanguagePack.update({
      where: { id: pack.id },
      data: {
        isAvailableToTenants: input.isAvailableToTenants,
      },
    });

    if (userId) {
      await this.auditService.log({
        tenantId: null,
        userId,
        action: 'update',
        module: 'PlatformLanguagePacks',
        recordId: pack.id,
        oldValue: { isAvailableToTenants: pack.isAvailableToTenants },
        newValue: {
          isAvailableToTenants: input.isAvailableToTenants,
          reason: input.reason ?? null,
        },
      });
    }

    return this.mapToSummary(updated);
  }

  async createLanguagePack(
    input: CreateLanguagePackInput,
    userId?: string,
  ): Promise<PlatformLanguagePackDetail> {
    const code = input.code.toLowerCase().trim();

    const existing = await this.prisma.unscoped.platformLanguagePack.findUnique({
      where: { code },
    });

    if (existing) {
      throw new ConflictException(
        `Language pack with code "${code}" already exists.`,
      );
    }

    const basePack = await this.prisma.unscoped.platformLanguagePack.findFirst({
      where: { isDefault: true },
    });

    const baseFlat = basePack
      ? this.flattenTranslations((basePack.translations as Record<string, any>) || {})
      : {};

    const incomingTranslations = input.translations || {};
    const incomingFlat = this.flattenTranslations(incomingTranslations);
    const stats = this.calculateStats(baseFlat, incomingFlat);

    const created = await this.prisma.unscoped.platformLanguagePack.create({
      data: {
        code,
        name: input.name.trim(),
        nativeName: input.nativeName.trim(),
        direction: input.direction || 'ltr',
        isAvailableToTenants: input.isAvailableToTenants || false,
        isDefault: false,
        totalKeys: stats.totalBaseKeys,
        translatedKeys: stats.translatedKeys,
        completenessPercent: new Prisma.Decimal(stats.completenessPercent),
        version: '1.0.0',
        translations: incomingTranslations as Prisma.InputJsonValue,
        notes: input.notes,
        createdByUserId: userId,
      },
    });

    if (userId) {
      await this.auditService.log({
        tenantId: null,
        userId,
        action: 'create',
        module: 'PlatformLanguagePacks',
        recordId: created.id,
        newValue: {
          code: created.code,
          name: created.name,
          completeness: stats.completenessPercent,
        },
      });
    }

    return {
      ...this.mapToSummary(created),
      translations: incomingTranslations,
    };
  }

  async updateLanguagePack(
    code: string,
    input: UpdateLanguagePackInput,
    userId?: string,
  ): Promise<PlatformLanguagePackSummary> {
    const pack = await this.prisma.unscoped.platformLanguagePack.findUnique({
      where: { code: code.toLowerCase() },
    });

    if (!pack) {
      throw new NotFoundException(`Language pack "${code}" was not found.`);
    }

    if (
      pack.isDefault &&
      input.isAvailableToTenants !== undefined &&
      !input.isAvailableToTenants
    ) {
      throw new BadRequestException(
        'Cannot disable tenant availability for the canonical default language pack.',
      );
    }

    const updated = await this.prisma.unscoped.platformLanguagePack.update({
      where: { id: pack.id },
      data: {
        name: input.name?.trim(),
        nativeName: input.nativeName?.trim(),
        direction: input.direction,
        isAvailableToTenants: input.isAvailableToTenants,
        notes: input.notes,
        version: input.version,
      },
    });

    if (userId) {
      await this.auditService.log({
        tenantId: null,
        userId,
        action: 'update',
        module: 'PlatformLanguagePacks',
        recordId: pack.id,
        oldValue: {
          name: pack.name,
          nativeName: pack.nativeName,
          direction: pack.direction,
          isAvailableToTenants: pack.isAvailableToTenants,
        },
        newValue: {
          name: updated.name,
          nativeName: updated.nativeName,
          direction: updated.direction,
          isAvailableToTenants: updated.isAvailableToTenants,
        },
      });
    }

    return this.mapToSummary(updated);
  }

  // =========================================================================
  // Mapper
  // =========================================================================

  private mapToSummary(r: any): PlatformLanguagePackSummary {
    const completeness = Number(r.completenessPercent);
    const missingKeysCount = Math.max(0, r.totalKeys - r.translatedKeys);

    return {
      id: r.id,
      code: r.code,
      name: r.name,
      nativeName: r.nativeName,
      direction: r.direction as PlatformLanguageDirection,
      isAvailableToTenants: r.isAvailableToTenants,
      isDefault: r.isDefault,
      totalKeys: r.totalKeys,
      translatedKeys: r.translatedKeys,
      missingKeysCount,
      completenessPercent: completeness,
      version: r.version,
      notes: r.notes,
      lastImportedAt: r.lastImportedAt ? r.lastImportedAt.toISOString() : null,
      lastExportedAt: r.lastExportedAt ? r.lastExportedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
