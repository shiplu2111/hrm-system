// apps/api/src/platform/api-registry/platform-api-registry.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  PlatformApiKeyItem,
  PlatformApiKeyQuery,
  PlatformApiRegistrySummary,
  PlatformOAuthClientItem,
  PlatformOAuthClientQuery,
  PlatformRateLimitQuery,
  RevokePlatformApiKeyInput,
  RevokePlatformOAuthClientInput,
  SetTenantRateLimitOverrideInput,
  TenantRateLimitItem,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import {
  PlatformActorContext,
  PlatformApiRegistryService,
} from './platform-api-registry.service';

interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, any>;
}

@ApiTags('Platform API Apps & Keys Registry')
@ApiBearerAuth()
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/api-registry')
export class PlatformApiRegistryController {
  constructor(private readonly registryService: PlatformApiRegistryService) {}

  private getActor(req: any): PlatformActorContext {
    const user = req.platformUser || req.user;
    return {
      id: user?.id || user?.userId || user?.sub,
      email: user?.email,
      roleName: user?.roleName || user?.role_name,
      permissions: user?.permissions,
    };
  }

  // ==========================================
  // Summary & KPIs
  // ==========================================

  @Get('summary')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'Get overview KPI metrics for cross-tenant API keys and rate limits' })
  async getSummary(): Promise<ApiEnvelope<PlatformApiRegistrySummary>> {
    const data = await this.registryService.getSummary();
    return { data };
  }

  // ==========================================
  // API Keys Registry
  // ==========================================

  @Get('keys')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'List API keys across all tenants' })
  async listKeys(
    @Query() query: PlatformApiKeyQuery,
  ): Promise<ApiEnvelope<PlatformApiKeyItem[]>> {
    const { data, meta } = await this.registryService.listApiKeys(query);
    return { data, meta };
  }

  @Post('keys/:id/revoke')
  @RequirePlatformPermission('platform', 'edit')
  @ApiOperation({ summary: 'Immediately revoke an API key from the platform control plane' })
  async revokeKey(
    @Param('id') id: string,
    @Body() input: RevokePlatformApiKeyInput,
    @Req() req?: any,
  ): Promise<ApiEnvelope<PlatformApiKeyItem>> {
    const actor = this.getActor(req);
    const data = await this.registryService.revokeApiKey(id, input, actor);
    return { data };
  }

  // ==========================================
  // OAuth Clients Registry
  // ==========================================

  @Get('oauth-clients')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'List OAuth 2.0 clients across all tenants' })
  async listOAuthClients(
    @Query() query: PlatformOAuthClientQuery,
  ): Promise<ApiEnvelope<PlatformOAuthClientItem[]>> {
    const { data, meta } = await this.registryService.listOAuthClients(query);
    return { data, meta };
  }

  @Post('oauth-clients/:id/revoke')
  @RequirePlatformPermission('platform', 'edit')
  @ApiOperation({ summary: 'Immediately revoke an OAuth client across all tenants' })
  async revokeOAuthClient(
    @Param('id') id: string,
    @Body() input: RevokePlatformOAuthClientInput,
    @Req() req?: any,
  ): Promise<ApiEnvelope<PlatformOAuthClientItem>> {
    const actor = this.getActor(req);
    const data = await this.registryService.revokeOAuthClient(id, input, actor);
    return { data };
  }

  // ==========================================
  // Tenant Rate Limits & Overrides
  // ==========================================

  @Get('rate-limits')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'List tenants with baseline plan limits and active overrides' })
  async listRateLimits(
    @Query() query: PlatformRateLimitQuery,
  ): Promise<ApiEnvelope<TenantRateLimitItem[]>> {
    const { data, meta } = await this.registryService.listRateLimits(query);
    return { data, meta };
  }

  @Post('rate-limits/:tenantId')
  @RequirePlatformPermission('platform', 'edit')
  @ApiOperation({ summary: 'Set or update rate limit override for a tenant' })
  async setRateLimitOverride(
    @Param('tenantId') tenantId: string,
    @Body() input: SetTenantRateLimitOverrideInput,
    @Req() req?: any,
  ): Promise<ApiEnvelope<TenantRateLimitItem>> {
    const actor = this.getActor(req);
    const data = await this.registryService.setRateLimitOverride(tenantId, input, actor);
    return { data };
  }

  @Delete('rate-limits/:tenantId')
  @RequirePlatformPermission('platform', 'edit')
  @ApiOperation({ summary: 'Remove rate limit override for a tenant' })
  async removeRateLimitOverride(
    @Param('tenantId') tenantId: string,
    @Req() req?: any,
  ): Promise<ApiEnvelope<TenantRateLimitItem>> {
    const actor = this.getActor(req);
    const data = await this.registryService.removeRateLimitOverride(tenantId, actor);
    return { data };
  }
}
