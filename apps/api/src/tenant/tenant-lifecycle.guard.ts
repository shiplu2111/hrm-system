import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantStatus, TenantSuspensionMode } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { SKIP_TENANT_SCOPE_KEY } from '../common/decorators/skip-tenant-scope.decorator';
import { PrismaService } from '../database/prisma.service';

interface CachedTenantStatus {
  status: TenantStatus;
  suspensionMode: TenantSuspensionMode | null;
  cachedAt: number;
}

const CACHE_TTL_MS = 10_000; // 10 seconds in-memory cache

@Injectable()
export class TenantLifecycleGuard implements CanActivate {
  private readonly statusCache = new Map<string, CachedTenantStatus>();

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const skipScope = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipScope) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      method: string;
      url?: string;
      originalUrl?: string;
    }>();

    // Skip platform administrative routes
    const url = request.originalUrl ?? request.url ?? '';
    if (url.includes('/platform/')) {
      return true;
    }

    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      return true;
    }

    const tenantInfo = await this.getTenantStatus(tenantId);
    if (!tenantInfo) {
      return true;
    }

    const { status, suspensionMode } = tenantInfo;

    // Enforce suspension modes
    if (status === TenantStatus.suspended) {
      if (suspensionMode === TenantSuspensionMode.fully_blocked) {
        throw new ForbiddenException({
          code: 'TENANT_SUSPENDED',
          message:
            'Tenant workspace is fully suspended. All access is blocked.',
        });
      }

      // In read_only mode, only safe GET, HEAD, OPTIONS requests are permitted
      const method = request.method.toUpperCase();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        throw new ForbiddenException({
          code: 'TENANT_READ_ONLY',
          message:
            'Tenant workspace is suspended in read-only mode. Record modifications are disabled.',
        });
      }
    }

    // Enforce cancelled, pending_deletion, deleted
    if (status === TenantStatus.cancelled) {
      throw new ForbiddenException({
        code: 'TENANT_CANCELLED',
        message: 'Tenant workspace account has been cancelled.',
      });
    }

    if (
      status === TenantStatus.pending_deletion ||
      status === TenantStatus.deleted
    ) {
      throw new ForbiddenException({
        code: 'TENANT_INACTIVE',
        message:
          'Tenant workspace is pending deletion or has been permanently deleted.',
      });
    }

    return true;
  }

  private async getTenantStatus(
    tenantId: string,
  ): Promise<CachedTenantStatus | null> {
    const now = Date.now();
    const cached = this.statusCache.get(tenantId);
    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
      return cached;
    }

    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id: tenantId },
      select: {
        status: true,
        suspensionMode: true,
      },
    });

    if (!tenant) {
      return null;
    }

    const entry: CachedTenantStatus = {
      status: tenant.status,
      suspensionMode: tenant.suspensionMode,
      cachedAt: now,
    };
    this.statusCache.set(tenantId, entry);
    return entry;
  }
}
