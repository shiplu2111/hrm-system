import type { ApiErrorDetail } from '@hrm/shared-types';
import type { ValidationError } from 'class-validator';

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ApiErrorDetail[] {
  const details: ApiErrorDetail[] = [];

  for (const error of errors) {
    const fieldPath = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      details.push(
        ...Object.values(error.constraints).map((message) => ({
          field: fieldPath,
          message,
        })),
      );
    }

    if (error.children?.length) {
      details.push(...flattenValidationErrors(error.children, fieldPath));
    }
  }

  return details;
}

export function validationErrorsToDetails(
  errors: ValidationError[],
): ApiErrorDetail[] {
  return flattenValidationErrors(errors);
}

export function buildValidationExceptionBody(errors: ValidationError[]) {
  const details = validationErrorsToDetails(errors);
  const message =
    details.length === 1
      ? details[0].message
      : 'One or more fields failed validation';

  return {
    code: 'VALIDATION_ERROR',
    message,
    details,
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
