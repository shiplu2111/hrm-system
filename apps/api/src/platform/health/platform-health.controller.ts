// platform-health.controller.ts
// Platform health endpoints exposing API latency, error rate, DB, Redis, BullMQ queues, WebSockets, and Mobile Sync

import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import type {
  ApiLatencyAndErrorRate,
  DatabaseConnectionHealth,
  MobileSyncHealth,
  PlatformComprehensiveHealth,
  QueueHealthSummary,
  RedisHealth,
  WebSocketHealth,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { HealthTelemetryService } from './health-telemetry.service';

@ApiTags('platform-health')
@ApiBearerAuth('platform-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard)
@Controller('platform/health')
export class PlatformHealthController {
  constructor(private readonly healthTelemetry: HealthTelemetryService) {}

  @Get()
  @ApiOperation({
    summary: 'Comprehensive platform health status and metrics',
    description:
      'Aggregates API latency/error rate, database connection pool, Redis, BullMQ queue depths, WebSocket clients, and mobile sync success rate.',
  })
  @ApiResponse({ status: 200, description: 'Comprehensive health status' })
  async getComprehensiveHealth(): Promise<ApiEnvelope<PlatformComprehensiveHealth>> {
    const data = await this.healthTelemetry.getComprehensiveHealth();
    return { data };
  }

  @Get('api')
  @ApiOperation({ summary: 'API latency, percentiles, and error rate metrics' })
  getApiMetrics(): ApiEnvelope<ApiLatencyAndErrorRate> {
    const data = this.healthTelemetry.getApiLatencyAndErrorRate();
    return { data };
  }

  @Get('database')
  @ApiOperation({ summary: 'Database connection pool and query ping latency' })
  async getDatabaseHealth(): Promise<ApiEnvelope<DatabaseConnectionHealth>> {
    const data = await this.healthTelemetry.getDatabaseConnectionHealth();
    return { data };
  }

  @Get('redis')
  @ApiOperation({ summary: 'Redis connection, memory consumption, and connected clients' })
  async getRedisHealth(): Promise<ApiEnvelope<RedisHealth>> {
    const data = await this.healthTelemetry.getRedisHealth();
    return { data };
  }

  @Get('queues')
  @ApiOperation({ summary: 'Queue depth and failed-job counts per BullMQ queue' })
  async getQueuesHealth(): Promise<ApiEnvelope<QueueHealthSummary>> {
    const data = await this.healthTelemetry.getBullMqQueuesHealth();
    return { data };
  }

  @Get('websocket')
  @ApiOperation({ summary: 'WebSocket realtime gateway connected clients count' })
  getWebSocketHealth(): ApiEnvelope<WebSocketHealth> {
    const data = this.healthTelemetry.getWebSocketHealth();
    return { data };
  }

  @Get('mobile-sync')
  @ApiOperation({ summary: 'Mobile sync success rate and diagnostics per OFFLINE_SYNC.md §4' })
  async getMobileSyncHealth(): Promise<ApiEnvelope<MobileSyncHealth>> {
    const data = await this.healthTelemetry.getMobileSyncHealth();
    return { data };
  }
}
