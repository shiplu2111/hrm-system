import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AUTH_CONSTANTS } from './auth.constants';

export const PASSWORD_POLICY = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
} as const;

/** SECURITY.md §3 — enforced on password set/change (not login, for legacy/demo passwords). */
export function assertPasswordMeetsPolicy(password: string): void {
  const error = validatePasswordStrength(password);
  if (error) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: error,
    });
  }
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < PASSWORD_POLICY.MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters`;
  }
  if (password.length > PASSWORD_POLICY.MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_POLICY.MAX_LENGTH} characters`;
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include a lowercase letter';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include an uppercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include a number';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include a special character';
  }
  return null;
}

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, AUTH_CONSTANTS.BCRYPT_ROUNDS);
}
