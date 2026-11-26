'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Sparkles, Wrench } from 'lucide-react';
import type { ChangelogEntry, ChangelogTag } from '../../lib/changelog';
import { formatDate, formatNumber, localizePath, type WebsiteLocale } from '../../i18n';
import { useWebsiteI18n } from '../../i18n/client';
import { BlogSubscribeBox } from '../blog/BlogSubscribeBox';
import { SafeHtmlContent } from '../cms/SafeHtmlContent';

interface ProductUpdatesClientProps {
  entries: readonly ChangelogEntry[];
}

const VALID_TAGS: readonly ChangelogTag[] = ['New', 'Improved', 'Fixed'];

const TAG_STYLES: Record<
  ChangelogTag,
  { badge: string; icon: typeof Sparkles }
> = {
  New: {
    badge: 'bg-success-50 text-success-700 border-success-200',
    icon: Sparkles,
  },
  Improved: {
    badge: 'bg-primary-50 text-primary-700 border-primary-200',
    icon: CheckCircle2,
  },
  Fixed: {
    badge: 'bg-warning-50 text-warning-700 border-warning-200',
    icon: Wrench,
  },
};

function parseTagParam(raw: string | null): ChangelogTag | 'all' {
  if (!raw) return 'all';
  const match = VALID_TAGS.find((t) => t.toLowerCase() === raw.trim().toLowerCase());
  return match ?? 'all';
}

function formatEntryDate(isoDate: string, locale: WebsiteLocale): string {
  return formatDate(`${isoDate}T00:00:00Z`, locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function ProductUpdatesClient({ entries }: ProductUpdatesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, t } = useWebsiteI18n();

  const [selectedTag, setSelectedTag] = useState<ChangelogTag | 'all'>(() =>
    parseTagParam(searchParams.get('tag')),
  );

  const countsByTag = useMemo(() => {
    const counts: Record<ChangelogTag, number> = { New: 0, Improved: 0, Fixed: 0 };
    for (const item of entries) {
      counts[item.tag] = (counts[item.tag] ?? 0) + 1;
    }
    return counts;
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const base =
      selectedTag === 'all' ? entries : entries.filter((entry) => entry.tag === selectedTag);
    return [...base].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries, selectedTag]);

  const handleSelectTag = (next: ChangelogTag | 'all') => {
    setSelectedTag(next);
    const url = localizePath(
      next === 'all' ? '/changelog' : `/changelog?tag=${encodeURIComponent(next)}`,
      locale,
    );
    router.replace(url, { scroll: false });
  };

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      {/* Tag Filters */}
      <div
        data-testid="changelog-tag-filters"
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label={t('changelog.filterAllLabel')}
      >
        <button
          type="button"
          data-testid="changelog-filter-all"
          aria-pressed={selectedTag === 'all'}
          onClick={() => handleSelectTag('all')}
          className={`px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
            selectedTag === 'all'
              ? 'border-primary-600 bg-primary-600 text-white'
              : 'border-[rgb(var(--border-base))] surface text-[rgb(var(--text-secondary))] hover:border-primary-400'
          }`}
        >
          {t('changelog.filterAllLabel')} ({formatNumber(entries.length, locale)})
        </button>

        {VALID_TAGS.map((tag) => {
          const active = selectedTag === tag;
          return (
            <button
              key={tag}
              type="button"
              data-testid={`changelog-filter-${tag.toLowerCase()}`}
              aria-pressed={active}
              onClick={() => handleSelectTag(tag)}
              className={`px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                active
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : 'border-[rgb(var(--border-base))] surface text-[rgb(var(--text-secondary))] hover:border-primary-400'
              }`}
            >
              {t(`changelog.tags.${tag}`)} ({formatNumber(countsByTag[tag], locale)})
            </button>
          );
        })}
      </div>

      {/* Reverse-Chronological Entries */}
      {filteredEntries.length === 0 ? (
        <div className="surface rounded-2xl border border-[rgb(var(--border-base))] p-8 text-center space-y-3">
          <p className="text-sm font-medium text-[rgb(var(--text-secondary))]">
            {t('changelog.emptyForTag')}
          </p>
          <button
            type="button"
            onClick={() => handleSelectTag('all')}
            className="text-xs font-semibold text-primary-600 hover:underline"
          >
            {t('changelog.showAllLabel')}
          </button>
        </div>
      ) : (
        <ol data-testid="changelog-entries-list" className="space-y-6">
          {filteredEntries.map((entry) => {
            const style = TAG_STYLES[entry.tag];
            const Icon = style.icon;
            return (
              <li
                key={entry.id}
                id={entry.slug}
                data-testid={`changelog-entry-${entry.id}`}
                data-tag={entry.tag}
                data-date={entry.date}
                className="surface rounded-2xl border border-[rgb(var(--border-base))] p-6 sm:p-8 shadow-card space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${style.badge}`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      {t(`changelog.tags.${entry.tag}`)}
                    </span>
                    {entry.area && (
                      <span className="text-xs font-medium text-[rgb(var(--text-muted))]">
                        {entry.area}
                      </span>
                    )}
                  </div>

                  <time
                    dateTime={entry.date}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[rgb(var(--text-muted))]"
                  >
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    {formatEntryDate(entry.date, locale)}
                  </time>
                </div>

                <div className="space-y-3">
                  <h2 className="text-lg sm:text-xl font-bold text-[rgb(var(--text-primary))]">
                    {entry.title}
                  </h2>
                  {entry.contentHtml ? (
                    <SafeHtmlContent
                      html={entry.contentHtml}
                      className="prose prose-slate dark:prose-invert max-w-none text-sm sm:text-base text-[rgb(var(--text-secondary))] leading-relaxed prose-p:my-2 prose-ul:my-2 prose-li:my-0.5"
                    />
                  ) : (
                    <>
                      {entry.summary && (
                        <p className="text-sm sm:text-base text-[rgb(var(--text-secondary))] leading-relaxed">
                          {entry.summary}
                        </p>
                      )}
                      {entry.details.length > 0 && (
                        <ul className="space-y-1.5 pl-5 list-disc text-xs sm:text-sm text-[rgb(var(--text-secondary))] leading-relaxed pt-1">
                          {entry.details.map((detail) => (
                            <li key={detail}>{detail}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="text-center text-xs text-[rgb(var(--text-muted))]">
        {t('changelog.shippedNote')}
      </p>

      <div className="max-w-2xl mx-auto">
        <BlogSubscribeBox channel="changelog" />
      </div>
    </div>
  );
}
