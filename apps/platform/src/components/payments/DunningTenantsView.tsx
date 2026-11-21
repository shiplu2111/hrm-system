import { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  Loader2,
  Lock,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import type { DunningTenantView } from '@hrm/shared-types';
import { PermissionGate } from '@/components/rbac';
import { usePermission } from '@/hooks/usePermission';
import { listDunningTenants } from '@/lib/payments-api';
import { RetryPaymentModal } from './PaymentActionModals';

interface DunningTenantsViewProps {
  onSelectTenant?: (tenantId: string) => void;
}

export function DunningTenantsView({ onSelectTenant }: DunningTenantsViewProps) {
  const [tenants, setTenants] = useState<DunningTenantView[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Retry modal
  const [retryModalTarget, setRetryModalTarget] = useState<{
    tenantId: string;
    tenantName: string;
  } | null>(null);

  const canEditBilling = usePermission('billing', 'edit');

  const loadDunningData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await listDunningTenants();
      setTenants(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dunning tenants.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDunningData();
  }, []);

  const totalOverdue = tenants.reduce((sum, t) => sum + t.totalOutstandingAmount, 0);
  const suspendedCount = tenants.filter((t) => t.isSuspended).length;
  const inGracePeriodCount = tenants.filter((t) => t.dunningStage === 'stage_4').length;

  const renderStageBadge = (stage: DunningTenantView['dunningStage']) => {
    switch (stage) {
      case 'stage_1':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Stage 1 · Day 0 (Initial Failure)
          </span>
        );
      case 'stage_2':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Stage 2 · Day 1-3 (Past Due)
          </span>
        );
      case 'stage_3':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
            Stage 3 · Day 3-7 (Urgent Notice)
          </span>
        );
      case 'stage_4':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse">
            Stage 4 · Day 7-10 (Grace Period)
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-700">
            <Lock className="h-3 w-3" /> Stage 5 · Read-Only Suspended
          </span>
        );
    }
  };

  const getStepProgress = (step: number) => {
    // 1 -> 20%, 2 -> 40%, 3 -> 60%, 4 -> 80%, 5 -> 100%
    return Math.min(100, Math.max(20, step * 20));
  };

  return (
    <div className="space-y-6">
      {/* Top Dunning Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Tenants In Dunning</div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {tenants.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Requires automated or manual collection</div>
        </div>

        <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Total Overdue Volume</div>
          <div className="mt-2 text-2xl font-extrabold text-rose-700 dark:text-rose-300">
            ${totalOverdue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-rose-600/80 dark:text-rose-400/80">Unsettled outstanding balances</div>
        </div>

        <div className="p-4 rounded-2xl border border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">Active Grace Periods</div>
          <div className="mt-2 text-2xl font-extrabold text-orange-700 dark:text-orange-300">
            {inGracePeriodCount}
          </div>
          <div className="mt-1 text-[11px] text-orange-600/80 dark:text-orange-400/80">3-day window prior to suspension</div>
        </div>

        <div className="p-4 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Read-Only Suspended</div>
          <div className="mt-2 text-2xl font-extrabold text-red-700 dark:text-red-300">
            {suspendedCount}
          </div>
          <div className="mt-1 text-[11px] text-red-600/80 dark:text-red-400/80">Data preserved, write access paused</div>
        </div>
      </div>

      {/* Dunning Lifecycle Timeline Reference */}
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-600" /> Automated Dunning Lifecycle (BILLING_SUBSCRIPTION.md §7)
          </div>
          <button
            type="button"
            onClick={loadDunningData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-[11px]">
          <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30">
            <div className="font-bold text-blue-700 dark:text-blue-300">Stage 1 · Day 0</div>
            <div className="text-slate-500 mt-0.5">Initial charge fails. Notice sent to admin. Retry in 24h.</div>
          </div>
          <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="font-bold text-amber-700 dark:text-amber-300">Stage 2 · Day 1</div>
            <div className="text-slate-500 mt-0.5">Retry 1 fails. Status becomes past_due. Retry in 48h.</div>
          </div>
          <div className="p-2.5 rounded-xl border border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/30">
            <div className="font-bold text-orange-700 dark:text-orange-300">Stage 3 · Day 3</div>
            <div className="text-slate-500 mt-0.5">Retry 2 fails. Urgent notice sent. Final retry in 96h.</div>
          </div>
          <div className="p-2.5 rounded-xl border border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/30">
            <div className="font-bold text-rose-700 dark:text-rose-300">Stage 4 · Day 7</div>
            <div className="text-slate-500 mt-0.5">Final retry fails. 3-day grace period countdown starts.</div>
          </div>
          <div className="p-2.5 rounded-xl border border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30">
            <div className="font-bold text-red-700 dark:text-red-300">Stage 5 · Day 10+</div>
            <div className="text-slate-500 mt-0.5">Read-Only suspension active. Zero data deletion.</div>
          </div>
        </div>
      </div>

      {/* Dunning Tenants List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
          <span className="text-xs font-semibold">Scanning dunning subscriptions…</span>
        </div>
      ) : error ? (
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : tenants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 mb-3">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="font-extrabold text-slate-900 dark:text-white text-base">All Subscriptions in Good Standing</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Zero tenants are currently in dunning recovery. All recurring subscription invoices have been successfully settled.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tenants.map((item) => (
            <div
              key={item.subscriptionId}
              className={`rounded-2xl border p-5 transition shadow-sm bg-white dark:bg-slate-900 ${
                item.isSuspended
                  ? 'border-red-300 dark:border-red-800 bg-red-50/20 dark:bg-red-950/10'
                  : item.dunningStage === 'stage_4'
                  ? 'border-rose-300 dark:border-rose-800 bg-rose-50/20 dark:bg-rose-950/10'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Tenant meta & stage */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-slate-900 dark:text-white text-base">
                      {item.tenantName}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">({item.subdomain}.cmsnbd.com)</span>
                    {renderStageBadge(item.dunningStage)}
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                      {item.planName} · {item.billingCycle}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {item.dunningDescription}
                  </p>

                  {/* Progress bar across 5 stages */}
                  <div className="space-y-1 max-w-md">
                    <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                      <span>Dunning Progression</span>
                      <span>Step {item.dunningStep} of 5</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          item.isSuspended
                            ? 'bg-red-600'
                            : item.dunningStep >= 4
                            ? 'bg-gradient-to-r from-orange-500 to-rose-600'
                            : 'bg-gradient-to-r from-blue-500 to-amber-500'
                        }`}
                        style={{ width: `${getStepProgress(item.dunningStep)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Balance, Retries & Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:self-center">
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Outstanding Balance</div>
                    <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
                      ${item.totalOutstandingAmount.toFixed(2)} {item.currency}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {item.unpaidInvoicesCount} unpaid invoice(s) · {item.daysOverdue} days overdue
                    </div>
                  </div>

                  {canEditBilling && (
                    <button
                      type="button"
                      onClick={() =>
                        setRetryModalTarget({
                          tenantId: item.tenantId,
                          tenantName: item.tenantName,
                        })
                      }
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm whitespace-nowrap"
                    >
                      <RefreshCw className="h-4 w-4" /> Retry Payment Now
                    </button>
                  )}
                </div>
              </div>

              {/* Provider Failure Reason Box */}
              {item.latestFailedPayment && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
                    <span>
                      <strong className="font-semibold">Provider Failure: </strong>
                      <span className="font-mono bg-red-100 dark:bg-red-950 px-1.5 py-0.5 rounded text-[11px] mr-1.5">
                        {item.latestFailedPayment.errorCode || 'declined'}
                      </span>
                      {item.latestFailedPayment.errorMessage || 'Transaction declined'}
                    </span>
                  </div>

                  <div className="text-slate-400 text-[11px] whitespace-nowrap">
                    {item.nextRetryAt && (
                      <span>Next retry scheduled: {new Date(item.nextRetryAt).toLocaleString()}</span>
                    )}
                    {item.gracePeriodEndsAt && (
                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                        Grace period ends: {new Date(item.gracePeriodEndsAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Retry Modal */}
      <RetryPaymentModal
        isOpen={Boolean(retryModalTarget)}
        onClose={() => setRetryModalTarget(null)}
        tenantId={retryModalTarget?.tenantId}
        tenantName={retryModalTarget?.tenantName}
        onSuccess={() => {
          loadDunningData();
        }}
      />
    </div>
  );
}
