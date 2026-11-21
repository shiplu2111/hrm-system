import { useEffect, useState } from 'react';
import type { PlatformDashboardView, PlatformNeedsAttentionItem, PlatformNeedsAttentionType } from '@hrm/shared-types';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  FileClock,
  Filter,
  Flag,
  Gauge,
  Layers,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TicketCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { fetchPlatformDashboard, EMPTY_PLATFORM_DASHBOARD } from '../../lib/api-client';

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${className}`}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Loaders (UI_GUIDELINES §8)
// ---------------------------------------------------------------------------

function SkeletonStatCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-card h-32 flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div className="h-9 w-9 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-4 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
          <div>
            <div className="h-7 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-1.5" />
            <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
          <div className="h-3 w-40 bg-slate-100 dark:bg-slate-800/60 rounded" />
        </div>
      ))}
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="h-64 flex items-end gap-2 pt-8 animate-pulse">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-2">
          <div className="h-3 w-4 bg-slate-200 dark:bg-slate-800 rounded" />
          <div
            className="w-full rounded-t-md bg-slate-200 dark:bg-slate-800"
            style={{ height: `${20 + ((i * 17) % 65)}%` }}
          />
          <div className="h-3 w-6 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      ))}
    </div>
  );
}

function SkeletonNeedsAttention() {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-3 w-72 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
          <div className="h-7 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// New Tenants Trend Chart (with designed empty state - UI_GUIDELINES §7)
// ---------------------------------------------------------------------------

interface WeeklyTenantsChartProps {
  weeks: PlatformDashboardView['newTenantsPerWeek'];
  onOpenTenants: () => void;
}

function WeeklyTenantsChart({ weeks, onOpenTenants }: WeeklyTenantsChartProps) {
  const totalCount = weeks.reduce((sum, w) => sum + w.count, 0);

  if (totalCount === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="h-12 w-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
          <BarChart3 className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          No tenant acquisition data yet
        </h3>
        <p className="text-xs text-secondary mt-1 max-w-sm">
          Weekly onboarding velocity will plot here automatically once organizations register or are provisioned.
        </p>
        <button
          type="button"
          onClick={onOpenTenants}
          className="mt-4 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Provision First Tenant
        </button>
      </div>
    );
  }

  const max = Math.max(...weeks.map((w) => w.count), 1);
  return (
    <div className="h-64 flex items-end gap-2 pt-8">
      {weeks.map((item) => (
        <div key={item.weekStart} className="flex-1 h-full flex flex-col justify-end items-center gap-2 group relative">
          <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] rounded px-1.5 py-0.5 pointer-events-none whitespace-nowrap z-10 shadow">
            {item.count} tenant{item.count === 1 ? '' : 's'} ({item.weekStart.slice(5)})
          </div>
          <span className="text-[9px] font-mono text-slate-400 group-hover:text-amber-500 transition-colors">
            {item.count}
          </span>
          <div
            className="w-full rounded-t-md bg-gradient-to-t from-amber-600 to-orange-400 hover:from-amber-500 hover:to-orange-300 transition-all"
            style={{ height: `${Math.max((item.count / max) * 80, 6)}%` }}
          />
          <span className="text-[9px] text-slate-400 font-mono truncate max-w-full text-center">
            {item.weekLabel}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// "Needs Attention" List Component
// ---------------------------------------------------------------------------

interface NeedsAttentionSectionProps {
  items: PlatformNeedsAttentionItem[];
  totalTenants: number;
  onOpenTenants: () => void;
}

function NeedsAttentionSection({ items, totalTenants, onOpenTenants }: NeedsAttentionSectionProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | PlatformNeedsAttentionType>('all');

  const filteredItems = items.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.type === activeFilter;
  });

  const failedCount = items.filter((i) => i.type === 'failed_payment').length;
  const overLimitCount = items.filter((i) => i.type === 'over_limit').length;
  const expiringCount = items.filter((i) => i.type === 'expiring_trial').length;

  const getTypeIcon = (type: PlatformNeedsAttentionType) => {
    switch (type) {
      case 'failed_payment':
        return CreditCard;
      case 'over_limit':
        return Users;
      case 'expiring_trial':
        return FileClock;
      default:
        return AlertTriangle;
    }
  };

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-900 dark:text-white">Needs attention</h2>
            {items.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                {items.length} action{items.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <p className="text-xs text-secondary mt-0.5">
            Failed payments, tenants over or near seat limits, and expiring trials
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: 'all', label: 'All', count: items.length },
            { key: 'failed_payment', label: 'Failed Payments', count: failedCount },
            { key: 'over_limit', label: 'Over Limit', count: overLimitCount },
            { key: 'expiring_trial', label: 'Expiring Trials', count: expiringCount },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeFilter === tab.key
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={`text-[10px] px-1 rounded font-mono ${
                    activeFilter === tab.key
                      ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => {
            const Icon = getTypeIcon(item.type);
            const isCritical = item.severity === 'critical';
            return (
              <div
                key={item.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isCritical
                        ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                        : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase font-mono px-1.5 py-0.5 rounded ${
                          isCritical
                            ? 'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 border border-red-200 dark:border-red-900'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                        }`}
                      >
                        {isCritical ? 'Critical' : 'Warning'}
                      </span>
                      {item.metric && (
                        <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          {item.metric}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-secondary mt-1 line-clamp-2">{item.detail}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400 font-mono">
                      <span>{item.tenantName}</span>
                      <span>·</span>
                      <span>{item.subdomain}.hrm.local</span>
                    </div>
                  </div>
                </div>

                <div className="sm:self-center shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenTenants}
                    className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <span>{item.actionLabel ?? 'Manage'}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {totalTenants === 0
                ? 'No issues to report · 0 active tenants'
                : 'All clear — No items require attention'}
            </h3>
            <p className="text-xs text-secondary mt-1 max-w-sm mx-auto">
              {totalTenants === 0
                ? 'Your platform instance is fresh. Onboard tenants to monitor seat limits, invoices, and trials.'
                : 'All tenant accounts are operating within capacity limits and subscription billing cycles are in good standing.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

interface PlatformDashboardPageProps {
  onOpenTenants: () => void;
}

export function PlatformDashboardPage({ onOpenTenants }: PlatformDashboardPageProps) {
  const [dashboard, setDashboard] = useState<PlatformDashboardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulatedEmpty, setSimulatedEmpty] = useState(false);

  const loadData = async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const data = await fetchPlatformDashboard(refresh);
      setDashboard(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load platform dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  const activeData: PlatformDashboardView | null = simulatedEmpty
    ? EMPTY_PLATFORM_DASHBOARD
    : dashboard;

  const tone: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
    cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-300',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300',
    red: 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300',
  };

  const isPlatformEmpty = activeData ? activeData.tenantsByStatus.total === 0 : false;

  const kpis = activeData
    ? [
        {
          label: 'Total Tenants',
          value: activeData.tenantsByStatus.total.toString(),
          change: isPlatformEmpty
            ? '0 organizations'
            : `${activeData.tenantsByStatus.active} active · ${activeData.tenantsByStatus.trial} trial`,
          icon: Building2,
          tone: 'indigo',
        },
        {
          label: 'Active Tenants',
          value: activeData.tenantsByStatus.active.toString(),
          change: isPlatformEmpty
            ? 'None provisioned'
            : `${activeData.tenantsByStatus.suspended} suspended · ${activeData.tenantsByStatus.cancelled} cancelled`,
          icon: CheckCircle2,
          tone: 'emerald',
        },
        {
          label: 'Active Employees',
          value: activeData.totalActiveEmployees.toLocaleString(),
          change: isPlatformEmpty ? 'No active seats' : 'Across all active tenants',
          icon: Users,
          tone: 'blue',
        },
        {
          label: 'Monthly Recurring Revenue',
          value: `$${activeData.mrr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          change: activeData.mrr > 0 ? 'Active monthly run-rate' : 'No active subscriptions',
          icon: CircleDollarSign,
          tone: 'violet',
        },
        {
          label: 'Annual Recurring Revenue',
          value: `$${activeData.arr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          change: activeData.arr > 0 ? 'Annualized run-rate (MRR × 12)' : 'No annualized run-rate',
          icon: TrendingUp,
          tone: 'emerald',
        },
        {
          label: 'Open Support Tickets',
          value: activeData.openSupportTicketsCount.toString(),
          change: activeData.openSupportTicketsCount > 0 ? 'Requires attention' : 'All tickets resolved',
          icon: TicketCheck,
          tone: activeData.openSupportTicketsCount > 0 ? 'orange' : 'emerald',
        },
        {
          label: '24h Platform Error Rate',
          value: `${activeData.last24hErrorRate.toFixed(1)}%`,
          change: activeData.last24hErrorRate < 2 ? 'Healthy (< 2%)' : 'High error rate (> 2%)',
          icon: ShieldAlert,
          tone: activeData.last24hErrorRate < 2 ? 'cyan' : 'red',
        },
        {
          label: 'Failed Payments',
          value: activeData.failedPaymentsCount.toString(),
          change: activeData.failedPaymentsCount === 0 ? 'No billing failures' : 'Action needed',
          icon: CreditCard,
          tone: activeData.failedPaymentsCount === 0 ? 'emerald' : 'red',
        },
      ]
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-bold mb-2">
            <Zap className="h-3.5 w-3.5" /> PLATFORM CONTROL PLANE
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white">
            Platform Dashboard
          </h1>
          <p className="text-sm text-secondary mt-1">
            Cross-tenant aggregate health, recurring revenue, and operational telemetry.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Simulator toggle for Empty States (UI_GUIDELINES §7) */}
          <button
            type="button"
            onClick={() => setSimulatedEmpty((prev) => !prev)}
            className={`h-10 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors ${
              simulatedEmpty
                ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title="Toggle between real data and an empty platform state to test UI guidelines"
          >
            {simulatedEmpty ? <EyeOff className="h-3.5 w-3.5 text-amber-600" /> : <Eye className="h-3.5 w-3.5 text-slate-400" />}
            <span>{simulatedEmpty ? 'Exit Empty State Preview' : 'Preview Empty State'}</span>
          </button>

          {activeData?.cached && !simulatedEmpty && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Cached (60s TTL)
            </span>
          )}

          <button
            type="button"
            disabled={refreshing || simulatedEmpty}
            onClick={() => loadData(true)}
            className="h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
            title="Refresh aggregates (bypasses Redis cache)"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-amber-500' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            type="button"
            onClick={onOpenTenants}
            className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            <Building2 className="h-4 w-4" /> Manage Tenants
          </button>
        </div>
      </div>

      {/* Error State with Retry Action (UI_GUIDELINES §8) */}
      {error && !simulatedEmpty && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <div>
              <p className="font-bold">Failed to load platform telemetry</p>
              <p className="text-[11px] opacity-90 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadData(true)}
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shrink-0 transition-colors shadow-sm"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Hero Empty State Banner for fresh platform instance (UI_GUIDELINES §7) */}
      {isPlatformEmpty && !loading && (
        <div className="rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-900/60 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-bold uppercase font-mono mb-2">
              <Sparkles className="h-3.5 w-3.5" /> Platform Instance Ready
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              Welcome to CMSN-HR Super Admin Control Plane
            </h2>
            <p className="text-xs sm:text-sm text-secondary mt-1.5 leading-relaxed">
              No tenant organizations have been provisioned yet. Create your first tenant workspace to start tracking multi-tenant payroll, workforce attendance, and statutory country compliance rules.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenTenants}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow transition-colors"
            >
              <Plus className="h-4 w-4" /> Provision First Tenant
            </button>
          </div>
        </div>
      )}

      {/* Stat Cards Grid (with Skeletons - UI_GUIDELINES §8) */}
      {loading ? (
        <SkeletonStatCards />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map(({ label, value, change, icon: Icon, tone: color }) => (
            <div
              key={label}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-card hover:-translate-y-0.5 hover:shadow-card-hover transition-all"
            >
              <div className="flex items-start justify-between">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${tone[color]}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
              </div>
              <div className="text-2xl font-extrabold mt-3 text-slate-900 dark:text-white font-mono">{value}</div>
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">{label}</div>
              <div className="text-[10px] mt-1 font-semibold text-slate-400 truncate">
                {change}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Trends: New Tenants Trend & Tenants by Status */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Weekly New Tenants Cohort (12 Weeks) */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-card">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">Tenant acquisition (12 weeks)</h2>
              <p className="text-xs text-secondary mt-0.5">Weekly new tenant onboarding velocity</p>
            </div>
            {activeData?.newTenantsPerWeek && !isPlatformEmpty && (
              <Pill className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 font-mono">
                {activeData.newTenantsPerWeek.reduce((acc, w) => acc + w.count, 0)} total joined
              </Pill>
            )}
          </div>
          {loading ? (
            <SkeletonChart />
          ) : activeData?.newTenantsPerWeek ? (
            <WeeklyTenantsChart
              weeks={activeData.newTenantsPerWeek}
              onOpenTenants={onOpenTenants}
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">Loading chart...</div>
          )}
        </section>

        {/* Tenant Status Breakdown */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">Tenants by status</h2>
              <p className="text-xs text-secondary mt-0.5">Distribution across lifecycle states</p>
            </div>
            <Pill className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 font-mono">
              {activeData?.tenantsByStatus.total ?? 0} total
            </Pill>
          </div>

          {loading ? (
            <div className="space-y-4 pt-2 animate-pulse">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full" />
                </div>
              ))}
            </div>
          ) : activeData?.tenantsByStatus ? (
            <div className="space-y-4 pt-2">
              {[
                {
                  label: 'Active',
                  count: activeData.tenantsByStatus.active,
                  color: 'bg-emerald-500',
                  pct: activeData.tenantsByStatus.total > 0
                    ? Math.round((activeData.tenantsByStatus.active / activeData.tenantsByStatus.total) * 100)
                    : 0,
                },
                {
                  label: 'Trial',
                  count: activeData.tenantsByStatus.trial,
                  color: 'bg-amber-500',
                  pct: activeData.tenantsByStatus.total > 0
                    ? Math.round((activeData.tenantsByStatus.trial / activeData.tenantsByStatus.total) * 100)
                    : 0,
                },
                {
                  label: 'Suspended',
                  count: activeData.tenantsByStatus.suspended,
                  color: 'bg-red-500',
                  pct: activeData.tenantsByStatus.total > 0
                    ? Math.round((activeData.tenantsByStatus.suspended / activeData.tenantsByStatus.total) * 100)
                    : 0,
                },
                {
                  label: 'Cancelled',
                  count: activeData.tenantsByStatus.cancelled,
                  color: 'bg-slate-400',
                  pct: activeData.tenantsByStatus.total > 0
                    ? Math.round((activeData.tenantsByStatus.cancelled / activeData.tenantsByStatus.total) * 100)
                    : 0,
                },
              ].map((item) => (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                    <span className="font-mono text-slate-900 dark:text-white font-bold">
                      {item.count} <span className="text-slate-400 font-normal">({item.pct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all duration-500`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400">Loading breakdown...</div>
          )}
        </section>
      </div>

      {/* "Needs Attention" List (Failed payments, tenants over limit, expiring trials) */}
      {loading ? (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card p-5">
          <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded mb-4" />
          <SkeletonNeedsAttention />
        </section>
      ) : (
        <NeedsAttentionSection
          items={activeData?.needsAttention ?? []}
          totalTenants={activeData?.tenantsByStatus.total ?? 0}
          onOpenTenants={onOpenTenants}
        />
      )}

      {/* Operational Capacity: Tenants Approaching Plan Limits & Telemetry */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Tenants Approaching Plan Limits */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">Tenants approaching plan limits</h2>
              <p className="text-xs text-secondary mt-0.5">&ge; 80% of employee tier capacity utilized</p>
            </div>
            <button
              onClick={onOpenTenants}
              className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline"
            >
              View all tenants &rarr;
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {activeData?.tenantsApproachingLimits && activeData.tenantsApproachingLimits.length > 0 ? (
              activeData.tenantsApproachingLimits.map((tenant) => {
                const isCritical = tenant.usagePercentage >= 90;
                return (
                  <div
                    key={tenant.tenantId}
                    className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          {tenant.name}
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {tenant.plan}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {tenant.subdomain}.hrm.local
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold font-mono ${
                            isCritical ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {tenant.usagePercentage.toFixed(1)}%
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {tenant.employeeCount} / {tenant.limit} seats
                        </div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          isCritical ? 'bg-red-500' : 'bg-amber-500'
                        } rounded-full transition-all`}
                        style={{ width: `${Math.min(tenant.usagePercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-2 opacity-80" />
                No tenants currently exceeding 80% plan capacity.
              </div>
            )}
          </div>
        </section>

        {/* Operational & Support Status */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-bold text-slate-900 dark:text-white">Platform telemetry & status</h2>
            <p className="text-xs text-secondary mt-0.5">Real-time health indicators</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Auth & API Error Rate</span>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                    {activeData?.last24hErrorRate.toFixed(2)}%
                  </span>
                </div>
                <p className="text-[11px] text-secondary mt-0.5">
                  Calculated from failed logins and locked credentials in the last 24 hours.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0">
                <TicketCheck className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Support Queues</span>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                    {activeData?.openSupportTicketsCount ?? 0} open
                  </span>
                </div>
                <p className="text-[11px] text-secondary mt-0.5">
                  Unresolved tickets across all tenant workspaces awaiting platform staff action.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <CreditCard className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Payment Collections</span>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                    {activeData?.failedPaymentsCount ?? 0} failures
                  </span>
                </div>
                <p className="text-[11px] text-secondary mt-0.5">
                  Failed or past-due invoice attempts currently requiring tenant billing updates.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Telemetry Timestamp:</span>
              <span>{activeData?.asOf ? new Date(activeData.asOf).toLocaleString() : 'N/A'}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
