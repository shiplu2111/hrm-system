// platform-health.controller.ts
// Platform health endpoints exposing API latency, error rate, DB, Redis, BullMQ queues, WebSockets, and Mobile Sync

import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import type {
  ApiLatencyAndErrorRate,
  CreatePlatformIncidentInput,
  DatabaseConnectionHealth,
  HealthTimeseriesResponse,
  MobileSyncHealth,
  NotificationProvidersHealth,
  PlatformComprehensiveHealth,
  PlatformIncidentItem,
  PlatformIncidentsResponse,
  QueueHealthSummary,
  RedisHealth,
  StorageHealth,
  UpdatePlatformIncidentInput,
  WebSocketHealth,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import { HealthTelemetryService } from './health-telemetry.service';

@ApiTags('platform-health')
@ApiBearerAuth('platform-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/health')
export class PlatformHealthController {
  constructor(private readonly healthTelemetry: HealthTelemetryService) {}

  @Get()
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({
    summary: 'Comprehensive platform health status and metrics',
    description:
      'Aggregates API latency/error rate, database connection pool, Redis, BullMQ queue depths, Storage, Notification providers, WebSocket clients, and mobile sync success rate.',
  })
  @ApiResponse({ status: 200, description: 'Comprehensive health status' })
  async getComprehensiveHealth(): Promise<ApiEnvelope<PlatformComprehensiveHealth>> {
    const data = await this.healthTelemetry.getComprehensiveHealth();
    return { data };
  }

  @Get('storage')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'Platform Storage driver status, disk space, and I/O latency' })
  async getStorageHealth(): Promise<ApiEnvelope<StorageHealth>> {
    const data = await this.healthTelemetry.getStorageHealth();
    return { data };
  }

  @Get('notifications')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'Notification providers health: Email SMTP, SMS, Firebase Push, and In-App' })
  async getNotificationProvidersHealth(): Promise<ApiEnvelope<NotificationProvidersHealth>> {
    const data = await this.healthTelemetry.getNotificationProvidersHealth();
    return { data };
  }

  @Get('trends')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'Timeseries latency percentiles and error rate trends' })
  async getLatencyAndErrorTrends(
    @Query('timeRange') timeRange?: '1h' | '6h' | '24h' | '7d',
  ): Promise<ApiEnvelope<HealthTimeseriesResponse>> {
    const data = await this.healthTelemetry.getLatencyAndErrorTrends(timeRange);
    return { data };
  }

  @Get('incidents')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'List recent platform incidents with impact and root cause' })
  async getRecentIncidents(
    @Query('subsystem') subsystem?: string,
    @Query('status') status?: string,
  ): Promise<ApiEnvelope<PlatformIncidentsResponse>> {
    const data = await this.healthTelemetry.getRecentIncidents({ subsystem, status });
    return { data };
  }

  @Post('incidents')
  @RequirePlatformPermission('platform', 'manage')
  @ApiOperation({ summary: 'Log a new platform incident' })
  async createIncident(
    @Body() input: CreatePlatformIncidentInput,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformIncidentItem>> {
    const actorEmail = req.platformUser?.email || req.user?.email;
    const data = await this.healthTelemetry.createIncident(input, actorEmail);
    return { data };
  }

  @Patch('incidents/:id')
  @RequirePlatformPermission('platform', 'manage')
  @ApiOperation({ summary: 'Update or resolve a platform incident' })
  async updateIncident(
    @Param('id') id: string,
    @Body() input: UpdatePlatformIncidentInput,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformIncidentItem>> {
    const actorEmail = req.platformUser?.email || req.user?.email;
    const data = await this.healthTelemetry.updateIncident(id, input, actorEmail);
    return { data };
  }

  @Get('api')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'API latency, percentiles, and error rate metrics' })
  getApiMetrics(): ApiEnvelope<ApiLatencyAndErrorRate> {
    const data = this.healthTelemetry.getApiLatencyAndErrorRate();
    return { data };
  }

  @Get('database')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'Database connection pool and query ping latency' })
  async getDatabaseHealth(): Promise<ApiEnvelope<DatabaseConnectionHealth>> {
    const data = await this.healthTelemetry.getDatabaseConnectionHealth();
    return { data };
  }

  @Get('redis')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'Redis connection, memory consumption, and connected clients' })
  async getRedisHealth(): Promise<ApiEnvelope<RedisHealth>> {
    const data = await this.healthTelemetry.getRedisHealth();
    return { data };
  }

  @Get('queues')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'Queue depth and failed-job counts per BullMQ queue' })
  async getQueuesHealth(): Promise<ApiEnvelope<QueueHealthSummary>> {
    const data = await this.healthTelemetry.getBullMqQueuesHealth();
    return { data };
  }

  @Get('websocket')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'WebSocket realtime gateway connected clients count' })
  getWebSocketHealth(): ApiEnvelope<WebSocketHealth> {
    const data = this.healthTelemetry.getWebSocketHealth();
    return { data };
  }

  @Get('mobile-sync')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'Mobile sync success rate and diagnostics per OFFLINE_SYNC.md §4' })
  async getMobileSyncHealth(): Promise<ApiEnvelope<MobileSyncHealth>> {
    const data = await this.healthTelemetry.getMobileSyncHealth();
    return { data };
  }
}
