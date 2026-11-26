import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { ApiResponse as ApiEnvelope, PublicPlatformStatusResponse } from '@hrm/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { HealthTelemetryService } from './health-telemetry.service';

@ApiTags('public-status')
@SkipTenantScope()
@Public()
@Throttle({ default: { limit: 120, ttl: 60000 } })
@Controller('public/status')
export class PublicStatusController {
  constructor(private readonly healthTelemetry: HealthTelemetryService) {}

  @Get()
  @ApiOperation({
    summary: 'Public coarse service status, 90-day component uptime bars, and incident history',
    description:
      'Exposes coarse operational states (API, web app, mobile sync, notifications), 90-day uptime bars, and sanitized staff-written incidents without internal hostnames, queue names, or error details.',
  })
  @ApiResponse({ status: 200, description: 'Public service status snapshot' })
  async getPublicStatus(): Promise<ApiEnvelope<PublicPlatformStatusResponse>> {
    const data = await this.healthTelemetry.getPublicStatusOverview();
    return { data };
  }
}
