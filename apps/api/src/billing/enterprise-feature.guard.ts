import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { EnterpriseFeature } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { ENTERPRISE_FEATURE_KEY } from './require-enterprise-feature.decorator';
import { PlanFeaturesService } from './plan-features.service';

@Injectable()
export class EnterpriseFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly planFeatures: PlanFeaturesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const feature = this.reflector.getAllAndOverride<EnterpriseFeature>(
      ENTERPRISE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!feature) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user?.tenantId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Tenant context required',
      });
    }

    await this.planFeatures.assertFeature(user.tenantId, feature);
    return true;
  }
}
