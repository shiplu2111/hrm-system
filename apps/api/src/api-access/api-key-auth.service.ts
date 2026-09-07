import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TenantApiKeyStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { PlanFeaturesService } from '../billing/plan-features.service';
import { hashApiSecret } from './api-access.utils';
import { maskApiKeySecret, scopesToPermissionClaims } from './scope-permissions.util';

@Injectable()
export class ApiKeyAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planFeatures: PlanFeaturesService,
  ) {}

  async authenticate(fullKey: string): Promise<AuthenticatedUser> {
    const keyHash = hashApiSecret(fullKey);
    const row = await this.prisma.unscoped.tenantApiKey.findFirst({
      where: {
        keyHash,
        status: TenantApiKeyStatus.active,
      },
    });

    if (!row) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Invalid API key',
      });
    }

    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({
        code: 'API_KEY_EXPIRED',
        message: 'API key has expired',
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

    void this.prisma.unscoped.tenantApiKey
      .update({
        where: { id: row.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => undefined);

    return {
      id: row.createdByUserId,
      tenantId: row.tenantId,
      roleId: 'api-key',
      roleName: 'api_key',
      employeeId: null,
      email: maskApiKeySecret(row.prefix),
      permissions: scopesToPermissionClaims(row.scopes),
      authMethod: 'api_key',
      apiKeyId: row.id,
    };
  }
}
