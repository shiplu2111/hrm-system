import { Injectable, Optional } from '@nestjs/common';
import type { EnterpriseFeature, TenantPlanInfo } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { FeatureGateService } from './feature-gate.service';
import {
  normalizePlanId,
  PLAN_FEATURES,
  tenantHasFeature,
} from './plan-features.constants';

@Injectable()
export class PlanFeaturesService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly featureGate?: FeatureGateService,
  ) {}

  async assertFeature(tenantId: string, feature: EnterpriseFeature): Promise<void> {
    if (this.featureGate) {
      return this.featureGate.assertFeature(tenantId, feature);
    }
    const enabled = await this.hasFeature(tenantId, feature);
    if (!enabled) {
      throw new Error(`This feature requires subscription entitlement (${feature})`);
    }
  }

  async hasFeature(tenantId: string, feature: EnterpriseFeature): Promise<boolean> {
    if (this.featureGate) {
      return this.featureGate.hasFeature(tenantId, feature);
    }
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
    if (this.featureGate) {
      const planId = await this.featureGate.getTenantPlanCode(tenantId);
      const enterpriseFeatures: EnterpriseFeature[] = [
        'api_access',
        'sso',
        'custom_payroll_rules',
        'advanced_workflow',
      ];
      const features: EnterpriseFeature[] = [];
      for (const feat of enterpriseFeatures) {
        if (await this.featureGate.hasFeature(tenantId, feat)) {
          features.push(feat);
        }
      }
      return {
        planId,
        features,
        apiAccessEnabled: features.includes('api_access'),
      };
    }

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
