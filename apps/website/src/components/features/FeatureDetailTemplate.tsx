import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Briefcase,
  Calculator,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  GitBranch,
  Image as ImageIcon,
  Smartphone,
  Users,
} from 'lucide-react';
import type { WebsiteDictionary } from '../../i18n';
import type { FeaturePageSpec } from '../../i18n/dictionaries/features.en';
import { ButtonLink, Container, CtaBand, FeatureCard, LocaleLink, Section, SectionHeader } from '../marketing';

export const FEATURE_ICON_MAP = {
  payroll: Calculator,
  attendance: Clock,
  leave: CalendarDays,
  recruitment: Briefcase,
  'self-service': Smartphone,
  reports: BarChart3,
  workflows: GitBranch,
} as const;

interface FeatureDetailTemplateProps {
  spec: FeaturePageSpec;
  dict: WebsiteDictionary;
}

export function FeatureDetailTemplate({ spec, dict }: FeatureDetailTemplateProps) {
  const isComingSoonPage = spec.phaseStatus === 'coming_soon';
  const labels = dict.features.detail;
  const Icon = FEATURE_ICON_MAP[spec.slug] ?? Users;
  const relatedSpecs = spec.relatedSlugs.map((slug) => dict.features.pages[slug]);

  return (
    <>
      {/* 1. Headline & Phase Banner */}
      <Section surface="base" rhythm="default" bordered className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
        <Container>
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs font-medium text-[rgb(var(--text-muted))]">
            <LocaleLink
              href="/"
              className="hover:text-primary-600 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {labels.breadcrumbHome}
            </LocaleLink>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            <LocaleLink
              href="/features"
              className="hover:text-primary-600 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {labels.breadcrumbFeatures}
            </LocaleLink>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="text-[rgb(var(--text-primary))] font-semibold">{spec.shortTitle}</span>
          </nav>

          <div className="max-w-4xl space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full surface text-xs font-semibold text-[rgb(var(--text-secondary))]">
                <Icon className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
                <span>{spec.eyebrow}</span>
              </span>

              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-semibold border ${
                  isComingSoonPage
                    ? 'bg-warning-50 text-warning-700 border-warning-200'
                    : 'bg-success-50 text-success-700 border-success-200'
                }`}
              >
                {spec.phaseBadge}
              </span>
            </div>

            <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              {spec.headline}
            </h1>

            <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed max-w-3xl">
              {spec.summary}
            </p>

            {/* Explicit Phase 2 / 3 "Coming soon" callout */}
            {isComingSoonPage && spec.phaseNotice && (
              <div
                role="note"
                className="rounded-xl border border-warning-200 bg-warning-50 p-4 sm:p-5 flex items-start gap-3 text-warning-900"
              >
                <AlertCircle className="w-5 h-5 text-warning-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-sm leading-relaxed">
                  <p className="font-semibold">{labels.comingSoonBannerTitle}</p>
                  <p className="mt-1 text-warning-800">{spec.phaseNotice}</p>
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {isComingSoonPage ? (
                <>
                  <ButtonLink
                    href="/demo"
                    variant="primary"
                    size="lg"
                    trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
                  >
                    {spec.cta.primaryLabel}
                  </ButtonLink>
                  <ButtonLink href="/features" variant="outline" size="lg">
                    {spec.cta.secondaryLabel}
                  </ButtonLink>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        </Container>
      </Section>

      {/* 2. Short "Who It Is For" Callout */}
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
                {spec.whoItIsFor.audience}
              </p>
            </div>
            <div className="lg:col-span-7">
              <ul className="space-y-2.5">
                {spec.whoItIsFor.outcomes.map((outcome) => (
                  <li key={outcome} className="flex items-start gap-2.5 text-sm sm:text-base text-[rgb(var(--text-primary))]">
                    <Check className="w-4 h-4 text-success-600 shrink-0 mt-1" aria-hidden="true" />
                    <span>{outcome}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </Section>

      {/* 3. Feature Blocks (3-6 blocks, alternating layout, each with an honest image slot) */}
      <div>
        {spec.blocks.map((block, index) => {
          const isEven = index % 2 === 0;
          const blockComingSoon = block.phaseStatus === 'coming_soon';

          return (
            <Section
              key={block.id}
              id={block.id}
              surface={isEven ? 'base' : 'surface'}
              rhythm="default"
              bordered
            >
              <Container>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                  {/* Text Content */}
                  <div className={`lg:col-span-6 space-y-4 ${isEven ? '' : 'lg:order-2'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-semibold border ${
                          blockComingSoon
                            ? 'bg-warning-50 text-warning-700 border-warning-200'
                            : 'bg-primary-50 text-primary-700 border-primary-200'
                        }`}
                      >
                        {block.phaseLabel}
                      </span>
                    </div>

                    <h2 className="text-display-sm font-semibold text-[rgb(var(--text-primary))]">
                      {block.title}
                    </h2>

                    <p className="text-base text-[rgb(var(--text-secondary))] leading-relaxed">
                      {block.description}
                    </p>

                    <ul className="space-y-2 pt-2">
                      {block.bullets.map((bullet) => (
                        <li
                          key={bullet}
                          className="flex items-start gap-2.5 text-sm sm:text-base text-[rgb(var(--text-primary))]"
                        >
                          <Check className="w-4 h-4 text-success-600 shrink-0 mt-1" aria-hidden="true" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Honest Image Slot */}
                  <div className={`lg:col-span-6 ${isEven ? '' : 'lg:order-1'}`}>
                    <figure className="surface rounded-xl overflow-hidden border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-surface))]">
                      <div className="px-4 py-2.5 bg-secondary-50 border-b border-[rgb(var(--border-base))] flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[rgb(var(--text-muted))]">
                          <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{labels.imageSlotPendingPrefix}</span>
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-sm text-2xs font-mono font-semibold border ${
                            blockComingSoon
                              ? 'bg-warning-50 text-warning-700 border-warning-200'
                              : 'bg-secondary-100 text-secondary-700 border-secondary-200'
                          }`}
                        >
                          {block.imageSlot.badge}
                        </span>
                      </div>

                      <div className="p-6 space-y-2.5 bg-[rgb(var(--bg-base))]/40">
                        {block.imageSlot.previewLines.map((line) => (
                          <div
                            key={line}
                            className="rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] px-3.5 py-2.5 font-mono text-xs text-[rgb(var(--text-primary))]"
                          >
                            {line}
                          </div>
                        ))}
                      </div>

                      <figcaption className="px-4 py-2.5 bg-secondary-50 border-t border-[rgb(var(--border-base))] text-xs text-[rgb(var(--text-muted))]">
                        {block.imageSlot.caption}
                      </figcaption>
                    </figure>
                  </div>
                </div>
              </Container>
            </Section>
          );
        })}
      </div>

      {/* 4. Related Features */}
      <Section surface="muted" rhythm="default" bordered>
        <Container>
          <SectionHeader
            align="left"
            title={labels.relatedHeading}
            subtitle={labels.relatedSubtitle}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedSpecs.map((rel) => {
              const RelIcon = FEATURE_ICON_MAP[rel.slug] ?? Users;
              const relComingSoon = rel.phaseStatus === 'coming_soon';
              return (
                <FeatureCard
                  key={rel.slug}
                  icon={<RelIcon className="w-5 h-5" aria-hidden="true" />}
                  title={rel.title}
                  description={rel.summary}
                  badge={{
                    label: relComingSoon ? labels.comingSoonPill : labels.liveStatusPill,
                    tone: relComingSoon ? 'warning' : 'success',
                  }}
                  href={`/features/${rel.slug}`}
                  ctaLabel={dict.components.learnMore}
                />
              );
            })}
          </div>
        </Container>
      </Section>

      {/* 5. Closing CTA Band */}
      <CtaBand
        tone="dark"
        eyebrow={spec.cta.eyebrow}
        title={spec.cta.title}
        description={spec.cta.description}
        actions={
          isComingSoonPage ? (
            <>
              <ButtonLink
                href="/demo"
                variant="inverse"
                size="lg"
                trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
              >
                {spec.cta.primaryLabel}
              </ButtonLink>
              <ButtonLink
                href="/features"
                variant="outline"
                size="lg"
                className="border-primary-400 bg-transparent text-white hover:bg-primary-800 hover:text-white"
              >
                {spec.cta.secondaryLabel}
              </ButtonLink>
            </>
          ) : (
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
          )
        }
        footnote={dict.home.cta.footnote}
      />
    </>
  );
}
