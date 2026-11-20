import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Plus,
  Ticket,
} from 'lucide-react';
import type {
  KbArticleListItem,
  KbCategoryRecord,
  SupportTicketDetail,
  SupportTicketRecord,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { CreateSupportTicketModal } from '@/components/my/support/CreateSupportTicketModal';
import { KbArticleReaderModal } from '@/components/my/support/KbArticleReaderModal';
import { MyKnowledgeBaseTab } from '@/components/my/support/MyKnowledgeBaseTab';
import { MySupportTicketsTab } from '@/components/my/support/MySupportTicketsTab';
import { SupportTicketDetailModal } from '@/components/my/support/SupportTicketDetailModal';
import { Button } from '@/components/ui/Button';
import {
  listKbArticles,
  listKbCategories,
  listSupportTickets,
} from '@/lib/support-api';
import { ApiError } from '@/lib/tenant-api-client';

type ActiveTab = 'tickets' | 'kb';

export function HelpSupportView() {
  const { t } = useAppTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = searchParams.get('tab') === 'kb' ? 'kb' : 'tickets';
  const initialTicketId = searchParams.get('ticket');

  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [categories, setCategories] = useState<KbCategoryRecord[]>([]);
  const [articles, setArticles] = useState<KbArticleListItem[]>([]);

  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingKb, setLoadingKb] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modals state
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(initialTicketId);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  // KB search state
  const [kbQuery, setKbQuery] = useState('');
  const [kbCategory, setKbCategory] = useState<string | null>(null);

  // Load tickets
  const loadTickets = useCallback(async () => {
    try {
      const rows = await listSupportTickets();
      setTickets(rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.loadHelp'));
    } finally {
      setLoadingTickets(false);
    }
  }, [t]);

  // Load KB categories
  const loadCategories = useCallback(async () => {
    try {
      const cats = await listKbCategories();
      setCategories(cats);
    } catch {
      // Non-fatal, category filter will simply be empty
    }
  }, []);

  // Load KB articles
  const loadArticles = useCallback(async () => {
    setLoadingKb(true);
    try {
      const arts = await listKbArticles({
        search: kbQuery.trim() || undefined,
        categoryId: kbCategory || undefined,
      });
      setArticles(arts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.loadHelp'));
    } finally {
      setLoadingKb(false);
    }
  }, [kbQuery, kbCategory, t]);

  // Initial data loading
  useEffect(() => {
    void loadTickets();
    void loadCategories();
  }, [loadTickets, loadCategories]);

  // Debounced load articles on query / category change
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadArticles();
    }, kbQuery ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadArticles, kbQuery]);

  // Sync URL search params with active tab and selected ticket
  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === 'kb') {
          next.set('tab', 'kb');
        } else {
          next.delete('tab');
        }
        return next;
      },
      { replace: true },
    );
  };

  const handleSelectTicket = (ticketId: string | null) => {
    setSelectedTicketId(ticketId);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (ticketId) {
          next.set('ticket', ticketId);
        } else {
          next.delete('ticket');
        }
        return next;
      },
      { replace: true },
    );
  };

  const handleTicketCreated = (ticket: SupportTicketDetail) => {
    setIsNewTicketOpen(false);
    setNotice(t('support.ticketCreatedSuccess'));
    void loadTickets();
    setActiveTab('tickets');
    handleSelectTicket(ticket.id);
  };

  const isInitialLoading = loadingTickets && loadingKb && tickets.length === 0 && articles.length === 0;

  if (isInitialLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Notices */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:border-error-800 dark:bg-error-950/30 dark:text-error-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p>{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs text-error-600 hover:text-error-800 dark:text-error-400"
          >
            {t('common.dismiss')}
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-center gap-2.5 rounded-lg border border-success-200 bg-success-50 p-4 text-sm text-success-800 dark:border-success-800 dark:bg-success-950/30 dark:text-success-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600 dark:text-success-400" />
          <span className="flex-1 font-medium">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs text-success-700 hover:text-success-900 dark:text-success-300"
          >
            {t('common.dismiss')}
          </button>
        </div>
      )}

      {/* Tabs and Top Action Navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-base pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleTabChange('tickets')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === 'tickets'
                ? 'bg-accent-600 text-white shadow-sm'
                : 'text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'
            }`}
          >
            <Ticket className="h-4 w-4" />
            <span>{t('support.tabTickets')}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                activeTab === 'tickets'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {tickets.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('kb')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === 'kb'
                ? 'bg-accent-600 text-white shadow-sm'
                : 'text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>{t('support.tabKnowledgeBase')}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                activeTab === 'kb'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {articles.length}
            </span>
          </button>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsNewTicketOpen(true)}
          className="self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          {t('support.newTicket')}
        </Button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'tickets' ? (
        <MySupportTicketsTab
          tickets={tickets}
          loading={loadingTickets}
          onOpenNewTicket={() => setIsNewTicketOpen(true)}
          onSelectTicket={handleSelectTicket}
          selectedTicketId={selectedTicketId}
        />
      ) : (
        <MyKnowledgeBaseTab
          articles={articles}
          categories={categories}
          loading={loadingKb}
          onSelectArticle={(id) => setSelectedArticleId(id)}
          onOpenNewTicket={() => setIsNewTicketOpen(true)}
          searchQuery={kbQuery}
          onSearchChange={setKbQuery}
          selectedCategoryId={kbCategory}
          onCategoryChange={setKbCategory}
        />
      )}

      {/* Modals */}
      <CreateSupportTicketModal
        open={isNewTicketOpen}
        onClose={() => setIsNewTicketOpen(false)}
        onSuccess={handleTicketCreated}
      />

      <SupportTicketDetailModal
        ticketId={selectedTicketId}
        open={Boolean(selectedTicketId)}
        onClose={() => handleSelectTicket(null)}
        onTicketUpdated={loadTickets}
      />

      <KbArticleReaderModal
        articleId={selectedArticleId}
        open={Boolean(selectedArticleId)}
        onClose={() => setSelectedArticleId(null)}
        onOpenTicketModal={() => setIsNewTicketOpen(true)}
      />
    </div>
  );
}
