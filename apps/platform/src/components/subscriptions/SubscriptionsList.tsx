import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Filter,
  History,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import type {
  PlatformPlanDetailView,
  PlatformSubscriptionDetailView,
  PlatformSubscriptionListItem,
  SubscriptionState,
} from '@hrm/shared-types';
import {
  getPlatformSubscription,
  listPlatformSubscriptions,
} from '@/lib/subscriptions-api';
import { SubscriptionDetailModal } from './SubscriptionDetailModal';

interface Props {
  plans: PlatformPlanDetailView[];
  selectedTenantId?: string | null;
}

const statusFilters: Array<'All' | SubscriptionState> = [
  'All',
  'active',
  'trialing',
  'past_due',
  'paused',
  'cancelled',
];

const statusStyles: Record<SubscriptionState, string> = {
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  trialing: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
  past_due: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  paused: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
  cancelled: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
};

export function SubscriptionsList({ plans, selectedTenantId }: Props) {
  const [subscriptions, setSubscriptions] = useState<PlatformSubscriptionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | SubscriptionState>('All');
  const [planFilter, setPlanFilter] = useState<string>('All');

  // Selected subscription detail state
  const [selectedSubDetail, setSelectedSubDetail] = useState<PlatformSubscriptionDetailView | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const fetchSubscriptions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await listPlatformSubscriptions({
        status: statusFilter !== 'All' ? statusFilter : undefined,
        planId: planFilter !== 'All' ? planFilter : undefined,
        search: search.trim() || undefined,
      });
      setSubscriptions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load tenant subscriptions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, [statusFilter, planFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSubscriptions();
  };

  const openDetail = async (sub: PlatformSubscriptionListItem) => {
    try {
      setIsLoadingDetail(true);
      const detail = await getPlatformSubscription(sub.id);
      setSelectedSubDetail(detail);
    } catch (err: any) {
      alert(`Could not load subscription detail: ${err.message}`);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const filteredSubscriptions = useMemo(() => {
    if (!selectedTenantId) return subscriptions;
    return subscriptions.filter((s) => s.tenantId === selectedTenantId);
  }, [subscriptions, selectedTenantId]);

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {statusFilters.map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {st === 'All' ? 'All Subscriptions' : st.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        {/* Search & Plan Selector */}
        <div className="flex items-center gap-2.5">
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Search tenant or subdomain..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white w-56 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </form>

          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
          >
            <option value="All">All Plans</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={fetchSubscriptions}
            disabled={isLoading}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
            title="Refresh List"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Subscriptions Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        {isLoading && subscriptions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
            <p className="text-sm font-semibold">Loading tenant subscriptions...</p>
          </div>
        ) : filteredSubscriptions.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-sm font-semibold">No subscriptions match the selected criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Tenant Organization</th>
                  <th className="px-4 py-3.5">Current Plan</th>
                  <th className="px-4 py-3.5">Active Rate</th>
                  <th className="px-4 py-3.5">Billing Cycle</th>
                  <th className="px-4 py-3.5">Next Billing</th>
                  <th className="px-4 py-3.5">Trial End</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Utilization</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredSubscriptions.map((sub) => (
                  <tr
                    key={sub.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    onClick={() => openDetail(sub)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-extrabold text-xs shrink-0">
                          {sub.tenantName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {sub.tenantName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {sub.tenantSubdomain}.cmsnbd.com
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {sub.planName}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500">
                          {sub.planCode}
                        </span>
                      </div>
                      {sub.pendingPlan && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-500 font-semibold">
                          <Clock className="h-3 w-3" />
                          <span>→ {sub.pendingPlan.name} on renewal</span>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4 font-bold text-slate-900 dark:text-white">
                      ${sub.baseAmount.toFixed(2)}
                      {sub.discountPercent ? (
                        <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          -{sub.discountPercent}%
                        </span>
                      ) : null}
                    </td>

                    <td className="px-4 py-4 font-semibold text-slate-600 dark:text-slate-400 capitalize">
                      {sub.billingCycle}
                    </td>

                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                      {new Date(sub.nextBillingAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>

                    <td className="px-4 py-4 text-slate-500">
                      {sub.trialEndsAt ? (
                        <span className={new Date(sub.trialEndsAt) > new Date() ? 'text-cyan-500 font-semibold' : 'text-slate-400'}>
                          {new Date(sub.trialEndsAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          statusStyles[sub.status] ?? 'border-slate-500 text-slate-400'
                        }`}
                      >
                        {sub.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {sub.employeeCount} / {sub.maxEmployees !== null ? sub.maxEmployees : '∞'} seats
                      </div>
                      {sub.creditBalance > 0 && (
                        <div className="text-[10px] text-teal-400 font-semibold">
                          Credit: ${sub.creditBalance.toFixed(2)}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(sub);
                        }}
                        className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:border-indigo-300 transition"
                      >
                        View Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal Component */}
      {selectedSubDetail && (
        <SubscriptionDetailModal
          subscription={selectedSubDetail}
          plans={plans}
          onClose={() => setSelectedSubDetail(null)}
          onRefresh={fetchSubscriptions}
        />
      )}
    </div>
  );
}
