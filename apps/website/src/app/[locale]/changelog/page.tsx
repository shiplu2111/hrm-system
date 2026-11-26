import { Suspense } from 'react';
import type { Metadata } from 'next';
import { History, Rss } from 'lucide-react';
import { ProductUpdatesClient } from '../../../components/changelog/ProductUpdatesClient';
import { Container, Section, TranslationFallbackNotice } from '../../../components/marketing';
import { fetchPublishedChangelogEntries } from '../../../lib/changelog';
import { getDictionary, resolveWebsiteLocale } from '../../../i18n';
import { buildPageMetadata } from '../../../lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  return buildPageMetadata({
    title: dict.changelog.metaTitle,
    description: dict.changelog.metaDescription,
    path: '/changelog',
    locale,
    eyebrow: dict.changelog.eyebrow,
    alternatesTypes: {
      'application/rss+xml': '/changelog/rss.xml',
    },
  });
}

export default async function ChangelogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const copy = dict.changelog;
  const entries = await fetchPublishedChangelogEntries(locale);
  const showFallbackNotice = locale === 'bn' && entries.some((e) => e.fallbackUsed);

  return (
    <>
      <Section surface="tinted" rhythm="default" className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
        <Container>
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full surface text-xs font-semibold text-[rgb(var(--text-secondary))]">
              <History className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
              <span>{copy.eyebrow}</span>
            </span>

            <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              {copy.title}
            </h1>

            <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed">
              {copy.subtitle}
            </p>

            <div className="pt-1">
              <a
                href="/changelog/rss.xml"
                data-testid="changelog-rss-link"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[rgb(var(--border-base))] surface text-xs font-semibold text-[rgb(var(--text-primary))] hover:border-primary-400 transition-colors"
              >
                <Rss className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
                <span>{copy.rssLabel}</span>
              </a>
            </div>
          </div>
        </Container>
      </Section>

      <Section rhythm="default">
        <Container>
          {showFallbackNotice && (
            <div className="max-w-4xl mx-auto mb-8">
              <TranslationFallbackNotice
                locale={locale}
                reason="release_or_status_feed"
                basePath="/changelog"
              />
            </div>
          )}
          <Suspense fallback={null}>
            <ProductUpdatesClient entries={entries} />
          </Suspense>
        </Container>
      </Section>
    </>
  );
}
