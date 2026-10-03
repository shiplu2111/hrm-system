import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantSettingCategory, type Prisma } from '@prisma/client';
import type {
  NotificationEventSettingsView,
  UpdateNotificationEventSettingsInput,
} from '@hrm/shared-types';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { FirebasePushService } from '../push/firebase-push.service';
import {
  mergeRealtimeSettings,
  parseStoredRealtimeSettings,
  realtimeSettingsKeyForCompany,
} from '../realtime/realtime.constants';
import { SmtpSettingsService } from '../settings/smtp-settings.service';
import {
  mergeNotificationRules,
  notificationRulesKeyForCompany,
  parseStoredNotificationRules,
} from './notification.constants';
import {
  applyEventUpdates,
  diffEventSettings,
  toEventSettings,
  type EventSettingsState,
} from './notification-settings.utils';

type SettingRow = { id: string; value: Prisma.JsonValue; updatedAt: Date };

@Injectable()
export class NotificationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly audit: AuditService,
    private readonly smtpSettings: SmtpSettingsService,
    private readonly firebasePush: FirebasePushService,
  ) {}

  async getSettings(companyId: string): Promise<NotificationEventSettingsView> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const [rows, smtp] = await Promise.all([
      this.findRows(companyId),
      this.smtpSettings.getSmtpSettings(companyId),
    ]);
    const state = this.toState(rows);
    return {
      realtimeEnabled: state.realtimeEnabled,
      events: toEventSettings(state),
      channelStatus: {
        email: { configured: smtp.configured && smtp.passwordConfigured },
        push: { configured: this.firebasePush.isConfigured() },
      },
      updatedAt: latest(rows.rules?.updatedAt, rows.realtime?.updatedAt),
    };
  }

  async updateSettings(
    companyId: string,
    input: UpdateNotificationEventSettingsInput,
    user: AuthenticatedUser,
    meta?: { ipAddress?: string; device?: string },
  ): Promise<NotificationEventSettingsView> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const seen = new Set<string>();
    for (const event of input.events) {
      if (seen.has(event.eventType)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `Event ${event.eventType} is listed more than once`,
        });
      }
      seen.add(event.eventType);
    }

    const rows = await this.findRows(companyId);
    const current = this.toState(rows);
    const next = applyEventUpdates(current, input);
    const diff = diffEventSettings(current, next);
    if (!diff.rules && !diff.realtime) return this.getSettings(companyId);

    const tenantId = company.tenantId;
    await this.prisma.unscoped.$transaction(async (tx) => {
      if (diff.rules) {
        const row = await tx.tenantSetting.upsert({
          where: {
            tenantId_category_key: {
              tenantId,
              category: TenantSettingCategory.notification,
              key: notificationRulesKeyForCompany(companyId),
            },
          },
          create: {
            tenantId,
            category: TenantSettingCategory.notification,
            key: notificationRulesKeyForCompany(companyId),
            value: next.rules as object,
            updatedBy: user.id,
          },
          update: { value: next.rules as object, updatedBy: user.id },
        });
        await this.audit.log(
          {
            tenantId,
            userId: user.id,
            action: rows.rules ? 'update' : 'create',
            module: 'settings',
            recordId: row.id,
            oldValue: diff.rules.before,
            newValue: diff.rules.after,
            ipAddress: meta?.ipAddress,
            device: meta?.device,
          },
          tx,
        );
      }

      if (diff.realtime) {
        const value = { enabled: next.realtimeEnabled, liveBroadcast: next.liveBroadcast };
        const row = await tx.tenantSetting.upsert({
          where: {
            tenantId_category_key: {
              tenantId,
              category: TenantSettingCategory.notification,
              key: realtimeSettingsKeyForCompany(companyId),
            },
          },
          create: {
            tenantId,
            category: TenantSettingCategory.notification,
            key: realtimeSettingsKeyForCompany(companyId),
            value,
            updatedBy: user.id,
          },
          update: { value, updatedBy: user.id },
        });
        await this.audit.log(
          {
            tenantId,
            userId: user.id,
            action: rows.realtime ? 'update' : 'create',
            module: 'settings',
            recordId: row.id,
            oldValue: diff.realtime.before,
            newValue: diff.realtime.after,
            ipAddress: meta?.ipAddress,
            device: meta?.device,
          },
          tx,
        );
      }
    });

    return this.getSettings(companyId);
  }

  private toState(rows: { rules: SettingRow | null; realtime: SettingRow | null }): EventSettingsState {
    const rules = mergeNotificationRules(
      rows.rules ? parseStoredNotificationRules(rows.rules.value) : null,
    );
    const realtime = mergeRealtimeSettings(
      rows.realtime ? parseStoredRealtimeSettings(rows.realtime.value) : null,
      null,
    );
    return { rules, realtimeEnabled: realtime.enabled, liveBroadcast: realtime.liveBroadcast };
  }

  private async findRows(companyId: string) {
    const tenantId = this.companyScope.requireTenantId();
    const find = (key: string) =>
      this.prisma.unscoped.tenantSetting.findUnique({
        where: {
          tenantId_category_key: {
            tenantId,
            category: TenantSettingCategory.notification,
            key,
          },
        },
        select: { id: true, value: true, updatedAt: true },
      });
    const [rules, realtime] = await Promise.all([
      find(notificationRulesKeyForCompany(companyId)),
      find(realtimeSettingsKeyForCompany(companyId)),
    ]);
    return { rules, realtime };
  }
}

function latest(...dates: Array<Date | undefined>): string | null {
  const times = dates.filter((d): d is Date => !!d).map((d) => d.getTime());
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}
