import type { SendSmtpTestEmailInput, SmtpSettingsView, UpdateSmtpSettingsInput } from '@hrm/shared-types';

export interface SmtpDraft {
  host: string;
  port: string;
  username: string;
  /** Only ever holds a newly typed password; the saved one is never sent back to the browser. */
  password: string;
  replacingPassword: boolean;
  fromAddress: string;
  fromName: string;
  useTls: boolean;
}

export type SmtpField = 'host' | 'port' | 'fromAddress' | 'fromName' | 'password';
export type SmtpErrors = Partial<Record<SmtpField, true>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (value: string) => EMAIL_PATTERN.test(value.trim());

export function toSmtpDraft(view: SmtpSettingsView): SmtpDraft {
  return {
    host: view.host,
    port: String(view.port || 587),
    username: view.username,
    password: '',
    replacingPassword: !view.passwordConfigured,
    fromAddress: view.fromAddress,
    fromName: view.fromName,
    useTls: view.useTls,
  };
}

/** Mirrors the server: the saved password is only reused for the host and username it was saved with. */
export function mustReenterPassword(draft: SmtpDraft, view: SmtpSettingsView): boolean {
  if (!view.passwordConfigured) return true;
  return (
    draft.host.trim().toLowerCase() !== view.host.trim().toLowerCase() ||
    draft.username.trim() !== view.username.trim()
  );
}

export function validateSmtp(draft: SmtpDraft, view: SmtpSettingsView): SmtpErrors {
  const errors: SmtpErrors = {};
  const port = Number(draft.port);
  if (!draft.host.trim()) errors.host = true;
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.port = true;
  if (!isEmail(draft.fromAddress)) errors.fromAddress = true;
  if (!draft.fromName.trim()) errors.fromName = true;
  if (mustReenterPassword(draft, view) && !draft.password.trim()) errors.password = true;
  return errors;
}

export function isSmtpDirty(draft: SmtpDraft, view: SmtpSettingsView): boolean {
  return (
    draft.host.trim() !== view.host ||
    Number(draft.port) !== view.port ||
    draft.username.trim() !== view.username ||
    draft.fromAddress.trim() !== view.fromAddress ||
    draft.fromName.trim() !== view.fromName ||
    draft.useTls !== view.useTls ||
    draft.password.trim() !== ''
  );
}

export function toSmtpInput(draft: SmtpDraft): UpdateSmtpSettingsInput {
  const password = draft.password.trim();
  return {
    host: draft.host.trim(),
    port: Number(draft.port),
    username: draft.username.trim(),
    fromAddress: draft.fromAddress.trim(),
    fromName: draft.fromName.trim(),
    useTls: draft.useTls,
    ...(password ? { password } : {}),
  };
}

export const toSmtpTestInput = (draft: SmtpDraft, toEmail: string): SendSmtpTestEmailInput => ({
  toEmail: toEmail.trim(),
  ...toSmtpInput(draft),
});
