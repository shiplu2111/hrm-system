import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  AccountingConnectionStatus,
  AccountingProvider,
  type AccountingConnection,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import type {
  AccountingConnectionRecord,
  AccountingProvider as SharedAccountingProvider,
} from '@hrm/shared-types';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SensitiveFieldService } from '../crypto/sensitive-field.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { errorCode } from './accounting-connection.rules';
import { AccountingGlProviderFactory } from './providers/accounting-gl-provider.factory';
import { XeroGlProvider } from './providers/xero-gl.provider';

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AccountingConnectionService {
  private readonly logger = new Logger(AccountingConnectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly sensitiveField: SensitiveFieldService,
    private readonly providerFactory: AccountingGlProviderFactory,
    private readonly xeroProvider: XeroGlProvider,
    private readonly auditService: AuditService,
  ) {}

  async listConnections(companyId: string): Promise<AccountingConnectionRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const rows = await this.prisma.unscoped.accountingConnection.findMany({
      where: { companyId },
      orderBy: [{ provider: 'asc' }],
    });

    const byProvider = new Map(rows.map((row) => [row.provider, row]));
    const names = await this.userNames(rows.map((row) => row.connectedByUserId));
    const providers: AccountingProvider[] = [AccountingProvider.xero];

    return providers.map((provider) => {
      const row = byProvider.get(provider);
      if (row) {
        return this.toRecord(row, names);
      }
      return this.virtualConnection(companyId, provider);
    });
  }

  private virtualConnection(
    companyId: string,
    provider: AccountingProvider,
  ): AccountingConnectionRecord {
    return {
      id: `virtual-${provider}`,
      companyId,
      provider,
      status: 'disconnected',
      externalOrgName: null,
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncError: null,
      connectedAt: null,
      connectedByName: null,
      disconnectedAt: null,
      oauthConfigured: provider === 'xero' ? this.xeroProvider.isConfigured() : false,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
  }

  async getConnection(
    companyId: string,
    provider: SharedAccountingProvider,
  ): Promise<AccountingConnectionRecord | null> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const row = await this.prisma.unscoped.accountingConnection.findUnique({
      where: { companyId_provider: { companyId, provider } },
    });
    if (!row) return null;
    return this.toRecord(row, await this.userNames([row.connectedByUserId]));
  }

  async beginXeroConnect(
    companyId: string,
    user: AuthenticatedUser,
  ): Promise<{ authorizeUrl: string }> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    if (!this.xeroProvider.isConfigured()) {
      throw new BadRequestException({
        code: 'XERO_NOT_CONFIGURED',
        message:
          'Xero OAuth is not configured on this server. Contact your platform administrator.',
      });
    }

    const stateToken = randomUUID();
    const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);

    await this.prisma.unscoped.accountingOAuthState.create({
      data: {
        stateToken,
        tenantId: company.tenantId,
        companyId,
        userId: user.id,
        provider: AccountingProvider.xero,
        expiresAt,
      },
    });

    return {
      authorizeUrl: this.xeroProvider.buildAuthorizeUrl(stateToken),
    };
  }

  async completeOAuthCallback(
    provider: AccountingProvider,
    code: string,
    state: string,
  ): Promise<{ companyId: string; orgName: string }> {
    const oauthState = await this.prisma.unscoped.accountingOAuthState.findUnique({
      where: { stateToken: state },
    });

    if (!oauthState || oauthState.provider !== provider) {
      throw new BadRequestException({
        code: 'INVALID_OAUTH_STATE',
        message: 'Invalid or expired OAuth state',
      });
    }

    if (oauthState.expiresAt.getTime() < Date.now()) {
      await this.prisma.unscoped.accountingOAuthState.delete({
        where: { id: oauthState.id },
      });
      throw new BadRequestException({
        code: 'OAUTH_STATE_EXPIRED',
        message: 'OAuth session expired — please try connecting again',
      });
    }

    const glProvider = this.providerFactory.resolve(provider);
    const tokens = await glProvider.exchangeAuthorizationCode(code);
    const orgs = await glProvider.listOrganizations(tokens.accessToken);
    const primaryOrg = orgs[0];
    if (!primaryOrg) {
      throw new BadRequestException({
        code: 'XERO_NO_ORG',
        message: 'No Xero organization found for this account',
      });
    }

    const previous = await this.prisma.unscoped.accountingConnection.findUnique({
      where: {
        companyId_provider: { companyId: oauthState.companyId, provider },
      },
    });

    const connection = await this.prisma.unscoped.$transaction(async (tx) => {
      const row = await tx.accountingConnection.upsert({
        where: {
          companyId_provider: {
            companyId: oauthState.companyId,
            provider,
          },
        },
        create: {
          tenantId: oauthState.tenantId,
          companyId: oauthState.companyId,
          provider,
          status: AccountingConnectionStatus.connected,
          externalTenantId: primaryOrg.externalTenantId,
          externalOrgName: primaryOrg.orgName,
          accessTokenEncrypted: this.sensitiveField.encrypt(tokens.accessToken),
          refreshTokenEncrypted: this.sensitiveField.encrypt(tokens.refreshToken),
          tokenExpiresAt: tokens.expiresAt,
          scopes: tokens.scopes,
          connectedByUserId: oauthState.userId,
          connectedAt: new Date(),
          disconnectedAt: null,
          lastSyncError: null,
        },
        update: {
          status: AccountingConnectionStatus.connected,
          externalTenantId: primaryOrg.externalTenantId,
          externalOrgName: primaryOrg.orgName,
          accessTokenEncrypted: this.sensitiveField.encrypt(tokens.accessToken),
          refreshTokenEncrypted: this.sensitiveField.encrypt(tokens.refreshToken),
          tokenExpiresAt: tokens.expiresAt,
          scopes: tokens.scopes,
          connectedByUserId: oauthState.userId,
          connectedAt: new Date(),
          disconnectedAt: null,
          lastSyncError: null,
        },
      });

      await tx.accountingOAuthState.delete({ where: { id: oauthState.id } });
      return row;
    });

    await this.auditService.log({
      tenantId: oauthState.tenantId,
      userId: oauthState.userId,
      action: previous ? 'update' : 'create',
      module: 'accounting',
      recordId: connection.id,
      oldValue: previous
        ? { provider, status: previous.status, externalOrgName: previous.externalOrgName }
        : undefined,
      newValue: {
        provider,
        status: connection.status,
        externalOrgName: connection.externalOrgName,
        event: 'connected',
      },
    });

    return {
      companyId: oauthState.companyId,
      orgName: primaryOrg.orgName,
    };
  }

  async disconnect(
    companyId: string,
    provider: SharedAccountingProvider,
    user: AuthenticatedUser,
  ): Promise<AccountingConnectionRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const existing = await this.prisma.unscoped.accountingConnection.findUnique({
      where: { companyId_provider: { companyId, provider } },
    });
    if (!existing) {
      return this.virtualConnection(companyId, provider);
    }
    if (existing.status === AccountingConnectionStatus.disconnected) {
      return this.toRecord(existing, await this.userNames([existing.connectedByUserId]));
    }

    const tokenRevoked = await this.revokeQuietly(existing);

    const row = await this.prisma.unscoped.accountingConnection.update({
      where: { id: existing.id },
      data: {
        status: AccountingConnectionStatus.disconnected,
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        tokenExpiresAt: null,
        disconnectedAt: new Date(),
      },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'update',
      module: 'accounting',
      recordId: row.id,
      oldValue: {
        provider,
        status: existing.status,
        externalOrgName: existing.externalOrgName,
      },
      newValue: { provider, status: row.status, event: 'disconnected', tokenRevoked },
    });

    return this.toRecord(row, await this.userNames([row.connectedByUserId]));
  }

  /** Revocation is best effort: a Xero outage must not stop a tenant from disconnecting. */
  private async revokeQuietly(connection: AccountingConnection): Promise<boolean> {
    const refreshToken = connection.refreshTokenEncrypted
      ? this.sensitiveField.reveal(connection.refreshTokenEncrypted)
      : null;
    if (!refreshToken) return false;
    try {
      await this.providerFactory
        .resolve(connection.provider)
        .revokeRefreshToken(refreshToken);
      return true;
    } catch (error) {
      this.logger.warn(
        `Could not revoke ${connection.provider} token for connection ${connection.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  async resolveAccessToken(
    connection: AccountingConnection,
  ): Promise<string> {
    if (
      connection.status !== AccountingConnectionStatus.connected ||
      !connection.accessTokenEncrypted
    ) {
      throw new BadRequestException({
        code: 'ACCOUNTING_NOT_CONNECTED',
        message: 'Accounting provider is not connected',
      });
    }

    const expiresAt = connection.tokenExpiresAt?.getTime() ?? 0;
    const needsRefresh = expiresAt - Date.now() < 60_000;

    if (!needsRefresh) {
      return this.sensitiveField.reveal(connection.accessTokenEncrypted)!;
    }

    if (!connection.refreshTokenEncrypted) {
      await this.markTokenExpired(connection.id);
      throw new BadRequestException({
        code: 'ACCOUNTING_TOKEN_EXPIRED',
        message: 'Accounting connection token expired — reconnect Xero',
      });
    }

    const glProvider = this.providerFactory.resolve(connection.provider);
    const refreshToken = this.sensitiveField.reveal(
      connection.refreshTokenEncrypted,
    )!;

    let tokens;
    try {
      tokens = await glProvider.refreshAccessToken(refreshToken);
    } catch (error) {
      if (errorCode(error) !== 'XERO_INVALID_GRANT') throw error;
      await this.markTokenExpired(connection.id);
      throw new BadRequestException({
        code: 'ACCOUNTING_TOKEN_EXPIRED',
        message: 'Xero rejected the saved sign-in — reconnect Xero',
      });
    }

    await this.prisma.unscoped.accountingConnection.update({
      where: { id: connection.id },
      data: {
        accessTokenEncrypted: this.sensitiveField.encrypt(tokens.accessToken),
        refreshTokenEncrypted: this.sensitiveField.encrypt(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        status: AccountingConnectionStatus.connected,
      },
    });

    return tokens.accessToken;
  }

  private async markTokenExpired(connectionId: string): Promise<void> {
    await this.prisma.unscoped.accountingConnection.update({
      where: { id: connectionId },
      data: { status: AccountingConnectionStatus.token_expired },
    });
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

  private toRecord(
    row: AccountingConnection,
    names: Map<string, string>,
  ): AccountingConnectionRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      provider: row.provider,
      status: row.status,
      externalOrgName: row.externalOrgName,
      lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
      lastSyncStatus: row.lastSyncStatus,
      lastSyncError: row.lastSyncError,
      connectedAt: row.connectedAt?.toISOString() ?? null,
      connectedByName: row.connectedByUserId
        ? (names.get(row.connectedByUserId) ?? null)
        : null,
      disconnectedAt: row.disconnectedAt?.toISOString() ?? null,
      oauthConfigured: row.provider === 'xero' ? this.xeroProvider.isConfigured() : false,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
