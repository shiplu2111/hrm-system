import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  FileText,
  FlaskConical,
  HelpCircle,
  Layers,
  Loader2,
  Play,
  RotateCcw,
  Shield,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type {
  CountrySummary,
  RuleSandboxEmployeeProfile,
  RuleSandboxSimulationInput,
  RuleSandboxSimulationResult,
  StateProvinceView,
} from '@hrm/shared-types';
import {
  listCountries,
  listStates,
  simulateRuleSandbox,
} from '@/lib/platform-countries-api';
import { RuleSandboxForm } from '@/components/rule-sandbox/RuleSandboxForm';
import { NetPaySummaryCard } from '@/components/rule-sandbox/NetPaySummaryCard';
import { RuleResolverTraceCard } from '@/components/rule-sandbox/RuleResolverTraceCard';
import { GrossEarningsCard } from '@/components/rule-sandbox/GrossEarningsCard';
import { TaxBracketsCard } from '@/components/rule-sandbox/TaxBracketsCard';
import { StatutoryContributionsCard } from '@/components/rule-sandbox/StatutoryContributionsCard';

export function RuleSandboxPage() {
  const [countries, setCountries] = useState<CountrySummary[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState<string>('');
  const [states, setStates] = useState<StateProvinceView[]>([]);
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const [calculationDate, setCalculationDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [selectedDraftVersionId, setSelectedDraftVersionId] = useState<string | null>(null);

  const [profile, setProfile] = useState<RuleSandboxEmployeeProfile>({
    baseSalary: 8500,
    payFrequency: 'monthly',
    standardHoursWorked: 160,
    overtime: {
      weekdayHours: 10,
      weekendHours: 4,
      holidayHours: 0,
      nightHours: 0,
    },
    leave: {
      paidLeaveDays: 0,
      unpaidLeaveDays: 1,
      unpaidLeaveHours: 0,
      sickLeaveDays: 0,
    },
    filingStatus: 'resident',
    voluntaryPensionRate: 0,
  });

  const [simulationResult, setSimulationResult] = useState<RuleSandboxSimulationResult | null>(null);
  const [loadingCountries, setLoadingCountries] = useState<boolean>(true);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Initial Load: fetch countries
  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      try {
        setLoadingCountries(true);
        setError(null);
        const countriesList = await listCountries();
        if (cancelled) return;
        setCountries(countriesList);

        if (countriesList.length > 0) {
          // Check if countryId was passed in hash or query
          const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
          const paramCountryId = hashParams.get('countryId');
          const paramDraftId = hashParams.get('draftVersionId');

          const initialCountry =
            (paramCountryId && countriesList.find((c) => c.id === paramCountryId)) ||
            countriesList.find((c) => c.isoCode === 'AU') ||
            countriesList[0];

          setSelectedCountryId(initialCountry.id);
          if (paramDraftId) {
            setSelectedDraftVersionId(paramDraftId);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load countries for Rule Sandbox.');
        }
      } finally {
        if (!cancelled) {
          setLoadingCountries(false);
        }
      }
    }

    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. When selectedCountryId changes, load states and trigger auto-simulation
  useEffect(() => {
    if (!selectedCountryId) return;

    let cancelled = false;

    async function loadStatesAndRun() {
      try {
        const stateList = await listStates(selectedCountryId);
        if (cancelled) return;
        setStates(stateList);

        // Auto-simulate on initial country set if not yet simulated
        if (!simulationResult) {
          void runSimulation(selectedCountryId, null, calculationDate, selectedDraftVersionId, profile);
        }
      } catch (err) {
        console.warn('Failed to load states for country', err);
      }
    }

    void loadStatesAndRun();
    return () => {
      cancelled = true;
    };
  }, [selectedCountryId]);

  // Execute simulation
  const runSimulation = useCallback(
    async (
      countryId: string,
      stateId: string | null,
      calcDate: string,
      draftId: string | null,
      prof: RuleSandboxEmployeeProfile,
    ) => {
      if (!countryId) return;

      try {
        setSimulating(true);
        setError(null);

        const payload: RuleSandboxSimulationInput = {
          countryId,
          stateProvinceId: stateId || undefined,
          calculationDate: calcDate,
          draftRuleVersionId: draftId || undefined,
          employeeProfile: prof,
        };

        const result = await simulateRuleSandbox(payload);
        setSimulationResult(result);
      } catch (err: any) {
        setError(err?.message || 'Failed to execute Rule Resolver simulation.');
      } finally {
        setSimulating(false);
      }
    },
    [],
  );

  const handleCountryChange = (countryId: string) => {
    setSelectedCountryId(countryId);
    setSelectedStateId(null);
    setSelectedDraftVersionId(null);
    setSimulationResult(null);
  };

  const handleRunSimulation = () => {
    void runSimulation(
      selectedCountryId,
      selectedStateId,
      calculationDate,
      selectedDraftVersionId,
      profile,
    );
  };

  const selectedCountry = countries.find((c) => c.id === selectedCountryId);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <FlaskConical className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                  Rule Test Sandbox
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  <Sparkles className="h-3 w-3" />
                  Dry-Run Resolver
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <Shield className="h-3 w-3" />
                  Zero DB Mutations
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
                Simulate and audit the full 5-level Rule Resolver hierarchy (
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Global Default &rarr; Country &rarr; State &rarr; Company &rarr; Contract
                </span>
                ) and deterministic payroll calculation without persisting any records to the database. Test draft or pending versions prior to publishing.
              </p>
            </div>
          </div>

          {/* Quick Stats or Actions */}
          <div className="flex items-center gap-3 self-start lg:self-auto">
            <button
              type="button"
              onClick={handleRunSimulation}
              disabled={simulating || loadingCountries || !selectedCountryId}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition disabled:opacity-50"
            >
              {simulating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resolving & Calculating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-white" />
                  Run Resolver & Calculate
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert if any */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40 p-4 text-rose-800 dark:text-rose-200 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm">Simulation Failed</h4>
            <p className="text-xs mt-0.5 opacity-90">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs font-semibold text-rose-700 dark:text-rose-300 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Form on Top / Left, Results Display */}
      <div className="space-y-6">
        {/* Configuration & Employee Profile Form */}
        <RuleSandboxForm
          countries={countries}
          selectedCountryId={selectedCountryId}
          onSelectCountryId={handleCountryChange}
          states={states}
          selectedStateId={selectedStateId}
          onSelectStateId={setSelectedStateId}
          calculationDate={calculationDate}
          onChangeCalculationDate={setCalculationDate}
          selectedDraftVersionId={selectedDraftVersionId}
          onSelectDraftVersionId={setSelectedDraftVersionId}
          profile={profile}
          onChangeProfile={setProfile}
          onRunSimulation={handleRunSimulation}
          loading={simulating}
        />

        {/* Results Container */}
        {simulating && !simulationResult ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-16 text-center shadow-sm">
            <Loader2 className="h-10 w-10 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Resolving Statutory Rules & Calculating Payroll...
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Executing deterministic Rule Resolver chain across global baselines, country statutes, and regional overrides. Zero database mutations.
            </p>
          </div>
        ) : simulationResult ? (
          <div className="space-y-6">
            {/* Top Net Pay Hero Summary Card */}
            <NetPaySummaryCard
              summary={simulationResult.summary}
              currency={simulationResult.currency}
            />

            {/* 5-Layer Rule Resolver Trace Audit */}
            <RuleResolverTraceCard simulation={simulationResult} />

            {/* Step-by-Step Payroll Calculation Breakdown Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gross Earnings & Overtime Breakdown */}
              <GrossEarningsCard
                gross={simulationResult.gross}
                currency={simulationResult.currency}
              />

              {/* Statutory Social Security & Superannuation Contributions */}
              <StatutoryContributionsCard
                contributions={simulationResult.contributions}
                currency={simulationResult.currency}
              />
            </div>

            {/* Progressive Tax Brackets & Marginal Rates Breakdown */}
            <TaxBracketsCard
              tax={simulationResult.tax}
              currency={simulationResult.currency}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <FlaskConical className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No Simulation Executed Yet
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Select a country, set calculation date, customize sample employee profile or pick a preset, and click "Run Resolver & Calculate".
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
