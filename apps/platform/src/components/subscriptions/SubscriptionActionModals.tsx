import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  PauseCircle,
  Percent,
  PlayCircle,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type {
  PlatformPlanDetailView,
  PlatformSubscriptionDetailView,
  PlatformSubscriptionListItem,
} from '@hrm/shared-types';
import {
  applySubscriptionDiscountOrCredit,
  cancelSubscription,
  changeSubscriptionPlan,
  extendSubscriptionTrial,
  pauseSubscription,
  resumeSubscription,
} from '@/lib/subscriptions-api';

interface ActionModalBaseProps {
  subscription: PlatformSubscriptionListItem | PlatformSubscriptionDetailView;
  onClose: () => void;
  onSuccess: (updated: PlatformSubscriptionDetailView) => void;
}

// ──────────────────────────────────────────────
// 1. CHANGE PLAN MODAL
// ──────────────────────────────────────────────
export function ChangePlanModal({
  subscription,
  plans,
  onClose,
  onSuccess,
}: ActionModalBaseProps & { plans: PlatformPlanDetailView[] }) {
  const [targetPlanId, setTargetPlanId] = useState(
    plans.find((p) => p.id !== subscription.planId)?.id ?? '',
  );
  const [effectiveImmediately, setEffectiveImmediately] = useState(true);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPlan = plans.find((p) => p.id === subscription.planId);
  const selectedPlan = plans.find((p) => p.id === targetPlanId);

  const isUpgrade =
    currentPlan && selectedPlan ? selectedPlan.rank > currentPlan.rank : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPlanId) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const updated = await changeSubscriptionPlan(subscription.id, {
        targetPlanId,
        effectiveImmediately,
        reason: reason.trim() || undefined,
      });
      onSuccess(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to change plan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Change Subscription Plan
            </h3>
            <p className="text-xs text-slate-500">
              Tenant: <span className="font-semibold text-slate-700 dark:text-slate-300">{subscription.tenantName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none p-1"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Select Target Commercial Tier
            </label>
            <select
              value={targetPlanId}
              onChange={(e) => setTargetPlanId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code.toUpperCase()}) {p.id === subscription.planId ? '— (Current Plan)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <span>{currentPlan?.name ?? subscription.planName}</span>
              <ArrowRight className="h-3.5 w-3.5 text-indigo-400" />
              <span className="font-bold underline">{selectedPlan?.name ?? 'Select tier'}</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              {isUpgrade
                ? 'Upgrading unlocks higher quota limits and advanced feature flags immediately.'
                : 'Downgrades scheduled for renewal allow the tenant to use prepaid cycle quotas until period end.'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Execution Timing
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border cursor-pointer text-left transition ${
                  effectiveImmediately
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="timing"
                  checked={effectiveImmediately}
                  onChange={() => setEffectiveImmediately(true)}
                  className="sr-only"
                />
                <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Immediate
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Updates entitlements and quotas right now
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer text-left transition ${
                  !effectiveImmediately
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="timing"
                  checked={!effectiveImmediately}
                  onChange={() => setEffectiveImmediately(false)}
                  className="sr-only"
                />
                <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-500" /> On Renewal
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Transitions on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Reason / Administrative Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Enterprise upgrade requested via account manager"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || targetPlanId === subscription.planId}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                </>
              ) : (
                'Confirm Plan Change'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 2. EXTEND TRIAL MODAL
// ──────────────────────────────────────────────
export function ExtendTrialModal({
  subscription,
  onClose,
  onSuccess,
}: ActionModalBaseProps) {
  const [days, setDays] = useState(14);
  const [customDate, setCustomDate] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentTrialEnd = subscription.trialEndsAt
    ? new Date(subscription.trialEndsAt)
    : new Date();

  const previewDate = customDate
    ? new Date(customDate)
    : new Date(currentTrialEnd.getTime() + days * 86400000);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A justification reason is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const updated = await extendSubscriptionTrial(subscription.id, {
        days: customDate ? undefined : days,
        newTrialEndsAt: customDate ? new Date(customDate).toISOString() : undefined,
        reason: reason.trim(),
      });
      onSuccess(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to extend trial.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Extend Evaluation Trial
            </h3>
            <p className="text-xs text-slate-500">
              Tenant: <span className="font-semibold text-slate-700 dark:text-slate-300">{subscription.tenantName}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1">
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Extension Duration
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[7, 14, 30].map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => {
                    setDays(d);
                    setCustomDate('');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                    !customDate && days === d
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  +{d} Days
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Or Choose Explicit New Trial End Date
            </label>
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
            <span className="text-slate-500">New Trial Expiration:</span>
            <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
              {previewDate.toLocaleDateString(undefined, { dateStyle: 'medium' })}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Justification Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              placeholder="e.g. Extended POC for client payroll testing before annual agreement"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Extending...
                </>
              ) : (
                'Save Trial Extension'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 3. APPLY DISCOUNT OR CREDIT MODAL
// ──────────────────────────────────────────────
export function DiscountCreditModal({
  subscription,
  onClose,
  onSuccess,
}: ActionModalBaseProps) {
  const [tab, setTab] = useState<'discount' | 'credit'>('discount');
  const [discountPercent, setDiscountPercent] = useState<number>(subscription.discountPercent ?? 15);
  const [creditAmount, setCreditAmount] = useState<number>(50);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A mandatory reason is required for applying discounts or credits.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const updated = await applySubscriptionDiscountOrCredit(subscription.id, {
        discountPercent: tab === 'discount' ? Number(discountPercent) : undefined,
        creditAmount: tab === 'credit' ? Number(creditAmount) : undefined,
        reason: reason.trim(),
      });
      onSuccess(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to apply discount/credit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Apply Discount or Credit
            </h3>
            <p className="text-xs text-slate-500">
              Tenant: <span className="font-semibold text-slate-700 dark:text-slate-300">{subscription.tenantName}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1">
            ✕
          </button>
        </div>

        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => setTab('discount')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
              tab === 'discount'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Percent className="h-3.5 w-3.5" /> Percentage Discount
          </button>
          <button
            type="button"
            onClick={() => setTab('credit')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
              tab === 'credit'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <DollarSign className="h-3.5 w-3.5" /> Credit Balance
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'discount' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Discount Percentage (1 - 100%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={100}
                  step={0.5}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                  className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Will be automatically applied as a reduction to future cycle renewal invoices.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Dollar Credit to Add ({subscription.currency})
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white"
                />
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">$</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Current Credit Balance: <span className="font-bold">${subscription.creditBalance.toFixed(2)}</span>.
                Credits draw down against upcoming invoices before charging cards.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Reason / Accounting Justification <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              placeholder="e.g. Non-profit pricing agreement or SLA breach compensation"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                </>
              ) : tab === 'discount' ? (
                'Save Discount'
              ) : (
                'Add Credit'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 4. PAUSE / RESUME MODAL
// ──────────────────────────────────────────────
export function PauseResumeModal({
  subscription,
  onClose,
  onSuccess,
}: ActionModalBaseProps) {
  const isPaused = subscription.status === 'paused';
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPaused && !reason.trim()) {
      setError('A mandatory reason is required to pause a subscription.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      let updated: PlatformSubscriptionDetailView;
      if (isPaused) {
        updated = await resumeSubscription(subscription.id, { reason: reason.trim() || undefined });
      } else {
        updated = await pauseSubscription(subscription.id, { reason: reason.trim() });
      }
      onSuccess(updated);
    } catch (err: any) {
      setError(err.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {isPaused ? <PlayCircle className="h-5 w-5 text-emerald-500" /> : <PauseCircle className="h-5 w-5 text-amber-500" />}
              {isPaused ? 'Resume Subscription' : 'Pause Subscription'}
            </h3>
            <p className="text-xs text-slate-500">
              Tenant: <span className="font-semibold text-slate-700 dark:text-slate-300">{subscription.tenantName}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1">
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {isPaused
              ? 'Resuming will restore regular recurring billing cycles and active tenant feature operations.'
              : 'Pausing suspends automated billing renewals. The tenant will enter a read-only or paused state per BILLING_SUBSCRIPTION.md.'}
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Reason / Administrative Justification {!isPaused && <span className="text-red-500">*</span>}
            </label>
            <textarea
              required={!isPaused}
              rows={2}
              placeholder={isPaused ? 'e.g. Operations resumed after seasonal downtime' : 'e.g. Seasonal break requested by company CEO'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl transition"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!isPaused && !reason.trim())}
              className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition shadow-sm flex items-center gap-1.5 disabled:opacity-50 ${
                isPaused ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-600 hover:bg-amber-500'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing...
                </>
              ) : isPaused ? (
                'Resume Subscription'
              ) : (
                'Pause Subscription'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 5. CANCEL SUBSCRIPTION MODAL
// ──────────────────────────────────────────────
export function CancelSubscriptionModal({
  subscription,
  onClose,
  onSuccess,
}: ActionModalBaseProps) {
  const [cancelImmediately, setCancelImmediately] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A mandatory reason is required for cancellation.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const updated = await cancelSubscription(subscription.id, {
        cancelImmediately,
        reason: reason.trim(),
      });
      onSuccess(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel subscription.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
              <XCircle className="h-5 w-5" /> Cancel Subscription
            </h3>
            <p className="text-xs text-slate-500">
              Tenant: <span className="font-semibold text-slate-700 dark:text-slate-300">{subscription.tenantName}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1">
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 space-y-1">
            <div className="text-xs font-bold text-red-700 dark:text-red-300">
              Data Preservation Assurance (BILLING_SUBSCRIPTION.md §7)
            </div>
            <p className="text-[11px] text-red-600 dark:text-red-400">
              Cancelling a subscription terminates active renewal charges. Tenant business data is preserved and never deleted automatically.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Cancellation Timing
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border cursor-pointer text-left transition ${
                  !cancelImmediately
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="timing"
                  checked={!cancelImmediately}
                  onChange={() => setCancelImmediately(false)}
                  className="sr-only"
                />
                <div className="font-semibold text-xs text-slate-900 dark:text-white">
                  At Period End
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Access until {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer text-left transition ${
                  cancelImmediately
                    ? 'border-red-600 bg-red-50/50 dark:bg-red-950/40 ring-1 ring-red-500'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="timing"
                  checked={cancelImmediately}
                  onChange={() => setCancelImmediately(true)}
                  className="sr-only"
                />
                <div className="font-semibold text-xs text-red-600 dark:text-red-400">
                  Immediately
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Cancels service and flags subscription today
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Cancellation Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              placeholder="e.g. Customer migrated to in-house solution or non-payment default"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl transition"
            >
              Keep Subscription
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cancelling...
                </>
              ) : (
                'Confirm Cancellation'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
