import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { TenantOAuthClientStatus } from '@prisma/client';
import type {
  ApiAccessScope,
  CreateTenantOAuthClientResult,
  OAuthTokenResponse,
  TenantOAuthClientRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PlanFeaturesService } from '../billing/plan-features.service';
import { PrismaService } from '../database/prisma.service';
import {
  generateAuthorizationCode,
  generateOAuthAccessToken,
  generateOAuthClientSecret,
  hashApiSecret,
} from './api-access.utils';
import { assertValidScopes, isValidApiAccessScope } from './scope-permissions.util';

const AUTH_CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_TTL_SECONDS = 3600;

@Injectable()
export class TenantOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly planFeatures: PlanFeaturesService,
  ) {}

  async listClients(tenantId: string): Promise<TenantOAuthClientRecord[]> {
    const rows = await this.prisma.unscoped.tenantOAuthClient.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: 'desc' }],
    });
    return rows.map((row) => this.toClientRecord(row));
  }

  async createClient(
    tenantId: string,
    input: {
      name: string;
      description?: string;
      redirectUris: string[];
      scopes: string[];
    },
    user: AuthenticatedUser,
  ): Promise<CreateTenantOAuthClientResult> {
    await this.planFeatures.assertFeature(tenantId, 'api_access');
    this.assertRedirectUris(input.redirectUris);
    const scopes = assertValidScopes(input.scopes);
    const clientSecret = generateOAuthClientSecret();

    const row = await this.prisma.unscoped.tenantOAuthClient.create({
      data: {
        tenantId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        clientSecretHash: hashApiSecret(clientSecret),
        redirectUris: input.redirectUris,
        scopes,
        status: TenantOAuthClientStatus.active,
        createdByUserId: user.id,
      },
    });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'create',
      module: 'api_access',
      recordId: row.id,
      newValue: { name: row.name, redirectUris: row.redirectUris, scopes },
    });

    return {
      client: this.toClientRecord(row),
      clientSecret,
    };
  }

  async revokeClient(
    tenantId: string,
    clientId: string,
    user: AuthenticatedUser,
  ): Promise<TenantOAuthClientRecord> {
    await this.planFeatures.assertFeature(tenantId, 'api_access');

    const existing = await this.prisma.unscoped.tenantOAuthClient.findFirst({
      where: { id: clientId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'OAuth client not found',
      });
    }

    const row = await this.prisma.unscoped.tenantOAuthClient.update({
      where: { id: clientId },
      data: {
        status: TenantOAuthClientStatus.revoked,
        revokedAt: new Date(),
      },
    });

    await this.prisma.unscoped.tenantOAuthAccessToken.updateMany({
      where: { clientId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'delete',
      module: 'api_access',
      recordId: clientId,
    });

    return this.toClientRecord(row);
  }

  async issueAuthorizationCode(input: {
    clientId: string;
    redirectUri: string;
    scopes: string[];
    user: AuthenticatedUser;
  }): Promise<string> {
    await this.planFeatures.assertFeature(input.user.tenantId!, 'api_access');

    const client = await this.findActiveClient(input.clientId);
    if (client.tenantId !== input.user.tenantId) {
      throw new UnauthorizedException({
        code: 'FORBIDDEN',
        message: 'OAuth client does not belong to this tenant',
      });
    }
    this.assertRedirectUriAllowed(client.redirectUris, input.redirectUri);

    const allowedScopes = new Set(client.scopes);
    const requested =
      input.scopes.length > 0
        ? assertValidScopes(input.scopes)
        : (client.scopes.filter(isValidApiAccessScope) as ApiAccessScope[]);
    if (requested.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'At least one scope is required',
      });
    }
    for (const scope of requested) {
      if (!allowedScopes.has(scope)) {
        throw new BadRequestException({
          code: 'INVALID_SCOPE',
          message: `Scope not allowed for client: ${scope}`,
        });
      }
    }

    const code = generateAuthorizationCode();
    await this.prisma.unscoped.tenantOAuthAuthorizationCode.create({
      data: {
        code,
        clientId: client.id,
        tenantId: client.tenantId,
        userId: input.user.id,
        scopes: requested,
        redirectUri: input.redirectUri,
        expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
      },
    });

    return code;
  }

  async exchangeToken(input: {
    grantType: 'authorization_code' | 'client_credentials';
    clientId: string;
    clientSecret: string;
    code?: string;
    redirectUri?: string;
    scope?: string;
  }): Promise<OAuthTokenResponse> {
    const client = await this.findActiveClient(input.clientId);
    await this.planFeatures.assertFeature(client.tenantId, 'api_access');

    if (hashApiSecret(input.clientSecret) !== client.clientSecretHash) {
      throw new UnauthorizedException({
        code: 'INVALID_CLIENT',
        message: 'Invalid OAuth client credentials',
      });
    }

    if (input.grantType === 'client_credentials') {
      return this.issueAccessToken({
        clientId: client.id,
        tenantId: client.tenantId,
        scopes: client.scopes,
        userId: null,
      });
    }

    if (!input.code || !input.redirectUri) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'code and redirect_uri are required for authorization_code grant',
      });
    }

    const authCode = await this.prisma.unscoped.tenantOAuthAuthorizationCode.findUnique({
      where: { code: input.code },
    });
    if (
      !authCode ||
      authCode.clientId !== client.id ||
      authCode.consumedAt ||
      authCode.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException({
        code: 'INVALID_GRANT',
        message: 'Authorization code is invalid or expired',
      });
    }
    if (authCode.redirectUri !== input.redirectUri) {
      throw new BadRequestException({
        code: 'INVALID_GRANT',
        message: 'redirect_uri does not match',
      });
    }

    await this.prisma.unscoped.tenantOAuthAuthorizationCode.update({
      where: { id: authCode.id },
      data: { consumedAt: new Date() },
    });

    return this.issueAccessToken({
      clientId: client.id,
      tenantId: client.tenantId,
      scopes: authCode.scopes,
      userId: authCode.userId,
    });
  }

  private async issueAccessToken(input: {
    clientId: string;
    tenantId: string;
    scopes: string[];
    userId: string | null;
  }): Promise<OAuthTokenResponse> {
    const token = generateOAuthAccessToken();
    const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000);

    await this.prisma.unscoped.tenantOAuthAccessToken.create({
      data: {
        tokenHash: hashApiSecret(token),
        clientId: input.clientId,
        tenantId: input.tenantId,
        userId: input.userId,
        scopes: input.scopes,
        expiresAt,
      },
    });

    return {
      access_token: token,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      scope: input.scopes.join(' '),
    };
  }

  private async findActiveClient(clientId: string) {
    const client = await this.prisma.unscoped.tenantOAuthClient.findUnique({
      where: { id: clientId },
    });
    if (!client || client.status !== TenantOAuthClientStatus.active) {
      throw new UnauthorizedException({
        code: 'INVALID_CLIENT',
        message: 'OAuth client not found or revoked',
      });
    }
    return client;
  }

  private assertRedirectUris(uris: string[]): void {
    if (!uris.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'At least one redirect URI is required',
      });
    }
    for (const uri of uris) {
      try {
        const parsed = new URL(uri);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error('invalid protocol');
        }
      } catch {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `Invalid redirect URI: ${uri}`,
        });
      }
    }
  }

  private assertRedirectUriAllowed(allowed: string[], redirectUri: string): void {
    if (!allowed.includes(redirectUri)) {
      throw new BadRequestException({
        code: 'INVALID_REDIRECT_URI',
        message: 'redirect_uri is not registered for this client',
      });
    }
  }

  private toClientRecord(row: {
    id: string;
    tenantId: string;
    name: string;
    description: string | null;
    redirectUris: string[];
    scopes: string[];
    status: TenantOAuthClientStatus;
    createdAt: Date;
    updatedAt: Date;
  }): TenantOAuthClientRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      description: row.description,
      clientId: row.id,
      redirectUris: row.redirectUris,
      scopes: row.scopes.filter(isValidApiAccessScope) as ApiAccessScope[],
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
