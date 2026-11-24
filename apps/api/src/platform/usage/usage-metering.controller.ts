// usage-metering.controller.ts
// Platform Usage Metering Controller

import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import type {
  UsageDailyRecord,
  UsageDailySummary,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { TriggerUsageMeteringDto, UsageMeteringFilterDto } from './dto/usage-metering.dto';
import { UsageMeteringService } from './usage-metering.service';

@ApiTags('platform-usage')
@ApiBearerAuth('platform-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard)
@Controller('platform/usage')
export class UsageMeteringController {
  constructor(private readonly usageMeteringService: UsageMeteringService) {}

  @Get('daily')
  @ApiOperation({
    summary: 'List per-tenant daily usage records',
    description:
      'Queries usage_daily table with per-tenant active employees, storage used, API calls, notifications sent by channel, and synced attendance events.',
  })
  @ApiResponse({ status: 200, description: 'Paginated daily usage records' })
  async listDailyUsage(
    @Query() filter: UsageMeteringFilterDto,
  ): Promise<ApiEnvelope<{ items: UsageDailyRecord[]; total: number; page: number; limit: number }>> {
    const data = await this.usageMeteringService.listDailyUsage(filter);
    return { data };
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get platform-wide aggregated usage summary',
    description: 'Calculates total active employees, storage, API calls, and notifications across tenants.',
  })
  @ApiResponse({ status: 200, description: 'Usage summary across tenants' })
  async getUsageSummary(
    @Query() filter: UsageMeteringFilterDto,
  ): Promise<ApiEnvelope<UsageDailySummary>> {
    const data = await this.usageMeteringService.getUsageSummary(filter);
    return { data };
  }

  @Get('tenants/:tenantId')
  @ApiOperation({ summary: 'Get historical usage timeline for a specific tenant' })
  @ApiResponse({ status: 200, description: 'Tenant usage history' })
  async getTenantUsage(
    @Param('tenantId') tenantId: string,
    @Query('days') days?: number,
  ): Promise<ApiEnvelope<UsageDailyRecord[]>> {
    const data = await this.usageMeteringService.getTenantUsage(tenantId, days ? Number(days) : 30);
    return { data };
  }

  @Post('trigger')
  @ApiOperation({
    summary: 'Manually trigger usage metering calculation',
    description:
      'Runs the nightly aggregation job on-demand for a target calendar date (or yesterday) and optional specific tenant.',
  })
  @ApiResponse({ status: 200, description: 'Usage metering execution summary' })
  async triggerUsageMetering(
    @Body() dto: TriggerUsageMeteringDto,
  ): Promise<ApiEnvelope<UsageDailySummary>> {
    const data = await this.usageMeteringService.runDailyMetering(dto.date, dto.tenantId);
    return { data };
  }
}
