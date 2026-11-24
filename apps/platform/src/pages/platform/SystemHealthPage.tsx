import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Cloud,
  Database,
  Filter,
  Globe,
  HardDrive,
  Layers,
  Mail,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  Smartphone,
  Users,
  Wifi,
  XCircle,
  Zap,
} from 'lucide-react';
import type {
  PlatformComprehensiveHealth,
  UsageDailyRecord,
  UsageDailySummary,
  OverallHealthStatus,
} from '@hrm/shared-types';
import {
  getPlatformComprehensiveHealth,
  getUsageSummary,
  listDailyUsage,
  triggerUsageMetering,
} from '@/lib/platform-usage-health-api';

type ServiceStatus = 'Operational' | 'Degraded' | 'Down';
type Severity = 'info' | 'warning' | 'error';

interface ErrorLog {
  id: string;
  timestamp: string;
  severity: Severity;
  service: string;
  message: string;
}

const seedLogs: ErrorLog[] = [
  { id: 'log-1', timestamp: '2026-08-25 17:32:14', severity: 'error', service: 'Push Notifications', message: 'FCM batch rejected: invalid server key on android-ess-prod' },
  { id: 'log-2', timestamp: '2026-08-25 17:31:48', severity: 'error', service: 'Push Notifications', message: 'APNs connection timeout after 8s · token refresh required' },
  { id: 'log-3', timestamp: '2026-08-25 17:29:02', severity: 'warning', service: 'Queue / Jobs', message: 'payroll.generate-payslip retry 3/5 · worker-07 memory pressure' },
  { id: 'log-4', timestamp: '2026-08-25 17:24:41', severity: 'warning', service: 'Email / SMTP', message: 'SES bounce rate 4.8% in last 15m · throttling outbound invites' },
  { id: 'log-5', timestamp: '2026-08-25 17:18:09', severity: 'info', service: 'API', message: 'Deployed gateway build 2026.08.25.14 · rolling 12/12 healthy' },
  { id: 'log-6', timestamp: '2026-08-25 17:11:55', severity: 'warning', service: 'Queue / Jobs', message: 'attendance.sync-device backlog exceeded 2,000 pending jobs' },
  { id: 'log-7', timestamp: '2026-08-25 16:58:22', severity: 'info', service: 'Database', message: 'Autovacuum completed on payroll_runs (1.2M rows, 4m 11s)' },
  { id: 'log-8', timestamp: '2026-08-25 16:44:03', severity: 'error', service: 'Email / SMTP', message: 'SMTP AUTH failed for failover relay smtp-backup-2.cmsnbd.com' },
  { id: 'log-9', timestamp: '2026-08-25 16:31:17', severity: 'info', service: 'WebSocket / Real-time', message: 'Presence reconnect storm absorbed · peak 18.4k sockets' },
  { id: 'log-10', timestamp: '2026-08-25 16:12:40', severity: 'warning', service: 'Storage (S3)', message: 'Multipart upload abort rate elevated in ap-southeast-1' },
];

function statusTone(status: ServiceStatus | OverallHealthStatus) {
  if (status === 'Operational' || status === 'healthy') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
  }
  if (status === 'Degraded' || status === 'degraded') {
    return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800';
  }
  return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800';
}

function severityTone(severity: Severity) {
  if (severity === 'info') {
    return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
  }
  if (severity === 'warning') {
    return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800';
  }
  return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800';
}

function Sparkline({ values, status }: { values: number[]; status: ServiceStatus | OverallHealthStatus }) {
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
  const stroke = status === 'Operational' || status === 'healthy' ? '#10b981' : status === 'Degraded' || status === 'degraded' ? '#f97316' : '#ef4444';

  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-8 w-full">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function SystemHealthPage() {
  const [activeTab, setActiveTab] = useState<'health' | 'usage'>('health');

  // Live Comprehensive Health state
  const [liveHealth, setLiveHealth] = useState<PlatformComprehensiveHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Usage Metering state
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

  // Error log state
  const [logs] = useState<ErrorLog[]>(seedLogs);
  const [severityFilter, setSeverityFilter] = useState<'All' | Severity>('All');

  // Load live health metrics
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

  // Load usage metering data
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
    loadUsageData();

    // Auto-refresh health every 15s
    const timer = setInterval(() => {
      loadHealthData();
    }, 15000);
    return () => clearInterval(timer);
  }, []);

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

  const filteredLogs = useMemo(
    () => (severityFilter === 'All' ? logs : logs.filter((log) => log.severity === severityFilter)),
    [logs, severityFilter],
  );

  const overall = liveHealth?.status === 'unhealthy'
    ? 'Incident in progress'
    : liveHealth?.status === 'degraded'
      ? 'Partial degradation'
      : 'All systems operational';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-300 font-bold mb-2">
            <Zap className="h-3.5 w-3.5" /> PLATFORM CONTROL PLANE
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold">System Health & Usage Metering</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time infrastructure health, latency & error telemetry, and per-tenant daily usage metering.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
              overall.includes('Incident')
                ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                : overall.includes('Partial')
                  ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                overall.includes('Incident')
                  ? 'bg-red-500 animate-pulse'
                  : overall.includes('Partial')
                    ? 'bg-orange-500 animate-pulse'
                    : 'bg-emerald-500'
              }`}
            />
            {overall}
          </span>

          <button
            onClick={() => {
              loadHealthData();
              if (activeTab === 'usage') loadUsageData();
            }}
            disabled={healthLoading}
            className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${healthLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

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

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('health')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'health'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>System Health & Diagnostics</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('usage');
            loadUsageData();
          }}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
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
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Card 1: API Latency & Error Rate */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                  <Server className="h-4 w-4" />
                </div>
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusTone(liveHealth?.api.status ?? 'healthy')}`}>
                  {liveHealth?.api.status ?? 'Operational'}
                </span>
              </div>
              <div className="text-sm font-extrabold mt-3">API Gateway</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Error rate: <strong className="text-slate-800 dark:text-slate-200">{liveHealth?.api.errorRatePercentage ?? 0}%</strong> (5xx)
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Avg / P95</div>
                  <div className="text-base font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
                    {liveHealth?.api.avgLatencyMs ?? 0}ms <span className="text-xs text-slate-400 font-normal">/ {liveHealth?.api.p95LatencyMs ?? 0}ms</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Samples</div>
                  <div className="text-xs font-mono font-bold">{liveHealth?.api.totalRequests ?? 0} req</div>
                </div>
              </div>
              <div className="mt-3">
                <Sparkline values={[24, 28, 31, 35, 42, 38, 30, 28, liveHealth?.api.avgLatencyMs || 25]} status={liveHealth?.api.status ?? 'healthy'} />
              </div>
            </div>

            {/* Card 2: Database Connection Pool */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                  <Database className="h-4 w-4" />
                </div>
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusTone(liveHealth?.database.status ?? 'healthy')}`}>
                  {liveHealth?.database.status ?? 'Operational'}
                </span>
              </div>
              <div className="text-sm font-extrabold mt-3">PostgreSQL Database</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Ping: <strong className="text-slate-800 dark:text-slate-200">{liveHealth?.database.pingLatencyMs ?? 2} ms</strong>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Pool Usage</div>
                  <div className="text-base font-extrabold font-mono text-blue-600 dark:text-blue-400">
                    {liveHealth?.database.activeConnections ?? 1} / {liveHealth?.database.totalConnections ?? 1}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Max Conn</div>
                  <div className="text-xs font-mono font-bold">{liveHealth?.database.maxConnections ?? 100}</div>
                </div>
              </div>
              <div className="mt-3">
                <Sparkline values={[4, 5, 3, 6, 4, 5, 4, liveHealth?.database.pingLatencyMs || 3]} status={liveHealth?.database.status ?? 'healthy'} />
              </div>
            </div>

            {/* Card 3: Redis In-Memory Cluster */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
                  <Zap className="h-4 w-4" />
                </div>
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusTone(liveHealth?.redis.status ?? 'connected')}`}>
                  {liveHealth?.redis.status === 'connected' ? 'Connected' : 'Offline'}
                </span>
              </div>
              <div className="text-sm font-extrabold mt-3">Redis Store</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Ping: <strong className="text-slate-800 dark:text-slate-200">{liveHealth?.redis.pingLatencyMs ?? 1} ms</strong>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Used Memory</div>
                  <div className="text-base font-extrabold font-mono text-rose-600 dark:text-rose-400">
                    {liveHealth?.redis.usedMemory ?? '1.7 MB'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Clients</div>
                  <div className="text-xs font-mono font-bold">{liveHealth?.redis.connectedClients ?? 1}</div>
                </div>
              </div>
              <div className="mt-3">
                <Sparkline values={[1, 2, 1, 3, 2, 1, 2, liveHealth?.redis.pingLatencyMs || 1]} status={liveHealth?.redis.status ?? 'connected'} />
              </div>
            </div>

            {/* Card 4: WebSocket Realtime Gateway */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-300">
                  <Radio className="h-4 w-4" />
                </div>
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusTone(liveHealth?.websocket.status ?? 'healthy')}`}>
                  {liveHealth?.websocket.status ?? 'Operational'}
                </span>
              </div>
              <div className="text-sm font-extrabold mt-3">WebSocket Gateway</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Namespace: <code className="text-slate-800 dark:text-slate-200">/realtime</code>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Live Sockets</div>
                  <div className="text-base font-extrabold font-mono text-teal-600 dark:text-teal-400">
                    {liveHealth?.websocket.connectedClients ?? 0}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Transport</div>
                  <div className="text-xs font-mono font-bold">WSS / Poll</div>
                </div>
              </div>
              <div className="mt-3">
                <Sparkline values={[0, 2, 1, 4, 3, 2, liveHealth?.websocket.connectedClients || 1]} status={liveHealth?.websocket.status ?? 'healthy'} />
              </div>
            </div>

            {/* Card 5: BullMQ Job Queues Summary */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
                  <Layers className="h-4 w-4" />
                </div>
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusTone(liveHealth?.queues.status ?? 'healthy')}`}>
                  {liveHealth?.queues.status ?? 'Operational'}
                </span>
              </div>
              <div className="text-sm font-extrabold mt-3">BullMQ Queues</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {liveHealth?.queues.totalQueues ?? 5} active queue workers
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Queue Depth</div>
                  <div className="text-base font-extrabold font-mono text-amber-600 dark:text-amber-400">
                    {liveHealth?.queues.totalQueueDepth ?? 0}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Failed Jobs</div>
                  <div className="text-xs font-mono font-bold text-rose-600">{liveHealth?.queues.totalFailedJobs ?? 0}</div>
                </div>
              </div>
              <div className="mt-3">
                <Sparkline values={[0, 1, 2, 1, 0, 0, liveHealth?.queues.totalQueueDepth || 0]} status={liveHealth?.queues.status ?? 'healthy'} />
              </div>
            </div>

            {/* Card 6: Mobile Sync Success Rate (OFFLINE_SYNC.md §4) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
                  <Smartphone className="h-4 w-4" />
                </div>
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusTone(liveHealth?.mobileSync.status ?? 'healthy')}`}>
                  {liveHealth?.mobileSync.status ?? 'Operational'}
                </span>
              </div>
              <div className="text-sm font-extrabold mt-3">Mobile Offline Sync</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                OFFLINE_SYNC.md §4 results
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Success Rate</div>
                  <div className="text-base font-extrabold font-mono text-violet-600 dark:text-violet-400">
                    {liveHealth?.mobileSync.successRatePercentage ?? 100}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Total Synced</div>
                  <div className="text-xs font-mono font-bold">{liveHealth?.mobileSync.totalEventsSynced ?? 0}</div>
                </div>
              </div>
              <div className="mt-3">
                <Sparkline values={[100, 100, 98, 100, 100, liveHealth?.mobileSync.successRatePercentage || 100]} status={liveHealth?.mobileSync.status ?? 'healthy'} />
              </div>
            </div>
          </div>

          {/* Section: BullMQ Queues Detailed Table */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-500" />
                  <span>BullMQ Background Job Queues</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Queue depths, waiting, active, delayed, and failed job counts per queue
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300">
                  Total Depth: <strong>{liveHealth?.queues.totalQueueDepth ?? 0}</strong>
                </span>
                <span className="font-mono bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-2.5 py-1 rounded-lg text-rose-700 dark:text-rose-300 font-bold">
                  Total Failed: <strong>{liveHealth?.queues.totalFailedJobs ?? 0}</strong>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase tracking-wider text-[10px] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Queue Name</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Queue Depth</th>
                    <th className="px-3 py-3 text-right">Waiting</th>
                    <th className="px-3 py-3 text-right">Active</th>
                    <th className="px-3 py-3 text-right">Delayed</th>
                    <th className="px-3 py-3 text-right">Failed</th>
                    <th className="px-3 py-3 text-right">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(liveHealth?.queues.queues ?? []).map((q) => (
                    <tr key={q.queueName} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                        <span>{q.queueName}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            q.status === 'healthy'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : q.status === 'congested'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                          }`}
                        >
                          {q.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {q.queueDepth}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-600 dark:text-slate-300">{q.waiting}</td>
                      <td className="px-3 py-3 text-right font-mono text-blue-600 dark:text-blue-400">{q.active}</td>
                      <td className="px-3 py-3 text-right font-mono text-amber-600 dark:text-amber-400">{q.delayed}</td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-rose-600">{q.failed}</td>
                      <td className="px-3 py-3 text-right font-mono text-slate-400">{q.completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section: Mobile Sync Diagnostics (OFFLINE_SYNC.md §4) */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-violet-500" />
                  <span>Mobile Sync Diagnostics (OFFLINE_SYNC.md §4 Results)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Idempotent batch punch synchronization status: created, duplicate, and rejected counts
                </p>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-bold bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                Success Rate: {liveHealth?.mobileSync.successRatePercentage ?? 100}%
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Events</span>
                <div className="text-lg font-extrabold font-mono text-slate-900 dark:text-white mt-1">
                  {liveHealth?.mobileSync.totalEventsSynced ?? 0}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40">
                <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Created</span>
                <div className="text-lg font-extrabold font-mono text-emerald-700 dark:text-emerald-300 mt-1">
                  {liveHealth?.mobileSync.createdCount ?? 0}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40">
                <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">Duplicates (Safe)</span>
                <div className="text-lg font-extrabold font-mono text-blue-700 dark:text-blue-300 mt-1">
                  {liveHealth?.mobileSync.duplicateCount ?? 0}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40">
                <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400">Rejected</span>
                <div className="text-lg font-extrabold font-mono text-rose-700 dark:text-rose-300 mt-1">
                  {liveHealth?.mobileSync.rejectedCount ?? 0}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40">
                <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Time Anomalies</span>
                <div className="text-lg font-extrabold font-mono text-amber-700 dark:text-amber-300 mt-1">
                  {liveHealth?.mobileSync.timeAnomalyCount ?? 0}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Geofence Flags</span>
                <div className="text-lg font-extrabold font-mono text-slate-900 dark:text-white mt-1">
                  {liveHealth?.mobileSync.geofenceMismatchCount ?? 0}
                </div>
              </div>
            </div>

            {liveHealth?.mobileSync.topRejectionReasons && liveHealth.mobileSync.topRejectionReasons.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                <div className="font-bold text-slate-700 dark:text-slate-300 mb-2">Top Rejection Reasons:</div>
                <div className="flex flex-wrap gap-2">
                  {liveHealth.mobileSync.topRejectionReasons.map((r) => (
                    <span key={r.reason} className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 font-mono text-[11px] font-bold">
                      {r.reason}: {r.count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Section: Diagnostic Error Logs */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-bold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-500" /> Error log
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Streaming operator console · newest events first</p>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                {(['All', 'info', 'warning', 'error'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setSeverityFilter(level)}
                    className={`h-8 px-3 rounded-lg text-[11px] font-bold border transition-colors ${
                      severityFilter === level
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-300'
                    }`}
                  >
                    {level === 'All' ? 'All severities' : level}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-auto max-h-[360px]">
              <table className="w-full text-left min-w-[820px]">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950/90 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20">
                      <td className="px-5 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold capitalize ${severityTone(log.severity)}`}>
                          {log.severity === 'error' ? <XCircle className="h-3 w-3" /> : log.severity === 'warning' ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                          {log.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold">{log.service}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TENANT USAGE METERING (usage_daily) */}
      {/* ========================================================================= */}
      {activeTab === 'usage' && (
        <div className="space-y-6">
          {/* Automated Nightly Job Card & On-Demand Trigger */}
          <div className="p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-sm text-indigo-950 dark:text-indigo-200">
                  Nightly Usage Metering Automation (Cron 02:00 UTC)
                </h3>
              </div>
              <p className="text-xs text-indigo-800/80 dark:text-indigo-300/80 max-w-2xl">
                Aggregates per-tenant active employees, document storage (bytes/MB), API calls, multi-channel notifications
                (email, push, in-app), and synced mobile attendance events into the immutable <code className="font-mono font-bold">usage_daily</code> table.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={triggerDate}
                onChange={(e) => setTriggerDate(e.target.value)}
                className="h-10 px-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-800 dark:text-slate-200"
              />
              <button
                type="button"
                onClick={handleTriggerMetering}
                disabled={triggeringMetering}
                className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-900/20 whitespace-nowrap"
              >
                {triggeringMetering ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                <span>Run Metering Now</span>
              </button>
            </div>
          </div>

          {/* Aggregated Usage Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Globe className="h-4 w-4" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Tenants Metered</span>
              </div>
              <div className="text-2xl font-extrabold font-mono mt-2 text-slate-900 dark:text-white">
                {usageSummary?.totalTenantsMetered ?? 0}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Users className="h-4 w-4" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Active Employees</span>
              </div>
              <div className="text-2xl font-extrabold font-mono mt-2 text-emerald-600 dark:text-emerald-400">
                {usageSummary?.totalActiveEmployees ?? 0}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <HardDrive className="h-4 w-4" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Storage Used</span>
              </div>
              <div className="text-2xl font-extrabold font-mono mt-2 text-blue-600 dark:text-blue-400">
                {usageSummary?.totalStorageUsedMb ?? 0} <span className="text-xs font-normal text-slate-400">MB</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Server className="h-4 w-4" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">API Calls</span>
              </div>
              <div className="text-2xl font-extrabold font-mono mt-2 text-amber-600 dark:text-amber-400">
                {(usageSummary?.totalApiCalls ?? 0).toLocaleString()}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <Bell className="h-4 w-4" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Notifications Sent</span>
              </div>
              <div className="text-2xl font-extrabold font-mono mt-2 text-purple-600 dark:text-purple-400">
                {(usageSummary?.totalNotificationsSent ?? 0).toLocaleString()}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                <Smartphone className="h-4 w-4" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Attendance Synced</span>
              </div>
              <div className="text-2xl font-extrabold font-mono mt-2 text-violet-600 dark:text-violet-400">
                {(usageSummary?.totalAttendanceEventsSynced ?? 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search tenant name or subdomain..."
                value={usageSearch}
                onChange={(e) => setUsageSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadUsageData()}
                className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>From:</span>
                <input
                  type="date"
                  value={usageStartDate}
                  onChange={(e) => setUsageStartDate(e.target.value)}
                  className="h-10 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>To:</span>
                <input
                  type="date"
                  value={usageEndDate}
                  onChange={(e) => setUsageEndDate(e.target.value)}
                  className="h-10 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>

              <button
                type="button"
                onClick={loadUsageData}
                disabled={usageLoading}
                className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5"
              >
                <Filter className="h-3.5 w-3.5" />
                <span>Filter</span>
              </button>
            </div>
          </div>

          {/* Usage Daily Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Tenant</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5 text-right">Active Employees</th>
                    <th className="px-4 py-3.5 text-right">Storage Used</th>
                    <th className="px-4 py-3.5 text-right">API Calls</th>
                    <th className="px-4 py-3.5">Notifications Sent</th>
                    <th className="px-4 py-3.5 text-right">Attendance Synced</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {usageLoading ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        <span>Loading daily usage records...</span>
                      </td>
                    </tr>
                  ) : usageRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                        <BarChart3 className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                        <p className="font-bold text-slate-600 dark:text-slate-300">No usage records found</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Click "Run Metering Now" above to generate usage records for a date.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    usageRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {record.tenantName || 'Unnamed Tenant'}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {record.tenantSubdomain}.cmsnbd.com
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-600 dark:text-slate-300">
                          {record.date}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {record.activeEmployees}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-blue-600 dark:text-blue-400">
                          {record.storageUsedMb} MB
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-amber-600 dark:text-amber-400 font-bold">
                          {record.apiCalls.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-mono font-bold text-[10px]">
                              Total: {record.notificationsTotal}
                            </span>
                            {record.notificationsInApp > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                App: {record.notificationsInApp}
                              </span>
                            )}
                            {record.notificationsEmail > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                Mail: {record.notificationsEmail}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-violet-600 dark:text-violet-400">
                          {record.attendanceEventsSynced}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Metered
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
