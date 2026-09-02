import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SKIP_TENANT_SCOPE_KEY } from '../common/decorators/skip-tenant-scope.decorator';
import {
  runWithTenantContext,
  type TenantContextStore,
} from './tenant.context';

/**
 * Binds tenant_id from the authenticated JWT into AsyncLocalStorage so the
 * Prisma tenant extension can scope every query (ARCHITECTURE.md §2).
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skipScope = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      return next.handle();
    }

    const store: TenantContextStore = {
      tenantId: user.tenantId,
      userId: user.id,
      roleId: user.roleId,
      skipScope: skipScope ?? false,
    };

    return new Observable((subscriber) => {
      runWithTenantContext(store, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (error) => subscriber.error(error),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
