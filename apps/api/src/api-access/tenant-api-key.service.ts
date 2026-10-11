import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantApiKeyStatus, type TenantApiKey } from '@prisma/client';
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
  assertScopesWithinPermissions,
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

  /** Not plan-gated: after a downgrade the tenant must still see and revoke old keys. */
  async listKeys(tenantId: string): Promise<TenantApiKeyRecord[]> {
    const rows = await this.prisma.unscoped.tenantApiKey.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: 'desc' }],
    });
    const names = await this.userNames(
      rows.flatMap((row) => [row.createdByUserId, row.revokedByUserId]),
    );
    return rows.map((row) => this.toRecord(row, names));
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
    assertScopesWithinPermissions(scopes, user.permissions);

    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Expiry date must be in the future',
      });
    }

    const { prefix, fullKey } = generateApiKeyMaterial();

    const row = await this.prisma.unscoped.tenantApiKey.create({
      data: {
        tenantId,
        name: input.name.trim(),
        prefix,
        keyHash: hashApiSecret(fullKey),
        scopes,
        status: TenantApiKeyStatus.active,
        expiresAt,
        createdByUserId: user.id,
      },
    });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'create',
      module: 'api_access',
      recordId: row.id,
      newValue: {
        name: row.name,
        prefix: row.prefix,
        scopes,
        expiresAt: row.expiresAt?.toISOString() ?? null,
      },
    });

    return {
      key: this.toRecord(row, await this.userNames([row.createdByUserId])),
      secret: fullKey,
    };
  }

  /** Not plan-gated, so a downgraded tenant can still clean up. Revoking twice is a no-op. */
  async revokeKey(
    tenantId: string,
    keyId: string,
    user: AuthenticatedUser,
  ): Promise<TenantApiKeyRecord> {
    const existing = await this.prisma.unscoped.tenantApiKey.findFirst({
      where: { id: keyId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'API key not found',
      });
    }

    const row =
      existing.status === TenantApiKeyStatus.revoked
        ? existing
        : await this.prisma.unscoped.tenantApiKey.update({
            where: { id: keyId },
            data: {
              status: TenantApiKeyStatus.revoked,
              revokedAt: new Date(),
              revokedByUserId: user.id,
            },
          });

    if (row !== existing) {
      await this.auditService.log({
        tenantId,
        userId: user.id,
        action: 'delete',
        module: 'api_access',
        recordId: keyId,
        oldValue: { name: existing.name, prefix: existing.prefix, status: existing.status },
        newValue: { status: row.status },
      });
    }

    return this.toRecord(
      row,
      await this.userNames([row.createdByUserId, row.revokedByUserId]),
    );
  }

  private async userNames(userIds: Array<string | null>): Promise<Map<string, string>> {
    const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
    if (ids.length === 0) return new Map();
    const users = await this.prisma.unscoped.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        email: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    });
    return new Map(
      users.map((user) => [
        user.id,
        user.employee
          ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
          : user.email,
      ]),
    );
  }

  private toRecord(row: TenantApiKey, names: Map<string, string>): TenantApiKeyRecord {
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
      createdByName: names.get(row.createdByUserId) ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      revokedByName: row.revokedByUserId ? (names.get(row.revokedByUserId) ?? null) : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
