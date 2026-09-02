import { useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CircleDollarSign,
  Clock3,
  Globe2,
  Save,
  Settings,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { Toggle } from '@/components/ui/Toggle';

interface Country {
  name: string;
  code: string;
  enabled: boolean;
  compliance: string[];
}

const initialCountries: Country[] = [
  { name: 'United States', code: 'US', enabled: true, compliance: ['SOC 2', 'CCPA'] },
  { name: 'United Kingdom', code: 'GB', enabled: true, compliance: ['UK GDPR', 'DPA 2018'] },
  { name: 'Germany', code: 'DE', enabled: true, compliance: ['EU GDPR', 'Works Council'] },
  { name: 'Singapore', code: 'SG', enabled: true, compliance: ['PDPA'] },
  { name: 'Australia', code: 'AU', enabled: true, compliance: ['Privacy Act'] },
  { name: 'Bangladesh', code: 'BD', enabled: false, compliance: ['DPA Review'] },
];

const checklistSeed = [
  { label: 'Data processing terms reviewed', checked: true },
  { label: 'Regional data residency mapped', checked: true },
  { label: 'Payroll retention policies configured', checked: true },
  { label: 'New-country legal approval recorded', checked: false },
  { label: 'Incident notification contacts verified', checked: false },
];

export function PlatformSettingsPage() {
  const [trialLength, setTrialLength] = useState(14);
  const [currency, setCurrency] = useState('USD');
  const [countries, setCountries] = useState(initialCountries);
  const [checklist, setChecklist] = useState(checklistSeed);
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceDate, setMaintenanceDate] = useState('2026-08-29T02:00');
  const [duration, setDuration] = useState('60');
  const [message, setMessage] = useState('Nexus HR will be temporarily unavailable while we improve platform reliability.');
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const formattedDate = maintenanceDate
    ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(maintenanceDate))
    : 'Schedule not set';

  return (
    <div className="space-y-6 animate-fade-in text-slate-900 dark:text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-300 mb-2"><Settings className="h-4 w-4" /> CONTROL PLANE CONFIGURATION</div>
          <h1 className="text-2xl font-extrabold">Platform Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Global onboarding, regional compliance, and operational defaults.</p>
        </div>
        <button onClick={save} className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/15">
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />} {saved ? 'Settings saved' : 'Save changes'}
        </button>
      </div>

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center"><Clock3 className="h-4 w-4" /></div>
          <div><h2 className="font-bold">Tenant onboarding defaults</h2><p className="text-xs text-slate-500 mt-0.5">Applied when operators create a new tenant.</p></div>
        </div>
        <div className="p-5 grid md:grid-cols-2 gap-5">
          <label>
            <span className="text-xs font-bold">Default trial length</span>
            <div className="relative mt-1.5"><input type="number" min={1} max={90} value={trialLength} onChange={(event) => setTrialLength(Number(event.target.value))} className="w-full h-11 px-4 pr-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm font-semibold focus:outline-none focus:border-indigo-400" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500">days</span></div>
            <span className="text-[11px] text-slate-500 mt-1.5 block">Trial expiration reminders begin 3 days before expiry.</span>
          </label>
          <label>
            <span className="text-xs font-bold">Default billing currency</span>
            <div className="relative mt-1.5"><CircleDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><select value={currency} onChange={(event) => setCurrency(event.target.value)} className="w-full h-11 pl-9 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-semibold focus:outline-none focus:border-indigo-400">{['USD', 'EUR', 'GBP', 'SGD', 'AUD', 'BDT'].map((item) => <option key={item}>{item}</option>)}</select></div>
            <span className="text-[11px] text-slate-500 mt-1.5 block">Individual enterprise contracts can override this value.</span>
          </label>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,.6fr)] gap-5">
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 flex items-center justify-center"><Globe2 className="h-4 w-4" /></div>
            <div><h2 className="font-bold">Supported countries</h2><p className="text-xs text-slate-500 mt-0.5">Country availability and applicable policy packs.</p></div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {countries.map((country) => (
              <div key={country.code} className="px-5 py-4 flex items-center gap-4">
                <div className="h-9 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-xs font-extrabold flex items-center justify-center">{country.code}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold">{country.name}</div>
                  <div className="flex gap-1.5 flex-wrap mt-1.5">{country.compliance.map((item) => <span key={item} className="rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 text-[10px] font-semibold">{item}</span>)}</div>
                </div>
                <Toggle checked={country.enabled} onChange={(checked) => setCountries((current) => current.map((item) => item.code === country.code ? { ...item, enabled: checked } : item))} />
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center"><ShieldCheck className="h-4 w-4" /></div>
            <div><h2 className="font-bold">Compliance readiness</h2><p className="text-xs text-slate-500 mt-0.5">{checklist.filter((item) => item.checked).length} of {checklist.length} complete</p></div>
          </div>
          <div className="p-5 space-y-4">
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-gradient-to-r from-indigo-600 to-violet-500 transition-all" style={{ width: `${(checklist.filter((item) => item.checked).length / checklist.length) * 100}%` }} /></div>
            {checklist.map((item, index) => (
              <button key={item.label} onClick={() => setChecklist((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, checked: !entry.checked } : entry))} className="w-full flex items-start gap-3 text-left">
                <span className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center shrink-0 ${item.checked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{item.checked && <Check className="h-3.5 w-3.5" />}</span>
                <span className={`text-xs leading-relaxed ${item.checked ? 'text-slate-500 line-through' : 'font-semibold'}`}>{item.label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className={`rounded-2xl border shadow-sm overflow-hidden ${maintenance ? 'bg-orange-50/50 dark:bg-orange-950/15 border-orange-300 dark:border-orange-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
        <div className={`px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center gap-4 ${maintenance ? 'border-orange-200 dark:border-orange-900' : 'border-slate-200 dark:border-slate-800'}`}>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${maintenance ? 'bg-orange-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}><Wrench className="h-5 w-5" /></div>
          <div className="flex-1"><h2 className="font-bold">Maintenance mode</h2><p className="text-xs text-slate-500 mt-0.5">Schedule and preview the platform-wide customer notice.</p></div>
          <div className="flex items-center gap-3"><span className={`text-xs font-bold ${maintenance ? 'text-orange-700 dark:text-orange-300' : 'text-slate-500'}`}>{maintenance ? 'Scheduled' : 'Off'}</span><Toggle checked={maintenance} onChange={setMaintenance} /></div>
        </div>
        <div className="p-5 grid xl:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <label><span className="text-xs font-bold">Maintenance starts</span><input type="datetime-local" value={maintenanceDate} onChange={(event) => setMaintenanceDate(event.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-orange-400" /></label>
              <label><span className="text-xs font-bold">Expected duration</span><select value={duration} onChange={(event) => setDuration(event.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-orange-400"><option value="30">30 minutes</option><option value="60">1 hour</option><option value="120">2 hours</option><option value="240">4 hours</option></select></label>
            </div>
            <label><span className="text-xs font-bold">Customer-facing message</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} className="mt-1.5 w-full min-h-24 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-orange-400" /></label>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/25 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-900"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><p className="text-xs leading-relaxed"><strong>Platform-level setting.</strong> Enabling maintenance mode prevents all tenant users from signing in during the scheduled window.</p></div>
          </div>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">Scheduled banner preview</div>
            <div className="rounded-2xl bg-slate-950 text-white border border-orange-400/30 shadow-xl overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-orange-500 to-red-500" />
              <div className="p-5 flex gap-4">
                <div className="h-10 w-10 rounded-xl bg-orange-500/15 text-orange-300 flex items-center justify-center shrink-0"><CalendarClock className="h-5 w-5" /></div>
                <div><div className="font-extrabold">Scheduled platform maintenance</div><p className="text-sm text-slate-300 mt-2 leading-relaxed">{message || 'Maintenance details will appear here.'}</p><div className="mt-4 flex flex-wrap gap-2 text-[11px]"><span className="rounded-md bg-white/5 border border-white/10 px-2 py-1">{formattedDate}</span><span className="rounded-md bg-orange-500/15 text-orange-200 border border-orange-400/20 px-2 py-1">Up to {duration} minutes</span></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
