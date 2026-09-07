import { Injectable } from '@nestjs/common';
import { TenantApiKeyStatus, TenantOAuthClientStatus } from '@prisma/client';
import type { ApiAccessStatus } from '@hrm/shared-types';
import { PlanFeaturesService } from '../billing/plan-features.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ApiAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planFeatures: PlanFeaturesService,
  ) {}

  async getStatus(tenantId: string): Promise<ApiAccessStatus> {
    const plan = await this.planFeatures.getTenantPlanInfo(tenantId);
    const [activeKeyCount, activeOAuthClientCount] = await Promise.all([
      this.prisma.unscoped.tenantApiKey.count({
        where: { tenantId, status: TenantApiKeyStatus.active },
      }),
      this.prisma.unscoped.tenantOAuthClient.count({
        where: { tenantId, status: TenantOAuthClientStatus.active },
      }),
    ]);

    return {
      planId: plan.planId,
      apiAccessEnabled: plan.apiAccessEnabled,
      activeKeyCount,
      activeOAuthClientCount,
    };
  }
}
