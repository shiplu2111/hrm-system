import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  ApiResponse as ApiEnvelope,
  FeatureEvaluationResult,
  PlatformFeatureFlagView,
  TenantFeatureOverrideView,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import {
  CreatePlatformFeatureFlagDto,
  SetTenantFeatureOverrideDto,
  UpdatePlatformFeatureFlagDto,
} from './dto/platform-feature-flags.dto';
import { PlatformFeatureFlagsService } from './platform-feature-flags.service';

@ApiTags('platform-feature-flags')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/feature-flags')
export class PlatformFeatureFlagsController {
  constructor(private readonly service: PlatformFeatureFlagsService) {}

  @Get()
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'List all platform feature flags with rollout percentages' })
  async listFlags(): Promise<ApiEnvelope<PlatformFeatureFlagView[]>> {
    const flags = await this.service.listFlags();
    return { data: flags };
  }

  @Post()
  @RequirePlatformPermission('platform', 'edit')
  @ApiOperation({ summary: 'Create a new platform feature flag' })
  async createFlag(
    @Body() dto: CreatePlatformFeatureFlagDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformFeatureFlagView>> {
    const actor = req.platformUser ?? req.user;
    const ip = req.ip || req.headers['x-forwarded-for'];
    const ua = req.headers['user-agent'];
    const flag = await this.service.createFlag(dto, actor, ip, ua);
    return { data: flag };
  }

  @Get(':key')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'Get a single platform feature flag' })
  async getFlag(
    @Param('key') key: string,
  ): Promise<ApiEnvelope<PlatformFeatureFlagView>> {
    const flag = await this.service.getFlag(key);
    return { data: flag };
  }

  @Patch(':key')
  @RequirePlatformPermission('platform', 'edit')
  @ApiOperation({ summary: 'Update a platform feature flag rollout percentage or default state' })
  async updateFlag(
    @Param('key') key: string,
    @Body() dto: UpdatePlatformFeatureFlagDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformFeatureFlagView>> {
    const actor = req.platformUser ?? req.user;
    const ip = req.ip || req.headers['x-forwarded-for'];
    const ua = req.headers['user-agent'];
    const flag = await this.service.updateFlag(key, dto, actor, ip, ua);
    return { data: flag };
  }

  @Delete(':key')
  @RequirePlatformPermission('platform', 'edit')
  @ApiOperation({ summary: 'Delete a platform feature flag' })
  async deleteFlag(
    @Param('key') key: string,
    @Req() req: any,
  ): Promise<ApiEnvelope<{ success: boolean; key: string }>> {
    const actor = req.platformUser ?? req.user;
    const ip = req.ip || req.headers['x-forwarded-for'];
    const ua = req.headers['user-agent'];
    await this.service.deleteFlag(key, actor, ip, ua);
    return { data: { success: true, key } };
  }

  @Get(':key/evaluate/:tenantId')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'Evaluate a feature flag for a specific tenant (override -> rollout -> plan default)' })
  async evaluateFeature(
    @Param('key') key: string,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ): Promise<ApiEnvelope<FeatureEvaluationResult>> {
    const result = await this.service.evaluateFeature(tenantId, key);
    return { data: result };
  }
}

@ApiTags('platform-tenant-overrides')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/tenants/:tenantId/feature-overrides')
export class PlatformTenantFeatureOverridesController {
  constructor(private readonly service: PlatformFeatureFlagsService) {}

  @Get()
  @RequirePlatformPermission('tenant', 'view')
  @ApiOperation({ summary: 'List all feature overrides for a specific tenant' })
  async listTenantOverrides(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ): Promise<ApiEnvelope<TenantFeatureOverrideView[]>> {
    const overrides = await this.service.listTenantOverrides(tenantId);
    return { data: overrides };
  }

  @Post()
  @RequirePlatformPermission('tenant', 'edit')
  @ApiOperation({ summary: 'Create or update a tenant feature override (with reason and expiration)' })
  async setTenantOverride(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: SetTenantFeatureOverrideDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<TenantFeatureOverrideView>> {
    const actor = req.platformUser ?? req.user;
    const ip = req.ip || req.headers['x-forwarded-for'];
    const ua = req.headers['user-agent'];
    const override = await this.service.setTenantOverride(tenantId, dto, actor, ip, ua);
    return { data: override };
  }

  @Delete(':key')
  @RequirePlatformPermission('tenant', 'edit')
  @ApiOperation({ summary: 'Remove a tenant feature override' })
  async removeTenantOverride(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('key') key: string,
    @Req() req: any,
  ): Promise<ApiEnvelope<{ success: boolean; tenantId: string; key: string }>> {
    const actor = req.platformUser ?? req.user;
    const ip = req.ip || req.headers['x-forwarded-for'];
    const ua = req.headers['user-agent'];
    await this.service.removeTenantOverride(tenantId, key, actor, ip, ua);
    return { data: { success: true, tenantId, key } };
  }
}
