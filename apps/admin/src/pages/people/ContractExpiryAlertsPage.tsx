import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  Send,
  Settings2,
  X,
} from 'lucide-react';
import {
  CONTRACT_EXPIRY_WINDOW_MAX_DAYS,
  CONTRACT_EXPIRY_WINDOW_MIN_DAYS,
  type ContractExpiryAlertItem,
  type ContractExpiryAlertsView,
} from '@hrm/shared-types';
import { usePermissions } from '@hrm/portal-ui';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FieldError } from '@/components/ui/FieldError';
import { Input, Label } from '@/components/ui/Form';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { ContractStatusBadge, ContractTypeBadge } from '@/components/contracts/ContractBadges';
import { useNav } from '@/context/NavContext';
import { pathForPage } from '@/config/routes';
import {
  getContractExpiryAlerts,
  runContractExpiryAlerts,
  updateContractExpiryAlertSettings,
} from '@/lib/contracts-api';
import { formatContractDate, relativeDays } from '@/lib/contract-form';
import { ApiError } from '@/lib/tenant-api-client';

const WINDOW_PRESETS = [14, 30, 60, 90];
const VIEW_OPTIONS = [30, 60, 90, 180];

type Focus = 'all' | 'action' | 'renewing' | 'unnotified';

const FOCUS_OPTIONS: { value: Focus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'action', label: 'Needs renewal' },
  { value: 'renewing', label: 'Renewal in progress' },
  { value: 'unnotified', label: 'Not yet notified' },
];

type AlertState = 'sent' | 'renewing' | 'due' | 'outside';

function alertState(item: ContractExpiryAlertItem, windowDays: number): AlertState {
  if (item.alertSentAt) return 'sent';
  if (item.renewal) return 'renewing';
  return item.daysUntil <= windowDays ? 'due' : 'outside';
}

function urgencyTone(daysUntil: number): 'error' | 'warning' | 'neutral' {
  if (daysUntil <= 7) return 'error';
  if (daysUntil <= 30) return 'warning';
  return 'neutral';
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Wider-than-window views only, so the summary counts always cover the whole alert window. */
function readView(value: string | null): number | null {
  const n = Number(value);
  return VIEW_OPTIONS.includes(n) ? n : null;
}

function readFocus(value: string | null): Focus {
  return FOCUS_OPTIONS.some((o) => o.value === value) ? (value as Focus) : 'all';
}

function AlertCell({ item, windowDays }: { item: ContractExpiryAlertItem; windowDays: number }) {
  switch (alertState(item, windowDays)) {
    case 'sent':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-success-700 dark:text-success-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Notified {formatContractDate(item.alertSentAt)}
        </span>
      );
    case 'renewing':
      return <span className="text-xs text-muted">Not needed — renewal started</span>;
    case 'due':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-warning-700 dark:text-warning-400">
          <Clock className="h-3.5 w-3.5" />
          Sends at next run
        </span>
      );
    default:
      return <span className="text-xs text-muted">Outside alert window</span>;
  }
}

function ExpiryAlertsContent({ companyId }: { companyId: string }) {
  const { openContract, openEmployee } = useNav();
  const routerNavigate = useNavigate();
  const { user, can } = usePermissions();
  const canConfigure = can('settings', 'edit');
  const canRunNow = canConfigure && user?.dataScope !== 'team';
  const canRenew = can('employee', 'create');
  const [params, setParams] = useSearchParams();
  const viewOverride = readView(params.get('window'));
  const focus = readFocus(params.get('focus'));

  const [data, setData] = useState<ContractExpiryAlertsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [windowInput, setWindowInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [runOpen, setRunOpen] = useState(false);

  const setParam = useCallback(
    (key: 'window' | 'focus', value: string | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getContractExpiryAlerts(companyId, viewOverride ?? undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load contract expiry alerts');
    } finally {
      setLoading(false);
    }
  }, [companyId, viewOverride]);

  useEffect(() => {
    void load();
  }, [load]);

  const companyWindow = data?.settings.windowDays ?? 30;

  useEffect(() => {
    if (data && viewOverride !== null && viewOverride <= data.settings.windowDays) {
      setParam('window', null);
    }
  }, [data, viewOverride, setParam]);

  const counts = useMemo(() => {
    const upcoming = data?.upcoming ?? [];
    return {
      overdue: data?.overdue.length ?? 0,
      week: upcoming.filter((i) => i.daysUntil <= 7 && !i.renewal).length,
      inWindow: upcoming.filter((i) => i.daysUntil <= companyWindow).length,
      due: upcoming.filter((i) => alertState(i, companyWindow) === 'due').length,
      renewing: upcoming.filter((i) => i.renewal).length,
    };
  }, [data, companyWindow]);

  const visible = useMemo(() => {
    const upcoming = data?.upcoming ?? [];
    switch (focus) {
      case 'action':
        return upcoming.filter((i) => !i.renewal);
      case 'renewing':
        return upcoming.filter((i) => i.renewal);
      case 'unnotified':
        return upcoming.filter((i) => !i.alertSentAt && !i.renewal);
      default:
        return upcoming;
    }
  }, [data, focus]);

  const openSettings = () => {
    setWindowInput(String(companyWindow));
    setSettingsError(null);
    setSettingsOpen(true);
  };

  const parsedWindow = Number(windowInput);
  const windowInvalid =
    !Number.isInteger(parsedWindow) ||
    parsedWindow < CONTRACT_EXPIRY_WINDOW_MIN_DAYS ||
    parsedWindow > CONTRACT_EXPIRY_WINDOW_MAX_DAYS;

  const saveSettings = async () => {
    if (windowInvalid) return;
    setSaving(true);
    setSettingsError(null);
    try {
      await updateContractExpiryAlertSettings(companyId, parsedWindow);
      setSettingsOpen(false);
      setNotice(`Alert window set to ${parsedWindow} days. It applies from the next run.`);
      await load();
    } catch (err) {
      setSettingsError(err instanceof ApiError ? err.message : 'Could not save the alert window');
    } finally {
      setSaving(false);
    }
  };

  const renew = (item: ContractExpiryAlertItem) =>
    routerNavigate(`${pathForPage('emp-contract-detail', { contractId: item.contractId })}?action=renew`);

  const summary: { label: string; value: number; tone: string; hint: string }[] = [
    { label: 'Ended, not renewed', value: counts.overdue, tone: counts.overdue ? 'text-error-600' : 'text-primary', hint: 'Still active past their end date' },
    { label: 'Ending within 7 days', value: counts.week, tone: counts.week ? 'text-error-600' : 'text-primary', hint: 'No renewal started yet' },
    { label: `Inside ${companyWindow}-day window`, value: counts.inWindow, tone: 'text-primary', hint: `${counts.renewing} with a renewal in progress` },
    { label: 'Alerts due', value: counts.due, tone: counts.due ? 'text-warning-600' : 'text-primary', hint: 'Sent at the next run' },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Contract Expiry Alerts</h1>
          <p className="text-sm text-secondary mt-0.5">
            Active contracts approaching their end date. HR is notified once per contract when it enters the alert
            window.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CompanySelector />
          <Button variant="secondary" disabled={loading} onClick={() => void load()}>
            <RefreshCw className={`h-4 w-4 ${loading && data ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          {canRunNow ? (
            <Button variant="primary" disabled={loading || counts.due === 0} onClick={() => setRunOpen(true)}>
              <Send className="h-4 w-4" /> Send due alerts
            </Button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <div role="status" className="flex items-start gap-2 text-sm text-success-700 bg-success-50 dark:bg-success-950/30 border border-success-200 dark:border-success-800 rounded-lg px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">{notice}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="flex items-center gap-3 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      <Card>
        <CardBody className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center shrink-0">
            <BellRing className="h-5 w-5 text-accent-600 dark:text-accent-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-primary">
              Alert window: {data ? `${companyWindow} days before the end date` : '—'}
            </div>
            <div className="text-xs text-muted mt-0.5">
              Daily job · next run {data ? dateTime.format(new Date(data.nextRunAt)) : '—'}
              {data?.settings.updatedAt
                ? ` · changed ${formatContractDate(data.settings.updatedAt)}`
                : ' · default setting'}
              . Contracts with a renewal in progress are skipped. The same window drives the “Expiring soon” status.
            </div>
          </div>
          {canConfigure ? (
            <Button variant="secondary" disabled={!data} onClick={openSettings}>
              <Settings2 className="h-4 w-4" /> Change window
            </Button>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summary.map((item) => (
          <div key={item.label} className="rounded-xl border border-base surface px-4 py-3">
            <div className={`text-2xl font-semibold ${item.tone}`}>{loading && !data ? '–' : item.value}</div>
            <div className="text-xs text-secondary mt-0.5">{item.label}</div>
            <div className="text-[11px] text-muted mt-0.5">{item.hint}</div>
          </div>
        ))}
      </div>

      {data && data.overdue.length > 0 ? (
        <Card className="border-error-200 dark:border-error-800/60">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Ended without a renewal</CardTitle>
            <Badge tone="error" dot>
              {data.overdue.length}
            </Badge>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-[rgb(var(--border-base))]">
              {data.overdue.map((item) => (
                <li key={item.contractId} className="flex items-center gap-3 px-5 py-3">
                  <button type="button" className="flex-1 min-w-0 text-left" onClick={() => openContract(item.contractId)}>
                    <div className="text-sm font-medium text-primary truncate">{item.employeeName}</div>
                    <div className="text-xs text-muted truncate">
                      {item.employeeNumber}
                      {item.departmentName ? ` · ${item.departmentName}` : ''} · ended {formatContractDate(item.endDate)} (
                      {relativeDays(item.daysUntil)})
                    </div>
                  </button>
                  {item.renewal ? (
                    <ContractStatusBadge status={item.renewal.displayStatus} />
                  ) : canRenew ? (
                    <Button variant="primary" size="sm" onClick={() => renew(item)}>
                      Renew
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => openContract(item.contractId)} aria-label="Open contract">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <CardTitle>Upcoming expiries</CardTitle>
            <p className="text-xs text-muted mt-0.5">
              Ending in the next {data?.windowDays ?? companyWindow} days
              {viewOverride && viewOverride !== companyWindow ? ` (alert window is ${companyWindow})` : ''}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-1 surface-muted rounded-lg p-0.5" role="group" aria-label="Show contracts ending within">
              <button
                type="button"
                onClick={() => setParam('window', null)}
                aria-pressed={!viewOverride}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${!viewOverride ? 'surface shadow-sm text-primary font-medium' : 'text-muted'}`}
              >
                Alert window
              </button>
              {VIEW_OPTIONS.filter((d) => d > companyWindow).map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setParam('window', String(days))}
                  aria-pressed={viewOverride === days}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${viewOverride === days ? 'surface shadow-sm text-primary font-medium' : 'text-muted'}`}
                >
                  {days}d
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 surface-muted rounded-lg p-0.5" role="group" aria-label="Filter">
              {FOCUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setParam('focus', option.value === 'all' ? null : option.value)}
                  aria-pressed={focus === option.value}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${focus === option.value ? 'surface shadow-sm text-primary font-medium' : 'text-muted'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {loading && !data ? (
            <div className="p-10 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              compact
              icon={CalendarClock}
              title={focus === 'all' ? 'No contracts ending soon' : 'Nothing matches this filter'}
              description={
                focus === 'all'
                  ? `No active contracts end in the next ${data?.windowDays ?? companyWindow} days.`
                  : 'Try another filter or a wider window.'
              }
              action={focus !== 'all' ? { label: 'Show all', onClick: () => setParam('focus', null) } : undefined}
            />
          ) : (
            <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-base">
                    <th className="px-5 py-2.5 font-medium">Employee</th>
                    <th className="px-3 py-2.5 font-medium">Type</th>
                    <th className="px-3 py-2.5 font-medium">Ends</th>
                    <th className="px-3 py-2.5 font-medium">Alert</th>
                    <th className="px-3 py-2.5 font-medium">Renewal</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {visible.map((item) => (
                    <tr
                      key={item.contractId}
                      className="hover:bg-[rgb(var(--bg-hover))] cursor-pointer"
                      onClick={() => openContract(item.contractId)}
                    >
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          className="font-medium text-primary hover:underline text-left"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEmployee(item.employeeId);
                          }}
                        >
                          {item.employeeName}
                        </button>
                        <div className="text-xs text-muted">
                          {item.employeeNumber}
                          {item.departmentName ? ` · ${item.departmentName}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <ContractTypeBadge type={item.contractType} />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-secondary">{formatContractDate(item.endDate)}</div>
                        <Badge tone={item.renewal ? 'neutral' : urgencyTone(item.daysUntil)} className="mt-1">
                          {relativeDays(item.daysUntil)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <AlertCell item={item} windowDays={companyWindow} />
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        {item.renewal ? (
                          <button
                            type="button"
                            className="flex flex-col items-start gap-1 text-left"
                            onClick={() => openContract(item.renewal!.contractId)}
                          >
                            <ContractStatusBadge status={item.renewal.displayStatus} />
                            <span className="text-xs text-muted hover:underline">
                              from {formatContractDate(item.renewal.startDate)}
                            </span>
                          </button>
                        ) : canRenew ? (
                          <Button variant={item.daysUntil <= 7 ? 'primary' : 'secondary'} size="sm" onClick={() => renew(item)}>
                            Renew
                          </Button>
                        ) : (
                          <span className="text-xs text-muted">Not started</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <ChevronRight className="h-4 w-4 text-muted inline" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={settingsOpen}
        onClose={() => !saving && setSettingsOpen(false)}
        title="Contract expiry alert window"
        description="How many days before a contract ends HR should be notified and the contract flagged as expiring soon."
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={saving || windowInvalid} onClick={() => void saveSettings()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {WINDOW_PRESETS.map((days) => (
              <Button
                key={days}
                variant={parsedWindow === days ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setWindowInput(String(days))}
              >
                {days} days
              </Button>
            ))}
          </div>
          <div>
            <Label htmlFor="expiry-window">Days before end date</Label>
            <Input
              id="expiry-window"
              type="number"
              inputMode="numeric"
              min={CONTRACT_EXPIRY_WINDOW_MIN_DAYS}
              max={CONTRACT_EXPIRY_WINDOW_MAX_DAYS}
              value={windowInput}
              onChange={(e) => setWindowInput(e.target.value)}
            />
            <FieldError
              message={
                windowInvalid
                  ? `Enter a whole number between ${CONTRACT_EXPIRY_WINDOW_MIN_DAYS} and ${CONTRACT_EXPIRY_WINDOW_MAX_DAYS}.`
                  : settingsError ?? undefined
              }
            />
          </div>
          <p className="text-xs text-muted">
            Each contract is alerted once. Widening the window alerts newly included contracts at the next run;
            contracts already notified aren't notified again unless their end date changes.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={runOpen}
        tone="primary"
        title="Send due alerts now?"
        description={`${counts.due} contract ${counts.due === 1 ? 'alert is' : 'alerts are'} due. Recipients from your notification settings will be notified now instead of at the next daily run.`}
        confirmLabel="Send alerts"
        onConfirm={async () => {
          const { sent } = await runContractExpiryAlerts(companyId);
          setNotice(sent === 0 ? 'No alerts were due.' : `Sent ${sent} contract expiry ${sent === 1 ? 'alert' : 'alerts'}.`);
          await load();
        }}
        onClose={() => setRunOpen(false)}
      />
    </div>
  );
}

export function ContractExpiryAlertsPage() {
  return (
    <OrgPageState>
      {(companyId) => <ExpiryAlertsContent companyId={companyId} />}
    </OrgPageState>
  );
}
