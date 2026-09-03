import { Injectable } from '@nestjs/common';
import { TenantSettingCategory } from '@prisma/client';
import type {
  NotificationEventType,
  RealtimeNotificationSettingsView,
} from '@hrm/shared-types';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type { UpdateRealtimeNotificationSettingsDto } from './dto/realtime-settings.dto';
import {
  DEFAULT_REALTIME_BROADCAST,
  DEFAULT_REALTIME_NOTIFICATION_SETTINGS,
  mergeRealtimeSettings,
  parseStoredRealtimeSettings,
  realtimeSettingsKeyForCompany,
  sanitizeRealtimeSettingsForAudit,
  shouldLiveBroadcast,
  type StoredRealtimeNotificationSettings,
} from './realtime.constants';

@Injectable()
export class RealtimeNotificationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async getSettings(
    companyId: string,
  ): Promise<RealtimeNotificationSettingsView> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const row = await this.findSettingRow(companyId);
    const stored = row ? parseStoredRealtimeSettings(row.value) : null;
    return mergeRealtimeSettings(stored, row?.updatedAt.toISOString() ?? null);
  }

  async updateSettings(
    companyId: string,
    dto: UpdateRealtimeNotificationSettingsDto,
    user: AuthenticatedUser,
    meta?: { ipAddress?: string; device?: string },
  ): Promise<RealtimeNotificationSettingsView> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const key = realtimeSettingsKeyForCompany(companyId);
    const existingRow = await this.findSettingRow(companyId);
    const existingStored = existingRow
      ? parseStoredRealtimeSettings(existingRow.value)
      : null;

    const nextStored: StoredRealtimeNotificationSettings = {
      enabled: dto.enabled,
      liveBroadcast: {
        ...DEFAULT_REALTIME_BROADCAST,
        ...dto.liveBroadcast,
      },
    };

    const row = await this.prisma.unscoped.tenantSetting.upsert({
      where: {
        tenantId_category_key: {
          tenantId: company.tenantId,
          category: TenantSettingCategory.notification,
          key,
        },
      },
      create: {
        tenantId: company.tenantId,
        category: TenantSettingCategory.notification,
        key,
        value: nextStored as object,
        updatedBy: user.id,
      },
      update: {
        value: nextStored as object,
        updatedBy: user.id,
      },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: existingRow ? 'update' : 'create',
      module: 'settings',
      recordId: row.id,
      oldValue: sanitizeRealtimeSettingsForAudit(existingStored),
      newValue: sanitizeRealtimeSettingsForAudit(nextStored),
      ipAddress: meta?.ipAddress,
      device: meta?.device,
    });

    return mergeRealtimeSettings(nextStored, row.updatedAt.toISOString());
  }

  async shouldBroadcastLive(
    companyId: string,
    eventType: NotificationEventType,
  ): Promise<boolean> {
    const settings = await this.getSettings(companyId);
    return shouldLiveBroadcast(settings, eventType);
  }

  private async findSettingRow(companyId: string) {
    const tenantId = this.companyScope.requireTenantId();
    const key = realtimeSettingsKeyForCompany(companyId);
    return this.prisma.unscoped.tenantSetting.findUnique({
      where: {
        tenantId_category_key: {
          tenantId,
          category: TenantSettingCategory.notification,
          key,
        },
      },
    });
  }
}
