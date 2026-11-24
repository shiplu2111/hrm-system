// health-metrics.interceptor.ts
// Global NestJS interceptor measuring API response latency and error telemetry

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { HealthTelemetryService } from './health-telemetry.service';

@Injectable()
export class HealthMetricsInterceptor implements NestInterceptor {
  constructor(private readonly telemetryService: HealthTelemetryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const t0 = Date.now();
    this.telemetryService.startRequest();

    return next.handle().pipe(
      finalize(() => {
        const duration = Date.now() - t0;
        const statusCode = res.statusCode || 200;
        const tenantId = req.user?.tenantId || (req.headers && req.headers['x-tenant-id']);
        this.telemetryService.recordRequest(
          duration,
          statusCode,
          typeof tenantId === 'string' ? tenantId : undefined,
        );
      }),
    );
  }
}
