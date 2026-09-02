import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileClock,
  Globe2,
  History,
  Info,
  Landmark,
  Plus,
  Save,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

type CountryStatus = 'Active' | 'Coming Soon';
type TabName = 'Tax Rules' | 'Statutory Deductions' | 'Leave Rules' | 'Public Holidays' | 'Payroll Cycle Rules';

interface Country {
  code: string;
  flag: string;
  name: string;
  status: CountryStatus;
  tenants: number;
  region: string;
  updated: string;
}

interface RuleVersion {
  version: string;
  effective: string;
  status: 'Current' | 'Previous' | 'Scheduled';
  note: string;
}

interface VersionedRule {
  id: string;
  name: string;
  value: string;
  detail: string;
  effective: string;
  versions: RuleVersion[];
}

const countries: Country[] = [
  { code: 'US', flag: '🇺🇸', name: 'United States', status: 'Active', tenants: 38, region: 'North America', updated: 'Aug 12, 2026' },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom', status: 'Active', tenants: 19, region: 'Europe', updated: 'Aug 02, 2026' },
  { code: 'DE', flag: '🇩🇪', name: 'Germany', status: 'Active', tenants: 16, region: 'Europe', updated: 'Jul 24, 2026' },
  { code: 'SG', flag: '🇸🇬', name: 'Singapore', status: 'Active', tenants: 14, region: 'Asia Pacific', updated: 'Aug 18, 2026' },
  { code: 'BD', flag: '🇧🇩', name: 'Bangladesh', status: 'Active', tenants: 11, region: 'Asia Pacific', updated: 'Aug 20, 2026' },
  { code: 'AE', flag: '🇦🇪', name: 'United Arab Emirates', status: 'Coming Soon', tenants: 6, region: 'Middle East', updated: 'Target: Q4 2026' },
  { code: 'CA', flag: '🇨🇦', name: 'Canada', status: 'Coming Soon', tenants: 4, region: 'North America', updated: 'Target: Q1 2027' },
];

const taxBrackets = [
  { id: 'tax-1', from: '0', to: '11,600', rate: '10%', effective: 'Jan 01, 2026' },
  { id: 'tax-2', from: '11,601', to: '47,150', rate: '12%', effective: 'Jan 01, 2026' },
  { id: 'tax-3', from: '47,151', to: '100,525', rate: '22%', effective: 'Jan 01, 2026' },
  { id: 'tax-4', from: '100,526', to: '191,950', rate: '24%', effective: 'Jan 01, 2026' },
];

const tabRules: Record<Exclude<TabName, 'Tax Rules'>, VersionedRule[]> = {
  'Statutory Deductions': [
    { id: 'ded-1', name: 'Social Security', value: '6.20%', detail: 'Employee and employer · wage base $176,100', effective: 'Jan 01, 2026', versions: [] },
    { id: 'ded-2', name: 'Medicare', value: '1.45%', detail: 'All taxable wages · additional 0.9% above $200k', effective: 'Jan 01, 2026', versions: [] },
    { id: 'ded-3', name: 'Federal Unemployment', value: '0.60%', detail: 'Employer only · first $7,000', effective: 'Jan 01, 2026', versions: [] },
  ],
  'Leave Rules': [
    { id: 'leave-1', name: 'Annual / PTO baseline', value: '15 days', detail: 'Full-time employees · prorated in first year', effective: 'Jan 01, 2026', versions: [] },
    { id: 'leave-2', name: 'Paid sick leave', value: '7 days', detail: 'All employees after 30 days of service', effective: 'Jan 01, 2026', versions: [] },
    { id: 'leave-3', name: 'Parental leave', value: '12 weeks', detail: 'Job-protected · company pay policy applies', effective: 'Jul 01, 2026', versions: [] },
  ],
  'Public Holidays': [
    { id: 'holiday-1', name: "New Year's Day", value: 'Jan 01', detail: 'Federal holiday · observed next weekday', effective: 'Jan 01, 2026', versions: [] },
    { id: 'holiday-2', name: 'Independence Day', value: 'Jul 04', detail: 'Federal holiday · observed previous Friday', effective: 'Jan 01, 2026', versions: [] },
    { id: 'holiday-3', name: 'Labor Day', value: 'Sep 07', detail: 'First Monday in September', effective: 'Jan 01, 2026', versions: [] },
    { id: 'holiday-4', name: 'Thanksgiving Day', value: 'Nov 26', detail: 'Fourth Thursday in November', effective: 'Jan 01, 2026', versions: [] },
  ],
  'Payroll Cycle Rules': [
    { id: 'cycle-1', name: 'Monthly payroll', value: 'Last banking day', detail: 'Cut-off on the 20th · 5-day approval window', effective: 'Jan 01, 2026', versions: [] },
    { id: 'cycle-2', name: 'Biweekly payroll', value: 'Every other Friday', detail: '26 cycles · 4-day approval window', effective: 'Jan 01, 2026', versions: [] },
    { id: 'cycle-3', name: 'Off-cycle adjustment', value: 'Wednesday', detail: 'Requires payroll admin and finance approval', effective: 'Apr 01, 2026', versions: [] },
  ],
};

const defaultVersions: RuleVersion[] = [
  { version: 'v3.0', effective: 'Jan 01, 2026', status: 'Current', note: 'Indexed for the 2026 tax year and statutory limits.' },
  { version: 'v2.1', effective: 'Jan 01, 2025', status: 'Previous', note: 'Annual government rate update.' },
  { version: 'v2.0', effective: 'Jul 01, 2024', status: 'Previous', note: 'Mid-year compliance clarification.' },
];

function Badge({ children, tone }: { children: ReactNode; tone: 'green' | 'orange' | 'indigo' | 'slate' }) {
  const tones = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    orange: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300',
    slate: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  return <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

function VersionButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} title="View version history" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:hover:bg-indigo-950/40">
      <History className="h-4 w-4" />
    </button>
  );
}

export function CountryCompliancePage() {
  const [selected, setSelected] = useState<Country | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'All' | CountryStatus>('All');
  const [tab, setTab] = useState<TabName>('Tax Rules');
  const [brackets, setBrackets] = useState(taxBrackets);
  const [versionRule, setVersionRule] = useState<{ name: string; versions: RuleVersion[] } | null>(null);
  const [addingVersion, setAddingVersion] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState('2027-01-01');
  const [saved, setSaved] = useState(false);

  const filtered = useMemo(() => countries.filter((country) =>
    `${country.name} ${country.code} ${country.region}`.toLowerCase().includes(search.toLowerCase())
    && (status === 'All' || country.status === status),
  ), [search, status]);

  const openHistory = (name: string, versions = defaultVersions) => {
    setVersionRule({ name, versions });
    setAddingVersion(false);
  };

  const saveVersion = () => {
    if (!versionRule) return;
    const displayDate = new Date(`${effectiveFrom}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    setVersionRule({
      ...versionRule,
      versions: [{ version: `v${versionRule.versions.length + 1}.0`, effective: displayDate, status: 'Scheduled', note: 'New operator-authored rule version.' }, ...versionRule.versions],
    });
    setAddingVersion(false);
  };

  if (!selected) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-300"><Globe2 className="h-4 w-4" /> COMPLIANCE CONTROL PLANE</div>
            <h1 className="text-2xl font-extrabold">Country Compliance</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Effective-dated statutory rules inherited by every tenant.</p>
          </div>
          <button className="flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-900/15 hover:bg-indigo-500"><Plus className="h-4 w-4" /> Add country</button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Active jurisdictions', '5', ShieldCheck, 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'],
            ['Tenants covered', '98', Landmark, 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40'],
            ['Scheduled launches', '2', Clock3, 'text-orange-600 bg-orange-50 dark:bg-orange-950/40'],
          ].map(([label, value, Icon, tone]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between"><div><div className="text-2xl font-extrabold">{String(value)}</div><div className="mt-1 text-xs text-slate-500">{String(label)}</div></div><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${String(tone)}`}><Icon className="h-5 w-5" /></div></div>
            </div>
          ))}
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search country or region..." className="h-10 w-full rounded-xl border border-slate-200 bg-transparent pl-9 pr-4 text-sm focus:border-indigo-400 focus:outline-none dark:border-slate-700" /></div>
            <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"><option>All</option><option>Active</option><option>Coming Soon</option></select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-950/50"><tr><th className="px-5 py-3">Country</th><th className="px-4 py-3">Region</th><th className="px-4 py-3">Availability</th><th className="px-4 py-3">Tenants</th><th className="px-4 py-3">Last rule update</th><th /></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((country) => (
                  <tr key={country.code} onClick={() => { setSelected(country); setTab('Tax Rules'); }} className="cursor-pointer transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20">
                    <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="text-2xl" aria-hidden>{country.flag}</span><div><div className="text-sm font-bold">{country.name}</div><div className="text-[11px] text-slate-500">{country.code}</div></div></div></td>
                    <td className="px-4 py-4 text-xs text-slate-500">{country.region}</td>
                    <td className="px-4 py-4"><Badge tone={country.status === 'Active' ? 'green' : 'orange'}>{country.status}</Badge></td>
                    <td className="px-4 py-4 font-mono text-sm font-bold">{country.tenants}</td>
                    <td className="px-4 py-4 text-xs text-slate-500">{country.updated}</td>
                    <td className="px-4 py-4"><ChevronRight className="h-4 w-4 text-slate-400" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  const tabs: TabName[] = ['Tax Rules', 'Statutory Deductions', 'Leave Rules', 'Public Holidays', 'Payroll Cycle Rules'];

  return (
    <div className="space-y-5 animate-fade-in">
      <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600"><ArrowLeft className="h-4 w-4" /> Back to countries</button>
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center">
        <div className="flex items-center gap-4"><span className="text-4xl">{selected.flag}</span><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-extrabold">{selected.name}</h1><Badge tone={selected.status === 'Active' ? 'green' : 'orange'}>{selected.status}</Badge></div><p className="mt-1 text-xs text-slate-500">{selected.tenants} tenants · {selected.region} · Rules reviewed Aug 20, 2026</p></div></div>
        <button onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 1800); }} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-500">{saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saved ? 'Changes saved' : 'Save changes'}</button>
      </div>

      <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 dark:border-indigo-900 dark:bg-indigo-950/20">
        <div className="mb-4 flex items-start gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" /><div><h2 className="text-sm font-bold">Override hierarchy</h2><p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">The most specific configured level wins. Statutory minimums remain locked and cannot be reduced.</p></div></div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          {[
            ['Global Default', 'Fallback', false],
            ['Country', 'Configured here', true],
            ['State', 'Overridable', true],
            ['Company', 'Overridable', true],
            ['Employee Contract', 'Only additive', true],
          ].map(([name, copy, overridable], index) => (
            <div key={String(name)} className="contents">
              <div className={`flex-1 rounded-xl border p-3 ${name === 'Country' ? 'border-indigo-500 bg-white ring-2 ring-indigo-500/10 dark:bg-slate-900' : 'border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-900/60'}`}><div className="flex items-center gap-2 text-xs font-bold"><span className={`h-2 w-2 rounded-full ${overridable ? 'bg-indigo-500' : 'bg-slate-400'}`} />{String(name)}</div><div className="mt-1 text-[10px] text-slate-500">{String(copy)}</div></div>
              {index < 4 && <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-400 lg:block" />}
            </div>
          ))}
        </div>
      </section>

      <div className="overflow-x-auto border-b border-slate-200 dark:border-slate-800"><div className="flex min-w-max">{tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`border-b-2 px-4 py-3 text-xs font-bold ${tab === item ? 'border-indigo-600 text-indigo-600 dark:text-indigo-300' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>{item}</button>)}</div></div>

      {tab === 'Tax Rules' ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800"><div><h2 className="font-bold">Federal income tax brackets</h2><p className="mt-1 text-xs text-slate-500">Edit bracket thresholds and rates. Currency: USD · Annual taxable income.</p></div><button onClick={() => setBrackets((rows) => [...rows, { id: `tax-${Date.now()}`, from: '', to: '', rate: '', effective: 'Jan 01, 2027' }])} className="flex items-center gap-1.5 text-xs font-bold text-indigo-600"><Plus className="h-4 w-4" /> Add bracket</button></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500 dark:bg-slate-950/50"><tr><th className="px-5 py-3">Income from</th><th className="px-4 py-3">Income to</th><th className="px-4 py-3">Rate</th><th className="px-4 py-3">Effective</th><th className="px-4 py-3">History</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{brackets.map((row, index) => <tr key={row.id}><td className="px-5 py-3"><input aria-label={`Bracket ${index + 1} from`} value={row.from} onChange={(event) => setBrackets((rows) => rows.map((item) => item.id === row.id ? { ...item, from: event.target.value } : item))} className="h-9 w-32 rounded-lg border border-slate-200 bg-transparent px-3 font-mono text-xs focus:border-indigo-400 focus:outline-none dark:border-slate-700" /></td><td className="px-4 py-3"><input aria-label={`Bracket ${index + 1} to`} value={row.to} onChange={(event) => setBrackets((rows) => rows.map((item) => item.id === row.id ? { ...item, to: event.target.value } : item))} className="h-9 w-32 rounded-lg border border-slate-200 bg-transparent px-3 font-mono text-xs focus:border-indigo-400 focus:outline-none dark:border-slate-700" /></td><td className="px-4 py-3"><input aria-label={`Bracket ${index + 1} rate`} value={row.rate} onChange={(event) => setBrackets((rows) => rows.map((item) => item.id === row.id ? { ...item, rate: event.target.value } : item))} className="h-9 w-20 rounded-lg border border-slate-200 bg-transparent px-3 font-mono text-xs font-bold focus:border-indigo-400 focus:outline-none dark:border-slate-700" /></td><td className="px-4 py-3 text-xs text-slate-500">{row.effective}</td><td className="px-4 py-3"><VersionButton onClick={() => openHistory(`Tax bracket ${index + 1}`)} /></td></tr>)}</tbody></table></div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800"><h2 className="font-bold">{tab}</h2><p className="mt-1 text-xs text-slate-500">{tab === 'Public Holidays' ? '2026 statutory calendar and observed dates.' : 'Country baseline rules and tenant applicability.'}</p></div>
          <div className={tab === 'Public Holidays' ? 'grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3' : 'divide-y divide-slate-100 dark:divide-slate-800'}>
            {tabRules[tab].map((rule) => (
              <div key={rule.id} className={tab === 'Public Holidays' ? 'rounded-xl border border-slate-200 p-4 dark:border-slate-700' : 'flex items-center gap-4 px-5 py-4'}>
                {tab === 'Public Holidays' && <CalendarDays className="mb-3 h-5 w-5 text-indigo-500" />}
                <div className="min-w-0 flex-1"><div className="text-sm font-bold">{rule.name}</div><div className="mt-0.5 text-[11px] text-slate-500">{rule.detail}</div><div className="mt-2"><Badge tone="indigo">{rule.value}</Badge></div></div>
                <div className="mt-3 flex items-center justify-between gap-3 sm:mt-0"><span className="text-[10px] text-slate-500">Effective {rule.effective}</span><VersionButton onClick={() => openHistory(rule.name, rule.versions.length ? rule.versions as typeof defaultVersions : defaultVersions)} /></div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Modal open={versionRule !== null} onClose={() => setVersionRule(null)} title={versionRule ? `${versionRule.name} · Version history` : ''} description="Effective-dated changes are immutable after activation." size="lg" footer={<><button onClick={() => setVersionRule(null)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-semibold dark:border-slate-700">Close</button><button onClick={() => setAddingVersion(true)} className="flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Add New Version</button></>}>
        {addingVersion ? (
          <div className="space-y-4"><div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-xs text-orange-800 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-200">A new version will be scheduled. Current tenant payroll calculations remain unchanged until its effective date.</div><div><label className="text-xs font-bold">Effective from</label><input type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-slate-700" /></div><div><label className="text-xs font-bold">Change note</label><textarea defaultValue="Annual statutory rate update" className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-200 bg-transparent p-3 text-sm dark:border-slate-700" /></div><button onClick={saveVersion} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-bold text-white"><FileClock className="h-4 w-4" /> Schedule version</button></div>
        ) : (
          <div className="space-y-0">{versionRule?.versions.map((version, index) => <div key={`${version.version}-${version.effective}`} className="relative flex gap-4 pb-6 last:pb-0">{index < versionRule.versions.length - 1 && <div className="absolute left-[15px] top-8 h-full w-px bg-slate-200 dark:bg-slate-700" />}<div className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${version.status === 'Current' ? 'bg-emerald-500 text-white' : version.status === 'Scheduled' ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700'}`}><Clock3 className="h-4 w-4" /></div><div className="flex-1 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div className="flex items-center justify-between gap-3"><div className="text-sm font-bold">{version.version} · {version.effective}</div><Badge tone={version.status === 'Current' ? 'green' : version.status === 'Scheduled' ? 'orange' : 'slate'}>{version.status}</Badge></div><p className="mt-1 text-xs text-slate-500">{version.note}</p></div></div>)}</div>
        )}
      </Modal>
    </div>
  );
}
