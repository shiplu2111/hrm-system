import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Check,
  FileSignature,
  Flag,
  Globe2,
  Info,
  Loader2,
  Lock,
  MapPin,
  RotateCcw,
  Users,
} from 'lucide-react';
import type {
  RuleLayer,
  SuperannuationFieldTrace,
  SuperannuationRuleVersion,
  SuperannuationSettingsRecord,
} from '@hrm/shared-types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { formatDate, todayIso } from '@/lib/payroll-copy';
import { getSuperannuationSettings } from '@/lib/superannuation-api';
import {
  FIELD_LABELS,
  FIELD_ORDER,
  LAYER_LABELS,
  TIMING_LABELS,
  TIMING_TONE,
  exampleContributions,
  formatFieldValue,
  formatSettingValue,
  isCompanyLevelOverride,
  sourceLabel,
  summarizeValues,
} from '@/lib/superannuation-display';
import { ApiError } from '@/lib/tenant-api-client';

const thClass = 'text-left px-4 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const LAYER_ICONS: Record<RuleLayer, typeof Globe2> = {
  global: Globe2,
  country: Flag,
  state: MapPin,
  company: Building2,
  employee_contract: FileSignature,
};

/** Company-level layers shown as columns; state and contract rules only apply per employee. */
const COMPANY_COLUMNS: RuleLayer[] = ['global', 'country', 'company'];

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function dateRange(from: string | null, to: string | null): string {
  if (!from) return '—';
  return to ? `${formatDate(from)} – ${formatDate(to)}` : `From ${formatDate(from)}`;
}

function SourceBadge({ trace }: { trace: SuperannuationFieldTrace }) {
  const override = isCompanyLevelOverride(trace.source);
  const tone = override ? 'accent' : trace.source === 'system_default' ? 'warning' : 'neutral';
  return (
    <Badge tone={tone} dot>
      {sourceLabel(trace)}
    </Badge>
  );
}

function RateTile({ trace }: { trace: SuperannuationFieldTrace }) {
  return (
    <div className="surface rounded-xl border border-base shadow-card p-4 min-w-0">
      <div className="text-sm text-secondary">{FIELD_LABELS[trace.field]}</div>
      <div
        className={`mt-1 font-bold text-primary ${
          trace.field === 'schemeName' ? 'text-lg leading-snug line-clamp-2 min-h-8' : 'text-2xl truncate'
        }`}
        title={String(trace.value)}
      >
        {formatFieldValue(trace.field, trace.value)}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <SourceBadge trace={trace} />
        {trace.inheritedValue != null && trace.inheritedSource ? (
          <span className="text-xs text-muted">
            replaces {formatFieldValue(trace.field, trace.inheritedValue)} from{' '}
            {LAYER_LABELS[trace.inheritedSource as RuleLayer].toLowerCase()}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function FieldMatrix({ settings }: { settings: SuperannuationSettingsRecord }) {
  const columnTitle = (layer: RuleLayer) =>
    layer === 'country' ? settings.country.name : layer === 'company' ? settings.company.name : 'All countries';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Where each setting comes from</CardTitle>
        <p className="mt-0.5 text-xs text-secondary">
          Each layer only overrides the settings it defines. Struck-through values are replaced by a later layer.
        </p>
      </CardHeader>
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                <th className={thClass}>Setting</th>
                {COMPANY_COLUMNS.map((layer) => (
                  <th key={layer} className={thClass}>
                    <span className="block normal-case tracking-normal text-[11px] font-normal text-muted">
                      {LAYER_LABELS[layer]}
                    </span>
                    <span className="block max-w-[12rem] truncate" title={columnTitle(layer)}>
                      {columnTitle(layer)}
                    </span>
                  </th>
                ))}
                <th className={`${thClass} min-w-[17rem]`}>Payroll uses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border-base))]">
              {FIELD_ORDER.map((field) => {
                const trace = settings.fields.find((f) => f.field === field);
                if (!trace) return null;
                return (
                  <tr key={field}>
                    <td className="px-4 py-3 font-medium text-primary whitespace-nowrap">{FIELD_LABELS[field]}</td>
                    {COMPANY_COLUMNS.map((layer) => {
                      const value = trace.layerValues[layer];
                      if (value == null) {
                        return (
                          <td key={layer} className="px-4 py-3 text-muted">
                            —
                          </td>
                        );
                      }
                      const wins = trace.source === layer;
                      return (
                        <td key={layer} className="px-4 py-3 whitespace-nowrap">
                          {wins ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-primary">
                              <Check className="h-3.5 w-3.5 text-success-600" aria-hidden />
                              {formatFieldValue(field, value)}
                            </span>
                          ) : (
                            <span
                              className="text-muted line-through"
                              title={`Not used — ${sourceLabel(trace).toLowerCase()} applies`}
                            >
                              {formatFieldValue(field, value)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-primary whitespace-nowrap">
                          {formatFieldValue(field, trace.value)}
                        </span>
                        <SourceBadge trace={trace} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

function ResolutionChain({ settings }: { settings: SuperannuationSettingsRecord }) {
  const fieldsBy = (layer: RuleLayer) =>
    FIELD_ORDER.filter((field) => settings.fields.find((f) => f.field === field)?.layerValues[layer] != null);

  const contractCount = settings.employeeExceptions.filter((e) => e.appliedLayers.includes('employee_contract')).length;

  const describe = (layer: RuleLayer): { title: string; detail: string; active: boolean } => {
    const summary = settings.layers.find((l) => l.layer === layer);
    if (layer === 'state') {
      const count = settings.stateRules.length;
      return {
        title: LAYER_LABELS.state,
        detail: count
          ? `Applies per employee — ${count} state ${count === 1 ? 'rule' : 'rules'} in ${settings.country.name}`
          : 'No state rules — applies per employee when set',
        active: count > 0,
      };
    }
    if (layer === 'employee_contract') {
      return {
        title: LAYER_LABELS.employee_contract,
        detail: contractCount
          ? `Applies per employee — ${contractCount} ${contractCount === 1 ? 'employee has' : 'employees have'} their own rate`
          : 'No contract rates — applies per employee when set',
        active: contractCount > 0,
      };
    }
    const scope =
      layer === 'country' ? settings.country.name : layer === 'company' ? settings.company.name : 'All countries';
    if (!summary?.applied) {
      return { title: `${LAYER_LABELS[layer]} · ${scope}`, detail: 'No rule on this date', active: false };
    }
    const sets = fieldsBy(layer);
    const setsText =
      sets.length === FIELD_ORDER.length
        ? 'sets all contribution settings'
        : sets.length
          ? `sets ${sets.map((field) => FIELD_LABELS[field].toLowerCase()).join(', ')}`
          : 'sets no contribution settings';
    return {
      title: `${LAYER_LABELS[layer]} · ${scope}`,
      detail: `${dateRange(summary.effectiveFrom, summary.effectiveTo)} · ${setsText}`,
      active: true,
    };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resolution chain</CardTitle>
        <p className="mt-0.5 text-xs text-secondary">Payroll walks these layers in order; later layers win.</p>
      </CardHeader>
      <CardBody>
        <ol className="relative space-y-4">
          {settings.layers.map((summary, index) => {
            const Icon = LAYER_ICONS[summary.layer];
            const info = describe(summary.layer);
            const last = index === settings.layers.length - 1;
            return (
              <li key={summary.layer} className="relative flex gap-3">
                {!last ? (
                  <span aria-hidden className="absolute left-4 top-9 -bottom-4 w-px bg-[rgb(var(--border-base))]" />
                ) : null}
                <span
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                    info.active
                      ? 'border-accent-200 bg-accent-50 text-accent-600 dark:border-accent-800 dark:bg-accent-950/40 dark:text-accent-300'
                      : 'border-base bg-[rgb(var(--bg-muted))] text-muted'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 pt-0.5">
                  <div className={`text-sm font-medium ${info.active ? 'text-primary' : 'text-secondary'}`}>
                    {info.title}
                  </div>
                  <div className="text-xs text-muted">{info.detail}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}

function VersionHistory({
  settings,
  onViewDate,
}: {
  settings: SuperannuationSettingsRecord;
  onViewDate: (date: string) => void;
}) {
  const scopeOf = (version: SuperannuationRuleVersion) => {
    if (version.layer === 'state') return `State · ${version.stateCode}`;
    if (version.layer === 'country') return settings.country.name;
    if (version.layer === 'company') return settings.company.name;
    return 'All countries';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rule versions</CardTitle>
        <p className="mt-0.5 text-xs text-secondary">
          Rates are effective-dated, so a law change never alters past payroll. Status is relative to{' '}
          {formatDate(settings.asOf)}.
        </p>
      </CardHeader>
      <CardBody className="p-0">
        {settings.versions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-secondary">
            No superannuation rule has been set up for {settings.country.name} or {settings.company.name}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className={thClass}>Layer</th>
                  <th className={thClass}>Effective</th>
                  <th className={thClass}>Sets</th>
                  <th className={thClass}>Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {settings.versions.map((version) => (
                  <tr key={version.id} className={version.timing === 'past' ? 'opacity-70' : undefined}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-primary">{LAYER_LABELS[version.layer]}</div>
                      <div className="text-xs text-muted whitespace-nowrap">{scopeOf(version)}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-secondary">
                      {dateRange(version.effectiveFrom, version.effectiveTo)}
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {summarizeValues(version.values) || <span className="text-muted">No contribution fields</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={TIMING_TONE[version.timing]}>{TIMING_LABELS[version.timing]}</StatusPill>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {version.timing !== 'current' && version.timing !== 'superseded' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="whitespace-nowrap"
                          onClick={() => onViewDate(version.effectiveFrom)}
                        >
                          <CalendarClock className="h-3.5 w-3.5" /> View on {formatDate(version.effectiveFrom)}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function EmployeeExceptions({ settings }: { settings: SuperannuationSettingsRecord }) {
  const { employeeExceptions: rows } = settings;

  return (
    <Card>
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>Employees with their own rates</CardTitle>
          <p className="mt-0.5 text-xs text-secondary">
            A state/province rule or an employment contract can change the rates for individual employees.
          </p>
        </div>
        <Badge tone={rows.length ? 'accent' : 'neutral'} className="shrink-0 whitespace-nowrap">
          {rows.length} of {settings.employeeCount}
        </Badge>
      </CardHeader>
      <CardBody className={rows.length ? 'p-0' : undefined}>
        {rows.length === 0 ? (
          <div className="flex items-center gap-3 text-sm text-secondary">
            <Users className="h-5 w-5 shrink-0 text-muted" aria-hidden />
            {settings.employeeCount
              ? `All ${settings.employeeCount} employees use the company rates above.`
              : 'This company has no employees yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className={thClass}>Employee</th>
                  <th className={thClass}>Overridden by</th>
                  <th className={thClass}>Employer</th>
                  <th className={thClass}>Employee</th>
                  <th className={thClass}>Base</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {rows.map((row) => {
                  const cell = (field: 'employerContributionRate' | 'employeeContributionRate' | 'contributionBase') => (
                    <td
                      className={`px-4 py-3 whitespace-nowrap ${
                        row.differingFields.includes(field) ? 'font-semibold text-accent-700 dark:text-accent-300' : 'text-secondary'
                      }`}
                    >
                      {row.configured ? formatFieldValue(field, row.rates[field]) : '—'}
                    </td>
                  );
                  return (
                    <tr key={row.employeeId}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-primary">{row.fullName}</div>
                        <div className="text-xs text-muted">{row.employeeNumber}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {row.appliedLayers.map((layer) => (
                            <Badge key={layer} tone="accent">
                              {layer === 'state' ? `State · ${row.stateCode}` : 'Contract'}
                            </Badge>
                          ))}
                        </div>
                        {row.differingFields.length === 0 ? (
                          <div className="mt-1 text-xs text-muted">Same rates as the company</div>
                        ) : null}
                      </td>
                      {cell('employerContributionRate')}
                      {cell('employeeContributionRate')}
                      {cell('contributionBase')}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function SuperannuationContent({ companyId }: { companyId: string }) {
  const [params, setParams] = useSearchParams();
  const asOfParam = params.get('asOf');
  const asOf = asOfParam && DATE_RE.test(asOfParam) ? asOfParam : todayIso();
  const isToday = asOf === todayIso();

  const [settings, setSettings] = useState<SuperannuationSettingsRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getSuperannuationSettings(companyId, asOf);
      if (id === requestId.current) setSettings(data);
    } catch (err) {
      if (id === requestId.current) setError(errorText(err, 'Failed to load superannuation settings'));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [companyId, asOf]);

  useEffect(() => {
    void load();
  }, [load]);

  const setAsOf = (value: string | null) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value && value !== todayIso()) next.set('asOf', value);
        else next.delete('asOf');
        return next;
      },
      { replace: true },
    );
  };

  if (!settings) {
    return loading ? (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading superannuation settings…
      </div>
    ) : (
      <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300 flex items-center justify-between gap-3">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const tiles = FIELD_ORDER.map((field) => settings.fields.find((f) => f.field === field)).filter(
    (trace): trace is SuperannuationFieldTrace => Boolean(trace),
  );
  const overrideCount = settings.fields.filter((f) => isCompanyLevelOverride(f.source)).length;
  const example = exampleContributions(settings.rates);
  const currency = settings.company.currency;
  const basisLabel = settings.rates.contributionBase === 'basic' ? 'basic pay' : 'gross pay';

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-primary">Superannuation Contribution Settings</h1>
            <Badge tone="neutral">
              <Lock className="h-3 w-3" aria-hidden /> Read-only
            </Badge>
          </div>
          <p className="text-sm text-secondary mt-0.5">
            The contribution rates payroll applies for {settings.company.name}, resolved from the{' '}
            {settings.country.name} defaults and any company overrides.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-secondary">
            <span className="block mb-1">Rates in effect on</span>
            <Input
              type="date"
              value={asOf}
              onChange={(e) => {
                if (DATE_RE.test(e.target.value)) setAsOf(e.target.value);
              }}
              className="h-9 w-[11rem]"
            />
          </label>
          {!isToday ? (
            <Button variant="secondary" onClick={() => setAsOf(null)}>
              <RotateCcw className="h-4 w-4" /> Today
            </Button>
          ) : null}
          {loading ? <Loader2 className="mb-2 h-4 w-4 animate-spin text-muted" aria-label="Refreshing" /> : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      ) : null}

      {!isToday ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800 dark:border-accent-800 dark:bg-accent-950/30 dark:text-accent-200">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            Showing the rules in effect on <strong>{formatDate(settings.asOf)}</strong>. Payroll uses the rules in
            effect on each pay period&apos;s end date.
          </div>
        </div>
      ) : null}

      {!settings.configured ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800 dark:border-warning-800/60 dark:bg-warning-950/30 dark:text-warning-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            No superannuation rule sets a contribution rate on {formatDate(settings.asOf)}. Payroll will not calculate
            employer or employee contributions for {settings.company.name} on this date.
          </div>
        </div>
      ) : null}

      {settings.warnings.length ? (
        <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800 dark:border-warning-800/60 dark:bg-warning-950/30 dark:text-warning-200">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {settings.warnings.length === 1 ? 'A rule setting is not applied' : 'Some rule settings are not applied'}
          </div>
          <ul className="mt-1.5 ml-6 list-disc space-y-0.5">
            {settings.warnings.map((warning) => (
              <li key={`${warning.layer}:${warning.key}`}>{warning.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          Payroll resolves these rates through the rule chain: global default, then country, state/province, company
          and finally the employee&apos;s contract. Country defaults are maintained by the platform administrator in
          Country Configuration; company and contract overrides are stored as rules for this company. This screen
          shows them but can&apos;t change them.
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {tiles.map((trace) => (
          <RateTile key={trace.field} trace={trace} />
        ))}
      </div>

      {settings.configured ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-secondary">
          <span>
            {overrideCount
              ? `${overrideCount} of ${settings.fields.length} settings are overridden for this company.`
              : `All settings are inherited — ${settings.company.name} has no overrides.`}
          </span>
          <span>
            Example: on {example.pay} {currency} {basisLabel}, the employer contributes{' '}
            <strong className="text-primary">
              {example.employer} {currency}
            </strong>{' '}
            and{' '}
            <strong className="text-primary">
              {example.employee} {currency}
            </strong>{' '}
            is deducted from the employee.
          </span>
        </div>
      ) : null}

      <FieldMatrix settings={settings} />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        <div className="min-w-0">
          <EmployeeExceptions settings={settings} />
        </div>
        <div className="space-y-5">
          <ResolutionChain settings={settings} />
          {settings.otherSettings.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Other settings in these rules</CardTitle>
                <p className="mt-0.5 text-xs text-secondary">
                  Stored on the rules but not used to calculate contributions.
                </p>
              </CardHeader>
              <CardBody>
                <dl className="space-y-2.5 text-sm">
                  {settings.otherSettings.map((setting) => (
                    <div key={setting.key} className="flex items-start justify-between gap-3">
                      <dt className="min-w-0">
                        <div className="font-mono text-xs text-primary break-all">{setting.key}</div>
                        <div className="text-xs text-muted">{LAYER_LABELS[setting.source]}</div>
                      </dt>
                      <dd className="text-right text-secondary break-all">{formatSettingValue(setting.value)}</dd>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      <VersionHistory settings={settings} onViewDate={(date) => setAsOf(date)} />
    </div>
  );
}

export function SuperannuationSettingsPage() {
  return (
    <OrgPageState>
      {(companyId) => (
        <>
          <div className="px-4 lg:px-6 pt-4">
            <CompanySelector />
          </div>
          <SuperannuationContent companyId={companyId} />
        </>
      )}
    </OrgPageState>
  );
}
