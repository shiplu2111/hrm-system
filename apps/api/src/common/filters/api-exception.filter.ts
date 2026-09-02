import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiError, ApiErrorDetail } from '@hrm/shared-types';
import type { Request, Response } from 'express';
import {
  HTTP_STATUS_TO_ERROR_CODE,
  STANDARD_ERROR_CODES,
} from '../constants/error-codes';
import { getRequestId } from '../middleware/request-id.middleware';
import { isRecord } from '../utils/validation.utils';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = getRequestId(request);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = this.buildFromHttpException(
        exception,
        status,
        requestId,
      );

      if (status >= 500) {
        this.logger.error(
          `[${requestId}] ${request.method} ${request.url} → ${status} ${payload.error.code}: ${payload.error.message}`,
          exception.stack,
        );
      } else if (status >= 400) {
        this.logger.warn(
          `[${requestId}] ${request.method} ${request.url} → ${status} ${payload.error.code}: ${payload.error.message}`,
        );
      }

      response.status(status).json(payload);
      return;
    }

    this.logger.error(
      `[${requestId}] ${request.method} ${request.url} → 500 ${STANDARD_ERROR_CODES.INTERNAL_ERROR}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    const payload: ApiError = {
      error: {
        code: STANDARD_ERROR_CODES.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
        requestId,
      },
    };

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(payload);
  }

  private buildFromHttpException(
    exception: HttpException,
    status: number,
    requestId: string,
  ): ApiError {
    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return {
        error: {
          code: this.codeForStatus(status),
          message: exceptionResponse,
          requestId,
        },
      };
    }

    if (!isRecord(exceptionResponse)) {
      return {
        error: {
          code: this.codeForStatus(status),
          message: exception.message,
          requestId,
        },
      };
    }

    const body = exceptionResponse;
    const message = this.extractMessage(body);
    const details = this.extractDetails(body);
    const code = this.extractCode(body, status);

    return {
      error: {
        code,
        message,
        ...(details?.length ? { details } : {}),
        requestId,
      },
    };
  }

  private extractMessage(body: Record<string, unknown>): string {
    if (typeof body.message === 'string') {
      return body.message;
    }

    if (Array.isArray(body.message)) {
      return body.message.map(String).join(', ');
    }

    if (typeof body.error === 'string') {
      return body.error;
    }

    return 'Request failed';
  }

  private extractDetails(
    body: Record<string, unknown>,
  ): ApiErrorDetail[] | undefined {
    if (Array.isArray(body.details)) {
      return body.details
        .filter(isRecord)
        .map((detail) => ({
          field: String(detail.field ?? 'request'),
          message: String(detail.message ?? 'Validation failed'),
        }));
    }

    if (Array.isArray(body.message)) {
      return body.message.map((entry) => ({
        field: 'request',
        message: String(entry),
      }));
    }

    return undefined;
  }

  private extractCode(body: Record<string, unknown>, status: number): string {
    if (typeof body.code === 'string' && body.code.length > 0) {
      return body.code;
    }

    return this.codeForStatus(status);
  }

  private codeForStatus(status: number): string {
    return HTTP_STATUS_TO_ERROR_CODE[status] ?? STANDARD_ERROR_CODES.INTERNAL_ERROR;
  }
}
