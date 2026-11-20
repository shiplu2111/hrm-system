import {
  BookOpen,
  Calendar,
  Eye,
  FilterX,
  HelpCircle,
  Search,
  Ticket,
  X,
} from 'lucide-react';
import type { KbArticleListItem, KbCategoryRecord } from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Form';
import { formatDateTime } from '@/lib/webhooks-display';

interface MyKnowledgeBaseTabProps {
  articles: KbArticleListItem[];
  categories: KbCategoryRecord[];
  loading: boolean;
  onSelectArticle: (articleId: string) => void;
  onOpenNewTicket: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
}

export function MyKnowledgeBaseTab({
  articles,
  categories,
  loading,
  onSelectArticle,
  onOpenNewTicket,
  searchQuery,
  onSearchChange,
  selectedCategoryId,
  onCategoryChange,
}: MyKnowledgeBaseTabProps) {
  const { t } = useAppTranslation();

  return (
    <div className="space-y-6">
      {/* Search Input Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xl">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('support.searchKbPlaceholder')}
            className="pl-10 pr-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
              aria-label={t('common.clear')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category Pills Filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onCategoryChange(null)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              selectedCategoryId === null
                ? 'bg-accent-600 text-white shadow-sm'
                : 'border border-base bg-[rgb(var(--bg-surface))] text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'
            }`}
          >
            <span>{t('support.allCategories')}</span>
          </button>

          {categories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onCategoryChange(isSelected ? null : cat.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-accent-600 text-white shadow-sm'
                    : 'border border-base bg-[rgb(var(--bg-surface))] text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'
                }`}
              >
                <span>{cat.name}</span>
                {typeof cat.articleCount === 'number' && cat.articleCount > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {cat.articleCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Articles Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <Card
            key={article.id}
            className="flex flex-col transition-all hover:border-accent-300 hover:shadow-card-hover dark:hover:border-accent-700"
          >
            <CardBody className="flex flex-1 flex-col justify-between p-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="accent" className="text-[11px]">
                    {article.categoryName}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                    <Eye className="h-3 w-3" />
                    <span>{article.viewCount}</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectArticle(article.id)}
                  className="text-left text-sm font-semibold text-primary hover:text-accent-600 focus:outline-none dark:hover:text-accent-400"
                >
                  {article.title}
                </button>

                <p className="line-clamp-3 text-xs leading-relaxed text-secondary">
                  {article.summary}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-base pt-3 text-[11px] text-muted">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDateTime(article.updatedAt)}</span>
                </span>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectArticle(article.id)}
                  className="text-xs text-accent-600 hover:text-accent-700 dark:text-accent-400"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  {t('support.readArticle')}
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {articles.length === 0 && !loading && (
        <EmptyState
          icon={BookOpen}
          title={
            searchQuery || selectedCategoryId
              ? t('support.noArticlesMatching')
              : t('support.emptyKbTitle')
          }
          description={
            searchQuery || selectedCategoryId ? undefined : t('support.emptyKbDesc')
          }
          action={
            searchQuery || selectedCategoryId
              ? {
                  label: t('common.clear'),
                  onClick: () => {
                    onSearchChange('');
                    onCategoryChange(null);
                  },
                  icon: FilterX,
                }
              : {
                  label: t('support.newTicket'),
                  onClick: onOpenNewTicket,
                  icon: Ticket,
                }
          }
        />
      )}

      {/* Still Need Help Prompt Card */}
      <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-xl border border-base bg-[rgb(var(--bg-surface-raised,_var(--bg-surface))] p-5 sm:flex-row">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-primary">
              {t('support.stillNeedHelp')}
            </h4>
            <p className="text-xs text-secondary">
              {t('support.openTicketPrompt')}
            </p>
          </div>
        </div>

        <Button variant="primary" onClick={onOpenNewTicket} className="shrink-0">
          <Ticket className="h-4 w-4" />
          {t('support.newTicket')}
        </Button>
      </div>
    </div>
  );
}
