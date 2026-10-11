import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileSpreadsheet,
  History,
  Info,
  Link2,
  Loader2,
  PlugZap,
  RefreshCw,
  RotateCw,
  Unplug,
  X,
  XCircle,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import type { AccountingConnectionRecord, AccountingSyncJobRecord } from '@hrm/shared-types';
import { ConnectionStatusPill } from '@/components/accounting/ConnectionStatusPill';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusPill } from '@/components/ui/StatusPill';
import { pathForPage } from '@/config/routes';
import { useCompany } from '@/context/CompanyContext';
import {
  beginXeroConnect,
  disconnectXero,
  listAccountingConnections,
  listAccountingSyncJobs,
} from '@/lib/accounting-api';
import {
  connectionStatusExplanation,
  formatDateTime,
  needsReconnect,
} from '@/lib/accounting-display';
import { ApiError } from '@/lib/tenant-api-client';

interface OAuthResult {
  tone: 'success' | 'error';
  message: string;
  companyId: string | null;
}

/** The API's Xero callback redirects here with `?xero=connected|error`. */
function readOAuthResult(): OAuthResult | null {
  const params = new URLSearchParams(window.location.search);
  const result = params.get('xero');
  if (result === 'connected') {
    const org = params.get('org');
    return {
      tone: 'success',
      message: org
        ? `Xero is connected to “${org}”. Payroll journals will post there after payroll is finalized.`
        : 'Xero is connected. Payroll journals will post there after payroll is finalized.',
      companyId: params.get('companyId'),
    };
  }
  if (result === 'error') {
    return {
      tone: 'error',
      message: `Xero was not connected. ${params.get('message') ?? 'Please try again.'}`,
      companyId: null,
    };
  }
  return null;
}

function stripOAuthParams() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('xero')) return;
  for (const key of ['xero', 'org', 'message', 'companyId']) params.delete(key);
  const rest = params.toString();
  window.history.replaceState(
    window.history.state,
    '',
    rest ? `${window.location.pathname}?${rest}` : window.location.pathname,
  );
}

export function AccountingConnectionsPage() {
  const [oauthResult] = useState(readOAuthResult);
  const { companies, companyId, setCompanyId } = useCompany();
  const switchedToCallbackCompany = useRef(false);

  useEffect(stripOAuthParams, []);

  useEffect(() => {
    const target = oauthResult?.companyId;
    if (!target || switchedToCallbackCompany.current) return;
    if (!companies.some((company) => company.id === target)) return;
    switchedToCallbackCompany.current = true;
    if (companyId !== target) setCompanyId(target);
  }, [oauthResult, companies, companyId, setCompanyId]);

  return (
    <OrgPageState>
      {(id) => (
        <>
          <div className="px-4 lg:px-6 pt-4">
            <CompanySelector />
          </div>
          <ConnectionsContent key={id} companyId={id} initialNotice={oauthResult} />
        </>
      )}
    </OrgPageState>
  );
}

function ConnectionsContent({
  companyId,
  initialNotice,
}: {
  companyId: string;
  initialNotice: OAuthResult | null;
}) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canEdit = can('payroll', 'edit');

  const [connection, setConnection] = useState<AccountingConnectionRecord | null>(null);
  const [syncJobs, setSyncJobs] = useState<AccountingSyncJobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Omit<OAuthResult, 'companyId'> | null>(initialNotice);
  const [connecting, setConnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [connections, jobs] = await Promise.all([
        listAccountingConnections(companyId),
        listAccountingSyncJobs(companyId),
      ]);
      setConnection(connections.find((row) => row.provider === 'xero') ?? null);
      setSyncJobs(jobs.filter((job) => job.provider === 'xero'));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load the Xero connection');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConnect = async () => {
    setConnecting(true);
    setNotice(null);
    try {
      const { authorizeUrl } = await beginXeroConnect(companyId);
      window.location.assign(authorizeUrl);
    } catch (err) {
      setNotice({
        tone: 'error',
        message: err instanceof ApiError ? err.message : 'Could not start the Xero sign-in',
      });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const updated = await disconnectXero(companyId);
    setConnection(updated);
    setNotice({
      tone: 'success',
      message:
        'Xero is disconnected. Payroll journals will no longer sync automatically — you can still export them as CSV.',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading accounting connections…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-primary">Accounting Connections</h1>
          <p className="mt-0.5 text-sm text-secondary">
            Connect this company to its accounting software. Once Xero is connected, payroll journals post
            automatically when payroll is finalized. A failed sync never blocks payroll.
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
          <Button variant="secondary" onClick={() => navigate(pathForPage('accounting-mapping'))}>
            <BookOpen className="h-4 w-4" /> Account mapping
          </Button>
          <Button variant="secondary" onClick={() => navigate(pathForPage('accounting-exports'))}>
            <History className="h-4 w-4" /> Export &amp; sync status
          </Button>
        </div>
      </div>

      {notice ? <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} /> : null}
      {loadError ? (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/30 dark:text-error-300">
          {loadError}
        </div>
      ) : null}

      {connection ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <XeroConnectionCard
            connection={connection}
            canEdit={canEdit}
            connecting={connecting}
            onConnect={() => void handleConnect()}
            onDisconnect={() => setConfirmDisconnect(true)}
            onViewSyncs={() => navigate(pathForPage('accounting-exports'))}
          />
          <HowItWorks />
        </div>
      ) : null}

      {connection ? (
        <SyncSummary
          connection={connection}
          jobs={syncJobs}
          onOpen={() => navigate(pathForPage('accounting-exports'))}
        />
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-primary">Other accounting software</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <OtherProvider
            initial="Q"
            color="bg-emerald-500"
            name="QuickBooks"
            description="Direct sync with QuickBooks Online is planned. Until then, export the payroll journal as CSV and import it."
          />
          <OtherProvider
            initial="T"
            color="bg-indigo-500"
            name="Tally"
            description="Tally works through file import. Export the payroll journal as CSV and import it into Tally."
            badge="CSV import"
            action={
              <Button variant="secondary" size="sm" onClick={() => navigate(pathForPage('accounting'))}>
                <FileSpreadsheet className="h-4 w-4" /> Payroll journal
              </Button>
            }
          />
        </div>
      </section>

      <ConfirmDialog
        open={confirmDisconnect}
        title="Disconnect Xero?"
        confirmLabel="Disconnect"
        description={
          <div className="space-y-2">
            <p>
              Payroll journals will stop posting to
              {connection?.externalOrgName ? ` “${connection.externalOrgName}”` : ' Xero'} automatically.
            </p>
            <p>
              Journals already in Xero stay there, the export history is kept, and you can still export journals
              as CSV. You can reconnect at any time.
            </p>
          </div>
        }
        onConfirm={handleDisconnect}
        onClose={() => setConfirmDisconnect(false)}
      />
    </div>
  );
}

function NoticeBanner({
  notice,
  onDismiss,
}: {
  notice: Omit<OAuthResult, 'companyId'>;
  onDismiss: () => void;
}) {
  const success = notice.tone === 'success';
  return (
    <div
      role={success ? 'status' : 'alert'}
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
        success
          ? 'border-success-200 bg-success-50 text-success-700 dark:border-success-800 dark:bg-success-950/30 dark:text-success-300'
          : 'border-error-200 bg-error-50 text-error-700 dark:border-error-800 dark:bg-error-950/30 dark:text-error-300'
      }`}
    >
      {success ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span className="flex-1">{notice.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

const STATUS_CALLOUT: Record<AccountingConnectionRecord['status'], string> = {
  connected:
    'border-success-200 bg-success-50 text-success-800 dark:border-success-800 dark:bg-success-950/30 dark:text-success-300',
  disconnected: 'border-base bg-[rgb(var(--bg-muted))] text-secondary',
  token_expired:
    'border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-800 dark:bg-warning-950/30 dark:text-warning-200',
  error:
    'border-error-200 bg-error-50 text-error-700 dark:border-error-800 dark:bg-error-950/30 dark:text-error-300',
};

function XeroConnectionCard({
  connection,
  canEdit,
  connecting,
  onConnect,
  onDisconnect,
  onViewSyncs,
}: {
  connection: AccountingConnectionRecord;
  canEdit: boolean;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onViewSyncs: () => void;
}) {
  const { status } = connection;
  const reconnect = needsReconnect(status);
  const hasConnection = status !== 'disconnected';
  const StatusIcon =
    status === 'connected' ? CheckCircle2 : status === 'disconnected' ? Unplug : AlertTriangle;

  const details: Array<[string, string]> = [
    ['Organisation', connection.externalOrgName ?? '—'],
    [
      hasConnection ? 'Connected' : 'Last connected',
      connection.connectedAt
        ? `${formatDateTime(connection.connectedAt)}${connection.connectedByName ? ` by ${connection.connectedByName}` : ''}`
        : '—',
    ],
    ['Last sync', connection.lastSyncAt ? formatDateTime(connection.lastSyncAt) : 'Never'],
  ];
  if (!hasConnection && connection.disconnectedAt) {
    details.push(['Disconnected', formatDateTime(connection.disconnectedAt)]);
  }

  return (
    <section className="surface rounded-xl border border-base p-5 shadow-card lg:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500 text-lg font-bold text-white">
            X
          </div>
          <div>
            <h2 className="text-base font-bold text-primary">Xero</h2>
            <p className="text-xs text-secondary">Cloud accounting · posts payroll as manual journals</p>
          </div>
        </div>
        <ConnectionStatusPill status={status} />
      </div>

      <div className={`mt-4 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${STATUS_CALLOUT[status]}`}>
        <StatusIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{connectionStatusExplanation(connection)}</span>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-0.5 flex items-center gap-2 break-words text-primary">
              {value}
              {label === 'Last sync' && connection.lastSyncStatus ? (
                <SyncStatusPill status={connection.lastSyncStatus} />
              ) : null}
            </dd>
          </div>
        ))}
      </dl>

      {connection.lastSyncStatus === 'failed' && connection.lastSyncError ? (
        <div className="mt-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-800 dark:bg-error-950/30 dark:text-error-300">
          <div className="font-medium">Why the last sync failed</div>
          <div className="mt-0.5">{connection.lastSyncError}</div>
          <button
            type="button"
            onClick={onViewSyncs}
            className="mt-2 text-xs font-medium underline underline-offset-2 hover:no-underline"
          >
            See it on Export &amp; sync status
          </button>
        </div>
      ) : null}

      <div className="mt-5 border-t border-base pt-4">
        {!canEdit ? (
          <p className="flex items-start gap-2 text-xs text-secondary">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            You can view this connection. Connecting or disconnecting Xero needs payroll edit access.
          </p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {!connection.oauthConfigured && status !== 'connected' ? (
              <p className="flex items-start gap-2 text-xs text-secondary">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Xero isn&apos;t set up on this server yet, so it can&apos;t be connected. A platform administrator
                  needs to set XERO_CLIENT_ID, XERO_CLIENT_SECRET and XERO_REDIRECT_URI.
                </span>
              </p>
            ) : (
              <p className="text-xs text-secondary">
                {status === 'connected'
                  ? 'Disconnecting stops automatic syncs and revokes this app’s access in Xero.'
                  : 'You’ll sign in to Xero and pick the organisation to share. If you choose several, the first one is used.'}
              </p>
            )}
            <div className="flex flex-wrap gap-2 sm:shrink-0">
              {connection.oauthConfigured && (status === 'disconnected' || reconnect) ? (
                <Button onClick={onConnect} disabled={connecting}>
                  {connecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : reconnect ? (
                    <RotateCw className="h-4 w-4" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}
                  {connecting ? 'Opening Xero…' : reconnect ? 'Reconnect Xero' : 'Connect Xero'}
                </Button>
              ) : null}
              {hasConnection ? (
                <Button variant="secondary" onClick={onDisconnect} disabled={connecting}>
                  <Unplug className="h-4 w-4" /> Disconnect
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function SyncStatusPill({ status }: { status: AccountingSyncJobRecord['status'] }) {
  if (status === 'completed') return <StatusPill tone="success">Succeeded</StatusPill>;
  if (status === 'failed') return <StatusPill tone="error">Failed</StatusPill>;
  return <StatusPill tone="accent">Syncing</StatusPill>;
}

function HowItWorks() {
  const steps = [
    'Finalize a payroll run. The journal is built from your account mapping.',
    'In the background, it posts to Xero as a manual journal.',
    'If a sync fails, payroll stays finalized. The reason shows on Export & sync status, where you can retry it.',
  ];
  return (
    <section className="surface rounded-xl border border-base p-5 shadow-card">
      <div className="flex items-center gap-2">
        <PlugZap className="h-4 w-4 text-accent-600 dark:text-accent-400" />
        <h2 className="text-sm font-semibold text-primary">How syncing works</h2>
      </div>
      <ol className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm text-secondary">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-50 text-[11px] font-semibold text-accent-700 dark:bg-accent-950/50 dark:text-accent-300">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 border-t border-base pt-4 text-xs text-muted">
        Each company connects separately. Connecting and disconnecting are recorded in the audit log.
      </p>
    </section>
  );
}

function SyncSummary({
  connection,
  jobs,
  onOpen,
}: {
  connection: AccountingConnectionRecord;
  jobs: AccountingSyncJobRecord[];
  onOpen: () => void;
}) {
  const failed = jobs.filter((job) => job.status === 'failed').length;
  let text: string;
  if (jobs.length === 0) {
    text =
      connection.status === 'connected'
        ? 'No syncs yet. The first one runs when you finalize payroll.'
        : 'No syncs yet. Connect Xero, then finalize payroll to post a journal automatically.';
  } else if (failed > 0) {
    text = `${failed} of the last ${jobs.length} syncs failed. See why and retry them on Export & sync status.`;
  } else {
    text = `The last ${jobs.length} sync${jobs.length === 1 ? '' : 's'} had no failures.`;
  }

  return (
    <section className="surface flex flex-col gap-3 rounded-xl border border-base p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-primary">Recent syncs</h2>
          {failed > 0 ? <Badge tone="error">{failed} failed</Badge> : null}
        </div>
        <p className="mt-1 text-xs text-secondary">{text}</p>
      </div>
      <Button variant="secondary" onClick={onOpen}>
        <History className="h-4 w-4" /> View export &amp; sync status
      </Button>
    </section>
  );
}

function OtherProvider({
  initial,
  color,
  name,
  description,
  badge = 'Coming soon',
  action,
}: {
  initial: string;
  color: string;
  name: string;
  description: string;
  badge?: string;
  action?: ReactNode;
}) {
  return (
    <section className="surface flex flex-col rounded-xl border border-base p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white ${color}`}
          >
            {initial}
          </div>
          <h3 className="text-sm font-semibold text-primary">{name}</h3>
        </div>
        <Badge tone="neutral">{badge}</Badge>
      </div>
      <p className="mt-3 flex-1 text-xs text-secondary">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}
