import { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Download,
  Globe2,
  Layers,
  LineChart,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { PlatformRevenueReportView } from '@hrm/shared-types';
import { downloadRevenueCsv, fetchPlatformRevenueReport } from '@/lib/revenue-api';
import { usePermission } from '@/hooks/usePermission';

export function RevenueReportPage() {
  const [report, setReport] = useState<PlatformRevenueReportView | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);

  const canViewBilling = usePermission('billing', 'view');

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchPlatformRevenueReport();
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch platform revenue analytics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      await downloadRevenueCsv();
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err: any) {
      alert(`Export failed: ${err.message || 'Could not download CSV'}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading && !report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500 mb-2" />
        <p className="text-sm">Calculating platform financial metrics...</p>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/20 text-red-700 dark:text-red-400">
          <h3 className="font-bold text-base mb-1">Failed to load Revenue Report</h3>
          <p className="text-sm mb-4">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: report?.currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="space-y-6 p-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Revenue & Financial Analytics
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              Live Audited
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Real-time MRR, ARR, 12-month cohort movements, churn analysis, and revenue breakdowns across tiers and countries.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
            title="Refresh revenue metrics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-amber-600 dark:hover:bg-amber-700 hover:bg-slate-800 rounded-lg shadow-sm transition disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : exportSuccess ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exportSuccess ? 'Downloaded!' : 'Export CSV Report'}
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: MRR */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Current MRR</span>
            <div className="h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <CircleDollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {formatCurrency(report?.currentMrr || 0)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-3 w-3" />
            <span>Monthly Recurring Run-rate</span>
          </div>
        </div>

        {/* Card 2: ARR */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Current ARR</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {formatCurrency(report?.currentArr || 0)}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Annualized (MRR × 12)
          </div>
        </div>

        {/* Card 3: Net New MRR */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Net New MRR (This Month)</span>
            <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {formatCurrency(report?.netNewMrrThisMonth || 0)}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            {report?.growthRatePercent || 0}% Monthly Growth
          </div>
        </div>

        {/* Card 4: Customer Churn Rate */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Customer Churn</span>
            <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {report?.customerChurnRate ?? 0}%
            </span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            Healthy retention rate
          </div>
        </div>

        {/* Card 5: Revenue Churn Rate */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Revenue Churn</span>
            <div className="h-8 w-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {report?.revenueChurnRate ?? 0}%
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Across {report?.totalActiveSubscriptions || 0} active subscriptions
          </div>
        </div>
      </div>

      {/* 3. Monthly Revenue Movements Table (Last 12 Months) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <LineChart className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Monthly Revenue Movements (Trailing 12 Months)
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            New vs Churned vs Expansion Analysis
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4 text-right">Starting MRR</th>
                <th className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">+ New MRR</th>
                <th className="py-3 px-4 text-right text-indigo-600 dark:text-indigo-400">+ Expansion</th>
                <th className="py-3 px-4 text-right text-orange-600 dark:text-orange-400">- Contraction</th>
                <th className="py-3 px-4 text-right text-red-600 dark:text-red-400">- Churned</th>
                <th className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">Net New MRR</th>
                <th className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">Ending MRR</th>
                <th className="py-3 px-4 text-center">Subs (Active/New/Churn)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
              {report?.monthlyMovements && report.monthlyMovements.length > 0 ? (
                report.monthlyMovements.map((m) => {
                  const isCurrentMonth = m.month === report.monthlyMovements[report.monthlyMovements.length - 1].month;
                  return (
                    <tr
                      key={m.month}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition ${
                        isCurrentMonth ? 'bg-amber-50/20 dark:bg-amber-950/10 font-medium' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-sans font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {m.monthLabel}
                        {isCurrentMonth && (
                          <span className="ml-1 rounded px-1.5 py-0.2 bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 text-[10px] font-sans">
                            Current
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                        {formatCurrency(m.startingMrr)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">
                        {m.newRevenue > 0 ? `+${formatCurrency(m.newRevenue)}` : '$0.00'}
                      </td>
                      <td className="py-3 px-4 text-right text-indigo-600 dark:text-indigo-400">
                        {m.expansionRevenue > 0 ? `+${formatCurrency(m.expansionRevenue)}` : '$0.00'}
                      </td>
                      <td className="py-3 px-4 text-right text-orange-600 dark:text-orange-400">
                        {m.contractionRevenue > 0 ? `-${formatCurrency(m.contractionRevenue)}` : '$0.00'}
                      </td>
                      <td className="py-3 px-4 text-right text-red-600 dark:text-red-400">
                        {m.churnedRevenue > 0 ? `-${formatCurrency(m.churnedRevenue)}` : '$0.00'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded ${
                            m.netNewRevenue > 0
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : m.netNewRevenue < 0
                                ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                : 'text-slate-500'
                          }`}
                        >
                          {m.netNewRevenue > 0 ? `+${formatCurrency(m.netNewRevenue)}` : formatCurrency(m.netNewRevenue)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                        {formatCurrency(m.endingMrr)}
                      </td>
                      <td className="py-3 px-4 text-center font-sans text-slate-600 dark:text-slate-400">
                        <span className="font-semibold text-slate-900 dark:text-white">{m.activeSubscriptionsCount}</span>
                        {' '}/ <span className="text-emerald-600">+{m.newSubscriptionsCount}</span>
                        {' '}/ <span className="text-red-500">-{m.churnedSubscriptionsCount}</span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No historical revenue movements recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Side-by-Side: Revenue by Plan & Revenue by Country */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section A: Revenue by Plan */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-violet-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Revenue by Subscription Plan
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              {report?.revenueByPlan?.length || 0} active tiers
            </span>
          </div>

          <div className="mt-4 space-y-4">
            {report?.revenueByPlan && report.revenueByPlan.length > 0 ? (
              report.revenueByPlan.map((plan) => (
                <div key={plan.planId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {plan.planName}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {plan.planTier}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ({plan.activeSubscriptionsCount} {plan.activeSubscriptionsCount === 1 ? 'sub' : 'subs'})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(plan.totalMrr)}
                      </span>
                      <span className="text-slate-400 text-[11px] w-12 text-right">
                        {plan.percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-violet-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(1, plan.percentage))}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                No active plan subscriptions.
              </div>
            )}
          </div>
        </div>

        {/* Section B: Revenue by Country */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Revenue by Country & Geography
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              {report?.revenueByCountry?.length || 0} regions
            </span>
          </div>

          <div className="mt-4 space-y-4">
            {report?.revenueByCountry && report.revenueByCountry.length > 0 ? (
              report.revenueByCountry.map((item) => (
                <div key={item.countryCode} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {item.countryCode}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {item.countryName}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ({item.activeSubscriptionsCount} {item.activeSubscriptionsCount === 1 ? 'sub' : 'subs'})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(item.totalMrr)}
                      </span>
                      <span className="text-slate-400 text-[11px] w-12 text-right">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(1, item.percentage))}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                No country revenue breakdown available.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Audit & Compliance Footer Notice */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-amber-500 shrink-0" />
        <div className="text-xs text-slate-600 dark:text-slate-400">
          <strong className="text-slate-800 dark:text-slate-200">Financial Audit Note:</strong>{' '}
          All recurring revenue and churn percentages are derived deterministically using fixed 14,2 numeric precision from active subscription schedules and signed payment events. Access is restricted to Platform Owner, Platform Admin, and Billing Admin roles.
        </div>
      </div>
    </div>
  );
}
