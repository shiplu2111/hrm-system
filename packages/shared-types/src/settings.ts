/** Company SMTP settings — password never returned in plaintext (SECURITY.md §11). */
export interface SmtpSettingsView {
  configured: boolean;
  host: string;
  port: number;
  username: string;
  /** Always `••••••••` when a password is stored; null when none configured. */
  passwordMasked: string | null;
  passwordConfigured: boolean;
  fromAddress: string;
  fromName: string;
  useTls: boolean;
  updatedAt: string | null;
}

export interface UpdateSmtpSettingsInput {
  host: string;
  port: number;
  username?: string;
  /** Omit or leave blank to keep the existing password. */
  password?: string;
  fromAddress: string;
  fromName: string;
  useTls: boolean;
}

export interface SendSmtpTestEmailInput {
  toEmail: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  fromAddress?: string;
  fromName?: string;
  useTls?: boolean;
}

export interface SendSmtpTestEmailResult {
  sent: boolean;
  toEmail: string;
}
