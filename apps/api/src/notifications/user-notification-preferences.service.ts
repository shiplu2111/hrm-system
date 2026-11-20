import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { TenantSettingCategory, type Prisma } from '@prisma/client';
import {
  getNotificationCategoryForEvent,
  isCriticalNotificationCategory,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationCategoryChannelPreference,
  type UserNotificationPreferencesView,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { FirebasePushService } from '../push/firebase-push.service';
import { SmtpSettingsService } from '../settings/smtp-settings.service';
import type { UpdateUserNotificationPreferencesDto } from './dto/user-notification-preferences.dto';

export type StoredUserPreferencesMap = Record<
  string,
  { inApp?: boolean; email?: boolean; push?: boolean }
>;

@Injectable()
export class UserNotificationPreferencesService {
  private readonly logger = new Logger(UserNotificationPreferencesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smtpSettings: SmtpSettingsService,
    private readonly firebasePush: FirebasePushService,
  ) {}

  private userPreferencesKey(userId: string): string {
    return `user_preferences:${userId}`;
  }

  async resolveCompanyIdForUser(user: AuthenticatedUser): Promise<string | null> {
    if (user.employeeId) {
      const employee = await this.prisma.unscoped.employee.findUnique({
        where: { id: user.employeeId },
        select: { companyId: true },
      });
      if (employee?.companyId) return employee.companyId;
    }

    if (user.tenantId) {
      const company = await this.prisma.unscoped.company.findFirst({
        where: { tenantId: user.tenantId },
        select: { id: true },
      });
      return company?.id ?? null;
    }

    return null;
  }

  async getPreferences(user: AuthenticatedUser): Promise<UserNotificationPreferencesView> {
    const tenantId = user.tenantId;
    if (!tenantId) {
      throw new BadRequestException({
        code: 'TENANT_REQUIRED',
        message: 'A tenant context is required to read notification preferences',
      });
    }

    const companyId = await this.resolveCompanyIdForUser(user);

    let smtpConfigured = false;
    if (companyId) {
      try {
        const smtpView = await this.smtpSettings.getSmtpSettings(companyId);
        smtpConfigured = smtpView.configured;
      } catch {
        smtpConfigured = false;
      }
    }

    const pushConfigured = this.firebasePush.isConfigured();

    const row = await this.prisma.unscoped.tenantSetting.findUnique({
      where: {
        tenantId_category_key: {
          tenantId,
          category: TenantSettingCategory.notification,
          key: this.userPreferencesKey(user.id),
        },
      },
    });

    const stored: StoredUserPreferencesMap =
      row && typeof row.value === 'object' && row.value !== null
        ? (row.value as StoredUserPreferencesMap)
        : {};

    const categories: NotificationCategoryChannelPreference[] = NOTIFICATION_CATEGORIES.map(
      (cat) => {
        const isCritical = isCriticalNotificationCategory(cat);
        const storedPref = stored[cat];

        if (isCritical) {
          return {
            category: cat,
            isCritical: true,
            inApp: true,
            email: true,
            push: storedPref?.push ?? true,
            companyAllowed: {
              inApp: true,
              email: true,
              push: pushConfigured,
            },
          };
        }

        return {
          category: cat,
          isCritical: false,
          inApp: storedPref?.inApp ?? true,
          email: storedPref?.email ?? true,
          push: storedPref?.push ?? true,
          companyAllowed: {
            inApp: true,
            email: smtpConfigured,
            push: pushConfigured,
          },
        };
      },
    );

    return {
      userId: user.id,
      categories,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }

  async updatePreferences(
    user: AuthenticatedUser,
    dto: UpdateUserNotificationPreferencesDto,
  ): Promise<UserNotificationPreferencesView> {
    const tenantId = user.tenantId;
    if (!tenantId) {
      throw new BadRequestException({
        code: 'TENANT_REQUIRED',
        message: 'A tenant context is required to update notification preferences',
      });
    }

    // Check for non-suppressible violation
    for (const item of dto.preferences) {
      if (isCriticalNotificationCategory(item.category)) {
        if (item.inApp === false || item.email === false) {
          throw new BadRequestException({
            code: 'CRITICAL_NOTIFICATION_NOT_SUPPRESSIBLE',
            message:
              'Critical security notifications (e.g. password changed, security alerts) are mandatory and cannot be disabled.',
          });
        }
      }
    }

    const row = await this.prisma.unscoped.tenantSetting.findUnique({
      where: {
        tenantId_category_key: {
          tenantId,
          category: TenantSettingCategory.notification,
          key: this.userPreferencesKey(user.id),
        },
      },
    });

    const currentMap: StoredUserPreferencesMap =
      row && typeof row.value === 'object' && row.value !== null
        ? { ...(row.value as StoredUserPreferencesMap) }
        : {};

    for (const item of dto.preferences) {
      const isCritical = isCriticalNotificationCategory(item.category);
      currentMap[item.category] = {
        inApp: isCritical ? true : item.inApp ?? true,
        email: isCritical ? true : item.email ?? true,
        push: item.push ?? true,
      };
    }

    await this.prisma.unscoped.tenantSetting.upsert({
      where: {
        tenantId_category_key: {
          tenantId,
          category: TenantSettingCategory.notification,
          key: this.userPreferencesKey(user.id),
        },
      },
      create: {
        tenantId,
        category: TenantSettingCategory.notification,
        key: this.userPreferencesKey(user.id),
        value: currentMap as unknown as Prisma.InputJsonValue,
        updatedBy: user.id,
      },
      update: {
        value: currentMap as unknown as Prisma.InputJsonValue,
        updatedBy: user.id,
      },
    });

    return this.getPreferences(user);
  }

  async shouldDeliverToUser(
    userId: string,
    tenantId: string,
    eventType: string,
    channel: 'inApp' | 'email' | 'push',
  ): Promise<boolean> {
    const category = getNotificationCategoryForEvent(eventType);

    // Critical notifications can never be suppressed for inApp and email (NOTIFICATION_LOGIC.md §8)
    if (isCriticalNotificationCategory(category)) {
      if (channel === 'inApp' || channel === 'email') {
        return true;
      }
    }

    try {
      const row = await this.prisma.unscoped.tenantSetting.findUnique({
        where: {
          tenantId_category_key: {
            tenantId,
            category: TenantSettingCategory.notification,
            key: this.userPreferencesKey(userId),
          },
        },
      });

      if (!row || typeof row.value !== 'object' || row.value === null) {
        return true;
      }

      const stored = row.value as StoredUserPreferencesMap;
      const catPref = stored[category];
      if (!catPref) return true;

      return catPref[channel] ?? true;
    } catch (err) {
      this.logger.warn(`Failed to check notification preference for user ${userId}: ${err}`);
      return true; // Default to delivering on transient error
    }
  }
}
