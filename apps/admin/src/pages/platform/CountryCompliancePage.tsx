import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Globe2,
  Loader2,
  Plus,
  Save,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type {
  CountryConfiguration,
  CountryRuleKind,
  CountryRuleRecord,
  CountrySummary,
  PublicHolidayEntry,
  TaxBracketRecord,
} from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';
import {
  ApiError,
  getPlatformAccessToken,
  platformLogin,
  setPlatformAccessToken,
} from '@/lib/api-client';
import {
  createCountry,
  createCountryRule,
  createTaxBracket,
  getCountryConfiguration,
  listCountries,
  updateCountryRule,
  updateTaxBracket,
} from '@/lib/platform-countries-api';

type TabName = 'Tax Rules' | 'Leave Rules' | 'OT Rules' | 'Public Holidays';

const TAB_RULE_TYPE: Record<Exclude<TabName, 'Tax Rules'>, CountryRuleKind> = {
  'Leave Rules': 'leave',
  'OT Rules': 'ot',
  'Public Holidays': 'public_holiday',
};

function Badge({ children, tone }: { children: ReactNode; tone: 'green' | 'indigo' | 'slate' }) {
  const tones = {
    green:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    indigo:
      'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300',
    slate:
      'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function currentRule(
  rules: CountryRuleRecord[],
  ruleType: CountryRuleKind,
): CountryRuleRecord | undefined {
  return rules
    .filter((rule) => rule.ruleType === ruleType)
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0];
}

function currentTaxBracket(brackets: TaxBracketRecord[]): TaxBracketRecord | undefined {
  return [...brackets].sort((left, right) => {
    if (right.taxYear !== left.taxYear) return right.taxYear - left.taxYear;
    return right.effectiveFrom.localeCompare(left.effectiveFrom);
  })[0];
}

function PlatformLoginPanel({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('super@cmsnbd.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await platformLogin(email.trim(), password);
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-300">
        <ShieldCheck className="h-4 w-4" /> SUPER ADMIN SIGN-IN
      </div>
      <h2 className="text-lg font-extrabold">Country Configuration</h2>
      <p className="mt-1 text-sm text-slate-500">
        Sign in with a platform Super Admin account to manage country rule sets.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs font-bold">Email</label>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-slate-700"
          />
        </div>
        <div>
          <label className="text-xs font-bold">Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-slate-700"
          />
        </div>
        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Sign in
        </button>
      </div>
    </div>
  );
}

export function CountryCompliancePage() {
  const [authed, setAuthed] = useState(() => Boolean(getPlatformAccessToken()));
  const [countries, setCountries] = useState<CountrySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [configuration, setConfiguration] = useState<CountryConfiguration | null>(
    null,
  );
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabName>('Tax Rules');
  const [saved, setSaved] = useState(false);
  const [addCountryOpen, setAddCountryOpen] = useState(false);
  const [newCountry, setNewCountry] = useState({
    name: '',
    isoCode: '',
    currency: '',
    timezone: 'UTC',
    dateFormat: 'DD/MM/YYYY',
  });

  const [taxJson, setTaxJson] = useState('');
  const [leaveJson, setLeaveJson] = useState('');
  const [otJson, setOtJson] = useState('');
  const [holidaysJson, setHolidaysJson] = useState('');

  const loadCountries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCountries(await listCountries());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setPlatformAccessToken(null);
        setAuthed(false);
      }
      setError(err instanceof ApiError ? err.message : 'Failed to load countries');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConfiguration = useCallback(async (countryId: string) => {
    setLoading(true);
    setError(null);
    try {
      const config = await getCountryConfiguration(countryId);
      setConfiguration(config);

      const tax = currentTaxBracket(config.taxBrackets);
      setTaxJson(JSON.stringify(tax?.bracketJson ?? { brackets: [] }, null, 2));

      const leave = currentRule(config.rules, 'leave');
      setLeaveJson(JSON.stringify(leave?.payload ?? {}, null, 2));

      const ot = currentRule(config.rules, 'ot');
      setOtJson(JSON.stringify(ot?.payload ?? {}, null, 2));

      const holidays = currentRule(config.rules, 'public_holiday');
      const list = (holidays?.payload.holidays as PublicHolidayEntry[] | undefined) ?? [];
      setHolidaysJson(JSON.stringify(list, null, 2));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) void loadCountries();
  }, [authed, loadCountries]);

  useEffect(() => {
    if (selectedId && authed) void loadConfiguration(selectedId);
  }, [selectedId, authed, loadConfiguration]);

  const filtered = useMemo(
    () =>
      countries.filter((country) =>
        `${country.name} ${country.isoCode}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [countries, search],
  );

  const selected = countries.find((country) => country.id === selectedId) ?? null;

  const flashSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const saveTaxRules = async () => {
    if (!configuration) return;
    const bracketJson = JSON.parse(taxJson) as Record<string, unknown>;
    const existing = currentTaxBracket(configuration.taxBrackets);
    const taxYear = new Date().getFullYear();
    const effectiveFrom = existing?.effectiveFrom ?? '2024-07-01';

    if (existing) {
      await updateTaxBracket(configuration.country.id, existing.id, {
        taxYear: existing.taxYear,
        bracketJson,
        effectiveFrom,
      });
    } else {
      await createTaxBracket(configuration.country.id, {
        taxYear,
        bracketJson,
        effectiveFrom,
      });
    }

    await loadConfiguration(configuration.country.id);
    await loadCountries();
    flashSaved();
  };

  const saveRule = async (ruleType: CountryRuleKind, jsonText: string) => {
    if (!configuration) return;
    const payload =
      ruleType === 'public_holiday'
        ? { holidays: JSON.parse(jsonText) as PublicHolidayEntry[] }
        : (JSON.parse(jsonText) as Record<string, unknown>);

    const existing = currentRule(configuration.rules, ruleType);
    const effectiveFrom = existing?.effectiveFrom ?? '2024-07-01';

    if (existing) {
      await updateCountryRule(configuration.country.id, existing.id, { payload });
    } else {
      await createCountryRule(configuration.country.id, {
        ruleType,
        payload,
        effectiveFrom,
      });
    }

    await loadConfiguration(configuration.country.id);
    await loadCountries();
    flashSaved();
  };

  const handleAddCountry = async () => {
    await createCountry({
      name: newCountry.name.trim(),
      isoCode: newCountry.isoCode.trim().toUpperCase(),
      currency: newCountry.currency.trim().toUpperCase(),
      timezone: newCountry.timezone.trim(),
      dateFormat: newCountry.dateFormat.trim(),
    });
    setAddCountryOpen(false);
    setNewCountry({
      name: '',
      isoCode: '',
      currency: '',
      timezone: 'UTC',
      dateFormat: 'DD/MM/YYYY',
    });
    await loadCountries();
  };

  if (!authed) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <PlatformLoginPanel onSuccess={() => setAuthed(true)} />
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-300">
              <Globe2 className="h-4 w-4" /> COUNTRY CONFIGURATION
            </div>
            <h1 className="text-2xl font-extrabold">Country Configuration</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage tax brackets, leave, OT, and public holidays without code deployment.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddCountryOpen(true)}
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-900/15 hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" /> Add country
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-4 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search country..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-transparent pl-9 pr-4 text-sm focus:border-indigo-400 focus:outline-none dark:border-slate-700"
              />
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading countries...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-950/50">
                  <tr>
                    <th className="px-5 py-3">Country</th>
                    <th className="px-4 py-3">Currency</th>
                    <th className="px-4 py-3">Tenants</th>
                    <th className="px-4 py-3">Last rule update</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((country) => (
                    <tr
                      key={country.id}
                      onClick={() => {
                        setSelectedId(country.id);
                        setTab('Tax Rules');
                      }}
                      className="cursor-pointer transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
                    >
                      <td className="px-5 py-4">
                        <div className="text-sm font-bold">{country.name}</div>
                        <div className="text-[11px] text-slate-500">{country.isoCode}</div>
                      </td>
                      <td className="px-4 py-4 font-mono text-sm">{country.currency}</td>
                      <td className="px-4 py-4 font-mono text-sm font-bold">
                        {country.tenantCount}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500">
                        {formatDate(country.lastRuleUpdate)}
                      </td>
                      <td className="px-4 py-4">
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Modal
          open={addCountryOpen}
          onClose={() => setAddCountryOpen(false)}
          title="Add country"
          description="Creates a new jurisdiction for rule configuration."
          footer={
            <>
              <button
                type="button"
                onClick={() => setAddCountryOpen(false)}
                className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-semibold dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAddCountry()}
                className="h-9 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white"
              >
                Create
              </button>
            </>
          }
        >
          <div className="space-y-3">
            {(['name', 'isoCode', 'currency', 'timezone', 'dateFormat'] as const).map(
              (field) => (
                <div key={field}>
                  <label className="text-xs font-bold capitalize">{field}</label>
                  <input
                    value={newCountry[field]}
                    onChange={(event) =>
                      setNewCountry((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                    }
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-slate-700"
                  />
                </div>
              ),
            )}
          </div>
        </Modal>
      </div>
    );
  }

  const tabs: TabName[] = ['Tax Rules', 'Leave Rules', 'OT Rules', 'Public Holidays'];
  const activeRule =
    tab !== 'Tax Rules'
      ? currentRule(configuration?.rules ?? [], TAB_RULE_TYPE[tab])
      : undefined;

  const saveCurrentTab = async () => {
    try {
      if (tab === 'Tax Rules') {
        await saveTaxRules();
        return;
      }
      const ruleType = TAB_RULE_TYPE[tab];
      const json =
        tab === 'Leave Rules'
          ? leaveJson
          : tab === 'OT Rules'
            ? otJson
            : holidaysJson;
      await saveRule(ruleType, json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <button
        type="button"
        onClick={() => {
          setSelectedId(null);
          setConfiguration(null);
        }}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600"
      >
        <ArrowLeft className="h-4 w-4" /> Back to countries
      </button>

      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-extrabold">{selected.name}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {selected.isoCode} · {selected.currency} · {selected.timezone}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void saveCurrentTab()}
          disabled={loading}
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? 'Changes saved' : 'Save changes'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        <div className="flex min-w-max">
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`border-b-2 px-4 py-3 text-xs font-bold ${
                tab === item
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-300'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {loading && !configuration ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading configuration...
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
            <div>
              <h2 className="font-bold">{tab}</h2>
              <p className="mt-1 text-xs text-slate-500">
                Effective from{' '}
                {tab === 'Tax Rules'
                  ? formatDate(currentTaxBracket(configuration?.taxBrackets ?? [])?.effectiveFrom)
                  : formatDate(activeRule?.effectiveFrom)}
              </p>
            </div>
            {tab === 'Public Holidays' && (
              <Badge tone="indigo">
                <CalendarDays className="mr-1 inline h-3 w-3" />
                JSON array
              </Badge>
            )}
          </div>

          {tab === 'Tax Rules' && (
            <div className="p-5">
              <label className="text-xs font-bold">Tax bracket JSON</label>
              <textarea
                value={taxJson}
                onChange={(event) => setTaxJson(event.target.value)}
                className="mt-2 min-h-80 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs dark:border-slate-700 dark:bg-slate-950/50"
              />
            </div>
          )}

          {tab === 'Leave Rules' && (
            <div className="p-5">
              <label className="text-xs font-bold">Leave rule payload (JSON)</label>
              <textarea
                value={leaveJson}
                onChange={(event) => setLeaveJson(event.target.value)}
                className="mt-2 min-h-64 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs dark:border-slate-700 dark:bg-slate-950/50"
              />
            </div>
          )}

          {tab === 'OT Rules' && (
            <div className="p-5">
              <label className="text-xs font-bold">Overtime rule payload (JSON)</label>
              <textarea
                value={otJson}
                onChange={(event) => setOtJson(event.target.value)}
                className="mt-2 min-h-64 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs dark:border-slate-700 dark:bg-slate-950/50"
              />
            </div>
          )}

          {tab === 'Public Holidays' && (
            <div className="p-5">
              <label className="text-xs font-bold">Public holidays (JSON array)</label>
              <textarea
                value={holidaysJson}
                onChange={(event) => setHolidaysJson(event.target.value)}
                className="mt-2 min-h-64 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs dark:border-slate-700 dark:bg-slate-950/50"
              />
              <p className="mt-2 text-[11px] text-slate-500">
                Each entry: {'{ "name", "date", "observed?", "recurring?", "notes?" }'}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
