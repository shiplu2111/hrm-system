import type { Metadata } from 'next';
import { ArrowRight, Globe2 } from 'lucide-react';
import {
  ButtonLink,
  Container,
  CtaBand,
  FeatureCard,
  Hero,
  Section,
  SectionHeader,
} from '../../../components/marketing';
import { SOLUTION_ICON_MAP } from '../../../components/solutions/SolutionSegmentTemplate';
import { createTranslator, getDictionary, resolveWebsiteLocale } from '../../../i18n';
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
    title: dict.solutions.overview.metaTitle,
    description: dict.solutions.overview.metaDescription,
    path: '/solutions',
    locale,
    eyebrow: dict.solutions.overview.eyebrow,
  });
}

export default async function SolutionsOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const t = createTranslator(dict);
  const segments = Object.values(dict.solutions.segments);
  const sizeSegments = segments.filter((s) => s.category === 'company_size');
  const workforceSegments = segments.filter((s) => s.category === 'workforce_type');

  return (
    <>
      <Hero
        layout="centered"
        eyebrow={t('solutions.overview.eyebrow')}
        title={t('solutions.overview.title')}
        subtitle={t('solutions.overview.subtitle')}
        actions={
          <>
            <ButtonLink
              href={`/signup`}
              variant="primary"
              size="lg"
              trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
            >
              {t('home.hero.primaryCta')}
            </ButtonLink>
            <ButtonLink href="/solutions/countries" variant="outline" size="lg">
              {t('solutions.overview.countryBannerCta')}
            </ButtonLink>
          </>
        }
      />

      {/* By Company Size */}
      <Section surface="surface" rhythm="default" bordered>
        <Container>
          <SectionHeader
            align="left"
            title={t('solutions.overview.sizeHeading')}
            subtitle={t('solutions.overview.sizeSubtitle')}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {sizeSegments.map((seg) => {
              const Icon = SOLUTION_ICON_MAP[seg.slug];
              return (
                <FeatureCard
                  key={seg.slug}
                  icon={<Icon className="w-6 h-6" aria-hidden="true" />}
                  title={seg.title}
                  description={seg.summary}
                  badge={{ label: seg.categoryLabel, tone: 'primary' }}
                  bullets={seg.whoItIsFor.highlights}
                  href={`/solutions/${seg.slug}`}
                  ctaLabel={t('solutions.overview.exploreCta')}
                />
              );
            })}
          </div>
        </Container>
      </Section>

      {/* By Workforce & Industry Pattern */}
      <Section surface="base" rhythm="default" bordered>
        <Container>
          <SectionHeader
            align="left"
            title={t('solutions.overview.workforceHeading')}
            subtitle={t('solutions.overview.workforceSubtitle')}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {workforceSegments.map((seg) => {
              const Icon = SOLUTION_ICON_MAP[seg.slug];
              return (
                <FeatureCard
                  key={seg.slug}
                  icon={<Icon className="w-6 h-6" aria-hidden="true" />}
                  title={seg.title}
                  description={seg.summary}
                  badge={{ label: seg.categoryLabel, tone: 'secondary' }}
                  bullets={seg.whoItIsFor.highlights}
                  href={`/solutions/${seg.slug}`}
                  ctaLabel={t('solutions.overview.exploreCta')}
                />
              );
            })}
          </div>

          {/* Country Solutions Link Card */}
          <div className="mt-12 rounded-xl border border-primary-200 bg-primary-50/60 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary-700">
                <Globe2 className="w-4 h-4" aria-hidden="true" />
                <span>{t('countries.index.eyebrow')}</span>
              </div>
              <h3 className="text-xl font-semibold text-[rgb(var(--text-primary))]">
                {t('solutions.overview.countryBannerTitle')}
              </h3>
              <p className="text-sm sm:text-base text-[rgb(var(--text-secondary))]">
                {t('solutions.overview.countryBannerDesc')}
              </p>
            </div>
            <div className="shrink-0">
              <ButtonLink
                href="/solutions/countries"
                variant="outline"
                size="md"
                trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
              >
                {t('solutions.overview.countryBannerCta')}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </Section>

      <CtaBand
        tone="dark"
        eyebrow={t('home.cta.eyebrow')}
        title={t('home.cta.title')}
        description={t('home.cta.description')}
        actions={
          <>
            <ButtonLink
              href={`/signup`}
              variant="inverse"
              size="lg"
              trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
            >
              {t('home.cta.primaryButton')}
            </ButtonLink>
            <ButtonLink
              href="/demo"
              variant="outline"
              size="lg"
              className="border-primary-400 bg-transparent text-white hover:bg-primary-800 hover:text-white"
            >
              {t('home.cta.secondaryButton')}
            </ButtonLink>
          </>
        }
        footnote={t('home.cta.footnote')}
      />
    </>
  );
}
