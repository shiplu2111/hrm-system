import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Copy,
  Key,
  Link2,
  Loader2,
  Plus,
  ShieldAlert,
  Unplug,
  Webhook,
} from 'lucide-react';
import { usePermission } from '@hrm/portal-ui';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { pathForPage } from '@/config/routes';
import {
  createTenantOAuthClient,
  getApiAccessStatus,
  listTenantOAuthClients,
  revokeTenantOAuthClient,
} from '@/lib/api-access-api';
import { ApiError } from '@/lib/tenant-api-client';
import type {
  ApiAccessScope,
  ApiAccessStatus,
  TenantOAuthClientRecord,
} from '@hrm/shared-types';
import {
  ALL_API_ACCESS_SCOPES,
  API_ACCESS_SCOPE_LABELS,
} from '@hrm/shared-types';

export function ApiAccessSettingsPanel() {
  const navigate = useNavigate();
  const canEdit = usePermission('settings', 'edit');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ApiAccessStatus | null>(null);
  const [clients, setClients] = useState<TenantOAuthClientRecord[]>([]);

  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientRedirectUri, setClientRedirectUri] = useState('http://localhost:4000/callback');
  const [selectedScopes, setSelectedScopes] = useState<ApiAccessScope[]>([
    'read:employees',
    'read:payroll',
  ]);
  const [newClientSecret, setNewClientSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRow, clientRows] = await Promise.all([
        getApiAccessStatus(),
        listTenantOAuthClients().catch(() => [] as TenantOAuthClientRecord[]),
      ]);
      setStatus(statusRow);
      setClients(clientRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load API access settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleScope = (scope: ApiAccessScope) => {
    setSelectedScopes((current) =>
      current.includes(scope)
        ? current.filter((item) => item !== scope)
        : [...current, scope],
    );
  };

  const handleCreateClient = async () => {
    if (!clientName.trim()) return;
    setSaving(true);
    try {
      const result = await createTenantOAuthClient({
        name: clientName.trim(),
        redirectUris: [clientRedirectUri.trim()],
        scopes: selectedScopes,
      });
      setNewClientSecret(result.clientSecret);
      setClients((current) => [result.client, ...current]);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create OAuth client');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeClient = async (clientId: string) => {
    try {
      await revokeTenantOAuthClient(clientId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to revoke OAuth client');
    }
  };

  const copySecret = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-secondary">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading API access settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:border-error-800 dark:bg-error-950/30 dark:text-error-300">
          {error}
        </div>
      )}

      <div
        className={`rounded-xl border p-4 text-sm ${status?.apiAccessEnabled ? 'border-success-200 bg-success-50/70 dark:border-success-800 dark:bg-success-950/30' : 'border-warning-200 bg-warning-50/70 dark:border-warning-800 dark:bg-warning-950/30'}`}
      >
        <div className="flex items-start gap-3">
          {status?.apiAccessEnabled ? (
            <Key className="mt-0.5 h-5 w-5 text-success-600" />
          ) : (
            <ShieldAlert className="mt-0.5 h-5 w-5 text-warning-600" />
          )}
          <div>
            <div className="font-semibold text-primary">
              Plan: {status?.planId ?? 'unknown'}
              {status?.apiAccessEnabled ? ' — API access enabled' : ' — API access requires Enterprise'}
            </div>
            <p className="mt-1 text-secondary">
              Scoped API keys and OAuth clients let third-party systems call the HRM REST API.
              Credentials are revocable and tenant-scoped per API_GUIDELINES.md §4.
            </p>
          </div>
        </div>
      </div>

      <section className="surface flex flex-col gap-3 rounded-xl border border-base p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-primary">REST API keys</h2>
          <p className="mt-0.5 text-xs text-secondary">
            {status?.activeKeyCount === 1 ? '1 active key' : `${status?.activeKeyCount ?? 0} active keys`}. Generate,
            review and revoke keys on the API Keys screen.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate(pathForPage('settings-api-keys'))}>
          <Key className="h-3.5 w-3.5" /> Manage API keys
        </Button>
      </section>

      <section className="surface flex flex-col gap-3 rounded-xl border border-base p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-primary">Outgoing webhooks</h2>
          <p className="mt-0.5 text-xs text-secondary">
            Register endpoint URLs, choose which events they receive and follow every delivery and retry on the
            Webhooks screen.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate(pathForPage('settings-webhooks'))}>
          <Webhook className="h-3.5 w-3.5" /> Manage webhooks
        </Button>
      </section>

      <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
        <div className="flex items-center justify-between border-b border-base px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-primary">OAuth 2.0 clients</h2>
            <p className="mt-0.5 text-xs text-secondary">
              Authorization code and client credentials flows via <code className="font-mono">/oauth/token</code>
            </p>
          </div>
          {canEdit && (
            <Button
              size="sm"
              disabled={!status?.apiAccessEnabled}
              onClick={() => {
                setNewClientSecret(null);
                setClientName('');
                setClientModalOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Register client
            </Button>
          )}
        </div>
        <div className="divide-y divide-[rgb(var(--border-base))]">
          {clients.length === 0 ? (
            <div className="px-5 py-8 text-center text-secondary">No OAuth clients yet.</div>
          ) : (
            clients.map((client) => (
              <div key={client.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold text-primary">{client.name}</div>
                  <div className="mt-1 font-mono text-xs text-muted">client_id: {client.clientId}</div>
                  <div className="mt-1 text-xs text-secondary">
                    Redirect: {client.redirectUris.join(', ')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={client.status === 'active' ? 'success' : 'neutral'} dot>
                    {client.status}
                  </Badge>
                  {client.status === 'active' && canEdit && (
                    <Button variant="secondary" size="sm" onClick={() => void handleRevokeClient(client.id)}>
                      <Unplug className="h-3.5 w-3.5" /> Revoke
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <Modal
        open={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
        title="Register OAuth client"
        description="Client secret is shown once at registration."
      >
        {!newClientSecret ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="client-name">Application name</Label>
              <Input
                id="client-name"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="redirect-uri">Redirect URI</Label>
              <Input
                id="redirect-uri"
                value={clientRedirectUri}
                onChange={(event) => setClientRedirectUri(event.target.value)}
              />
            </div>
            <ScopePicker selected={selectedScopes} onToggle={toggleScope} />
            <Button onClick={() => void handleCreateClient()} disabled={saving || !clientName.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Register
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-secondary">Copy the client secret now.</p>
            <div className="rounded-lg border border-base bg-[rgb(var(--bg-muted))] p-3 font-mono text-xs break-all">
              {newClientSecret}
            </div>
            <Button variant="secondary" onClick={() => void copySecret(newClientSecret)}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy secret'}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ScopePicker({
  selected,
  onToggle,
}: {
  selected: ApiAccessScope[];
  onToggle: (scope: ApiAccessScope) => void;
}) {
  return (
    <div>
      <Label>Scopes</Label>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {ALL_API_ACCESS_SCOPES.map((scope) => (
          <label
            key={scope}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-base px-3 py-2 text-xs"
          >
            <input
              type="checkbox"
              checked={selected.includes(scope)}
              onChange={() => onToggle(scope)}
            />
            <span>
              <span className="font-mono">{scope}</span>
              <span className="block text-muted">{API_ACCESS_SCOPE_LABELS[scope]}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
