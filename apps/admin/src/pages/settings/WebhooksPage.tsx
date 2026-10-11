import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  Play,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  Webhook,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import {
  ALL_WEBHOOK_EVENT_TYPES,
  WEBHOOK_EVENT_CATALOG,
  type CreateTenantWebhookResult,
  type SubscriptionPlanTier,
  type TenantSubscriptionView,
  type TenantWebhookRecord,
  type WebhookDeliveryDetail,
  type WebhookDeliveryList,
  type WebhookDeliveryRecord,
  type WebhookDeliveryState,
  type WebhookEventType,
  type WebhookStatusView,
} from '@hrm/shared-types';
import { UpgradeRequestModal } from '@/components/billing/UpgradeRequestModal';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { StatusPill } from '@/components/ui/StatusPill';
import { pathForPage } from '@/config/routes';
import { useCompany } from '@/context/CompanyContext';
import { formatDate } from '@/lib/api-keys-display';
import { getSubscription } from '@/lib/billing-api';
import { planName } from '@/lib/billing-copy';
import { ApiError } from '@/lib/tenant-api-client';
import {
  createTenantWebhook,
  deleteTenantWebhook,
  getWebhookDelivery,
  getWebhookStatus,
  listTenantWebhooks,
  listWebhookDeliveries,
  retryWebhookDelivery,
  rotateTenantWebhookSecret,
  testTenantWebhook,
  updateTenantWebhook,
} from '@/lib/webhooks-api';
import {
  DELIVERY_STATE_DISPLAY,
  DELIVERY_STATE_FILTERS,
  eventLabel,
  formatDateTime,
  formatDelay,
  formatRelative,
  retryDetail,
  VERIFICATION_EXAMPLES,
  type VerificationLanguage,
} from '@/lib/webhooks-display';

type ConfirmAction = { kind: 'disable' | 'delete' | 'rotate'; webhook: TenantWebhookRecord };
type SecretReveal = CreateTenantWebhookResult & { reason: 'created' | 'rotated' };

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export function WebhooksPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canEdit = can('settings', 'edit');
  const { companies } = useCompany();

  const [status, setStatus] = useState<WebhookStatusView | null>(null);
  const [subscription, setSubscription] = useState<TenantSubscriptionView | null>(null);
  const [webhooks, setWebhooks] = useState<TenantWebhookRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<{ webhook: TenantWebhookRecord | null } | null>(null);
  const [secretReveal, setSecretReveal] = useState<SecretReveal | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [logWebhookId, setLogWebhookId] = useState<string>('');
  const [logVersion, setLogVersion] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [statusRow, hookRows, subscriptionView] = await Promise.all([
        getWebhookStatus(),
        listTenantWebhooks(),
        getSubscription().catch(() => null),
      ]);
      setStatus(statusRow);
      setWebhooks(hookRows);
      setSubscription(subscriptionView);
    } catch (err) {
      setError(errorMessage(err, 'Could not load webhooks'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enabled = status?.webhooksEnabled ?? false;
  const canSend = canEdit && enabled && (status?.deliveryAvailable ?? false);

  const replaceWebhook = (updated: TenantWebhookRecord) =>
    setWebhooks((current) => {
      const exists = current.some((hook) => hook.id === updated.id);
      return exists
        ? current.map((hook) => (hook.id === updated.id ? updated : hook))
        : [updated, ...current];
    });

  const refreshAll = () => {
    setLogVersion((value) => value + 1);
    void load();
  };

  const handleTest = async (hook: TenantWebhookRecord) => {
    setBusyId(hook.id);
    setError(null);
    try {
      await testTenantWebhook(hook.id);
      setNotice(`Test event sent to “${hook.name}”. Its result appears in the delivery log below.`);
      setLogWebhookId(hook.id);
      setLogVersion((value) => value + 1);
    } catch (err) {
      setError(errorMessage(err, 'Could not send the test event'));
    } finally {
      setBusyId(null);
    }
  };

  const handleEnable = async (hook: TenantWebhookRecord) => {
    setBusyId(hook.id);
    setError(null);
    try {
      replaceWebhook(await updateTenantWebhook(hook.id, { status: 'active' }));
      setNotice(`“${hook.name}” is enabled. New events will be sent to it.`);
    } catch (err) {
      setError(errorMessage(err, 'Could not enable the endpoint'));
    } finally {
      setBusyId(null);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const { kind, webhook } = confirm;
    if (kind === 'disable') {
      replaceWebhook(await updateTenantWebhook(webhook.id, { status: 'disabled' }));
      setNotice(`“${webhook.name}” is disabled. Pending retries will stop and new events won’t be sent.`);
    } else if (kind === 'delete') {
      await deleteTenantWebhook(webhook.id);
      setWebhooks((current) => current.filter((hook) => hook.id !== webhook.id));
      if (logWebhookId === webhook.id) setLogWebhookId('');
      setLogVersion((value) => value + 1);
      setNotice(`“${webhook.name}” and its delivery log were deleted.`);
    } else {
      const result = await rotateTenantWebhookSecret(webhook.id);
      replaceWebhook(result.webhook);
      setSecretReveal({ ...result, reason: 'rotated' });
      setNotice(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading webhooks…
      </div>
    );
  }

  const currentPlan = (status?.planId ?? 'starter') as SubscriptionPlanTier;
  const activeCount = webhooks.filter((hook) => hook.status === 'active').length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-primary">Webhooks</h1>
          <p className="mt-0.5 text-sm text-secondary">
            Notify your other systems the moment something happens in CMSN-HR. Each event is sent as a signed HTTPS
            POST to the endpoints subscribed to it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:shrink-0 xl:flex-nowrap">
          <Button
            variant="secondary"
            onClick={() => {
              setRefreshing(true);
              refreshAll();
            }}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          {canEdit && enabled ? (
            <Button onClick={() => setForm({ webhook: null })}>
              <Plus className="h-4 w-4" /> Add endpoint
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
              <h2 className="text-sm font-semibold text-primary">Webhooks are part of the Enterprise plan</h2>
              <p className="mt-1 text-sm text-secondary">
                Your company is on the {planName(currentPlan)} plan. Upgrade to Enterprise to register endpoints.
                {activeCount > 0
                  ? ' Endpoints added earlier are paused and receive nothing until you upgrade; you can still disable or delete them.'
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

      {status && enabled && !status.deliveryAvailable ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800 dark:border-warning-800 dark:bg-warning-950/30 dark:text-warning-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Webhook delivery isn&apos;t running on this server, so events are not being sent. Ask your administrator
            to configure the job queue (<code className="font-mono">REDIS_URL</code>).
          </span>
        </div>
      ) : null}

      <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
        <div className="border-b border-base px-5 py-4">
          <h2 className="text-sm font-semibold text-primary">
            {webhooks.length === 1 ? '1 endpoint' : `${webhooks.length} endpoints`}
            {webhooks.length > 0 ? <span className="font-normal text-secondary"> · {activeCount} active</span> : null}
          </h2>
          <p className="mt-0.5 text-xs text-secondary">
            Requests carry an <code className="font-mono">X-HRM-Signature</code> header. Check it with the
            endpoint&apos;s signing secret before trusting the payload.
          </p>
        </div>

        {webhooks.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Webhook className="mx-auto h-8 w-8 text-muted" />
            <p className="mt-3 text-sm font-medium text-primary">No endpoints yet</p>
            <p className="mt-1 text-xs text-secondary">
              {enabled
                ? canEdit
                  ? 'Add the URL of a system that should hear about new employees, approved leave or finalized payroll.'
                  : 'Someone with settings edit access can add endpoints.'
                : 'Endpoints become available after upgrading to Enterprise.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[rgb(var(--border-base))]">
            {webhooks.map((hook) => (
              <EndpointRow
                key={hook.id}
                hook={hook}
                planEnabled={enabled}
                canEdit={canEdit}
                canSend={canSend}
                busy={busyId === hook.id}
                onTest={() => void handleTest(hook)}
                onEdit={() => setForm({ webhook: hook })}
                onEnable={() => void handleEnable(hook)}
                onDisable={() => setConfirm({ kind: 'disable', webhook: hook })}
                onShowDeliveries={() => {
                  setLogWebhookId(hook.id);
                  document.getElementById('webhook-delivery-log')?.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            ))}
          </ul>
        )}
      </section>

      {status ? (
        <DeliveryLog
          webhooks={webhooks}
          status={status}
          webhookId={logWebhookId}
          onWebhookIdChange={setLogWebhookId}
          version={logVersion}
          canRetry={canSend}
          onChanged={() => void load()}
        />
      ) : null}

      <EndpointFormModal
        open={form !== null}
        webhook={form?.webhook ?? null}
        companies={companies}
        canEdit={canEdit && enabled}
        onClose={() => setForm(null)}
        onSaved={(record, secret) => {
          replaceWebhook(record);
          setForm(null);
          if (secret) {
            setSecretReveal({ webhook: record, secret, reason: 'created' });
            setNotice(null);
          } else {
            setNotice(`“${record.name}” was updated.`);
          }
        }}
        onRotate={(hook) => {
          setForm(null);
          setConfirm({ kind: 'rotate', webhook: hook });
        }}
        onDelete={(hook) => {
          setForm(null);
          setConfirm({ kind: 'delete', webhook: hook });
        }}
      />

      <SecretRevealModal reveal={secretReveal} onClose={() => setSecretReveal(null)} />

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.kind === 'delete'
            ? 'Delete endpoint?'
            : confirm?.kind === 'rotate'
              ? 'Rotate signing secret?'
              : 'Disable endpoint?'
        }
        confirmLabel={
          confirm?.kind === 'delete'
            ? 'Delete endpoint'
            : confirm?.kind === 'rotate'
              ? 'Rotate secret'
              : 'Disable'
        }
        tone={confirm?.kind === 'rotate' ? 'primary' : 'danger'}
        description={
          confirm ? (
            <div className="space-y-2">
              {confirm.kind === 'disable' ? (
                <p>
                  <span className="font-medium text-primary">{confirm.webhook.name}</span> stops receiving events
                  and any pending retries are dropped. You can enable it again later; events that happen while
                  it&apos;s disabled are not sent afterwards.
                </p>
              ) : confirm.kind === 'delete' ? (
                <>
                  <p>
                    <span className="font-medium text-primary">{confirm.webhook.name}</span> and its whole delivery
                    log are removed. This can&apos;t be undone.
                  </p>
                  {confirm.webhook.status === 'active' ? (
                    <p>To pause it instead and keep the log, disable it.</p>
                  ) : null}
                </>
              ) : (
                <>
                  <p>
                    A new secret is generated for{' '}
                    <span className="font-medium text-primary">{confirm.webhook.name}</span> and the current one stops
                    working immediately.
                  </p>
                  <p>Until the receiving system is updated with the new secret, its signature checks will fail.</p>
                </>
              )}
            </div>
          ) : null
        }
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
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

function EndpointRow({
  hook,
  planEnabled,
  canEdit,
  canSend,
  busy,
  onTest,
  onEdit,
  onEnable,
  onDisable,
  onShowDeliveries,
}: {
  hook: TenantWebhookRecord;
  planEnabled: boolean;
  canEdit: boolean;
  canSend: boolean;
  busy: boolean;
  onTest: () => void;
  onEdit: () => void;
  onEnable: () => void;
  onDisable: () => void;
  onShowDeliveries: () => void;
}) {
  const active = hook.status === 'active';
  const paused = active && !planEnabled;
  const { stats } = hook;

  return (
    <li className={`flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-start lg:justify-between ${active ? '' : 'opacity-70'}`}>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-primary">{hook.name}</span>
          <StatusPill tone={paused ? 'warning' : active ? 'success' : 'neutral'}>
            {paused ? 'Paused' : active ? 'Active' : 'Disabled'}
          </StatusPill>
        </div>
        <div className="break-all font-mono text-xs text-secondary">{hook.url}</div>
        {hook.description ? <p className="text-xs text-secondary">{hook.description}</p> : null}
        <div className="flex flex-wrap gap-1">
          {hook.events.map((event) => (
            <span
              key={event}
              title={event}
              className="whitespace-nowrap rounded bg-[rgb(var(--bg-muted))] px-1.5 py-0.5 text-[11px] text-secondary"
            >
              {WEBHOOK_EVENT_CATALOG[event].label}
            </span>
          ))}
        </div>
        <div className="text-xs text-muted">
          {hook.companyName ?? 'All companies'} · Secret <span className="font-mono">{hook.secretMasked}</span>
          {hook.secretRotatedAt ? ` (rotated ${formatDate(hook.secretRotatedAt)})` : ''} · Added{' '}
          {formatDate(hook.createdAt)}
          {hook.createdByName ? ` by ${hook.createdByName}` : ''}
        </div>
        <EndpointHealth stats={stats} />
      </div>

      <div className="flex flex-wrap gap-2 lg:shrink-0 lg:justify-end">
        {active && canSend ? (
          <Button variant="secondary" size="sm" onClick={onTest} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Send test
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onShowDeliveries}>
          <Eye className="h-3.5 w-3.5" /> Deliveries
        </Button>
        {canEdit && planEnabled ? (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        ) : null}
        {canEdit && active ? (
          <Button variant="ghost" size="sm" onClick={onDisable} disabled={busy}>
            <Power className="h-3.5 w-3.5" /> Disable
          </Button>
        ) : null}
        {canEdit && !active && planEnabled ? (
          <Button variant="secondary" size="sm" onClick={onEnable} disabled={busy}>
            <Power className="h-3.5 w-3.5" /> Enable
          </Button>
        ) : null}
        {canEdit && !planEnabled ? (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function EndpointHealth({ stats }: { stats: TenantWebhookRecord['stats'] }) {
  if (!stats.lastDeliveryAt) {
    return <div className="text-xs text-muted">No events sent yet.</div>;
  }
  const last = stats.lastDeliveryState ? DELIVERY_STATE_DISPLAY[stats.lastDeliveryState] : null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary">
      <span>
        Last event {formatRelative(stats.lastDeliveryAt)}
        {last ? ` · ${last.label.toLowerCase()}` : ''}
      </span>
      <span>
        7 days: <span className="font-medium text-success-700 dark:text-success-400">{stats.deliveredLast7Days} delivered</span>
        {stats.failedLast7Days > 0 ? (
          <>
            {' · '}
            <span className="font-medium text-error-600 dark:text-error-400">{stats.failedLast7Days} failed</span>
          </>
        ) : null}
      </span>
      {stats.retryingNow > 0 ? (
        <span className="font-medium text-warning-700 dark:text-warning-400">{stats.retryingNow} retrying now</span>
      ) : null}
    </div>
  );
}

const PAGE_SIZE = 25;

function DeliveryLog({
  webhooks,
  status,
  webhookId,
  onWebhookIdChange,
  version,
  canRetry,
  onChanged,
}: {
  webhooks: TenantWebhookRecord[];
  status: WebhookStatusView;
  webhookId: string;
  onWebhookIdChange: (id: string) => void;
  version: number;
  canRetry: boolean;
  onChanged: () => void;
}) {
  const [state, setState] = useState<WebhookDeliveryState | 'all'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [data, setData] = useState<WebhookDeliveryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const result = await listWebhookDeliveries({
        webhookId: webhookId || undefined,
        state,
        page,
        pageSize,
      });
      setData(result);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not load the delivery log'));
    } finally {
      setLoading(false);
      setNow(Date.now());
    }
  }, [webhookId, state, page, pageSize]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load, version]);

  useEffect(() => {
    setPage(1);
  }, [webhookId, state]);

  const inFlight = data ? data.counts.pending + data.counts.sending + data.counts.retrying : 0;
  useEffect(() => {
    if (inFlight === 0) return;
    const quick = data ? data.counts.pending + data.counts.sending > 0 : false;
    const timer = window.setInterval(() => void load(), quick ? 4_000 : 20_000);
    return () => window.clearInterval(timer);
  }, [inFlight, data, load]);

  const hookById = useMemo(() => new Map(webhooks.map((hook) => [hook.id, hook])), [webhooks]);
  const totalAll = data
    ? Object.values(data.counts).reduce((sum, value) => sum + value, 0)
    : 0;

  const retry = async (delivery: WebhookDeliveryRecord) => {
    setRetryingId(delivery.id);
    setError(null);
    try {
      await retryWebhookDelivery(delivery.id);
      await load();
      onChanged();
    } catch (err) {
      setError(errorMessage(err, 'Could not retry the delivery'));
    } finally {
      setRetryingId(null);
    }
  };

  const canRetryRow = (delivery: WebhookDeliveryRecord) =>
    canRetry && delivery.state === 'failed' && hookById.get(delivery.webhookId)?.status === 'active';

  return (
    <section id="webhook-delivery-log" className="surface overflow-hidden rounded-xl border border-base shadow-card">
      <div className="flex flex-col gap-3 border-b border-base px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-primary">Delivery log</h2>
          <p className="mt-0.5 text-xs text-secondary">
            A failed delivery is tried up to {status.maxAttempts} times, retrying after{' '}
            {status.retryDelaysMs.map(formatDelay).join(', ')}. Any 2xx response counts as delivered.
          </p>
        </div>
        <div className="w-full lg:w-64">
          <Select
            aria-label="Endpoint"
            value={webhookId}
            onChange={(event) => onWebhookIdChange(event.target.value)}
          >
            <option value="">All endpoints</option>
            {webhooks.map((hook) => (
              <option key={hook.id} value={hook.id}>
                {hook.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-base px-5 py-3" role="tablist" aria-label="Delivery status">
        {DELIVERY_STATE_FILTERS.map((filter) => {
          const count = filter.value === 'all' ? totalAll : (data?.counts[filter.value] ?? 0);
          if (filter.value !== 'all' && filter.value !== state && count === 0 && (filter.value === 'pending' || filter.value === 'sending')) {
            return null;
          }
          const selected = state === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setState(filter.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selected
                  ? 'border-accent-600 bg-accent-600 text-white'
                  : 'border-base text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'
              }`}
            >
              {filter.label}
              <span className={`ml-1.5 ${selected ? 'text-white/80' : 'text-muted'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="border-b border-base bg-error-50 px-5 py-2 text-sm text-error-700 dark:bg-error-950/30 dark:text-error-300">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center justify-center py-10 text-sm text-secondary">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading deliveries…
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-secondary">
          {state === 'all'
            ? webhookId
              ? 'Nothing has been sent to this endpoint yet.'
              : 'Nothing has been sent yet. Deliveries appear here as soon as a subscribed event happens.'
            : `No ${DELIVERY_STATE_DISPLAY[state].label.toLowerCase()} deliveries.`}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
                <tr>
                  <th className="px-5 py-3">Event</th>
                  {webhookId ? null : <th className="px-5 py-3">Endpoint</th>}
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Response</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {data.items.map((delivery) => {
                  const detail = retryDetail(delivery, now);
                  return (
                    <tr key={delivery.id}>
                      <td className="px-5 py-3 align-top">
                        <div className="font-medium text-primary">{eventLabel(delivery.eventType)}</div>
                        <div className="font-mono text-[11px] text-muted">{delivery.eventType}</div>
                      </td>
                      {webhookId ? null : (
                        <td className="px-5 py-3 align-top text-secondary">{delivery.webhookName}</td>
                      )}
                      <td className="px-5 py-3 align-top">
                        <StatusPill tone={DELIVERY_STATE_DISPLAY[delivery.state].tone}>
                          {DELIVERY_STATE_DISPLAY[delivery.state].label}
                        </StatusPill>
                        {detail ? <div className="mt-1 whitespace-nowrap text-xs text-muted">{detail}</div> : null}
                      </td>
                      <td className="max-w-xs px-5 py-3 align-top">
                        {delivery.httpStatus ? (
                          <span
                            className={`font-mono text-xs ${
                              delivery.httpStatus < 300 ? 'text-success-700 dark:text-success-400' : 'text-error-600 dark:text-error-400'
                            }`}
                          >
                            HTTP {delivery.httpStatus}
                          </span>
                        ) : null}
                        {delivery.errorMessage && delivery.state !== 'delivered' ? (
                          <div className="truncate text-xs text-secondary" title={delivery.errorMessage}>
                            {delivery.errorMessage}
                          </div>
                        ) : !delivery.httpStatus ? (
                          <span className="text-xs text-muted">—</span>
                        ) : null}
                      </td>
                      <td
                        className="whitespace-nowrap px-5 py-3 align-top text-xs text-secondary"
                        title={new Date(delivery.createdAt).toLocaleString()}
                      >
                        {formatDateTime(delivery.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right align-top">
                        <div className="flex justify-end gap-1">
                          {canRetryRow(delivery) ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void retry(delivery)}
                              disabled={retryingId === delivery.id}
                            >
                              {retryingId === delivery.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                              )}
                              Retry
                            </Button>
                          ) : null}
                          <Button variant="ghost" size="sm" onClick={() => setDetailId(delivery.id)}>
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-base px-5 py-3">
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              totalItems={data.total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              pageSizeOptions={[25, 50, 100]}
            />
          </div>
        </>
      )}

      <DeliveryDetailModal
        deliveryId={detailId}
        canRetry={(delivery) => canRetryRow(delivery)}
        onRetry={async (delivery) => {
          await retry(delivery);
          setDetailId(null);
        }}
        onClose={() => setDetailId(null)}
      />
    </section>
  );
}

function DeliveryDetailModal({
  deliveryId,
  canRetry,
  onRetry,
  onClose,
}: {
  deliveryId: string | null;
  canRetry: (delivery: WebhookDeliveryRecord) => boolean;
  onRetry: (delivery: WebhookDeliveryRecord) => Promise<void>;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<WebhookDeliveryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!deliveryId) return;
    setDetail(null);
    setError(null);
    setCopied(false);
    getWebhookDelivery(deliveryId)
      .then(setDetail)
      .catch((err) => setError(errorMessage(err, 'Could not load the delivery')));
  }, [deliveryId]);

  const payloadText = detail ? JSON.stringify(detail.payload, null, 2) : '';
  const retryAllowed = detail ? canRetry(detail) : false;

  return (
    <Modal
      open={deliveryId !== null}
      onClose={onClose}
      title={detail ? eventLabel(detail.eventType) : 'Delivery'}
      description={detail ? `${detail.webhookName} · ${detail.url}` : undefined}
      size="lg"
      footer={
        <>
          {retryAllowed && detail ? (
            <Button
              variant="secondary"
              disabled={retrying}
              onClick={async () => {
                setRetrying(true);
                try {
                  await onRetry(detail);
                } finally {
                  setRetrying(false);
                }
              }}
            >
              {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Retry now
            </Button>
          ) : null}
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      {error ? (
        <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700 dark:border-error-800 dark:bg-error-950/30 dark:text-error-300">
          {error}
        </p>
      ) : !detail ? (
        <div className="flex items-center justify-center py-8 text-sm text-secondary">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={DELIVERY_STATE_DISPLAY[detail.state].tone}>
              {DELIVERY_STATE_DISPLAY[detail.state].label}
            </StatusPill>
            <span className="text-sm text-secondary">{retryDetail(detail) ?? `Attempt ${detail.attempts} of ${detail.maxAttempts}`}</span>
          </div>

          {detail.errorMessage && detail.state !== 'delivered' ? (
            <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700 dark:border-error-800 dark:bg-error-950/30 dark:text-error-300">
              <div className="text-xs font-semibold uppercase tracking-wide">Last error</div>
              <div className="mt-0.5 break-words">{detail.errorMessage}</div>
            </div>
          ) : null}

          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <DetailItem label="HTTP status" value={detail.httpStatus ? String(detail.httpStatus) : '—'} />
            <DetailItem label="Attempts" value={`${detail.attempts} of ${detail.maxAttempts}`} />
            <DetailItem label="Created" value={formatDateTime(detail.createdAt)} />
            <DetailItem label="Last attempt" value={formatDateTime(detail.lastAttemptAt)} />
            {detail.state === 'retrying' ? (
              <DetailItem
                label="Next attempt"
                value={`${formatDateTime(detail.nextAttemptAt)} (${formatRelative(detail.nextAttemptAt)})`}
              />
            ) : null}
            {detail.deliveredAt ? <DetailItem label="Delivered" value={formatDateTime(detail.deliveredAt)} /> : null}
            {detail.failedAt ? <DetailItem label="Gave up" value={formatDateTime(detail.failedAt)} /> : null}
            <DetailItem label="Delivery ID" value={detail.id} mono hint="Sent as X-HRM-Delivery-Id" />
            <DetailItem label="Event ID" value={detail.eventId} mono />
            <DetailItem label="Schema version" value={detail.schemaVersion} mono />
          </dl>

          <div>
            <div className="flex items-center justify-between">
              <Label>Payload</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(payloadText);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <pre className="mt-1 max-h-72 overflow-auto rounded-lg border border-base bg-[rgb(var(--bg-muted))] px-3 py-2 font-mono text-xs text-secondary">
              {payloadText}
            </pre>
          </div>
        </div>
      )}
    </Modal>
  );
}

function DetailItem({
  label,
  value,
  mono,
  hint,
}: {
  label: string;
  value: string;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`break-all text-primary ${mono ? 'font-mono text-xs' : ''}`} title={hint}>
        {value}
      </dd>
    </div>
  );
}

function EndpointFormModal({
  open,
  webhook,
  companies,
  canEdit,
  onClose,
  onSaved,
  onRotate,
  onDelete,
}: {
  open: boolean;
  webhook: TenantWebhookRecord | null;
  companies: Array<{ id: string; name: string }>;
  canEdit: boolean;
  onClose: () => void;
  onSaved: (record: TenantWebhookRecord, secret?: string) => void;
  onRotate: (hook: TenantWebhookRecord) => void;
  onDelete: (hook: TenantWebhookRecord) => void;
}) {
  const editing = webhook !== null;
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [events, setEvents] = useState<WebhookEventType[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(webhook?.name ?? '');
    setUrl(webhook?.url ?? '');
    setDescription(webhook?.description ?? '');
    setCompanyId(webhook?.companyId ?? '');
    setEvents(webhook?.events ?? []);
    setSaving(false);
    setError(null);
  }, [open, webhook]);

  const trimmedUrl = url.trim();
  const urlHint = !trimmedUrl
    ? null
    : !/^https?:\/\//i.test(trimmedUrl)
      ? 'Enter the full URL, starting with https://'
      : /^http:\/\//i.test(trimmedUrl)
        ? 'Use https:// so payloads are encrypted in transit. Plain http is rejected in production.'
        : null;
  const valid = name.trim().length >= 2 && /^https?:\/\/.+/i.test(trimmedUrl) && events.length > 0;
  const deleteOnly = editing && !canEdit;

  const toggle = (event: WebhookEventType) =>
    setEvents((current) =>
      current.includes(event) ? current.filter((item) => item !== event) : [...current, event],
    );

  const submit = async () => {
    setSaving(true);
    setError(null);
    const companyValue = companyId || null;
    try {
      if (webhook) {
        const record = await updateTenantWebhook(webhook.id, {
          name: name.trim(),
          url: trimmedUrl,
          events,
          companyId: companyValue,
          description: description.trim() || null,
        });
        onSaved(record);
      } else {
        const result = await createTenantWebhook({
          name: name.trim(),
          url: trimmedUrl,
          events,
          companyId: companyValue,
          description: description.trim() || undefined,
        });
        onSaved(result.webhook, result.secret);
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not save the endpoint'));
    } finally {
      setSaving(false);
    }
  };

  if (deleteOnly && webhook) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={webhook.name}
        description="Editing needs the Enterprise plan. You can still delete this endpoint."
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => onDelete(webhook)}>
              <Trash2 className="h-4 w-4" /> Delete endpoint
            </Button>
          </>
        }
      >
        <p className="break-all font-mono text-xs text-secondary">{webhook.url}</p>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      title={editing ? 'Edit endpoint' : 'Add endpoint'}
      description={
        editing
          ? 'Changes apply to events from now on. Deliveries already queued keep their original payload.'
          : 'You’ll get a signing secret after saving. It’s shown only once.'
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving || !valid}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add endpoint'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="webhook-name">Name</Label>
            <Input
              id="webhook-name"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. ERP employee sync"
            />
          </div>
          {companies.length > 1 ? (
            <div>
              <Label htmlFor="webhook-company">Company</Label>
              <Select id="webhook-company" value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
                <option value="">All companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>

        <div>
          <Label htmlFor="webhook-url">Endpoint URL</Label>
          <Input
            id="webhook-url"
            value={url}
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://erp.example.com/webhooks/cmsn-hr"
            className="font-mono"
          />
          <p className={`mt-1 text-xs ${urlHint ? 'text-warning-700 dark:text-warning-400' : 'text-muted'}`}>
            {urlHint ?? 'Must be reachable from the internet and answer with a 2xx status within 15 seconds.'}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label>Events</Label>
            <button
              type="button"
              className="text-xs font-medium text-accent-600 hover:underline dark:text-accent-400"
              onClick={() =>
                setEvents(events.length === ALL_WEBHOOK_EVENT_TYPES.length ? [] : [...ALL_WEBHOOK_EVENT_TYPES])
              }
            >
              {events.length === ALL_WEBHOOK_EVENT_TYPES.length ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="mt-2 divide-y divide-[rgb(var(--border-base))] rounded-lg border border-base">
            {ALL_WEBHOOK_EVENT_TYPES.map((event) => {
              const definition = WEBHOOK_EVENT_CATALOG[event];
              const checked = events.includes(event);
              return (
                <label key={event} className="flex cursor-pointer items-start gap-3 px-3 py-3 hover:bg-[rgb(var(--bg-hover))]">
                  <input type="checkbox" className="mt-1" checked={checked} onChange={() => toggle(event)} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium text-primary">{definition.label}</span>
                      <code className="font-mono text-[11px] text-muted">{event}</code>
                    </div>
                    <div className="text-xs text-secondary">{definition.description}</div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      Data: <span className="font-mono">{definition.dataFields.join(', ')}</span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          {events.length === 0 ? <p className="mt-1 text-xs text-muted">Choose at least one event.</p> : null}
        </div>

        <div>
          <Label htmlFor="webhook-description">Notes (optional)</Label>
          <Textarea
            id="webhook-description"
            rows={2}
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Who owns the receiving system, or what it does with these events"
          />
        </div>

        {webhook ? (
          <div className="space-y-3 rounded-lg border border-base p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium text-primary">Signing secret</div>
                <div className="font-mono text-xs text-muted">{webhook.secretMasked}</div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => onRotate(webhook)} disabled={saving}>
                <KeyRound className="h-3.5 w-3.5" /> Rotate secret
              </Button>
            </div>
            <VerificationExamples defaultOpen={false} />
            <div className="flex flex-col gap-2 border-t border-base pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-secondary">Deleting removes the endpoint and its delivery log.</div>
              <Button variant="ghost" size="sm" onClick={() => onDelete(webhook)} disabled={saving}>
                <Trash2 className="h-3.5 w-3.5" /> Delete endpoint
              </Button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700 dark:border-error-800 dark:bg-error-950/30 dark:text-error-300">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function SecretRevealModal({ reveal, onClose }: { reveal: SecretReveal | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [reveal]);

  if (!reveal) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={reveal.reason === 'created' ? 'Endpoint added — copy its signing secret' : 'Copy the new signing secret'}
      size="lg"
      footer={<Button onClick={onClose}>I&apos;ve saved the secret</Button>}
    >
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-800 dark:border-warning-800 dark:bg-warning-950/30 dark:text-warning-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {reveal.reason === 'created'
            ? 'This is the only time the secret is shown. Store it in the receiving system’s secret settings. If it’s lost, rotate it from Edit.'
            : 'The previous secret no longer works. Update the receiving system now; until then its signature checks will fail.'}
        </p>
        <div>
          <Label>{reveal.webhook.name}</Label>
          <div className="mt-1 flex items-stretch gap-2">
            <code className="flex-1 break-all rounded-lg border border-base bg-[rgb(var(--bg-muted))] px-3 py-2 font-mono text-xs text-primary">
              {reveal.secret}
            </code>
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(reveal.secret);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
        <div className="space-y-1.5 text-sm text-secondary">
          <p>Every request includes:</p>
          <ul className="list-disc space-y-0.5 pl-5 text-xs">
            <li>
              <code className="font-mono">X-HRM-Signature: t=&lt;unix time&gt;,v1=&lt;hex&gt;</code>, an HMAC-SHA256 of{' '}
              <code className="font-mono">&quot;&lt;t&gt;.&lt;raw body&gt;&quot;</code> using this secret
            </li>
            <li>
              <code className="font-mono">X-HRM-Event-Type</code>, <code className="font-mono">X-HRM-Delivery-Id</code>{' '}
              (the same ID on every retry, so you can ignore duplicates) and{' '}
              <code className="font-mono">X-HRM-Schema-Version</code>
            </li>
          </ul>
        </div>
        <VerificationExamples />
      </div>
    </Modal>
  );
}

function VerificationExamples({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const [language, setLanguage] = useState<VerificationLanguage>('node');
  const [copied, setCopied] = useState(false);
  const example = VERIFICATION_EXAMPLES.find((item) => item.id === language) ?? VERIFICATION_EXAMPLES[0];

  return (
    <details className="rounded-lg border border-base" open={defaultOpen}>
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-primary">
        How to verify the signature
      </summary>
      <div className="border-t border-base">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div role="tablist" aria-label="Language" className="inline-flex flex-wrap rounded-lg border border-base p-0.5">
            {VERIFICATION_EXAMPLES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={language === item.id}
                onClick={() => {
                  setLanguage(item.id);
                  setCopied(false);
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  language === item.id
                    ? 'bg-accent-600 text-white'
                    : 'text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(example.code);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <pre className="max-h-80 overflow-auto border-t border-base bg-[rgb(var(--bg-muted))] px-3 py-2 font-mono text-xs text-secondary">
          {example.code}
        </pre>
      </div>
    </details>
  );
}
