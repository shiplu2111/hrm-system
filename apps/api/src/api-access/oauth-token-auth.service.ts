import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { PlanFeaturesService } from '../billing/plan-features.service';
import { hashApiSecret } from './api-access.utils';
import { scopesToPermissionClaims } from './scope-permissions.util';

@Injectable()
export class OAuthTokenAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planFeatures: PlanFeaturesService,
  ) {}

  async authenticate(token: string): Promise<AuthenticatedUser> {
    const tokenHash = hashApiSecret(token);
    const row = await this.prisma.unscoped.tenantOAuthAccessToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!row) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Invalid or expired OAuth access token',
      });
    }

    const apiEnabled = await this.planFeatures.hasFeature(
      row.tenantId,
      'api_access',
    );
    if (!apiEnabled) {
      throw new UnauthorizedException({
        code: 'PLAN_FEATURE_UNAVAILABLE',
        message: 'API access requires the Enterprise plan',
      });
    }

    return {
      id: row.userId ?? row.clientId ?? row.id,
      tenantId: row.tenantId,
      roleId: 'oauth-client',
      roleName: 'oauth_client',
      employeeId: null,
      email: '',
      permissions: scopesToPermissionClaims(row.scopes),
      authMethod: 'oauth',
      oauthClientId: row.clientId ?? undefined,
    };
  }
}
