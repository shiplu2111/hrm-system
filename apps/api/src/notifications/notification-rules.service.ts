import { Injectable } from '@nestjs/common';
import { TenantSettingCategory } from '@prisma/client';
import type { NotificationEmitInput } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import {
  mergeNotificationRules,
  notificationRulesKeyForCompany,
  parseStoredNotificationRules,
} from './notification.constants';

@Injectable()
export class NotificationRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async getRuleForEvent(
    companyId: string,
    eventType: NotificationEmitInput['eventType'],
  ) {
    const tenantId = await this.resolveTenantId(companyId);
    const key = notificationRulesKeyForCompany(companyId);
    const row = await this.prisma.unscoped.tenantSetting.findUnique({
      where: {
        tenantId_category_key: {
          tenantId,
          category: TenantSettingCategory.notification,
          key,
        },
      },
    });

    const overrides = row ? parseStoredNotificationRules(row.value) : null;
    const rules = mergeNotificationRules(overrides);
    return rules[eventType];
  }

  private async resolveTenantId(companyId: string): Promise<string> {
    const company = await this.prisma.unscoped.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { tenantId: true },
    });
    return company.tenantId;
  }
}
