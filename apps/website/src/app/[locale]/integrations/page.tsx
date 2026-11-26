import type { Metadata } from 'next';
import { ArrowRight, CheckCircle2, Clock, Layers } from 'lucide-react';
import { IntegrationsDirectoryClient } from '../../../components/integrations/IntegrationsDirectoryClient';
import { ButtonLink, Container, CtaBand, Section, SectionHeader } from '../../../components/marketing';
import { getIntegrationsCatalog } from '../../../data/integrations';
import { formatNumber, getDictionary, interpolate, resolveWebsiteLocale } from '../../../i18n';
import { buildPageMetadata } from '../../../lib/seo';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  return buildPageMetadata({
    title: dict.integrations.meta.title,
    description: dict.integrations.meta.description,
    path: '/integrations',
    locale,
    eyebrow: dict.integrations.hero.eyebrow,
  });
}

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const copy = dict.integrations;
  const items = getIntegrationsCatalog();
  const liveCount = formatNumber(items.filter((item) => item.status === 'live').length, locale);
  const comingSoonCount = formatNumber(
    items.filter((item) => item.status === 'coming_soon').length,
    locale,
  );

  return (
    <>
      <Section surface="tinted" rhythm="default" className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
        <Container>
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full surface text-xs font-semibold text-[rgb(var(--text-secondary))]">
              <Layers className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
              <span>{copy.hero.eyebrow}</span>
            </span>

            <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              {copy.hero.title}
            </h1>

            <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed">
              {copy.hero.subtitle}
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <span
                data-testid="integrations-live-summary"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-50 border border-success-200 text-xs font-semibold text-success-700"
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                {interpolate(copy.hero.liveSummaryLabel, { live: liveCount })}
              </span>

              <span
                data-testid="integrations-coming-soon-summary"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700"
              >
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                {interpolate(copy.hero.comingSoonSummaryLabel, { comingSoon: comingSoonCount })}
              </span>
            </div>
          </div>
        </Container>
      </Section>

      <Section surface="base" rhythm="default">
        <Container>
          <IntegrationsDirectoryClient items={items} />
        </Container>
      </Section>

      <Section surface="surface" rhythm="default" bordered>
        <Container>
          <SectionHeader
            eyebrow={copy.architecture.eyebrow}
            title={copy.architecture.title}
            subtitle={copy.architecture.subtitle}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
            {copy.architecture.cards.map((card) => (
              <div
                key={card.title}
                className="surface rounded-2xl border border-[rgb(var(--border-base))] p-6 space-y-2.5"
              >
                <h2 className="text-base font-bold text-[rgb(var(--text-primary))]">
                  {card.title}
                </h2>
                <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <CtaBand
        tone="dark"
        eyebrow={copy.cta.eyebrow}
        title={copy.cta.title}
        description={copy.cta.description}
        actions={
          <>
            <ButtonLink
              href="/signup"
              variant="inverse"
              size="lg"
              trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
            >
              {copy.cta.primaryCta}
            </ButtonLink>
            <ButtonLink
              href="/contact?topic=partnership"
              variant="outline"
              size="lg"
              className="border-primary-400 bg-transparent text-white hover:bg-primary-800 hover:text-white"
            >
              {copy.cta.secondaryCta}
            </ButtonLink>
          </>
        }
      />
    </>
  );
}
