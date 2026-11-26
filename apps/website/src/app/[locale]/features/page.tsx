import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { FEATURE_ICON_MAP } from '../../../components/features/FeatureDetailTemplate';
import {
  ButtonLink,
  Container,
  CtaBand,
  FeatureCard,
  Hero,
  Section,
  SectionHeader,
} from '../../../components/marketing';
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
    title: dict.features.overview.metaTitle,
    description: dict.features.overview.metaDescription,
    path: '/features',
    locale,
    eyebrow: dict.features.overview.eyebrow,
  });
}

export default async function FeaturesOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const t = createTranslator(dict);
  const allPages = Object.values(dict.features.pages);

  const livePages = allPages.filter((p) => p.phaseStatus === 'live');
  const upcomingPages = allPages.filter((p) => p.phaseStatus === 'coming_soon');

  return (
    <>
      <Hero
        layout="centered"
        eyebrow={t('features.overview.eyebrow')}
        title={t('features.overview.title')}
        subtitle={t('features.overview.subtitle')}
        actions={
          <>
            <ButtonLink
              href={`/signup`}
              variant="primary"
              size="lg"
              trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
            >
              {t('features.overview.cta.primaryLabel')}
            </ButtonLink>
            <ButtonLink href="/demo" variant="outline" size="lg">
              {t('features.overview.cta.secondaryLabel')}
            </ButtonLink>
          </>
        }
      />

      {/* Live MVP Features (Phase 1) */}
      <Section surface="surface" rhythm="default" bordered>
        <Container>
          <SectionHeader
            align="left"
            eyebrow={t('features.overview.badgeLive')}
            title={t('features.overview.liveGroupHeading')}
            subtitle={t('features.overview.liveGroupSubtitle')}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {livePages.map((spec) => {
              const Icon = FEATURE_ICON_MAP[spec.slug];
              return (
                <FeatureCard
                  key={spec.slug}
                  icon={<Icon className="w-6 h-6" aria-hidden="true" />}
                  title={spec.title}
                  description={spec.summary}
                  badge={{ label: t('features.overview.badgeLive'), tone: 'success' }}
                  bullets={spec.whoItIsFor.outcomes}
                  href={`/features/${spec.slug}`}
                  ctaLabel={t('features.overview.exploreFeatureCta')}
                />
              );
            })}
          </div>
        </Container>
      </Section>

      {/* Upcoming Roadmap Features (Phase 2 — Coming soon) */}
      <Section surface="muted" rhythm="default" bordered>
        <Container>
          <SectionHeader
            align="left"
            eyebrow={t('features.overview.badgeComingSoon')}
            title={t('features.overview.upcomingGroupHeading')}
            subtitle={t('features.overview.upcomingGroupSubtitle')}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {upcomingPages.map((spec) => {
              const Icon = FEATURE_ICON_MAP[spec.slug];
              return (
                <FeatureCard
                  key={spec.slug}
                  icon={<Icon className="w-6 h-6" aria-hidden="true" />}
                  title={spec.title}
                  description={spec.summary}
                  badge={{ label: t('features.overview.badgeComingSoon'), tone: 'warning' }}
                  bullets={spec.whoItIsFor.outcomes}
                  href={`/features/${spec.slug}`}
                  ctaLabel={t('features.overview.previewRoadmapCta')}
                />
              );
            })}
          </div>
        </Container>
      </Section>

      <CtaBand
        tone="dark"
        eyebrow={t('features.overview.cta.eyebrow')}
        title={t('features.overview.cta.title')}
        description={t('features.overview.cta.description')}
        actions={
          <>
            <ButtonLink
              href={`/signup`}
              variant="inverse"
              size="lg"
              trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
            >
              {t('features.overview.cta.primaryLabel')}
            </ButtonLink>
            <ButtonLink
              href="/demo"
              variant="outline"
              size="lg"
              className="border-primary-400 bg-transparent text-white hover:bg-primary-800 hover:text-white"
            >
              {t('features.overview.cta.secondaryLabel')}
            </ButtonLink>
          </>
        }
        footnote={dict.home.cta.footnote}
      />
    </>
  );
}
