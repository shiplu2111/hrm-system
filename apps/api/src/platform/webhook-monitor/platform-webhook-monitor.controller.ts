// apps/api/src/platform/webhook-monitor/platform-webhook-monitor.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantWebhookStatus } from '@prisma/client';
import type {
  AutoDisableFailingEndpointsInput,
  AutoDisableFailingEndpointsResult,
  PlatformWebhookDeliveriesQuery,
  PlatformWebhookDeliveryItem,
  PlatformWebhookEndpointItem,
  PlatformWebhookEndpointsQuery,
  PlatformWebhookMonitorSummary,
  RedeliverWebhookResult,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import {
  PlatformActorContext,
  PlatformWebhookMonitorService,
} from './platform-webhook-monitor.service';

interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, any>;
}

@ApiTags('Platform Webhook Delivery Monitor')
@ApiBearerAuth()
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/webhook-monitor')
export class PlatformWebhookMonitorController {
  constructor(
    private readonly webhookMonitorService: PlatformWebhookMonitorService,
  ) {}

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
  @ApiOperation({ summary: 'Get overview KPI metrics for cross-tenant webhook deliveries' })
  async getSummary(): Promise<ApiEnvelope<PlatformWebhookMonitorSummary>> {
    const data = await this.webhookMonitorService.getSummary();
    return { data };
  }

  // ==========================================
  // Deliveries Log
  // ==========================================

  @Get('deliveries')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'List webhook deliveries across all tenants with status and filters' })
  async listDeliveries(
    @Query() query: PlatformWebhookDeliveriesQuery,
  ): Promise<ApiEnvelope<PlatformWebhookDeliveryItem[]>> {
    const { data, meta } = await this.webhookMonitorService.listDeliveries(query);
    return { data, meta };
  }

  @Get('deliveries/:id')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'Get single webhook delivery detail with full payload' })
  async getDeliveryDetail(
    @Param('id') id: string,
  ): Promise<ApiEnvelope<PlatformWebhookDeliveryItem>> {
    const data = await this.webhookMonitorService.getDeliveryDetail(id);
    return { data };
  }

  @Post('deliveries/:id/redeliver')
  @RequirePlatformPermission('platform', 'edit')
  @ApiOperation({ summary: 'Trigger manual redelivery of a webhook delivery' })
  async redeliver(
    @Param('id') id: string,
    @Req() req?: any,
  ): Promise<ApiEnvelope<RedeliverWebhookResult>> {
    const actor = this.getActor(req);
    const data = await this.webhookMonitorService.redeliver(id, actor);
    return { data };
  }

  // ==========================================
  // Endpoints Health & Auto-Disable
  // ==========================================

  @Get('endpoints')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'List all webhook endpoints across tenants with 7d health stats' })
  async listEndpoints(
    @Query() query: PlatformWebhookEndpointsQuery,
  ): Promise<ApiEnvelope<PlatformWebhookEndpointItem[]>> {
    const { data, meta } = await this.webhookMonitorService.listEndpoints(query);
    return { data, meta };
  }

  @Patch('endpoints/:id/status')
  @RequirePlatformPermission('platform', 'edit')
  @ApiOperation({ summary: 'Manually enable or disable a webhook endpoint' })
  async toggleEndpointStatus(
    @Param('id') id: string,
    @Body() body: { status: TenantWebhookStatus },
    @Req() req?: any,
  ): Promise<ApiEnvelope<PlatformWebhookEndpointItem>> {
    const actor = this.getActor(req);
    const data = await this.webhookMonitorService.toggleEndpointStatus(
      id,
      body.status,
      actor,
    );
    return { data };
  }

  @Post('auto-disable')
  @RequirePlatformPermission('platform', 'edit')
  @ApiOperation({
    summary:
      'Auto-disable endpoints failing continuously for N days with notification to the tenant',
  })
  async autoDisable(
    @Body() input: AutoDisableFailingEndpointsInput,
    @Req() req?: any,
  ): Promise<ApiEnvelope<AutoDisableFailingEndpointsResult>> {
    const actor = this.getActor(req);
    const data = await this.webhookMonitorService.autoDisableFailingEndpoints(
      input,
      actor,
    );
    return { data };
  }
}
