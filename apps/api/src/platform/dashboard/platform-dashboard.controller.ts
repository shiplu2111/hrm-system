import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse as SwaggerApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type {
  ApiResponse as ApiEnvelope,
  PlatformDashboardView,
  PlatformNewTenantsPerWeek,
  PlatformTenantApproachingLimit,
  PlatformTenantsByStatus,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import { PlatformDashboardService } from './platform-dashboard.service';

@ApiTags('platform-dashboard')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/dashboard')
export class PlatformDashboardController {
  constructor(
    private readonly dashboardService: PlatformDashboardService,
  ) {}

  @Get()
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({
    summary:
      'Get platform aggregate dashboard metrics (tenants by status, total active headcount, MRR/ARR, 12-week growth, plan limit warnings, error rates). Cached in Redis for 60 seconds.',
  })
  @ApiQuery({
    name: 'refresh',
    required: false,
    description: 'Set to "true" to force cache eviction and recalculation',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Platform dashboard aggregates retrieved successfully',
  })
  async getDashboard(
    @Query('refresh') refresh?: string,
  ): Promise<ApiEnvelope<PlatformDashboardView>> {
    const forceRefresh = refresh === 'true' || refresh === '1';
    const { data, cached } =
      await this.dashboardService.getDashboardAggregates(forceRefresh);

    return {
      data,
      meta: {
        page: 1,
        total: 1,
        cached,
        cacheTtlSeconds: 60,
        generatedAt: data.asOf,
      },
    };
  }

  @Get('overview')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({
    summary: 'Alias to main dashboard aggregates endpoint',
  })
  async getOverview(
    @Query('refresh') refresh?: string,
  ): Promise<ApiEnvelope<PlatformDashboardView>> {
    return this.getDashboard(refresh);
  }

  @Get('tenants-by-status')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({
    summary:
      'Get tenant count breakdown by lifecycle status (trial, active, suspended, cancelled)',
  })
  async getTenantsByStatus(): Promise<ApiEnvelope<PlatformTenantsByStatus>> {
    const data = await this.dashboardService.getTenantsByStatus();
    return { data };
  }

  @Get('new-tenants-weekly')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({
    summary:
      'Get new tenants provisioned per week over the preceding 12-week window',
  })
  async getNewTenantsWeekly(): Promise<
    ApiEnvelope<PlatformNewTenantsPerWeek[]>
  > {
    const data = await this.dashboardService.getNewTenantsPerWeek();
    return { data };
  }

  @Get('plan-limits')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({
    summary:
      'List tenants approaching or exceeding their plan capacity limits (>= 80% usage)',
  })
  async getPlanLimits(): Promise<
    ApiEnvelope<PlatformTenantApproachingLimit[]>
  > {
    const data = await this.dashboardService.getTenantsApproachingLimits();
    return { data };
  }
}
