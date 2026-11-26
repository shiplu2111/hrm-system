import type { Metadata } from 'next';
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCircle2,
  GitBranch,
  Lock,
  Smartphone,
} from 'lucide-react';
import {
  Button,
  ButtonLink,
  Container,
  CtaBand,
  FaqAccordion,
  FeatureCard,
  Hero,
  PricingCard,
  Section,
  SectionHeader,
  TranslationFallbackNotice,
} from '../../../components/marketing';
import { createTranslator, getDictionary, resolveWebsiteLocale } from '../../../i18n';
import { buildPageMetadata } from '../../../lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const t = createTranslator(dict);
  return buildPageMetadata({
    title: t('meta.showcaseTitle'),
    description: t('meta.showcaseDescription'),
    path: '/components',
    locale,
    noIndex: true,
  });
}

export default async function ComponentsShowcasePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const t = createTranslator(dict);
  const swatches = [
    { name: t('showcase.tokens.primarySwatchName'), swatchClass: 'bg-primary-600' },
    { name: t('showcase.tokens.primaryDarkSwatchName'), swatchClass: 'bg-primary-900' },
    { name: t('showcase.tokens.surfaceSwatchName'), swatchClass: 'bg-[rgb(var(--bg-surface))] border border-strong' },
    { name: t('showcase.tokens.successSwatchName'), swatchClass: 'bg-success-600' },
    { name: t('showcase.tokens.warningSwatchName'), swatchClass: 'bg-warning-600' },
    { name: t('showcase.tokens.errorSwatchName'), swatchClass: 'bg-error-600' },
  ];

  return (
    <>
      {/* Intro Header */}
      <Section surface="surface" rhythm="compact" bordered>
        <Container>
          <div className="mb-4">
            <TranslationFallbackNotice
              locale={locale}
              reason="showcase"
              basePath="/components"
              className="mb-4"
            />
            <ButtonLink
              href="/"
              variant="ghost"
              size="sm"
              className="-ml-3.5"
              leadingIcon={<ArrowLeft className="w-4 h-4" aria-hidden="true" />}
            >
              {t('showcase.header.backToHome')}
            </ButtonLink>
          </div>
          <span className="inline-block text-xs font-semibold tracking-wider uppercase text-primary-600 mb-3">
              {t('showcase.header.eyebrow')}
            </span>
            <h1 className="text-display-md sm:text-display-lg font-bold tracking-tight text-[rgb(var(--text-primary))] max-w-4xl">
              {t('showcase.header.title')}
            </h1>
            <p className="mt-4 text-base sm:text-lead text-[rgb(var(--text-secondary))] max-w-3xl">
              {t('showcase.header.subtitle')}
            </p>
            <div className="mt-6 inline-flex flex-wrap items-center gap-2 px-3.5 py-2 rounded-lg bg-secondary-100 text-xs font-medium text-secondary-700">
              <span className="font-semibold text-secondary-900">{t('showcase.header.viewportLabel')}</span>
              <span>{t('showcase.header.viewportSizes')}</span>
            </div>
          </Container>
        </Section>

        {/* 01: Color Tokens & Marketing Type Scale */}
        <Section surface="base" rhythm="default" bordered>
          <Container>
            <SectionHeader
              align="left"
              eyebrow={t('showcase.tokens.eyebrow')}
              title={t('showcase.tokens.title')}
              subtitle={t('showcase.tokens.subtitle')}
            />

            <div className="space-y-12">
              {/* Swatches */}
              <div>
                <h3 className="text-lg font-semibold text-[rgb(var(--text-primary))] mb-4">
                  {t('showcase.tokens.colorsHeading')}
                </h3>
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {swatches.map((swatch) => (
                    <div key={swatch.name} className="surface rounded-lg p-3">
                      <div className={`h-14 w-full rounded-md mb-3 ${swatch.swatchClass}`} />
                      <p className="text-xs font-semibold text-[rgb(var(--text-primary))]">{swatch.name}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Typography Scale */}
              <div>
                <h3 className="text-lg font-semibold text-[rgb(var(--text-primary))] mb-4">
                  {t('showcase.tokens.typographyHeading')}
                </h3>
                <div className="surface rounded-xl p-6 sm:p-8 space-y-5 overflow-hidden">
                  <p className="text-display-md sm:text-display-2xl font-bold text-[rgb(var(--text-primary))]">
                    {t('showcase.tokens.typeSpecimens.display2xl')}
                  </p>
                  <p className="text-display-sm sm:text-display-xl font-bold text-[rgb(var(--text-primary))]">
                    {t('showcase.tokens.typeSpecimens.displayXl')}
                  </p>
                  <p className="text-2xl sm:text-display-lg font-semibold text-[rgb(var(--text-primary))]">
                    {t('showcase.tokens.typeSpecimens.displayLg')}
                  </p>
                  <p className="text-xl sm:text-display-md font-semibold text-[rgb(var(--text-primary))]">
                    {t('showcase.tokens.typeSpecimens.displayMd')}
                  </p>
                  <p className="text-lead-lg text-[rgb(var(--text-secondary))] pt-2 border-t border-[rgb(var(--border-base))]">
                    {t('showcase.tokens.typeSpecimens.leadLg')}
                  </p>
                  <p className="text-base text-[rgb(var(--text-secondary))]">
                    {t('showcase.tokens.typeSpecimens.body')}
                  </p>
                </div>
              </div>
            </div>
          </Container>
        </Section>

        {/* 02: Button Variants */}
        <Section surface="surface" rhythm="default" bordered>
          <Container>
            <SectionHeader
              align="left"
              eyebrow={t('showcase.buttons.eyebrow')}
              title={t('showcase.buttons.title')}
              subtitle={t('showcase.buttons.subtitle')}
            />

            <div className="space-y-6">
              <div className="surface rounded-xl p-6 flex flex-wrap items-center gap-4">
                <Button variant="primary">{t('showcase.buttons.variantPrimary')}</Button>
                <Button variant="secondary">{t('showcase.buttons.variantSecondary')}</Button>
                <Button variant="outline">{t('showcase.buttons.variantOutline')}</Button>
                <Button variant="ghost">{t('showcase.buttons.variantGhost')}</Button>
                <div className="bg-primary-900 p-2 rounded-lg">
                  <Button variant="inverse">{t('showcase.buttons.variantInverse')}</Button>
                </div>
              </div>

              <div className="surface rounded-xl p-6 flex flex-wrap items-center gap-4">
                <Button variant="primary" size="sm">
                  {t('showcase.buttons.sizeSm')}
                </Button>
                <Button variant="primary" size="md">
                  {t('showcase.buttons.sizeMd')}
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
                >
                  {t('showcase.buttons.sizeLg')}
                </Button>
              </div>
            </div>
          </Container>
        </Section>

        {/* 03: Hero Pattern (Split Variant) */}
        <Section surface="base" rhythm="compact" bordered>
          <Container>
            <SectionHeader
              align="left"
              eyebrow={t('showcase.heroSection.eyebrow')}
              title={t('showcase.heroSection.title')}
              subtitle={t('showcase.heroSection.subtitle')}
            />
          </Container>
          <div className="border-t border-[rgb(var(--border-base))]">
            <Hero
              layout="split"
              headingLevel="h2"
              eyebrow={t('showcase.heroSection.sampleEyebrow')}
              title={t('showcase.heroSection.sampleTitle')}
              subtitle={t('showcase.heroSection.sampleSubtitle')}
              actions={
                <>
                  <ButtonLink
                    href={`/signup`}
                    variant="primary"
                    size="lg"
                    trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
                  >
                    {t('showcase.heroSection.samplePrimaryCta')}
                  </ButtonLink>
                  <Button variant="outline" size="lg">
                    {t('showcase.heroSection.sampleSecondaryCta')}
                  </Button>
                </>
              }
              guarantees={[
                {
                  label: t('home.hero.guarantees.payroll'),
                  icon: <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" aria-hidden="true" />,
                },
                {
                  label: t('home.hero.guarantees.audit'),
                  icon: <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" aria-hidden="true" />,
                },
              ]}
              visual={
                <div className="surface-elevated rounded-xl p-6 space-y-5">
                  <div className="flex items-center justify-between gap-2 pb-4 border-b border-[rgb(var(--border-base))]">
                    <div className="flex items-center gap-2 font-mono text-sm font-semibold text-[rgb(var(--text-primary))]">
                      <Lock className="w-4 h-4 text-primary-600" aria-hidden="true" />
                      <span>{t('showcase.heroSection.samplePreviewTitle')}</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-sm text-xs font-semibold bg-success-50 text-success-700 border border-success-200">
                      {t('showcase.heroSection.samplePreviewBadge')}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="font-mono text-2xl font-bold text-[rgb(var(--text-primary))]">
                        {t('showcase.heroSection.samplePreviewMetric1Value')}
                      </div>
                      <div className="text-xs text-[rgb(var(--text-muted))] mt-1">
                        {t('showcase.heroSection.samplePreviewMetric1Label')}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-2xl font-bold text-primary-700">
                        {t('showcase.heroSection.samplePreviewMetric2Value')}
                      </div>
                      <div className="text-xs text-[rgb(var(--text-muted))] mt-1">
                        {t('showcase.heroSection.samplePreviewMetric2Label')}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-2xl font-bold text-[rgb(var(--text-primary))]">
                        {t('showcase.heroSection.samplePreviewMetric3Value')}
                      </div>
                      <div className="text-xs text-[rgb(var(--text-muted))] mt-1">
                        {t('showcase.heroSection.samplePreviewMetric3Label')}
                      </div>
                    </div>
                  </div>
                </div>
              }
            />
          </div>
        </Section>

        {/* 04: Feature Cards */}
        <Section surface="surface" rhythm="default" bordered>
          <Container>
            <SectionHeader
              align="left"
              eyebrow={t('showcase.featureCards.eyebrow')}
              title={t('showcase.featureCards.title')}
              subtitle={t('showcase.featureCards.subtitle')}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              <FeatureCard
                featured
                icon={<Calculator className="w-6 h-6" aria-hidden="true" />}
                title={t('showcase.featureCards.cards.payroll.title')}
                description={t('showcase.featureCards.cards.payroll.description')}
                bullets={dict.showcase.featureCards.cards.payroll.bullets}
                href="/"
                ctaLabel={t('showcase.featureCards.cards.payroll.cta')}
              />
              <FeatureCard
                icon={<Smartphone className="w-6 h-6" aria-hidden="true" />}
                title={t('showcase.featureCards.cards.attendance.title')}
                description={t('showcase.featureCards.cards.attendance.description')}
                bullets={dict.showcase.featureCards.cards.attendance.bullets}
                href="/"
                ctaLabel={t('showcase.featureCards.cards.attendance.cta')}
              />
              <FeatureCard
                icon={<GitBranch className="w-6 h-6" aria-hidden="true" />}
                title={t('showcase.featureCards.cards.workflows.title')}
                description={t('showcase.featureCards.cards.workflows.description')}
                badge={{
                  label: t('showcase.featureCards.cards.workflows.badge'),
                  tone: 'warning',
                }}
                bullets={dict.showcase.featureCards.cards.workflows.bullets}
                href="/"
                ctaLabel={t('showcase.featureCards.cards.workflows.cta')}
              />
            </div>
          </Container>
        </Section>

        {/* 05: Pricing Cards */}
        <Section surface="muted" rhythm="default" bordered>
          <Container>
            <SectionHeader
              align="left"
              eyebrow={t('showcase.pricingCards.eyebrow')}
              title={t('showcase.pricingCards.title')}
              subtitle={t('showcase.pricingCards.subtitle')}
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
              <PricingCard
                name={t('showcase.pricingCards.starter.name')}
                description={t('showcase.pricingCards.starter.description')}
                priceDisplay={t('showcase.pricingCards.starter.price')}
                priceUnit={t('showcase.pricingCards.starter.unit')}
                limitNote={t('showcase.pricingCards.starter.limitNote')}
                ctaLabel={t('showcase.pricingCards.starter.cta')}
                ctaHref={`/signup`}
                features={dict.showcase.pricingCards.starter.features}
              />
              <PricingCard
                highlighted
                badge={t('showcase.pricingCards.business.badge')}
                name={t('showcase.pricingCards.business.name')}
                description={t('showcase.pricingCards.business.description')}
                priceDisplay={t('showcase.pricingCards.business.price')}
                priceUnit={t('showcase.pricingCards.business.unit')}
                limitNote={t('showcase.pricingCards.business.limitNote')}
                ctaLabel={t('showcase.pricingCards.business.cta')}
                ctaHref={`/signup`}
                features={dict.showcase.pricingCards.business.features}
              />
              <PricingCard
                name={t('showcase.pricingCards.enterprise.name')}
                description={t('showcase.pricingCards.enterprise.description')}
                priceDisplay={t('showcase.pricingCards.enterprise.price')}
                priceUnit={t('showcase.pricingCards.enterprise.unit')}
                limitNote={t('showcase.pricingCards.enterprise.limitNote')}
                ctaLabel={t('showcase.pricingCards.enterprise.cta')}
                ctaHref="/"
                features={dict.showcase.pricingCards.enterprise.features}
              />
            </div>
          </Container>
        </Section>

        {/* 06: FAQ Accordion & CTA Bands */}
        <Section surface="surface" rhythm="default">
          <Container size="narrow">
            <SectionHeader
              eyebrow={t('showcase.containersAndCta.eyebrow')}
              title={t('showcase.containersAndCta.title')}
              subtitle={t('showcase.containersAndCta.subtitle')}
            />
            <FaqAccordion items={dict.home.faq.items} emitStructuredData={false} />
          </Container>

          <CtaBand
            tone="tinted"
            eyebrow={t('home.cta.eyebrow')}
            title={t('home.cta.title')}
            description={t('home.cta.description')}
            actions={
              <ButtonLink
                href={`/signup`}
                variant="primary"
                size="lg"
                trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
              >
                {t('home.cta.primaryButton')}
              </ButtonLink>
            }
            footnote={t('home.cta.footnote')}
          />

          <CtaBand
            tone="dark"
            eyebrow={t('home.cta.eyebrow')}
            title={t('home.cta.title')}
            description={t('home.cta.description')}
            actions={
              <ButtonLink
                href={`/signup`}
                variant="inverse"
                size="lg"
                trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
              >
                {t('home.cta.primaryButton')}
              </ButtonLink>
            }
            footnote={t('home.cta.footnote')}
          />
        </Section>
    </>
  );
}
