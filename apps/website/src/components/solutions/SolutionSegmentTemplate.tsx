import {
  ArrowRight,
  Building,
  Building2,
  Check,
  ChevronRight,
  Clock,
  Layers,
  MapPin,
  Store,
} from 'lucide-react';
import type { WebsiteDictionary } from '../../i18n';
import type { SolutionSegmentSpec, SolutionSlug } from '../../i18n/dictionaries/solutions.en';
import { FEATURE_ICON_MAP } from '../features/FeatureDetailTemplate';
import { ButtonLink, Container, CtaBand, FeatureCard, LocaleLink, Section, SectionHeader } from '../marketing';

export const SOLUTION_ICON_MAP: Record<SolutionSlug, typeof Building2> = {
  'small-business': Store,
  'growing-teams': Building,
  'multi-branch': Building2,
  'shift-based': Clock,
  'field-workforce': MapPin,
};

interface SolutionSegmentTemplateProps {
  spec: SolutionSegmentSpec;
  dict: WebsiteDictionary;
}

export function SolutionSegmentTemplate({ spec, dict }: SolutionSegmentTemplateProps) {
  const labels = dict.solutions.template;
  const Icon = SOLUTION_ICON_MAP[spec.slug] ?? Layers;

  return (
    <>
      {/* 1. Segment Hero */}
      <Section surface="base" rhythm="default" bordered className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
        <Container>
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="mb-6 flex flex-wrap items-center gap-1.5 text-xs font-medium text-[rgb(var(--text-muted))]"
          >
            <LocaleLink
              href="/"
              className="hover:text-primary-600 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {dict.features.detail.breadcrumbHome}
            </LocaleLink>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            <LocaleLink
              href="/solutions"
              className="hover:text-primary-600 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {labels.breadcrumbSolutions}
            </LocaleLink>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="text-[rgb(var(--text-primary))] font-semibold">{spec.title}</span>
          </nav>

          <div className="max-w-4xl space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full surface text-xs font-semibold text-[rgb(var(--text-secondary))]">
                <Icon className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
                <span>{spec.eyebrow}</span>
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                {spec.categoryLabel}
              </span>
            </div>

            <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              {spec.headline}
            </h1>

            <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed max-w-3xl">
              {spec.summary}
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <ButtonLink
                href={`/signup`}
                variant="primary"
                size="lg"
                trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
              >
                {spec.cta.primaryLabel}
              </ButtonLink>
              <ButtonLink href="/demo" variant="outline" size="lg">
                {spec.cta.secondaryLabel}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </Section>

      {/* 2. Operational Fit Block */}
      <Section surface="surface" rhythm="compact" bordered>
        <Container>
          <div className="surface rounded-xl p-6 sm:p-8 bg-primary-50/40 border-primary-200 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary-600 block">
                {labels.whoItIsForEyebrow}
              </span>
              <h2 className="text-xl sm:text-2xl font-semibold text-[rgb(var(--text-primary))]">
                {spec.whoItIsFor.heading}
              </h2>
              <p className="text-sm sm:text-base text-[rgb(var(--text-secondary))] leading-relaxed">
                {spec.whoItIsFor.description}
              </p>
            </div>
            <div className="lg:col-span-7">
              <ul className="space-y-2.5">
                {spec.whoItIsFor.highlights.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-sm sm:text-base text-[rgb(var(--text-primary))]"
                  >
                    <Check className="w-4 h-4 text-success-600 shrink-0 mt-1" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </Section>

      {/* 3. Capabilities Tailored to Segment */}
      <Section surface="base" rhythm="default" bordered>
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {spec.capabilities.map((cap) => (
              <FeatureCard
                key={cap.id}
                icon={<Icon className="w-5 h-5" aria-hidden="true" />}
                title={cap.title}
                description={cap.description}
                badge={{ label: cap.moduleRefs, tone: 'secondary' }}
                bullets={cap.bullets}
              />
            ))}
          </div>
        </Container>
      </Section>

      {/* 4. Links to Relevant Feature Pages */}
      <Section surface="surface" rhythm="default" bordered>
        <Container>
          <SectionHeader
            align="left"
            title={labels.relevantFeaturesHeading}
            subtitle={labels.relevantFeaturesSubtitle}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {spec.relatedFeatures.map((rel) => {
              const featSpec = dict.features.pages[rel.slug];
              const FeatIcon = FEATURE_ICON_MAP[rel.slug];
              const isComingSoon = featSpec.phaseStatus === 'coming_soon';

              return (
                <FeatureCard
                  key={rel.slug}
                  icon={<FeatIcon className="w-5 h-5" aria-hidden="true" />}
                  title={featSpec.title}
                  description={rel.reason}
                  badge={{
                    label: isComingSoon
                      ? dict.features.detail.comingSoonPill
                      : dict.features.detail.liveStatusPill,
                    tone: isComingSoon ? 'warning' : 'success',
                  }}
                  href={`/features/${rel.slug}`}
                  ctaLabel={labels.exploreFeatureLink}
                />
              );
            })}
          </div>
        </Container>
      </Section>

      {/* 5. Other Workforce Solutions Switcher */}
      <Section surface="muted" rhythm="compact" bordered>
        <Container>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[rgb(var(--text-primary))]">
                {labels.otherSolutionsHeading}
              </h2>
              <p className="text-sm text-[rgb(var(--text-secondary))]">{labels.otherSolutionsSubtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {spec.relatedSolutions.map((otherSlug) => {
                const other = dict.solutions.segments[otherSlug];
                return (
                  <LocaleLink
                    key={otherSlug}
                    href={`/solutions/${otherSlug}`}
                    className="inline-flex items-center px-3.5 py-2 rounded-lg surface text-sm font-semibold text-[rgb(var(--text-primary))] hover:border-primary-300 hover:text-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    {other.title}
                  </LocaleLink>
                );
              })}
              <LocaleLink
                href="/solutions/countries"
                className="inline-flex items-center px-3.5 py-2 rounded-lg surface text-sm font-semibold text-primary-700 hover:border-primary-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {dict.solutions.overview.countryBannerCta}
              </LocaleLink>
            </div>
          </div>
        </Container>
      </Section>

      {/* 6. Closing CTA Band */}
      <CtaBand
        tone="dark"
        eyebrow={spec.cta.eyebrow}
        title={spec.cta.title}
        description={spec.cta.description}
        actions={
          <>
            <ButtonLink
              href={`/signup`}
              variant="inverse"
              size="lg"
              trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
            >
              {spec.cta.primaryLabel}
            </ButtonLink>
            <ButtonLink
              href="/demo"
              variant="outline"
              size="lg"
              className="border-primary-400 bg-transparent text-white hover:bg-primary-800 hover:text-white"
            >
              {spec.cta.secondaryLabel}
            </ButtonLink>
          </>
        }
        footnote={dict.home.cta.footnote}
      />
    </>
  );
}
