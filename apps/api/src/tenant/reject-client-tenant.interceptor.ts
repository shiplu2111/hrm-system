import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { CLIENT_TENANT_FIELD_NAMES } from './tenant.constants';

/**
 * Rejects authenticated requests that supply tenant_id via params/query/body.
 * Tenant scope must come only from the JWT (RULES.md §1).
 */
@Injectable()
export class RejectClientTenantInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      params?: Record<string, unknown>;
      query?: Record<string, unknown>;
      body?: Record<string, unknown>;
    }>();

    this.assertNoClientTenantId(request.params);
    this.assertNoClientTenantId(request.query);
    this.assertNoClientTenantId(request.body);

    return next.handle();
  }

  private assertNoClientTenantId(
    source: Record<string, unknown> | undefined,
  ): void {
    if (!source) {
      return;
    }

    for (const field of CLIENT_TENANT_FIELD_NAMES) {
      if (source[field] !== undefined) {
        throw new BadRequestException({
          code: 'TENANT_ID_NOT_ALLOWED',
          message:
            'tenant_id must not be supplied by the client — it is derived from the access token',
        });
      }
    }
  }
}
