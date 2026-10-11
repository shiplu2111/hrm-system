import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Clock, Globe2, Info, Languages, Loader2, MapPin, Pencil, RefreshCw } from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import {
  DATE_FORMAT_OPTIONS,
  LOCALIZATION_FIELDS,
  NUMBER_FORMAT_OPTIONS,
  UI_LANGUAGES,
  formatDateKeyWithPattern,
  formatNumberWithPattern,
  listTimezones,
  localDateKey,
  timezoneOffsetLabel,
  type CompanyLocalizationView,
  type LocalizationField,
  type LocalizationFields,
  type LocalizationOverrides,
  type LocalizationSource,
  type UiLanguage,
  type UpdateLocalizationInput,
} from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { Label, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { StatusPill } from '@/components/ui/StatusPill';
import { useLocalization } from '@/context/LocalizationContext';
import {
  getLocalizationOverview,
  updateBranchLocalization,
  updateCompanyLocalization,
} from '@/lib/localization-api';
import { ApiError } from '@/lib/tenant-api-client';

const FIELD_LABELS: Record<LocalizationField, string> = {
  language: 'Default language',
  timezone: 'Time zone',
  dateFormat: 'Date format',
  numberFormat: 'Number format',
};

const FIELD_HINTS: Record<LocalizationField, string> = {
  language: 'Used until an employee picks their own language from the top bar.',
  timezone: 'Decides which calendar day a clock-in, leave day or shift falls on.',
  dateFormat: 'How dates appear on screens, payslips and exports.',
  numberFormat: 'Thousands and decimal separators for amounts and hours.',
};

const SOURCE_DISPLAY: Record<LocalizationSource, { label: string; tone: 'neutral' | 'accent' | 'success' }> = {
  country: { label: 'Country default', tone: 'neutral' },
  company: { label: 'Company setting', tone: 'accent' },
  branch: { label: 'Branch setting', tone: 'success' },
};

const SAMPLE_NUMBER = 1234567.891;

type EditTarget =
  | { kind: 'company'; company: CompanyLocalizationView }
  | { kind: 'branch'; company: CompanyLocalizationView; locationId: string };

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function languageLabel(code: UiLanguage): string {
  const item = UI_LANGUAGES.find((l) => l.code === code);
  if (!item) return code;
  return item.nativeName === item.name ? item.name : `${item.nativeName} (${item.name})`;
}

function numberFormatLabel(id: string): string {
  return NUMBER_FORMAT_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

function displayValue(field: LocalizationField, fields: LocalizationFields): string {
  switch (field) {
    case 'language':
      return languageLabel(fields.language);
    case 'timezone': {
      const offset = timezoneOffsetLabel(fields.timezone);
      return offset ? `${fields.timezone} (${offset})` : fields.timezone;
    }
    case 'dateFormat':
      return fields.dateFormat;
    default:
      return fields.numberFormat;
  }
}

function sampleValue(field: LocalizationField, fields: LocalizationFields): string | null {
  if (field === 'dateFormat') {
    return formatDateKeyWithPattern(localDateKey(new Date(), fields.timezone), fields.dateFormat, fields.language);
  }
  if (field === 'numberFormat') return formatNumberWithPattern(SAMPLE_NUMBER, fields.numberFormat);
  return null;
}

export function LocalizationSettingsPage() {
  const { can } = usePermissions();
  const canEdit = can('settings', 'edit');
  const { refresh: refreshMyLocalization } = useLocalization();
  const [companies, setCompanies] = useState<CompanyLocalizationView[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<EditTarget | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getLocalizationOverview();
      setCompanies(data.companies);
      setSelectedId((current) =>
        current && data.companies.some((c) => c.companyId === current) ? current : (data.companies[0]?.companyId ?? null),
      );
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not load localization settings'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const company = useMemo(
    () => companies?.find((c) => c.companyId === selectedId) ?? null,
    [companies, selectedId],
  );

  const onSaved = (view: CompanyLocalizationView, message: string) => {
    setCompanies((prev) => prev?.map((c) => (c.companyId === view.companyId ? view : c)) ?? [view]);
    setEditing(null);
    setNotice(message);
    void refreshMyLocalization();
  };

  if (!companies && !error) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-primary">Localization</h1>
          <p className="mt-0.5 text-sm text-secondary">
            Default language, time zone, and date and number formats for each company and branch.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {companies && companies.length > 1 ? (
            <Select
              aria-label="Company"
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-auto min-w-[220px]"
            >
              {companies.map((c) => (
                <option key={c.companyId} value={c.companyId}>
                  {c.companyName}
                </option>
              ))}
            </Select>
          ) : null}
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
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-600 dark:text-accent-400" />
        <div className="space-y-1 text-secondary">
          <p className="font-medium text-primary">How settings are inherited</p>
          <p>
            Each branch uses its company’s settings, and each company uses its country’s defaults, unless you set a
            value of its own. Employees follow the branch they work at. Anyone can still switch the language for
            themselves from the language menu in the top bar; time zone and formats always come from the branch.
          </p>
        </div>
      </section>

      {company ? (
        <>
          <section className="surface rounded-xl border border-base shadow-card">
            <div className="flex flex-col gap-2 border-b border-base px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted" />
                <h2 className="text-sm font-semibold text-primary">{company.companyName}</h2>
                <span className="text-xs text-muted">
                  {company.countryName} · {company.employeeCount} employee{company.employeeCount === 1 ? '' : 's'}
                </span>
              </div>
              {canEdit ? (
                <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: 'company', company })}>
                  <Pencil className="h-3.5 w-3.5" /> Edit company defaults
                </Button>
              ) : null}
            </div>
            <dl className="grid divide-y divide-base sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4">
              {LOCALIZATION_FIELDS.map((field) => {
                const sample = sampleValue(field, company.effective);
                const source = SOURCE_DISPLAY[company.sources[field]];
                return (
                  <div key={field} className="space-y-1.5 px-5 py-4 sm:border-r sm:border-base last:border-r-0">
                    <dt className="flex items-center justify-between gap-2 text-xs font-medium text-muted">
                      {FIELD_LABELS[field]}
                      <StatusPill tone={source.tone}>{source.label}</StatusPill>
                    </dt>
                    <dd className="text-sm font-semibold text-primary break-words">
                      {displayValue(field, company.effective)}
                    </dd>
                    {sample ? <dd className="font-mono text-xs text-secondary">e.g. {sample}</dd> : null}
                    <dd className="text-xs text-muted">{FIELD_HINTS[field]}</dd>
                  </div>
                );
              })}
            </dl>
          </section>

          <section className="surface rounded-xl border border-base shadow-card">
            <div className="flex items-center gap-2 border-b border-base px-5 py-3">
              <MapPin className="h-4 w-4 text-muted" />
              <h2 className="text-sm font-semibold text-primary">Branches</h2>
              <span className="text-xs text-muted">Values in grey come from the company.</span>
            </div>
            {company.branches.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-secondary">
                This company has no branches yet. Add them under Organization → Locations; they’ll use the company
                settings above.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-base text-left text-xs uppercase tracking-wide text-muted">
                      <th className="px-5 py-2.5 font-medium">Branch</th>
                      {LOCALIZATION_FIELDS.map((field) => (
                        <th key={field} className="px-5 py-2.5 font-medium">
                          {FIELD_LABELS[field].replace('Default ', '')}
                        </th>
                      ))}
                      {canEdit ? <th className="px-5 py-2.5" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {company.branches.map((branch) => (
                      <tr key={branch.locationId} className="border-b border-base last:border-0 align-top">
                        <td className="px-5 py-3">
                          <div className="font-medium text-primary">{branch.name}</div>
                          <div className="text-xs text-muted">
                            {branch.employeeCount} employee{branch.employeeCount === 1 ? '' : 's'}
                          </div>
                        </td>
                        {LOCALIZATION_FIELDS.map((field) => {
                          const own = branch.sources[field] === 'branch';
                          return (
                            <td key={field} className="px-5 py-3">
                              <span className={own ? 'font-medium text-primary' : 'text-muted'}>
                                {displayValue(field, branch.effective)}
                              </span>
                              {own ? (
                                <div className="mt-0.5">
                                  <StatusPill tone="success">Branch setting</StatusPill>
                                </div>
                              ) : null}
                            </td>
                          );
                        })}
                        {canEdit ? (
                          <td className="px-5 py-3 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditing({ kind: 'branch', company, locationId: branch.locationId })}
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : companies && companies.length === 0 ? (
        <p className="py-12 text-center text-sm text-secondary">Add a company first to configure localization.</p>
      ) : null}

      {editing ? <LocalizationFormModal target={editing} onClose={() => setEditing(null)} onSaved={onSaved} /> : null}
    </div>
  );
}

function LocalizationFormModal({
  target,
  onClose,
  onSaved,
}: {
  target: EditTarget;
  onClose: () => void;
  onSaved: (view: CompanyLocalizationView, message: string) => void;
}) {
  const branch =
    target.kind === 'branch' ? target.company.branches.find((b) => b.locationId === target.locationId) ?? null : null;
  const initial: LocalizationOverrides = branch ? branch.overrides : target.company.overrides;
  const inherited: LocalizationFields = branch ? target.company.effective : target.company.countryDefaults;
  const parentLabel = branch ? 'company' : 'country';
  const [values, setValues] = useState<LocalizationOverrides>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timezoneGroups = useMemo(() => {
    const now = new Date();
    const groups = new Map<string, Array<{ zone: string; label: string }>>();
    for (const zone of listTimezones()) {
      const region = zone.includes('/') ? zone.split('/')[0]! : 'Other';
      const list = groups.get(region) ?? [];
      list.push({ zone, label: `${zone.replace(/_/g, ' ')} (${timezoneOffsetLabel(zone, now)})` });
      groups.set(region, list);
    }
    return [...groups.entries()];
  }, []);

  const preview: LocalizationFields = {
    language: values.language ?? inherited.language,
    timezone: values.timezone ?? inherited.timezone,
    dateFormat: values.dateFormat ?? inherited.dateFormat,
    numberFormat: values.numberFormat ?? inherited.numberFormat,
  };
  const changed = LOCALIZATION_FIELDS.filter((field) => values[field] !== initial[field]);
  const timezoneChanged = preview.timezone !== (initial.timezone ?? inherited.timezone);
  const affected = branch ? branch.employeeCount : target.company.employeeCount;
  const now = new Date();
  const previewTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: preview.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);

  const set = <K extends LocalizationField>(field: K, value: string) =>
    setValues((prev) => ({ ...prev, [field]: value === '' ? null : value }));

  const save = async () => {
    if (changed.length === 0) return;
    setSaving(true);
    setError(null);
    const input: UpdateLocalizationInput = {};
    for (const field of changed) (input as Record<string, string | null>)[field] = values[field];
    try {
      const view = branch
        ? await updateBranchLocalization(branch.locationId, input)
        : await updateCompanyLocalization(target.company.companyId, input);
      onSaved(view, `Localization for ${branch ? branch.name : target.company.companyName} saved.`);
    } catch (err) {
      setError(errorMessage(err, 'Could not save localization settings'));
      setSaving(false);
    }
  };

  const inheritOption = (field: LocalizationField) => (
    <option value="">
      Same as {parentLabel} · {displayValue(field, inherited)}
    </option>
  );

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={branch ? `Branch localization · ${branch.name}` : `Company localization · ${target.company.companyName}`}
      description={
        branch
          ? 'Leave a field on “Same as company” to follow the company setting, including future changes.'
          : `Leave a field on “Same as country” to follow the ${target.company.countryName} defaults.`
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || changed.length === 0}>
            {saving ? 'Saving…' : 'Save'}
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="loc-language">
              <span className="inline-flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5" /> {FIELD_LABELS.language}
              </span>
            </Label>
            <Select id="loc-language" value={values.language ?? ''} onChange={(e) => set('language', e.target.value)}>
              {inheritOption('language')}
              {UI_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {languageLabel(l.code)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="loc-timezone">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> {FIELD_LABELS.timezone}
              </span>
            </Label>
            <Select id="loc-timezone" value={values.timezone ?? ''} onChange={(e) => set('timezone', e.target.value)}>
              {inheritOption('timezone')}
              {values.timezone && !timezoneGroups.some(([, zones]) => zones.some((z) => z.zone === values.timezone)) ? (
                <option value={values.timezone}>{values.timezone}</option>
              ) : null}
              {timezoneGroups.map(([region, zones]) => (
                <optgroup key={region} label={region}>
                  {zones.map((z) => (
                    <option key={z.zone} value={z.zone}>
                      {z.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="loc-date">{FIELD_LABELS.dateFormat}</Label>
            <Select id="loc-date" value={values.dateFormat ?? ''} onChange={(e) => set('dateFormat', e.target.value)}>
              {inheritOption('dateFormat')}
              {DATE_FORMAT_OPTIONS.map((pattern) => (
                <option key={pattern} value={pattern}>
                  {pattern} · {formatDateKeyWithPattern('2026-12-25', pattern, preview.language)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="loc-number">{FIELD_LABELS.numberFormat}</Label>
            <Select
              id="loc-number"
              value={values.numberFormat ?? ''}
              onChange={(e) => set('numberFormat', e.target.value)}
            >
              {inheritOption('numberFormat')}
              {NUMBER_FORMAT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {formatNumberWithPattern(SAMPLE_NUMBER, option.id)} · {numberFormatLabel(option.id)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="rounded-lg border border-base bg-[rgb(var(--bg-muted))]/30 px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <Globe2 className="h-3.5 w-3.5" /> Preview
          </div>
          <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-3">
              <dt className="text-secondary">Language</dt>
              <dd className="font-medium text-primary">{languageLabel(preview.language)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-secondary">Local time now</dt>
              <dd className="font-mono text-primary">
                {previewTime} {timezoneOffsetLabel(preview.timezone, now)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-secondary">Today</dt>
              <dd className="font-mono text-primary">
                {formatDateKeyWithPattern(localDateKey(now, preview.timezone), preview.dateFormat, preview.language)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-secondary">Amount</dt>
              <dd className="font-mono text-primary">
                {formatNumberWithPattern(SAMPLE_NUMBER, preview.numberFormat, { min: 2 })}
              </dd>
            </div>
          </dl>
        </div>

        {timezoneChanged ? (
          <p className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-800 dark:border-warning-900 dark:bg-warning-950/30 dark:text-warning-200">
            The new time zone decides which day clock-ins, leave and shifts fall on from now on for {affected}{' '}
            employee{affected === 1 ? '' : 's'}
            {branch ? '' : ' at branches without their own time zone'}. Records already saved keep their dates.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
