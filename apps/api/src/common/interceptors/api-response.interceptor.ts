import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { ApiResponse } from '@hrm/shared-types';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Wraps successful responses in `{ data, meta? }` — API_GUIDELINES.md §3. */
@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<unknown>> {
    return next.handle().pipe(
      map((body) => {
        if (body === undefined || body === null) {
          return body;
        }

        if (typeof body === 'object' && 'data' in (body as object)) {
          return body as ApiResponse<unknown>;
        }

        return { data: body };
      }),
    );
  }
}
