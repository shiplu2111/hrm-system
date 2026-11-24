// UsageStoragePage.tsx
// Platform Usage & Storage: per-tenant table and trend charts for employees, storage, and API calls against plan limits

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  ExternalLink,
  Filter,
  HardDrive,
  HelpCircle,
  Layers,
  LineChart,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import type {
  TenantUsageAndLimitItem,
  TenantUsageOverviewFilter,
  TenantUsageOverviewResponse,
  TenantUsageTrendPoint,
  TenantUsageTrendsResponse,
} from '@hrm/shared-types';
import {
  exportTenantUsage,
  getTenantUsageOverview,
  getTenantUsageTrends,
  triggerUsageMetering,
} from '@/lib/platform-usage-health-api';
import { usePlatformTenant } from '@/context/PlatformTenantContext';

interface UsageStoragePageProps {
  onNavigateToTenant?: (tenantId: string) => void;
}

export function UsageStoragePage({ onNavigateToTenant }: UsageStoragePageProps) {
  const { tenants: contextTenants, setSelectedTenant, selectTenantById } = usePlatformTenant();

  // State: Data
  const [overviewData, setOverviewData] = useState<TenantUsageOverviewResponse | null>(null);
  const [trendsData, setTrendsData] = useState<TenantUsageTrendsResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [triggeringMetering, setTriggeringMetering] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State: Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'near_limit' | 'over_limit' | 'normal'>('all');
  const [resourceFilter, setResourceFilter] = useState<'all' | 'employees' | 'storage' | 'api_calls'>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<TenantUsageOverviewFilter['sortBy']>('maxUsagePercent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // State: Trend Chart Controls
  const [trendMetric, setTrendMetric] = useState<'employees' | 'storage' | 'api_calls'>('employees');
  const [trendDays, setTrendDays] = useState<number>(30);
  const [selectedTrendTenantId, setSelectedTrendTenantId] = useState<string>(''); // empty = all tenants
  const [hoveredTrendPoint, setHoveredTrendPoint] = useState<TenantUsageTrendPoint | null>(null);

  // Fetch Overview Data
  const loadOverview = async () => {
    setLoadingOverview(true);
    setErrorMessage(null);
    try {
      const res = await getTenantUsageOverview({
        search,
        status: statusFilter,
        resource: resourceFilter,
        plan: planFilter,
        sortBy,
        sortOrder,
        page,
        limit: pageSize,
      });
      setOverviewData(res);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load tenant usage overview.');
    } finally {
      setLoadingOverview(false);
    }
  };

  // Fetch Trend Data
  const loadTrends = async () => {
    setLoadingTrends(true);
    try {
      const res = await getTenantUsageTrends({
        tenantId: selectedTrendTenantId || undefined,
        days: trendDays,
      });
      setTrendsData(res);
    } catch (err: any) {
      // Keep previous trends if error occurs
    } finally {
      setLoadingTrends(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [search, statusFilter, resourceFilter, planFilter, sortBy, sortOrder, page, pageSize]);

  useEffect(() => {
    loadTrends();
  }, [selectedTrendTenantId, trendDays]);

  // Handle Manual Trigger
  const handleTriggerMetering = async () => {
    setTriggeringMetering(true);
    try {
      await triggerUsageMetering();
      await Promise.all([loadOverview(), loadTrends()]);
    } catch (err: any) {
      alert(`Metering trigger failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setTriggeringMetering(false);
    }
  };

  // Handle CSV/JSON Export
  const handleExport = async (format: 'csv' | 'json' = 'csv') => {
    setExporting(true);
    try {
      const res = await exportTenantUsage({
        format,
        search,
        plan: planFilter,
        status: statusFilter,
        resource: resourceFilter,
      });

      if (format === 'csv' && res.csv) {
        const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', res.filename || 'platform-tenant-usage.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (format === 'json' && res.json) {
        const blob = new Blob([JSON.stringify(res.json, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', res.filename || 'platform-tenant-usage.json');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      alert(`Export failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  // Navigate to Tenant Detail
  const handleRowClick = (tenantId: string) => {
    if (onNavigateToTenant) {
      onNavigateToTenant(tenantId);
    } else {
      selectTenantById(tenantId);
      localStorage.setItem('hrm_platform_target_tenant', tenantId);
      window.dispatchEvent(new CustomEvent('hrm:platform-navigate', { detail: 'tenants' }));
    }
  };

  // Sorting toggle helper
  const handleSort = (field: TenantUsageOverviewFilter['sortBy']) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const summary = overviewData?.summary ?? {
    totalTenants: 0,
    normalCount: 0,
    nearLimitCount: 0,
    overLimitCount: 0,
    totalEmployees: 0,
    totalStorageBytes: 0,
    totalStorageGb: 0,
    totalApiCalls: 0,
  };

  // Trend Chart Calculations
  const trendPoints = trendsData?.trends ?? [];
  const chartMaxVal = useMemo(() => {
    if (trendPoints.length === 0) return 100;
    let max = 0;
    for (const p of trendPoints) {
      let val = 0;
      let lim = 0;
      if (trendMetric === 'employees') {
        val = p.activeEmployees;
        lim = p.employeeLimit || 0;
      } else if (trendMetric === 'storage') {
        val = p.storageUsedGb;
        lim = p.storageLimitGb || 0;
      } else {
        val = p.apiCalls;
        lim = p.apiCallLimit || 0;
      }
      if (val > max) max = val;
      if (lim > max) max = lim;
    }
    return Math.max(max * 1.15, 10);
  }, [trendPoints, trendMetric]);

  const chartLimitVal = useMemo(() => {
    if (trendPoints.length === 0) return null;
    const p = trendPoints[trendPoints.length - 1];
    if (trendMetric === 'employees') return p.employeeLimit ?? null;
    if (trendMetric === 'storage') return p.storageLimitGb ?? null;
    return p.apiCallLimit ?? null;
  }, [trendPoints, trendMetric]);

  const chart80ThresholdVal = useMemo(() => {
    if (chartLimitVal == null) return null;
    return Math.round(chartLimitVal * 0.8 * 10) / 10;
  }, [chartLimitVal]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-900/40 p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Tenant Usage & Storage vs. Plan Limits
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-medium">
                  Saturation Monitor
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Track active headcount, cloud storage volume, and API call quotas against plan allocations with 80% saturation threshold detection.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTriggerMetering}
            disabled={triggeringMetering}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition disabled:opacity-50"
            title="Run on-demand usage metering calculation across all tenants"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-amber-400 ${triggeringMetering ? 'animate-spin' : ''}`} />
            {triggeringMetering ? 'Calculating...' : 'Recalculate Metering'}
          </button>

          <div className="relative group">
            <button
              type="button"
              disabled={exporting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-sm disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? 'Exporting...' : 'Export Report'}
              <ChevronDown className="h-3.5 w-3.5 ml-1" />
            </button>
            <div className="absolute right-0 mt-1 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-xl py-1 z-30 hidden group-hover:block">
              <button
                type="button"
                onClick={() => handleExport('csv')}
                className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
              >
                <Database className="h-3.5 w-3.5 text-amber-400" />
                Export as CSV (.csv)
              </button>
              <button
                type="button"
                onClick={() => handleExport('json')}
                className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
              >
                <Zap className="h-3.5 w-3.5 text-blue-400" />
                Export as JSON (.json)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stat Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total Tenants */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
            <span>Monitored Tenants</span>
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{summary.totalTenants}</div>
          <div className="text-[11px] text-slate-400 mt-1">Workspaces active</div>
        </div>

        {/* Normal Tenants */}
        <div
          onClick={() => setStatusFilter('normal')}
          className={`bg-slate-900/80 border rounded-xl p-3.5 flex flex-col justify-between cursor-pointer transition hover:border-emerald-500/40 ${
            statusFilter === 'normal' ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-800'
          }`}
        >
          <div className="text-emerald-400 text-xs font-medium flex items-center justify-between">
            <span>Healthy (&lt;80%)</span>
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">{summary.normalCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Safe quota room</div>
        </div>

        {/* Near Limit Tenants (Over 80%) */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'near_limit' ? 'all' : 'near_limit')}
          className={`bg-slate-900/80 border rounded-xl p-3.5 flex flex-col justify-between cursor-pointer transition hover:border-amber-500/60 ${
            statusFilter === 'near_limit' ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/5' : 'border-slate-800'
          }`}
        >
          <div className="text-amber-400 text-xs font-bold flex items-center justify-between">
            <span>Near Limit (≥80%)</span>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-400 mt-2 flex items-baseline gap-2">
            {summary.nearLimitCount}
            {summary.nearLimitCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                Action Req.
              </span>
            )}
          </div>
          <div className="text-[11px] text-amber-300/80 mt-1 font-medium">Click to filter table</div>
        </div>

        {/* Over Limit Tenants (>=100%) */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'over_limit' ? 'all' : 'over_limit')}
          className={`bg-slate-900/80 border rounded-xl p-3.5 flex flex-col justify-between cursor-pointer transition hover:border-rose-500/60 ${
            statusFilter === 'over_limit' ? 'border-rose-500 bg-rose-500/10 shadow-lg shadow-rose-500/5' : 'border-slate-800'
          }`}
        >
          <div className="text-rose-400 text-xs font-bold flex items-center justify-between">
            <span>Exceeded (≥100%)</span>
            <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
          </div>
          <div className="text-2xl font-extrabold text-rose-400 mt-2">{summary.overLimitCount}</div>
          <div className="text-[11px] text-rose-300/80 mt-1 font-medium">Plan cap breached</div>
        </div>

        {/* Total Active Employees */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
            <span>Total Employees</span>
            <Users className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{summary.totalEmployees.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 mt-1">Platform headcount</div>
        </div>

        {/* Storage Footprint */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
            <span>Storage Used</span>
            <HardDrive className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {summary.totalStorageGb >= 1 ? `${summary.totalStorageGb} GB` : `${Math.round((summary.totalStorageBytes / (1024 * 1024)) * 10) / 10} MB`}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Contracts, docs & receipts</div>
        </div>

        {/* API Volume */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
            <span>Daily API Volume</span>
            <Zap className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{summary.totalApiCalls.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 mt-1">Logged requests</div>
        </div>
      </div>

      {/* Trend Charts Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <LineChart className="h-4 w-4 text-amber-400" />
              Usage Timeseries & Threshold Reference Curves
            </h2>
            <p className="text-xs text-slate-400">
              Visualize historical consumption curve against plan limit (100%) and 80% early-warning saturation lines.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Metric selector tabs */}
            <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setTrendMetric('employees')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  trendMetric === 'employees'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Employees
              </button>
              <button
                type="button"
                onClick={() => setTrendMetric('storage')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  trendMetric === 'storage'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <HardDrive className="h-3.5 w-3.5" />
                Storage (GB)
              </button>
              <button
                type="button"
                onClick={() => setTrendMetric('api_calls')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  trendMetric === 'api_calls'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                API Calls
              </button>
            </div>

            {/* Scope selector */}
            <div className="relative">
              <select
                value={selectedTrendTenantId}
                onChange={(e) => setSelectedTrendTenantId(e.target.value)}
                className="appearance-none bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 pr-8 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Platform Total (All Tenants)</option>
                {overviewData?.items.map((t) => (
                  <option key={t.tenantId} value={t.tenantId}>
                    {t.tenantName} ({t.planName})
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Range selector */}
            <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setTrendDays(d)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    trendDays === d
                      ? 'bg-slate-800 text-amber-400 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart Canvas & Legend */}
        <div className="space-y-2">
          {/* Legend Strip */}
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 px-1">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-amber-500 inline-block" />
                <span className="font-medium text-slate-300">
                  {trendsData?.tenantName || 'Platform Total'}
                </span>
              </div>
              {chart80ThresholdVal != null && (
                <div className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 border-b-2 border-dashed border-amber-400 inline-block" />
                  <span className="text-amber-400 font-medium">80% Saturation Limit ({chart80ThresholdVal.toLocaleString()})</span>
                </div>
              )}
              {chartLimitVal != null && (
                <div className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 border-b-2 border-dashed border-rose-400 inline-block" />
                  <span className="text-rose-400 font-medium">100% Plan Cap ({chartLimitVal.toLocaleString()})</span>
                </div>
              )}
              {chartLimitVal == null && selectedTrendTenantId && (
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold">
                    Unlimited Plan Tier
                  </span>
                </div>
              )}
            </div>

            {hoveredTrendPoint && (
              <div className="text-slate-300 font-mono text-xs">
                <span className="text-amber-400 font-semibold">{hoveredTrendPoint.date}: </span>
                {trendMetric === 'employees' && `${hoveredTrendPoint.activeEmployees.toLocaleString()} employees`}
                {trendMetric === 'storage' && `${hoveredTrendPoint.storageUsedGb.toLocaleString()} GB`}
                {trendMetric === 'api_calls' && `${hoveredTrendPoint.apiCalls.toLocaleString()} calls`}
              </div>
            )}
          </div>

          {/* SVG Visualizer */}
          <div className="h-56 w-full relative bg-slate-950/60 rounded-xl border border-slate-800/80 p-2 overflow-hidden flex flex-col justify-end">
            {loadingTrends ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
                Loading trend timeseries...
              </div>
            ) : trendPoints.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No timeseries points recorded in the last {trendDays} days. Run manual metering to seed.
              </div>
            ) : (
              <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 200" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid horizontal lines */}
                {[0.25, 0.5, 0.75].map((pct, idx) => (
                  <line
                    key={idx}
                    x1="0"
                    y1={200 - pct * 180}
                    x2="1000"
                    y2={200 - pct * 180}
                    stroke="#1e293b"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                ))}

                {/* 100% Plan limit reference line */}
                {chartLimitVal != null && (
                  <g>
                    <line
                      x1="0"
                      y1={Math.max(10, 200 - (chartLimitVal / chartMaxVal) * 180)}
                      x2="1000"
                      y2={Math.max(10, 200 - (chartLimitVal / chartMaxVal) * 180)}
                      stroke="#f43f5e"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                    />
                    <text
                      x="990"
                      y={Math.max(22, 195 - (chartLimitVal / chartMaxVal) * 180)}
                      fill="#f43f5e"
                      fontSize="10"
                      textAnchor="end"
                      fontWeight="bold"
                    >
                      Plan Cap (100%)
                    </text>
                  </g>
                )}

                {/* 80% Warning threshold reference line */}
                {chart80ThresholdVal != null && (
                  <g>
                    <line
                      x1="0"
                      y1={Math.max(15, 200 - (chart80ThresholdVal / chartMaxVal) * 180)}
                      x2="1000"
                      y2={Math.max(15, 200 - (chart80ThresholdVal / chartMaxVal) * 180)}
                      stroke="#fbbf24"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    <text
                      x="990"
                      y={Math.max(26, 195 - (chart80ThresholdVal / chartMaxVal) * 180)}
                      fill="#fbbf24"
                      fontSize="9"
                      textAnchor="end"
                    >
                      80% Threshold
                    </text>
                  </g>
                )}

                {/* Trend Polyline & Area Fill */}
                {(() => {
                  const n = trendPoints.length;
                  if (n < 2) return null;
                  const coords = trendPoints.map((pt, idx) => {
                    const x = (idx / (n - 1)) * 980 + 10;
                    let val = 0;
                    if (trendMetric === 'employees') val = pt.activeEmployees;
                    else if (trendMetric === 'storage') val = pt.storageUsedGb;
                    else val = pt.apiCalls;

                    const y = Math.max(10, 200 - (val / chartMaxVal) * 180);
                    return { x, y, pt };
                  });

                  const pointsString = coords.map((c) => `${c.x},${c.y}`).join(' ');
                  const areaString = `10,200 ${pointsString} ${coords[coords.length - 1].x},200`;

                  return (
                    <g>
                      <polygon points={areaString} fill="url(#usageGradient)" />
                      <polyline
                        points={pointsString}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {coords.map((c, i) => (
                        <circle
                          key={i}
                          cx={c.x}
                          cy={c.y}
                          r="4"
                          fill="#f59e0b"
                          stroke="#0f172a"
                          strokeWidth="2"
                          className="hover:r-6 cursor-pointer transition-all"
                          onMouseEnter={() => setHoveredTrendPoint(c.pt)}
                          onMouseLeave={() => setHoveredTrendPoint(null)}
                        />
                      ))}
                    </g>
                  );
                })()}
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Main Tenant Usage vs Plan Limits Table Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Controls & Filter Toolbar */}
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search tenant name or subdomain..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Quick Status Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  statusFilter === 'all'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Tenants ({summary.totalTenants})
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter('near_limit');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  statusFilter === 'near_limit'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                    : 'text-amber-400/80 hover:text-amber-300'
                }`}
              >
                <AlertTriangle className="h-3 w-3" />
                Near Limit (≥80%)
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-200 text-[10px]">
                  {summary.nearLimitCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter('over_limit');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  statusFilter === 'over_limit'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm'
                    : 'text-rose-400/80 hover:text-rose-300'
                }`}
              >
                <AlertCircle className="h-3 w-3" />
                Exceeded (≥100%)
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500/30 text-rose-200 text-[10px]">
                  {summary.overLimitCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter('normal');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  statusFilter === 'normal'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                    : 'text-emerald-400/80 hover:text-emerald-300'
                }`}
              >
                <CheckCircle2 className="h-3 w-3" />
                Normal ({summary.normalCount})
              </button>
            </div>
          </div>

          {/* Secondary Filter Dropdowns */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Resource Bottleneck Filter */}
              <div className="flex items-center gap-1.5 text-slate-400">
                <Filter className="h-3.5 w-3.5 text-slate-500" />
                <span>Resource:</span>
                <select
                  value={resourceFilter}
                  onChange={(e) => {
                    setResourceFilter(e.target.value as any);
                    setPage(1);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value="all">All Resources</option>
                  <option value="employees">Employees Near/Over Limit</option>
                  <option value="storage">Storage Near/Over Limit</option>
                  <option value="api_calls">API Calls Near/Over Limit</option>
                </select>
              </div>

              {/* Plan Filter */}
              <div className="flex items-center gap-1.5 text-slate-400">
                <span>Plan:</span>
                <select
                  value={planFilter}
                  onChange={(e) => {
                    setPlanFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value="all">All Plan Tiers</option>
                  <option value="free">Free</option>
                  <option value="starter">Starter</option>
                  <option value="business">Business</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>

            <div className="text-slate-400">
              Showing <span className="font-semibold text-white">{overviewData?.items.length ?? 0}</span> of{' '}
              <span className="font-semibold text-white">{overviewData?.total ?? 0}</span> matching tenants
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th
                  onClick={() => handleSort('tenantName')}
                  className="px-4 py-3 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5">
                    Tenant Workspace
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-3">Plan Tier</th>
                <th
                  onClick={() => handleSort('employeePercent')}
                  className="px-4 py-3 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5">
                    Active Employees vs. Cap
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('storagePercent')}
                  className="px-4 py-3 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5">
                    Storage vs. Allocation
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('apiPercent')}
                  className="px-4 py-3 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5">
                    Daily API Calls vs. Limit
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('maxUsagePercent')}
                  className="px-4 py-3 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5">
                    Saturation Status
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/80">
              {loadingOverview ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto text-amber-500 mb-2" />
                    Loading tenant limits and usage records...
                  </td>
                </tr>
              ) : overviewData?.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <HelpCircle className="h-6 w-6 mx-auto text-slate-500 mb-2" />
                    No tenants matched the selected filters.
                  </td>
                </tr>
              ) : (
                overviewData?.items.map((row) => {
                  const isNear = row.overallStatus === 'near_limit';
                  const isOver = row.overallStatus === 'over_limit';

                  return (
                    <tr
                      key={row.tenantId}
                      onClick={() => handleRowClick(row.tenantId)}
                      className={`hover:bg-slate-800/40 cursor-pointer transition ${
                        isOver
                          ? 'bg-rose-500/5 hover:bg-rose-500/10'
                          : isNear
                          ? 'bg-amber-500/5 hover:bg-amber-500/10'
                          : ''
                      }`}
                    >
                      {/* Tenant Identity */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                              isOver
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : isNear
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {row.tenantName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              {row.tenantName}
                              {row.hasCustomOverrides && (
                                <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono" title="Custom limit override active">
                                  Custom Override
                                </span>
                              )}
                            </div>
                            <div className="text-slate-400 font-mono text-[11px]">
                              {row.subdomain}.cmsnbd.com
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Plan Tier */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            row.planCode === 'enterprise'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : row.planCode === 'business'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : row.planCode === 'starter'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {row.planName}
                        </span>
                      </td>

                      {/* Active Employees vs Limit */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1.5 min-w-[140px]">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono font-medium text-slate-200">
                              {row.activeEmployees.toLocaleString()}
                              <span className="text-slate-500"> / {row.employeeLimit ? row.employeeLimit.toLocaleString() : '∞'}</span>
                            </span>
                            {row.employeeUsagePercent != null ? (
                              <span
                                className={`font-mono font-bold ${
                                  row.isEmployeeOverLimit
                                    ? 'text-rose-400'
                                    : row.isEmployeeNearLimit
                                    ? 'text-amber-400'
                                    : 'text-slate-400'
                                }`}
                              >
                                {row.employeeUsagePercent}%
                              </span>
                            ) : (
                              <span className="text-emerald-400 text-[10px] font-mono">Unlimited</span>
                            )}
                          </div>
                          {row.employeeLimit ? (
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  row.isEmployeeOverLimit
                                    ? 'bg-rose-500'
                                    : row.isEmployeeNearLimit
                                    ? 'bg-amber-400'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(row.employeeUsagePercent ?? 0, 100)}%` }}
                              />
                            </div>
                          ) : (
                            <div className="h-1.5 w-full bg-slate-800/40 rounded-full overflow-hidden">
                              <div className="h-full w-full bg-emerald-500/30 rounded-full" />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Storage vs Limit */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1.5 min-w-[140px]">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono font-medium text-slate-200">
                              {row.storageUsedGb >= 1 ? `${row.storageUsedGb} GB` : `${row.storageUsedMb} MB`}
                              <span className="text-slate-500">
                                {' / '}
                                {row.storageLimitGb ? `${row.storageLimitGb} GB` : '∞'}
                              </span>
                            </span>
                            {row.storageUsagePercent != null ? (
                              <span
                                className={`font-mono font-bold ${
                                  row.isStorageOverLimit
                                    ? 'text-rose-400'
                                    : row.isStorageNearLimit
                                    ? 'text-amber-400'
                                    : 'text-slate-400'
                                }`}
                              >
                                {row.storageUsagePercent}%
                              </span>
                            ) : (
                              <span className="text-emerald-400 text-[10px] font-mono">Unlimited</span>
                            )}
                          </div>
                          {row.storageLimitGb ? (
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  row.isStorageOverLimit
                                    ? 'bg-rose-500'
                                    : row.isStorageNearLimit
                                    ? 'bg-amber-400'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(row.storageUsagePercent ?? 0, 100)}%` }}
                              />
                            </div>
                          ) : (
                            <div className="h-1.5 w-full bg-slate-800/40 rounded-full overflow-hidden">
                              <div className="h-full w-full bg-emerald-500/30 rounded-full" />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* API Calls vs Limit */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1.5 min-w-[140px]">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono font-medium text-slate-200">
                              {row.apiCalls.toLocaleString()}
                              <span className="text-slate-500">
                                {' / '}
                                {row.apiCallLimit ? row.apiCallLimit.toLocaleString() : '∞'}
                              </span>
                            </span>
                            {row.apiCallUsagePercent != null ? (
                              <span
                                className={`font-mono font-bold ${
                                  row.isApiOverLimit
                                    ? 'text-rose-400'
                                    : row.isApiNearLimit
                                    ? 'text-amber-400'
                                    : 'text-slate-400'
                                }`}
                              >
                                {row.apiCallUsagePercent}%
                              </span>
                            ) : (
                              <span className="text-emerald-400 text-[10px] font-mono">Unlimited</span>
                            )}
                          </div>
                          {row.apiCallLimit ? (
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  row.isApiOverLimit
                                    ? 'bg-rose-500'
                                    : row.isApiNearLimit
                                    ? 'bg-amber-400'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(row.apiCallUsagePercent ?? 0, 100)}%` }}
                              />
                            </div>
                          ) : (
                            <div className="h-1.5 w-full bg-slate-800/40 rounded-full overflow-hidden">
                              <div className="h-full w-full bg-emerald-500/30 rounded-full" />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Saturation Status */}
                      <td className="px-4 py-3.5">
                        {isOver ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-bold">
                            <AlertCircle className="h-3 w-3" />
                            Exceeded ({row.maxUsagePercent}%)
                          </div>
                        ) : isNear ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold">
                            <AlertTriangle className="h-3 w-3" />
                            Near Limit ({row.maxUsagePercent}%)
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium">
                            <CheckCircle2 className="h-3 w-3" />
                            Normal
                          </div>
                        )}
                        {(row.nearLimitResources.length > 0 || row.overLimitResources.length > 0) && (
                          <div className="text-[10px] text-slate-400 mt-1 capitalize">
                            Bottleneck: {[...row.overLimitResources, ...row.nearLimitResources].join(', ')}
                          </div>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(row.tenantId);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-xs font-semibold transition"
                          title="View Tenant Detail"
                        >
                          <span>Details</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {overviewData && overviewData.total > 0 && (
          <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div>
              Showing <span className="font-semibold text-white">{(page - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-white">
                {Math.min(page * pageSize, overviewData.total)}
              </span>{' '}
              of <span className="font-semibold text-white">{overviewData.total}</span> tenants
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 font-mono text-slate-300">
                Page {page} of {Math.ceil(overviewData.total / pageSize)}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page * pageSize >= overviewData.total}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
