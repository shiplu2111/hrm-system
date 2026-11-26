import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BookOpen,
  Clock,
  DollarSign,
  LifeBuoy,
  Shield,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { apiClient } from '../../../api/client';
import { HelpBreadcrumbs } from '../../../components/help/HelpBreadcrumbs';
import { HelpSearchWidget } from '../../../components/help/HelpSearchWidget';
import { ButtonLink, Container, Section } from '../../../components/marketing';
import { formatNumber, getDictionary, interpolate, localizePath, resolveWebsiteLocale } from '../../../i18n';
import { buildPageMetadata } from '../../../lib/seo';

export const revalidate = 10;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  return buildPageMetadata({
    title: dict.help.metaTitle,
    description: dict.help.metaDescription,
    path: '/help',
    locale,
    eyebrow: dict.help.eyebrow,
  });
}

function renderCategoryIcon(iconName?: string | null) {
  switch (iconName) {
    case 'Sparkles':
      return <Sparkles className="w-5 h-5" aria-hidden="true" />;
    case 'DollarSign':
      return <DollarSign className="w-5 h-5" aria-hidden="true" />;
    case 'Clock':
      return <Clock className="w-5 h-5" aria-hidden="true" />;
    case 'Shield':
      return <Shield className="w-5 h-5" aria-hidden="true" />;
    case 'Terminal':
      return <Terminal className="w-5 h-5" aria-hidden="true" />;
    default:
      return <BookOpen className="w-5 h-5" aria-hidden="true" />;
  }
}

export default async function HelpCenterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const copy = dict.help;
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams.q?.trim() ?? '';

  const [categories, articles, initialSearchResults] = await Promise.all([
    apiClient.knowledgeBase.listCategories({ revalidate: 10 }),
    apiClient.knowledgeBase.listArticles(undefined, { revalidate: 10 }),
    query
      ? apiClient.knowledgeBase.listArticles({ search: query }, { revalidate: false, cache: 'no-store' })
      : Promise.resolve(null),
  ]);

  return (
    <>
      {/* Hero + Typo-Tolerant Search */}
      <Section surface="tinted" rhythm="default" className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
        <Container>
          <div className="max-w-3xl mx-auto mb-6">
            <HelpBreadcrumbs
              locale={locale}
              items={[
                { label: copy.breadcrumbs.home, href: '/' },
                { label: copy.breadcrumbs.helpCenter },
              ]}
            />
          </div>

          <div className="max-w-3xl mx-auto text-center space-y-4 mb-8">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full surface text-xs font-semibold text-[rgb(var(--text-secondary))]">
              <BookOpen className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
              <span>{copy.eyebrow}</span>
            </span>

            <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              {copy.title}
            </h1>

            <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed">
              {copy.subtitle}
            </p>
          </div>

          <HelpSearchWidget initialQuery={query} initialResults={initialSearchResults} />
        </Container>
      </Section>

      {/* Public Categories Grid */}
      <Section rhythm="default">
        <Container className="space-y-12">
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
                {copy.categoriesHeading}
              </h2>
              <p className="text-sm sm:text-base text-[rgb(var(--text-secondary))]">
                {copy.categoriesSubtitle}
              </p>
            </div>

            {categories.length === 0 ? (
              <div className="surface rounded-2xl border border-[rgb(var(--border-base))] p-8 text-center space-y-2">
                <p className="font-semibold text-[rgb(var(--text-primary))]">{copy.emptyStateTitle}</p>
                <p className="text-sm text-[rgb(var(--text-secondary))]">{copy.emptyStateBody}</p>
              </div>
            ) : (
              <div
                data-testid="help-categories-grid"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
              >
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={localizePath(`/help/categories/${cat.slug}`, locale)}
                    data-testid={`help-category-card-${cat.slug}`}
                    className="group surface rounded-2xl border border-[rgb(var(--border-base))] p-6 space-y-3 hover:border-primary-400 transition-all shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-700">
                        {renderCategoryIcon(cat.icon)}
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[rgb(var(--bg-muted))] text-[rgb(var(--text-secondary))]">
                        {cat.articleCount === 1
                          ? interpolate(copy.articleCountSingular, { count: formatNumber(cat.articleCount, locale) })
                          : interpolate(copy.articleCountPlural, { count: formatNumber(cat.articleCount, locale) })}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-base sm:text-lg font-bold text-[rgb(var(--text-primary))] group-hover:text-primary-600 transition-colors">
                        {cat.name}
                      </h3>
                      {cat.description && (
                        <p className="text-xs sm:text-sm text-[rgb(var(--text-secondary))] leading-relaxed line-clamp-2">
                          {cat.description}
                        </p>
                      )}
                    </div>

                    <div className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 pt-1">
                      <span>{copy.readArticleLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Popular Public Guides */}
          {articles.length > 0 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
                  {copy.popularHeading}
                </h2>
                <p className="text-sm sm:text-base text-[rgb(var(--text-secondary))]">
                  {copy.popularSubtitle}
                </p>
              </div>

              <div
                data-testid="help-popular-articles"
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {articles.slice(0, 6).map((article) => (
                  <Link
                    key={article.id}
                    href={localizePath(`/help/articles/${article.slug}`, locale)}
                    data-testid={`help-article-card-${article.slug}`}
                    className="group surface rounded-2xl border border-[rgb(var(--border-base))] p-5 space-y-2 hover:border-primary-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-primary-600">{article.categoryName}</span>
                      <span className="text-[rgb(var(--text-muted))]">
                        {interpolate(copy.readTimeLabel, {
                          minutes: formatNumber(article.readingTimeMinutes, locale),
                        })}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-[rgb(var(--text-primary))] group-hover:text-primary-600 transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[rgb(var(--text-secondary))] line-clamp-2 leading-relaxed">
                      {article.summary}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Existing Customer Note */}
          <div className="surface rounded-2xl border border-primary-200 bg-primary-50/40 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center shrink-0">
                <LifeBuoy className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-bold text-[rgb(var(--text-primary))]">
                  {copy.articlePage.existingCustomerTitle}
                </h2>
                <p className="text-xs sm:text-sm text-[rgb(var(--text-secondary))] leading-relaxed max-w-2xl">
                  {copy.articlePage.existingCustomerBody}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <ButtonLink href="/contact?topic=support" variant="outline" size="sm">
                {copy.articlePage.existingCustomerCta}
              </ButtonLink>
              <ButtonLink href="/login" variant="primary" size="sm">
                {copy.articlePage.logInCta}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
