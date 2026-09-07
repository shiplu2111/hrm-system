import { createHash, randomBytes } from 'crypto';

export function hashApiSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function generateApiKeyMaterial(): {
  prefix: string;
  secret: string;
  fullKey: string;
} {
  const suffix = randomBytes(16).toString('hex');
  const prefix = `hrm_live_${randomBytes(4).toString('hex')}`;
  const fullKey = `${prefix}_${suffix}`;
  return { prefix, secret: suffix, fullKey };
}

export function generateOAuthClientSecret(): string {
  return `ocs_${randomBytes(32).toString('hex')}`;
}

export function generateOAuthAccessToken(): string {
  return `oat_${randomBytes(32).toString('hex')}`;
}

export function generateAuthorizationCode(): string {
  return `oac_${randomBytes(24).toString('hex')}`;
}
