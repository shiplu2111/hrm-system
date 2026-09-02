import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Clock3,
  Headphones,
  MessageSquare,
  Paperclip,
  Search,
  Send,
  ShieldAlert,
  Tag,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Toggle';

type TicketStatus = 'New' | 'In Progress' | 'Waiting' | 'Resolved';
type Priority = 'Critical' | 'High' | 'Medium' | 'Low';

interface Ticket {
  id: string;
  tenant: string;
  plan: string;
  subject: string;
  status: TicketStatus;
  priority: Priority;
  agent: string;
  requester: string;
  updated: string;
}

const seedTickets: Ticket[] = [
  { id: 'SUP-4821', tenant: 'Globex Industries', plan: 'Enterprise', subject: 'Payroll submission blocked for August cycle', status: 'New', priority: 'Critical', agent: 'Maya Singh', requester: 'Mia Weber', updated: '4 min ago' },
  { id: 'SUP-4818', tenant: 'Acme Corporation', plan: 'Enterprise', subject: 'SAML users receive an invalid audience error', status: 'In Progress', priority: 'High', agent: 'Alex Morgan', requester: 'Olivia Martin', updated: '18 min ago' },
  { id: 'SUP-4812', tenant: 'TechFlow Labs', plan: 'Business', subject: 'Custom leave balance import question', status: 'Waiting', priority: 'Medium', agent: 'Nina Park', requester: 'Ethan Lim', updated: '1 hr ago' },
  { id: 'SUP-4804', tenant: 'Vertex Health', plan: 'Starter', subject: 'How to invite an additional HR administrator', status: 'Resolved', priority: 'Low', agent: 'Maya Singh', requester: 'Ava Wilson', updated: 'Yesterday' },
  { id: 'SUP-4799', tenant: 'Northstar Retail', plan: 'Business', subject: 'Attendance device data delayed', status: 'In Progress', priority: 'High', agent: 'Nina Park', requester: 'Noah Clarke', updated: '2 hrs ago' },
];

const statusStyles: Record<TicketStatus, string> = {
  New: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  'In Progress': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  Waiting: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  Resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
};

const priorityStyles: Record<Priority, string> = {
  Critical: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
  High: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
  Medium: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  Low: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${className}`}>{children}</span>;
}

export function SupportTicketsPage() {
  const [tickets, setTickets] = useState(seedTickets);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<'All' | TicketStatus>('All');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [internal, setInternal] = useState(false);
  const [sentMessages, setSentMessages] = useState<{ body: string; internal: boolean }[]>([]);
  const selected = tickets.find((ticket) => ticket.id === selectedId);

  const filtered = useMemo(
    () => tickets.filter((ticket) =>
      (status === 'All' || ticket.status === status)
      && `${ticket.id} ${ticket.tenant} ${ticket.subject}`.toLowerCase().includes(search.toLowerCase()),
    ),
    [search, status, tickets],
  );

  const sendMessage = () => {
    if (!message.trim()) return;
    setSentMessages((current) => [...current, { body: message.trim(), internal }]);
    setMessage('');
  };

  if (selected) {
    return (
      <div className="space-y-5 animate-fade-in text-slate-900 dark:text-slate-100">
        <button onClick={() => setSelectedId(null)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600">
          <ArrowLeft className="h-4 w-4" /> Back to ticket queue
        </button>
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs text-slate-500">{selected.id}</span>
              <Pill className={priorityStyles[selected.priority]}>{selected.priority}</Pill>
              <Pill className={statusStyles[selected.status]}>{selected.status}</Pill>
            </div>
            <h1 className="text-2xl font-extrabold">{selected.subject}</h1>
            <p className="text-sm text-slate-500 mt-1">Opened by {selected.requester} at {selected.tenant}</p>
          </div>
          <select
            value={selected.status}
            onChange={(event) => setTickets((current) => current.map((ticket) => ticket.id === selected.id ? { ...ticket, status: event.target.value as TicketStatus } : ticket))}
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400"
          >
            {(['New', 'In Progress', 'Waiting', 'Resolved'] as TicketStatus[]).map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5">
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 space-y-6">
              <div className="flex gap-3">
                <Avatar name={selected.requester} size="md" />
                <div className="flex-1 rounded-2xl rounded-tl-sm bg-slate-50 dark:bg-slate-950/60 p-4">
                  <div className="flex justify-between gap-3"><span className="text-sm font-bold">{selected.requester}</span><span className="text-[10px] text-slate-400">Today, 09:42</span></div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">Our payroll submission stops during validation. We have retried twice and need to finalize the cycle before today&apos;s approval deadline.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Avatar name={selected.agent} size="md" />
                <div className="flex-1 rounded-2xl rounded-tl-sm bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 p-4">
                  <div className="flex justify-between gap-3"><span className="text-sm font-bold">{selected.agent} · Support</span><span className="text-[10px] text-slate-400">Today, 09:51</span></div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">I&apos;m reviewing the validation trace now. I&apos;ll confirm whether this can be safely retried without changing employee calculations.</p>
                </div>
              </div>
              <div className="ml-12 rounded-xl border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-950/25 px-4 py-3">
                <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-orange-700 dark:text-orange-300"><ShieldAlert className="h-3.5 w-3.5" /> Internal note · not visible to tenant</div>
                <p className="text-sm mt-2 text-orange-900 dark:text-orange-100">Possible duplicate batch lock in eu-central payroll-worker. Escalated to on-call engineering.</p>
              </div>
              {sentMessages.map((item, index) => (
                <div key={`${item.body}-${index}`} className={`ml-12 rounded-xl px-4 py-3 ${item.internal ? 'border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-950/25' : 'bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900'}`}>
                  <div className={`text-[10px] font-extrabold uppercase tracking-wider ${item.internal ? 'text-orange-700 dark:text-orange-300' : 'text-indigo-700 dark:text-indigo-300'}`}>{item.internal ? 'Internal note · not visible to tenant' : 'Reply sent to tenant'}</div>
                  <p className="text-sm mt-2">{item.body}</p>
                </div>
              ))}
            </div>
            <div className={`border-t p-4 ${internal ? 'border-orange-200 bg-orange-50/70 dark:border-orange-900 dark:bg-orange-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setInternal(false)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${!internal ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Reply to tenant</button>
                <button onClick={() => setInternal(true)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${internal ? 'bg-orange-600 text-white' : 'text-slate-500'}`}>Internal note</button>
              </div>
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={internal ? 'Add a private note for support staff…' : 'Write a response to the tenant…'} className="w-full min-h-24 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm focus:outline-none focus:border-indigo-400" />
              <div className="flex justify-between mt-2">
                <button className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500"><Paperclip className="h-4 w-4" /></button>
                <button onClick={sendMessage} className={`h-9 px-4 rounded-lg text-white text-xs font-bold flex items-center gap-2 ${internal ? 'bg-orange-600 hover:bg-orange-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}><Send className="h-3.5 w-3.5" /> {internal ? 'Add private note' : 'Send reply'}</button>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-indigo-500" /><h2 className="font-bold">Tenant context</h2></div>
              <div className="mt-4"><div className="text-lg font-extrabold">{selected.tenant}</div><div className="text-xs text-slate-500">Active since January 2024</div></div>
              <div className="mt-4 p-3 rounded-xl bg-gradient-to-br from-indigo-950 to-violet-950 text-white"><div className="text-[10px] uppercase tracking-wider text-indigo-200">Current plan</div><div className="font-extrabold mt-1">{selected.plan}</div><div className="text-xs text-indigo-200 mt-1">1,248 employees · Priority SLA</div></div>
              <dl className="mt-4 space-y-3 text-xs"><div className="flex justify-between"><dt className="text-slate-500">Health score</dt><dd className="font-bold text-emerald-600">94 / 100</dd></div><div className="flex justify-between"><dt className="text-slate-500">Open tickets</dt><dd className="font-bold">3</dd></div><div className="flex justify-between"><dt className="text-slate-500">SLA response</dt><dd className="font-bold text-orange-600">18 min left</dd></div></dl>
            </section>
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <h2 className="font-bold">Recent activity</h2>
              <div className="mt-4 space-y-4">
                {[['Plan upgraded to Enterprise', '2 days ago'], ['Payroll settings changed', 'Yesterday'], ['Admin signed in from Germany', '3 hours ago']].map(([title, time]) => (
                  <div key={title} className="flex gap-3"><span className="mt-1 h-2 w-2 rounded-full bg-indigo-500 shrink-0" /><div><div className="text-xs font-semibold">{title}</div><div className="text-[10px] text-slate-500 mt-0.5">{time}</div></div></div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in text-slate-900 dark:text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div><div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-300 mb-2"><Headphones className="h-4 w-4" /> PLATFORM SUPPORT</div><h1 className="text-2xl font-extrabold">Support Tickets</h1><p className="text-sm text-slate-500 mt-1">Cross-tenant helpdesk queue and SLA triage.</p></div>
        <div className="flex items-center gap-2 text-xs text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl px-3 py-2"><Clock3 className="h-4 w-4" /><strong>2 tickets</strong> near SLA breach</div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(['New', 'In Progress', 'Waiting', 'Resolved'] as TicketStatus[]).map((item) => <button key={item} onClick={() => setStatus(item)} className={`rounded-2xl border p-4 text-left transition-all ${status === item ? 'border-indigo-500 ring-2 ring-indigo-500/15 bg-indigo-50/50 dark:bg-indigo-950/20' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}><div className="text-2xl font-extrabold">{tickets.filter((ticket) => ticket.status === item).length}</div><div className="text-xs text-slate-500 mt-1">{item}</div></button>)}
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ticket, tenant or subject…" className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:border-indigo-400" /></div>
          <button onClick={() => setStatus('All')} className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">All tickets</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left">
            <thead className="bg-slate-50 dark:bg-slate-950/50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Ticket</th><th className="px-4 py-3">Tenant</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Assigned agent</th><th className="px-4 py-3">Updated</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((ticket) => <tr key={ticket.id} onClick={() => setSelectedId(ticket.id)} className="cursor-pointer hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20"><td className="px-5 py-4"><div className="font-mono text-[11px] text-indigo-600">{ticket.id}</div><div className="text-sm font-bold mt-1 max-w-sm">{ticket.subject}</div></td><td className="px-4 py-4"><div className="text-sm font-semibold">{ticket.tenant}</div><div className="text-[10px] text-slate-500">{ticket.plan}</div></td><td className="px-4 py-4"><Pill className={statusStyles[ticket.status]}>{ticket.status}</Pill></td><td className="px-4 py-4"><Pill className={priorityStyles[ticket.priority]}>{ticket.priority}</Pill></td><td className="px-4 py-4"><div className="flex items-center gap-2"><Avatar name={ticket.agent} size="sm" /><span className="text-xs font-semibold">{ticket.agent}</span></div></td><td className="px-4 py-4 text-xs text-slate-500">{ticket.updated}</td></tr>)}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="p-12 text-center"><MessageSquare className="h-8 w-8 text-slate-300 mx-auto" /><p className="text-sm text-slate-500 mt-2">No tickets match these filters.</p></div>}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500"><span>{filtered.length} tickets</span><span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> Queue updates locally</span></div>
      </div>
    </div>
  );
}
