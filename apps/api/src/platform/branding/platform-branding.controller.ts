import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type {
  ApiResponse as ApiEnvelope,
  TenantBrandingView,
  VerifyCustomDomainResult,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import {
  DisableCustomDomainDto,
  UpdateTenantBrandingDto,
} from './dto/platform-branding.dto';
import { PlatformBrandingService } from './platform-branding.service';

@ApiTags('platform-branding')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/tenants/:tenantId')
export class PlatformBrandingController {
  constructor(private readonly brandingService: PlatformBrandingService) {}

  @Get('branding')
  @RequirePlatformPermission('tenant', 'view')
  @ApiOperation({
    summary:
      "Get tenant's branding, custom domain verification status, DNS records, and feature plan entitlement",
  })
  async getBranding(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ): Promise<ApiEnvelope<TenantBrandingView>> {
    const data = await this.brandingService.getBranding(tenantId);
    return { data };
  }

  @Put('branding')
  @RequirePlatformPermission('tenant', 'edit')
  @ApiOperation({
    summary:
      'Update branding logo, colors, email sender, or custom domain (gated by plan)',
  })
  async updateBranding(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: UpdateTenantBrandingDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<TenantBrandingView>> {
    const actor = {
      id: req.platformUser?.id ?? req.user?.id ?? '00000000-0000-0000-0000-000000000000',
      email: req.platformUser?.email ?? req.user?.email,
    };
    const data = await this.brandingService.updateBranding(tenantId, dto, actor);
    return { data };
  }

  @Post('custom-domain/verify')
  @RequirePlatformPermission('tenant', 'edit')
  @ApiOperation({
    summary:
      'Trigger immediate DNS re-check and validation for tenant custom domain',
  })
  async verifyCustomDomain(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Req() req: any,
  ): Promise<ApiEnvelope<VerifyCustomDomainResult>> {
    const actor = {
      id: req.platformUser?.id ?? req.user?.id ?? '00000000-0000-0000-0000-000000000000',
      email: req.platformUser?.email ?? req.user?.email,
    };
    const data = await this.brandingService.verifyCustomDomain(tenantId, actor);
    return { data };
  }

  @Post('custom-domain/disable')
  @RequirePlatformPermission('tenant', 'edit')
  @ApiOperation({
    summary:
      'Disable custom domain routing with mandatory reason (audited in platform_audit_logs)',
  })
  async disableCustomDomain(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: DisableCustomDomainDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<TenantBrandingView>> {
    const actor = {
      id: req.platformUser?.id ?? req.user?.id ?? '00000000-0000-0000-0000-000000000000',
      email: req.platformUser?.email ?? req.user?.email,
    };
    const data = await this.brandingService.disableCustomDomain(tenantId, dto, actor);
    return { data };
  }

  @Post('custom-domain/re-enable')
  @RequirePlatformPermission('tenant', 'edit')
  @ApiOperation({
    summary: 'Re-enable a previously disabled custom domain',
  })
  async reEnableCustomDomain(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Req() req: any,
  ): Promise<ApiEnvelope<TenantBrandingView>> {
    const actor = {
      id: req.platformUser?.id ?? req.user?.id ?? '00000000-0000-0000-0000-000000000000',
      email: req.platformUser?.email ?? req.user?.email,
    };
    const data = await this.brandingService.reEnableCustomDomain(tenantId, actor);
    return { data };
  }
}
