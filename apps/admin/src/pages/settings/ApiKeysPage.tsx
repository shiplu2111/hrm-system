import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import type {
  ApiAccessStatus,
  CreateTenantApiKeyResult,
  PermissionAction,
  SubscriptionPlanTier,
  TenantApiKeyRecord,
  TenantSubscriptionView,
} from '@hrm/shared-types';
import { UpgradeRequestModal } from '@/components/billing/UpgradeRequestModal';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Label, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { StatusPill } from '@/components/ui/StatusPill';
import { pathForPage } from '@/config/routes';
import {
  createTenantApiKey,
  getApiAccessStatus,
  listTenantApiKeys,
  revokeTenantApiKey,
} from '@/lib/api-access-api';
import {
  AREA_ACCESS_LABELS,
  EXPIRY_OPTIONS,
  KEY_STATE_DISPLAY,
  SCOPE_AREAS,
  apiBaseUrl,
  areaAccess,
  canGrantScope,
  expiryDate,
  formatDate,
  formatLastUsed,
  isUsableState,
  keyState,
  scopesFromAccess,
  type AreaAccess,
  type ExpiryOption,
} from '@/lib/api-keys-display';
import { getSubscription } from '@/lib/billing-api';
import { planName } from '@/lib/billing-copy';
import { ApiError } from '@/lib/tenant-api-client';

export function ApiKeysPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canEdit = can('settings', 'edit');

  const [status, setStatus] = useState<ApiAccessStatus | null>(null);
  const [subscription, setSubscription] = useState<TenantSubscriptionView | null>(null);
  const [keys, setKeys] = useState<TenantApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<TenantApiKeyRecord | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [statusRow, keyRows, subscriptionView] = await Promise.all([
        getApiAccessStatus(),
        listTenantApiKeys(),
        getSubscription().catch(() => null),
      ]);
      setStatus(statusRow);
      setKeys(keyRows);
      setSubscription(subscriptionView);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load API keys');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enabled = status?.apiAccessEnabled ?? false;
  const rows = useMemo(
    () => keys.map((key) => ({ key, state: keyState(key, enabled) })),
    [keys, enabled],
  );
  const usable = rows.filter((row) => isUsableState(row.state));
  const inactiveCount = rows.length - usable.length;
  const visible = showInactive ? rows : usable;
  const expiringCount = rows.filter((row) => row.state === 'expiring').length;

  const handleCreated = (result: CreateTenantApiKeyResult) => {
    setKeys((current) => [result.key, ...current.filter((key) => key.id !== result.key.id)]);
    setNotice(null);
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    const updated = await revokeTenantApiKey(revokeTarget.id);
    setKeys((current) => current.map((key) => (key.id === updated.id ? updated : key)));
    setNotice(`“${updated.name}” is revoked. Anything still using it now gets 401 Unauthorized.`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading API keys…
      </div>
    );
  }

  const currentPlan = (status?.planId ?? 'starter') as SubscriptionPlanTier;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-primary">API Keys</h1>
          <p className="mt-0.5 text-sm text-secondary">
            Let other systems call the CMSN-HR API on your company&apos;s behalf. Each key only reaches the areas you
            choose, and you can revoke it at any time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:shrink-0 xl:flex-nowrap">
          <Button
            variant="secondary"
            onClick={() => {
              setRefreshing(true);
              void load();
            }}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <a
            href={`${new URL(apiBaseUrl()).origin}/api/docs`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-base px-3 text-sm font-medium text-primary hover:bg-[rgb(var(--bg-hover))]"
          >
            <ExternalLink className="h-4 w-4" /> API reference
          </a>
          {canEdit && enabled ? (
            <Button onClick={() => setGenerateOpen(true)}>
              <Plus className="h-4 w-4" /> Generate key
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/30 dark:text-error-300">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div
          role="status"
          className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:bg-success-950/30 dark:text-success-300"
        >
          {notice}
        </div>
      ) : null}

      {status && !enabled ? (
        <section className="surface flex flex-col gap-4 rounded-xl border border-base p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-primary">API access is part of the Enterprise plan</h2>
              <p className="mt-1 text-sm text-secondary">
                Your company is on the {planName(currentPlan)} plan. Upgrade to Enterprise to generate API keys.
                {usable.length > 0
                  ? ' Keys created earlier are paused and stop working until you upgrade; you can still revoke them.'
                  : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Button variant="secondary" onClick={() => navigate(pathForPage('billing'))}>
              Compare plans
            </Button>
            {subscription ? (
              <Button onClick={() => setUpgradeOpen(true)}>
                <Sparkles className="h-4 w-4" /> Request Enterprise
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {enabled && expiringCount > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800 dark:border-warning-800 dark:bg-warning-950/30 dark:text-warning-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {expiringCount === 1 ? '1 key expires' : `${expiringCount} keys expire`} within 14 days. Generate a
          replacement and update the system using it before it stops working.
        </div>
      ) : null}

      <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
        <div className="flex flex-col gap-2 border-b border-base px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-primary">
              {usable.length === 1 ? '1 key in use' : `${usable.length} keys in use`}
            </h2>
            <p className="mt-0.5 text-xs text-secondary">
              Send the key as <code className="font-mono">Authorization: Bearer &lt;key&gt;</code>. Keys never see
              settings, roles or billing.
            </p>
          </div>
          {inactiveCount > 0 ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-secondary">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
              />
              Show revoked and expired ({inactiveCount})
            </label>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <KeyRound className="mx-auto h-8 w-8 text-muted" />
            <p className="mt-3 text-sm font-medium text-primary">No API keys yet</p>
            <p className="mt-1 text-xs text-secondary">
              {enabled
                ? canEdit
                  ? 'Generate a key for each system that needs to connect, so you can revoke one without affecting the others.'
                  : 'Someone with settings edit access can generate keys.'
                : 'Keys become available after upgrading to Enterprise.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Access</th>
                  <th className="px-5 py-3">Last used</th>
                  <th className="px-5 py-3">Expires</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {visible.map(({ key, state }) => (
                  <tr key={key.id} className={isUsableState(state) ? undefined : 'opacity-60'}>
                    <td className="min-w-[220px] px-5 py-3 align-top">
                      <div className="font-medium text-primary">{key.name}</div>
                      <div className="mt-0.5 font-mono text-xs text-muted">{key.keyMasked}</div>
                      <div className="mt-0.5 text-xs text-muted">
                        Created {formatDate(key.createdAt)}
                        {key.createdByName ? ` by ${key.createdByName}` : ''}
                      </div>
                    </td>
                    <td className="px-5 py-3 align-top">
                      <AccessSummary scopes={key.scopes} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 align-top text-secondary">
                      {formatLastUsed(key.lastUsedAt)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 align-top text-secondary">
                      {key.expiresAt ? formatDate(key.expiresAt) : 'Never'}
                    </td>
                    <td className="px-5 py-3 align-top">
                      <StatusPill tone={KEY_STATE_DISPLAY[state].tone}>{KEY_STATE_DISPLAY[state].label}</StatusPill>
                      {state === 'revoked' && key.revokedAt ? (
                        <div className="mt-1 text-xs text-muted">
                          {formatDate(key.revokedAt)}
                          {key.revokedByName ? ` by ${key.revokedByName}` : ''}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-right align-top">
                      {canEdit && key.status === 'active' ? (
                        <Button variant="secondary" size="sm" onClick={() => setRevokeTarget(key)}>
                          Revoke
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <GenerateKeyModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onCreated={handleCreated}
        can={can}
      />

      <ConfirmDialog
        open={revokeTarget !== null}
        title="Revoke API key?"
        confirmLabel="Revoke key"
        description={
          <div className="space-y-2">
            <p>
              <span className="font-medium text-primary">{revokeTarget?.name}</span> stops working immediately.
              Any system still using it will get 401 Unauthorized.
            </p>
            <p>This can&apos;t be undone. Generate a new key if the system needs access again.</p>
          </div>
        }
        onConfirm={handleRevoke}
        onClose={() => setRevokeTarget(null)}
      />

      {subscription ? (
        <UpgradeRequestModal
          open={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          view={subscription}
          targetPlanId="enterprise"
        />
      ) : null}
    </div>
  );
}

function AccessSummary({ scopes }: { scopes: TenantApiKeyRecord['scopes'] }) {
  const granted = SCOPE_AREAS.map((area) => ({ area, level: areaAccess(area, scopes) })).filter(
    (entry) => entry.level !== 'none',
  );
  if (granted.length === 0) {
    return <span className="text-xs text-muted">No access</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {granted.map(({ area, level }) => (
        <span
          key={area.key}
          className="whitespace-nowrap rounded bg-[rgb(var(--bg-muted))] px-1.5 py-0.5 text-[11px] text-secondary"
        >
          <span className="font-medium text-primary">{area.label}</span> · {AREA_ACCESS_LABELS[level]}
        </span>
      ))}
    </div>
  );
}

const INITIAL_ACCESS: Record<string, AreaAccess> = Object.fromEntries(
  SCOPE_AREAS.map((area) => [area.key, 'none']),
);

function GenerateKeyModal({
  open,
  onClose,
  onCreated,
  can,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (result: CreateTenantApiKeyResult) => void;
  can: (module: string, action: PermissionAction) => boolean;
}) {
  const [name, setName] = useState('');
  const [access, setAccess] = useState<Record<string, AreaAccess>>(INITIAL_ACCESS);
  const [expiry, setExpiry] = useState<ExpiryOption>('90');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateTenantApiKeyResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setAccess(INITIAL_ACCESS);
    setExpiry('90');
    setSaving(false);
    setError(null);
    setCreated(null);
    setCopied(false);
  }, [open]);

  const scopes = scopesFromAccess(access);
  const expiresAt = expiryDate(expiry);
  const nameValid = name.trim().length >= 2;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await createTenantApiKey({
        name: name.trim(),
        scopes,
        expiresAt: expiresAt?.toISOString(),
      });
      setCreated(result);
      onCreated(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate the key');
    } finally {
      setSaving(false);
    }
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  if (created) {
    const example = `curl ${apiBaseUrl()}/employees \\\n  -H "Authorization: Bearer ${created.secret}"`;
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Copy your new API key"
        size="lg"
        footer={<Button onClick={onClose}>I&apos;ve saved the key</Button>}
      >
        <div className="space-y-4">
          <p className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-800 dark:border-warning-800 dark:bg-warning-950/30 dark:text-warning-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            This is the only time the full key is shown. Store it in a password manager or your integration&apos;s
            secret settings. If it&apos;s lost, revoke it and generate a new one.
          </p>
          <div>
            <Label>{created.key.name}</Label>
            <div className="mt-1 flex items-stretch gap-2">
              <code className="flex-1 break-all rounded-lg border border-base bg-[rgb(var(--bg-muted))] px-3 py-2 font-mono text-xs text-primary">
                {created.secret}
              </code>
              <Button variant="secondary" onClick={() => void copy(created.secret)}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
          {created.key.scopes.includes('read:employees') ? (
            <div>
              <Label>Try it</Label>
              <pre className="mt-1 overflow-x-auto rounded-lg border border-base bg-[rgb(var(--bg-muted))] px-3 py-2 font-mono text-xs text-secondary">
                {example}
              </pre>
            </div>
          ) : null}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      title="Generate API key"
      description="Give the key only the access the connecting system needs."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving || !nameValid || scopes.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {saving ? 'Generating…' : 'Generate key'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <Label htmlFor="api-key-name">Name</Label>
          <Input
            id="api-key-name"
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Biometric attendance sync"
          />
          <p className="mt-1 text-xs text-muted">Name it after the system that will use it.</p>
        </div>

        <div>
          <Label>Access</Label>
          <div className="mt-2 divide-y divide-[rgb(var(--border-base))] rounded-lg border border-base">
            {SCOPE_AREAS.map((area) => {
              const allowed: Record<AreaAccess, boolean> = {
                none: true,
                read: canGrantScope(area.read, can),
                write: canGrantScope(area.write, can),
              };
              const current = access[area.key] ?? 'none';
              return (
                <div
                  key={area.key}
                  className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-primary">{area.label}</div>
                    <div className="text-xs text-secondary">{area.description}</div>
                    {!allowed.write ? (
                      <div className="mt-0.5 text-xs text-muted">
                        {allowed.read
                          ? 'Write access needs your role to have edit access here.'
                          : 'Your role has no access here, so you can’t grant it.'}
                      </div>
                    ) : null}
                  </div>
                  <div
                    role="radiogroup"
                    aria-label={`${area.label} access`}
                    className="inline-flex shrink-0 rounded-lg border border-base p-0.5"
                  >
                    {(['none', 'read', 'write'] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        role="radio"
                        aria-checked={current === level}
                        disabled={!allowed[level]}
                        onClick={() => setAccess((prev) => ({ ...prev, [area.key]: level }))}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          current === level
                            ? 'bg-accent-600 text-white'
                            : 'text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'
                        }`}
                      >
                        {level === 'none' ? 'None' : AREA_ACCESS_LABELS[level]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Write access can create and edit records but never delete them, approve requests or finalize payroll.
          </p>
        </div>

        <div>
          <Label htmlFor="api-key-expiry">Expires</Label>
          <Select
            id="api-key-expiry"
            value={expiry}
            onChange={(event) => setExpiry(event.target.value as ExpiryOption)}
          >
            {EXPIRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted">
            {expiresAt
              ? `Stops working on ${formatDate(expiresAt)}.`
              : 'Works until revoked. Expiring keys are safer if one leaks.'}
          </p>
        </div>

        {error ? (
          <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700 dark:border-error-800 dark:bg-error-950/30 dark:text-error-300">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
