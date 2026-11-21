import { useCallback, useEffect, useState } from 'react';
import {
  Globe2,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import type {
  CountryConfiguration,
  CountryRuleKind,
  CountryStatus,
  CountrySummary,
  StateProvinceView,
} from '@hrm/shared-types';
import {
  ApiError,
  getPlatformAccessToken,
  platformLogin,
  setPlatformAccessToken,
} from '@/lib/api-client';
import {
  createCountry,
  createCountryRule,
  createState,
  createTaxBracket,
  deleteState,
  getCountryConfiguration,
  listCountries,
  listStates,
  updateCountry,
  updateCountryRule,
  updateTaxBracket,
} from '@/lib/platform-countries-api';
import { CountriesList } from '@/components/countries/CountriesList';
import { CountryDetailView } from '@/components/countries/CountryDetailView';

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

  // Selected country navigation
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [configuration, setConfiguration] = useState<CountryConfiguration | null>(null);
  const [states, setStates] = useState<StateProvinceView[]>([]);
  const [statesLoading, setStatesLoading] = useState(false);

  const loadCountries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCountries();
      setCountries(data);
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

      setStatesLoading(true);
      try {
        const fetchedStates = await listStates(countryId);
        setStates(fetchedStates);
      } catch {
        // States may not exist or be empty
        setStates([]);
      } finally {
        setStatesLoading(false);
      }
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
    if (selectedId && authed) {
      void loadConfiguration(selectedId);
    } else {
      setConfiguration(null);
      setStates([]);
    }
  }, [selectedId, authed, loadConfiguration]);

  const selectedCountry = countries.find((c) => c.id === selectedId) || null;

  // Handler to create country from modal
  const handleCreateCountry = async (input: {
    name: string;
    isoCode: string;
    currency: string;
    timezone: string;
    dateFormat: string;
    numberFormat?: string;
    defaultFinancialYearStart?: string;
    defaultPayFrequency?: string;
    status?: CountryStatus;
  }) => {
    const created = await createCountry(input);
    await loadCountries();
    if (created?.id) {
      setSelectedId(created.id);
    }
  };

  // Handler to update country metadata
  const handleUpdateCountry = async (input: {
    name?: string;
    currency?: string;
    timezone?: string;
    dateFormat?: string;
    numberFormat?: string;
    defaultFinancialYearStart?: string;
    defaultPayFrequency?: string;
    status?: CountryStatus;
  }) => {
    if (!selectedId) return;
    await updateCountry(selectedId, input);
    await loadCountries();
    await loadConfiguration(selectedId);
  };

  // Handler to save tax bracket
  const handleSaveTaxBracket = async (input: {
    taxYear: number;
    bracketJson: Record<string, unknown>;
    effectiveFrom: string;
    effectiveTo?: string;
  }) => {
    if (!selectedId || !configuration) return;
    const existing = configuration.taxBrackets[0];
    if (existing) {
      await updateTaxBracket(selectedId, existing.id, input);
    } else {
      await createTaxBracket(selectedId, input);
    }
    await loadConfiguration(selectedId);
    await loadCountries();
  };

  // Handler to save country rule
  const handleSaveRule = async (
    ruleType: CountryRuleKind,
    payload: Record<string, unknown>,
    effectiveFrom: string,
    effectiveTo?: string | null,
  ) => {
    if (!selectedId || !configuration) return;
    const existing = configuration.rules.find((r) => r.ruleType === ruleType);
    if (existing) {
      await updateCountryRule(selectedId, existing.id, {
        payload,
        effectiveFrom,
        effectiveTo,
      });
    } else {
      await createCountryRule(selectedId, {
        ruleType,
        payload,
        effectiveFrom,
        effectiveTo: effectiveTo || undefined,
      });
    }
    await loadConfiguration(selectedId);
    await loadCountries();
  };

  // Handler to add state/province
  const handleAddState = async (name: string, code: string) => {
    if (!selectedId) return;
    await createState(selectedId, { name, code });
    const fetchedStates = await listStates(selectedId);
    setStates(fetchedStates);
  };

  // Handler to delete state/province
  const handleDeleteState = async (stateId: string) => {
    if (!selectedId) return;
    await deleteState(selectedId, stateId);
    const fetchedStates = await listStates(selectedId);
    setStates(fetchedStates);
  };

  if (!authed) {
    return (
      <div className="py-12">
        <PlatformLoginPanel onSuccess={() => setAuthed(true)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Page Title & Breadcrumb header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            <Globe2 className="h-4 w-4" /> Country Configuration Admin
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {selectedCountry ? `${selectedCountry.name} Jurisdiction` : 'Country Jurisdictions Directory'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {selectedCountry
              ? `Manage statutory regulations, tax brackets, and rule resolver policies for ${selectedCountry.name}.`
              : 'Add and configure statutory employment, tax, leave, and payroll rule sets without code deployment.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Main View: Either Country Detail or Countries List */}
      {selectedCountry ? (
        <CountryDetailView
          country={selectedCountry}
          configuration={configuration}
          loading={loading}
          onBack={() => setSelectedId(null)}
          onRefresh={async () => {
            if (selectedId) {
              await loadCountries();
              await loadConfiguration(selectedId);
            }
          }}
          onUpdateCountry={handleUpdateCountry}
          onSaveTaxBracket={handleSaveTaxBracket}
          onSaveRule={handleSaveRule}
          onAddState={handleAddState}
          onDeleteState={handleDeleteState}
          states={states}
          statesLoading={statesLoading}
        />
      ) : (
        <CountriesList
          countries={countries}
          loading={loading}
          onSelectCountry={(id) => setSelectedId(id)}
          onRefresh={loadCountries}
          onCreateCountry={handleCreateCountry}
        />
      )}
    </div>
  );
}
