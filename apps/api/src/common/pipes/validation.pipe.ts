import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { buildValidationExceptionBody } from '../utils/validation.utils';

export function createGlobalValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    exceptionFactory: (errors) =>
      new BadRequestException(buildValidationExceptionBody(errors)),
  });
}
