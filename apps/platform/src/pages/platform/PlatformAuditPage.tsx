import { useMemo, useState, type ComponentType } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileClock,
  Filter,
  Flag,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  UserRoundCog,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Toggle';

type ActionType = 'Impersonation' | 'Tenant Suspension' | 'Plan Change' | 'Feature Flag';

interface AuditEvent {
  id: string;
  action: ActionType;
  title: string;
  actor: string;
  tenant: string;
  timestamp: string;
  ip: string;
  risk: 'Critical' | 'Elevated' | 'Standard';
  before: Record<string, string | boolean>;
  after: Record<string, string | boolean>;
  reason: string;
}

const events: AuditEvent[] = [
  { id: 'evt_01J62NMF8', action: 'Tenant Suspension', title: 'Suspended Globex Industries', actor: 'Alex Morgan', tenant: 'Globex Industries', timestamp: 'Aug 25, 2026 · 17:12:08', ip: '192.168.1.42', risk: 'Critical', before: { status: 'Active', login_access: true, billing_state: 'Past due' }, after: { status: 'Suspended', login_access: false, billing_state: 'Past due' }, reason: 'Payment overdue after two failed retries; approved by Revenue Operations.' },
  { id: 'evt_01J62M9CH', action: 'Impersonation', title: 'Started tenant admin impersonation', actor: 'Maya Singh', tenant: 'Acme Corporation', timestamp: 'Aug 25, 2026 · 16:48:31', ip: '10.24.8.16', risk: 'Elevated', before: { session_mode: 'Platform operator', tenant_context: 'None' }, after: { session_mode: 'Impersonation', tenant_context: 'Acme Corporation' }, reason: 'Investigating SAML configuration issue under ticket SUP-4818.' },
  { id: 'evt_01J62KD5P', action: 'Plan Change', title: 'Changed subscription plan', actor: 'Nina Park', tenant: 'TechFlow Labs', timestamp: 'Aug 25, 2026 · 15:22:14', ip: '172.16.4.9', risk: 'Elevated', before: { plan: 'Starter', monthly_price: '$299', seat_limit: '250' }, after: { plan: 'Business', monthly_price: '$899', seat_limit: '1,000' }, reason: 'Customer-approved upgrade; effective immediately with prorated billing.' },
  { id: 'evt_01J62H2WQ', action: 'Feature Flag', title: 'Enabled payroll.next_generation', actor: 'Alex Morgan', tenant: 'Northstar Retail', timestamp: 'Aug 25, 2026 · 13:09:55', ip: '192.168.1.42', risk: 'Standard', before: { enabled: false, rollout: '0%', cohort: 'None' }, after: { enabled: true, rollout: '100%', cohort: 'Northstar Retail' }, reason: 'Approved enterprise pilot cohort.' },
  { id: 'evt_01J61ZV3B', action: 'Feature Flag', title: 'Reduced analytics.ai_summary rollout', actor: 'Maya Singh', tenant: 'All tenants', timestamp: 'Aug 24, 2026 · 22:41:02', ip: '10.24.8.16', risk: 'Critical', before: { enabled: true, rollout: '50%', cohort: 'Business + Enterprise' }, after: { enabled: true, rollout: '10%', cohort: 'Enterprise only' }, reason: 'Emergency mitigation following elevated inference latency.' },
];

const actionIcons: Record<ActionType, ComponentType<{ className?: string }>> = {
  Impersonation: UserRoundCog,
  'Tenant Suspension': ShieldAlert,
  'Plan Change': FileClock,
  'Feature Flag': SlidersHorizontal,
};

const actionTone: Record<ActionType, string> = {
  Impersonation: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
  'Tenant Suspension': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
  'Plan Change': 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  'Feature Flag': 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
};

function valueText(value: string | boolean) {
  return typeof value === 'boolean' ? String(value) : value;
}

export function PlatformAuditPage() {
  const [query, setQuery] = useState('');
  const [action, setAction] = useState<'All' | ActionType>('All');
  const [risk, setRisk] = useState('All');
  const [expanded, setExpanded] = useState<string[]>([events[0].id]);

  const filtered = useMemo(
    () => events.filter((event) =>
      (action === 'All' || event.action === action)
      && (risk === 'All' || event.risk === risk)
      && `${event.id} ${event.title} ${event.actor} ${event.tenant} ${event.reason}`.toLowerCase().includes(query.toLowerCase()),
    ),
    [action, query, risk],
  );

  const toggleExpanded = (id: string) => {
    setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  return (
    <div className="space-y-5 animate-fade-in text-slate-900 dark:text-slate-100">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-300 mb-2"><FileClock className="h-4 w-4" /> IMMUTABLE OPERATOR HISTORY</div>
          <h1 className="text-2xl font-extrabold">Platform Audit Log</h1>
          <p className="text-sm text-slate-500 mt-1">Privileged cross-tenant actions with before-and-after evidence.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-500" /><strong>Audit integrity verified</strong> · 365-day retention</div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['18,428', 'Events today'],
          ['12', 'Impersonation sessions'],
          ['3', 'Critical actions'],
          ['0', 'Integrity failures'],
        ].map(([value, label], index) => (
          <div key={label} className={`rounded-2xl border p-4 ${index === 2 ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
            <div className={`text-2xl font-extrabold ${index === 2 ? 'text-red-600 dark:text-red-400' : ''}`}>{value}</div><div className="text-xs text-slate-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="grid md:grid-cols-[minmax(0,1fr)_220px_180px] gap-3">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actor, tenant, action, event ID or reason…" className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:border-indigo-400" /></div>
          <select value={action} onChange={(event) => setAction(event.target.value as 'All' | ActionType)} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-indigo-400">
            <option value="All">All action types</option>{(['Impersonation', 'Tenant Suspension', 'Plan Change', 'Feature Flag'] as ActionType[]).map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={risk} onChange={(event) => setRisk(event.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-indigo-400"><option>All</option><option>Critical</option><option>Elevated</option><option>Standard</option></select>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500"><Filter className="h-3.5 w-3.5" /> Showing {filtered.length} of {events.length} recent privileged events</div>
      </div>

      <div className="space-y-3">
        {filtered.map((event) => {
          const Icon = actionIcons[event.action];
          const isExpanded = expanded.includes(event.id);
          const keys = Array.from(new Set([...Object.keys(event.before), ...Object.keys(event.after)]));
          return (
            <article key={event.id} className={`bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden ${event.risk === 'Critical' ? 'border-red-200 dark:border-red-900' : 'border-slate-200 dark:border-slate-800'}`}>
              <button onClick={() => toggleExpanded(event.id)} className="w-full p-4 sm:p-5 flex items-start gap-3 text-left hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                <span className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${actionTone[event.action]}`}><Icon className="h-4.5 w-4.5" /></span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold">{event.title}</span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"><ShieldAlert className="h-3 w-3" /> Platform-Level Action</span>
                    {event.risk === 'Critical' && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400"><Flag className="h-3 w-3" /> Critical</span>}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                    <span className="flex items-center gap-2"><Avatar name={event.actor} size="sm" /><strong className="text-slate-700 dark:text-slate-300">{event.actor}</strong></span>
                    <span>{event.tenant}</span><span>{event.timestamp}</span><span className="font-mono">{event.id}</span>
                  </span>
                </span>
                {isExpanded ? <ChevronDown className="h-5 w-5 text-slate-400 shrink-0" /> : <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />}
              </button>

              {isExpanded && (
                <div className="border-t border-slate-200 dark:border-slate-800">
                  <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
                    <div className="p-4 sm:p-5">
                      <div className="flex items-center justify-between mb-3"><h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Configuration diff</h3><span className="font-mono text-[10px] text-slate-400">before → after</span></div>
                      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 font-mono text-xs">
                        <div className="grid grid-cols-[36px_minmax(0,1fr)] bg-slate-900 border-b border-slate-800 text-slate-400"><span className="px-2 py-2 text-right">#</span><span className="px-3 py-2">platform_action.json</span></div>
                        {keys.map((key, index) => {
                          const before = valueText(event.before[key]);
                          const after = valueText(event.after[key]);
                          const changed = before !== after;
                          return changed ? (
                            <div key={key}>
                              <div className="grid grid-cols-[36px_minmax(0,1fr)] bg-red-950/50 text-red-200 border-l-2 border-red-500"><span className="px-2 py-2 text-right text-red-500 select-none">-</span><span className="px-3 py-2 break-all"><span className="text-red-400">&quot;{key}&quot;</span>: &quot;{before}&quot;</span></div>
                              <div className="grid grid-cols-[36px_minmax(0,1fr)] bg-emerald-950/50 text-emerald-200 border-l-2 border-emerald-500"><span className="px-2 py-2 text-right text-emerald-500 select-none">+</span><span className="px-3 py-2 break-all"><span className="text-emerald-400">&quot;{key}&quot;</span>: &quot;{after}&quot;</span></div>
                            </div>
                          ) : (
                            <div key={key} className="grid grid-cols-[36px_minmax(0,1fr)] text-slate-400"><span className="px-2 py-2 text-right select-none">{index + 1}</span><span className="px-3 py-2 break-all">&quot;{key}&quot;: &quot;{before}&quot;</span></div>
                          );
                        })}
                      </div>
                    </div>
                    <aside className="p-4 sm:p-5 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Action context</h3>
                      <dl className="mt-4 space-y-4 text-xs">
                        <div><dt className="text-slate-500">Operator reason</dt><dd className="mt-1 font-semibold leading-relaxed">{event.reason}</dd></div>
                        <div><dt className="text-slate-500">Source IP</dt><dd className="mt-1 font-mono font-semibold">{event.ip}</dd></div>
                        <div><dt className="text-slate-500">Authentication</dt><dd className="mt-1 font-semibold text-emerald-600 dark:text-emerald-400">MFA verified · privileged role</dd></div>
                        <div><dt className="text-slate-500">Integrity hash</dt><dd className="mt-1 font-mono text-[10px] break-all text-slate-500">sha256:92af{event.id.toLowerCase()}c81e</dd></div>
                      </dl>
                    </aside>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {filtered.length === 0 && <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-16 text-center"><Search className="h-9 w-9 text-slate-300 mx-auto" /><h2 className="font-bold mt-3">No audit events found</h2><p className="text-sm text-slate-500 mt-1">Try clearing or broadening the active filters.</p></div>}
    </div>
  );
}
