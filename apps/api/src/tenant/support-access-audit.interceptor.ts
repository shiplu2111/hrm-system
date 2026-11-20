import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { PlatformAuditService } from '../platform/audit/platform-audit.service';

/**
 * Dual Audit Logging Interceptor for Support Access (SECURITY.md §2, AUDIT_LOG.md §1-2).
 * Every request made with an impersonation token is tagged and written to:
 * 1. platform_audit_logs (for platform operators)
 * 2. tenant audit_logs (for tenant administrators, with the staff member's name visible).
 */
@Injectable()
export class SupportAccessAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SupportAccessAuditInterceptor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: AuthenticatedUser }>();
    const res = http.getResponse<Response>();

    return next.handle().pipe(
      tap({
        next: () => {
          void this.recordAuditLogs(req, res.statusCode);
        },
        error: (err) => {
          const status = err instanceof HttpException ? err.getStatus() : 500;
          void this.recordAuditLogs(req, status, err.message);
        },
      }),
    );
  }

  private async recordAuditLogs(
    req: Request & { user?: AuthenticatedUser },
    statusCode: number,
    errorMessage?: string,
  ): Promise<void> {
    const user = req.user;
    if (!user?.isSupportAccess) {
      return;
    }

    const tenantId = user.tenantId;
    const staffName = user.staffName ?? 'Platform Staff';
    const staffEmail = user.staffEmail ?? 'staff@platform.local';
    const accessMode = user.accessMode ?? 'read_only';
    const method = req.method;
    const originalUrl = req.originalUrl ?? req.url;

    // 1. Write to platform_audit_logs
    try {
      await this.platformAudit.log({
        userId: user.platformUserId ?? null,
        action: 'support_access.api_call',
        module: 'support_access',
        recordId: tenantId ?? null,
        reason: `Support session (${accessMode}) by ${staffName} (${staffEmail}) - ${method} ${originalUrl} [${statusCode}]`,
        newValue: {
          method,
          url: originalUrl,
          statusCode,
          accessMode,
          supportRequestId: user.supportRequestId,
          errorMessage: errorMessage ?? null,
        },
        ipAddress: req.ip ?? null,
        userAgent: req.headers?.['user-agent'] ?? null,
      });
    } catch (err) {
      this.logger.error(
        `Failed writing to platform_audit_logs: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 2. Tag and write to tenant audit_logs with staff member's real name visible
    if (tenantId) {
      try {
        const actionType =
          method === 'POST' ? 'create' : method === 'DELETE' ? 'delete' : 'update';

        await this.prisma.unscoped.auditLog.create({
          data: {
            tenantId,
            userId: user.id, // Target impersonated user ID
            action: actionType,
            module: 'support_access',
            recordId: user.supportRequestId || tenantId,
            newValue: {
              supportAccess: true,
              staffName,
              staffEmail,
              accessMode,
              supportRequestId: user.supportRequestId,
              method,
              url: originalUrl,
              statusCode,
              errorMessage: errorMessage ?? null,
            },
            ipAddress: req.ip ?? null,
            device: `Platform Support: ${staffName} (${staffEmail})`,
          },
        });
      } catch (err) {
        this.logger.error(
          `Failed writing support access log to tenant audit trail: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
