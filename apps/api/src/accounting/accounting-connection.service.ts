import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import type { AuthenticatedUser } from '../auth/auth.types';
import { SensitiveFieldService } from '../crypto/sensitive-field.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { AccountingGlProviderFactory } from './providers/accounting-gl-provider.factory';
import { XeroGlProvider } from './providers/xero-gl.provider';

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AccountingConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly sensitiveField: SensitiveFieldService,
    private readonly providerFactory: AccountingGlProviderFactory,
    private readonly xeroProvider: XeroGlProvider,
  ) {}

  async listConnections(companyId: string): Promise<AccountingConnectionRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const rows = await this.prisma.unscoped.accountingConnection.findMany({
      where: { companyId },
      orderBy: [{ provider: 'asc' }],
    });

    const byProvider = new Map(rows.map((row) => [row.provider, row]));
    const providers: AccountingProvider[] = [AccountingProvider.xero];

    return providers.map((provider) => {
      const row = byProvider.get(provider);
      if (row) {
        return this.toRecord(row);
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
    return row ? this.toRecord(row) : null;
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

    await this.prisma.unscoped.$transaction(async (tx) => {
      await tx.accountingConnection.upsert({
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
    });

    return {
      companyId: oauthState.companyId,
      orgName: primaryOrg.orgName,
    };
  }

  async disconnect(
    companyId: string,
    provider: SharedAccountingProvider,
    _user: AuthenticatedUser,
  ): Promise<AccountingConnectionRecord> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const existing = await this.prisma.unscoped.accountingConnection.findUnique({
      where: { companyId_provider: { companyId, provider } },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Accounting connection not found',
      });
    }

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

    return this.toRecord(row);
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

    const tokens = await glProvider.refreshAccessToken(refreshToken);

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

  private toRecord(row: AccountingConnection): AccountingConnectionRecord {
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
      disconnectedAt: row.disconnectedAt?.toISOString() ?? null,
      oauthConfigured: row.provider === 'xero' ? this.xeroProvider.isConfigured() : false,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
