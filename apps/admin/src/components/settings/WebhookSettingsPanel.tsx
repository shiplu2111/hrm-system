import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Loader2,
  Play,
  Plus,
  Unplug,
  Webhook,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import {
  createTenantWebhook,
  disableTenantWebhook,
  listTenantWebhooks,
  listWebhookDeliveries,
  testTenantWebhook,
} from '@/lib/webhooks-api';
import { ApiError } from '@/lib/tenant-api-client';
import type {
  TenantWebhookRecord,
  WebhookDeliveryRecord,
  WebhookEventType,
} from '@hrm/shared-types';
import {
  ALL_WEBHOOK_EVENT_TYPES,
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_SCHEMA_VERSION,
} from '@hrm/shared-types';

export function WebhookSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webhooks, setWebhooks] = useState<TenantWebhookRecord[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryRecord[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>([
    'employee.created',
    'leave.approved',
    'payroll.finalized',
  ]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pingStatus, setPingStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hookRows, deliveryRows] = await Promise.all([
        listTenantWebhooks().catch(() => [] as TenantWebhookRecord[]),
        listWebhookDeliveries().catch(() => [] as WebhookDeliveryRecord[]),
      ]);
      setWebhooks(hookRows);
      setDeliveries(deliveryRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleEvent = (event: WebhookEventType) => {
    setSelectedEvents((current) =>
      current.includes(event)
        ? current.filter((item) => item !== event)
        : [...current, event],
    );
  };

  const handleCreate = async () => {
    if (!name.trim() || !url.trim() || selectedEvents.length === 0) return;
    setSaving(true);
    try {
      const result = await createTenantWebhook({
        name: name.trim(),
        url: url.trim(),
        events: selectedEvents,
      });
      setNewSecret(result.secret);
      setWebhooks((current) => [result.webhook, ...current]);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create webhook');
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async (webhookId: string) => {
    try {
      await disableTenantWebhook(webhookId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to disable webhook');
    }
  };

  const handleTest = async (webhookId: string, endpoint: string) => {
    setPingStatus(`Testing ${endpoint}…`);
    try {
      await testTenantWebhook(webhookId);
      setPingStatus('Test event queued — check delivery log below');
      window.setTimeout(() => setPingStatus(null), 4000);
      await load();
    } catch (err) {
      setPingStatus(err instanceof ApiError ? err.message : 'Test failed');
    }
  };

  const copySecret = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-secondary">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading webhooks…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:border-error-800 dark:bg-error-950/30 dark:text-error-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-base bg-[rgb(var(--bg-muted))] p-4 text-sm text-secondary">
        Outbound webhooks use HMAC-SHA256 signatures (<code className="font-mono">X-HRM-Signature</code>),
        schema version <code className="font-mono">{WEBHOOK_SCHEMA_VERSION}</code>, and
        exponential backoff retries via BullMQ. Enterprise plan required.
      </div>

      <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
        <div className="flex items-center justify-between border-b border-base px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-primary">Outgoing webhooks</h2>
            <p className="mt-0.5 text-xs text-secondary">
              HTTP POST dispatch for employee.created, leave.approved, payroll.finalized
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setNewSecret(null);
              setName('');
              setUrl('');
              setModalOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Add endpoint
          </Button>
        </div>

        {pingStatus && (
          <div className="border-b border-base bg-accent-50/50 px-5 py-2 text-xs text-accent-700 dark:bg-accent-950/20 dark:text-accent-300">
            {pingStatus}
          </div>
        )}

        <div className="divide-y divide-[rgb(var(--border-base))]">
          {webhooks.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-secondary">
              No webhook endpoints configured.
            </div>
          ) : (
            webhooks.map((hook) => (
              <div
                key={hook.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Webhook className="h-4 w-4 text-accent-600" />
                    <span className="font-semibold text-primary">{hook.name}</span>
                    <Badge tone={hook.status === 'active' ? 'success' : 'neutral'} dot>
                      {hook.status}
                    </Badge>
                  </div>
                  <div className="mt-1 font-mono text-xs text-muted">{hook.url}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {hook.events.map((event) => (
                      <span
                        key={event}
                        className="rounded bg-[rgb(var(--bg-muted))] px-1.5 py-0.5 font-mono text-[10px]"
                      >
                        {event}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  {hook.status === 'active' && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleTest(hook.id, hook.url)}
                      >
                        <Play className="h-3.5 w-3.5" /> Test
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => void handleDisable(hook.id)}
                      >
                        <Unplug className="h-3.5 w-3.5" /> Disable
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
        <div className="border-b border-base px-5 py-4">
          <h2 className="text-sm font-semibold text-primary">Delivery log</h2>
          <p className="mt-0.5 text-xs text-secondary">Recent attempts with HTTP status and errors</p>
        </div>
        {deliveries.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-secondary">
            No deliveries yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
                <tr>
                  <th className="px-5 py-3">Event</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">HTTP</th>
                  <th className="px-5 py-3">Attempts</th>
                  <th className="px-5 py-3">Error</th>
                  <th className="px-5 py-3">Queued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {deliveries.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-3 font-mono text-xs">{row.eventType}</td>
                    <td className="px-5 py-3">
                      <Badge
                        tone={
                          row.status === 'delivered'
                            ? 'success'
                            : row.status === 'failed'
                              ? 'error'
                              : 'warning'
                        }
                      >
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-secondary">{row.httpStatus ?? '—'}</td>
                    <td className="px-5 py-3 text-secondary">{row.attempts}</td>
                    <td className="max-w-xs truncate px-5 py-3 text-xs text-error-600">
                      {row.errorMessage ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-secondary">
                      {new Date(row.queuedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add webhook endpoint"
        description="Signing secret is shown once. Verify signatures with the raw JSON body."
      >
        {!newSecret ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="wh-name">Name</Label>
              <Input
                id="wh-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="HR events to ERP"
              />
            </div>
            <div>
              <Label htmlFor="wh-url">Endpoint URL</Label>
              <Input
                id="wh-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://api.example.com/webhooks/hrm"
              />
            </div>
            <div>
              <Label>Subscribed events</Label>
              <div className="mt-2 grid gap-2">
                {ALL_WEBHOOK_EVENT_TYPES.map((event) => (
                  <label
                    key={event}
                    className="flex cursor-pointer items-center gap-2 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(event)}
                      onChange={() => toggleEvent(event)}
                    />
                    <span className="font-mono">{event}</span>
                    <span className="text-muted">{WEBHOOK_EVENT_LABELS[event]}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={() => void handleCreate()} disabled={saving || !name.trim() || !url.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create webhook
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-secondary">Copy the signing secret now.</p>
            <div className="rounded-lg border border-base bg-[rgb(var(--bg-muted))] p-3 font-mono text-xs break-all">
              {newSecret}
            </div>
            <Button variant="secondary" onClick={() => void copySecret(newSecret)}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy secret'}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
