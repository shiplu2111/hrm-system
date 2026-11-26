import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  EyeOff,
  FileText,
  Globe2,
  Layers,
  Users,
} from 'lucide-react';
import { ButtonLink, Container, CtaBand, Section } from '../../../components/marketing';
import {
  getApprovedCaseStudies,
  hasApprovedCaseStudies,
} from '../../../data/case-studies';
import { getDictionary, resolveWebsiteLocale } from '../../../i18n';
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
  const meta = dict.customers.index;
  const isPublished = hasApprovedCaseStudies();

  return buildPageMetadata({
    title: meta.metaTitle,
    description: meta.metaDescription,
    path: '/customers',
    locale,
    eyebrow: dict.customers.article.breadcrumbRoot,
    noIndex: !isPublished,
  });
}

export default async function CustomersIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const copy = dict.customers.index;
  const cta = dict.customers.cta;
  const studies = getApprovedCaseStudies();
  const isPublished = studies.length > 0;

  return (
    <>
      {/* 1. Hero */}
      <Section surface="base" rhythm="default" bordered className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
        <Container>
          <div className="max-w-4xl space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full surface text-xs font-semibold text-[rgb(var(--text-secondary))]">
                <Building2 className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
                <span>{copy.eyebrow}</span>
              </span>

              {!isPublished && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-medium bg-warning-50 text-warning-800 border border-warning-200">
                  <EyeOff className="w-3.5 h-3.5 text-warning-700" aria-hidden="true" />
                  <span>{copy.hiddenBadge}</span>
                </span>
              )}
            </div>

            <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              {copy.title}
            </h1>

            <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed max-w-3xl">
              {copy.subtitle}
            </p>
          </div>
        </Container>
      </Section>

      {/* 2. Case Studies Grid or Honest Empty State */}
      <Section surface="tinted" rhythm="default" bordered>
        <Container>
          {isPublished ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {studies.map((study) => (
                <article
                  key={study.id}
                  className="surface rounded-2xl p-6 border border-[rgb(var(--border-base))] flex flex-col justify-between gap-6"
                >
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[rgb(var(--text-muted))]">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700">
                        {study.industry}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" aria-hidden="true" />
                        {study.companySize}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Globe2 className="w-3.5 h-3.5" aria-hidden="true" />
                        {study.country}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary-600 mb-1">
                        {study.companyName}
                      </p>
                      <h2 className="text-lg font-bold text-[rgb(var(--text-primary))] leading-snug">
                        {study.headline}
                      </h2>
                    </div>

                    <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
                      {study.summary}
                    </p>

                    {study.modulesUsed.length > 0 && (
                      <div className="pt-2 border-t border-[rgb(var(--border-subtle))]">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--text-muted))] mb-2 inline-flex items-center gap-1">
                          <Layers className="w-3 h-3" aria-hidden="true" />
                          {copy.card.modulesLabel}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {study.modulesUsed.map((mod) => (
                            <span
                              key={mod}
                              className="px-2 py-0.5 rounded text-xs bg-[rgb(var(--bg-muted))] text-[rgb(var(--text-secondary))]"
                            >
                              {mod}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <Link
                    href={`/customers/${study.slug}`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <span>{copy.card.readMoreLabel}</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="surface rounded-2xl border border-[rgb(var(--border-base))] p-8 sm:p-10 text-center max-w-3xl mx-auto space-y-5">
              <div className="mx-auto w-12 h-12 rounded-xl bg-[rgb(var(--bg-muted))] border border-[rgb(var(--border-base))] flex items-center justify-center text-primary-600">
                <FileText className="w-6 h-6" aria-hidden="true" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-[rgb(var(--text-primary))]">
                  {copy.empty.title}
                </h2>
                <p className="text-sm sm:text-base text-[rgb(var(--text-secondary))] leading-relaxed">
                  {copy.empty.body}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <ButtonLink href="/features" variant="primary" size="md">
                  {copy.empty.primaryCta}
                </ButtonLink>
                <ButtonLink href="/security" variant="secondary" size="md">
                  {copy.empty.secondaryCta}
                </ButtonLink>
              </div>
            </div>
          )}
        </Container>
      </Section>

      {/* 3. Closing CTA Band */}
      <CtaBand
        tone="dark"
        title={cta.heading}
        description={cta.body}
        actions={
          <>
            <ButtonLink
              href={`/signup`}
              variant="inverse"
              size="lg"
              trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
            >
              {cta.primaryCta}
            </ButtonLink>
            <ButtonLink
              href="/demo"
              variant="outline"
              size="lg"
              className="border-primary-400 bg-transparent text-white hover:bg-primary-800 hover:text-white"
            >
              {cta.secondaryCta}
            </ButtonLink>
          </>
        }
        footnote={dict.home.cta.footnote}
      />
    </>
  );
}
