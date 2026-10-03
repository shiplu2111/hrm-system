import { requiresNewPassword, toSmtpSettingsView, sanitizeSmtpForAudit } from './smtp-settings.utils';

describe('smtp-settings.utils', () => {
  const stored = {
    host: 'smtp.example.com',
    port: 587,
    username: 'mailer',
    passwordEnc: 'encrypted-value',
    fromAddress: 'noreply@example.com',
    fromName: 'Demo Corp',
    useTls: true,
  };

  it('reuses the saved password only for the same host and username', () => {
    expect(requiresNewPassword(stored, {})).toBe(false);
    expect(requiresNewPassword(stored, { host: ' SMTP.example.com ', username: 'mailer' })).toBe(false);
    expect(requiresNewPassword(stored, { host: 'attacker.example.net' })).toBe(true);
    expect(requiresNewPassword(stored, { username: 'someone-else' })).toBe(true);
    expect(requiresNewPassword(null, {})).toBe(true);
    expect(requiresNewPassword({ ...stored, passwordEnc: null }, {})).toBe(true);
  });

  it('masks stored password in API view', () => {
    const view = toSmtpSettingsView(
      {
        host: 'smtp.example.com',
        port: 587,
        username: 'mailer',
        passwordEnc: '{"v":1}',
        fromAddress: 'noreply@example.com',
        fromName: 'Demo Corp',
        useTls: true,
      },
      '2026-09-03T00:00:00.000Z',
    );

    expect(view.passwordMasked).toBe('••••••••');
    expect(view.passwordConfigured).toBe(true);
    expect(view.configured).toBe(true);
  });

  it('never includes plaintext password in audit payload', () => {
    const audit = sanitizeSmtpForAudit({
      host: 'smtp.example.com',
      port: 587,
      username: 'mailer',
      passwordEnc: 'encrypted-value',
      fromAddress: 'noreply@example.com',
      fromName: 'Demo Corp',
      useTls: true,
    });

    expect(audit?.password).toBe('••••••••');
    expect(JSON.stringify(audit)).not.toContain('encrypted-value');
  });
});
