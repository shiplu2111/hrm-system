import { ForbiddenException, Injectable } from '@nestjs/common';
import type { EnterpriseFeature, TenantPlanInfo } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import {
  normalizePlanId,
  PLAN_FEATURES,
  tenantHasFeature,
} from './plan-features.constants';

@Injectable()
export class PlanFeaturesService {
  constructor(private readonly prisma: PrismaService) {}

  async assertFeature(tenantId: string, feature: EnterpriseFeature): Promise<void> {
    const enabled = await this.hasFeature(tenantId, feature);
    if (!enabled) {
      throw new ForbiddenException({
        code: 'PLAN_FEATURE_UNAVAILABLE',
        message: `This feature requires the Enterprise plan (${feature})`,
      });
    }
  }

  async hasFeature(tenantId: string, feature: EnterpriseFeature): Promise<boolean> {
    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id: tenantId },
      select: { planId: true, status: true },
    });
    if (!tenant || tenant.status !== 'active') {
      return false;
    }
    return tenantHasFeature(tenant.planId, feature);
  }

  async getTenantPlanInfo(tenantId: string): Promise<TenantPlanInfo> {
    const tenant = await this.prisma.unscoped.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { planId: true },
    });
    const planId = normalizePlanId(tenant.planId);
    const features = PLAN_FEATURES[planId];
    return {
      planId,
      features,
      apiAccessEnabled: features.includes('api_access'),
    };
  }
}
