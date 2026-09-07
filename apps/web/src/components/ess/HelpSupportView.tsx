import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  LifeBuoy,
  Loader2,
  Search,
  Ticket,
} from 'lucide-react';
import type {
  KbArticleListItem,
  KbArticleRecord,
  SupportTicketPriority,
  SupportTicketRecord,
  SupportTicketStatus,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import {
  ApiError,
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  Label,
  Modal,
  Select,
  Textarea,
} from '@hrm/portal-ui';
import {
  createSupportTicket,
  getKbArticle,
  listKbArticles,
  listSupportTickets,
} from '@/lib/support-api';

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

export function HelpSupportView() {
  const { t } = useAppTranslation();
  const [query, setQuery] = useState('');
  const [articles, setArticles] = useState<KbArticleListItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<KbArticleRecord | null>(null);
  const [ticketModal, setTicketModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<SupportTicketPriority>('medium');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [arts, tix] = await Promise.all([
        listKbArticles({ search: query.trim() || undefined }),
        listSupportTickets(),
      ]);
      setArticles(arts);
      setTickets(tix);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.loadHelp'));
    } finally {
      setLoading(false);
    }
  }, [query, t]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  const openArticle = async (articleId: string) => {
    try {
      setSelectedArticle(await getKbArticle(articleId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.loadArticle'));
    }
  };

  const submitTicket = async (event: FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      await createSupportTicket({
        subject: subject.trim(),
        description: description.trim(),
        priority,
      });
      setSubmitted(true);
      setSubject('');
      setDescription('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.submitTicket'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && articles.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-accent-600" />
            {t('support.helpSupport')}
          </h2>
          <p className="text-sm text-secondary">{t('support.helpSupportSubtitle')}</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => { setSubmitted(false); setTicketModal(true); }}>
          <Ticket className="h-4 w-4" /> {t('support.newTicket')}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('support.searchArticles')}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-primary">{t('support.knowledgeBase')}</h3>
          {articles.map((article) => (
            <Card key={article.id}>
              <CardBody className="p-4">
                <Badge tone="accent" className="mb-2">{article.categoryName}</Badge>
                <button
                  type="button"
                  className="text-left text-sm font-semibold text-primary hover:text-accent-700"
                  onClick={() => void openArticle(article.id)}
                >
                  {article.title}
                </button>
                <p className="mt-1 text-xs text-secondary">{article.summary}</p>
              </CardBody>
            </Card>
          ))}
          {articles.length === 0 && (
            <p className="text-sm text-secondary">{t('support.noArticles')}</p>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-primary">{t('support.myTickets')}</h3>
          {tickets.map((ticket) => (
            <Card key={ticket.id}>
              <CardBody className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-mono text-[10px] text-muted">{ticket.ticketNumber}</p>
                  <p className="text-sm font-medium text-primary">{ticket.subject}</p>
                </div>
                <Badge tone={statusTone[ticket.status]}>
                  {t(`support.ticketStatus.${ticket.status}`)}
                </Badge>
              </CardBody>
            </Card>
          ))}
          {tickets.length === 0 && (
            <p className="text-sm text-secondary">{t('support.noTickets')}</p>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(selectedArticle)}
        onClose={() => setSelectedArticle(null)}
        title={selectedArticle?.title ?? t('support.articleFallback')}
      >
        {selectedArticle && (
          <div className="space-y-2 text-sm whitespace-pre-wrap text-primary">
            <p className="text-secondary">{selectedArticle.summary}</p>
            {selectedArticle.body}
          </div>
        )}
      </Modal>

      <Modal open={ticketModal} onClose={() => setTicketModal(false)} title={t('support.newSupportTicket')}>
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="h-10 w-10 text-success-600" />
            <p className="text-sm font-semibold">{t('support.ticketSubmitted')}</p>
            <Button variant="secondary" size="sm" onClick={() => setTicketModal(false)}>{t('common.close')}</Button>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={(e) => void submitTicket(e)}>
            <div>
              <Label htmlFor="ess-ticket-subject">{t('support.subject')}</Label>
              <Input id="ess-ticket-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ess-ticket-priority">{t('support.priority')}</Label>
              <Select id="ess-ticket-priority" value={priority} onChange={(e) => setPriority(e.target.value as SupportTicketPriority)}>
                {ticketPriorities.map((key) => (
                  <option key={key} value={key}>{t(`support.ticketPriority.${key}`)}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ess-ticket-body">{t('support.description')}</Label>
              <Textarea id="ess-ticket-body" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? t('common.submitting') : t('common.submit')}
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
