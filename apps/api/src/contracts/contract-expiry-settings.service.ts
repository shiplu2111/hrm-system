import { Injectable } from '@nestjs/common';
import { TenantSettingCategory, type Prisma } from '@prisma/client';
import {
  CONTRACT_EXPIRY_WINDOW_DEFAULT_DAYS,
  CONTRACT_EXPIRY_WINDOW_MAX_DAYS,
  CONTRACT_EXPIRY_WINDOW_MIN_DAYS,
  type ContractExpiryAlertSettings,
  type UpdateContractExpiryAlertSettingsInput,
} from '@hrm/shared-types';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';

const KEY_SUFFIX = ':contract-expiry-alerts';

export function contractExpirySettingsKey(companyId: string): string {
  return `company:${companyId}${KEY_SUFFIX}`;
}

export function parseWindowDays(value: Prisma.JsonValue | undefined): number {
  const raw =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>).windowDays
      : undefined;
  if (
    typeof raw === 'number' &&
    Number.isInteger(raw) &&
    raw >= CONTRACT_EXPIRY_WINDOW_MIN_DAYS &&
    raw <= CONTRACT_EXPIRY_WINDOW_MAX_DAYS
  ) {
    return raw;
  }
  return CONTRACT_EXPIRY_WINDOW_DEFAULT_DAYS;
}

@Injectable()
export class ContractExpirySettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly audit: AuditService,
  ) {}

  /** Request-scoped read; the company must already be checked against the session tenant. */
  async getSettings(companyId: string): Promise<ContractExpiryAlertSettings> {
    const row = await this.findRow(this.companyScope.requireTenantId(), companyId);
    return {
      windowDays: parseWindowDays(row?.value),
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }

  async getWindowDays(companyId: string): Promise<number> {
    return (await this.getSettings(companyId)).windowDays;
  }

  /** Windows for many companies at once, for the background job (no session tenant). */
  async windowsForCompanies(
    companies: Array<{ tenantId: string; companyId: string }>,
  ): Promise<Map<string, number>> {
    const windows = new Map<string, number>();
    if (companies.length === 0) return windows;
    const rows = await this.prisma.unscoped.tenantSetting.findMany({
      where: {
        tenantId: { in: [...new Set(companies.map((c) => c.tenantId))] },
        category: TenantSettingCategory.notification,
        key: { in: companies.map((c) => contractExpirySettingsKey(c.companyId)) },
      },
      select: { tenantId: true, key: true, value: true },
    });
    const byKey = new Map(rows.map((row) => [`${row.tenantId}|${row.key}`, row.value]));
    for (const { tenantId, companyId } of companies) {
      windows.set(
        companyId,
        parseWindowDays(byKey.get(`${tenantId}|${contractExpirySettingsKey(companyId)}`)),
      );
    }
    return windows;
  }

  async updateSettings(
    companyId: string,
    input: UpdateContractExpiryAlertSettingsInput,
    user: AuthenticatedUser,
    meta?: { ipAddress?: string; device?: string },
  ): Promise<ContractExpiryAlertSettings> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const tenantId = company.tenantId;
    const existing = await this.findRow(tenantId, companyId);
    const before = parseWindowDays(existing?.value);
    if (existing && before === input.windowDays) return this.getSettings(companyId);

    const key = contractExpirySettingsKey(companyId);
    const value = { windowDays: input.windowDays };
    await this.prisma.unscoped.$transaction(async (tx) => {
      const row = await tx.tenantSetting.upsert({
        where: {
          tenantId_category_key: {
            tenantId,
            category: TenantSettingCategory.notification,
            key,
          },
        },
        create: {
          tenantId,
          category: TenantSettingCategory.notification,
          key,
          value,
          updatedBy: user.id,
        },
        update: { value, updatedBy: user.id },
      });
      await this.audit.log(
        {
          tenantId,
          userId: user.id,
          action: existing ? 'update' : 'create',
          module: 'settings',
          recordId: row.id,
          oldValue: { contractExpiryWindowDays: before },
          newValue: { contractExpiryWindowDays: input.windowDays },
          ipAddress: meta?.ipAddress,
          device: meta?.device,
        },
        tx,
      );
    });

    return this.getSettings(companyId);
  }

  private findRow(tenantId: string, companyId: string) {
    return this.prisma.unscoped.tenantSetting.findUnique({
      where: {
        tenantId_category_key: {
          tenantId,
          category: TenantSettingCategory.notification,
          key: contractExpirySettingsKey(companyId),
        },
      },
      select: { value: true, updatedAt: true },
    });
  }
}
