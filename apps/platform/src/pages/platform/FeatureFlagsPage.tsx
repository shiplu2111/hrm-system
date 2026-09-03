import { useMemo, useState, type FormEvent } from 'react';
import {
  Building2,
  Flag,
  FlaskConical,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Avatar, Toggle } from '@/components/ui/Toggle';

type RolloutScope = 'All Tenants' | 'Specific Tenants' | 'Percentage Rollout';
type OverrideValue = 'Inherit' | 'Enabled' | 'Disabled';

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  scope: RolloutScope;
  percentage: number;
  module: string;
  tenants: string[];
}

interface Tenant {
  id: string;
  name: string;
  plan: string;
  region: string;
}

const initialFlags: FeatureFlag[] = [
  { id: 'ai-insights', name: 'AI Workforce Insights', description: 'Generates workforce summaries and anomaly recommendations.', enabled: true, scope: 'Percentage Rollout', percentage: 35, module: 'Analytics', tenants: [] },
  { id: 'payroll-v2', name: 'Payroll Engine v2', description: 'Uses the new calculation and validation pipeline.', enabled: true, scope: 'Specific Tenants', percentage: 100, module: 'Payroll', tenants: ['Acme Corporation', 'TechFlow Labs'] },
  { id: 'candidate-score', name: 'Candidate Smart Score', description: 'Adds skill-match scoring to recruitment profiles.', enabled: false, scope: 'All Tenants', percentage: 100, module: 'Recruitment', tenants: [] },
  { id: 'mobile-clock', name: 'Offline Mobile Clock-in', description: 'Queues verified attendance events while offline.', enabled: true, scope: 'Percentage Rollout', percentage: 72, module: 'Attendance', tenants: [] },
  { id: 'custom-reports', name: 'Custom Report Builder', description: 'Enables drag-and-drop report composition.', enabled: true, scope: 'All Tenants', percentage: 100, module: 'Reports', tenants: [] },
];

const tenants: Tenant[] = [
  { id: 'acme', name: 'Acme Corporation', plan: 'Enterprise', region: 'North America' },
  { id: 'techflow', name: 'TechFlow Labs', plan: 'Business', region: 'Asia Pacific' },
  { id: 'globex', name: 'Globex Industries', plan: 'Enterprise', region: 'Europe' },
  { id: 'northstar', name: 'Northstar Retail', plan: 'Business', region: 'Europe' },
  { id: 'vertex', name: 'Vertex Health', plan: 'Starter', region: 'Asia Pacific' },
];

const modules = ['Analytics', 'Attendance', 'Core HR', 'Payroll', 'Recruitment', 'Reports', 'Platform'];
const scopeOptions: RolloutScope[] = ['All Tenants', 'Specific Tenants', 'Percentage Rollout'];

function moduleTone(module: string) {
  const tones: Record<string, string> = {
    Analytics: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300',
    Payroll: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    Recruitment: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300',
    Attendance: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
  };
  return tones[module] ?? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300';
}

export function FeatureFlagsPage() {
  const [flags, setFlags] = useState(initialFlags);
  const [addOpen, setAddOpen] = useState(false);
  const [flagSearch, setFlagSearch] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>(['acme', 'techflow']);
  const [overrides, setOverrides] = useState<Record<string, Record<string, OverrideValue>>>({
    acme: { 'ai-insights': 'Enabled', 'candidate-score': 'Disabled' },
    techflow: { 'payroll-v2': 'Enabled' },
  });
  const [draft, setDraft] = useState({ name: '', description: '', module: 'Core HR', scope: 'All Tenants' as RolloutScope });

  const visibleFlags = useMemo(() => flags.filter((flag) =>
    `${flag.name} ${flag.description} ${flag.module}`.toLowerCase().includes(flagSearch.toLowerCase()),
  ), [flagSearch, flags]);

  const visibleTenants = useMemo(() => tenants.filter((tenant) =>
    `${tenant.name} ${tenant.plan} ${tenant.region}`.toLowerCase().includes(tenantSearch.toLowerCase()),
  ), [tenantSearch]);

  const updateFlag = (id: string, update: Partial<FeatureFlag>) => {
    setFlags((current) => current.map((flag) => flag.id === id ? { ...flag, ...update } : flag));
  };

  const toggleSpecificTenant = (flagId: string, tenantName: string) => {
    setFlags((current) => current.map((flag) => {
      if (flag.id !== flagId) return flag;
      const included = flag.tenants.includes(tenantName);
      return { ...flag, tenants: included ? flag.tenants.filter((name) => name !== tenantName) : [...flag.tenants, tenantName] };
    }));
  };

  const addFlag = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const id = `${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`;
    setFlags((current) => [...current, {
      id,
      name: draft.name.trim(),
      description: draft.description.trim() || 'No description provided.',
      enabled: false,
      scope: draft.scope,
      percentage: draft.scope === 'Percentage Rollout' ? 10 : 100,
      module: draft.module,
      tenants: [],
    }]);
    setDraft({ name: '', description: '', module: 'Core HR', scope: 'All Tenants' });
    setAddOpen(false);
  };

  const cycleOverride = (tenantId: string, flagId: string) => {
    const current = overrides[tenantId]?.[flagId] ?? 'Inherit';
    const next: OverrideValue = current === 'Inherit' ? 'Enabled' : current === 'Enabled' ? 'Disabled' : 'Inherit';
    setOverrides((values) => ({ ...values, [tenantId]: { ...values[tenantId], [flagId]: next } }));
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-300"><ShieldCheck className="h-4 w-4" /> RELEASE CONTROL</div>
          <h1 className="text-2xl font-extrabold lg:text-3xl">Feature Flags</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Safely release capabilities globally, by tenant, or as a gradual rollout.</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-900/15 hover:bg-indigo-500"><Plus className="h-4 w-4" /> Add Feature Flag</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Total flags', value: flags.length, detail: `${flags.filter((flag) => flag.enabled).length} globally enabled`, icon: Flag, tone: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300' },
          { label: 'Gradual rollouts', value: flags.filter((flag) => flag.scope === 'Percentage Rollout').length, detail: 'Monitored cohorts', icon: SlidersHorizontal, tone: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-300' },
          { label: 'Tenant overrides', value: Object.values(overrides).reduce((sum, tenantOverrides) => sum + Object.keys(tenantOverrides).length, 0), detail: 'Explicit exceptions', icon: Building2, tone: 'text-orange-600 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-300' },
        ].map(({ label, value, detail, icon: Icon, tone }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></div>
            <div className="mt-3 text-2xl font-extrabold">{value}</div><div className="text-xs font-bold">{label}</div><div className="mt-1 text-[10px] text-slate-500">{detail}</div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="font-extrabold">Flag registry</h2><p className="mt-1 text-xs text-slate-500">Global state and rollout controls apply immediately in this local demo.</p></div>
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={flagSearch} onChange={(event) => setFlagSearch(event.target.value)} placeholder="Search flags or modules…" className="h-10 w-full rounded-xl border border-slate-200 bg-transparent pl-9 pr-3 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 sm:w-72" /></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-950/50"><tr><th className="px-5 py-3">Feature flag</th><th className="px-4 py-3">Module</th><th className="px-4 py-3 text-center">Global</th><th className="px-4 py-3">Rollout scope</th><th className="px-4 py-3">Configuration</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleFlags.map((flag) => (
                <tr key={flag.id} className="align-top hover:bg-slate-50/60 dark:hover:bg-slate-800/20">
                  <td className="px-5 py-4"><div className="text-sm font-extrabold">{flag.name}</div><div className="mt-1 max-w-sm text-[11px] leading-4 text-slate-500">{flag.description}</div><div className="mt-1 font-mono text-[9px] text-slate-400">{flag.id}</div></td>
                  <td className="px-4 py-4"><span className={`rounded-md border px-2 py-1 text-[10px] font-bold ${moduleTone(flag.module)}`}>{flag.module}</span></td>
                  <td className="px-4 py-4 text-center"><Toggle checked={flag.enabled} onChange={(enabled) => updateFlag(flag.id, { enabled })} /></td>
                  <td className="px-4 py-4"><select aria-label={`Rollout scope for ${flag.name}`} value={flag.scope} onChange={(event) => updateFlag(flag.id, { scope: event.target.value as RolloutScope })} className="h-9 w-48 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950">{scopeOptions.map((scope) => <option key={scope}>{scope}</option>)}</select></td>
                  <td className="px-4 py-4">
                    {flag.scope === 'Percentage Rollout' && (
                      <div className="w-56">
                        <div className="mb-2 flex justify-between text-[10px] font-bold text-slate-500"><span>Tenant cohort</span><span className="text-indigo-600 dark:text-indigo-300">{flag.percentage}%</span></div>
                        <input aria-label={`${flag.name} rollout percentage`} type="range" min="0" max="100" value={flag.percentage} onChange={(event) => updateFlag(flag.id, { percentage: Number(event.target.value) })} className="h-1.5 w-full cursor-pointer accent-indigo-600" />
                      </div>
                    )}
                    {flag.scope === 'All Tenants' && <div className="flex items-center gap-2 text-xs text-slate-500"><Users className="h-4 w-4 text-indigo-500" /> Available to all 128 tenants</div>}
                    {flag.scope === 'Specific Tenants' && (
                      <div className="flex max-w-xs flex-wrap gap-1.5">
                        {tenants.slice(0, 4).map((tenant) => {
                          const active = flag.tenants.includes(tenant.name);
                          return <button key={tenant.id} onClick={() => toggleSpecificTenant(flag.id, tenant.name)} className={`rounded-md border px-2 py-1 text-[9px] font-bold ${active ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' : 'border-slate-200 text-slate-400 dark:border-slate-700'}`}>{tenant.name.split(' ')[0]}</button>;
                        })}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {visibleFlags.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">No feature flags match your search.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><h2 className="font-extrabold">Per-tenant overrides</h2><p className="mt-1 text-xs text-slate-500">Cycle a control between Inherit, Enabled and Disabled. Overrides take precedence over rollout rules.</p></div>
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={tenantSearch} onChange={(event) => setTenantSearch(event.target.value)} placeholder="Search tenants…" className="h-10 w-full rounded-xl border border-slate-200 bg-transparent pl-9 pr-3 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 sm:w-72" /></div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[300px_1fr]">
          <div className="space-y-2">
            {visibleTenants.map((tenant) => {
              const selected = selectedTenantIds.includes(tenant.id);
              return (
                <button key={tenant.id} onClick={() => setSelectedTenantIds((current) => selected ? current.filter((id) => id !== tenant.id) : [...current, tenant.id])} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30' : 'border-slate-200 hover:border-indigo-200 dark:border-slate-700'}`}>
                  <Avatar name={tenant.name} size="sm" />
                  <div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">{tenant.name}</div><div className="mt-0.5 text-[9px] text-slate-500">{tenant.plan} · {tenant.region}</div></div>
                  <span className={`h-2.5 w-2.5 rounded-full ${selected ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                </button>
              );
            })}
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[650px] text-left">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-950/50"><tr><th className="px-4 py-3">Flag</th>{selectedTenantIds.map((tenantId) => <th key={tenantId} className="px-3 py-3 text-center">{tenants.find((tenant) => tenant.id === tenantId)?.name.split(' ')[0]}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {flags.map((flag) => <tr key={flag.id}><td className="px-4 py-3"><div className="text-xs font-bold">{flag.name}</div><div className="mt-0.5 text-[9px] text-slate-500">{flag.enabled ? 'Global on' : 'Global off'} · {flag.scope}</div></td>{selectedTenantIds.map((tenantId) => {
                  const value = overrides[tenantId]?.[flag.id] ?? 'Inherit';
                  const tone = value === 'Enabled' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : value === 'Disabled' ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300' : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800';
                  return <td key={tenantId} className="px-3 py-3 text-center"><button onClick={() => cycleOverride(tenantId, flag.id)} className={`min-w-20 rounded-lg border px-2 py-1.5 text-[9px] font-bold ${tone}`}>{value}</button></td>;
                })}</tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Feature Flag"
        description="Create a new controlled release switch. It starts globally disabled."
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setAddOpen(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-semibold dark:border-slate-700">Cancel</button>
            <button type="submit" form="add-feature-flag-form" disabled={!draft.name.trim()} className="h-9 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-40">Create Flag</button>
          </>
        }
      >
        <form id="add-feature-flag-form" onSubmit={addFlag} className="space-y-4">
          <div className="flex gap-3 rounded-xl bg-indigo-50 p-4 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200"><FlaskConical className="h-5 w-5 shrink-0" /><p className="text-xs leading-5">Use a clear operator-facing name. A stable key is generated automatically and all future changes should be audit logged in production.</p></div>
          <div><label className="text-xs font-bold">Flag name</label><input autoFocus value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Example: Smart leave recommendations" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-transparent px-4 text-sm outline-none focus:border-indigo-400 dark:border-slate-700" /></div>
          <div><label className="text-xs font-bold">Description</label><textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="What capability does this flag control?" rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-transparent p-4 text-sm outline-none focus:border-indigo-400 dark:border-slate-700" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="text-xs font-bold">Module</label><select value={draft.module} onChange={(event) => setDraft((current) => ({ ...current, module: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-950">{modules.map((module) => <option key={module}>{module}</option>)}</select></div>
            <div><label className="text-xs font-bold">Initial rollout scope</label><select value={draft.scope} onChange={(event) => setDraft((current) => ({ ...current, scope: event.target.value as RolloutScope }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-950">{scopeOptions.map((scope) => <option key={scope}>{scope}</option>)}</select></div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
