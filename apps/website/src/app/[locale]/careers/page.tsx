import type { Metadata } from 'next';
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Code2,
  FileText,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  ButtonLink,
  Container,
  CtaBand,
  FeatureCard,
  Section,
  SectionHeader,
} from '../../../components/marketing';
import { fetchOpenCareerListings } from '../../../lib/careers';
import { formatNumber, getDictionary, resolveWebsiteLocale } from '../../../i18n';
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
    title: dict.company.careers.metaTitle,
    description: dict.company.careers.metaDescription,
    path: '/careers',
    locale,
    eyebrow: dict.company.careers.eyebrow,
  });
}

const CULTURE_ICONS = {
  correctness: CheckCircle2,
  ownership: Code2,
  documentation: FileText,
  honesty: ShieldCheck,
} as const;

export default async function CareersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const careers = dict.company.careers;
  const openings = await fetchOpenCareerListings(locale);

  return (
    <>
      {/* 1. Hero */}
      <Section surface="base" rhythm="default" bordered className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
        <Container>
          <div className="max-w-4xl space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full surface text-xs font-semibold text-[rgb(var(--text-secondary))]">
                <Briefcase className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
                <span>{careers.eyebrow}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-medium bg-secondary-100 text-secondary-800 border border-secondary-200">
                <span>{careers.phaseBadge}</span>
              </span>
            </div>

            <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              {careers.title}
            </h1>

            <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed max-w-3xl">
              {careers.subtitle}
            </p>
          </div>
        </Container>
      </Section>

      {/* 2. Open Positions (Data-driven from src/data/careers.ts) */}
      <Section surface="tinted" rhythm="default" bordered id="open-roles">
        <Container className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <SectionHeader
              align="left"
              eyebrow={careers.openings.eyebrow}
              title={careers.openings.title}
              subtitle={careers.openings.description}
            />
            {openings.length > 0 && (
              <p className="text-sm font-mono font-semibold text-primary-700 whitespace-nowrap">
                {formatNumber(openings.length, locale)}{' '}
                {openings.length === 1
                  ? careers.openings.countSingleSuffix
                  : careers.openings.countSuffix}
              </p>
            )}
          </div>

          {openings.length > 0 ? (
            <div className="space-y-4">
              {openings.map((role) => (
                <article
                  key={role.id}
                  className="surface rounded-2xl p-6 border border-[rgb(var(--border-base))] flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[rgb(var(--text-muted))]">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700">
                        <Users className="w-3 h-3" aria-hidden="true" />
                        {role.department}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                        {role.location}
                      </span>
                      <span>· {role.workMode}</span>
                      <span>· {role.employmentType}</span>
                    </div>

                    <h3 className="text-lg font-bold text-[rgb(var(--text-primary))]">
                      {role.title}
                    </h3>
                    <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
                      {role.summary}
                    </p>
                  </div>

                  <div className="shrink-0">
                    <ButtonLink
                      href={`/careers/${encodeURIComponent(role.slug)}`}
                      variant="secondary"
                      size="md"
                    >
                      {careers.openings.applyCta}
                      <ArrowRight className="w-4 h-4 ml-1.5" aria-hidden="true" />
                    </ButtonLink>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="surface rounded-2xl border border-[rgb(var(--border-base))] p-8 sm:p-10 text-center max-w-3xl mx-auto space-y-5">
              <div className="mx-auto w-12 h-12 rounded-xl bg-[rgb(var(--bg-muted))] border border-[rgb(var(--border-base))] flex items-center justify-center text-primary-600">
                <Briefcase className="w-6 h-6" aria-hidden="true" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-[rgb(var(--text-primary))]">
                  {careers.openings.empty.title}
                </h3>
                <p className="text-sm sm:text-base text-[rgb(var(--text-secondary))] leading-relaxed">
                  {careers.openings.empty.body}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <ButtonLink href="/contact" variant="primary" size="md">
                  {careers.openings.empty.primaryCta}
                </ButtonLink>
                <ButtonLink href="/about" variant="secondary" size="md">
                  {careers.openings.empty.secondaryCta}
                </ButtonLink>
              </div>
            </div>
          )}
        </Container>
      </Section>

      {/* 3. How We Work */}
      <Section surface="base" rhythm="default" bordered>
        <Container className="space-y-10">
          <SectionHeader
            align="left"
            eyebrow={careers.culture.eyebrow}
            title={careers.culture.title}
            subtitle={careers.culture.description}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {careers.culture.items.map((item) => {
              const Icon = CULTURE_ICONS[item.id];
              return (
                <FeatureCard
                  key={item.id}
                  icon={<Icon className="w-5 h-5" />}
                  title={item.title}
                  description={item.description}
                />
              );
            })}
          </div>
        </Container>
      </Section>

      {/* 4. CTA Band */}
      <CtaBand
        tone="dark"
        title={careers.cta.heading}
        description={careers.cta.body}
        actions={
          <>
            <ButtonLink
              href={`/signup`}
              variant="inverse"
              size="lg"
              trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
            >
              {careers.cta.primaryCta}
            </ButtonLink>
            <ButtonLink
              href="/contact"
              variant="outline"
              size="lg"
              className="border-primary-400 bg-transparent text-white hover:bg-primary-800 hover:text-white"
            >
              {careers.cta.secondaryCta}
            </ButtonLink>
          </>
        }
        footnote={dict.home.cta.footnote}
      />
    </>
  );
}
