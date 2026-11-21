import {
  Body,
  Controller,
  Get,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { Public } from '../common/decorators/public.decorator';
import { BrandingService } from './branding.service';
import { UpdateTenantBrandingDto } from './dto/branding.dto';
import type {
  ApiResponse as ApiEnvelope,
  TenantBrandingView,
  TenantPublicResolveView,
} from '@hrm/shared-types';

@ApiTags('Branding & White-Labeling')
@Controller('branding')
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get()
  @ApiBearerAuth('access-token')
  @RequirePermission('settings', 'view')
  @ApiOperation({
    summary: 'Get tenant branding & white-label settings (MODULES.md §01)',
  })
  async getBranding(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<TenantBrandingView>> {
    const data = await this.brandingService.getBranding(user.tenantId!);
    return { data };
  }

  @Put()
  @ApiBearerAuth('access-token')
  @RequirePermission('settings', 'edit')
  @ApiOperation({
    summary: 'Update tenant branding (logo, primary colour, email sender name and address)',
    description:
      'Configures white-labeled logo, theme colors, email sender details, and syncs with tenant settings.',
  })
  async updateBranding(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTenantBrandingDto,
    @Req() req: Request,
  ): Promise<ApiEnvelope<TenantBrandingView>> {
    const meta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
    const data = await this.brandingService.updateBranding(
      user.tenantId!,
      dto,
      user.id,
      meta,
    );
    return { data };
  }

  @Public()
  @Get('public')
  @ApiOperation({
    summary: 'Public tenant branding resolution for login and custom domains',
    description:
      'Returns white-label assets (logo, primary colour, display name) given a subdomain or custom domain.',
  })
  async getPublicBranding(
    @Query('subdomain') subdomain?: string,
    @Query('domain') domain?: string,
    @Req() req?: Request,
  ): Promise<ApiEnvelope<TenantPublicResolveView>> {
    const headerDomain =
      (req?.headers['x-custom-domain'] as string) ||
      (req?.headers['x-forwarded-host'] as string) ||
      req?.headers.host;

    const resolvedDomain = domain || (headerDomain && !headerDomain.includes('localhost') ? headerDomain : undefined);
    const data = await this.brandingService.resolvePublicTenant(subdomain, resolvedDomain);
    return { data };
  }
}
