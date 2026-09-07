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
import { useAppTranslation } from '@hrm/i18n';
import {
  ApiError,
  Badge,
  Button,
  Input,
  Label,
  Select,
  Textarea,
} from '@hrm/portal-ui';
import {
  createSupportTicket,
  getKbArticle,
  listKbArticles,
  listSupportTickets,
} from '@/lib/support-api';

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

const ticketPriorities: SupportTicketPriority[] = ['low', 'medium', 'high', 'urgent'];

export function HelpWidget() {
  const { t } = useAppTranslation();
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

  const tabs = useMemo(
    () =>
      [
        { id: 'search' as const, label: t('support.help'), icon: Search },
        { id: 'contact' as const, label: t('support.contact'), icon: MessageSquarePlus },
        { id: 'tickets' as const, label: t('support.tickets'), icon: Ticket },
      ] satisfies { id: PanelTab; label: string; icon: typeof Search }[],
    [t],
  );

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
      alert(err instanceof ApiError ? err.message : t('errors.submitTicket'));
    }
  };

  const openArticle = async (articleId: string) => {
    try {
      const article = await getKbArticle(articleId);
      setSelectedBody(`${article.summary}\n\n${article.body}`);
    } catch {
      setSelectedBody(t('support.unableLoadArticle'));
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <section className="surface flex w-[min(100vw-2rem,380px)] max-h-[min(72vh,560px)] flex-col overflow-hidden rounded-2xl border shadow-elevated">
          <header className="flex items-start justify-between gap-3 border-b border-base bg-accent-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <LifeBuoy className="h-5 w-5" />
              <div>
                <p className="text-sm font-semibold">{t('support.needHelp')}</p>
                <p className="text-xs text-white/80">{t('support.needHelpSubtitle')}</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')}>
              <Minus className="h-4 w-4" />
            </button>
          </header>

          <nav className="grid grid-cols-3 border-b border-base">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`py-2 text-xs font-semibold ${tab === item.id ? 'text-accent-700 border-b-2 border-accent-600' : 'text-secondary'}`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-y-auto p-4">
            {loading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent-600" />}

            {!loading && tab === 'search' && (
              selectedBody ? (
                <div className="space-y-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedBody(null)}>
                    ← {t('common.back')}
                  </Button>
                  <p className="whitespace-pre-wrap text-sm">{selectedBody}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('support.searchArticlesShort')}
                  />
                  <ul className="space-y-2">
                    {results.map((article) => (
                      <li key={article.id}>
                        <button type="button" onClick={() => void openArticle(article.id)} className="w-full rounded-lg border p-3 text-left text-sm">
                          <Badge tone="accent" className="mb-1">{article.categoryName}</Badge>
                          <p className="font-medium">{article.title}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}

            {!loading && tab === 'contact' && (
              submitted ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-success-600" />
                  <p className="mt-2 text-sm font-semibold">{t('support.ticketSubmitted')}</p>
                </div>
              ) : (
                <form className="space-y-3" onSubmit={(e) => void handleSubmit(e)}>
                  <div>
                    <Label>{t('support.subject')}</Label>
                    <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t('support.priority')}</Label>
                    <Select value={priority} onChange={(e) => setPriority(e.target.value as SupportTicketPriority)}>
                      {ticketPriorities.map((key) => (
                        <option key={key} value={key}>{t(`support.ticketPriority.${key}`)}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>{t('support.description')}</Label>
                    <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
                  </div>
                  <Button type="submit" variant="primary" size="sm" className="w-full">{t('common.submit')}</Button>
                </form>
              )
            )}

            {!loading && tab === 'tickets' && (
              <ul className="space-y-2">
                {tickets.map((ticket) => (
                  <li key={ticket.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-mono text-[10px] text-muted">{ticket.ticketNumber}</span>
                      <Badge tone={statusTone[ticket.status]}>{t(`support.ticketStatus.${ticket.status}`)}</Badge>
                    </div>
                    <p className="mt-1 font-medium">{ticket.subject}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((c) => !c)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-600 text-white shadow-lg"
        aria-label={t('support.widgetHelp')}
      >
        {open ? <Minus className="h-5 w-5" /> : <CircleHelp className="h-5 w-5" />}
      </button>
    </div>
  );
}
