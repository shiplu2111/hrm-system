import type { Metadata } from 'next';
import nextDynamic from 'next/dynamic';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Briefcase,
  Calculator,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  FileCheck2,
  GitBranch,
  Globe2,
  ShieldCheck,
  Sliders,
  Smartphone,
  Users,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import {
  AdminVisualPlaceholder,
  AuditLogVisual,
  OfflineSyncVisual,
  PayrollRulesVisual,
  RuleChainVisual,
} from '../../components/home/HomeVisuals';
import {
  ButtonLink,
  Container,
  CtaBand,
  FeatureCard,
  Hero,
  Section,
  SectionHeader,
} from '../../components/marketing';

const FaqAccordion = nextDynamic(() =>
  import('../../components/marketing/FaqAccordion').then((m) => m.FaqAccordion),
);
import {
  createTranslator,
  formatNumber,
  getDictionary,
  resolveWebsiteLocale,
} from '../../i18n';
import { fetchPublicCmsFaqs } from '../../lib/cms-faqs';
import { buildPageMetadata, buildSoftwareApplicationJsonLd, safeJsonLdStringify } from '../../lib/seo';

// Server-rendered with ISR caching (revalidates every 60 seconds)
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const tMeta = createTranslator(dict);
  return buildPageMetadata({
    title: tMeta('meta.defaultTitle'),
    description: tMeta('meta.description'),
    path: '/',
    locale,
    eyebrow: tMeta('brand.fullName'),
  });
}

const MODULE_ICONS = {
  hris: Users,
  attendance: Clock,
  leave: CalendarDays,
  payroll: Calculator,
  ess: Smartphone,
  'docs-reports': FileCheck2,
  'talent-assets': Briefcase,
  'workflows-api': GitBranch,
} as const;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const t = createTranslator(dict);

  const [healthResult, systemStatusResult, homeCmsFaqResult] = await Promise.allSettled([
    apiClient.health.get({ revalidate: 30 }),
    apiClient.system.getStatus({ revalidate: 30 }),
    fetchPublicCmsFaqs({ locale, pageSlug: 'home' }),
  ]);
  const homeFaqItems =
    homeCmsFaqResult.status === 'fulfilled' && homeCmsFaqResult.value.items.length > 0
      ? homeCmsFaqResult.value.items
      : dict.home.faq.items;

  const health = healthResult.status === 'fulfilled' ? healthResult.value : null;
  const systemStatus = systemStatusResult.status === 'fulfilled' ? systemStatusResult.value : null;

  const diff = dict.home.differentiators;

  const jsonLd = buildSoftwareApplicationJsonLd(t('meta.description'));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />

      {systemStatus?.isMaintenanceActive && (
        <aside className="bg-warning-100 text-warning-900 border-b border-warning-200 px-4 py-2 text-center text-sm font-medium">
          {t('maintenance.bannerPrefix')}{' '}
          {systemStatus.bannerMessage || t('maintenance.fallbackMessage')}
        </aside>
      )}

      {/* 1. Hero with one clear promise, 2 buttons (Start free trial, Book a demo), and honest product visual */}
      <Hero
        layout="centered"
        eyebrow={t('home.hero.eyebrow')}
        eyebrowTag={t('home.hero.eyebrowTag')}
        title={t('home.hero.title')}
        subtitle={t('home.hero.subtitle')}
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
            <ButtonLink href="/demo" variant="outline" size="lg">
              {t('home.hero.secondaryCta')}
            </ButtonLink>
          </>
        }
        guarantees={[
          {
            label: t('home.hero.guarantees.payroll'),
            icon: <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" aria-hidden="true" />,
          },
          {
            label: t('home.hero.guarantees.offline'),
            icon: <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" aria-hidden="true" />,
          },
          {
            label: t('home.hero.guarantees.audit'),
            icon: <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" aria-hidden="true" />,
          },
          {
            label: t('home.hero.guarantees.rules'),
            icon: <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" aria-hidden="true" />,
          },
        ]}
        visual={<AdminVisualPlaceholder visual={dict.home.hero.visual} />}
      />

      {/* 2. Dedicated Sections for Each of the 4 Differentiators (PRD §3) */}
      <div id="differentiators">
        <Section surface="surface" rhythm="compact" bordered>
          <Container>
            <SectionHeader
              eyebrow={diff.eyebrow}
              title={diff.title}
              subtitle={diff.subtitle}
              className="mb-0 md:mb-0"
            />
          </Container>
        </Section>

        {/* Differentiator 1: Country-Configurable Payroll */}
        <Section surface="surface" rhythm="default" bordered>
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              <div className="lg:col-span-6 space-y-5">
                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                  <Globe2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{diff.countryCore.badge}</span>
                </span>
                <h3 className="text-display-sm sm:text-display-md font-semibold text-[rgb(var(--text-primary))]">
                  {diff.countryCore.title}
                </h3>
                <p className="text-base sm:text-lead text-[rgb(var(--text-secondary))] leading-relaxed">
                  {diff.countryCore.description}
                </p>
                <ul className="space-y-2.5 pt-2">
                  {diff.countryCore.bullets.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm sm:text-base text-[rgb(var(--text-primary))]">
                      <Check className="w-4 h-4 text-success-600 shrink-0 mt-1" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-2">
                  <ButtonLink
                    href="/solutions/countries"
                    variant="outline"
                    size="md"
                    trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
                  >
                    {diff.countryCore.cta}
                  </ButtonLink>
                </div>
              </div>
              <div className="lg:col-span-6">
                <RuleChainVisual data={diff.countryCore} />
              </div>
            </div>
          </Container>
        </Section>

        {/* Differentiator 2: Offline-First Mobile Attendance */}
        <Section surface="base" rhythm="default" bordered>
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              <div className="lg:col-span-6 order-2 lg:order-1">
                <OfflineSyncVisual data={diff.offlineAttendance} />
              </div>
              <div className="lg:col-span-6 order-1 lg:order-2 space-y-5">
                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                  <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{diff.offlineAttendance.badge}</span>
                </span>
                <h3 className="text-display-sm sm:text-display-md font-semibold text-[rgb(var(--text-primary))]">
                  {diff.offlineAttendance.title}
                </h3>
                <p className="text-base sm:text-lead text-[rgb(var(--text-secondary))] leading-relaxed">
                  {diff.offlineAttendance.description}
                </p>
                <ul className="space-y-2.5 pt-2">
                  {diff.offlineAttendance.bullets.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm sm:text-base text-[rgb(var(--text-primary))]">
                      <Check className="w-4 h-4 text-success-600 shrink-0 mt-1" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-2">
                  <ButtonLink
                    href="/features/attendance"
                    variant="outline"
                    size="md"
                    trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
                  >
                    {diff.offlineAttendance.cta}
                  </ButtonLink>
                </div>
              </div>
            </div>
          </Container>
        </Section>

        {/* Differentiator 3: Dynamic Payroll Rules */}
        <Section surface="surface" rhythm="default" bordered>
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              <div className="lg:col-span-6 space-y-5">
                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                  <Sliders className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{diff.payrollEngine.badge}</span>
                </span>
                <h3 className="text-display-sm sm:text-display-md font-semibold text-[rgb(var(--text-primary))]">
                  {diff.payrollEngine.title}
                </h3>
                <p className="text-base sm:text-lead text-[rgb(var(--text-secondary))] leading-relaxed">
                  {diff.payrollEngine.description}
                </p>
                <ul className="space-y-2.5 pt-2">
                  {diff.payrollEngine.bullets.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm sm:text-base text-[rgb(var(--text-primary))]">
                      <Check className="w-4 h-4 text-success-600 shrink-0 mt-1" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-2">
                  <ButtonLink
                    href="/features/payroll"
                    variant="outline"
                    size="md"
                    trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
                  >
                    {diff.payrollEngine.cta}
                  </ButtonLink>
                </div>
              </div>
              <div className="lg:col-span-6">
                <PayrollRulesVisual data={diff.payrollEngine} />
              </div>
            </div>
          </Container>
        </Section>

        {/* Differentiator 4: Full Audit Trail */}
        <Section surface="base" rhythm="default" bordered>
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              <div className="lg:col-span-6 order-2 lg:order-1">
                <AuditLogVisual data={diff.auditTrail} />
              </div>
              <div className="lg:col-span-6 order-1 lg:order-2 space-y-5">
                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{diff.auditTrail.badge}</span>
                </span>
                <h3 className="text-display-sm sm:text-display-md font-semibold text-[rgb(var(--text-primary))]">
                  {diff.auditTrail.title}
                </h3>
                <p className="text-base sm:text-lead text-[rgb(var(--text-secondary))] leading-relaxed">
                  {diff.auditTrail.description}
                </p>
                <ul className="space-y-2.5 pt-2">
                  {diff.auditTrail.bullets.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm sm:text-base text-[rgb(var(--text-primary))]">
                      <Check className="w-4 h-4 text-success-600 shrink-0 mt-1" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-2">
                  <ButtonLink
                    href="/security"
                    variant="outline"
                    size="md"
                    trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
                  >
                    {diff.auditTrail.cta}
                  </ButtonLink>
                </div>
              </div>
            </div>
          </Container>
        </Section>
      </div>

      {/* 3. Modules Overview Grid */}
      <Section id="modules" surface="surface" rhythm="default" bordered>
        <Container>
          <SectionHeader
            eyebrow={t('home.modules.eyebrow')}
            title={t('home.modules.title')}
            subtitle={t('home.modules.subtitle')}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {dict.home.modules.groups.map((mod) => {
              const IconComponent = MODULE_ICONS[mod.id as keyof typeof MODULE_ICONS] || BarChart3;
              const isComingSoon = mod.status === 'coming_soon';
              return (
                <FeatureCard
                  key={mod.id}
                  icon={<IconComponent className="w-5 h-5" aria-hidden="true" />}
                  title={mod.title}
                  description={mod.description}
                  badge={
                    isComingSoon && 'badge' in mod
                      ? { label: mod.badge, tone: 'warning' }
                      : { label: mod.refs, tone: 'secondary' }
                  }
                />
              );
            })}
          </div>
        </Container>
      </Section>

      {/* 4. "How It Works in 3 Steps" Row */}
      <Section id="how-it-works" surface="tinted" rhythm="default" bordered>
        <Container>
          <SectionHeader
            eyebrow={t('home.howItWorks.eyebrow')}
            title={t('home.howItWorks.title')}
            subtitle={t('home.howItWorks.subtitle')}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {dict.home.howItWorks.steps.map((step) => (
              <article key={step.number} className="surface rounded-xl p-6 sm:p-8 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-5">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary-600 text-white font-mono text-sm font-bold">
                      {step.number}
                    </span>
                    <span className="text-2xs font-mono font-medium text-[rgb(var(--text-muted))]">
                      {step.refs}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-[rgb(var(--text-primary))] mb-2.5">
                    {step.title}
                  </h3>
                  <p className="text-sm sm:text-base text-[rgb(var(--text-secondary))] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      {/* 5. Live Platform Health Strip (linked from Footer / Nav Status) */}
      <Section id="system-health" surface="base" rhythm="compact" bordered>
        <Container>
          <div className="surface rounded-xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Activity className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wider text-primary-600">
                  {t('home.telemetry.eyebrow')}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-success-50 border border-success-200 text-2xs font-semibold text-success-700 whitespace-nowrap">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${health?.status === 'degraded' ? 'bg-warning-600' : 'bg-success-600'
                      }`}
                    aria-hidden="true"
                  />
                  {health?.status === 'degraded' ? t('home.telemetry.degraded') : t('home.telemetry.operational')}
                </span>
              </div>
              <p className="text-xs text-[rgb(var(--text-muted))]">{t('home.telemetry.subtitle')}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 text-xs">
              <div>
                <span className="text-[rgb(var(--text-muted))] block">{t('home.telemetry.latencyLabel')}</span>
                <span className="font-mono text-sm font-semibold text-[rgb(var(--text-primary))]">
                  {health
                    ? `${formatNumber(Number(health.apiLatencyMs.toFixed(1)), locale)}ms`
                    : t('home.telemetry.latencyFallback')}
                </span>
              </div>
              <div>
                <span className="text-[rgb(var(--text-muted))] block">{t('home.telemetry.databaseLabel')}</span>
                <span className="font-mono text-sm font-semibold text-[rgb(var(--text-primary))]">
                  {health?.database === 'healthy'
                    ? t('home.telemetry.databaseHealthy')
                    : t('home.telemetry.databaseFallback')}
                </span>
              </div>
              <div>
                <span className="text-[rgb(var(--text-muted))] block">{t('home.telemetry.syncLabel')}</span>
                <span className="font-mono text-sm font-semibold text-[rgb(var(--text-primary))]">
                  {health
                    ? `${formatNumber(Number(health.mobileSyncSuccessRate.toFixed(1)), locale)}%`
                    : t('home.telemetry.syncFallback')}
                </span>
              </div>
              <div>
                <span className="text-[rgb(var(--text-muted))] block">{t('home.telemetry.uptimeLabel')}</span>
                <span className="font-mono text-sm font-semibold text-[rgb(var(--text-primary))]">
                  {health
                    ? `${formatNumber(Math.floor(health.uptimeSeconds / 60), locale)} ${t('home.telemetry.uptimeUnit')}`
                    : t('home.telemetry.uptimeFallback')}
                </span>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* 6. Buyer FAQ */}
      {homeFaqItems.length > 0 && (
        <Section id="faq" surface="surface" rhythm="default">
          <Container size="narrow">
            <SectionHeader
              eyebrow={t('home.faq.eyebrow')}
              title={t('home.faq.title')}
              subtitle={t('home.faq.subtitle')}
            />
            <FaqAccordion items={homeFaqItems} />
          </Container>
        </Section>
      )}

      {/* 7. Closing CTA Band */}
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
