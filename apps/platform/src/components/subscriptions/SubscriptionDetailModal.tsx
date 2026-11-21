import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  DollarSign,
  FileText,
  History,
  Layers,
  Loader2,
  Lock,
  PauseCircle,
  Percent,
  PlayCircle,
  Shield,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import type {
  PlatformPlanDetailView,
  PlatformSubscriptionDetailView,
  SubscriptionActionType,
  SubscriptionState,
} from '@hrm/shared-types';
import { usePermissions } from '@/hooks/usePermission';
import {
  CancelSubscriptionModal,
  ChangePlanModal,
  DiscountCreditModal,
  ExtendTrialModal,
  PauseResumeModal,
} from './SubscriptionActionModals';

interface Props {
  subscription: PlatformSubscriptionDetailView;
  plans: PlatformPlanDetailView[];
  onClose: () => void;
  onRefresh: () => void;
}

const statusColors: Record<SubscriptionState, string> = {
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  trialing: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
  past_due: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  paused: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
  cancelled: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
};

const actionBadges: Record<SubscriptionActionType, { label: string; class: string }> = {
  plan_change: {
    label: 'Plan Change',
    class: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
  },
  trial_extension: {
    label: 'Trial Extended',
    class: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
  },
  discount_applied: {
    label: 'Discount Added',
    class: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  },
  credit_applied: {
    label: 'Credit Applied',
    class: 'border-teal-500/30 bg-teal-500/10 text-teal-400',
  },
  pause: {
    label: 'Subscription Paused',
    class: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  },
  resume: {
    label: 'Subscription Resumed',
    class: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  },
  cancel: {
    label: 'Cancellation',
    class: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  },
};

export function SubscriptionDetailModal({
  subscription: initialSub,
  plans,
  onClose,
  onRefresh,
}: Props) {
  const [sub, setSub] = useState<PlatformSubscriptionDetailView>(initialSub);
  const [activeModal, setActiveModal] = useState<
    'plan' | 'trial' | 'discount' | 'pause' | 'cancel' | null
  >(null);

  const { roleName, can } = usePermissions();

  // Role-gate to Billing Admin, Platform Admin, Platform Owner
  const isAuthorized =
    ['Billing Admin', 'Platform Admin', 'Platform Owner'].includes(roleName) ||
    can('billing', 'edit');

  const handleActionSuccess = (updated: PlatformSubscriptionDetailView) => {
    setSub(updated);
    setActiveModal(null);
    onRefresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-4xl my-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-extrabold text-lg">
              {sub.tenantName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {sub.tenantName}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                    statusColors[sub.status] ?? 'border-slate-500 text-slate-400'
                  }`}
                >
                  {sub.status.replace('_', ' ')}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Plan: {sub.planName}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                <span>Subdomain: <code className="text-slate-700 dark:text-slate-300 font-semibold">{sub.tenantSubdomain}.cmsnbd.com</code></span>
                <span>•</span>
                <span>Tenant ID: <code className="text-slate-400 font-mono text-[11px]">{sub.tenantId}</code></span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Pending Plan Change Notice Banner */}
          {sub.pendingPlan && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-300">
                <Clock className="h-4 w-4 shrink-0 text-amber-500" />
                <span>
                  <strong>Scheduled Downgrade Pending:</strong> Transitioning to{' '}
                  <span className="font-bold underline">{sub.pendingPlan.name}</span> on next renewal (
                  {new Date(sub.currentPeriodEnd).toLocaleDateString()}).
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 uppercase">
                Pending Renewal
              </span>
            </div>
          )}

          {/* Cancellation Notice Banner */}
          {sub.cancelAtPeriodEnd && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 flex items-center gap-2.5 text-xs text-rose-800 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>
                <strong>Subscription Ending:</strong> Service is set to cancel at period end on{' '}
                {new Date(sub.currentPeriodEnd).toLocaleDateString()}. Data remains intact per RULES.md §3.
              </span>
            </div>
          )}

          {/* Metrics & Overview Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-indigo-500" /> Price & Cycle
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                ${sub.baseAmount.toFixed(2)}
                <span className="text-xs font-semibold text-slate-400">/{sub.billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
              </div>
              {sub.perSeatAmount && (
                <div className="text-[11px] text-slate-500 mt-0.5">
                  +${sub.perSeatAmount.toFixed(2)} / seat
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-emerald-500" /> Active Headcount
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                {sub.employeeCount}{' '}
                <span className="text-xs font-semibold text-slate-400">
                  / {sub.maxEmployees !== null ? sub.maxEmployees : '∞'} seats
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {sub.maxEmployees !== null && sub.employeeCount > sub.maxEmployees
                  ? 'Over quota'
                  : 'Within entitlement cap'}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-cyan-500" /> Next Billing Date
              </div>
              <div className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
                {new Date(sub.nextBillingAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Period end: {new Date(sub.currentPeriodEnd).toLocaleDateString()}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-500" /> Trial Period
              </div>
              <div className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
                {sub.trialEndsAt ? (
                  new Date(sub.trialEndsAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                ) : (
                  <span className="text-slate-400">None</span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {sub.trialEndsAt && new Date(sub.trialEndsAt) > new Date()
                  ? `${Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86400000)} days remaining`
                  : 'Commercial subscription'}
              </div>
            </div>
          </div>

          {/* Active Discounts & Credits */}
          {(sub.discountPercent || sub.creditBalance > 0) && (
            <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                  %
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    Special Commercial Terms Active
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    {sub.discountPercent ? `Discount: ${sub.discountPercent}% off renewal invoices.` : ''}{' '}
                    {sub.creditBalance > 0 ? `Credit Balance: $${sub.creditBalance.toFixed(2)}.` : ''}{' '}
                    {sub.discountReason ? `Reason: ${sub.discountReason}` : ''}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions Toolbar */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-indigo-500" /> Administrative Actions
              </div>
              <p className="text-[11px] text-slate-500">
                Restricted to Billing Admin, Platform Admin, and Platform Owner.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={!isAuthorized}
                onClick={() => setActiveModal('plan')}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-40"
              >
                Change Plan
              </button>

              <button
                type="button"
                disabled={!isAuthorized}
                onClick={() => setActiveModal('trial')}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition disabled:opacity-40"
              >
                Extend Trial
              </button>

              <button
                type="button"
                disabled={!isAuthorized}
                onClick={() => setActiveModal('discount')}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition disabled:opacity-40"
              >
                Discount / Credit
              </button>

              <button
                type="button"
                disabled={!isAuthorized}
                onClick={() => setActiveModal('pause')}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition disabled:opacity-40"
              >
                {sub.status === 'paused' ? 'Resume' : 'Pause'}
              </button>

              <button
                type="button"
                disabled={!isAuthorized || sub.status === 'cancelled'}
                onClick={() => setActiveModal('cancel')}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-red-300 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Section: History of Plan Changes */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="h-4 w-4 text-indigo-500" /> History of Plan Changes & Subscription Events
              </h3>
              <span className="text-xs text-slate-400 font-semibold">
                {sub.changes.length} record(s) logged
              </span>
            </div>

            {sub.changes.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                No plan changes or manual overrides recorded yet.
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Event Action</th>
                      <th className="px-4 py-3">Transition / Details</th>
                      <th className="px-4 py-3">Mandatory Justification</th>
                      <th className="px-4 py-3">Actor & Role</th>
                      <th className="px-4 py-3 text-right">Date & Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {sub.changes.map((change) => {
                      const badge = actionBadges[change.action] ?? {
                        label: change.action,
                        class: 'border-slate-500 bg-slate-500/10 text-slate-400',
                      };
                      return (
                        <tr key={change.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.class}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {change.fromPlanName || change.toPlanName ? (
                              <div className="flex items-center gap-1.5 font-semibold">
                                <span className="text-slate-500">{change.fromPlanName ?? 'Initial'}</span>
                                <ArrowRight className="h-3 w-3 text-slate-400" />
                                <span className="text-slate-900 dark:text-white">{change.toPlanName}</span>
                              </div>
                            ) : change.amount != null ? (
                              <span>
                                {change.action === 'discount_applied'
                                  ? `${change.amount}% discount`
                                  : `$${Number(change.amount).toFixed(2)} credit`}
                              </span>
                            ) : (
                              <span>{change.fromStatus ? `${change.fromStatus} → ${change.toStatus}` : 'Updated'}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                            {change.reason || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {change.actorEmail || 'System'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {change.actorRole || 'automated'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">
                            {new Date(change.createdAt).toLocaleString(undefined, {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section: Recent Invoices */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-500" /> Recent Invoices & Billing Charges
            </h3>
            {sub.recentInvoices.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                No invoices generated for this subscription yet.
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-2.5">Invoice #</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Total Amount</th>
                      <th className="px-4 py-2.5">Due Date</th>
                      <th className="px-4 py-2.5 text-right">Settled Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {sub.recentInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-900 dark:text-white">
                          {inv.invoiceNumber}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              inv.status === 'paid'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-bold">${inv.total.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-slate-500">
                          {new Date(inv.dueDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-500">
                          {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : 'Unsettled'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            Close Detail
          </button>
        </div>
      </div>

      {/* Child Action Dialogs */}
      {activeModal === 'plan' && (
        <ChangePlanModal
          subscription={sub}
          plans={plans}
          onClose={() => setActiveModal(null)}
          onSuccess={handleActionSuccess}
        />
      )}

      {activeModal === 'trial' && (
        <ExtendTrialModal
          subscription={sub}
          onClose={() => setActiveModal(null)}
          onSuccess={handleActionSuccess}
        />
      )}

      {activeModal === 'discount' && (
        <DiscountCreditModal
          subscription={sub}
          onClose={() => setActiveModal(null)}
          onSuccess={handleActionSuccess}
        />
      )}

      {activeModal === 'pause' && (
        <PauseResumeModal
          subscription={sub}
          onClose={() => setActiveModal(null)}
          onSuccess={handleActionSuccess}
        />
      )}

      {activeModal === 'cancel' && (
        <CancelSubscriptionModal
          subscription={sub}
          onClose={() => setActiveModal(null)}
          onSuccess={handleActionSuccess}
        />
      )}
    </div>
  );
}
