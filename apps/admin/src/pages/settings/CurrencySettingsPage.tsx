import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  Coins,
  Info,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import {
  COMMON_CURRENCIES,
  addDaysToDateOnly,
  currencyName,
  planNewRateVersion,
  planRateVersionUpdate,
  rateVersionEditability,
  type CompanyPayrollCurrencyView,
  type CurrencySettingsOverview,
  type ExchangeRatePairSummary,
  type ExchangeRateRecord,
  type ResolvedExchangeRate,
} from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Label, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  PAIR_STATUS_DISPLAY,
  RATE_INPUT_PATTERN,
  formatDateOnly,
  formatPercent,
  formatPeriod,
  formatRateValue,
  invertForStorage,
  inverseRate,
  percentChange,
} from '@/lib/currency-display';
import {
  createExchangeRate,
  deleteExchangeRate,
  getCurrencyOverview,
  resolveExchangeRate,
  updateCompanyPayrollCurrency,
  updateExchangeRate,
} from '@/lib/exchange-rates-api';
import { ApiError } from '@/lib/tenant-api-client';

type RateForm =
  | { mode: 'create'; baseCurrency?: string; quoteCurrency?: string }
  | { mode: 'edit'; rate: ExchangeRateRecord };

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

const pairKey = (base: string, quote: string) => `${base}/${quote}`;
const OTHER_CURRENCY = '__other__';

export function CurrencySettingsPage() {
  const { can } = usePermissions();
  const canEdit = can('settings', 'edit');

  const [overview, setOverview] = useState<CurrencySettingsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [rateForm, setRateForm] = useState<RateForm | null>(null);
  const [baseForm, setBaseForm] = useState<CompanyPayrollCurrencyView | null>(null);
  const [deleting, setDeleting] = useState<ExchangeRateRecord | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getCurrencyOverview();
      setOverview(data);
      setSelectedKey((current) => {
        if (current && data.pairs.some((p) => pairKey(p.baseCurrency, p.quoteCurrency) === current)) {
          return current;
        }
        const first = data.pairs[0];
        return first ? pairKey(first.baseCurrency, first.quoteCurrency) : null;
      });
    } catch (err) {
      setError(errorMessage(err, 'Could not load currency settings'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedPair = useMemo(
    () =>
      overview?.pairs.find((p) => pairKey(p.baseCurrency, p.quoteCurrency) === selectedKey) ?? null,
    [overview, selectedKey],
  );
  const pairRates = useCallback(
    (base: string, quote: string) =>
      (overview?.rates ?? [])
        .filter((r) => r.baseCurrency === base && r.quoteCurrency === quote)
        .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)),
    [overview],
  );
  const lockedThroughFor = useCallback(
    (base: string, quote: string) =>
      overview?.pairs.find((p) => p.baseCurrency === base && p.quoteCurrency === quote)?.lockedThrough ??
      null,
    [overview],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading currency settings…
      </div>
    );
  }

  const attention = (overview?.pairs ?? []).filter(
    (p) => p.status === 'missing' || p.status === 'ending_soon',
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-primary">Currency &amp; Exchange Rates</h1>
          <p className="mt-0.5 text-sm text-secondary">
            Set the currency each company runs payroll in and the exchange rates used to convert pay for employees
            contracted in another currency.
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
          {canEdit ? (
            <Button
              onClick={() =>
                setRateForm({
                  mode: 'create',
                  baseCurrency: selectedPair?.baseCurrency,
                  quoteCurrency: selectedPair?.quoteCurrency,
                })
              }
            >
              <Plus className="h-4 w-4" /> Add rate
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

      <section className="flex gap-3 rounded-xl border border-accent-200 bg-accent-50/60 p-4 text-sm dark:border-accent-900 dark:bg-accent-950/20">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent-600 dark:text-accent-400" />
        <div className="space-y-1 text-secondary">
          <p className="font-medium text-primary">How rates are locked</p>
          <p>
            Each payroll run uses the rate in force on its period end date and stores that rate with the run. Once
            payroll for a currency pair is finalized, every rate on or before that date is locked: it can’t be
            changed or deleted, so past payslips always match the rate history. To change a rate, add a new version
            that starts after the locked date. The previous rate ends automatically the day before.
          </p>
        </div>
      </section>

      {attention.length > 0 ? (
        <section className="space-y-2">
          {attention.map((pair) => (
            <div
              key={pairKey(pair.baseCurrency, pair.quoteCurrency)}
              className={`flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
                pair.status === 'missing'
                  ? 'border-error-200 bg-error-50 text-error-800 dark:border-error-900 dark:bg-error-950/30 dark:text-error-200'
                  : 'border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-900 dark:bg-warning-950/30 dark:text-warning-200'
              }`}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  <span className="font-semibold">
                    {pair.quoteCurrency} → {pair.baseCurrency}:
                  </span>{' '}
                  {pair.status === 'missing'
                    ? `${pair.employeesPaid} employee${pair.employeesPaid === 1 ? ' is' : 's are'} paid in ${pair.quoteCurrency} at ${pair.companyNames.join(', ')}, but no rate is in force today. Calculating their payroll will fail until a rate is added.`
                    : `The current rate ends on ${formatDateOnly(pair.current?.effectiveTo)} and no later rate is set. Payroll periods ending after that date can’t be calculated.`}
                </p>
              </div>
              {canEdit ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0"
                  onClick={() =>
                    setRateForm({
                      mode: 'create',
                      baseCurrency: pair.baseCurrency,
                      quoteCurrency: pair.quoteCurrency,
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" /> Add rate
                </Button>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      <section className="surface rounded-xl border border-base shadow-card">
        <div className="flex items-center gap-2 border-b border-base px-5 py-3">
          <Building2 className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-primary">Payroll base currencies</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-base text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-2.5 font-medium">Company</th>
                <th className="px-5 py-2.5 font-medium">Country currency</th>
                <th className="px-5 py-2.5 font-medium">Payroll base currency</th>
                {canEdit ? <th className="px-5 py-2.5" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border-base))]">
              {(overview?.companies ?? []).map((company) => (
                <tr key={company.companyId}>
                  <td className="px-5 py-3 font-medium text-primary">{company.companyName}</td>
                  <td className="px-5 py-3 text-secondary">
                    <CurrencyCode code={company.countryCurrency} />
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-2">
                      <CurrencyCode code={company.payrollBaseCurrency} strong />
                      {company.overridden ? (
                        <StatusPill tone="accent">Override</StatusPill>
                      ) : (
                        <span className="text-xs text-muted">country default</span>
                      )}
                    </span>
                  </td>
                  {canEdit ? (
                    <td className="px-5 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setBaseForm(company)}>
                        <Pencil className="h-3.5 w-3.5" /> Change
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <div className="surface flex flex-col rounded-xl border border-base shadow-card">
          <div className="flex items-center gap-2 border-b border-base px-4 py-3">
            <Coins className="h-4 w-4 text-muted" />
            <h2 className="text-sm font-semibold text-primary">Currency pairs</h2>
          </div>
          {overview && overview.pairs.length > 0 ? (
            <ul className="divide-y divide-[rgb(var(--border-base))]">
              {overview.pairs.map((pair) => {
                const key = pairKey(pair.baseCurrency, pair.quoteCurrency);
                const status = PAIR_STATUS_DISPLAY[pair.status];
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      className={`w-full px-4 py-3 text-left transition-colors ${
                        key === selectedKey
                          ? 'bg-accent-50/70 dark:bg-accent-950/30'
                          : 'hover:bg-[rgb(var(--bg-hover))]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-primary">
                          {pair.quoteCurrency}
                          <ArrowRight className="h-3.5 w-3.5 text-muted" />
                          {pair.baseCurrency}
                        </span>
                        <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      </div>
                      <p className="mt-1 text-sm text-secondary">
                        {pair.current
                          ? `1 ${pair.quoteCurrency} = ${formatRateValue(pair.current.rate)} ${pair.baseCurrency}`
                          : 'No rate in force today'}
                      </p>
                      <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
                        <span>
                          {pair.employeesPaid} employee{pair.employeesPaid === 1 ? '' : 's'}
                        </span>
                        <span>·</span>
                        <span>
                          {pair.versionCount} version{pair.versionCount === 1 ? '' : 's'}
                        </span>
                        {pair.lockedThrough ? (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <Lock className="h-3 w-3" /> locked to {formatDateOnly(pair.lockedThrough)}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <Coins className="h-8 w-8 text-muted" />
              <p className="text-sm text-secondary">
                Every employee is paid in their company’s base currency, so no exchange rates are needed yet.
              </p>
            </div>
          )}
        </div>

        <div className="min-w-0">
          {selectedPair ? (
            <PairDetail
              pair={selectedPair}
              rates={pairRates(selectedPair.baseCurrency, selectedPair.quoteCurrency)}
              canEdit={canEdit}
              today={overview?.today ?? ''}
              onAdd={() =>
                setRateForm({
                  mode: 'create',
                  baseCurrency: selectedPair.baseCurrency,
                  quoteCurrency: selectedPair.quoteCurrency,
                })
              }
              onEdit={(rate) => setRateForm({ mode: 'edit', rate })}
              onDelete={setDeleting}
            />
          ) : (
            <div className="surface flex h-full min-h-[240px] items-center justify-center rounded-xl border border-dashed border-base p-8 text-sm text-secondary">
              Select a currency pair to see its rate history.
            </div>
          )}
        </div>
      </section>

      {rateForm && overview ? (
        <RateFormModal
          form={rateForm}
          overview={overview}
          pairRates={pairRates}
          lockedThroughFor={lockedThroughFor}
          onClose={() => setRateForm(null)}
          onSaved={(record, message) => {
            setRateForm(null);
            setNotice(message);
            setSelectedKey(pairKey(record.baseCurrency, record.quoteCurrency));
            void load();
          }}
        />
      ) : null}

      {baseForm ? (
        <BaseCurrencyModal
          company={baseForm}
          onClose={() => setBaseForm(null)}
          onSaved={(view) => {
            setBaseForm(null);
            setNotice(
              `${view.companyName} now runs payroll in ${view.payrollBaseCurrency}. Finalized payroll keeps the currency it was calculated in.`,
            );
            void load();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this rate?"
        description={
          deleting ? (
            <div className="space-y-2">
              <p>
                1 {deleting.quoteCurrency} = {formatRateValue(deleting.rate)} {deleting.baseCurrency},{' '}
                {formatPeriod(deleting.effectiveFrom, deleting.effectiveTo)}, will be removed. Payroll periods ending
                in that range will have no rate until you add one.
              </p>
              {deleting.usage?.unlockedRuns ? (
                <p className="text-warning-700 dark:text-warning-300">
                  {deleting.usage.unlockedRuns} draft or calculated payroll run
                  {deleting.usage.unlockedRuns === 1 ? '' : 's'} used this rate. They keep it until recalculated.
                </p>
              ) : null}
            </div>
          ) : null
        }
        confirmLabel="Delete rate"
        onConfirm={async () => {
          if (!deleting) return;
          await deleteExchangeRate(deleting.id);
          setNotice(
            `Rate for ${deleting.quoteCurrency} → ${deleting.baseCurrency} from ${formatDateOnly(deleting.effectiveFrom)} was deleted.`,
          );
          await load();
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function CurrencyCode({ code, strong = false }: { code: string; strong?: boolean }) {
  const name = currencyName(code);
  return (
    <span title={name ?? undefined}>
      <span className={`font-mono ${strong ? 'font-semibold text-primary' : ''}`}>{code}</span>
      {name ? <span className="ml-1.5 text-xs text-muted">{name}</span> : null}
    </span>
  );
}

function PairDetail({
  pair,
  rates,
  canEdit,
  today,
  onAdd,
  onEdit,
  onDelete,
}: {
  pair: ExchangeRatePairSummary;
  rates: ExchangeRateRecord[];
  canEdit: boolean;
  today: string;
  onAdd: () => void;
  onEdit: (rate: ExchangeRateRecord) => void;
  onDelete: (rate: ExchangeRateRecord) => void;
}) {
  const { baseCurrency: base, quoteCurrency: quote } = pair;
  const [lookupDate, setLookupDate] = useState(today);
  const [lookup, setLookup] = useState<{ result: ResolvedExchangeRate | null; error: string | null } | null>(null);
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    setLookup(null);
    setLookupDate(today);
  }, [base, quote, today]);

  const runLookup = async () => {
    if (!lookupDate) return;
    setLooking(true);
    try {
      setLookup({ result: await resolveExchangeRate(base, quote, lookupDate), error: null });
    } catch (err) {
      setLookup({ result: null, error: errorMessage(err, 'Could not look up the rate') });
    } finally {
      setLooking(false);
    }
  };

  const chronological = [...rates].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const previousOf = (rate: ExchangeRateRecord) => {
    const index = chronological.findIndex((r) => r.id === rate.id);
    return index > 0 ? chronological[index - 1] : null;
  };

  return (
    <div className="surface rounded-xl border border-base shadow-card">
      <div className="flex flex-col gap-4 border-b border-base p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted">
            {currencyName(quote) ?? quote} → {currencyName(base) ?? base}
          </p>
          {pair.current ? (
            <>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-primary">
                1 {quote} = {formatRateValue(pair.current.rate)} {base}
              </p>
              <p className="mt-0.5 text-sm text-secondary">
                1 {base} = {inverseRate(pair.current.rate)} {quote} · in force{' '}
                {formatPeriod(pair.current.effectiveFrom, pair.current.effectiveTo)}
              </p>
            </>
          ) : (
            <p className="mt-1 text-lg font-semibold text-error-700 dark:text-error-300">No rate in force today</p>
          )}
          {pair.next ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-accent-50 px-2 py-1 text-xs text-accent-700 dark:bg-accent-950/40 dark:text-accent-300">
              <CalendarClock className="h-3.5 w-3.5" />
              Changes to {formatRateValue(pair.next.rate)} {base} on {formatDateOnly(pair.next.effectiveFrom)}
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <Button size="sm" onClick={onAdd} className="shrink-0">
            <Plus className="h-3.5 w-3.5" /> New rate version
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 border-b border-base p-5 md:grid-cols-2">
        <div className="flex items-start gap-2 text-sm">
          <Lock className={`mt-0.5 h-4 w-4 shrink-0 ${pair.lockedThrough ? 'text-accent-600' : 'text-muted'}`} />
          <p className="text-secondary">
            {pair.lockedThrough ? (
              <>
                Payroll is finalized through{' '}
                <span className="font-medium text-primary">{formatDateOnly(pair.lockedThrough)}</span>. Rates on or
                before that date are locked; new rates can start from{' '}
                {formatDateOnly(addDaysToDateOnly(pair.lockedThrough, 1))}.
              </>
            ) : (
              'No finalized payroll has used this pair yet, so every version can still be edited.'
            )}
          </p>
        </div>
        <div>
          <Label htmlFor="fx-lookup">Rate payroll would use on</Label>
          <div className="flex gap-2">
            <Input
              id="fx-lookup"
              type="date"
              value={lookupDate}
              onChange={(e) => {
                setLookupDate(e.target.value);
                setLookup(null);
              }}
            />
            <Button variant="secondary" onClick={() => void runLookup()} disabled={looking || !lookupDate}>
              <Search className="h-4 w-4" /> Check
            </Button>
          </div>
          {lookup ? (
            <p className={`mt-1.5 text-xs ${lookup.error ? 'text-error-600' : 'text-secondary'}`}>
              {lookup.result
                ? `1 ${quote} = ${formatRateValue(lookup.result.rate)} ${base} (version ${formatPeriod(
                    lookup.result.effectiveFrom ?? '',
                    lookup.result.effectiveTo,
                  )})`
                : lookup.error}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted">Use a payroll period end date.</p>
          )}
        </div>
      </div>

      {rates.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-secondary">
          <Info className="h-6 w-6 text-muted" />
          No rates yet for this pair.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-base text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-2.5 font-medium">Effective</th>
                <th className="px-5 py-2.5 font-medium">Rate</th>
                <th className="px-5 py-2.5 font-medium">Change</th>
                <th className="px-5 py-2.5 font-medium">Payroll usage</th>
                {canEdit ? <th className="px-5 py-2.5" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border-base))]">
              {rates.map((rate) => {
                const previous = previousOf(rate);
                const change = previous ? percentChange(previous.rate, rate.rate) : null;
                const editable = rateVersionEditability(rate, pair.lockedThrough);
                const isCurrent = pair.current?.id === rate.id;
                const isFuture = rate.effectiveFrom > today;
                const fullyLocked = !editable.rate && !editable.effectiveTo;
                return (
                  <tr key={rate.id} className={isCurrent ? 'bg-success-50/40 dark:bg-success-950/10' : ''}>
                    <td className="whitespace-nowrap px-5 py-3">
                      <p className="text-primary">{formatPeriod(rate.effectiveFrom, rate.effectiveTo)}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        {isCurrent ? <StatusPill tone="success">Current</StatusPill> : null}
                        {isFuture ? <StatusPill tone="accent">Scheduled</StatusPill> : null}
                        {rate.createdByName ? <span>by {rate.createdByName}</span> : null}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <p className="font-mono font-semibold tabular-nums text-primary">{rate.rate}</p>
                      <p className="text-xs text-muted">
                        1 {base} = {inverseRate(rate.rate)} {quote}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums">
                      {change === null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span
                          className={
                            change > 0
                              ? 'text-success-700 dark:text-success-300'
                              : change < 0
                                ? 'text-error-700 dark:text-error-300'
                                : 'text-secondary'
                          }
                        >
                          {formatPercent(change)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {rate.usage?.lockedRuns ? (
                        <p className="inline-flex items-center gap-1 text-primary">
                          <Lock className="h-3 w-3 text-accent-600" />
                          {rate.usage.lockedRuns} finalized run{rate.usage.lockedRuns === 1 ? '' : 's'}
                          {rate.usage.lastLockedDate ? ` · to ${formatDateOnly(rate.usage.lastLockedDate)}` : ''}
                        </p>
                      ) : null}
                      {rate.usage?.unlockedRuns ? (
                        <p className="text-warning-700 dark:text-warning-300">
                          {rate.usage.unlockedRuns} draft run{rate.usage.unlockedRuns === 1 ? '' : 's'}
                        </p>
                      ) : null}
                      {!rate.usage?.lockedRuns && !rate.usage?.unlockedRuns ? (
                        <span className="text-muted">Not used yet</span>
                      ) : null}
                    </td>
                    {canEdit ? (
                      <td className="whitespace-nowrap px-5 py-3">
                        <div className="flex justify-end gap-1">
                          {fullyLocked ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 text-xs text-muted"
                              title="In force on finalized payroll dates. Part of the payroll history."
                            >
                              <Lock className="h-3.5 w-3.5" /> Locked
                            </span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(rate)}
                              title={
                                editable.rate
                                  ? undefined
                                  : 'Locked by finalized payroll: only the end date can change'
                              }
                            >
                              {editable.rate ? <Pencil className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                              {editable.rate ? 'Edit' : 'End date'}
                            </Button>
                          )}
                          {editable.delete ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-error-600 hover:text-error-700"
                              onClick={() => onDelete(rate)}
                              aria-label={`Delete rate from ${rate.effectiveFrom}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RateFormModal({
  form,
  overview,
  pairRates,
  lockedThroughFor,
  onClose,
  onSaved,
}: {
  form: RateForm;
  overview: CurrencySettingsOverview;
  pairRates: (base: string, quote: string) => ExchangeRateRecord[];
  lockedThroughFor: (base: string, quote: string) => string | null;
  onClose: () => void;
  onSaved: (record: ExchangeRateRecord, message: string) => void;
}) {
  const editing = form.mode === 'edit' ? form.rate : null;
  const baseOptions = useMemo(() => {
    const codes = new Set(overview.companies.map((c) => c.payrollBaseCurrency));
    overview.pairs.forEach((p) => codes.add(p.baseCurrency));
    return [...codes].sort();
  }, [overview]);

  const [base, setBase] = useState(
    editing?.baseCurrency ?? (form.mode === 'create' ? form.baseCurrency : undefined) ?? baseOptions[0] ?? 'AUD',
  );
  const [quote, setQuote] = useState(
    editing?.quoteCurrency ?? (form.mode === 'create' ? form.quoteCurrency : undefined) ?? '',
  );
  const quoteOptions = useMemo(() => {
    const needed = [
      ...new Set(overview.pairs.filter((p) => p.baseCurrency === base).map((p) => p.quoteCurrency)),
    ].sort();
    const common = COMMON_CURRENCIES.map((c) => c.code).filter((code) => code !== base && !needed.includes(code));
    return { needed, common };
  }, [overview.pairs, base]);
  const [customQuote, setCustomQuote] = useState(
    () => !!quote && !quoteOptions.needed.includes(quote) && !quoteOptions.common.includes(quote),
  );
  const [direction, setDirection] = useState<'quote-to-base' | 'base-to-quote'>('quote-to-base');
  const [rateInput, setRateInput] = useState(editing?.rate ?? '');
  const lockedThrough = lockedThroughFor(base, quote.toUpperCase());
  const defaultFrom = useMemo(() => {
    const earliest = lockedThrough ? addDaysToDateOnly(lockedThrough, 1) : overview.today;
    return earliest > overview.today ? earliest : overview.today;
  }, [lockedThrough, overview.today]);
  const [effectiveFrom, setEffectiveFrom] = useState(editing?.effectiveFrom ?? defaultFrom);
  const [effectiveTo, setEffectiveTo] = useState(editing?.effectiveTo ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing && lockedThrough && effectiveFrom <= lockedThrough) setEffectiveFrom(defaultFrom);
  }, [editing, lockedThrough, effectiveFrom, defaultFrom]);

  const quoteCode = quote.trim().toUpperCase();
  const validPair = /^[A-Z]{3}$/.test(quoteCode) && quoteCode !== base;
  const versions = useMemo(
    () => (validPair ? pairRates(base, quoteCode) : []),
    [validPair, pairRates, base, quoteCode],
  );
  const editable = editing ? rateVersionEditability(editing, lockedThrough) : null;

  const storedRate =
    direction === 'quote-to-base' ? rateInput.trim() : invertForStorage(rateInput.trim());
  const rateValid = RATE_INPUT_PATTERN.test(rateInput.trim()) && Number(rateInput) > 0;

  const plan = useMemo(() => {
    if (!validPair || !effectiveFrom) return null;
    const periods = versions.map((v) => ({
      id: v.id,
      effectiveFrom: v.effectiveFrom,
      effectiveTo: v.effectiveTo,
    }));
    if (editing) {
      return planRateVersionUpdate(
        { id: editing.id, effectiveFrom: editing.effectiveFrom, effectiveTo: editing.effectiveTo },
        periods,
        {
          rateChanged: rateValid && Number(storedRate) !== Number(editing.rate),
          effectiveFrom,
          effectiveTo: effectiveTo || null,
        },
        lockedThrough,
      );
    }
    return planNewRateVersion(periods, { effectiveFrom, effectiveTo: effectiveTo || null }, lockedThrough);
  }, [validPair, effectiveFrom, effectiveTo, versions, editing, rateValid, storedRate, lockedThrough]);

  const reference = useMemo(() => {
    if (!validPair) return null;
    const others = versions.filter((v) => v.id !== editing?.id);
    return (
      others.find(
        (v) => v.effectiveFrom <= effectiveFrom && (v.effectiveTo === null || v.effectiveTo >= effectiveFrom),
      ) ??
      others[0] ??
      null
    );
  }, [validPair, versions, editing, effectiveFrom]);
  const bigMove =
    reference && rateValid && storedRate ? percentChange(reference.rate, storedRate) : null;

  const closing =
    plan && plan.ok && 'closePrevious' in plan.value && plan.value.closePrevious
      ? versions.find((v) => v.id === (plan.value as { closePrevious: { id: string } }).closePrevious.id)
      : null;

  const submit = async () => {
    if (!validPair) {
      setError('Choose a pay currency different from the payroll base currency');
      return;
    }
    if (!rateValid || !storedRate) {
      setError('Enter a positive rate with up to 8 decimal places');
      return;
    }
    if (plan && !plan.ok) {
      setError(plan.message);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const record = await updateExchangeRate(editing.id, {
          ...(editable?.rate ? { rate: storedRate } : {}),
          ...(editable?.effectiveFrom ? { effectiveFrom } : {}),
          ...(editable?.effectiveTo ? { effectiveTo: effectiveTo || null } : {}),
        });
        onSaved(record, `Rate for ${quoteCode} → ${base} updated.`);
      } else {
        const record = await createExchangeRate({
          baseCurrency: base,
          quoteCurrency: quoteCode,
          rate: storedRate,
          effectiveFrom,
          effectiveTo: effectiveTo || null,
        });
        onSaved(
          record,
          closing
            ? `New ${quoteCode} → ${base} rate from ${formatDateOnly(effectiveFrom)} added. The previous rate now ends on ${formatDateOnly(addDaysToDateOnly(effectiveFrom, -1))}.`
            : `New ${quoteCode} → ${base} rate from ${formatDateOnly(effectiveFrom)} added.`,
        );
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not save the rate'));
    } finally {
      setSaving(false);
    }
  };

  const rateLocked = editable ? !editable.rate : false;

  return (
    <Modal
      open
      onClose={saving ? () => undefined : onClose}
      title={editing ? (rateLocked ? 'Change end date' : 'Edit rate') : 'Add exchange rate'}
      description={
        editing
          ? `${editing.quoteCurrency} → ${editing.baseCurrency} · ${formatPeriod(editing.effectiveFrom, editing.effectiveTo)}`
          : 'Rates are versioned by date. Payroll uses the version in force on each period end date.'
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving || (plan !== null && !plan.ok)}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add rate'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700 dark:bg-error-950/30 dark:text-error-300">
            {error}
          </div>
        ) : null}

        {rateLocked ? (
          <div className="flex gap-2 rounded-lg border border-accent-200 bg-accent-50/60 px-3 py-2 text-sm text-secondary dark:border-accent-900 dark:bg-accent-950/20">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />
            <p>
              Finalized payroll used this rate through {formatDateOnly(lockedThrough)}, so the rate and start date
              are locked. You can still set or move the end date, as long as it’s on or after that date.
            </p>
          </div>
        ) : null}

        {!editing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="fx-quote">Pay currency (converting from)</Label>
              <Select
                id="fx-quote"
                value={customQuote ? OTHER_CURRENCY : quote}
                onChange={(e) => {
                  const next = e.target.value;
                  setCustomQuote(next === OTHER_CURRENCY);
                  setQuote(next === OTHER_CURRENCY ? '' : next);
                }}
                autoFocus={!quote}
              >
                <option value="">Select currency…</option>
                {quoteOptions.needed.length > 0 ? (
                  <optgroup label="Already set up">
                    {quoteOptions.needed.map((code) => (
                      <option key={code} value={code}>
                        {code}
                        {currencyName(code) ? ` · ${currencyName(code)}` : ''}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                <optgroup label="Other currencies">
                  {quoteOptions.common.map((code) => (
                    <option key={code} value={code}>
                      {code} · {currencyName(code)}
                    </option>
                  ))}
                  <option value={OTHER_CURRENCY}>Other (enter ISO code)…</option>
                </optgroup>
              </Select>
              {customQuote ? (
                <Input
                  className="mt-2"
                  aria-label="Currency code"
                  value={quote}
                  maxLength={3}
                  onChange={(e) => setQuote(e.target.value.replace(/[^a-z]/gi, '').toUpperCase())}
                  placeholder="3-letter ISO code, e.g. NPR"
                  autoFocus
                />
              ) : null}
            </div>
            <div>
              <Label htmlFor="fx-base">Payroll base currency (converting to)</Label>
              <Select
                id="fx-base"
                value={base}
                onChange={(e) => {
                  setBase(e.target.value);
                  if (quote === e.target.value) {
                    setQuote('');
                    setCustomQuote(false);
                  }
                }}
              >
                {baseOptions.map((code) => (
                  <option key={code} value={code}>
                    {code}
                    {currencyName(code) ? ` · ${currencyName(code)}` : ''}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        ) : null}

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="fx-rate">Rate</Label>
            {!rateLocked && validPair ? (
              <div className="inline-flex rounded-lg border border-base p-0.5">
                {(
                  [
                    { id: 'quote-to-base', label: `1 ${quoteCode} = ? ${base}` },
                    { id: 'base-to-quote', label: `1 ${base} = ? ${quoteCode}` },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      if (option.id !== direction && rateValid) {
                        setRateInput(invertForStorage(rateInput.trim()));
                      }
                      setDirection(option.id);
                    }}
                    className={`rounded-md px-2.5 py-1 font-mono text-xs transition-colors ${
                      direction === option.id
                        ? 'bg-accent-600 text-white shadow-sm'
                        : 'text-secondary hover:bg-[rgb(var(--bg-hover))]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap font-mono text-sm text-secondary">
              1 {direction === 'quote-to-base' ? quoteCode || '???' : base} =
            </span>
            <Input
              id="fx-rate"
              inputMode="decimal"
              value={rateInput}
              disabled={rateLocked}
              onChange={(e) => setRateInput(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="0.00"
              className="font-mono"
            />
            <span className="whitespace-nowrap font-mono text-sm text-secondary">
              {direction === 'quote-to-base' ? base : quoteCode || '???'}
            </span>
          </div>
          {rateValid && validPair ? (
            <p className="mt-1.5 text-xs text-muted">
              Saved as 1 {quoteCode} = <span className="font-mono">{storedRate}</span> {base} · 1 {base} ={' '}
              {inverseRate(storedRate)} {quoteCode}
            </p>
          ) : null}
          {bigMove !== null && Math.abs(bigMove) >= 20 && !rateLocked ? (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-warning-700 dark:text-warning-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              {formatPercent(bigMove)} compared with {formatRateValue(reference!.rate)}{' '}
              ({formatPeriod(reference!.effectiveFrom, reference!.effectiveTo)}). Check the direction.
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="fx-from">Effective from</Label>
            <Input
              id="fx-from"
              type="date"
              value={effectiveFrom}
              min={lockedThrough ? addDaysToDateOnly(lockedThrough, 1) : undefined}
              disabled={editable ? !editable.effectiveFrom : false}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="fx-to">Effective to (optional)</Label>
            <Input
              id="fx-to"
              type="date"
              value={effectiveTo}
              min={editable?.minEffectiveTo ?? effectiveFrom}
              disabled={editable ? !editable.effectiveTo : false}
              onChange={(e) => setEffectiveTo(e.target.value)}
            />
          </div>
        </div>

        {validPair && plan ? (
          plan.ok ? (
            <div className="space-y-1 rounded-lg border border-base bg-[rgb(var(--bg-muted))]/30 px-3 py-2 text-xs text-secondary">
              <p>
                Payroll periods ending {formatPeriod(effectiveFrom, plan.value.effectiveTo)} will
                convert {quoteCode} pay at this rate.
              </p>
              {closing ? (
                <p>
                  The rate starting {formatDateOnly(closing.effectiveFrom)} ({formatRateValue(closing.rate)}{' '}
                  {base}) will end on {formatDateOnly(addDaysToDateOnly(effectiveFrom, -1))}.
                </p>
              ) : null}
              {!editing && !effectiveTo && plan.value.effectiveTo ? (
                <p>It ends on {formatDateOnly(plan.value.effectiveTo)}, the day before the next version starts.</p>
              ) : null}
              {editing?.usage?.unlockedRuns ? (
                <p className="text-warning-700 dark:text-warning-300">
                  {editing.usage.unlockedRuns} draft or calculated payroll run
                  {editing.usage.unlockedRuns === 1 ? '' : 's'} stored this rate. Recalculate them to apply the
                  change.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex gap-2 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-xs text-error-700 dark:border-error-900 dark:bg-error-950/30 dark:text-error-300">
              {plan.code === 'RATE_PERIOD_LOCKED' ? (
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              <p>{plan.message}</p>
            </div>
          )
        ) : null}
      </div>
    </Modal>
  );
}

function BaseCurrencyModal({
  company,
  onClose,
  onSaved,
}: {
  company: CompanyPayrollCurrencyView;
  onClose: () => void;
  onSaved: (view: CompanyPayrollCurrencyView) => void;
}) {
  const [value, setValue] = useState(company.overridden ? company.payrollBaseCurrency : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resulting = value || company.countryCurrency;
  const unchanged = resulting === company.payrollBaseCurrency;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await updateCompanyPayrollCurrency(company.companyId, value || null));
    } catch (err) {
      setError(errorMessage(err, 'Could not change the base currency'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={saving ? () => undefined : onClose}
      title={`Payroll base currency · ${company.companyName}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || unchanged}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? (
          <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700 dark:bg-error-950/30 dark:text-error-300">
            {error}
          </div>
        ) : null}
        <div>
          <Label htmlFor="base-currency">Base currency</Label>
          <Select id="base-currency" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">
              Country default · {company.countryCurrency}
              {currencyName(company.countryCurrency) ? ` (${currencyName(company.countryCurrency)})` : ''}
            </option>
            {COMMON_CURRENCIES.filter((c) => c.code !== company.countryCurrency).map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-secondary">
          Payroll totals, payment batches and GL exports for this company are reported in the base currency.
          Employees contracted in any other currency need an exchange rate into {resulting}. The change applies to
          payroll calculated from now on; finalized runs keep the currency and rate they were calculated with.
        </p>
      </div>
    </Modal>
  );
}
