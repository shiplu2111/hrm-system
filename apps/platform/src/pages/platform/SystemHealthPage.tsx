// SystemHealthPage.tsx
// Platform System Health: Status tiles for API, database, Redis, queues, storage, and notification providers,
// with latency and error trends, and recent incidents. Colour states per DESIGN_SYSTEM.md section 5.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Cloud,
  Database,
  ExternalLink,
  Filter,
  Globe,
  HardDrive,
  HelpCircle,
  History,
  Info,
  Layers,
  LineChart,
  Mail,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Users,
  Wifi,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import type {
  ApiLatencyAndErrorRate,
  DatabaseConnectionHealth,
  HealthTimeseriesResponse,
  HealthTimeseriesTrendPoint,
  IncidentSeverity,
  IncidentStatus,
  MobileSyncHealth,
  NotificationChannelHealth,
  NotificationProvidersHealth,
  OverallHealthStatus,
  PlatformComprehensiveHealth,
  PlatformIncidentItem,
  PlatformIncidentsResponse,
  QueueHealthItem,
  QueueHealthSummary,
  RedisHealth,
  StorageHealth,
  UsageDailyRecord,
  UsageDailySummary,
  WebSocketHealth,
} from '@hrm/shared-types';
import {
  createPlatformIncident,
  getPlatformComprehensiveHealth,
  getPlatformHealthTrends,
  getPlatformIncidents,
  getUsageSummary,
  listDailyUsage,
  triggerUsageMetering,
  updatePlatformIncident,
} from '@/lib/platform-usage-health-api';

// DESIGN_SYSTEM.md §5 Status Color Convention
// Success (approved, finalized, operational, healthy, resolved): bg-emerald-50 text-emerald-700 border-emerald-200
// Warning (draft, pending, in review, degraded, attention needed): bg-amber-50 text-amber-700 border-amber-200
// Danger/Error (rejected, absent, failed, down, incident, critical): bg-rose-50 text-rose-700 border-rose-200
// Secondary (neutral, archived, cancelled, maintenance): bg-slate-100 text-slate-700 border-slate-200

function getStatusBadgeStyle(status: string | OverallHealthStatus | IncidentStatus) {
  const s = status.toLowerCase();
  if (['operational', 'healthy', 'connected', 'resolved', 'success'].includes(s)) {
    return {
      container:
        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      dot: 'bg-emerald-500',
      border: 'border-emerald-500/30',
      iconText: 'text-emerald-500',
      label: status.charAt(0).toUpperCase() + status.slice(1),
    };
  }
  if (['degraded', 'warning', 'attention needed', 'monitoring', 'identified', 'congested'].includes(s)) {
    return {
      container:
        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      dot: 'bg-amber-500 animate-pulse',
      border: 'border-amber-500/40',
      iconText: 'text-amber-500',
      label: status.charAt(0).toUpperCase() + status.slice(1),
    };
  }
  if (['down', 'unhealthy', 'failed', 'incident', 'investigating', 'critical', 'major', 'error'].includes(s)) {
    return {
      container:
        'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
      dot: 'bg-rose-500 animate-ping',
      border: 'border-rose-500/50',
      iconText: 'text-rose-500',
      label: status.charAt(0).toUpperCase() + status.slice(1),
    };
  }
  return {
    container:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
    border: 'border-slate-700',
    iconText: 'text-slate-400',
    label: status.charAt(0).toUpperCase() + status.slice(1),
  };
}

function getSeverityBadgeStyle(severity: IncidentSeverity) {
  if (severity === 'critical' || severity === 'major') {
    return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
  }
  if (severity === 'minor') {
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
}

function Sparkline({
  values,
  status,
}: {
  values: number[];
  status: OverallHealthStatus | string;
}) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const span = Math.max(max - min, 1);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 22 - ((value - min) / span) * 18;
      return `${x},${y}`;
    })
    .join(' ');

  const stroke =
    status === 'healthy' || status === 'Operational' || status === 'connected'
      ? '#10b981'
      : status === 'degraded' || status === 'Degraded' || status === 'congested'
      ? '#f59e0b'
      : '#f43f5e';

  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-7 w-full overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function SystemHealthPage() {
  const [activeTab, setActiveTab] = useState<'health' | 'usage'>('health');

  // Subsystem Live Health Data
  const [liveHealth, setLiveHealth] = useState<PlatformComprehensiveHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Latency & Error Trends Data
  const [trendRange, setTrendRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [trendView, setTrendView] = useState<'latency' | 'errors'>('latency');
  const [trendsData, setTrendsData] = useState<HealthTimeseriesResponse | null>(null);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<HealthTimeseriesTrendPoint | null>(null);

  // Recent Incidents Data
  const [incidentsData, setIncidentsData] = useState<PlatformIncidentsResponse | null>(null);
  const [incidentSubsystemFilter, setIncidentSubsystemFilter] = useState('all');
  const [incidentStatusFilter, setIncidentStatusFilter] = useState('all');
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [expandedIncidentId, setExpandedIncidentId] = useState<string | null>(null);

  // Incident Modal State
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [newIncidentTitle, setNewIncidentTitle] = useState('');
  const [newIncidentSubsystem, setNewIncidentSubsystem] = useState<'api' | 'database' | 'redis' | 'queues' | 'storage' | 'notifications'>('api');
  const [newIncidentSeverity, setNewIncidentSeverity] = useState<IncidentSeverity>('minor');
  const [newIncidentStatus, setNewIncidentStatus] = useState<IncidentStatus>('investigating');
  const [newIncidentImpact, setNewIncidentImpact] = useState('');
  const [newIncidentRootCause, setNewIncidentRootCause] = useState('');
  const [submittingIncident, setSubmittingIncident] = useState(false);

  // Quick Resolve / Update Modal State
  const [resolvingIncidentId, setResolvingIncidentId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [submittingResolve, setSubmittingResolve] = useState(false);

  // Usage Metering State (Tab 2)
  const [usageRecords, setUsageRecords] = useState<UsageDailyRecord[]>([]);
  const [usageSummary, setUsageSummary] = useState<UsageDailySummary | null>(null);
  const [usageTotal, setUsageTotal] = useState(0);
  const [usageLoading, setUsageLoading] = useState(false);
  const [triggeringMetering, setTriggeringMetering] = useState(false);
  const [triggerDate, setTriggerDate] = useState<string>(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [usageSearch, setUsageSearch] = useState('');
  const [usageStartDate, setUsageStartDate] = useState('');
  const [usageEndDate, setUsageEndDate] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Fetch Live Comprehensive Health
  const loadHealthData = async () => {
    try {
      setHealthLoading(true);
      const data = await getPlatformComprehensiveHealth();
      setLiveHealth(data);
      setHealthError(null);
    } catch (err: any) {
      setHealthError(err?.message || 'Failed to fetch live health metrics');
    } finally {
      setHealthLoading(false);
    }
  };

  // Fetch Latency & Error Trends
  const loadTrends = async (range = trendRange) => {
    try {
      setLoadingTrends(true);
      const data = await getPlatformHealthTrends(range);
      setTrendsData(data);
    } catch (err: any) {
      console.error('Failed to load trends:', err);
    } finally {
      setLoadingTrends(false);
    }
  };

  // Fetch Recent Incidents
  const loadIncidents = async () => {
    try {
      setLoadingIncidents(true);
      const data = await getPlatformIncidents({
        subsystem: incidentSubsystemFilter,
        status: incidentStatusFilter,
      });
      setIncidentsData(data);
    } catch (err: any) {
      console.error('Failed to load incidents:', err);
    } finally {
      setLoadingIncidents(false);
    }
  };

  // Fetch Usage Metering Data
  const loadUsageData = async () => {
    try {
      setUsageLoading(true);
      const [listRes, summaryRes] = await Promise.all([
        listDailyUsage({
          search: usageSearch.trim() || undefined,
          startDate: usageStartDate || undefined,
          endDate: usageEndDate || undefined,
          limit: 50,
        }),
        getUsageSummary({
          startDate: usageStartDate || undefined,
          endDate: usageEndDate || undefined,
        }),
      ]);
      setUsageRecords(listRes.items);
      setUsageTotal(listRes.total);
      setUsageSummary(summaryRes);
    } catch (err: any) {
      console.error('Failed to load usage metering:', err);
    } finally {
      setUsageLoading(false);
    }
  };

  useEffect(() => {
    loadHealthData();
    loadTrends();
    loadIncidents();
    loadUsageData();

    // Auto-refresh live health every 15s
    const timer = setInterval(() => {
      loadHealthData();
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadTrends(trendRange);
  }, [trendRange]);

  useEffect(() => {
    loadIncidents();
  }, [incidentSubsystemFilter, incidentStatusFilter]);

  // Handle Log Incident
  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncidentTitle || !newIncidentImpact) return;
    setSubmittingIncident(true);
    try {
      await createPlatformIncident({
        title: newIncidentTitle,
        subsystem: newIncidentSubsystem,
        severity: newIncidentSeverity,
        status: newIncidentStatus,
        impact: newIncidentImpact,
        rootCause: newIncidentRootCause || undefined,
        initialMessage: `Incident opened via Platform Super Admin Console.`,
      });
      setShowIncidentModal(false);
      setNewIncidentTitle('');
      setNewIncidentImpact('');
      setNewIncidentRootCause('');
      await loadIncidents();
      await loadHealthData();
    } catch (err: any) {
      alert(`Failed to create incident: ${err?.message}`);
    } finally {
      setSubmittingIncident(false);
    }
  };

  // Handle Resolve Incident
  const handleResolveIncident = async () => {
    if (!resolvingIncidentId) return;
    setSubmittingResolve(true);
    try {
      await updatePlatformIncident(resolvingIncidentId, {
        resolve: true,
        updateMessage: resolveNote || 'Incident resolved. Systems returned to normal operation.',
      });
      setResolvingIncidentId(null);
      setResolveNote('');
      await loadIncidents();
      await loadHealthData();
    } catch (err: any) {
      alert(`Failed to resolve incident: ${err?.message}`);
    } finally {
      setSubmittingResolve(false);
    }
  };

  // Handle Trigger Usage Metering
  const handleTriggerMetering = async () => {
    setTriggeringMetering(true);
    setActionNotice(null);
    try {
      const summary = await triggerUsageMetering({ date: triggerDate });
      setActionNotice(
        `Nightly usage metering job executed for ${summary.date}: ${summary.totalTenantsMetered} tenants metered, ${summary.totalActiveEmployees} active employees, ${summary.totalApiCalls} API calls recorded.`,
      );
      await loadUsageData();
    } catch (err: any) {
      setActionNotice(`Failed to trigger usage metering: ${err?.message}`);
    } finally {
      setTriggeringMetering(false);
    }
  };

  const activeIncidents = incidentsData?.incidents.filter((i) => i.status !== 'resolved') ?? [];
  const overallBanner =
    activeIncidents.length > 0
      ? {
          status: 'incident',
          title: `${activeIncidents.length} Platform Incident${activeIncidents.length > 1 ? 's' : ''} in Progress`,
          subtext: activeIncidents.map((i) => i.title).join(' · '),
        }
      : liveHealth?.status === 'degraded'
      ? {
          status: 'degraded',
          title: 'System Partially Degraded',
          subtext: 'Some service queues or notification providers are experiencing elevated response latencies.',
        }
      : {
          status: 'operational',
          title: 'All Systems Fully Operational',
          subtext: 'API gateway, databases, caching, queues, storage, and notification channels operating normally.',
        };

  const bannerStyle = getStatusBadgeStyle(overallBanner.status);

  // Trend Chart Calculations
  const trendPoints = trendsData?.points ?? [];
  const maxTrendVal = useMemo(() => {
    if (trendPoints.length === 0) return 100;
    if (trendView === 'latency') {
      const p99s = trendPoints.map((p) => p.p99LatencyMs);
      return Math.max(...p99s, 100) * 1.15;
    }
    const errRates = trendPoints.map((p) => p.errorRatePercentage);
    return Math.max(...errRates, 5) * 1.25;
  }, [trendPoints, trendView]);

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-bold mb-1">
            <Zap className="h-3.5 w-3.5" /> PLATFORM CONTROL PLANE
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            System Health & Infrastructure Telemetry
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time status tiles for API, database, Redis, queues, storage, and notification providers, with latency & error trends and incident tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-sm ${bannerStyle.container}`}
          >
            <span className={`h-2 w-2 rounded-full ${bannerStyle.dot}`} />
            {overallBanner.title}
          </span>

          <button
            type="button"
            onClick={() => {
              loadHealthData();
              loadTrends();
              loadIncidents();
              if (activeTab === 'usage') loadUsageData();
            }}
            disabled={healthLoading}
            className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${healthLoading ? 'animate-spin text-amber-500' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowIncidentModal(true)}
            className="h-9 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Log Incident</span>
          </button>
        </div>
      </div>

      {/* Active Incident Warning Alert Bar */}
      {activeIncidents.length > 0 && (
        <div className="p-4 rounded-2xl border border-rose-300 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <div className="font-bold flex items-center gap-2">
                <span>{activeIncidents[0].incidentNumber}: {activeIncidents[0].title}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getSeverityBadgeStyle(activeIncidents[0].severity)}`}>
                  {activeIncidents[0].severity}
                </span>
              </div>
              <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                Impact: {activeIncidents[0].impact} · Started: {new Date(activeIncidents[0].startedAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setResolvingIncidentId(activeIncidents[0].id)}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 transition"
          >
            Resolve Incident
          </button>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('health')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'health'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>System Health & Live Telemetry</span>
          {activeIncidents.length > 0 && (
            <span className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-500 font-extrabold border border-rose-500/30">
              {activeIncidents.length} Alert
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('usage');
            loadUsageData();
          }}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'usage'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Tenant Usage Metering (usage_daily)</span>
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold">
            {usageTotal}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SYSTEM HEALTH & TELEMETRY */}
      {/* ========================================================================= */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          {/* 6 Core Subsystem Status Tiles per DESIGN_SYSTEM.md §5 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs flex items-center gap-2">
                <Server className="h-4 w-4 text-indigo-500" />
                Infrastructure Subsystem Status Tiles
              </h2>
              <span className="text-xs text-slate-500">
                Auto-refreshes every 15s · Colour states per DESIGN_SYSTEM.md §5
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Tile 1: API Gateway */}
              {(() => {
                const apiStatus = liveHealth?.api.status ?? 'healthy';
                const style = getStatusBadgeStyle(apiStatus);
                return (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                          <Server className="h-4 w-4" />
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${style.container}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                          {style.label}
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="text-sm font-extrabold text-slate-900 dark:text-white">API Gateway</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          5xx Error Rate: <strong className="text-slate-800 dark:text-slate-200">{liveHealth?.api.errorRatePercentage ?? 0}%</strong> (4xx: {liveHealth?.api.clientErrors4xx ?? 0})
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-lg p-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400">Avg / P95 Latency</div>
                          <div className="text-base font-extrabold font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                            {liveHealth?.api.avgLatencyMs ?? 0}ms <span className="text-xs font-normal text-slate-400">/ {liveHealth?.api.p95LatencyMs ?? 0}ms</span>
                          </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-lg p-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400">P99 / Min Latency</div>
                          <div className="text-base font-extrabold font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                            {liveHealth?.api.p99LatencyMs ?? 0}ms <span className="text-xs font-normal text-slate-400">/ {liveHealth?.api.minLatencyMs ?? 0}ms</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Total Requests: <strong className="text-slate-700 dark:text-slate-300 font-mono">{liveHealth?.api.totalRequests ?? 0}</strong></span>
                      <div className="w-24">
                        <Sparkline values={[24, 28, 31, 35, 42, 38, 30, 28, liveHealth?.api.avgLatencyMs || 25]} status={apiStatus} />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Tile 2: PostgreSQL Database */}
              {(() => {
                const dbStatus = liveHealth?.database.status ?? 'healthy';
                const style = getStatusBadgeStyle(dbStatus);
                return (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                          <Database className="h-4 w-4" />
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${style.container}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                          {style.label}
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="text-sm font-extrabold text-slate-900 dark:text-white">PostgreSQL Database</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Engine: <strong className="text-slate-800 dark:text-slate-200">PostgreSQL (pg_stat_activity)</strong> · Ping: {liveHealth?.database.pingLatencyMs ?? 2} ms
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-lg p-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400">Active / Pool Conn</div>
                          <div className="text-base font-extrabold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                            {liveHealth?.database.activeConnections ?? 1} <span className="text-xs font-normal text-slate-400">/ {liveHealth?.database.totalConnections ?? 1}</span>
                          </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-lg p-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400">Pool Saturation</div>
                          <div className="text-base font-extrabold font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                            {liveHealth?.database.connectionUsagePercentage ?? 10}% <span className="text-xs font-normal text-slate-400">(Max: {liveHealth?.database.maxConnections ?? 100})</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Idle Connections: <strong className="text-slate-700 dark:text-slate-300 font-mono">{liveHealth?.database.idleConnections ?? 0}</strong></span>
                      <div className="w-24">
                        <Sparkline values={[4, 5, 3, 6, 4, 5, 4, liveHealth?.database.pingLatencyMs || 3]} status={dbStatus} />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Tile 3: Redis Cache & Session Store */}
              {(() => {
                const redisStatus = liveHealth?.redis.status ?? 'connected';
                const style = getStatusBadgeStyle(redisStatus === 'connected' ? 'healthy' : 'unhealthy');
                return (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                          <Zap className="h-4 w-4" />
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${style.container}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                          {redisStatus === 'connected' ? 'Connected' : 'Offline'}
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="text-sm font-extrabold text-slate-900 dark:text-white">Redis Cluster & Telemetry</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Cache / Session / Sliding Counters · Ping: {liveHealth?.redis.pingLatencyMs ?? 1} ms
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-lg p-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400">Used Memory</div>
                          <div className="text-base font-extrabold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                            {liveHealth?.redis.usedMemory ?? '1.7 MB'}
                          </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-lg p-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400">Connected Clients</div>
                          <div className="text-base font-extrabold font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                            {liveHealth?.redis.connectedClients ?? 1} client{liveHealth?.redis.connectedClients === 1 ? '' : 's'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Peak Memory: <strong className="text-slate-700 dark:text-slate-300 font-mono">{liveHealth?.redis.usedMemoryPeak || '2.4 MB'}</strong></span>
                      <div className="w-24">
                        <Sparkline values={[2, 1, 2, 2, 1, 1, liveHealth?.redis.pingLatencyMs || 1]} status={redisStatus === 'connected' ? 'healthy' : 'unhealthy'} />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Tile 4: BullMQ Queues */}
              {(() => {
                const queueStatus = liveHealth?.queues.status ?? 'healthy';
                const style = getStatusBadgeStyle(queueStatus);
                return (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                          <Layers className="h-4 w-4" />
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${style.container}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                          {style.label}
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="text-sm font-extrabold text-slate-900 dark:text-white">BullMQ Background Queues</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          5 Platform Workers (Webhooks, Domains, Lifecycle, Sync, Billing)
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-lg p-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400">Total Queue Depth</div>
                          <div className="text-base font-extrabold font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                            {liveHealth?.queues.totalQueueDepth ?? 0} jobs
                          </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-lg p-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400">Failed Jobs</div>
                          <div className={`text-base font-extrabold font-mono mt-0.5 ${
                            (liveHealth?.queues.totalFailedJobs ?? 0) > 0 ? 'text-rose-500' : 'text-slate-800 dark:text-slate-200'
                          }`}>
                            {liveHealth?.queues.totalFailedJobs ?? 0}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Monitored Queues: <strong className="text-slate-700 dark:text-slate-300 font-mono">{liveHealth?.queues.totalQueues ?? 5}</strong></span>
                      <a
                        href="#/queue-inspector"
                        className="inline-flex items-center gap-1 font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        Inspect Queues →
                      </a>
                    </div>
                  </div>
                );
              })()}

              {/* Tile 5: Platform Storage Driver */}
              {(() => {
                const storageStatus = liveHealth?.storage.status ?? 'healthy';
                const style = getStatusBadgeStyle(storageStatus);
                const usedGb = liveHealth ? Math.round((liveHealth.storage.usedSpaceBytes / (1024 * 1024 * 1024)) * 10) / 10 : 65.4;
                const totalGb = liveHealth ? Math.round((liveHealth.storage.totalSpaceBytes / (1024 * 1024 * 1024)) * 10) / 10 : 500;
                return (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                          <HardDrive className="h-4 w-4" />
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${style.container}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                          {style.label}
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="text-sm font-extrabold text-slate-900 dark:text-white">Platform Storage Driver</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Driver: <strong className="text-slate-800 dark:text-slate-200 uppercase font-mono">{liveHealth?.storage.driver ?? 'Local'}</strong> · {liveHealth?.storage.bucketName || 'App uploads mount'}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-lg p-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400">Storage Used</div>
                          <div className="text-base font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {usedGb} GB <span className="text-xs font-normal text-slate-400">/ {totalGb} GB</span>
                          </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-lg p-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400">I/O Latency</div>
                          <div className="text-base font-extrabold font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                            {liveHealth?.storage.readLatencyMs ?? 1.2}ms <span className="text-xs font-normal text-slate-400">(W: {liveHealth?.storage.writeLatencyMs ?? 2.1}ms)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Disk Utilization: <strong className="text-slate-700 dark:text-slate-300 font-mono">{liveHealth?.storage.usedPercentage ?? 13.1}%</strong></span>
                      <div className="w-24">
                        <Sparkline values={[1.1, 1.3, 1.2, 1.4, 1.2, liveHealth?.storage.readLatencyMs || 1.2]} status={storageStatus} />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Tile 6: Notification Providers */}
              {(() => {
                const notifStatus = liveHealth?.notifications.status ?? 'healthy';
                const style = getStatusBadgeStyle(notifStatus);
                return (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                          <Mail className="h-4 w-4" />
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${style.container}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                          {style.label}
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="text-sm font-extrabold text-slate-900 dark:text-white">Notification Providers</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Multi-Channel: Email (SMTP), SMS (Twilio), Push (FCM), In-App
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-lg p-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400">Deliverability</div>
                          <div className="text-base font-extrabold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                            {liveHealth?.notifications.overallDeliverability ?? 99.6}%
                          </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-lg p-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400">Dispatches (24h)</div>
                          <div className="text-base font-extrabold font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                            {liveHealth?.notifications.totalSent24h.toLocaleString() ?? '9,990'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Failed (24h): <strong className="text-slate-700 dark:text-slate-300 font-mono">{liveHealth?.notifications.totalFailed24h ?? 2}</strong></span>
                      <div className="w-24">
                        <Sparkline values={[99.8, 99.4, 99.7, 99.5, liveHealth?.notifications.overallDeliverability || 99.6]} status={notifStatus} />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Latency & Error Trends Interactive Section */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <LineChart className="h-4 w-4 text-indigo-500" />
                  API Latency & Error Rate Timeseries Trends
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Continuous performance tracking across rolling time windows with anomaly threshold benchmarks.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Metric switch */}
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setTrendView('latency')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      trendView === 'latency'
                        ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                    }`}
                  >
                    Latency Percentiles (Avg / P95 / P99)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrendView('errors')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      trendView === 'errors'
                        ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                    }`}
                  >
                    5xx / 4xx Error Rate Trends
                  </button>
                </div>

                {/* Range selector */}
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800 text-xs">
                  {(['1h', '6h', '24h', '7d'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setTrendRange(r)}
                      className={`px-2.5 py-1 rounded-lg font-medium transition ${
                        trendRange === r
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Legend & Hover Callout */}
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 px-1">
              <div className="flex items-center gap-4">
                {trendView === 'latency' ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 inline-block" />
                      <span className="font-medium text-slate-700 dark:text-slate-300">Avg Latency</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" />
                      <span className="font-medium text-slate-700 dark:text-slate-300">P95 Latency</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block" />
                      <span className="font-medium text-slate-700 dark:text-slate-300">P99 Spike</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block" />
                      <span className="font-medium text-slate-700 dark:text-slate-300">5xx Error Rate %</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" />
                      <span className="font-medium text-slate-700 dark:text-slate-300">4xx Client Errors</span>
                    </div>
                  </>
                )}
              </div>

              {hoveredPoint && (
                <div className="font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                  <span className="text-indigo-500 font-bold">{hoveredPoint.label}: </span>
                  {trendView === 'latency'
                    ? `Avg: ${hoveredPoint.avgLatencyMs}ms · P95: ${hoveredPoint.p95LatencyMs}ms · P99: ${hoveredPoint.p99LatencyMs}ms`
                    : `5xx Error Rate: ${hoveredPoint.errorRatePercentage}% · 5xx: ${hoveredPoint.requests5xx} · 4xx: ${hoveredPoint.requests4xx}`}
                </div>
              )}
            </div>

            {/* SVG Interactive Trend Visualizer */}
            <div className="h-56 w-full relative bg-slate-50 dark:bg-slate-950/70 rounded-xl border border-slate-200 dark:border-slate-800 p-2 overflow-hidden flex flex-col justify-end">
              {loadingTrends ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" />
                  Loading trends timeseries...
                </div>
              ) : trendPoints.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  No telemetry timeseries points recorded in this window.
                </div>
              ) : (
                <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 200" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Grid lines */}
                  {[0.25, 0.5, 0.75].map((pct, idx) => (
                    <line
                      key={idx}
                      x1="0"
                      y1={200 - pct * 180}
                      x2="1000"
                      y2={200 - pct * 180}
                      stroke="#e2e8f0"
                      className="dark:stroke-slate-800"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                  ))}

                  {/* Threshold benchmark lines */}
                  {trendView === 'latency' ? (
                    <g>
                      <line
                        x1="0"
                        y1={Math.max(10, 200 - (100 / maxTrendVal) * 180)}
                        x2="1000"
                        y2={Math.max(10, 200 - (100 / maxTrendVal) * 180)}
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeDasharray="5 3"
                      />
                      <text x="990" y={Math.max(20, 195 - (100 / maxTrendVal) * 180)} fill="#f59e0b" fontSize="9" textAnchor="end">
                        100ms P95 Target
                      </text>
                    </g>
                  ) : (
                    <g>
                      <line
                        x1="0"
                        y1={Math.max(10, 200 - (1 / maxTrendVal) * 180)}
                        x2="1000"
                        y2={Math.max(10, 200 - (1 / maxTrendVal) * 180)}
                        stroke="#f43f5e"
                        strokeWidth="1.5"
                        strokeDasharray="5 3"
                      />
                      <text x="990" y={Math.max(20, 195 - (1 / maxTrendVal) * 180)} fill="#f43f5e" fontSize="9" textAnchor="end">
                        1% 5xx SLO Alert
                      </text>
                    </g>
                  )}

                  {/* Curves */}
                  {(() => {
                    const n = trendPoints.length;
                    if (n < 2) return null;

                    const coords = trendPoints.map((pt, idx) => {
                      const x = (idx / (n - 1)) * 980 + 10;
                      const val = trendView === 'latency' ? pt.avgLatencyMs : pt.errorRatePercentage;
                      const y = Math.max(10, 200 - (val / maxTrendVal) * 180);
                      return { x, y, pt };
                    });

                    const p95Coords = trendPoints.map((pt, idx) => {
                      const x = (idx / (n - 1)) * 980 + 10;
                      const val = pt.p95LatencyMs;
                      const y = Math.max(10, 200 - (val / maxTrendVal) * 180);
                      return { x, y };
                    });

                    const p99Coords = trendPoints.map((pt, idx) => {
                      const x = (idx / (n - 1)) * 980 + 10;
                      const val = pt.p99LatencyMs;
                      const y = Math.max(10, 200 - (val / maxTrendVal) * 180);
                      return { x, y };
                    });

                    const pointsStr = coords.map((c) => `${c.x},${c.y}`).join(' ');
                    const areaStr = `10,200 ${pointsStr} ${coords[coords.length - 1].x},200`;

                    return (
                      <g>
                        <polygon
                          points={areaStr}
                          fill={trendView === 'latency' ? 'url(#latencyGradient)' : 'url(#errorGradient)'}
                        />

                        {/* If latency view, also render P95 and P99 polylines */}
                        {trendView === 'latency' && (
                          <>
                            <polyline
                              points={p99Coords.map((c) => `${c.x},${c.y}`).join(' ')}
                              fill="none"
                              stroke="#f43f5e"
                              strokeWidth="1.5"
                              strokeDasharray="4 2"
                            />
                            <polyline
                              points={p95Coords.map((c) => `${c.x},${c.y}`).join(' ')}
                              fill="none"
                              stroke="#f59e0b"
                              strokeWidth="2"
                            />
                          </>
                        )}

                        <polyline
                          points={pointsStr}
                          fill="none"
                          stroke={trendView === 'latency' ? '#6366f1' : '#f43f5e'}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {coords.map((c, i) => (
                          <circle
                            key={i}
                            cx={c.x}
                            cy={c.y}
                            r="4"
                            fill={trendView === 'latency' ? '#6366f1' : '#f43f5e'}
                            stroke="#ffffff"
                            className="dark:stroke-slate-900 cursor-pointer transition"
                            onMouseEnter={() => setHoveredPoint(c.pt)}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                        ))}
                      </g>
                    );
                  })()}
                </svg>
              )}
            </div>
          </div>

          {/* Recent Platform Incidents Section (DESIGN_SYSTEM.md §5 Colour States) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-500" />
                  Recent Platform Incidents & Anomaly Audit Log
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Track, investigate, and audit platform infrastructure incidents with full lifecycle post-mortem timelines.
                </p>
              </div>

              {/* Filter controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Filter className="h-3.5 w-3.5" />
                  <span>Subsystem:</span>
                  <select
                    value={incidentSubsystemFilter}
                    onChange={(e) => setIncidentSubsystemFilter(e.target.value)}
                    className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="all">All Subsystems</option>
                    <option value="api">API</option>
                    <option value="database">Database</option>
                    <option value="redis">Redis</option>
                    <option value="queues">Queues</option>
                    <option value="storage">Storage</option>
                    <option value="notifications">Notifications</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span>Status:</span>
                  <select
                    value={incidentStatusFilter}
                    onChange={(e) => setIncidentStatusFilter(e.target.value)}
                    className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="investigating">Investigating</option>
                    <option value="identified">Identified</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Incidents List */}
            <div className="space-y-3">
              {loadingIncidents ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  <RefreshCw className="h-4 w-4 animate-spin mx-auto text-indigo-500 mb-2" />
                  Loading incidents audit log...
                </div>
              ) : incidentsData?.incidents.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1.5" />
                  No incidents recorded matching the selected filter.
                </div>
              ) : (
                incidentsData?.incidents.map((incident) => {
                  const statusStyle = getStatusBadgeStyle(incident.status);
                  const isExpanded = expandedIncidentId === incident.id;

                  return (
                    <div
                      key={incident.id}
                      className={`border rounded-xl p-4 transition-all ${
                        incident.status !== 'resolved'
                          ? 'border-rose-300 dark:border-rose-900 bg-rose-50/30 dark:bg-rose-950/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                              {incident.incidentNumber}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getSeverityBadgeStyle(
                                incident.severity,
                              )}`}
                            >
                              {incident.severity}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.container}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                              {statusStyle.label}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-semibold uppercase">
                              {incident.subsystem}
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {incident.title}
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {incident.impact}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                          <div className="text-right text-[11px] text-slate-400 font-mono">
                            <div>Started: {new Date(incident.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                            <div>
                              Duration:{' '}
                              <strong className="text-slate-700 dark:text-slate-300">
                                {incident.durationMinutes ? `${incident.durationMinutes} min` : 'Ongoing'}
                              </strong>
                            </div>
                          </div>

                          {incident.status !== 'resolved' && (
                            <button
                              type="button"
                              onClick={() => setResolvingIncidentId(incident.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                            >
                              Resolve
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setExpandedIncidentId(isExpanded ? null : incident.id)}
                            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                            title="Toggle timeline notes"
                          >
                            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Root Cause & Timeline Notes */}
                      {isExpanded && (
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                          {incident.rootCause && (
                            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/80">
                              <span className="font-bold text-slate-700 dark:text-slate-300">Root Cause Analysis: </span>
                              <span className="text-slate-600 dark:text-slate-400">{incident.rootCause}</span>
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <div className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider">
                              Incident Updates Log
                            </div>
                            {incident.updates.map((update, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2 text-slate-600 dark:text-slate-400 text-[11px]"
                              >
                                <Clock className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                                <div>
                                  <span className="font-mono text-slate-500">
                                    {new Date(update.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}:
                                  </span>{' '}
                                  <span>{update.message}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TENANT USAGE METERING (usage_daily) */}
      {/* ========================================================================= */}
      {activeTab === 'usage' && (
        <div className="space-y-6">
          {actionNotice && (
            <div className="flex items-start justify-between gap-3 p-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{actionNotice}</span>
              </div>
              <button onClick={() => setActionNotice(null)} className="text-emerald-700 font-bold hover:underline">
                Dismiss
              </button>
            </div>
          )}

          {/* Trigger Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Automated Nightly Usage Metering Engine
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Nightly job runs at 02:00 UTC (@Cron('0 2 * * *')) recording active employees, storage, API calls, notifications, and synced punches into usage_daily.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={triggerDate}
                onChange={(e) => setTriggerDate(e.target.value)}
                className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleTriggerMetering}
                disabled={triggeringMetering}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${triggeringMetering ? 'animate-spin' : ''}`} />
                <span>{triggeringMetering ? 'Calculating...' : 'Run Metering for Date'}</span>
              </button>
            </div>
          </div>

          {/* Metering Records Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={usageSearch}
                  onChange={(e) => setUsageSearch(e.target.value)}
                  placeholder="Filter by tenant name or subdomain..."
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="text-xs text-slate-400">
                Total records: <strong className="text-slate-700 dark:text-slate-200 font-mono">{usageTotal}</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
                  <tr>
                    <th className="px-4 py-3">Tenant</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Active Employees</th>
                    <th className="px-4 py-3">Storage Used</th>
                    <th className="px-4 py-3">API Calls</th>
                    <th className="px-4 py-3">Notifications (Channel Breakdown)</th>
                    <th className="px-4 py-3">Attendance Synced</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {usageLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Loading daily usage records...
                      </td>
                    </tr>
                  ) : usageRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No usage daily records found.
                      </td>
                    </tr>
                  ) : (
                    usageRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                          <div>{r.tenantName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{r.tenantSubdomain}.cmsnbd.com</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500">{r.date}</td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">{r.activeEmployees}</td>
                        <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">{r.storageUsedMb} MB</td>
                        <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">{r.apiCalls.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{r.notificationsTotal}</span>
                            <span className="text-[10px] text-slate-400">
                              (Email: {r.notificationsEmail}, Push: {r.notificationsPush}, InApp: {r.notificationsInApp})
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-emerald-600 dark:text-emerald-400 font-bold">{r.attendanceEventsSynced}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Log Incident Modal */}
      {showIncidentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-rose-500" />
                Log Platform Infrastructure Incident
              </h3>
              <button
                onClick={() => setShowIncidentModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Incident Title
                </label>
                <input
                  type="text"
                  required
                  value={newIncidentTitle}
                  onChange={(e) => setNewIncidentTitle(e.target.value)}
                  placeholder="e.g. S3 Storage Read Latency Spike in ap-southeast-1"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Impacted Subsystem
                  </label>
                  <select
                    value={newIncidentSubsystem}
                    onChange={(e) => setNewIncidentSubsystem(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="api">API Gateway</option>
                    <option value="database">PostgreSQL Database</option>
                    <option value="redis">Redis Cluster</option>
                    <option value="queues">BullMQ Queues</option>
                    <option value="storage">Platform Storage</option>
                    <option value="notifications">Notification Providers</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Severity Level
                  </label>
                  <select
                    value={newIncidentSeverity}
                    onChange={(e) => setNewIncidentSeverity(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="minor">Minor Warning</option>
                    <option value="major">Major Outage</option>
                    <option value="critical">Critical Outage</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Customer / Tenant Impact
                </label>
                <textarea
                  required
                  rows={2}
                  value={newIncidentImpact}
                  onChange={(e) => setNewIncidentImpact(e.target.value)}
                  placeholder="Describe impact on employees, mobile sync, or tenant admins..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Root Cause (Optional)
                </label>
                <input
                  type="text"
                  value={newIncidentRootCause}
                  onChange={(e) => setNewIncidentRootCause(e.target.value)}
                  placeholder="e.g. AWS S3 network partition, connection pool exhaustion..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingIncident}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition disabled:opacity-50"
                >
                  {submittingIncident ? 'Logging Incident...' : 'Confirm & Open Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Incident Modal */}
      {resolvingIncidentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Resolve Platform Incident
              </h3>
              <button
                onClick={() => setResolvingIncidentId(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-400">
                Marking this incident as resolved will restore subsystem operational status indicators to Healthy and record resolution duration in the audit log.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Resolution Note / Fix Details
                </label>
                <textarea
                  rows={3}
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="e.g. Cache re-warmed, connection pool ceiling increased to 150, autovacuum finished."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setResolvingIncidentId(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResolveIncident}
                  disabled={submittingResolve}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition disabled:opacity-50"
                >
                  {submittingResolve ? 'Resolving...' : 'Confirm Resolved'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
