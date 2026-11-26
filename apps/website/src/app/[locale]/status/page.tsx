import type { Metadata } from 'next';
import { Activity } from 'lucide-react';
import { apiClient } from '../../../api/client';
import { PublicStatusClient } from '../../../components/status/PublicStatusClient';
import { Container, Section, TranslationFallbackNotice } from '../../../components/marketing';
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
    title: dict.status.meta.title,
    description: dict.status.meta.description,
    path: '/status',
    locale,
    eyebrow: dict.status.hero.eyebrow,
  });
}

export default async function StatusPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const copy = dict.status;
  const initialData = await apiClient.system.getPublicPlatformStatus({ cache: 'no-store' });

  return (
    <>
      <Section surface="tinted" rhythm="default" className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
        <Container>
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full surface text-xs font-semibold text-[rgb(var(--text-secondary))]">
              <Activity className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
              <span>{copy.hero.eyebrow}</span>
            </span>

            <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              {copy.hero.title}
            </h1>

            <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed">
              {copy.hero.subtitle}
            </p>
          </div>
        </Container>
      </Section>

      <Section surface="base" rhythm="default">
        <Container>
          <div className="max-w-4xl mx-auto mb-8">
            <TranslationFallbackNotice
              locale={locale}
              reason="release_or_status_feed"
              basePath="/status"
            />
          </div>
          <PublicStatusClient initialData={initialData} />
        </Container>
      </Section>
    </>
  );
}
