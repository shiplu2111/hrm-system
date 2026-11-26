import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarCheck,
  DatabaseBackup,
  FileText,
  KeyRound,
  Layers,
  Lock,
  ScrollText,
  ShieldCheck,
  Trash2,
  UserCheck,
} from 'lucide-react';
import {
  ButtonLink,
  Container,
  CtaBand,
  FeatureCard,
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
    title: dict.security.metaTitle,
    description: dict.security.metaDescription,
    path: '/security',
    locale,
    eyebrow: dict.security.eyebrow,
  });
}

const CONTROL_ICONS = {
  'multi-tenant-isolation': Layers,
  'encryption-masking': Lock,
  rbac: ShieldCheck,
  'audit-log': ScrollText,
  'backups-restore': DatabaseBackup,
  'retention-deletion': Trash2,
  'two-factor-auth': KeyRound,
  'support-access': UserCheck,
} as const;

export default async function SecurityAndTrustPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const t = createTranslator(dict);
  const sec = dict.security;

  return (
    <>
      {/* 1. Hero & Last Reviewed Meta Strip */}
      <Section surface="base" rhythm="default" bordered className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
        <Container>
          <div className="max-w-4xl space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full surface text-xs font-semibold text-[rgb(var(--text-secondary))]">
                <ShieldCheck className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
                <span>{sec.eyebrow}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-medium bg-secondary-100 text-secondary-800 border border-secondary-200">
                <CalendarCheck className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
                <span>
                  {sec.lastReviewedLabel} {sec.lastReviewedDate}
                </span>
              </span>
            </div>

            <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              {sec.title}
            </h1>

            <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed max-w-3xl">
              {sec.subtitle}
            </p>

            {/* Honest transparency note — zero invented certification badges */}
            <div className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-4 text-xs sm:text-sm text-[rgb(var(--text-secondary))] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span>{sec.noFakeBadgesNote}</span>
              <Link
                href="/privacy"
                className="font-semibold text-primary-600 hover:text-primary-700 hover:underline whitespace-nowrap rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {sec.privacyLinkLabel} &rarr;
              </Link>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <ButtonLink
                href={`/signup`}
                variant="primary"
                size="lg"
                trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
              >
                {sec.heroPrimaryCta}
              </ButtonLink>
              <ButtonLink href="/demo" variant="outline" size="lg">
                {sec.heroSecondaryCta}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </Section>

      {/* 2. How It Works Architecture Flow */}
      <Section id="how-it-works" surface="surface" rhythm="default" bordered>
        <Container>
          <SectionHeader
            align="left"
            eyebrow={sec.howItWorks.eyebrow}
            title={sec.howItWorks.title}
            subtitle={sec.howItWorks.subtitle}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {sec.howItWorks.steps.map((item) => (
              <article key={item.step} className="surface rounded-xl p-6 sm:p-8 space-y-4">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary-600 text-white font-mono text-sm font-bold">
                  {item.step}
                </span>
                <h3 className="text-xl font-semibold text-[rgb(var(--text-primary))]">{item.title}</h3>
                <p className="text-sm sm:text-base text-[rgb(var(--text-secondary))] leading-relaxed">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      {/* 3. Eight Implemented Security Controls */}
      <Section id="controls" surface="base" rhythm="default" bordered>
        <Container>
          <SectionHeader
            align="left"
            eyebrow={sec.controlsSection.eyebrow}
            title={sec.controlsSection.title}
            subtitle={sec.controlsSection.subtitle}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {sec.controlsSection.controls.map((ctrl) => {
              const Icon = CONTROL_ICONS[ctrl.id as keyof typeof CONTROL_ICONS] ?? ShieldCheck;
              return (
                <FeatureCard
                  key={ctrl.id}
                  icon={<Icon className="w-6 h-6" aria-hidden="true" />}
                  title={ctrl.title}
                  description={ctrl.summary}
                  bullets={ctrl.details}
                />
              );
            })}
          </div>
        </Container>
      </Section>

      {/* 4. Support-Access Approval Lifecycle */}
      <Section id="support-access" surface="tinted" rhythm="default" bordered>
        <Container>
          <SectionHeader
            align="left"
            eyebrow={sec.supportFlow.eyebrow}
            title={sec.supportFlow.title}
            subtitle={sec.supportFlow.subtitle}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {sec.supportFlow.steps.map((step) => (
              <article key={step.label} className="surface rounded-xl p-6 space-y-2.5">
                <h3 className="text-base font-semibold text-primary-700">{step.label}</h3>
                <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">{step.detail}</p>
              </article>
            ))}
          </div>

          {/* Privacy Policy Reference Card */}
          <div className="mt-10 surface rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 border border-primary-100">
                <FileText className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[rgb(var(--text-primary))]">
                  {sec.privacyCallout.title}
                </h3>
                <p className="mt-1 text-sm sm:text-base text-[rgb(var(--text-secondary))]">
                  {sec.privacyCallout.description}
                </p>
                <p className="mt-2 text-xs font-mono text-[rgb(var(--text-muted))]">
                  {sec.lastReviewedLabel} {sec.lastReviewedDate}
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <ButtonLink
                href="/privacy"
                variant="outline"
                size="md"
                trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
              >
                {sec.privacyCallout.cta}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </Section>

      {/* 5. Closing CTA Band */}
      <CtaBand
        tone="dark"
        eyebrow={sec.cta.eyebrow}
        title={sec.cta.title}
        description={sec.cta.description}
        actions={
          <>
            <ButtonLink
              href={`/signup`}
              variant="inverse"
              size="lg"
              trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
            >
              {t('security.cta.primaryLabel')}
            </ButtonLink>
            <ButtonLink
              href="/demo"
              variant="outline"
              size="lg"
              className="border-primary-400 bg-transparent text-white hover:bg-primary-800 hover:text-white"
            >
              {t('security.cta.secondaryLabel')}
            </ButtonLink>
          </>
        }
        footnote={dict.home.cta.footnote}
      />
    </>
  );
}
