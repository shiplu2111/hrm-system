import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FolderArchive,
  HardDrive,
  HelpCircle,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import type {
  CountrySummary,
  ProvisionTenantDto,
  TenantProvisioningResult,
} from '@hrm/shared-types';
import { listCountries } from '@/lib/platform-countries-api';
import { provisionPlatformTenant } from '@/lib/api-client';
import { Toggle } from '@/components/ui/Toggle';

const DEFAULT_COUNTRIES: CountrySummary[] = [
  {
    id: 'c-us',
    name: 'United States',
    isoCode: 'USA',
    currency: 'USD',
    timezone: 'America/New_York',
    dateFormat: 'YYYY-MM-DD',
    numberFormat: '1,234.56',
    defaultFinancialYearStart: '01-01',
    defaultPayFrequency: 'semi-monthly',
    status: 'active',
    tenantCount: 1,
    lastRuleUpdate: null,
  },
  {
    id: 'c-gb',
    name: 'United Kingdom',
    isoCode: 'GBR',
    currency: 'GBP',
    timezone: 'Europe/London',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: '1,234.56',
    defaultFinancialYearStart: '04-06',
    defaultPayFrequency: 'monthly',
    status: 'active',
    tenantCount: 1,
    lastRuleUpdate: null,
  },
  {
    id: 'c-de',
    name: 'Germany',
    isoCode: 'DEU',
    currency: 'EUR',
    timezone: 'Europe/Berlin',
    dateFormat: 'DD.MM.YYYY',
    numberFormat: '1.234,56',
    defaultFinancialYearStart: '01-01',
    defaultPayFrequency: 'monthly',
    status: 'active',
    tenantCount: 1,
    lastRuleUpdate: null,
  },
  {
    id: 'c-sg',
    name: 'Singapore',
    isoCode: 'SGP',
    currency: 'SGD',
    timezone: 'Asia/Singapore',
    dateFormat: 'YYYY-MM-DD',
    numberFormat: '1,234.56',
    defaultFinancialYearStart: '01-01',
    defaultPayFrequency: 'monthly',
    status: 'active',
    tenantCount: 1,
    lastRuleUpdate: null,
  },
  {
    id: 'c-au',
    name: 'Australia',
    isoCode: 'AUS',
    currency: 'AUD',
    timezone: 'Australia/Sydney',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: '1,234.56',
    defaultFinancialYearStart: '07-01',
    defaultPayFrequency: 'monthly',
    status: 'active',
    tenantCount: 1,
    lastRuleUpdate: null,
  },
  {
    id: 'c-ae',
    name: 'United Arab Emirates',
    isoCode: 'ARE',
    currency: 'AED',
    timezone: 'Asia/Dubai',
    dateFormat: 'YYYY-MM-DD',
    numberFormat: '1,234.56',
    defaultFinancialYearStart: '01-01',
    defaultPayFrequency: 'monthly',
    status: 'active',
    tenantCount: 1,
    lastRuleUpdate: null,
  },
  {
    id: 'c-bd',
    name: 'Bangladesh',
    isoCode: 'BDT',
    currency: 'BDT',
    timezone: 'Asia/Dhaka',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: '1,234.56',
    defaultFinancialYearStart: '07-01',
    defaultPayFrequency: 'monthly',
    status: 'active',
    tenantCount: 1,
    lastRuleUpdate: null,
  },
];

const PLAN_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 299,
    annualPrice: 2990,
    seats: 'Up to 250 employees',
    features: [
      'Core HR & Employee Directory',
      'Employee Self-Service (ESS)',
      'Standard Attendance & Leave',
      'Single Country Baseline',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    monthlyPrice: 899,
    annualPrice: 8990,
    seats: 'Up to 1,000 employees',
    popular: true,
    features: [
      'Advanced Multi-Shift Roster & Swaps',
      'Multi-Company / Multi-Branch',
      'Expense Management & Tracking',
      'Automated Payroll Adjustments',
      'Audit Logging & Webhooks',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 2500,
    annualPrice: 25000,
    seats: 'Unlimited employees',
    features: [
      'Custom Country Statutory Rules',
      'Dedicated Database Isolation Pool',
      'Custom Storage Driver / BYO Bucket',
      'Single Sign-On (SAML / OAuth2)',
      '24/7 SLA & Dedicated Support Manager',
    ],
  },
];

const PROVISIONING_STEPS = [
  'Allocating tenant namespace and database partition...',
  'Seeding primary company & statutory compliance rules...',
  'Generating default RBAC roles and permissions (Stage C.0)...',
  'Seeding default document types, leave policies, and onboarding checklists (Stage C.0)...',
  'Configuring notification templates & storage driver (Stage C.0)...',
  'Creating initial Company Owner account & dispatching invitation...',
  'Committing immutable platform audit log record...',
];

interface CreateTenantWizardProps {
  onCancel: () => void;
  onSuccess: (result: TenantProvisioningResult) => void;
}

export function CreateTenantWizard({ onCancel, onSuccess }: CreateTenantWizardProps) {
  const [step, setStep] = useState<number>(1);

  // --- Step 1: Company Details & Country ---
  const [companyName, setCompanyName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('USA');
  const [countries, setCountries] = useState<CountrySummary[]>(DEFAULT_COUNTRIES);
  const [isLoadingCountries, setIsLoadingCountries] = useState(false);

  // --- Step 2: Plan & Billing & Trial Length ---
  const [selectedPlanId, setSelectedPlanId] = useState<'starter' | 'business' | 'enterprise'>('business');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [trialDays, setTrialDays] = useState<number>(14);

  // --- Step 3: Storage Driver Choice ---
  const [storageDriver, setStorageDriver] = useState<'local' | 's3'>('local');

  // --- Step 4: Company Owner Details & Reason ---
  const [ownerFirstName, setOwnerFirstName] = useState('');
  const [ownerLastName, setOwnerLastName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [sendInvite, setSendInvite] = useState(true);
  const [reason, setReason] = useState('Customer onboarding approval via Platform Super Admin');

  // --- Step 6: Provisioning Execution State ---
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [currentProgressIndex, setCurrentProgressIndex] = useState(0);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [provisionResult, setProvisionResult] = useState<TenantProvisioningResult | null>(null);

  // Load configured countries from backend
  useEffect(() => {
    let isMounted = true;
    setIsLoadingCountries(true);
    listCountries()
      .then((data) => {
        if (isMounted && data && data.length > 0) {
          setCountries(data);
          if (!data.some((c) => c.isoCode === selectedCountryCode)) {
            setSelectedCountryCode(data[0].isoCode);
          }
        }
      })
      .catch(() => {
        // Fall back gracefully to DEFAULT_COUNTRIES
      })
      .finally(() => {
        if (isMounted) setIsLoadingCountries(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedCountry =
    countries.find((c) => c.isoCode === selectedCountryCode) ?? countries[0];

  const selectedPlan =
    PLAN_TIERS.find((p) => p.id === selectedPlanId) ?? PLAN_TIERS[1];

  // Auto-generate subdomain from company name if not manually modified
  const handleCompanyNameChange = (value: string) => {
    setCompanyName(value);
    if (!subdomain || subdomain === companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 32);
      setSubdomain(slug);
    }
  };

  const isSubdomainValid =
    subdomain.length >= 3 &&
    subdomain.length <= 63 &&
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(subdomain) &&
    !['admin', 'platform', 'api', 'app', 'system'].includes(subdomain);

  // Step Validation
  const canProceedStep1 = companyName.trim().length >= 2 && isSubdomainValid && selectedCountryCode;
  const canProceedStep2 = Boolean(selectedPlanId && billingCycle);
  const canProceedStep3 = Boolean(storageDriver);
  const canProceedStep4 =
    ownerFirstName.trim().length >= 1 &&
    ownerLastName.trim().length >= 1 &&
    ownerEmail.includes('@') &&
    reason.trim().length >= 5;

  const handleStartProvisioning = async () => {
    setStep(6);
    setIsProvisioning(true);
    setProvisionError(null);
    setCurrentProgressIndex(0);

    const dto: ProvisionTenantDto = {
      name: companyName.trim(),
      subdomain: subdomain.trim().toLowerCase(),
      planId: selectedPlanId,
      billingCycle,
      trialDays,
      countryCode: selectedCountryCode,
      storageDriver,
      ownerFirstName: ownerFirstName.trim(),
      ownerLastName: ownerLastName.trim(),
      ownerEmail: ownerEmail.trim().toLowerCase(),
      reason: reason.trim(),
    };

    // Animate progress steps while calling the API
    const progressTimer = setInterval(() => {
      setCurrentProgressIndex((prev) => {
        if (prev < PROVISIONING_STEPS.length - 2) {
          return prev + 1;
        }
        return prev;
      });
    }, 450);

    try {
      const result = await provisionPlatformTenant(dto);
      clearInterval(progressTimer);
      setCurrentProgressIndex(PROVISIONING_STEPS.length - 1);
      setTimeout(() => {
        setIsProvisioning(false);
        setProvisionResult(result);
        onSuccess(result);
      }, 500);
    } catch (err: any) {
      clearInterval(progressTimer);
      setIsProvisioning(false);
      setProvisionError(err.message || 'Provisioning failed. Please verify the subdomain and parameters.');
    }
  };

  const stepsHeader = [
    { num: 1, label: 'Company & Country' },
    { num: 2, label: 'Plan & Billing' },
    { num: 3, label: 'Storage Driver' },
    { num: 4, label: 'Owner & Audit' },
    { num: 5, label: 'Summary & Confirm' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Top Back / Cancel bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProvisioning}
          className="flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-primary transition-colors disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" /> Cancel Onboarding
        </button>
        <span className="text-xs font-mono text-amber-500 font-semibold flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Stage B · Platform Control Plane</span>
        </span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
          <Building2 className="h-7 w-7 text-amber-500" />
          <span>Provision New Tenant Workspace</span>
        </h1>
        <p className="text-sm text-secondary mt-1">
          Initialize isolated tenant partitions, country baselines, storage drivers, and initial administrator credentials.
        </p>
      </div>

      {/* Stepper Indicator */}
      {step <= 5 && (
        <div className="grid grid-cols-5 gap-2">
          {stepsHeader.map((s) => {
            const isCompleted = step > s.num;
            const isCurrent = step === s.num;
            return (
              <div key={s.num} className="space-y-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    isCompleted
                      ? 'bg-amber-600'
                      : isCurrent
                        ? 'bg-amber-500 shadow-sm'
                        : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                />
                <div
                  className={`text-[11px] font-bold truncate ${
                    isCurrent
                      ? 'text-amber-600 dark:text-amber-400'
                      : isCompleted
                        ? 'text-slate-700 dark:text-slate-300'
                        : 'text-slate-400 dark:text-slate-600'
                  }`}
                >
                  {s.num}. {s.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Wizard Content Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-card min-h-[460px]">
        {/* ==================== STEP 1: COMPANY & COUNTRY ==================== */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Organization & Jurisdiction Baseline</span>
              </h2>
              <p className="text-xs text-secondary mt-0.5">
                Workspace subdomain defines data isolation boundaries. Country configuration determines statutory tax brackets, public holidays, and employment rules.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Company Legal Name */}
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Legal Organization Name *</span>
                  <span className="text-[11px] text-slate-400 font-normal">e.g. Acme Corporation Pty Ltd</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => handleCompanyNameChange(e.target.value)}
                  placeholder="Acme Corporation"
                  className="mt-1.5 w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              {/* Subdomain Identifier */}
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Subdomain Prefix *</span>
                  <span className="text-[11px] text-slate-400 font-normal">Used for workspace URL & storage partitions</span>
                </label>
                <div className="mt-1.5 flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-950 focus-within:border-amber-500 shadow-sm">
                  <input
                    type="text"
                    value={subdomain}
                    onChange={(e) =>
                      setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    }
                    placeholder="acme"
                    className="flex-1 h-11 px-4 bg-transparent text-sm font-mono focus:outline-none"
                  />
                  <span className="px-4 bg-slate-50 dark:bg-slate-800 text-xs text-secondary flex items-center font-mono border-l border-slate-200 dark:border-slate-700 select-none">
                    .cmsnbd.com
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1.5 text-xs">
                  {subdomain ? (
                    <span
                      className={`font-medium flex items-center gap-1 ${
                        isSubdomainValid ? 'text-emerald-500' : 'text-red-500'
                      }`}
                    >
                      {isSubdomainValid ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Subdomain format valid
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3.5 w-3.5" /> 3-63 characters, lowercase letters, numbers, hyphens
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-400">Must be unique across the platform</span>
                  )}
                  <span className="font-mono text-[11px] text-slate-400">
                    https://{subdomain || 'company'}.cmsnbd.com
                  </span>
                </div>
              </div>

              {/* Country Selection */}
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Country Baseline (Loaded from Country Config) *</span>
                  {isLoadingCountries && (
                    <span className="text-[11px] text-amber-500 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading country rules...
                    </span>
                  )}
                </label>
                <select
                  value={selectedCountryCode}
                  onChange={(e) => setSelectedCountryCode(e.target.value)}
                  className="mt-1.5 w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-amber-500 shadow-sm"
                >
                  {countries.map((c) => (
                    <option key={c.isoCode} value={c.isoCode}>
                      {c.name} ({c.isoCode}) — {c.currency} · {c.timezone}
                    </option>
                  ))}
                </select>

                {/* Country Config Metadata Details */}
                {selectedCountry && (
                  <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-secondary">ISO Code</div>
                      <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                        {selectedCountry.isoCode}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-secondary">Currency</div>
                      <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                        {selectedCountry.currency}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-secondary">Timezone</div>
                      <div className="font-medium text-slate-900 dark:text-white mt-0.5 truncate">
                        {selectedCountry.timezone}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-secondary">Rule Config</div>
                      <div className="font-medium text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        <span>Preconfigured</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== STEP 2: PLAN, BILLING CYCLE & TRIAL LENGTH ==================== */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Plan Tier, Billing Cycle & Trial Duration</span>
              </h2>
              <p className="text-xs text-secondary mt-0.5">
                Select the commercial tier, payment frequency, and evaluation window for this tenant.
              </p>
            </div>

            {/* Billing Cycle Selector */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Billing Frequency
                </div>
                <div className="text-[11px] text-secondary mt-0.5">
                  Annual subscriptions receive an upfront discount and automatic provisioning priority.
                </div>
              </div>
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    billingCycle === 'monthly'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    billingCycle === 'annual'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <span>Annual</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500 text-white">
                    Save ~17%
                  </span>
                </button>
              </div>
            </div>

            {/* Plan Tier Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLAN_TIERS.map((tier) => {
                const isSelected = selectedPlanId === tier.id;
                const price =
                  billingCycle === 'annual'
                    ? tier.id === 'enterprise'
                      ? 'Custom'
                      : `$${(tier.annualPrice / 12).toFixed(0)}`
                    : tier.id === 'enterprise'
                      ? 'Custom'
                      : `$${tier.monthlyPrice}`;

                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedPlanId(tier.id as any)}
                    className={`relative p-5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/30 dark:bg-amber-950/20 shadow-md ring-2 ring-amber-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-950'
                    }`}
                  >
                    {tier.popular && (
                      <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white shadow-sm">
                        RECOMMENDED
                      </span>
                    )}

                    <div className="font-extrabold text-slate-900 dark:text-white text-base">
                      {tier.name}
                    </div>
                    <div className="text-2xl font-black mt-2 text-slate-900 dark:text-white flex items-baseline gap-1">
                      <span>{price}</span>
                      {tier.id !== 'enterprise' && (
                        <span className="text-xs text-secondary font-normal">/mo</span>
                      )}
                    </div>
                    <div className="text-xs text-secondary mt-1 mb-4 font-medium">{tier.seats}</div>

                    <div className="space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                      {tier.features.map((f) => (
                        <div
                          key={f}
                          className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300"
                        >
                          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Trial Length Selection */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Evaluation / Trial Period</span>
                <span className="text-[11px] text-secondary">
                  Tenant status will be set to <code className="font-mono text-amber-500">trial</code> until expiry
                </span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                {[
                  { days: 7, label: '7 Days Trial' },
                  { days: 14, label: '14 Days (Default)' },
                  { days: 30, label: '30 Days Extended' },
                  { days: 0, label: 'No Trial (Active)' },
                ].map((opt) => (
                  <button
                    key={opt.days}
                    type="button"
                    onClick={() => setTrialDays(opt.days)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      trialDays === opt.days
                        ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== STEP 3: STORAGE DRIVER CHOICE (FILE_STORAGE.md) ==================== */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FolderArchive className="h-5 w-5 text-amber-500" />
                <span>Storage Architecture & File Driver (FILE_STORAGE.md)</span>
              </h2>
              <p className="text-xs text-secondary mt-0.5">
                Select the storage backend for employee documents, payslip PDFs, and avatars. Keys adhere strictly to the tenant-isolated naming convention: <code className="font-mono text-[11px] text-amber-500">{`{tenant_id}/{module}/{entity_id}/{filename}`}</code>.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Local Storage Driver Card */}
              <button
                type="button"
                onClick={() => setStorageDriver('local')}
                className={`p-5 rounded-2xl border text-left transition-all relative ${
                  storageDriver === 'local'
                    ? 'border-amber-500 bg-amber-50/30 dark:bg-amber-950/20 shadow-md ring-2 ring-amber-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-950'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
                      <HardDrive className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-extrabold text-slate-900 dark:text-white">
                        Local Server Storage
                      </div>
                      <div className="text-[11px] font-mono text-secondary">STORAGE_DRIVER=local</div>
                    </div>
                  </div>
                  {storageDriver === 'local' && (
                    <span className="h-6 w-6 rounded-full bg-amber-500 text-white flex items-center justify-center">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Hosted on server disk at <code className="font-mono text-[11px]">LOCAL_STORAGE_PATH</code></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Access stream secured via authenticated API route with RBAC checks</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Zero external cloud vendor dependencies; optimal for on-prem or single server</span>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-secondary">
                  <strong>Backup rule:</strong> Storage path must be included in server cron backup routine.
                </div>
              </button>

              {/* S3 Object Storage Card */}
              <button
                type="button"
                onClick={() => setStorageDriver('s3')}
                className={`p-5 rounded-2xl border text-left transition-all relative ${
                  storageDriver === 's3'
                    ? 'border-amber-500 bg-amber-50/30 dark:bg-amber-950/20 shadow-md ring-2 ring-amber-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-950'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
                      <Server className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-extrabold text-slate-900 dark:text-white">
                        S3-Compatible Object Storage
                      </div>
                      <div className="text-[11px] font-mono text-secondary">STORAGE_DRIVER=s3</div>
                    </div>
                  </div>
                  {storageDriver === 's3' && (
                    <span className="h-6 w-6 rounded-full bg-amber-500 text-white flex items-center justify-center">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Compatible with AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Private bucket with short-lived presigned URLs generated server-side</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Automatic multi-region durability and versioning retention policies</span>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-secondary">
                  <strong>Access rule:</strong> Strictly private; direct public bucket access is prohibited.
                </div>
              </button>
            </div>

            {/* Architecture Explainer Box */}
            <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-amber-500" />
                <span>Driver Isolation Abstraction (FILE_STORAGE.md §2)</span>
              </div>
              <p className="leading-relaxed text-[11px]">
                Both drivers strictly share the uniform driver interface (<code className="font-mono">upload</code>, <code className="font-mono">getUrl</code>, <code className="font-mono">delete</code>, <code className="font-mono">exists</code>). Migrations between local disk and S3 can be executed as seamless background jobs without mutating database references.
              </p>
            </div>
          </div>
        )}

        {/* ==================== STEP 4: OWNER SETUP & MANDATORY AUDIT REASON ==================== */}
        {step === 4 && (
          <div className="space-y-6 animate-fade-in">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <User className="h-5 w-5 text-amber-500" />
                <span>Primary Administrator & Audit Justification</span>
              </h2>
              <p className="text-xs text-secondary mt-0.5">
                The Company Owner receives root administrative privileges for this organization. Every lifecycle mutation requires a mandatory audit reason.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Owner First Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Owner First Name *
                </label>
                <input
                  type="text"
                  value={ownerFirstName}
                  onChange={(e) => setOwnerFirstName(e.target.value)}
                  placeholder="Sarah"
                  className="mt-1.5 w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              {/* Owner Last Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Owner Last Name *
                </label>
                <input
                  type="text"
                  value={ownerLastName}
                  onChange={(e) => setOwnerLastName(e.target.value)}
                  placeholder="Connor"
                  className="mt-1.5 w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              {/* Owner Email */}
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Company Owner Work Email *
                </label>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="sarah.connor@acme.com"
                  className="mt-1.5 w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              {/* Send Invitation Toggle */}
              <div className="md:col-span-2 flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-amber-500" />
                    <span>Send Welcome Email Invitation</span>
                  </div>
                  <div className="text-[11px] text-secondary">
                    Admin receives a secure password setup link. If unchecked, a temporary one-time password is generated.
                  </div>
                </div>
                <Toggle checked={sendInvite} onChange={setSendInvite} />
              </div>

              {/* Mandatory Reason Field (Audit Rule) */}
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Mandatory Provisioning Reason (Recorded in platform_audit_logs) *</span>
                  <span className="text-[10px] text-amber-500 uppercase font-mono font-bold">Mandatory</span>
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Approved sales enterprise agreement #EA-2026-881 for North America expansion"
                  className="mt-1.5 w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-amber-500 shadow-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* ==================== STEP 5: REVIEW & SUMMARY ==================== */}
        {step === 5 && (
          <div className="space-y-6 animate-fade-in">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <span>Review & Confirm Workspace Provisioning</span>
              </h2>
              <p className="text-xs text-secondary mt-0.5">
                Verify all configuration parameters before triggering the asynchronous BullMQ tenant initialization job.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Organization & Subdomain */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-[10px] uppercase font-bold text-secondary">Organization & Domain</div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">{companyName}</div>
                <div className="text-xs font-mono text-amber-600 dark:text-amber-400">
                  https://{subdomain}.cmsnbd.com
                </div>
              </div>

              {/* Country & Compliance */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-[10px] uppercase font-bold text-secondary">Country Jurisdiction</div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {selectedCountry.name} ({selectedCountry.isoCode})
                </div>
                <div className="text-xs text-secondary font-mono">
                  {selectedCountry.currency} · {selectedCountry.timezone}
                </div>
              </div>

              {/* Subscription Plan & Billing */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-[10px] uppercase font-bold text-secondary">Plan & Billing Cycle</div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {selectedPlan.name} Tier ({billingCycle.toUpperCase()})
                </div>
                <div className="text-xs text-secondary">
                  {trialDays > 0 ? `${trialDays} Days Evaluation Trial` : 'Immediate Active Subscription'}
                </div>
              </div>

              {/* Storage Architecture */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-[10px] uppercase font-bold text-secondary">Storage Backend</div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  {storageDriver === 's3' ? (
                    <>
                      <Server className="h-4 w-4 text-amber-500" /> S3-Compatible Object Storage
                    </>
                  ) : (
                    <>
                      <HardDrive className="h-4 w-4 text-emerald-500" /> Local Server Disk Storage
                    </>
                  )}
                </div>
                <div className="text-xs font-mono text-secondary">
                  {storageDriver === 's3' ? 'Private bucket + signed URLs' : '/var/app/storage/{tenant_id}/...'}
                </div>
              </div>

              {/* Owner Setup */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-[10px] uppercase font-bold text-secondary">Company Owner</div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {ownerFirstName} {ownerLastName}
                </div>
                <div className="text-xs font-mono text-secondary">{ownerEmail}</div>
              </div>

              {/* Audit Reason */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-[10px] uppercase font-bold text-secondary">Audit Justification</div>
                <div className="text-xs text-slate-700 dark:text-slate-300 italic line-clamp-2">
                  "{reason}"
                </div>
                <div className="text-[10px] text-amber-500 font-mono">Logged to platform_audit_logs</div>
              </div>
            </div>

            {/* Notice banner */}
            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-950 dark:text-indigo-200 flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block mb-0.5">Stage C.0 Provisioning Defaults:</strong>
                This tenant will be seeded with currently published platform default templates: RBAC roles & permissions, document types, leave policies, notifications, and onboarding checklists. Subsequent modifications to platform defaults will never alter this tenant.
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
              <Server className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong>BullMQ Provisioning Flow:</strong> Creating this tenant will allocate database partitions, seed default document types, configure notification templates, dispatch the initial owner invitation, and lock the audit record.
              </div>
            </div>
          </div>
        )}

        {/* ==================== STEP 6: EXECUTION & PROGRESS ==================== */}
        {step === 6 && (
          <div className="py-6 space-y-6 animate-fade-in max-w-xl mx-auto text-center">
            {isProvisioning && (
              <div className="space-y-6">
                <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Provisioning Tenant Workspace...
                  </h3>
                  <p className="text-xs text-secondary mt-1">
                    Executing BullMQ job: <code className="font-mono text-amber-500">{subdomain}.cmsnbd.com</code>
                  </p>
                </div>

                <div className="space-y-2.5 text-left bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                  {PROVISIONING_STEPS.map((sText, idx) => {
                    const isDone = idx < currentProgressIndex;
                    const isCurrent = idx === currentProgressIndex;
                    return (
                      <div
                        key={sText}
                        className={`flex items-center gap-2.5 transition-all ${
                          isDone
                            ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                            : isCurrent
                              ? 'text-amber-600 dark:text-amber-400 font-bold'
                              : 'text-slate-400 dark:text-slate-600'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        ) : isCurrent ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-500" />
                        ) : (
                          <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700 ml-1 shrink-0" />
                        )}
                        <span>{sText}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Error state */}
            {!isProvisioning && provisionError && (
              <div className="space-y-4">
                <div className="h-14 w-14 mx-auto rounded-2xl bg-red-500/15 text-red-500 flex items-center justify-center">
                  <AlertTriangle className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400">
                    Workspace Provisioning Failed
                  </h3>
                  <p className="text-xs text-secondary mt-1">{provisionError}</p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                  >
                    Edit Parameters
                  </button>
                  <button
                    type="button"
                    onClick={handleStartProvisioning}
                    className="h-10 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Retry Provisioning</span>
                  </button>
                </div>
              </div>
            )}

            {/* Success state */}
            {!isProvisioning && provisionResult && (
              <div className="space-y-6">
                <div className="h-16 w-16 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="h-9 w-9" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Tenant Provisioned Successfully!
                  </h3>
                  <p className="text-xs text-secondary mt-1 max-w-md mx-auto">
                    {provisionResult.message || `Tenant "${provisionResult.name}" is now live and ready for setup.`}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-secondary font-medium">Tenant ID</span>
                    <span className="font-mono font-bold">{provisionResult.tenantId}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-secondary font-medium">Workspace URL</span>
                    <a
                      href={`https://${provisionResult.subdomain}.cmsnbd.com`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-600 hover:underline flex items-center gap-1 font-mono font-bold"
                    >
                      <span>https://{provisionResult.subdomain}.cmsnbd.com</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-secondary font-medium">Company Owner</span>
                    <span className="font-medium">{provisionResult.ownerEmail}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-secondary font-medium">Invitation Status</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <Check className="h-3 w-3" /> Dispatched
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="h-10 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors"
                  >
                    View in Tenants Directory
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setCompanyName('');
                      setSubdomain('');
                      setOwnerFirstName('');
                      setOwnerLastName('');
                      setOwnerEmail('');
                      setProvisionResult(null);
                    }}
                    className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                  >
                    Provision Another Tenant
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Buttons for Steps 1 - 5 */}
      {step <= 5 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => (step === 1 ? onCancel() : setStep(step - 1))}
            className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-secondary hover:text-primary transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          <button
            type="button"
            disabled={
              (step === 1 && !canProceedStep1) ||
              (step === 2 && !canProceedStep2) ||
              (step === 3 && !canProceedStep3) ||
              (step === 4 && !canProceedStep4)
            }
            onClick={() => (step === 5 ? handleStartProvisioning() : setStep(step + 1))}
            className="h-10 px-6 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-40 transition-colors shadow-sm"
          >
            {step === 5 ? (
              <>
                <Check className="h-4 w-4" /> Start Provisioning Job
              </>
            ) : (
              <>
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
