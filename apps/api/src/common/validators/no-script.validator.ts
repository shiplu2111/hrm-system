import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

const UNSAFE_SCRIPT_RE =
  /<\s*\/?\s*(?:script|iframe|object|embed|svg|style)\b|javascript\s*:|\bon(?:error|load|click|mouseover|focus|submit)\s*=/i;

export function containsScriptInjection(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return UNSAFE_SCRIPT_RE.test(value);
}

/**
 * Rejects embedded HTML script tags, javascript: URLs, or inline event handlers
 * in public form inputs.
 */
export function NoScriptInjection(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'noScriptInjection',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} contains unsupported script or HTML markup`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (value === undefined || value === null) return true;
          return !containsScriptInjection(value);
        },
      },
    });
  };
}
