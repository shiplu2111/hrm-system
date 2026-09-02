import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Check,
  Eye,
  EyeOff,
  FileLock2,
  Filter,
  LockKeyhole,
  MessageSquarePlus,
  Paperclip,
  Plus,
  Search,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';

type CaseType = 'Grievance' | 'Disciplinary' | 'Investigation';
type CaseStatus = 'Open' | 'Under review' | 'Action required' | 'Resolved';
type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

interface RelationCase {
  id: string;
  title: string;
  type: CaseType;
  status: CaseStatus;
  officer: string;
  priority: Priority;
  updated: string;
  restricted: boolean;
  summary: string;
}

const cases: RelationCase[] = [
  { id: 'ER-2026-041', title: 'Workplace conduct concern', type: 'Investigation', status: 'Under review', officer: 'Maya Patel', priority: 'Critical', updated: '25 Aug, 2:14 PM', restricted: true, summary: 'A confidential report regarding repeated conduct concerns within the Commercial team.' },
  { id: 'ER-2026-039', title: 'Formal workload grievance', type: 'Grievance', status: 'Action required', officer: 'Daniel Kim', priority: 'High', updated: '24 Aug, 4:36 PM', restricted: false, summary: 'Formal grievance concerning sustained workload allocation and manager communication.' },
  { id: 'ER-2026-036', title: 'Attendance policy review', type: 'Disciplinary', status: 'Open', officer: 'Maya Patel', priority: 'Medium', updated: '22 Aug, 11:05 AM', restricted: true, summary: 'Review of repeated unapproved absences after prior informal counseling.' },
  { id: 'ER-2026-031', title: 'Team mediation request', type: 'Grievance', status: 'Resolved', officer: 'Aisha Grant', priority: 'Low', updated: '18 Aug, 9:40 AM', restricted: false, summary: 'Mediation requested following a breakdown in working relationships.' },
  { id: 'ER-2026-027', title: 'Procurement process concern', type: 'Investigation', status: 'Under review', officer: 'Daniel Kim', priority: 'High', updated: '15 Aug, 3:22 PM', restricted: true, summary: 'Internal review of reported inconsistencies in the vendor selection process.' },
];

const timeline = [
  { date: '25 Aug · 2:14 PM', title: 'Interview notes added', by: 'Maya Patel · HR Business Partner', detail: 'Witness interview completed. Notes restricted to the assigned investigation team.' },
  { date: '24 Aug · 10:30 AM', title: 'Legal review requested', by: 'Maya Patel', detail: 'Requested advice on evidence retention and next-step communications.' },
  { date: '22 Aug · 4:05 PM', title: 'Case triaged', by: 'Daniel Kim · Head of People', detail: 'Priority raised to Critical. Maya Patel assigned as lead officer.' },
  { date: '21 Aug · 9:18 AM', title: 'Confidential report received', by: 'Ethics reporting channel', detail: 'Initial report logged with identity protections enabled.' },
];

const statusTone: Record<CaseStatus, 'accent' | 'warning' | 'error' | 'success'> = {
  Open: 'accent',
  'Under review': 'warning',
  'Action required': 'error',
  Resolved: 'success',
};

const priorityTone: Record<Priority, 'neutral' | 'info' | 'warning' | 'error'> = {
  Low: 'neutral',
  Medium: 'info',
  High: 'warning',
  Critical: 'error',
};

export function EmployeeRelationsPage() {
  const [selected, setSelected] = useState<RelationCase | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [anonymized, setAnonymized] = useState(true);
  const [detailTab, setDetailTab] = useState<'activity' | 'files' | 'parties'>('activity');
  const [resolution, setResolution] = useState('Pending investigation findings and Legal review.');
  const [outcome, setOutcome] = useState('Not determined');
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState<string[]>([]);

  const filteredCases = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return cases.filter((item) => (
      (typeFilter === 'All' || item.type === typeFilter)
      && (!normalized || [item.id, item.title, item.officer, item.status].some((value) => value.toLowerCase().includes(normalized)))
    ));
  }, [query, typeFilter]);

  const addNote = () => {
    if (!note.trim()) return;
    setNotes((current) => [note.trim(), ...current]);
    setNote('');
  };

  if (selected) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
        <button onClick={() => setSelected(null)} className="inline-flex items-center gap-2 text-sm font-medium text-secondary transition-colors hover:text-accent-600">
          <ArrowLeft className="h-4 w-4" /> Back to confidential cases
        </button>

        {selected.restricted && (
          <div className="flex gap-3 rounded-xl border border-amber-300/60 bg-amber-50/70 p-4 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/25 dark:text-amber-200">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Restricted to assigned HR &amp; Legal personnel</p>
              <p className="mt-0.5 text-xs opacity-80">Viewing, downloading, and editing are recorded in the confidential case audit log.</p>
            </div>
          </div>
        )}

        <section className="surface rounded-xl border border-base p-5 shadow-card">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <FileLock2 className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-muted">{selected.id}</span>
                  <Badge tone={statusTone[selected.status]} dot>{selected.status}</Badge>
                  <Badge tone={priorityTone[selected.priority]}>{selected.priority}</Badge>
                </div>
                <h1 className="mt-2 text-xl font-bold text-primary">{selected.title}</h1>
                <p className="mt-1 max-w-3xl text-sm text-secondary">{selected.summary}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm"><Paperclip className="h-4 w-4" /> Attach file</Button>
              <Button size="sm" onClick={() => setDetailTab('activity')}><MessageSquarePlus className="h-4 w-4" /> Add note</Button>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
            <div className="flex overflow-x-auto border-b border-base px-4">
              {(['activity', 'files', 'parties'] as const).map((tab) => (
                <button key={tab} onClick={() => setDetailTab(tab)} className={`border-b-2 px-4 py-3 text-sm font-medium capitalize transition-colors ${detailTab === tab ? 'border-accent-500 text-accent-600 dark:text-accent-400' : 'border-transparent text-secondary hover:text-primary'}`}>
                  {tab === 'files' ? 'Confidential attachments' : tab === 'parties' ? 'Involved parties' : 'Timeline & notes'}
                </button>
              ))}
            </div>

            {detailTab === 'activity' && (
              <div className="p-5">
                <div className="mb-6 rounded-lg border border-base bg-[rgb(var(--bg-muted))] p-3">
                  <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Add a confidential case note…" className="bg-transparent" />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted"><LockKeyhole className="h-3 w-3" /> Visible to assigned case team</span>
                    <Button size="sm" onClick={addNote} disabled={!note.trim()}>Save note</Button>
                  </div>
                </div>
                <div className="space-y-0">
                  {notes.map((item, index) => (
                    <TimelineItem key={`${item}-${index}`} date="Just now" title="Confidential note added" by="You" detail={item} />
                  ))}
                  {timeline.map((item) => <TimelineItem key={item.date + item.title} {...item} />)}
                </div>
              </div>
            )}

            {detailTab === 'files' && (
              <div className="divide-y divide-[rgb(var(--border-base))]">
                {[
                  ['Witness interview - 02.pdf', 'PDF · 1.8 MB', 'Maya Patel · 25 Aug'],
                  ['Initial report and evidence.zip', 'Encrypted ZIP · 8.4 MB', 'Ethics Channel · 21 Aug'],
                  ['Legal hold notice.pdf', 'PDF · 342 KB', 'Daniel Kim · 22 Aug'],
                ].map(([name, meta, owner]) => (
                  <button key={name} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-[rgb(var(--bg-hover))]">
                    <div className="rounded-lg bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><FileLock2 className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-primary">{name}</p><p className="mt-0.5 text-xs text-muted">{meta} · {owner}</p></div>
                    <LockKeyhole className="h-4 w-4 text-muted" />
                  </button>
                ))}
              </div>
            )}

            {detailTab === 'parties' && (
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between rounded-lg bg-[rgb(var(--bg-muted))] p-3">
                  <div><p className="text-sm font-medium text-primary">Anonymize identities</p><p className="text-xs text-muted">Hide names during shared case review.</p></div>
                  <Toggle checked={anonymized} onChange={setAnonymized} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['Reporting employee', 'Leila Morgan', 'Product Design'],
                    ['Subject employee', 'Marcus Reed', 'Commercial'],
                    ['Witness A', 'Priya Sharma', 'Finance'],
                    ['Witness B', 'Noah Williams', 'Commercial'],
                  ].map(([role, name, team], index) => (
                    <div key={role} className="flex items-center gap-3 rounded-lg border border-base p-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800"><UserRound className="h-4 w-4" /></div>
                      <div><p className="text-xs text-muted">{role}</p><p className="text-sm font-semibold text-primary">{anonymized ? `Protected identity ${String.fromCharCode(65 + index)}` : name}</p><p className="text-xs text-secondary">{anonymized ? 'Department hidden' : team}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-5">
            <section className="surface rounded-xl border border-base p-5 shadow-card">
              <h2 className="text-sm font-semibold text-primary">Case ownership</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <InfoRow label="Case type" value={selected.type} />
                <InfoRow label="HR officer" value={selected.officer} />
                <InfoRow label="Last updated" value={selected.updated} />
                <InfoRow label="Access" value={selected.restricted ? 'HR & Legal' : 'Assigned HR team'} />
              </dl>
            </section>
            <section className="surface rounded-xl border border-base p-5 shadow-card">
              <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-primary">Resolution &amp; outcome</h2>{saved && <span className="inline-flex items-center gap-1 text-xs text-success-600"><Check className="h-3.5 w-3.5" /> Saved</span>}</div>
              <div className="mt-4 space-y-4">
                <div><Label htmlFor="outcome">Outcome</Label><Select id="outcome" value={outcome} onChange={(event) => { setOutcome(event.target.value); setSaved(false); }}><option>Not determined</option><option>Substantiated</option><option>Partially substantiated</option><option>Unsubstantiated</option><option>Resolved informally</option></Select></div>
                <div><Label htmlFor="resolution">Resolution notes</Label><Textarea id="resolution" value={resolution} onChange={(event) => { setResolution(event.target.value); setSaved(false); }} rows={5} /></div>
                <Button className="w-full" onClick={() => setSaved(true)}>Save confidential update</Button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><div className="flex items-center gap-2"><h1 className="text-xl font-bold text-primary">Employee Relations</h1><LockKeyhole className="h-4 w-4 text-muted" /></div><p className="mt-0.5 text-sm text-secondary">Securely manage sensitive workplace matters and case outcomes.</p></div>
        <Button><Plus className="h-4 w-4" /> New confidential case</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Open cases', value: '12', icon: BriefcaseBusiness },
          { label: 'Action required', value: '4', icon: ShieldAlert },
          { label: 'Resolved this quarter', value: '18', icon: Check },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="surface flex items-center gap-4 rounded-xl border border-base p-4 shadow-card">
            <div className="rounded-lg bg-slate-100 p-2.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Icon className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold text-primary">{value}</p><p className="text-xs text-secondary">{label}</p></div>
          </div>
        ))}
      </div>

      <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
        <div className="flex flex-col gap-3 border-b border-base p-4 md:flex-row md:items-center">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search case ID, title, officer…" className="pl-9" /></div>
          <div className="flex items-center gap-2"><Filter className="h-4 w-4 text-muted" /><Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="min-w-40"><option>All</option><option>Grievance</option><option>Disciplinary</option><option>Investigation</option></Select></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
              <tr><th className="px-5 py-3">Case</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">HR officer</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3 text-right">Access</th></tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border-base))]">
              {filteredCases.map((item) => (
                <tr key={item.id} onClick={() => setSelected(item)} className="cursor-pointer transition-colors hover:bg-[rgb(var(--bg-hover))]">
                  <td className="px-5 py-4"><p className="font-mono text-xs font-semibold text-secondary">{item.id}</p><p className="mt-1 font-medium text-primary">{item.title}</p><p className="mt-0.5 text-xs text-muted">Updated {item.updated}</p></td>
                  <td className="px-4 py-4 text-secondary">{item.type}</td><td className="px-4 py-4"><Badge tone={statusTone[item.status]} dot>{item.status}</Badge></td>
                  <td className="px-4 py-4 text-secondary">{item.officer}</td><td className="px-4 py-4"><Badge tone={priorityTone[item.priority]}>{item.priority}</Badge></td>
                  <td className="px-4 py-4"><div className="flex justify-end">{item.restricted ? <span title="Restricted to HR & Legal"><LockKeyhole className="h-4 w-4 text-amber-500" /></span> : <span title="Assigned HR team"><Eye className="h-4 w-4 text-muted" /></span>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredCases.length && <div className="p-10 text-center text-sm text-muted">No confidential cases match this filter.</div>}
        </div>
        <div className="flex items-center gap-2 border-t border-base bg-[rgb(var(--bg-muted))] px-5 py-3 text-xs text-muted"><EyeOff className="h-3.5 w-3.5" /> Case access and activity are audited.</div>
      </section>
    </div>
  );
}

function TimelineItem({ date, title, by, detail }: { date: string; title: string; by: string; detail: string }) {
  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      <span className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-px bg-[rgb(var(--border-base))] last:hidden" />
      <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-base bg-[rgb(var(--bg-muted))]"><LockKeyhole className="h-3.5 w-3.5 text-muted" /></div>
      <div><p className="text-sm font-semibold text-primary">{title}</p><p className="mt-0.5 text-xs text-secondary">{by}</p><p className="mt-2 text-sm text-secondary">{detail}</p><p className="mt-1.5 text-[11px] text-muted">{date}</p></div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 border-b border-base pb-3 last:border-0 last:pb-0"><dt className="text-secondary">{label}</dt><dd className="text-right font-medium text-primary">{value}</dd></div>;
}
