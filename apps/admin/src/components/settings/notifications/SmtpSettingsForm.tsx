import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, KeyRound, Mail, Send } from 'lucide-react';
import type { SmtpSettingsView } from '@hrm/shared-types';
import { usePermissions } from '@hrm/portal-ui';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Form';
import { FieldError } from '@/components/ui/FieldError';
import { StatusPill } from '@/components/ui/StatusPill';
import { OrgErrorBanner, OrgTableSkeleton } from '@/components/org/OrgScreenParts';
import { getSmtpSettings, sendSmtpTestEmail, updateSmtpSettings } from '@/lib/settings-api';
import { notificationSettingsCopy as copy } from '@/lib/notification-settings-copy';
import {
  isEmail,
  isSmtpDirty,
  mustReenterPassword,
  toSmtpDraft,
  toSmtpInput,
  toSmtpTestInput,
  validateSmtp,
  type SmtpDraft,
  type SmtpField,
} from '@/lib/smtp-form';
import { ApiError } from '@/lib/tenant-api-client';

interface Props {
  companyId: string;
  canEdit: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onConfiguredChange: (configured: boolean) => void;
}

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof ApiError || err instanceof Error ? err.message : fallback;

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
      <FieldError message={error} />
    </div>
  );
}

export function SmtpSettingsForm({ companyId, canEdit, onDirtyChange, onConfiguredChange }: Props) {
  const { user } = usePermissions();
  const [view, setView] = useState<SmtpSettingsView | null>(null);
  const [draft, setDraft] = useState<SmtpDraft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [testTo, setTestTo] = useState(user?.email ?? '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    setView(null);
    setLoadError(null);
    try {
      const data = await getSmtpSettings(companyId);
      setView(data);
      setDraft(toSmtpDraft(data));
      onConfiguredChange(data.configured && data.passwordConfigured);
    } catch (err) {
      setLoadError(errorMessage(err, copy.smtp.loadError));
    }
  }, [companyId, onConfiguredChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = !!view && !!draft && isSmtpDirty(draft, view);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  if (loadError) return <OrgErrorBanner message={loadError} onRetry={() => void load()} />;
  if (!view || !draft) {
    return (
      <Card className="overflow-hidden">
        <OrgTableSkeleton columns={2} rows={6} />
      </Card>
    );
  }

  const configured = view.configured && view.passwordConfigured;
  const errors = validateSmtp(draft, view);
  const reenter = view.passwordConfigured && mustReenterPassword(draft, view);
  const showPasswordInput = draft.replacingPassword || reenter;
  const fieldError = (field: SmtpField) => (submitted && errors[field] ? copy.smtp.errors[field] : undefined);
  const disabled = !canEdit || saving;
  const port = Number(draft.port);

  const update = (patch: Partial<SmtpDraft>) => {
    setNotice(null);
    setTestResult(null);
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const save = async () => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await updateSmtpSettings(companyId, toSmtpInput(draft));
      setView(saved);
      setDraft(toSmtpDraft(saved));
      setSubmitted(false);
      setNotice(copy.smtp.saved);
      onConfiguredChange(saved.configured && saved.passwordConfigured);
    } catch (err) {
      setSaveError(errorMessage(err, copy.smtp.loadError));
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setSubmitted(true);
    setTestResult(null);
    if (Object.keys(errors).length > 0 || !isEmail(testTo)) return;
    setTesting(true);
    try {
      const result = await sendSmtpTestEmail(companyId, toSmtpTestInput(draft, testTo));
      setTestResult({ ok: true, message: copy.smtp.testSent(result.toEmail) });
    } catch (err) {
      setTestResult({ ok: false, message: errorMessage(err, copy.smtp.loadError) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-sm text-success-700 dark:border-success-900/50 dark:bg-success-900/20 dark:text-success-300"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          {notice}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-base flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-accent-50 dark:bg-accent-950/40 text-accent-600 flex items-center justify-center shrink-0">
              <Mail className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-primary">{copy.smtp.title}</h3>
              <p className="text-xs text-secondary mt-0.5 max-w-2xl">{copy.smtp.body}</p>
              <p className="text-xs text-muted mt-1">
                {view.updatedAt ? copy.lastUpdated(new Date(view.updatedAt).toLocaleString()) : null}
              </p>
            </div>
          </div>
          <StatusPill tone={configured ? 'success' : 'warning'}>
            {configured ? copy.smtp.statusConfigured : copy.smtp.statusMissing}
          </StatusPill>
        </div>

        <form
          className="px-5 py-4 space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {!configured ? (
            <div className="flex items-start gap-2 rounded-lg border border-warning-300 bg-warning-50 px-3 py-2 text-sm text-warning-800 dark:border-warning-800 dark:bg-warning-900/20 dark:text-warning-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
              {copy.smtp.missingBody}
            </div>
          ) : null}

          <fieldset disabled={disabled} className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-3">
              <Field id="smtp-host" label={copy.smtp.host} error={fieldError('host')}>
                <Input
                  id="smtp-host"
                  value={draft.host}
                  onChange={(e) => update({ host: e.target.value })}
                  placeholder={copy.smtp.hostPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={!!fieldError('host')}
                />
              </Field>
            </div>
            <div className="md:col-span-1">
              <Field id="smtp-port" label={copy.smtp.port} error={fieldError('port')}>
                <Input
                  id="smtp-port"
                  inputMode="numeric"
                  value={draft.port}
                  onChange={(e) => update({ port: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                  placeholder="587"
                  aria-invalid={!!fieldError('port')}
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field id="smtp-security" label={copy.smtp.security}>
                <Select
                  id="smtp-security"
                  value={draft.useTls ? 'tls' : 'none'}
                  onChange={(e) => update({ useTls: e.target.value === 'tls' })}
                >
                  <option value="tls">{copy.smtp.securityOptions.tls}</option>
                  <option value="none">{copy.smtp.securityOptions.none}</option>
                </Select>
                <p className={`mt-1 text-xs ${draft.useTls ? 'text-muted' : 'text-warning-700 dark:text-warning-300'}`}>
                  {draft.useTls ? copy.smtp.securityHint(port) : copy.smtp.securityNoneHint}
                </p>
              </Field>
            </div>

            <div className="md:col-span-3">
              <Field id="smtp-username" label={copy.smtp.username}>
                <Input
                  id="smtp-username"
                  value={draft.username}
                  onChange={(e) => update({ username: e.target.value })}
                  placeholder={copy.smtp.usernamePlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
            </div>
            <div className="md:col-span-3">
              <Field id="smtp-password" label={copy.smtp.password} error={fieldError('password')}>
                {showPasswordInput ? (
                  <>
                    <Input
                      id="smtp-password"
                      type="password"
                      value={draft.password}
                      onChange={(e) => update({ password: e.target.value })}
                      placeholder={copy.smtp.passwordPlaceholder}
                      autoComplete="new-password"
                      aria-invalid={!!fieldError('password')}
                    />
                    {reenter ? (
                      <p className="mt-1 text-xs text-warning-700 dark:text-warning-300">{copy.smtp.passwordReentry}</p>
                    ) : view.passwordConfigured ? (
                      <button
                        type="button"
                        className="mt-1 text-xs font-medium text-accent-600 hover:underline"
                        onClick={() => update({ password: '', replacingPassword: false })}
                      >
                        {copy.smtp.passwordKeep}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <div
                      id="smtp-password"
                      className="flex-1 flex items-center gap-2 h-9 px-3 rounded-lg border border-base bg-[rgb(var(--bg-muted))] text-sm text-secondary"
                    >
                      <KeyRound className="h-3.5 w-3.5 text-muted" aria-hidden />
                      <span className="tracking-widest">{view.passwordMasked}</span>
                      <span className="ml-auto text-xs text-muted">{copy.smtp.passwordSaved}</span>
                    </div>
                    {canEdit ? (
                      <Button type="button" variant="secondary" size="sm" onClick={() => update({ replacingPassword: true })}>
                        {copy.smtp.passwordReplace}
                      </Button>
                    ) : null}
                  </div>
                )}
              </Field>
            </div>

            <div className="md:col-span-3">
              <Field id="smtp-from-address" label={copy.smtp.fromAddress} error={fieldError('fromAddress')}>
                <Input
                  id="smtp-from-address"
                  type="email"
                  value={draft.fromAddress}
                  onChange={(e) => update({ fromAddress: e.target.value })}
                  placeholder={copy.smtp.fromAddressPlaceholder}
                  aria-invalid={!!fieldError('fromAddress')}
                />
              </Field>
            </div>
            <div className="md:col-span-3">
              <Field id="smtp-from-name" label={copy.smtp.fromName} error={fieldError('fromName')}>
                <Input
                  id="smtp-from-name"
                  value={draft.fromName}
                  onChange={(e) => update({ fromName: e.target.value })}
                  placeholder={copy.smtp.fromNamePlaceholder}
                  aria-invalid={!!fieldError('fromName')}
                />
              </Field>
            </div>
          </fieldset>

          {canEdit ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-base">
              <span className="text-sm">
                {saveError ? (
                  <span className="text-error-600">{saveError}</span>
                ) : dirty ? (
                  <span className="font-medium text-primary">{copy.smtp.unsaved}</span>
                ) : null}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!dirty || saving}
                  onClick={() => {
                    setDraft(toSmtpDraft(view));
                    setSubmitted(false);
                    setSaveError(null);
                    setTestResult(null);
                  }}
                >
                  {copy.smtp.discard}
                </Button>
                <Button type="submit" variant="primary" disabled={!dirty || saving}>
                  {saving ? copy.smtp.saving : copy.smtp.save}
                </Button>
              </div>
            </div>
          ) : null}
        </form>
      </Card>

      {canEdit ? (
        <Card className="px-5 py-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-primary">{copy.smtp.testTitle}</h3>
            <p className="text-xs text-secondary mt-0.5">{copy.smtp.testBody}</p>
          </div>
          <form
            noValidate
            className="flex flex-col sm:flex-row gap-3 sm:items-start"
            onSubmit={(e) => {
              e.preventDefault();
              void sendTest();
            }}
          >
            <div className="flex-1 max-w-md">
              <Label htmlFor="smtp-test-to">{copy.smtp.testRecipient}</Label>
              <Input
                id="smtp-test-to"
                type="email"
                value={testTo}
                onChange={(e) => {
                  setTestTo(e.target.value);
                  setTestResult(null);
                }}
                aria-invalid={submitted && !isEmail(testTo)}
              />
              <FieldError message={submitted && !isEmail(testTo) ? copy.smtp.errors.toEmail : undefined} />
            </div>
            <Button type="submit" variant="secondary" disabled={testing} className="sm:mt-6">
              <Send className="h-4 w-4" /> {testing ? copy.smtp.testSending : copy.smtp.testSend}
            </Button>
          </form>
          {dirty && !testResult ? <p className="text-xs text-muted">{copy.smtp.testUnsavedNote}</p> : null}
          {testResult ? (
            <p
              role="status"
              className={`flex items-start gap-1.5 text-sm ${
                testResult.ok ? 'text-success-700 dark:text-success-300' : 'text-error-600'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
              )}
              {testResult.message}
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
