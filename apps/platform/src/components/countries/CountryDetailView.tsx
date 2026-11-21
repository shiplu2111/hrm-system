import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Briefcase,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  CreditCard,
  DollarSign,
  ExternalLink,
  FileCheck2,
  FileText,
  Globe2,
  HelpCircle,
  Info,
  Landmark,
  Layers,
  Loader2,
  Lock,
  Plus,
  Receipt,
  RefreshCw,
  Save,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Timer,
  Trash2,
  UserMinus,
  Zap,
} from 'lucide-react';
import type {
  CountryConfigStatusView,
  CountryConfiguration,
  CountryRuleKind,
  CountryRuleRecord,
  CountryStatus,
  CountrySummary,
  PublicHolidayEntry,
  StateProvinceView,
  TaxBracketRecord,
} from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';
import { COMMON_TIMEZONES, ISO_FLAGS } from './CountriesList';

export type CountryDetailTab =
  | 'General'
  | 'Currency'
  | 'Tax'
  | 'Social Security'
  | 'Pension'
  | 'Leave'
  | 'Working Hours'
  | 'Overtime'
  | 'Public Holidays'
  | 'Payroll'
  | 'Employment'
  | 'Termination'
  | 'Compliance';

export const ALL_TABS: {
  key: CountryDetailTab;
  label: string;
  icon: any;
  categoryKind?: CountryRuleKind;
  isRequired: boolean;
  stageName: string;
  stageCode: string;
  description: string;
}[] = [
  {
    key: 'General',
    label: 'General',
    icon: Sliders,
    isRequired: true,
    stageCode: 'Stage C.00',
    stageName: 'General Jurisdiction Metadata',
    description: 'Core country naming, timezone, date conventions, and state/province subdivisions.',
  },
  {
    key: 'Currency',
    label: 'Currency',
    icon: Coins,
    isRequired: true,
    stageCode: 'Stage C.00',
    stageName: 'Monetary Representation & Currency',
    description: 'ISO 4217 currency specification, symbol positioning, and deterministic minor-unit storage.',
  },
  {
    key: 'Tax',
    label: 'Tax',
    icon: Receipt,
    categoryKind: 'tax',
    isRequired: true,
    stageCode: 'Stage C.01',
    stageName: 'Progressive Tax Engine & Statutory Brackets',
    description: 'Income tax brackets, marginal rate tiers, withholding calculations, and statutory exemptions.',
  },
  {
    key: 'Social Security',
    label: 'Social Security',
    icon: ShieldCheck,
    categoryKind: 'social_security',
    isRequired: false,
    stageCode: 'Stage C.02',
    stageName: 'Social Security & Statutory Contributions',
    description: 'Employer and employee mandatory statutory insurance, FICA/NIC, and social safety nets.',
  },
  {
    key: 'Pension',
    label: 'Pension',
    icon: Landmark,
    isRequired: false,
    stageCode: 'Stage C.03',
    stageName: 'Superannuation & Statutory Pension Schemes',
    description: 'Mandatory superannuation guarantee (AU), workplace pension (UK), or statutory provident funds.',
  },
  {
    key: 'Leave',
    label: 'Leave',
    icon: CalendarDays,
    categoryKind: 'leave',
    isRequired: true,
    stageCode: 'Stage C.04',
    stageName: 'Statutory Leave Entitlements & Policies',
    description: 'Annual leave accrual baselines, statutory sick leave, maternity/paternity, and bereavement.',
  },
  {
    key: 'Working Hours',
    label: 'Working Hours',
    icon: Clock,
    isRequired: true,
    stageCode: 'Stage C.05',
    stageName: 'Standard Working Hours & Break Regulations',
    description: 'Standard daily and weekly working ceilings, rest break intervals, and maximum daily spread.',
  },
  {
    key: 'Overtime',
    label: 'Overtime',
    icon: Zap,
    categoryKind: 'ot',
    isRequired: true,
    stageCode: 'Stage C.06',
    stageName: 'Overtime Thresholds & Statutory Multipliers',
    description: 'Tier 1 (1.5x) and Tier 2 (2.0x) multiplier caps, weekend rates, and statutory overtime ceilings.',
  },
  {
    key: 'Public Holidays',
    label: 'Public Holidays',
    icon: CalendarCheck,
    categoryKind: 'public_holiday',
    isRequired: true,
    stageCode: 'Stage C.07',
    stageName: 'Official Public & Bank Holidays Calendar',
    description: 'Statutory national and bank holidays with observance dates and penalty rate schedules.',
  },
  {
    key: 'Payroll',
    label: 'Payroll',
    icon: CreditCard,
    isRequired: true,
    stageCode: 'Stage C.08',
    stageName: 'Statutory Payroll Processing & Cycle Rules',
    description: 'Pay frequencies allowed, cutoffs, financial year boundaries, and retroactive adjustments.',
  },
  {
    key: 'Employment',
    label: 'Employment',
    icon: Briefcase,
    categoryKind: 'employment_rules',
    isRequired: true,
    stageCode: 'Stage C.09',
    stageName: 'Employment Contracts & Minimum Wage Baselines',
    description: 'Statutory probation ceilings, statutory minimum wage, and standard employment contract terms.',
  },
  {
    key: 'Termination',
    label: 'Termination',
    icon: UserMinus,
    isRequired: true,
    stageCode: 'Stage C.10',
    stageName: 'Termination, Notice Periods & Severance Schemes',
    description: 'Statutory notice periods mapped to tenure, redundancy formulas, and severance entitlements.',
  },
  {
    key: 'Compliance',
    label: 'Compliance',
    icon: Scale,
    categoryKind: 'health_safety',
    isRequired: false,
    stageCode: 'Stage C.11',
    stageName: 'Jurisdictional Regulatory Audits & Workplace Safety',
    description: 'Statutory labor agency filings, mandatory health and safety standards, and compliance audits.',
  },
];

interface CountryDetailViewProps {
  country: CountrySummary;
  configuration: CountryConfiguration | null;
  loading: boolean;
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onUpdateCountry: (input: {
    name?: string;
    currency?: string;
    timezone?: string;
    dateFormat?: string;
    numberFormat?: string;
    defaultFinancialYearStart?: string;
    defaultPayFrequency?: string;
    status?: CountryStatus;
  }) => Promise<void>;
  onSaveTaxBracket?: (input: {
    taxYear: number;
    bracketJson: Record<string, unknown>;
    effectiveFrom: string;
    effectiveTo?: string;
  }) => Promise<void>;
  onSaveRule?: (
    ruleType: CountryRuleKind,
    payload: Record<string, unknown>,
    effectiveFrom: string,
    effectiveTo?: string | null,
  ) => Promise<void>;
  onAddState?: (name: string, code: string) => Promise<void>;
  onDeleteState?: (stateId: string) => Promise<void>;
  states?: StateProvinceView[];
  statesLoading?: boolean;
}

export function CountryDetailView({
  country,
  configuration,
  loading,
  onBack,
  onRefresh,
  onUpdateCountry,
  onSaveTaxBracket,
  onSaveRule,
  onAddState,
  onDeleteState,
  states = [],
  statesLoading = false,
}: CountryDetailViewProps) {
  const [activeTab, setActiveTab] = useState<CountryDetailTab>('General');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // General tab form state
  const [generalForm, setGeneralForm] = useState({
    name: country.name,
    isoCode: country.isoCode,
    timezone: country.timezone,
    dateFormat: country.dateFormat,
    numberFormat: country.numberFormat,
    defaultFinancialYearStart: country.defaultFinancialYearStart || '01-01',
    defaultPayFrequency: country.defaultPayFrequency || 'monthly',
    status: country.status,
  });

  // Currency tab form state
  const [currencyForm, setCurrencyForm] = useState({
    currency: country.currency,
    numberFormat: country.numberFormat,
    currencySymbol: '$',
    symbolPosition: 'prefix' as 'prefix' | 'suffix',
    minorUnits: 2,
    previewAmount: 5250.75,
  });

  // State/Province modal
  const [isAddStateOpen, setIsAddStateOpen] = useState(false);
  const [newStateName, setNewStateName] = useState('');
  const [newStateCode, setNewStateCode] = useState('');
  const [stateSubmitting, setStateSubmitting] = useState(false);

  // Status change block modal
  const [activationBlockedOpen, setActivationBlockedOpen] = useState(false);
  const [missingCategories, setMissingCategories] = useState<string[]>([]);

  // Update form state when country prop changes
  useEffect(() => {
    setGeneralForm({
      name: country.name,
      isoCode: country.isoCode,
      timezone: country.timezone,
      dateFormat: country.dateFormat,
      numberFormat: country.numberFormat,
      defaultFinancialYearStart: country.defaultFinancialYearStart || '01-01',
      defaultPayFrequency: country.defaultPayFrequency || 'monthly',
      status: country.status,
    });
    setCurrencyForm((prev) => ({
      ...prev,
      currency: country.currency,
      numberFormat: country.numberFormat,
      currencySymbol: getCurrencySymbol(country.currency),
    }));
  }, [country]);

  function getCurrencySymbol(code: string): string {
    const symbols: Record<string, string> = {
      USD: '$',
      CAD: 'CA$',
      AUD: 'A$',
      NZD: 'NZ$',
      GBP: '£',
      EUR: '€',
      BDT: '৳',
      AED: 'AED',
      SGD: 'S$',
      JPY: '¥',
      INR: '₹',
    };
    return symbols[code.toUpperCase()] || code;
  }

  const triggerSuccessBanner = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // Check completeness status per tab
  const tabCompleteness = useMemo(() => {
    const rules = configuration?.rules || [];
    const taxBrackets = configuration?.taxBrackets || [];

    const map: Record<CountryDetailTab, { isComplete: boolean; label: string; tone: 'green' | 'amber' | 'slate' }> = {
      General: { isComplete: true, label: 'Complete', tone: 'green' },
      Currency: { isComplete: true, label: 'Complete', tone: 'green' },
      Tax: {
        isComplete: taxBrackets.length > 0 || rules.some((r) => r.ruleType === 'tax'),
        label: taxBrackets.length > 0 ? `${taxBrackets.length} Brackets` : 'Pending',
        tone: taxBrackets.length > 0 ? 'green' : 'amber',
      },
      'Social Security': {
        isComplete: rules.some((r) => r.ruleType === 'social_security'),
        label: rules.some((r) => r.ruleType === 'social_security') ? 'Configured' : 'Optional',
        tone: rules.some((r) => r.ruleType === 'social_security') ? 'green' : 'slate',
      },
      Pension: {
        isComplete: rules.some((r) => r.ruleType === 'social_security'), // or pension
        label: rules.some((r) => r.ruleType === 'social_security') ? 'Configured' : 'Optional',
        tone: rules.some((r) => r.ruleType === 'social_security') ? 'green' : 'slate',
      },
      Leave: {
        isComplete: rules.some((r) => r.ruleType === 'leave'),
        label: rules.some((r) => r.ruleType === 'leave') ? 'Configured' : 'Pending',
        tone: rules.some((r) => r.ruleType === 'leave') ? 'green' : 'amber',
      },
      'Working Hours': {
        isComplete: rules.some((r) => r.ruleType === 'ot'),
        label: rules.some((r) => r.ruleType === 'ot') ? 'Configured' : 'Pending',
        tone: rules.some((r) => r.ruleType === 'ot') ? 'green' : 'amber',
      },
      Overtime: {
        isComplete: rules.some((r) => r.ruleType === 'ot'),
        label: rules.some((r) => r.ruleType === 'ot') ? 'Configured' : 'Pending',
        tone: rules.some((r) => r.ruleType === 'ot') ? 'green' : 'amber',
      },
      'Public Holidays': {
        isComplete: rules.some((r) => r.ruleType === 'public_holiday'),
        label: rules.some((r) => r.ruleType === 'public_holiday') ? 'Configured' : 'Pending',
        tone: rules.some((r) => r.ruleType === 'public_holiday') ? 'green' : 'amber',
      },
      Payroll: {
        isComplete: Boolean(country.defaultPayFrequency && country.defaultFinancialYearStart),
        label: 'Configured',
        tone: 'green',
      },
      Employment: {
        isComplete: rules.some((r) => r.ruleType === 'employment_rules'),
        label: rules.some((r) => r.ruleType === 'employment_rules') ? 'Configured' : 'Pending',
        tone: rules.some((r) => r.ruleType === 'employment_rules') ? 'green' : 'amber',
      },
      Termination: {
        isComplete: rules.some((r) => r.ruleType === 'employment_rules'),
        label: rules.some((r) => r.ruleType === 'employment_rules') ? 'Configured' : 'Pending',
        tone: rules.some((r) => r.ruleType === 'employment_rules') ? 'green' : 'amber',
      },
      Compliance: {
        isComplete: rules.some((r) => r.ruleType === 'health_safety'),
        label: rules.some((r) => r.ruleType === 'health_safety') ? 'Configured' : 'Optional',
        tone: rules.some((r) => r.ruleType === 'health_safety') ? 'green' : 'slate',
      },
    };

    return map;
  }, [configuration, country]);

  // Overall completeness count
  const completedCount = useMemo(() => {
    return Object.values(tabCompleteness).filter((t) => t.isComplete).length;
  }, [tabCompleteness]);

  // Save General tab handler
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      setSaving(true);
      await onUpdateCountry({
        name: generalForm.name.trim(),
        timezone: generalForm.timezone.trim(),
        dateFormat: generalForm.dateFormat.trim(),
        numberFormat: generalForm.numberFormat.trim(),
        defaultFinancialYearStart: generalForm.defaultFinancialYearStart.trim(),
        defaultPayFrequency: generalForm.defaultPayFrequency.trim(),
        status: generalForm.status,
      });
      triggerSuccessBanner();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save general settings.');
    } finally {
      setSaving(false);
    }
  };

  // Save Currency tab handler
  const handleSaveCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      setSaving(true);
      await onUpdateCountry({
        currency: currencyForm.currency.trim().toUpperCase(),
        numberFormat: currencyForm.numberFormat.trim(),
      });
      triggerSuccessBanner();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save currency configuration.');
    } finally {
      setSaving(false);
    }
  };

  // Handle status change directly
  const handleStatusChange = async (newStatus: CountryStatus) => {
    setErrorMessage(null);
    if (newStatus === 'active') {
      const configStatus = configuration?.configStatus;
      if (configStatus && !configStatus.isReadyForActivation) {
        setMissingCategories(configStatus.missingCategories);
        setActivationBlockedOpen(true);
        return;
      }
    }

    try {
      setSaving(true);
      await onUpdateCountry({ status: newStatus });
      setGeneralForm((prev) => ({ ...prev, status: newStatus }));
      triggerSuccessBanner();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update country status.');
    } finally {
      setSaving(false);
    }
  };

  // State addition
  const handleAddStateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStateName.trim() || !newStateCode.trim() || !onAddState) return;
    try {
      setStateSubmitting(true);
      await onAddState(newStateName.trim(), newStateCode.trim().toUpperCase());
      setIsAddStateOpen(false);
      setNewStateName('');
      setNewStateCode('');
      triggerSuccessBanner();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to add state/province.');
    } finally {
      setStateSubmitting(false);
    }
  };

  const flag = ISO_FLAGS[country.isoCode] || '🌐';

  return (
    <div className="space-y-6">
      {/* Country Detail Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              title="Return to countries list"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <span className="text-4xl" role="img" aria-label={country.name}>
              {flag}
            </span>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                  {country.name}
                </h1>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {country.isoCode}
                </span>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                  {country.currency}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                <span>🕒 {country.timezone}</span>
                <span>•</span>
                <span>📅 FY Starts: {country.defaultFinancialYearStart || '01-01'}</span>
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  {country.tenantCount || 0} tenant{(country.tenantCount || 0) === 1 ? '' : 's'} linked
                </span>
              </p>
            </div>
          </div>

          {/* Right Status Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-slate-400 px-2 font-semibold">Status:</span>
              {(['draft', 'active', 'retired'] as const).map((st) => {
                const isActive = generalForm.status === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusChange(st)}
                    disabled={saving}
                    className={`px-3 py-1.5 rounded-lg font-bold capitalize transition ${
                      isActive
                        ? st === 'active'
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : st === 'draft'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-slate-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={loading}
              className="h-9 px-3 flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Completeness Summary Strip */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Configuration Completeness:
            </span>
            <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
              {completedCount} of 13 Categories Configured
            </span>
            {completedCount === 13 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 className="h-3 w-3" /> All Statutory Modules Complete
              </span>
            )}
          </div>

          <div className="w-full sm:w-64 flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((completedCount / 13) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              {Math.round((completedCount / 13) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Success & Error Banners */}
      {savedSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Configuration saved successfully. All changes are versioned and immediately active.</span>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-600 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 13 Country Configuration Tabs Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {ALL_TABS.map((tab) => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.key;
            const status = tabCompleteness[tab.key];

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition shrink-0 ${
                  isCurrent
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className={`h-4 w-4 ${isCurrent ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>

                {/* Completeness Badge on Tab */}
                <span
                  className={`ml-1 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full border ${
                    isCurrent
                      ? 'bg-white/20 text-white border-white/30'
                      : status.tone === 'green'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                      : status.tone === 'amber'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                      : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                  }`}
                >
                  {status.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB CONTENT PANELS */}

      {/* 1. GENERAL TAB (BUILT HERE) */}
      {activeTab === 'General' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  General Jurisdiction Configuration
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Configure default date, time, pay frequencies, and localized formatting for {country.name}.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" /> General Tab Active
              </span>
            </div>

            <form onSubmit={handleSaveGeneral} className="mt-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Jurisdiction Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={generalForm.name}
                    onChange={(e) => setGeneralForm({ ...generalForm, name: e.target.value })}
                    required
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Public legal country name displayed to administrators and on statutory reports.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    ISO 3166-1 Alpha-3 Code
                  </label>
                  <input
                    type="text"
                    value={generalForm.isoCode}
                    disabled
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 px-3 text-sm font-mono text-slate-500 cursor-not-allowed"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Immutable unique code identifier used across Rule Resolvers and tenant tables.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Default Timezone <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={generalForm.timezone}
                    onChange={(e) => setGeneralForm({ ...generalForm, timezone: e.target.value })}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none"
                  >
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Primary timezone applied to tenant attendance cutoffs and scheduled jobs.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Date Format Notation
                  </label>
                  <select
                    value={generalForm.dateFormat}
                    onChange={(e) => setGeneralForm({ ...generalForm, dateFormat: e.target.value })}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none"
                  >
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601 Standard)</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY (UK, Australia, Bangladesh, International)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (United States)</option>
                    <option value="DD.MM.YYYY">DD.MM.YYYY (Germany, Central Europe)</option>
                  </select>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    UI presentation format for payslips, leave requests, and timestamps.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Statutory Financial Year Start (MM-DD) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="01-01"
                    pattern="^\d{2}-\d{2}$"
                    value={generalForm.defaultFinancialYearStart}
                    onChange={(e) =>
                      setGeneralForm({ ...generalForm, defaultFinancialYearStart: e.target.value })
                    }
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 text-sm font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    E.g. 01-01 (Jan 1, US/EU), 07-01 (Jul 1, Australia/BD), 04-06 (Apr 6, UK tax year).
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Default Pay Frequency
                  </label>
                  <select
                    value={generalForm.defaultPayFrequency}
                    onChange={(e) =>
                      setGeneralForm({ ...generalForm, defaultPayFrequency: e.target.value })
                    }
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none"
                  >
                    <option value="monthly">Monthly (Standard global cycle)</option>
                    <option value="semi-monthly">Semi-Monthly (15th and End of month, US standard)</option>
                    <option value="bi-weekly">Bi-Weekly (Every 2 weeks, 26 pay periods/yr)</option>
                    <option value="weekly">Weekly (52 pay periods/yr)</option>
                    <option value="four-weekly">Four-Weekly (13 pay periods/yr)</option>
                  </select>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Baseline cycle inherited by companies creating payroll groups in this country.
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-sm transition disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save General Settings
                </button>
              </div>
            </form>
          </div>

          {/* States & Provinces Management Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  States, Provinces & Territories ({states.length})
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Jurisdiction subdivisions for state-specific payroll tax rules, public holidays, and workers comp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddStateOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-xs font-bold transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Add State / Province
              </button>
            </div>

            {statesLoading ? (
              <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                Loading states...
              </div>
            ) : states.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <p className="text-xs">No states or provinces configured for {country.name}.</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Add state subdivisions if tax brackets or employment standards differ by region (e.g. US States, Australian States).
                </p>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {states.map((st) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
                  >
                    <div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white block">
                        {st.name}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                        {st.code}
                      </span>
                    </div>
                    {onDeleteState && (
                      <button
                        type="button"
                        onClick={() => onDeleteState(st.id)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                        title="Delete state"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. CURRENCY TAB (BUILT HERE) */}
      {activeTab === 'Currency' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Coins className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Currency & Monetary Representation
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Configure monetary symbol, decimal separators, and deterministic minor unit handling for {country.name}.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" /> Currency Tab Active
              </span>
            </div>

            <form onSubmit={handleSaveCurrency} className="mt-5 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    ISO 4217 Currency Code (3-letter) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={currencyForm.currency}
                    onChange={(e) =>
                      setCurrencyForm({
                        ...currencyForm,
                        currency: e.target.value.toUpperCase(),
                        currencySymbol: getCurrencySymbol(e.target.value),
                      })
                    }
                    required
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 text-sm font-mono font-bold uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    E.g. USD, EUR, GBP, AUD, BDT, SGD, CAD.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Currency Symbol
                  </label>
                  <input
                    type="text"
                    value={currencyForm.currencySymbol}
                    onChange={(e) =>
                      setCurrencyForm({ ...currencyForm, currencySymbol: e.target.value })
                    }
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Glyph displayed on invoices, payslips, and UI badges.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Number Format / Separators
                  </label>
                  <select
                    value={currencyForm.numberFormat}
                    onChange={(e) =>
                      setCurrencyForm({ ...currencyForm, numberFormat: e.target.value })
                    }
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none"
                  >
                    <option value="1,234.56">1,234.56 (Comma thousands, Dot decimals — US/UK/AU)</option>
                    <option value="1.234,56">1.234,56 (Dot thousands, Comma decimals — DE/FR/EU)</option>
                    <option value="1 234,56">1 234,56 (Space thousands, Comma decimals)</option>
                    <option value="1,23,456.78">1,23,456.78 (Lakh/Crore Indian/BD Notation)</option>
                  </select>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Thousands and decimal separator styles for numbers.
                  </span>
                </div>
              </div>

              {/* Live Interactive Currency Preview Card */}
              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/60 to-purple-50/30 dark:from-indigo-950/20 dark:to-purple-950/10 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    <Sparkles className="h-4 w-4" />
                    <span>Live Monetary & Determinism Simulator (RULES.md §3)</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                    integer minor units: numeric(14,2)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Sample Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={currencyForm.previewAmount}
                      onChange={(e) =>
                        setCurrencyForm({
                          ...currencyForm,
                          previewAmount: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="mt-1 h-9 w-full rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 px-3 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Formatted Display
                    </span>
                    <div className="mt-1 h-9 flex items-center px-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 font-mono text-base font-black text-indigo-600 dark:text-indigo-400">
                      {currencyForm.currencySymbol}
                      {currencyForm.previewAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Database Integer Minor Units (Cents/Pence)
                    </span>
                    <div className="mt-1 h-9 flex items-center px-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 font-mono text-sm font-bold text-slate-700 dark:text-slate-200">
                      {Math.round(currencyForm.previewAmount * 100)} {currencyForm.currency.toLowerCase()} units
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-indigo-100 dark:border-indigo-900/40 pt-2 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span>
                    Deterministic calculation guarantee: Never uses floating-point arithmetic. Payroll runs lock monetary values in fixed precision numeric(14,2) to eliminate rounding drift across multi-tier tax brackets.
                  </span>
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-sm transition disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Currency Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3 to 13. OTHER STATUTORY TABS (LINKED STAGES WITH COMPLETENESS BADGES) */}
      {activeTab !== 'General' && activeTab !== 'Currency' && (
        <LinkedStageTabPanel
          tab={ALL_TABS.find((t) => t.key === activeTab)!}
          country={country}
          configuration={configuration}
          completeness={tabCompleteness[activeTab]}
          onSaveRule={onSaveRule}
          onSaveTaxBracket={onSaveTaxBracket}
          onRefresh={onRefresh}
        />
      )}

      {/* Add State / Province Modal */}
      <Modal
        open={isAddStateOpen}
        onClose={() => setIsAddStateOpen(false)}
        title={`Add State / Province for ${country.name}`}
      >
        <form onSubmit={handleAddStateSubmit} className="space-y-4">
          <p className="text-xs text-slate-500">
            Add a state, province, or territory subdivision. Used for regional payroll taxes (e.g. US State Income Tax, Australian Payroll Tax).
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              State / Province Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. New South Wales"
              value={newStateName}
              onChange={(e) => setNewStateName(e.target.value)}
              required
              className="mt-1 h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 text-sm focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Subdivision Code (e.g. NSW, CA, TX, ON) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. NSW"
              value={newStateCode}
              onChange={(e) => setNewStateCode(e.target.value.toUpperCase())}
              required
              className="mt-1 h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 text-sm uppercase font-mono focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddStateOpen(false)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={stateSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {stateSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Add State
            </button>
          </div>
        </form>
      </Modal>

      {/* Activation Blocked Modal */}
      <Modal
        open={activationBlockedOpen}
        onClose={() => setActivationBlockedOpen(false)}
        title="Cannot Activate Country Jurisdiction"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Mandatory Statutory Rules Missing</span>
              <span>
                A country jurisdiction cannot be transitioned to <strong>Active</strong> status until all mandatory statutory baseline categories are configured.
              </span>
            </div>
          </div>

          <div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
              Missing Required Categories:
            </span>
            <div className="space-y-1.5">
              {missingCategories.map((cat) => (
                <div
                  key={cat}
                  className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg"
                >
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="capitalize font-semibold">{cat.replace(/_/g, ' ')}</span>
                  <span className="text-slate-400 text-[11px]">— Requires published rule version</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActivationBlockedOpen(false)}
              className="px-5 py-2 rounded-xl bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-500"
            >
              Acknowledge & Complete Rules
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linked Stage Tab Component for Tabs 3-13
// ---------------------------------------------------------------------------

function LinkedStageTabPanel({
  tab,
  country,
  configuration,
  completeness,
  onSaveRule,
  onSaveTaxBracket,
  onRefresh,
}: {
  tab: (typeof ALL_TABS)[number];
  country: CountrySummary;
  configuration: CountryConfiguration | null;
  completeness: { isComplete: boolean; label: string; tone: 'green' | 'amber' | 'slate' };
  onSaveRule?: (
    ruleType: CountryRuleKind,
    payload: Record<string, unknown>,
    effectiveFrom: string,
    effectiveTo?: string | null,
  ) => Promise<void>;
  onSaveTaxBracket?: (input: {
    taxYear: number;
    bracketJson: Record<string, unknown>;
    effectiveFrom: string;
    effectiveTo?: string;
  }) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const Icon = tab.icon;
  const [jsonText, setJsonText] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('2024-07-01');
  const [savingRule, setSavingRule] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Find relevant rule or tax bracket
  const relevantRule = useMemo(() => {
    if (!configuration || !tab.categoryKind) return null;
    return configuration.rules.find((r) => r.ruleType === tab.categoryKind) || null;
  }, [configuration, tab.categoryKind]);

  const relevantTaxBracket = useMemo(() => {
    if (!configuration || tab.key !== 'Tax') return null;
    return configuration.taxBrackets[0] || null;
  }, [configuration, tab.key]);

  useEffect(() => {
    if (tab.key === 'Tax') {
      if (relevantTaxBracket) {
        setJsonText(JSON.stringify(relevantTaxBracket.bracketJson, null, 2));
        setEffectiveFrom(relevantTaxBracket.effectiveFrom.slice(0, 10));
      } else {
        setJsonText(
          JSON.stringify(
            {
              currency: country.currency,
              taxYear: new Date().getFullYear(),
              brackets: [
                { threshold: 0, rate: 0.0, baseAmount: 0 },
                { threshold: 18200, rate: 0.16, baseAmount: 0 },
                { threshold: 45000, rate: 0.3, baseAmount: 4288 },
                { threshold: 135000, rate: 0.37, baseAmount: 31288 },
                { threshold: 190000, rate: 0.45, baseAmount: 51638 },
              ],
            },
            null,
            2,
          ),
        );
      }
    } else if (relevantRule) {
      setJsonText(JSON.stringify(relevantRule.payload, null, 2));
      setEffectiveFrom(relevantRule.effectiveFrom.slice(0, 10));
    } else {
      // Default sample payload based on tab
      const sample = getDefaultPayloadForTab(tab.key);
      setJsonText(JSON.stringify(sample, null, 2));
    }
  }, [tab.key, relevantRule, relevantTaxBracket, country.currency]);

  function getDefaultPayloadForTab(key: CountryDetailTab): Record<string, unknown> {
    switch (key) {
      case 'Leave':
        return {
          annual_leave_days: 20,
          sick_leave_days: 10,
          maternity_leave_weeks: 18,
          paternity_leave_weeks: 2,
          compassionate_leave_days: 2,
        };
      case 'Working Hours':
      case 'Overtime':
        return {
          standard_weekly_hours: 38,
          standard_daily_hours: 7.6,
          overtime_rate_tier1: 1.5,
          overtime_tier1_hours_cap: 2,
          overtime_rate_tier2: 2.0,
          weekend_multiplier: 2.0,
        };
      case 'Public Holidays':
        return {
          holidays: [
            { name: "New Year's Day", date: '2026-01-01', observed: '2026-01-01' },
            { name: 'National Holiday', date: '2026-01-26', observed: '2026-01-26' },
            { name: 'Labor Day', date: '2026-05-01', observed: '2026-05-01' },
          ],
        };
      case 'Social Security':
      case 'Pension':
        return {
          employer_contribution_rate: 0.115,
          employee_contribution_rate: 0.0,
          statutory_fund_name: 'Superannuation Guarantee',
          max_contribution_cap_quarterly: 30000,
        };
      case 'Employment':
        return {
          standard_probation_months: 6,
          standard_notice_weeks: 4,
          minimum_wage_hourly: 24.1,
          max_daily_spread_hours: 12,
          rest_break_interval_hours: 5,
        };
      case 'Termination':
        return {
          notice_period_weeks: {
            under_1_year: 1,
            under_3_years: 2,
            under_5_years: 3,
            over_5_years: 4,
          },
          severance_pay_formula: 'weeks_per_year_of_service',
          max_severance_weeks: 16,
        };
      case 'Compliance':
        return {
          regulatory_authority: 'Statutory Labor & Safety Commission',
          mandatory_reporting_cycle: 'annual',
          health_safety_inspection_required: true,
        };
      default:
        return { configured: true };
    }
  }

  const handleSave = async () => {
    setSaveError(null);
    try {
      setSavingRule(true);
      const parsed = JSON.parse(jsonText);

      if (tab.key === 'Tax' && onSaveTaxBracket) {
        await onSaveTaxBracket({
          taxYear: new Date().getFullYear(),
          bracketJson: parsed,
          effectiveFrom,
        });
      } else if (tab.categoryKind && onSaveRule) {
        await onSaveRule(tab.categoryKind, parsed, effectiveFrom);
      }

      setSaveSuccess(true);
      await onRefresh();
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to parse JSON or save rule.');
    } finally {
      setSavingRule(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Linked Stage Specification Card */}
      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded">
                  {tab.stageCode}
                </span>
                <span className="text-xs font-semibold text-slate-400">•</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Linked Implementation Stage
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                {tab.stageName}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Completeness Badge */}
            <div
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border ${
                completeness.tone === 'green'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : completeness.tone === 'amber'
                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
              }`}
            >
              {completeness.tone === 'green' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <span>{completeness.label}</span>
            </div>

            <button
              type="button"
              onClick={() => alert(`Navigating to ${tab.stageName} specification.`)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 transition"
            >
              <span>View Linked Stage</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 mt-4 leading-relaxed">
          {tab.description}
        </p>

        {/* Rule Resolver Notice */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5 text-indigo-500" />
            Rule Resolver Chain: Global Default → <strong>Country Rules ({country.isoCode})</strong> → State Rules → Company Policy → Employee Contract
          </span>
          <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
            effective_from dating enforced
          </span>
        </div>
      </div>

      {/* Rule Payload & Version Configuration */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Effective Rule Definition & Version Parameters
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Statutory parameters stored in PostgreSQL and resolved at calculation time based on pay period dates.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Effective From:
            </label>
            <input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-mono font-bold focus:outline-none"
            />
          </div>
        </div>

        {saveSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Rule version updated successfully!</span>
          </div>
        )}

        {saveError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Rule Payload (JSON Schema Definition)
          </label>
          <textarea
            rows={10}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-950 p-3 font-mono text-xs text-emerald-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-[11px] text-slate-400">
            {tab.isRequired ? (
              <span className="text-amber-500 font-semibold">⚠️ Mandatory statutory rule required for country activation.</span>
            ) : (
              <span>Optional jurisdiction module. Default fallback rules applied if omitted.</span>
            )}
          </span>

          <button
            type="button"
            onClick={handleSave}
            disabled={savingRule}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition disabled:opacity-60"
          >
            {savingRule ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save & Publish Rule Version
          </button>
        </div>
      </div>
    </div>
  );
}
