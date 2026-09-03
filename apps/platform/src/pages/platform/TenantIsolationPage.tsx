import { useMemo, useState, type ReactNode } from 'react';
import {
  Check,
  CheckCircle2,
  Clock3,
  Cloud,
  Copy,
  Database,
  HardDrive,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  Search,
  Server,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { Toggle } from '@/components/ui/Toggle';
import { Modal } from '@/components/ui/Modal';

type View = 'Provisioning Defaults' | 'Isolation Status';
type BackupStatus = 'Healthy' | 'Delayed' | 'Running';

interface TenantIsolation {
  id: string;
  name: string;
  initials: string;
  schema: string;
  bucket: string;
  region: string;
  kmsKey: string;
  securityGroup: string;
  backupStatus: BackupStatus;
  backupTime: string;
  restorePoint: string;
}

const tenants: TenantIsolation[] = [
  { id: 'tn_acme_8f21', name: 'Acme Corporation', initials: 'AC', schema: 'tenant_acme_prod', bucket: 'nexus-tenant-acme-us-east-1', region: 'US East · N. Virginia', kmsKey: 'kms/tenant/acme/7ad2', securityGroup: 'sg-acme-01f8c2', backupStatus: 'Healthy', backupTime: 'Today, 04:12 UTC', restorePoint: 'Aug 25, 2026 · 04:12 UTC' },
  { id: 'tn_techflow_49aa', name: 'TechFlow Labs', initials: 'TL', schema: 'tenant_techflow_prod', bucket: 'nexus-tenant-techflow-ap-se-1', region: 'AP Southeast · Singapore', kmsKey: 'kms/tenant/techflow/38cc', securityGroup: 'sg-tech-490ab1', backupStatus: 'Healthy', backupTime: 'Today, 03:48 UTC', restorePoint: 'Aug 25, 2026 · 03:48 UTC' },
  { id: 'tn_globex_019d', name: 'Globex Industries', initials: 'GI', schema: 'tenant_globex_prod', bucket: 'nexus-tenant-globex-eu-central-1', region: 'EU Central · Frankfurt', kmsKey: 'kms/tenant/globex/b711', securityGroup: 'sg-glob-992be0', backupStatus: 'Delayed', backupTime: 'Yesterday, 22:06 UTC', restorePoint: 'Aug 24, 2026 · 22:06 UTC' },
  { id: 'tn_northstar_72c1', name: 'Northstar Retail', initials: 'NR', schema: 'tenant_northstar_prod', bucket: 'nexus-tenant-northstar-eu-west-2', region: 'EU West · London', kmsKey: 'kms/tenant/northstar/e310', securityGroup: 'sg-north-82c941', backupStatus: 'Running', backupTime: 'In progress · 82%', restorePoint: 'Aug 24, 2026 · 04:02 UTC' },
  { id: 'tn_vertex_18d4', name: 'Vertex Health', initials: 'VH', schema: 'tenant_vertex_trial', bucket: 'nexus-tenant-vertex-ap-se-2', region: 'AP Southeast · Sydney', kmsKey: 'kms/tenant/vertex/c501', securityGroup: 'sg-vertex-166fa8', backupStatus: 'Healthy', backupTime: 'Today, 04:30 UTC', restorePoint: 'Aug 25, 2026 · 04:30 UTC' },
];

const moduleDefaults = [
  { key: 'core', name: 'Core HR & Employee Records', description: 'Employee profiles, contracts and organization structure', enabled: true, required: true },
  { key: 'attendance', name: 'Attendance & Leave', description: 'Time tracking, shifts, leave requests and balances', enabled: true, required: false },
  { key: 'payroll', name: 'Payroll & Payslips', description: 'Payroll processing, salary structures and tax profiles', enabled: true, required: false },
  { key: 'recruitment', name: 'Recruitment / ATS', description: 'Openings, candidates, interviews and offers', enabled: false, required: false },
  { key: 'expenses', name: 'Expense Management', description: 'Claims, approvals and reimbursement workflows', enabled: false, required: false },
  { key: 'analytics', name: 'Workforce Analytics', description: 'Headcount, retention and workforce reporting', enabled: true, required: false },
];

function StatusBadge({ status }: { status: BackupStatus }) {
  const tone = status === 'Healthy'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
    : status === 'Delayed'
      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'
      : 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300';
  return <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold ${tone}`}><span className={`h-1.5 w-1.5 rounded-full ${status === 'Healthy' ? 'bg-emerald-500' : status === 'Delayed' ? 'bg-red-500' : 'animate-pulse bg-orange-500'}`} />{status}</span>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">{icon}</div><div><div className="text-xl font-extrabold">{value}</div><div className="text-[11px] text-slate-500">{label}</div></div></div></div>;
}

function CopyField({ icon, label, value, onCopy }: { icon: ReactNode; label: string; value: string; onCopy: (value: string) => void }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-950/40">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{icon}{label}</div>
      <div className="flex items-center gap-2"><code className="min-w-0 flex-1 truncate text-[11px] text-slate-700 dark:text-slate-300">{value}</code><button onClick={() => onCopy(value)} title={`Copy ${label}`} className="text-slate-400 hover:text-indigo-600"><Copy className="h-3.5 w-3.5" /></button></div>
    </div>
  );
}

export function TenantIsolationPage() {
  const [view, setView] = useState<View>('Provisioning Defaults');
  const [modules, setModules] = useState(() => Object.fromEntries(moduleDefaults.map((module) => [module.key, module.enabled])));
  const [country, setCountry] = useState('United States');
  const [trialLength, setTrialLength] = useState(21);
  const [dataRegion, setDataRegion] = useState('Auto-select from country');
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('All regions');
  const [selected, setSelected] = useState<TenantIsolation | null>(null);
  const [copied, setCopied] = useState('');
  const [saved, setSaved] = useState(false);

  const filtered = useMemo(() => tenants.filter((tenant) =>
    `${tenant.name} ${tenant.id} ${tenant.schema} ${tenant.region}`.toLowerCase().includes(search.toLowerCase())
    && (region === 'All regions' || tenant.region.includes(region)),
  ), [search, region]);

  const handleCopy = (value: string) => {
    void navigator.clipboard?.writeText(value);
    setCopied(value);
    window.setTimeout(() => setCopied(''), 1500);
  };

  const saveDefaults = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-300"><LockKeyhole className="h-4 w-4" /> TENANT SECURITY BOUNDARY</div>
          <h1 className="text-2xl font-extrabold">Tenant Isolation & Provisioning</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Control new-workspace defaults and verify tenant-level data boundaries.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"><ShieldCheck className="h-4 w-4" /> All isolation controls enforced</div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Isolated tenants" value="128 / 128" icon={<Database className="h-4 w-4" />} />
        <Metric label="Regional data stores" value="7 regions" icon={<Server className="h-4 w-4" />} />
        <Metric label="Encrypted buckets" value="100%" icon={<KeyRound className="h-4 w-4" />} />
        <Metric label="Last backup success" value="98.4%" icon={<Cloud className="h-4 w-4" />} />
      </div>

      <div className="border-b border-slate-200 dark:border-slate-800">
        <div className="flex">
          {(['Provisioning Defaults', 'Isolation Status'] as View[]).map((item) => <button key={item} onClick={() => setView(item)} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold ${view === item ? 'border-indigo-600 text-indigo-600 dark:text-indigo-300' : 'border-transparent text-slate-500'}`}>{item === 'Provisioning Defaults' ? <Settings2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}{item}</button>)}
        </div>
      </div>

      {view === 'Provisioning Defaults' && (
        <div className="grid gap-5 xl:grid-cols-3">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 xl:col-span-2">
            <div className="border-b border-slate-200 p-5 dark:border-slate-800"><h2 className="font-bold">Default module entitlement</h2><p className="mt-1 text-xs text-slate-500">Modules enabled automatically when a tenant workspace is provisioned.</p></div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {moduleDefaults.map((module) => (
                <div key={module.key} className="flex items-center gap-4 px-5 py-4">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${modules[module.key] ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}><Check className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><div className="text-sm font-bold">{module.name}</div>{module.required && <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-500 dark:border-slate-700">Required</span>}</div><p className="mt-0.5 text-[11px] text-slate-500">{module.description}</p></div>
                  <Toggle checked={modules[module.key]} onChange={(checked) => !module.required && setModules((previous) => ({ ...previous, [module.key]: checked }))} />
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-bold">Workspace defaults</h2><p className="mt-1 text-xs text-slate-500">Applied before a company admin first signs in.</p>
              <div className="mt-5 space-y-4">
                <div><label className="text-xs font-bold">Default country</label><select value={country} onChange={(event) => setCountry(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950">{['United States', 'United Kingdom', 'Germany', 'Singapore', 'Bangladesh', 'Australia'].map((item) => <option key={item}>{item}</option>)}</select></div>
                <div><label className="text-xs font-bold">Default data region</label><select value={dataRegion} onChange={(event) => setDataRegion(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950"><option>Auto-select from country</option><option>US East · N. Virginia</option><option>EU Central · Frankfurt</option><option>AP Southeast · Singapore</option></select></div>
                <div><div className="flex items-center justify-between"><label className="text-xs font-bold">Default trial length</label><span className="font-mono text-xs font-bold text-indigo-600">{trialLength} days</span></div><input aria-label="Default trial length" type="range" min="7" max="45" step="1" value={trialLength} onChange={(event) => setTrialLength(Number(event.target.value))} className="mt-3 w-full accent-indigo-600" /><div className="mt-1 flex justify-between text-[9px] text-slate-400"><span>7 days</span><span>45 days</span></div></div>
              </div>
            </section>
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-xs text-orange-800 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-200"><div className="flex gap-2"><LockKeyhole className="h-4 w-4 shrink-0" /><p>Data region is immutable after tenant creation. Changing this default never migrates existing tenants.</p></div></div>
            <button onClick={saveDefaults} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-900/15 hover:bg-indigo-500">{saved ? <CheckCircle2 className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}{saved ? 'Defaults saved' : 'Save provisioning defaults'}</button>
          </div>
        </div>
      )}

      {view === 'Isolation Status' && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 md:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tenant, schema, ID or region..." className="h-10 w-full rounded-xl border border-slate-200 bg-transparent pl-9 pr-4 text-sm focus:border-indigo-400 focus:outline-none dark:border-slate-700" /></div>
            <select value={region} onChange={(event) => setRegion(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"><option>All regions</option><option>US East</option><option>EU Central</option><option>EU West</option><option>AP Southeast</option></select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-950/50"><tr><th className="px-5 py-3">Tenant</th><th className="px-4 py-3">Database schema</th><th className="px-4 py-3">Storage bucket</th><th className="px-4 py-3">Region</th><th className="px-4 py-3">Backup</th><th className="px-4 py-3">Last event</th><th /></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20">
                    <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-[10px] font-extrabold text-white">{tenant.initials}</div><div><div className="text-sm font-bold">{tenant.name}</div><code className="text-[10px] text-slate-500">{tenant.id}</code></div></div></td>
                    <td className="px-4 py-4"><code className="text-[11px] text-slate-600 dark:text-slate-300">{tenant.schema}</code></td>
                    <td className="max-w-56 px-4 py-4"><code className="block truncate text-[11px] text-slate-600 dark:text-slate-300">{tenant.bucket}</code></td>
                    <td className="px-4 py-4 text-xs text-slate-500">{tenant.region}</td>
                    <td className="px-4 py-4"><StatusBadge status={tenant.backupStatus} /></td>
                    <td className="px-4 py-4 text-xs text-slate-500">{tenant.backupTime}</td>
                    <td className="px-4 py-4"><button onClick={() => setSelected(tenant)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700">Inspect</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <div className="p-10 text-center text-sm text-slate-500">No tenant isolation records match this search.</div>}
        </section>
      )}

      <Modal open={selected !== null} onClose={() => setSelected(null)} title={selected ? `${selected.name} · Isolation details` : ''} description="Read-only infrastructure identifiers from the control plane." size="lg" footer={<button onClick={() => setSelected(null)} className="h-9 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white">Done</button>}>
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-600" /><div><div className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Tenant boundary verified</div><div className="text-[11px] text-emerald-700 dark:text-emerald-300">Database role, object prefix and encryption key are tenant-scoped.</div></div></div><StatusBadge status={selected.backupStatus} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <CopyField icon={<Database className="h-3 w-3" />} label="Database schema" value={selected.schema} onCopy={handleCopy} />
              <CopyField icon={<HardDrive className="h-3 w-3" />} label="Storage bucket" value={selected.bucket} onCopy={handleCopy} />
              <CopyField icon={<KeyRound className="h-3 w-3" />} label="KMS key alias" value={selected.kmsKey} onCopy={handleCopy} />
              <CopyField icon={<LockKeyhole className="h-3 w-3" />} label="Security group" value={selected.securityGroup} onCopy={handleCopy} />
            </div>
            {copied && <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600"><Check className="h-4 w-4" /> Identifier copied to clipboard</div>}
            <div className="grid gap-3 sm:grid-cols-3">{[['Residency region', selected.region], ['Last backup', selected.backupTime], ['Restore point', selected.restorePoint]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50"><div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div><div className="mt-1 text-xs font-bold">{value}</div></div>)}</div>
            <button className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-bold hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700"><RefreshCw className="h-4 w-4" /> Re-run isolation verification</button>
            <div className="flex items-start gap-2 text-[11px] text-slate-500"><Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />Identifiers are synchronized from infrastructure inventory every five minutes. Changes must be made through the provisioning pipeline.</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
