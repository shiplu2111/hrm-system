import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import { apiClient } from '../../../../../api/client';
import { HelpBreadcrumbs } from '../../../../../components/help/HelpBreadcrumbs';
import { Container, Section, TranslationFallbackNotice } from '../../../../../components/marketing';
import { formatNumber, getDictionary, interpolate, localizePath, resolveWebsiteLocale } from '../../../../../i18n';
import { buildPageMetadata } from '../../../../../lib/seo';

export const revalidate = 10;
export const dynamicParams = true;

export async function generateStaticParams() {
  const cats = await apiClient.knowledgeBase.listCategories({ revalidate: 10 }).catch(() => []);
  return cats.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const data = await apiClient.knowledgeBase.getCategory(slug, { revalidate: 10 });
  if (!data) {
    return buildPageMetadata({
      title: 'Help Category Not Found',
      description: 'Requested public Help Center category could not be found.',
      path: `/help/categories/${slug}`,
      locale,
      noIndex: true,
    });
  }
  return buildPageMetadata({
    title: `${data.category.name} — Help Center`,
    description: data.category.description ?? defaultDescription(data.category.name),
    path: `/help/categories/${slug}`,
    locale,
    eyebrow: 'Help Center',
  });
}

function defaultDescription(name: string): string {
  return `Public Help Center guides and walkthroughs for ${name}.`;
}

export default async function HelpCategoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale).help;
  const data = await apiClient.knowledgeBase.getCategory(slug, { revalidate: 10 });

  if (!data) {
    notFound();
  }

  return (
    <Section surface="tinted" rhythm="default" className="relative overflow-hidden">
      <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
      <Container>
        <div className="max-w-4xl mx-auto space-y-8">
          <HelpBreadcrumbs
            locale={locale}
            items={[
              { label: dict.breadcrumbs.home, href: '/' },
              { label: dict.breadcrumbs.helpCenter, href: '/help' },
              { label: data.category.name },
            ]}
          />

          <TranslationFallbackNotice
            locale={locale}
            reason="kb_content"
            basePath={`/help/categories/${slug}`}
          />

          <header className="space-y-3 border-b border-[rgb(var(--border-base))] pb-6">
            <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              {data.category.name}
            </h1>
            {data.category.description && (
              <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed">
                {data.category.description}
              </p>
            )}
          </header>

          {data.articles.length === 0 ? (
            <div className="surface rounded-2xl border border-[rgb(var(--border-base))] p-8 text-center space-y-3">
              <p className="font-semibold text-[rgb(var(--text-primary))]">
                {dict.categoryPage.emptyTitle}
              </p>
              <Link
                href={localizePath('/help', locale)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:underline"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                {dict.categoryPage.backToHelp}
              </Link>
            </div>
          ) : (
            <div data-testid="help-category-articles" className="space-y-4">
              {data.articles.map((article) => (
                <Link
                  key={article.id}
                  href={localizePath(`/help/articles/${article.slug}`, locale)}
                  className="group block surface rounded-2xl border border-[rgb(var(--border-base))] p-6 space-y-2.5 hover:border-primary-400 transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[rgb(var(--text-muted))]">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                      {interpolate(dict.readTimeLabel, {
                        minutes: formatNumber(article.readingTimeMinutes, locale),
                      })}
                    </span>
                    {article.tags.length > 0 && (
                      <span>{article.tags.slice(0, 3).join(' · ')}</span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-[rgb(var(--text-primary))] group-hover:text-primary-600 transition-colors">
                    {article.title}
                  </h2>
                  <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
                    {article.summary}
                  </p>
                  <div className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 pt-1">
                    <span>{dict.readArticleLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}
