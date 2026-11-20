import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

/**
 * Support Access Boundary Guard (SECURITY.md §2, AUDIT_LOG.md)
 *
 * Rules:
 * 1. Non-support requests pass through unharmed.
 * 2. If token is marked with `support_access`:
 *    a. Grant must be active in DB (not expired, not revoked).
 *    b. Read-only by default: write requests (POST, PUT, PATCH, DELETE) fail unless mode is 'read_write'.
 *    c. Critical Action Hard-Blocks (Strictly blocked even in write mode):
 *       - Payroll finalization: blocked.
 *       - Payment execution / mark-paid: blocked.
 *       - Bank-detail reveal: blocked.
 */
@Injectable()
export class SupportAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    // Standard tenant/platform users are unaffected
    if (!user?.isSupportAccess) {
      return true;
    }

    const { supportRequestId, accessMode } = user;

    if (!supportRequestId) {
      throw new UnauthorizedException({
        code: 'INVALID_SUPPORT_TOKEN',
        message: 'Support access token lacks mandatory request reference',
      });
    }

    // Verify support request status in database
    const supportReq = await this.prisma.unscoped.supportAccessRequest.findUnique({
      where: { id: supportRequestId },
    });

    if (!supportReq) {
      throw new UnauthorizedException({
        code: 'SUPPORT_GRANT_NOT_FOUND',
        message: 'Support access grant not found in registry',
      });
    }

    if (supportReq.status !== 'approved' || supportReq.revokedAt !== null) {
      throw new UnauthorizedException({
        code: 'SUPPORT_SESSION_REVOKED',
        message: 'Support access grant has been revoked or terminated',
      });
    }

    if (supportReq.expiresAt && supportReq.expiresAt < new Date()) {
      await this.prisma.unscoped.supportAccessRequest.update({
        where: { id: supportRequestId },
        data: { status: 'expired' },
      });
      throw new UnauthorizedException({
        code: 'SUPPORT_SESSION_EXPIRED',
        message: 'Support access grant has expired (max 4 hours duration)',
      });
    }

    const method = request.method.toUpperCase();
    const url = (request.originalUrl ?? request.url ?? '').toLowerCase();

    // 1. Read-only by default check: write actions require explicit read_write approval
    if (accessMode === 'read_only' && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      throw new ForbiddenException({
        code: 'SUPPORT_ACCESS_READ_ONLY',
        message:
          'Support access session is in read-only mode. Write operations require explicit read_write approval by the Company Owner.',
      });
    }

    // 2. Critical Actions Hard-Block (Strictly blocked even in write mode)

    // 2a. Bank-detail reveal
    const queryField = String((request.query as Record<string, unknown>)?.field ?? '').toLowerCase();
    if (
      url.includes('/reveal') ||
      queryField.includes('bank') ||
      url.includes('bank-detail') ||
      url.includes('bank_detail')
    ) {
      if (queryField === 'bankaccountnumber' || url.includes('bank')) {
        throw new ForbiddenException({
          code: 'SUPPORT_ACCESS_RESTRICTED',
          message:
            'Security Policy: Support engineers are strictly prohibited from revealing bank credentials.',
        });
      }
    }

    // 2b. Payroll finalize & pay
    const body = (request.body as Record<string, unknown>) ?? {};
    const toStatus = String(body.toStatus ?? body.targetStatus ?? body.status ?? '').toLowerCase();
    if (
      url.includes('/finalize') ||
      (url.includes('/transition') && (toStatus === 'finalized' || toStatus === 'paid'))
    ) {
      throw new ForbiddenException({
        code: 'SUPPORT_ACCESS_RESTRICTED',
        message:
          'Security Policy: Support engineers are strictly prohibited from finalizing payroll runs.',
      });
    }

    // 2c. Payment execution / payment batches
    if (
      url.includes('/mark-paid') ||
      (url.includes('/payment-batches') && method === 'POST' && !url.endsWith('/payment-batches')) ||
      (url.includes('/contractor-payment-batches') && method === 'PATCH' && url.includes('paid')) ||
      url.includes('/payments/execute')
    ) {
      throw new ForbiddenException({
        code: 'SUPPORT_ACCESS_RESTRICTED',
        message:
          'Security Policy: Support engineers are strictly prohibited from executing payments.',
      });
    }

    return true;
  }
}
