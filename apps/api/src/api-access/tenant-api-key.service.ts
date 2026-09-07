import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantApiKeyStatus } from '@prisma/client';
import type {
  ApiAccessScope,
  CreateTenantApiKeyResult,
  TenantApiKeyRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PlanFeaturesService } from '../billing/plan-features.service';
import { PrismaService } from '../database/prisma.service';
import {
  generateApiKeyMaterial,
  hashApiSecret,
} from './api-access.utils';
import {
  assertValidScopes,
  isValidApiAccessScope,
  maskApiKeySecret,
} from './scope-permissions.util';

@Injectable()
export class TenantApiKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly planFeatures: PlanFeaturesService,
  ) {}

  async listKeys(tenantId: string): Promise<TenantApiKeyRecord[]> {
    const rows = await this.prisma.unscoped.tenantApiKey.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: 'desc' }],
    });
    return rows.map((row) => this.toRecord(row));
  }

  async createKey(
    tenantId: string,
    input: {
      name: string;
      scopes: string[];
      expiresAt?: string | null;
    },
    user: AuthenticatedUser,
  ): Promise<CreateTenantApiKeyResult> {
    await this.planFeatures.assertFeature(tenantId, 'api_access');

    const scopes = assertValidScopes(input.scopes);
    const { prefix, fullKey } = generateApiKeyMaterial();

    const row = await this.prisma.unscoped.tenantApiKey.create({
      data: {
        tenantId,
        name: input.name.trim(),
        prefix,
        keyHash: hashApiSecret(fullKey),
        scopes,
        status: TenantApiKeyStatus.active,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        createdByUserId: user.id,
      },
    });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'create',
      module: 'api_access',
      recordId: row.id,
      newValue: { name: row.name, prefix: row.prefix, scopes },
    });

    return {
      key: this.toRecord(row),
      secret: fullKey,
    };
  }

  async revokeKey(
    tenantId: string,
    keyId: string,
    user: AuthenticatedUser,
  ): Promise<TenantApiKeyRecord> {
    await this.planFeatures.assertFeature(tenantId, 'api_access');

    const existing = await this.prisma.unscoped.tenantApiKey.findFirst({
      where: { id: keyId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'API key not found',
      });
    }
    if (existing.status === TenantApiKeyStatus.revoked) {
      return this.toRecord(existing);
    }

    const row = await this.prisma.unscoped.tenantApiKey.update({
      where: { id: keyId },
      data: {
        status: TenantApiKeyStatus.revoked,
        revokedAt: new Date(),
        revokedByUserId: user.id,
      },
    });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'delete',
      module: 'api_access',
      recordId: keyId,
      oldValue: { status: existing.status },
      newValue: { status: row.status },
    });

    return this.toRecord(row);
  }

  private toRecord(row: {
    id: string;
    tenantId: string;
    name: string;
    prefix: string;
    scopes: string[];
    status: TenantApiKeyStatus;
    expiresAt: Date | null;
    lastUsedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): TenantApiKeyRecord {
    const scopes = row.scopes.filter(isValidApiAccessScope) as ApiAccessScope[];
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      prefix: row.prefix,
      keyMasked: maskApiKeySecret(row.prefix),
      scopes,
      status: row.status,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
