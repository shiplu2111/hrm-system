import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Mail, Send } from 'lucide-react';
import type { SmtpSettingsView, UpdateSmtpSettingsInput } from '@hrm/shared-types';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';
import { Badge } from '@/components/ui/Badge';
import { useCompany } from '@/context/CompanyContext';
import {
  getSmtpSettings,
  sendSmtpTestEmail,
  updateSmtpSettings,
} from '@/lib/settings-api';
import { ApiError } from '@/lib/tenant-api-client';

const EMPTY_FORM: UpdateSmtpSettingsInput = {
  host: '',
  port: 587,
  username: '',
  password: '',
  fromAddress: '',
  fromName: '',
  useTls: true,
};

export function SmtpSettingsPanel() {
  const { companyId, company } = useCompany();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [form, setForm] = useState<UpdateSmtpSettingsInput>(EMPTY_FORM);

  const loadSettings = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const settings = await getSmtpSettings(companyId);
      applySettings(settings);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load SMTP settings',
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  function applySettings(settings: SmtpSettingsView) {
    setPasswordConfigured(settings.passwordConfigured);
    setForm({
      host: settings.host,
      port: settings.port,
      username: settings.username,
      password: '',
      fromAddress: settings.fromAddress,
      fromName: settings.fromName,
      useTls: settings.useTls,
    });
  }

  async function handleSave() {
    if (!companyId) return;
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
      const payload: UpdateSmtpSettingsInput = {
        host: form.host.trim(),
        port: Number(form.port),
        username: form.username?.trim() || undefined,
        fromAddress: form.fromAddress.trim(),
        fromName: form.fromName.trim(),
        useTls: form.useTls,
      };
      if (form.password?.trim()) {
        payload.password = form.password.trim();
      }

      const saved = await updateSmtpSettings(companyId, payload);
      applySettings(saved);
      setSaveMessage('SMTP settings saved. Changes take effect immediately.');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to save SMTP settings',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    if (!companyId || !testEmail.trim()) return;
    setTesting(true);
    setTestMessage(null);
    setTestError(null);
    try {
      const payload = {
        toEmail: testEmail.trim(),
        host: form.host.trim() || undefined,
        port: form.port ? Number(form.port) : undefined,
        username: form.username?.trim() || undefined,
        fromAddress: form.fromAddress.trim() || undefined,
        fromName: form.fromName.trim() || undefined,
        useTls: form.useTls,
      } as Parameters<typeof sendSmtpTestEmail>[1];

      if (form.password?.trim()) {
        payload.password = form.password.trim();
      }

      const result = await sendSmtpTestEmail(companyId, payload);
      setTestMessage(`Test email sent to ${result.toEmail}.`);
    } catch (err) {
      setTestError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to send test email',
      );
    } finally {
      setTesting(false);
    }
  }

  if (!companyId) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-secondary">Select a company to configure SMTP.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-accent-500" />
            Company SMTP Configuration
          </CardTitle>
          <p className="text-xs text-secondary mt-0.5">
            Per-company email delivery for {company?.name ?? 'this company'}. Credentials are
            encrypted at rest and never shown in full after save.
          </p>
        </div>
        <Badge tone={passwordConfigured ? 'success' : 'neutral'} dot={passwordConfigured}>
          {passwordConfigured ? 'Configured' : 'Not configured'}
        </Badge>
      </CardHeader>
      <CardBody className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading SMTP settings...
          </div>
        ) : (
          <>
            {error && (
              <div className="rounded-xl border border-danger-300 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-800 dark:bg-danger-950/30 dark:text-danger-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>SMTP Host</Label>
                <Input
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  placeholder="smtp.example.com"
                />
              </div>
              <div>
                <Label>Port</Label>
                <Input
                  type="number"
                  value={form.port}
                  onChange={(e) =>
                    setForm({ ...form, port: Number(e.target.value) || 587 })
                  }
                  placeholder="587"
                />
              </div>
              <div>
                <Label>Username</Label>
                <Input
                  value={form.username ?? ''}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="mailer@example.com"
                />
              </div>
              <div>
                <Label>
                  Password / App Password
                  {passwordConfigured && (
                    <span className="ml-2 text-[11px] font-normal text-muted">
                      saved as •••••••• — leave blank to keep
                    </span>
                  )}
                </Label>
                <Input
                  type="password"
                  value={form.password ?? ''}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={passwordConfigured ? '••••••••' : 'Enter SMTP password'}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Label>From Address</Label>
                <Input
                  type="email"
                  value={form.fromAddress}
                  onChange={(e) => setForm({ ...form, fromAddress: e.target.value })}
                  placeholder="noreply@example.com"
                />
              </div>
              <div>
                <Label>From Name</Label>
                <Input
                  value={form.fromName}
                  onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                  placeholder="Demo Corp HR"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-base px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-primary">Use TLS</div>
                <div className="text-xs text-muted">
                  Enable STARTTLS (recommended for port 587).
                </div>
              </div>
              <Toggle
                checked={form.useTls}
                onChange={(checked) => setForm({ ...form, useTls: checked })}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  'Save SMTP Settings'
                )}
              </Button>
              {saveMessage && (
                <span className="text-xs text-success-700 dark:text-success-300 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  {saveMessage}
                </span>
              )}
            </div>

            <div className="border-t border-base pt-6 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-primary">Send Test Email</h4>
                <p className="text-xs text-secondary mt-0.5">
                  Verify connectivity before relying on these settings for payslips and
                  notifications. Uses the form above, falling back to saved credentials when the
                  password field is blank.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1">
                  <Label>Recipient Email</Label>
                  <Input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="admin@yourcompany.com"
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={() => void handleSendTest()}
                  disabled={testing || !testEmail.trim()}
                >
                  {testing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Send Test Email
                    </>
                  )}
                </Button>
              </div>
              {testMessage && (
                <p className="text-xs text-success-700 dark:text-success-300 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  {testMessage}
                </p>
              )}
              {testError && (
                <p className="text-xs text-danger-700 dark:text-danger-300 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {testError}
                </p>
              )}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
