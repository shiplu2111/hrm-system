// usage-metering.controller.ts
// Platform Usage Metering Controller

import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import type {
  TenantUsageOverviewResponse,
  TenantUsageTrendsResponse,
  UsageDailyRecord,
  UsageDailySummary,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import {
  TenantUsageExportQueryDto,
  TenantUsageOverviewFilterDto,
  TenantUsageTrendsQueryDto,
  TriggerUsageMeteringDto,
  UsageMeteringFilterDto,
} from './dto/usage-metering.dto';
import { UsageMeteringService } from './usage-metering.service';

@ApiTags('platform-usage')
@ApiBearerAuth('platform-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard)
@Controller('platform/usage')
export class UsageMeteringController {
  constructor(private readonly usageMeteringService: UsageMeteringService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get per-tenant usage and storage against plan limits with near-limit indicators',
    description:
      'Returns per-tenant headcount, storage usage, and API volume compared with plan limits, near-limit flags (>80%), and summary KPIs.',
  })
  @ApiResponse({ status: 200, description: 'Tenant usage overview and plan limits' })
  async getUsageOverview(
    @Query() filter: TenantUsageOverviewFilterDto,
  ): Promise<ApiEnvelope<TenantUsageOverviewResponse>> {
    const data = await this.usageMeteringService.getTenantUsageOverview(filter);
    return { data };
  }

  @Get('trends')
  @ApiOperation({
    summary: 'Get usage timeseries trends against plan limits',
    description:
      'Provides daily timeseries points for active employees, storage footprint, and API volume for all tenants or a single tenant with limit threshold lines.',
  })
  @ApiResponse({ status: 200, description: 'Usage timeseries trends' })
  async getUsageTrends(
    @Query() query: TenantUsageTrendsQueryDto,
  ): Promise<ApiEnvelope<TenantUsageTrendsResponse>> {
    const data = await this.usageMeteringService.getTenantUsageTrends(query);
    return { data };
  }

  @Get('export')
  @ApiOperation({
    summary: 'Export tenant usage & storage report',
    description: 'Generates a CSV or JSON export of tenant usage versus plan limits.',
  })
  @ApiResponse({ status: 200, description: 'Usage export payload' })
  async exportUsage(
    @Query() query: TenantUsageExportQueryDto,
  ): Promise<ApiEnvelope<{ csv?: string; json?: any; filename: string }>> {
    const data = await this.usageMeteringService.exportTenantUsage(query);
    return { data };
  }

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
