import { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  Eye,
  Loader2,
  Ticket,
} from 'lucide-react';
import type { KbArticleRecord } from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { KbMarkdown } from '@/components/support/KbMarkdown';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { getKbArticle } from '@/lib/support-api';
import { ApiError } from '@/lib/tenant-api-client';
import { formatDateTime } from '@/lib/webhooks-display';

interface KbArticleReaderModalProps {
  articleId: string | null;
  open: boolean;
  onClose: () => void;
  onOpenTicketModal: () => void;
}

export function KbArticleReaderModal({
  articleId,
  open,
  onClose,
  onOpenTicketModal,
}: KbArticleReaderModalProps) {
  const { t } = useAppTranslation();
  const [article, setArticle] = useState<KbArticleRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !articleId) {
      setArticle(null);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    getKbArticle(articleId)
      .then((data) => {
        if (active) setArticle(data);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof ApiError ? err.message : t('errors.loadArticle'));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, articleId, t]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={article ? article.title : t('support.knowledgeBase')}
      size="xl"
    >
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent-600" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-error-200 bg-error-50 p-4 text-center text-sm text-error-700 dark:border-error-800 dark:bg-error-950/30 dark:text-error-300">
          <AlertCircle className="mx-auto mb-2 h-6 w-6" />
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={onClose} className="mt-3">
            {t('common.close')}
          </Button>
        </div>
      ) : article ? (
        <div className="space-y-5">
          {/* Article Header & Metadata */}
          <div className="border-b border-base pb-3">
            <h2 className="text-xl font-bold tracking-tight text-primary">
              {article.title}
            </h2>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-secondary">
              {article.categoryName && (
                <Badge tone="accent">{article.categoryName}</Badge>
              )}

              <span className="inline-flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-muted" />
                <span>
                  {t(article.viewCount === 1 ? 'support.views' : 'support.views_other', {
                    count: article.viewCount,
                  })}
                </span>
              </span>

              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted" />
                <span>
                  {t('support.lastUpdatedOn')}: {formatDateTime(article.updatedAt)}
                </span>
              </span>
            </div>

            {article.summary && (
              <p className="mt-3 rounded-lg border-l-4 border-accent-500 bg-accent-50/50 p-3 text-xs leading-relaxed text-secondary dark:bg-accent-950/20">
                {article.summary}
              </p>
            )}
          </div>

          {/* Article Content */}
          <div className="max-h-[55vh] overflow-y-auto pr-1">
            <KbMarkdown source={article.body} />
          </div>

          {/* Still Need Help Footer Banner */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-base bg-[rgb(var(--bg-surface-raised,_var(--bg-surface))] p-4">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-primary">
                {t('support.stillNeedHelp')}
              </p>
              <p className="text-xs text-secondary">
                {t('support.openTicketPrompt')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onOpenTicketModal();
              }}
            >
              <Ticket className="h-3.5 w-3.5" />
              {t('support.newTicket')}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
