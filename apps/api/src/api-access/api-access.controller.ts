import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireEnterpriseFeature } from '../billing/require-enterprise-feature.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { ApiAccessService } from './api-access.service';
import {
  CreateTenantApiKeyDto,
  CreateTenantOAuthClientDto,
  OAuthAuthorizeQueryDto,
  OAuthTokenDto,
} from './dto/api-access.dto';
import { TenantApiKeyService } from './tenant-api-key.service';
import { TenantOAuthService } from './tenant-oauth.service';

@ApiTags('api-access')
@ApiBearerAuth('access-token')
@Controller()
export class ApiAccessController {
  constructor(
    private readonly apiAccessService: ApiAccessService,
    private readonly apiKeyService: TenantApiKeyService,
    private readonly oauthService: TenantOAuthService,
  ) {}

  @Get('tenant/api-access/status')
  @RequirePermission('settings', 'view')
  async status(@CurrentUser() user: AuthenticatedUser) {
    if (!user.tenantId) {
      return { data: null };
    }
    return { data: await this.apiAccessService.getStatus(user.tenantId) };
  }

  @Get('tenant/api-keys')
  @RequirePermission('settings', 'view')
  @RequireEnterpriseFeature('api_access')
  async listKeys(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.apiKeyService.listKeys(user.tenantId!),
    };
  }

  @Post('tenant/api-keys')
  @RequirePermission('settings', 'edit')
  @RequireEnterpriseFeature('api_access')
  async createKey(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTenantApiKeyDto,
  ) {
    return {
      data: await this.apiKeyService.createKey(user.tenantId!, dto, user),
    };
  }

  @Delete('tenant/api-keys/:keyId')
  @RequirePermission('settings', 'edit')
  @RequireEnterpriseFeature('api_access')
  async revokeKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('keyId', ParseUUIDPipe) keyId: string,
  ) {
    return {
      data: await this.apiKeyService.revokeKey(user.tenantId!, keyId, user),
    };
  }

  @Get('tenant/oauth-clients')
  @RequirePermission('settings', 'view')
  @RequireEnterpriseFeature('api_access')
  async listOAuthClients(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.oauthService.listClients(user.tenantId!),
    };
  }

  @Post('tenant/oauth-clients')
  @RequirePermission('settings', 'edit')
  @RequireEnterpriseFeature('api_access')
  async createOAuthClient(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTenantOAuthClientDto,
  ) {
    return {
      data: await this.oauthService.createClient(user.tenantId!, dto, user),
    };
  }

  @Delete('tenant/oauth-clients/:clientId')
  @RequirePermission('settings', 'edit')
  @RequireEnterpriseFeature('api_access')
  async revokeOAuthClient(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    return {
      data: await this.oauthService.revokeClient(user.tenantId!, clientId, user),
    };
  }
}

@ApiTags('oauth')
@Controller('oauth')
export class OAuthController {
  constructor(private readonly oauthService: TenantOAuthService) {}

  @Get('authorize')
  @RequirePermission('settings', 'view')
  @RequireEnterpriseFeature('api_access')
  @ApiOperation({
    summary: 'OAuth 2.0 authorization endpoint (requires admin session JWT)',
  })
  async authorize(
    @Query() query: OAuthAuthorizeQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    if (query.response_type !== 'code') {
      res.status(400).json({
        error: {
          code: 'UNSUPPORTED_RESPONSE_TYPE',
          message: 'Only response_type=code is supported',
        },
      });
      return;
    }

    const scopes = (query.scope ?? '')
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const code = await this.oauthService.issueAuthorizationCode({
      clientId: query.client_id,
      redirectUri: query.redirect_uri,
      scopes: scopes.length > 0 ? scopes : ['read:employees'],
      user,
    });

    const redirect = new URL(query.redirect_uri);
    redirect.searchParams.set('code', code);
    if (query.state) {
      redirect.searchParams.set('state', query.state);
    }
    res.redirect(302, redirect.toString());
  }

  @Public()
  @Post('token')
  @ApiOperation({ summary: 'OAuth 2.0 token endpoint (client credentials or authorization code)' })
  async token(@Body() dto: OAuthTokenDto) {
    return {
      data: await this.oauthService.exchangeToken({
        grantType: dto.grant_type,
        clientId: dto.client_id,
        clientSecret: dto.client_secret,
        code: dto.code,
        redirectUri: dto.redirect_uri,
        scope: dto.scope,
      }),
    };
  }
}
