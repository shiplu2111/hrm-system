import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  CircleHelp,
  LifeBuoy,
  Loader2,
  MessageSquarePlus,
  Minus,
  Search,
  Ticket,
} from 'lucide-react';
import type {
  KbArticleListItem,
  SupportTicketPriority,
  SupportTicketRecord,
  SupportTicketStatus,
} from '@hrm/shared-types';
import {
  SUPPORT_TICKET_PRIORITY_LABELS,
  SUPPORT_TICKET_STATUS_LABELS,
} from '@/lib/support-labels';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import {
  createSupportTicket,
  getKbArticle,
  listKbArticles,
  listSupportTickets,
} from '@/lib/support-api';
import { ApiError } from '@/lib/tenant-api-client';

type PanelTab = 'search' | 'contact' | 'tickets';

const statusTone: Record<
  SupportTicketStatus,
  'neutral' | 'accent' | 'warning' | 'success'
> = {
  open: 'accent',
  in_progress: 'warning',
  waiting: 'neutral',
  resolved: 'success',
  closed: 'neutral',
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
  const [articles, setArticles] = useState<KbArticleListItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<SupportTicketPriority>('medium');
  const [submitted, setSubmitted] = useState(false);
  const [selectedBody, setSelectedBody] = useState<string | null>(null);

  const loadArticles = useCallback(async (search?: string) => {
    try {
      const rows = await listKbArticles({ search: search?.trim() || undefined });
      setArticles(rows.slice(0, 8));
    } catch {
      setArticles([]);
    }
  }, []);

  const loadTickets = useCallback(async () => {
    try {
      const rows = await listSupportTickets();
      setTickets(rows.slice(0, 10));
    } catch {
      setTickets([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void Promise.all([loadArticles(), loadTickets()]).finally(() => setLoading(false));
  }, [open, loadArticles, loadTickets]);

  useEffect(() => {
    if (!open || tab !== 'search') return;
    const timer = setTimeout(() => void loadArticles(query), 300);
    return () => clearTimeout(timer);
  }, [open, tab, query, loadArticles]);

  const results = useMemo(() => articles, [articles]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    try {
      await createSupportTicket({
        subject: subject.trim(),
        description: description.trim(),
        priority,
      });
      setSubmitted(true);
      setSubject('');
      setDescription('');
      setPriority('medium');
      await loadTickets();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to submit ticket');
    }
  };

  const openArticle = async (articleId: string) => {
    try {
      const article = await getKbArticle(articleId);
      setSelectedBody(`${article.summary}\n\n${article.body}`);
    } catch {
      setSelectedBody('Unable to load article.');
    }
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
                <p className="text-xs text-white/80">Search articles or contact support</p>
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
            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-accent-600" />
              </div>
            )}

            {!loading && tab === 'search' && (
              <div className="space-y-3">
                {selectedBody ? (
                  <div className="space-y-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedBody(null)}>
                      ← Back
                    </Button>
                    <p className="whitespace-pre-wrap text-sm text-primary">{selectedBody}</p>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                      <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search the knowledge base"
                        className="pl-9"
                      />
                    </div>
                    <ul className="space-y-2">
                      {results.map((article) => (
                        <li key={article.id}>
                          <button
                            type="button"
                            onClick={() => void openArticle(article.id)}
                            className="w-full rounded-xl border border-base bg-[rgb(var(--bg-muted))]/50 px-3 py-2.5 text-left transition-colors hover:border-accent-200"
                          >
                            <Badge tone="accent" className="mb-1.5">
                              {article.categoryName}
                            </Badge>
                            <p className="text-sm font-medium text-primary">{article.title}</p>
                            <p className="mt-0.5 text-xs text-secondary">{article.summary}</p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {!loading && tab === 'contact' && (
              submitted ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <CheckCircle2 className="h-10 w-10 text-success-600" />
                  <p className="text-sm font-semibold text-primary">Ticket submitted</p>
                  <Button variant="secondary" size="sm" onClick={() => { setSubmitted(false); setTab('tickets'); }}>
                    View my tickets
                  </Button>
                </div>
              ) : (
                <form className="space-y-3" onSubmit={(e) => void handleSubmit(e)}>
                  <div>
                    <Label htmlFor="help-subject">Subject</Label>
                    <Input id="help-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="help-priority">Priority</Label>
                    <Select
                      id="help-priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as SupportTicketPriority)}
                    >
                      {(Object.keys(SUPPORT_TICKET_PRIORITY_LABELS) as SupportTicketPriority[]).map(
                        (key) => (
                          <option key={key} value={key}>
                            {SUPPORT_TICKET_PRIORITY_LABELS[key]}
                          </option>
                        ),
                      )}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="help-description">Description</Label>
                    <Textarea
                      id="help-description"
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <Button type="submit" variant="primary" size="sm" className="w-full">
                    Submit ticket
                  </Button>
                </form>
              )
            )}

            {!loading && tab === 'tickets' && (
              <ul className="space-y-2">
                {tickets.map((ticket) => (
                  <li
                    key={ticket.id}
                    className="rounded-xl border border-base px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-muted">{ticket.ticketNumber}</span>
                      <Badge tone={statusTone[ticket.status]}>
                        {SUPPORT_TICKET_STATUS_LABELS[ticket.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm font-medium text-primary">{ticket.subject}</p>
                  </li>
                ))}
                {tickets.length === 0 && (
                  <p className="text-center text-sm text-secondary py-6">No tickets yet.</p>
                )}
              </ul>
            )}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-600 text-white shadow-elevated transition-transform hover:scale-105"
        aria-label={open ? 'Close help' : 'Open help'}
      >
        {open ? <Minus className="h-5 w-5" /> : <CircleHelp className="h-5 w-5" />}
      </button>
    </div>
  );
}
