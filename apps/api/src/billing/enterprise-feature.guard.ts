import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../auth/auth.types';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { ENTERPRISE_FEATURE_KEY } from './require-enterprise-feature.decorator';
import { FeatureGateService } from './feature-gate.service';

@Injectable()
export class EnterpriseFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureGate: FeatureGateService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const feature = this.reflector.getAllAndOverride<string>(
      ENTERPRISE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!feature) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      url?: string;
      originalUrl?: string;
    }>();

    const url = request.originalUrl ?? request.url ?? '';
    if (url.includes('/platform/')) {
      return true;
    }

    const user = request.user;
    if (!user?.tenantId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Tenant context required',
      });
    }

    await this.featureGate.assertFeature(user.tenantId, feature);
    return true;
  }
}

export const FeatureGateGuard = EnterpriseFeatureGuard;
