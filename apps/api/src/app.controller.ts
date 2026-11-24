import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import { Public } from './common/decorators/public.decorator';
import { AppService } from './app.service';
import { HealthTelemetryService } from './platform/health/health-telemetry.service';

@ApiTags('health')
@Controller()
@Public()
@SkipThrottle()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly healthTelemetry: HealthTelemetryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'API root message' })
  getRoot(): ApiEnvelope<{ message: string }> {
    return {
      data: { message: this.appService.getHello() },
    };
  }

  @Get(['health', 'api/v1/health'])
  @ApiOperation({ summary: 'Public health check with live subsystem indicators' })
  @ApiResponse({ status: 200, description: 'Service is running' })
  async getHealth(): Promise<ApiEnvelope<{
    status: string;
    uptimeSeconds: number;
    apiLatencyMs: number;
    errorRatePercentage: number;
    database: string;
    redis: string;
    mobileSyncSuccessRate: number;
  }>> {
    const api = this.healthTelemetry.getApiLatencyAndErrorRate();
    const db = await this.healthTelemetry.getDatabaseConnectionHealth();
    const redis = await this.healthTelemetry.getRedisHealth();
    const mobileSync = await this.healthTelemetry.getMobileSyncHealth();

    return {
      data: {
        status: db.status === 'healthy' ? 'ok' : 'degraded',
        uptimeSeconds: Math.floor(process.uptime()),
        apiLatencyMs: api.avgLatencyMs,
        errorRatePercentage: api.errorRatePercentage,
        database: db.status,
        redis: redis.status,
        mobileSyncSuccessRate: mobileSync.successRatePercentage,
      },
    };
  }
}
