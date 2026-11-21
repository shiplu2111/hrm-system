import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  Coins,
  DollarSign,
  Eye,
  EyeOff,
  Gauge,
  HelpCircle,
  Info,
  Layers,
  Loader2,
  Plus,
  Shield,
  X,
} from 'lucide-react';
import type {
  PlatformPlanDetailView,
  PlatformPlanLimitView,
  PlatformPlanPriceView,
} from '@hrm/shared-types';
import {
  createPlanPrice,
  createPlatformPlan,
  updatePlanLimits,
  updatePlatformPlan,
} from '@/lib/plans-api';

interface PlanEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PlatformPlanDetailView | null; // null for creating a new plan
  onSuccess: () => void;
  canEdit: boolean;
}

const SUPPORTED_CURRENCIES = ['USD', 'AUD', 'EUR', 'GBP', 'BDT'];

const LIMIT_DEFINITIONS: { key: string; label: string; description: string; defaultUnlimited: boolean }[] = [
  { key: 'employees', label: 'Maximum Employees', description: 'Cap on active employee profiles in tenant', defaultUnlimited: false },
  { key: 'storage_gb', label: 'Document Storage (GB)', description: 'Total cloud storage for contracts, receipts & docs', defaultUnlimited: false },
  { key: 'api_calls', label: 'Monthly API Calls', description: 'Rate limit cap per calendar month', defaultUnlimited: true },
  { key: 'companies', label: 'Legal Entities / Companies', description: 'Number of subsidiaries under single tenant', defaultUnlimited: true },
];

export function PlanEditorModal({
  isOpen,
  onClose,
  plan,
  onSuccess,
  canEdit,
}: PlanEditorModalProps) {
  const isEditing = Boolean(plan);

  // Tabs: 'general' | 'limits' | 'prices'
  const [activeTab, setActiveTab] = useState<'general' | 'limits' | 'prices'>('general');

  // General fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [rank, setRank] = useState(0);
  const [isActive, setIsActive] = useState(true);

  // Limits fields
  const [limitsMap, setLimitsMap] = useState<Record<string, number | null>>({
    employees: 25,
    storage_gb: 5,
    api_calls: null,
    companies: 1,
  });

  // Price form fields
  const [currency, setCurrency] = useState('USD');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [amount, setAmount] = useState<string>('49.00');
  const [perSeatAmount, setPerSeatAmount] = useState<string>('');
  const [effectiveFrom, setEffectiveFrom] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });

  const [pricesList, setPricesList] = useState<PlatformPlanPriceView[]>([]);

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    setSuccessNotice(null);

    if (plan) {
      setName(plan.name);
      setCode(plan.code);
      setDescription(plan.description ?? '');
      setRank(plan.rank ?? 0);
      setIsActive(plan.isActive);
      setPricesList(plan.prices ?? []);

      const newLimits: Record<string, number | null> = {};
      LIMIT_DEFINITIONS.forEach((def) => {
        const found = (plan.limits ?? []).find((l) => l.limitKey === def.key);
        newLimits[def.key] = found !== undefined ? found.value : (def.defaultUnlimited ? null : 10);
      });
      setLimitsMap(newLimits);
    } else {
      setName('');
      setCode('');
      setDescription('');
      setRank(0);
      setIsActive(true);
      setPricesList([]);
      setLimitsMap({
        employees: 10,
        storage_gb: 2,
        api_calls: null,
        companies: 1,
      });
    }
    setActiveTab('general');
  }, [isOpen, plan]);

  if (!isOpen) return null;

  const handleGeneralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || isSubmitting) return;

    if (!name.trim()) {
      setErrorMessage('Plan name is required.');
      return;
    }
    if (!code.trim()) {
      setErrorMessage('Plan code slug is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      if (isEditing && plan) {
        await updatePlatformPlan(plan.id, {
          name: name.trim(),
          code: code.trim().toLowerCase(),
          description: description.trim() || undefined,
          rank: Number(rank),
          isActive,
        });

        // Also update limits
        const limitItems = Object.entries(limitsMap).map(([limitKey, value]) => ({
          limitKey,
          value,
        }));
        await updatePlanLimits(plan.id, limitItems);

        setSuccessNotice('Plan settings and limits updated successfully.');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 600);
      } else {
        const created = await createPlatformPlan({
          name: name.trim(),
          code: code.trim().toLowerCase(),
          description: description.trim() || undefined,
          rank: Number(rank),
          isActive,
        });

        // Update limits for created plan
        const limitItems = Object.entries(limitsMap).map(([limitKey, value]) => ({
          limitKey,
          value,
        }));
        await updatePlanLimits(created.id, limitItems);

        setSuccessNotice('New plan created successfully.');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 600);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save plan changes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || isSavingPrice || !plan) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setErrorMessage('Please enter a valid price amount.');
      return;
    }

    const parsedSeat = perSeatAmount ? parseFloat(perSeatAmount) : null;
    if (parsedSeat !== null && (isNaN(parsedSeat) || parsedSeat < 0)) {
      setErrorMessage('Please enter a valid per-seat price amount.');
      return;
    }

    if (!effectiveFrom) {
      setErrorMessage('Effective date is required.');
      return;
    }

    try {
      setIsSavingPrice(true);
      setErrorMessage(null);

      const effectiveDateIso = new Date(effectiveFrom).toISOString();
      const newPrice = await createPlanPrice(plan.id, {
        currency: currency.toUpperCase(),
        billingCycle,
        amount: parsedAmount,
        perSeatAmount: parsedSeat,
        effectiveFrom: effectiveDateIso,
      });

      setPricesList((prev) => [newPrice, ...prev]);
      setSuccessNotice(
        `Scheduled ${currency} ${billingCycle} price of $${parsedAmount} effective ${effectiveFrom}. Existing customers remain grandfathered.`,
      );
      setAmount('49.00');
      setPerSeatAmount('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to schedule price update.');
    } finally {
      setIsSavingPrice(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-editor-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 id="plan-editor-title" className="text-lg font-bold text-slate-900 dark:text-white">
                {isEditing && plan ? `Edit Plan: ${plan.name}` : 'Create Subscription Plan'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEditing
                  ? `Configure plan metadata, tier limits, and effective-dated commercial pricing`
                  : 'Define a new commercial or custom tier with standard feature defaults'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/30 dark:bg-slate-950/30">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'general'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Layers className="h-3.5 w-3.5" /> General & Visibility
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('limits')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'limits'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Gauge className="h-3.5 w-3.5" /> Plan Limits & Caps
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={() => setActiveTab('prices')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === 'prices'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Coins className="h-3.5 w-3.5" /> Effective-Dated Pricing
            </button>
          )}
        </div>

        {/* Feedback banners */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successNotice && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
            <Check className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Plan Display Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Starter, Growth, Enterprise"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Code Slug <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. starter, business"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-mono text-xs"
                    disabled={!canEdit || isEditing}
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    System identifier used by subscriptions and billing gateways.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Marketing Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Essential features for small teams up to 25 employees."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  disabled={!canEdit}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Display Rank Order
                  </label>
                  <input
                    type="number"
                    value={rank}
                    onChange={(e) => setRank(parseInt(e.target.value) || 0)}
                    min={0}
                    max={99}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    disabled={!canEdit}
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Lower rank displays first (0 = Free, 1 = Starter, 2 = Business, 3 = Enterprise).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Catalog Visibility (Public or Hidden)
                  </label>
                  <div className="mt-2 flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                    <div className="flex items-center gap-2">
                      {isActive ? (
                        <Eye className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-amber-500" />
                      )}
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {isActive ? 'Publicly Listed' : 'Hidden / Unlisted'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {isActive
                            ? 'Available on public pricing page and self-service signup.'
                            : 'Hidden from public pricing. Assigned via custom enterprise sales.'}
                        </div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        disabled={!canEdit}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'limits' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                Plan limits enforce tenant quotas server-side via the <strong>FeatureGateService</strong>. When reached, tenants receive a <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400">PLAN_LIMIT_REACHED</code> error with an upgrade prompt.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {LIMIT_DEFINITIONS.map((def) => {
                  const currentValue = limitsMap[def.key];
                  const isUnlimited = currentValue === null || currentValue === undefined;

                  return (
                    <div
                      key={def.key}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-900 dark:text-white">
                          {def.label}
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isUnlimited}
                            disabled={!canEdit}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setLimitsMap((prev) => ({
                                ...prev,
                                [def.key]: checked ? null : def.key === 'employees' ? 25 : def.key === 'storage_gb' ? 5 : 1,
                              }));
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Unlimited</span>
                        </label>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 min-h-6">
                        {def.description}
                      </p>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={isUnlimited ? '' : currentValue}
                          placeholder={isUnlimited ? '∞ Unlimited' : '0'}
                          disabled={isUnlimited || !canEdit}
                          min={0}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                            setLimitsMap((prev) => ({
                              ...prev,
                              [def.key]: isNaN(val) ? 0 : val,
                            }));
                          }}
                          className={`w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-indigo-500 ${
                            isUnlimited ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'prices' && isEditing && (
            <div className="space-y-6">
              {/* Mandatory Customer Grandfathering Warning */}
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" /> Grandfathering & Price Protection Rule
                </div>
                <p className="text-xs font-semibold leading-relaxed">
                  Changing a price applies to new subscriptions or on renewal only, never silently re-pricing existing customers.
                </p>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/70">
                  Previous price points remain active for existing subscribed tenants until explicit migration or contract renewal. Effective-dating sets the validity window automatically.
                </p>
              </div>

              {/* Schedule New Price Form */}
              {canEdit && (
                <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    <Plus className="h-4 w-4" /> Schedule New Effective-Dated Price
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Currency
                      </label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      >
                        {SUPPORTED_CURRENCIES.map((curr) => (
                          <option key={curr} value={curr}>
                            {curr}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Billing Cycle
                      </label>
                      <select
                        value={billingCycle}
                        onChange={(e) => setBillingCycle(e.target.value as 'monthly' | 'annual')}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="annual">Annual</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Base Amount ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Per-Seat ($) <span className="text-slate-400 font-normal">opt</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={perSeatAmount}
                        onChange={(e) => setPerSeatAmount(e.target.value)}
                        placeholder="None"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-end justify-between gap-3 pt-1">
                    <div className="w-full sm:w-auto">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Effective From Date
                      </label>
                      <input
                        type="date"
                        value={effectiveFrom}
                        onChange={(e) => setEffectiveFrom(e.target.value)}
                        className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddPrice}
                      disabled={isSavingPrice}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition disabled:opacity-50"
                    >
                      {isSavingPrice ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Scheduling...
                        </>
                      ) : (
                        <>
                          <Calendar className="h-3.5 w-3.5" /> Schedule Price
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Price Points History Table */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Effective-Dated Price History
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-[10px] uppercase font-bold text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5">Currency</th>
                        <th className="px-3 py-2.5">Cycle</th>
                        <th className="px-3 py-2.5">Base Price</th>
                        <th className="px-3 py-2.5">Per-Seat</th>
                        <th className="px-3 py-2.5">Effective From</th>
                        <th className="px-3 py-2.5">Effective To</th>
                        <th className="px-3 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {pricesList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-slate-400 text-xs">
                            No price records configured yet for this plan.
                          </td>
                        </tr>
                      ) : (
                        pricesList.map((p) => {
                          const isActivePrice = !p.effectiveTo || new Date(p.effectiveTo) > new Date();
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                              <td className="px-3 py-2 font-bold font-mono text-slate-900 dark:text-white">
                                {p.currency}
                              </td>
                              <td className="px-3 py-2 capitalize text-slate-600 dark:text-slate-300">
                                {p.billingCycle}
                              </td>
                              <td className="px-3 py-2 font-mono font-bold text-slate-900 dark:text-white">
                                ${p.amount.toFixed(2)}
                              </td>
                              <td className="px-3 py-2 font-mono text-slate-500">
                                {p.perSeatAmount !== null ? `$${p.perSeatAmount.toFixed(2)}` : '—'}
                              </td>
                              <td className="px-3 py-2 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                                {p.effectiveFrom ? p.effectiveFrom.slice(0, 10) : '—'}
                              </td>
                              <td className="px-3 py-2 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                                {p.effectiveTo ? p.effectiveTo.slice(0, 10) : 'Active / Present'}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    isActivePrice
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                  }`}
                                >
                                  {isActivePrice ? 'Active' : 'Closed'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
          >
            Cancel
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={handleGeneralSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> {isEditing ? 'Save Plan Changes' : 'Create Plan'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
