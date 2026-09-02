import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Cloud,
  Database,
  Filter,
  Layers,
  Mail,
  Radio,
  RefreshCw,
  RotateCcw,
  Server,
  XCircle,
  Zap,
} from 'lucide-react';

type ServiceStatus = 'Operational' | 'Degraded' | 'Down';
type Severity = 'info' | 'warning' | 'error';

interface HealthService {
  id: string;
  name: string;
  detail: string;
  status: ServiceStatus;
  uptime: number;
  latency: number;
  sparkline: number[];
  icon: ComponentType<{ className?: string }>;
}

interface QueueState {
  pending: number;
  processing: number;
  failed: number;
}

interface ErrorLog {
  id: string;
  timestamp: string;
  severity: Severity;
  service: string;
  message: string;
}

const initialServices: HealthService[] = [
  {
    id: 'api',
    name: 'API',
    detail: 'REST + GraphQL gateway · us-east-1',
    status: 'Operational',
    uptime: 99.98,
    latency: 42,
    sparkline: [38, 41, 39, 44, 46, 43, 40, 42, 41, 45, 42, 40],
    icon: Server,
  },
  {
    id: 'database',
    name: 'Database',
    detail: 'Primary Postgres cluster · replica lag 12ms',
    status: 'Operational',
    uptime: 99.99,
    latency: 8,
    sparkline: [7, 8, 9, 8, 7, 10, 8, 8, 9, 7, 8, 8],
    icon: Database,
  },
  {
    id: 'queue',
    name: 'Queue / Jobs (BullMQ)',
    detail: 'Redis-backed workers · 12 consumers',
    status: 'Degraded',
    uptime: 99.41,
    latency: 186,
    sparkline: [92, 110, 148, 162, 174, 168, 190, 204, 188, 176, 192, 186],
    icon: Layers,
  },
  {
    id: 'realtime',
    name: 'WebSocket / Real-time',
    detail: 'Presence, live payroll & attendance events',
    status: 'Operational',
    uptime: 99.94,
    latency: 28,
    sparkline: [24, 26, 31, 29, 27, 25, 28, 30, 29, 27, 28, 28],
    icon: Radio,
  },
  {
    id: 'storage',
    name: 'Storage (S3)',
    detail: 'Documents, payslips and export artifacts',
    status: 'Operational',
    uptime: 99.97,
    latency: 64,
    sparkline: [58, 61, 70, 66, 62, 60, 63, 68, 65, 61, 64, 64],
    icon: Cloud,
  },
  {
    id: 'email',
    name: 'Email / SMTP',
    detail: 'Transactional mail relay · SES region mix',
    status: 'Degraded',
    uptime: 98.72,
    latency: 940,
    sparkline: [420, 510, 680, 720, 810, 890, 960, 1020, 980, 910, 950, 940],
    icon: Mail,
  },
  {
    id: 'push',
    name: 'Push Notifications',
    detail: 'APNs / FCM fan-out for mobile ESS',
    status: 'Down',
    uptime: 91.08,
    latency: 0,
    sparkline: [120, 118, 140, 210, 380, 620, 0, 0, 0, 0, 0, 0],
    icon: Bell,
  },
];

const seedLogs: ErrorLog[] = [
  { id: 'log-1', timestamp: '2026-08-25 17:32:14', severity: 'error', service: 'Push Notifications', message: 'FCM batch rejected: invalid server key on android-ess-prod' },
  { id: 'log-2', timestamp: '2026-08-25 17:31:48', severity: 'error', service: 'Push Notifications', message: 'APNs connection timeout after 8s · token refresh required' },
  { id: 'log-3', timestamp: '2026-08-25 17:29:02', severity: 'warning', service: 'Queue / Jobs', message: 'payroll.generate-payslip retry 3/5 · worker-07 memory pressure' },
  { id: 'log-4', timestamp: '2026-08-25 17:24:41', severity: 'warning', service: 'Email / SMTP', message: 'SES bounce rate 4.8% in last 15m · throttling outbound invites' },
  { id: 'log-5', timestamp: '2026-08-25 17:18:09', severity: 'info', service: 'API', message: 'Deployed gateway build 2026.08.25.14 · rolling 12/12 healthy' },
  { id: 'log-6', timestamp: '2026-08-25 17:11:55', severity: 'warning', service: 'Queue / Jobs', message: 'attendance.sync-device backlog exceeded 2,000 pending jobs' },
  { id: 'log-7', timestamp: '2026-08-25 16:58:22', severity: 'info', service: 'Database', message: 'Autovacuum completed on payroll_runs (1.2M rows, 4m 11s)' },
  { id: 'log-8', timestamp: '2026-08-25 16:44:03', severity: 'error', service: 'Email / SMTP', message: 'SMTP AUTH failed for failover relay smtp-backup-2.nexushr.net' },
  { id: 'log-9', timestamp: '2026-08-25 16:31:17', severity: 'info', service: 'WebSocket / Real-time', message: 'Presence reconnect storm absorbed · peak 18.4k sockets' },
  { id: 'log-10', timestamp: '2026-08-25 16:12:40', severity: 'warning', service: 'Storage (S3)', message: 'Multipart upload abort rate elevated in ap-southeast-1' },
];

const liveMessages: { severity: Severity; service: string; message: string }[] = [
  { severity: 'warning', service: 'Queue / Jobs', message: 'BullMQ delayed set grew by 126 jobs in the last 30s' },
  { severity: 'info', service: 'API', message: 'p95 latency recovered to 44ms after cache warm' },
  { severity: 'error', service: 'Push Notifications', message: 'FCM 401 persisted · circuit breaker still open' },
  { severity: 'warning', service: 'Email / SMTP', message: 'Invite emails queued locally while SES recovers' },
  { severity: 'info', service: 'Database', message: 'Read replica eu-central-1 caught up · lag 9ms' },
];

function statusTone(status: ServiceStatus) {
  if (status === 'Operational') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
  }
  if (status === 'Degraded') {
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

function Sparkline({ values, status }: { values: number[]; status: ServiceStatus }) {
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
  const stroke = status === 'Operational' ? '#10b981' : status === 'Degraded' ? '#f97316' : '#ef4444';

  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-8 w-full">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function formatNow() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export function SystemHealthPage() {
  const [services] = useState(initialServices);
  const [queue, setQueue] = useState<QueueState>({ pending: 2146, processing: 38, failed: 27 });
  const [retrying, setRetrying] = useState(false);
  const [retryNote, setRetryNote] = useState<string | null>(null);
  const [logs, setLogs] = useState<ErrorLog[]>(seedLogs);
  const [severityFilter, setSeverityFilter] = useState<'All' | Severity>('All');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
      const sample = liveMessages[Math.floor(Math.random() * liveMessages.length)];
      setLogs((previous) => [
        {
          id: `live-${Date.now()}`,
          timestamp: formatNow(),
          severity: sample.severity,
          service: sample.service,
          message: sample.message,
        },
        ...previous,
      ].slice(0, 40));
    }, 4500);
    return () => window.clearInterval(timer);
  }, []);

  const filteredLogs = useMemo(
    () => (severityFilter === 'All' ? logs : logs.filter((log) => log.severity === severityFilter)),
    [logs, severityFilter],
  );

  const overall = services.some((service) => service.status === 'Down')
    ? 'Incident in progress'
    : services.some((service) => service.status === 'Degraded')
      ? 'Partial degradation'
      : 'All systems operational';

  const retryFailed = () => {
    if (queue.failed === 0 || retrying) return;
    const failed = queue.failed;
    setRetrying(true);
    setRetryNote(`Re-queuing ${failed} failed BullMQ jobs…`);
    window.setTimeout(() => {
      setQueue((current) => ({
        pending: current.pending + failed,
        processing: current.processing + Math.min(8, failed),
        failed: 0,
      }));
      setRetrying(false);
      setRetryNote(`${failed} failed jobs moved back to the pending queue.`);
      setLogs((previous) => [
        {
          id: `retry-${Date.now()}`,
          timestamp: formatNow(),
          severity: 'info',
          service: 'Queue / Jobs',
          message: `Operator retried ${failed} failed jobs from the platform health console`,
        },
        ...previous,
      ]);
    }, 700);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-300 font-bold mb-2">
            <Zap className="h-3.5 w-3.5" /> PLATFORM CONTROL PLANE
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold">System Health</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Infrastructure, service uptime and regional data-plane status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
            overall.includes('Incident')
              ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
              : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800'
          }`}>
            <span className={`h-2 w-2 rounded-full ${overall.includes('Incident') ? 'bg-red-500 animate-pulse' : 'bg-orange-500 animate-pulse'}`} />
            {overall}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">live · {tick} ticks</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7 gap-4">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <div key={service.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                  service.status === 'Operational'
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300'
                    : service.status === 'Degraded'
                      ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300'
                      : 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300'
                }`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusTone(service.status)}`}>
                  {service.status}
                </span>
              </div>
              <div className="text-sm font-extrabold mt-3">{service.name}</div>
              <div className="text-[11px] text-slate-500 mt-0.5 leading-snug min-h-[32px]">{service.detail}</div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Uptime</div>
                  <div className="text-lg font-extrabold font-mono">{service.uptime.toFixed(2)}%</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Response</div>
                  <div className="text-sm font-mono font-bold">{service.status === 'Down' ? '—' : `${service.latency} ms`}</div>
                </div>
              </div>
              <div className="mt-3">
                <Sparkline values={service.sparkline} status={service.status} />
              </div>
            </div>
          );
        })}
      </div>

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="font-bold flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-500" /> Background job queue
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">BullMQ workers processing payroll, mail, device sync and exports.</p>
          </div>
          <button
            onClick={retryFailed}
            disabled={queue.failed === 0 || retrying}
            className="h-10 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:pointer-events-none text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-900/15"
          >
            {retrying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Retry Failed Jobs
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Pending', value: queue.pending, tone: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' },
            { label: 'Processing', value: queue.processing, tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
            { label: 'Failed', value: queue.failed, tone: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">{item.label}</div>
              <div className={`mt-2 inline-flex items-center rounded-lg px-2.5 py-1 text-2xl font-extrabold font-mono ${item.tone}`}>
                {item.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
        {retryNote && (
          <div className="mt-4 flex gap-3 p-4 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="text-sm">{retryNote}</p>
          </div>
        )}
      </section>

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
        <div className="overflow-auto max-h-[420px]">
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
  );
}
