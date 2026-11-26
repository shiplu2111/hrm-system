'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Loader2, Search, X } from 'lucide-react';
import { apiClient } from '../../api/client';
import type { PublicKbArticleSummary } from '../../api/types';
import { localizePath } from '../../i18n';
import { useWebsiteI18n } from '../../i18n/client';
import { Button, LocaleLink } from '../marketing';

interface HelpSearchWidgetProps {
  initialQuery?: string;
  initialResults?: readonly PublicKbArticleSummary[] | null;
}

export function HelpSearchWidget({
  initialQuery = '',
  initialResults = null,
}: HelpSearchWidgetProps) {
  const router = useRouter();
  const { locale, t } = useWebsiteI18n();

  const [query, setQuery] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery.trim());
  const [results, setResults] = useState<readonly PublicKbArticleSummary[] | null>(initialResults);
  const [loading, setLoading] = useState(false);

  // Sync URL query updates when user submits or clears
  useEffect(() => {
    setQuery(initialQuery);
    setActiveQuery(initialQuery.trim());
    setResults(initialResults);
  }, [initialQuery, initialResults]);

  // Live debounced server-side typo-tolerant search as user types
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      if (activeQuery) {
        setActiveQuery('');
        setResults(null);
      }
      return;
    }

    if (trimmed === activeQuery && results !== null) {
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const fetched = await apiClient.knowledgeBase.listArticles({ search: trimmed });
        setResults(fetched);
        setActiveQuery(trimmed);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [activeQuery, query, results]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setActiveQuery('');
      setResults(null);
      router.push('/help');
      return;
    }

    setLoading(true);
    try {
      const fetched = await apiClient.knowledgeBase.listArticles({ search: trimmed });
      setResults(fetched);
      setActiveQuery(trimmed);
      router.replace(localizePath(`/help?q=${encodeURIComponent(trimmed)}`, locale), { scroll: false });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setActiveQuery('');
    setResults(null);
    router.replace(localizePath('/help', locale), { scroll: false });
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        role="search"
        data-testid="help-search-form"
        className="max-w-2xl mx-auto"
      >
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1 min-w-0">
            <label htmlFor="help-search-input" className="sr-only">
              {t('help.searchPlaceholder')}
            </label>
            <Search
              className="w-4 h-4 text-[rgb(var(--text-muted))] absolute left-3.5 top-3.5 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="help-search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('help.searchPlaceholder')}
              aria-label={t('help.searchPlaceholder')}
              className="w-full rounded-xl border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-surface))] pl-10 pr-10 py-3 text-sm text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
            {query && (
              <button
                type="button"
                aria-label={t('help.clearSearch')}
                onClick={handleClear}
                className="absolute right-2.5 top-2.5 p-1 rounded-md text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <Button type="submit" variant="primary" size="md" className="shrink-0">
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                {t('help.searchButton')}
              </span>
            ) : (
              t('help.searchButton')
            )}
          </Button>
        </div>
      </form>

      {/* Search Results Region */}
      {activeQuery && results !== null && (
        <div
          data-testid="help-search-results"
          className="surface rounded-2xl border border-[rgb(var(--border-base))] p-5 sm:p-6 space-y-4 shadow-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgb(var(--border-base))] pb-3">
            <h2 className="text-base sm:text-lg font-bold text-[rgb(var(--text-primary))]">
              {t('help.searchResultsHeading', { query: activeQuery })}
            </h2>
            <button
              type="button"
              onClick={handleClear}
              className="text-xs font-semibold text-primary-600 hover:underline rounded px-2 py-1"
            >
              {t('help.clearSearch')}
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-[rgb(var(--text-muted))] flex items-center gap-2 py-4">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              {t('help.searchingLabel')}
            </p>
          ) : results.length === 0 ? (
            <div className="py-4 space-y-1.5">
              <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">
                {t('help.searchNoResultsTitle')}
              </p>
              <p className="text-xs sm:text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
                {t('help.searchNoResultsBody')}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[rgb(var(--border-base))]">
              {results.map((article) => (
                <li key={article.id} className="py-3.5 first:pt-1 last:pb-1">
                  <LocaleLink
                    href={`/help/articles/${article.slug}`}
                    className="group block rounded-xl p-2 -mx-2 hover:bg-[rgb(var(--bg-hover))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary-600">
                          <BookOpen className="w-3 h-3 shrink-0" aria-hidden="true" />
                          {article.categoryName}
                        </span>
                        <h3 className="text-sm sm:text-base font-bold text-[rgb(var(--text-primary))] group-hover:text-primary-600 transition-colors">
                          {article.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-[rgb(var(--text-secondary))] line-clamp-2">
                          {article.summary}
                        </p>
                      </div>
                      <ArrowRight
                        className="w-4 h-4 text-[rgb(var(--text-muted))] group-hover:text-primary-600 shrink-0 mt-1"
                        aria-hidden="true"
                      />
                    </div>
                  </LocaleLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
