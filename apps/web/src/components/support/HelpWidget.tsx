import { useMemo, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  CircleHelp,
  FileImage,
  LifeBuoy,
  MessageSquarePlus,
  Minus,
  Search,
  Send,
  Ticket,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';

type PanelTab = 'search' | 'contact' | 'tickets';
type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
type TicketStatus = 'Open' | 'In progress' | 'Waiting' | 'Resolved';

interface KbArticle {
  id: string;
  title: string;
  category: string;
  excerpt: string;
}

interface TenantTicket {
  id: string;
  subject: string;
  status: TicketStatus;
  updated: string;
}

const kbArticles: KbArticle[] = [
  { id: 'kb-1', title: 'How to run a payroll cycle', category: 'Payroll', excerpt: 'Validate hours, lock the register, and submit for approval.' },
  { id: 'kb-2', title: 'Request leave on behalf of a teammate', category: 'Leave', excerpt: 'Managers can file a request from the employee profile.' },
  { id: 'kb-3', title: 'Fix a missed clock-in', category: 'Attendance', excerpt: 'Use regularization when a device punch is missing.' },
  { id: 'kb-4', title: 'Invite an additional HR administrator', category: 'People', excerpt: 'Roles and permissions are managed from Company Admin RBAC.' },
  { id: 'kb-5', title: 'Download a payslip PDF', category: 'Payroll', excerpt: 'Employees can export from ESS; admins can bulk-download.' },
];

const initialTickets: TenantTicket[] = [
  { id: 'T-1042', subject: 'Overtime rule not applying to night shift', status: 'In progress', updated: '2h ago' },
  { id: 'T-1038', subject: 'SSO login loop after password reset', status: 'Waiting', updated: 'Yesterday' },
  { id: 'T-1021', subject: 'Holiday calendar import failed', status: 'Resolved', updated: 'Aug 20' },
];

const statusTone: Record<TicketStatus, 'neutral' | 'accent' | 'warning' | 'success'> = {
  Open: 'accent',
  'In progress': 'warning',
  Waiting: 'neutral',
  Resolved: 'success',
};

const tabs: { id: PanelTab; label: string; icon: typeof Search }[] = [
  { id: 'search', label: 'Help', icon: Search },
  { id: 'contact', label: 'Contact', icon: MessageSquarePlus },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
];

export function HelpWidget() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PanelTab>('search');
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('Medium');
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [tickets, setTickets] = useState(initialTickets);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return kbArticles.slice(0, 4);
    return kbArticles.filter(
      (article) =>
        article.title.toLowerCase().includes(q) ||
        article.category.toLowerCase().includes(q) ||
        article.excerpt.toLowerCase().includes(q),
    );
  }, [query]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    const nextId = `T-${1043 + tickets.length}`;
    setTickets((current) => [
      { id: nextId, subject: subject.trim(), status: 'Open', updated: 'Just now' },
      ...current,
    ]);
    setSubmitted(true);
    setSubject('');
    setDescription('');
    setPriority('Medium');
    setFileName(null);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <section
          className="surface flex w-[min(100vw-2rem,380px)] max-h-[min(72vh,560px)] flex-col overflow-hidden rounded-2xl border shadow-elevated animate-scale-in"
          aria-label="Help panel"
        >
          <header className="flex items-start justify-between gap-3 border-b border-base bg-accent-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                <LifeBuoy className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">Need a hand?</p>
                <p className="text-xs text-white/80">Search articles or contact tenant support</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Minimize help panel"
            >
              <Minus className="h-4 w-4" />
            </button>
          </header>

          <nav className="grid grid-cols-3 border-b border-base bg-[rgb(var(--bg-muted))]/60">
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-b-2 border-accent-600 text-accent-700 dark:text-accent-300'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
            {tab === 'search' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search the knowledge base"
                    className="pl-9"
                    aria-label="Search knowledge base"
                  />
                </div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                  {query.trim() ? 'Matching articles' : 'Suggested articles'}
                </p>
                {results.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-base px-3 py-6 text-center text-sm text-secondary">
                    No articles match “{query}”. Try contacting support.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {results.map((article) => (
                      <li key={article.id}>
                        <button
                          type="button"
                          className="w-full rounded-xl border border-base bg-[rgb(var(--bg-muted))]/50 px-3 py-2.5 text-left transition-colors hover:border-accent-200 hover:bg-accent-50/70 dark:hover:border-accent-800 dark:hover:bg-accent-950/30"
                        >
                          <Badge tone="accent" className="mb-1.5">
                            {article.category}
                          </Badge>
                          <p className="text-sm font-medium text-primary">{article.title}</p>
                          <p className="mt-0.5 text-xs text-secondary">{article.excerpt}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === 'contact' && (
              submitted ? (
                <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-success-600 dark:bg-success-950/40 dark:text-success-300">
                    <CheckCircle2 className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-primary">Ticket submitted</p>
                    <p className="mt-1 text-xs text-secondary">
                      Our tenant support team will reply in My Tickets. This is not the platform queue.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSubmitted(false);
                      setTab('tickets');
                    }}
                  >
                    View my tickets
                  </Button>
                </div>
              ) : (
                <form className="space-y-3" onSubmit={handleSubmit}>
                  <div>
                    <Label htmlFor="help-subject">Subject</Label>
                    <Input
                      id="help-subject"
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      placeholder="Short summary of the issue"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="help-description">Description</Label>
                    <Textarea
                      id="help-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="What happened, and what did you expect?"
                      rows={4}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="help-priority">Priority</Label>
                    <Select
                      id="help-priority"
                      value={priority}
                      onChange={(event) => setPriority(event.target.value as TicketPriority)}
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                      <option>Urgent</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="help-screenshot">Screenshot</Label>
                    <label
                      htmlFor="help-screenshot"
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-strong bg-[rgb(var(--bg-muted))]/40 px-3 py-2.5 text-xs text-secondary transition-colors hover:border-accent-400 hover:text-primary"
                    >
                      <FileImage className="h-4 w-4 shrink-0 text-accent-600" />
                      <span className="truncate">{fileName ?? 'Attach a screenshot (optional)'}</span>
                    </label>
                    <input
                      id="help-screenshot"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    <Send className="h-4 w-4" />
                    Submit ticket
                  </Button>
                </form>
              )
            )}

            {tab === 'tickets' && (
              <ul className="space-y-2">
                {tickets.map((ticket) => (
                  <li
                    key={ticket.id}
                    className="rounded-xl border border-base px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono text-[11px] text-muted">{ticket.id}</p>
                      <Badge tone={statusTone[ticket.status]} dot>
                        {ticket.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm font-medium text-primary">{ticket.subject}</p>
                    <p className="mt-0.5 text-[11px] text-secondary">Updated {ticket.updated}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-600 text-white shadow-elevated transition-transform hover:scale-105 hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50"
        aria-expanded={open}
        aria-label={open ? 'Close help' : 'Open help'}
      >
        {open ? <X className="h-6 w-6" /> : <CircleHelp className="h-6 w-6" />}
      </button>
    </div>
  );
}
