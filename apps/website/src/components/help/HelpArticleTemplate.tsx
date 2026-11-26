import Link from 'next/link';
import { ArrowRight, BookOpen, Calendar, Clock, Tag } from 'lucide-react';
import type { PublicKbArticleDetail } from '../../api/types';
import {
  DEFAULT_LOCALE,
  formatDate,
  formatNumber,
  getDictionary,
  interpolate,
  localizePath,
  type WebsiteLocale,
} from '../../i18n';
import { ButtonLink, TranslationFallbackNotice } from '../marketing';
import { HelpBreadcrumbs } from './HelpBreadcrumbs';
import { HelpFeedbackWidget } from './HelpFeedbackWidget';
import { HelpMarkdownRenderer } from './HelpMarkdownRenderer';

export function HelpArticleTemplate({
  article,
  locale = DEFAULT_LOCALE,
}: {
  article: PublicKbArticleDetail;
  locale?: WebsiteLocale;
}) {
  const dict = getDictionary(locale).help;
  const displayDate = formatDate(article.publishedAt ?? article.updatedAt, locale);

  return (
    <article data-testid="help-article-template" className="max-w-4xl mx-auto space-y-8">
      <HelpBreadcrumbs
        locale={locale}
        items={[
          { label: dict.breadcrumbs.home, href: '/' },
          { label: dict.breadcrumbs.helpCenter, href: '/help' },
          { label: article.categoryName, href: `/help/categories/${article.categorySlug}` },
          { label: article.title },
        ]}
      />

      <TranslationFallbackNotice
        locale={locale}
        reason="kb_content"
        basePath={`/help/articles/${article.slug}`}
      />

      {/* Article Header */}
      <header className="space-y-4 border-b border-[rgb(var(--border-base))] pb-6">
        <Link
          href={localizePath(`/help/categories/${article.categorySlug}`, locale)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-200 text-xs font-semibold hover:bg-primary-100 transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{article.categoryName}</span>
        </Link>

        <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
          {article.title}
        </h1>

        <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed">
          {article.summary}
        </p>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[rgb(var(--text-muted))] pt-1">
          {article.authorName && (
            <span>{interpolate(dict.articlePage.authorLabel, { author: article.authorName })}</span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
            {interpolate(dict.updatedLabel, { date: displayDate })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            {interpolate(dict.readTimeLabel, {
              minutes: formatNumber(article.readingTimeMinutes, locale),
            })}
          </span>
        </div>
      </header>

      {/* Rich Markdown Body (supports headings, step lists, images, callouts, code blocks) */}
      <div className="surface rounded-2xl border border-[rgb(var(--border-base))] p-6 sm:p-8 shadow-card">
        <HelpMarkdownRenderer source={article.body} stepLabelPrefix={dict.articlePage.stepPrefix} />

        {article.tags.length > 0 && (
          <div className="mt-8 pt-5 border-t border-[rgb(var(--border-base))] flex flex-wrap items-center gap-2">
            <Tag className="w-3.5 h-3.5 text-[rgb(var(--text-muted))]" aria-hidden="true" />
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-0.5 rounded-full bg-[rgb(var(--bg-muted))] text-xs font-medium text-[rgb(var(--text-secondary))]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Feedback Widget */}
      <HelpFeedbackWidget
        slug={article.slug}
        initialYes={article.helpfulYesCount}
        initialNo={article.helpfulNoCount}
      />

      {/* Related Public Articles */}
      {article.relatedArticles.length > 0 && (
        <section
          aria-labelledby="related-articles-heading"
          data-testid="help-related-articles"
          className="space-y-4 pt-2"
        >
          <h2
            id="related-articles-heading"
            className="text-lg sm:text-xl font-bold text-[rgb(var(--text-primary))]"
          >
            {dict.articlePage.relatedHeading}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {article.relatedArticles.map((rel) => (
              <Link
                key={rel.id}
                href={localizePath(`/help/articles/${rel.slug}`, locale)}
                className="group surface rounded-xl border border-[rgb(var(--border-base))] p-4 space-y-2 hover:border-primary-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <span className="text-[11px] font-semibold text-primary-600">
                  {rel.categoryName}
                </span>
                <h3 className="text-sm font-bold text-[rgb(var(--text-primary))] group-hover:text-primary-600 transition-colors">
                  {rel.title}
                </h3>
                <p className="text-xs text-[rgb(var(--text-secondary))] line-clamp-2">
                  {rel.summary}
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 pt-1">
                  {dict.readArticleLabel}
                  <ArrowRight className="w-3 h-3" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Existing-Customer / Private Docs Callout */}
      <div className="surface rounded-2xl border border-[rgb(var(--border-base))] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-sm sm:text-base font-bold text-[rgb(var(--text-primary))]">
            {dict.articlePage.existingCustomerTitle}
          </h2>
          <p className="text-xs sm:text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
            {dict.articlePage.existingCustomerBody}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <ButtonLink href="/contact?topic=support" variant="outline" size="sm">
            {dict.articlePage.existingCustomerCta}
          </ButtonLink>
          <ButtonLink href="/login" variant="primary" size="sm">
            {dict.articlePage.logInCta}
          </ButtonLink>
        </div>
      </div>
    </article>
  );
}
