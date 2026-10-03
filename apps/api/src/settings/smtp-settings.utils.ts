import type { SmtpSettingsView } from '@hrm/shared-types';

/** JSON shape stored in tenant_settings.value for category=smtp */
export interface StoredSmtpSettings {
  host: string;
  port: number;
  username: string;
  passwordEnc: string | null;
  fromAddress: string;
  fromName: string;
  useTls: boolean;
}

export interface DecryptedSmtpSettings {
  host: string;
  port: number;
  username: string;
  password: string | null;
  fromAddress: string;
  fromName: string;
  useTls: boolean;
}

export const SMTP_SETTINGS_KEY_PREFIX = 'company:';

export function smtpSettingKeyForCompany(companyId: string): string {
  return `${SMTP_SETTINGS_KEY_PREFIX}${companyId}`;
}

/**
 * The saved password may only be reused against the server and account it was saved for,
 * so a changed host or username can't silently send the stored secret somewhere else.
 * Undefined fields mean "unchanged".
 */
export function requiresNewPassword(
  stored: StoredSmtpSettings | null,
  next: { host?: string; username?: string },
): boolean {
  if (!stored?.passwordEnc) return true;
  const hostChanged =
    next.host !== undefined &&
    next.host.trim().toLowerCase() !== stored.host.trim().toLowerCase();
  const usernameChanged =
    next.username !== undefined && next.username.trim() !== stored.username.trim();
  return hostChanged || usernameChanged;
}

export function toSmtpSettingsView(
  stored: StoredSmtpSettings | null,
  updatedAt: string | null,
): SmtpSettingsView {
  if (!stored) {
    return {
      configured: false,
      host: '',
      port: 587,
      username: '',
      passwordMasked: null,
      passwordConfigured: false,
      fromAddress: '',
      fromName: '',
      useTls: true,
      updatedAt,
    };
  }

  const passwordConfigured = Boolean(stored.passwordEnc);
  return {
    configured: true,
    host: stored.host,
    port: stored.port,
    username: stored.username,
    passwordMasked: passwordConfigured ? '••••••••' : null,
    passwordConfigured,
    fromAddress: stored.fromAddress,
    fromName: stored.fromName,
    useTls: stored.useTls,
    updatedAt,
  };
}

export function sanitizeSmtpForAudit(
  stored: StoredSmtpSettings | null,
): Record<string, unknown> | null {
  if (!stored) return null;
  return {
    host: stored.host,
    port: stored.port,
    username: stored.username,
    password: stored.passwordEnc ? '••••••••' : null,
    fromAddress: stored.fromAddress,
    fromName: stored.fromName,
    useTls: stored.useTls,
  };
}
