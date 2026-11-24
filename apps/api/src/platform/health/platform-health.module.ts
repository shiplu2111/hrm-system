// platform-health.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { RealtimeModule } from '../../realtime/realtime.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformHealthController } from './platform-health.controller';
import { HealthTelemetryService } from './health-telemetry.service';
import { HealthMetricsInterceptor } from './health-metrics.interceptor';

@Module({
  imports: [PrismaModule, RealtimeModule, forwardRef(() => PlatformAuthModule)],
  controllers: [PlatformHealthController],
  providers: [HealthTelemetryService, HealthMetricsInterceptor],
  exports: [HealthTelemetryService, HealthMetricsInterceptor],
})
export class PlatformHealthModule {}
