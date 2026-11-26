import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Globe2,
  Layers,
  Quote,
  Users,
} from 'lucide-react';
import { ButtonLink, Container, CtaBand, Section } from '../../../../components/marketing';
import {
  getApprovedCaseStudies,
  getApprovedCaseStudyBySlug,
  hasApprovedCaseStudies,
} from '../../../../data/case-studies';
import { getDictionary, resolveWebsiteLocale, SUPPORTED_LOCALES } from '../../../../i18n';
import { buildPageMetadata } from '../../../../lib/seo';

export const revalidate = 60;

interface CaseStudyPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams(): Promise<Array<{ locale: string; slug: string }>> {
  const studies = getApprovedCaseStudies();
  return SUPPORTED_LOCALES.flatMap((locale) =>
    studies.map((study) => ({
      locale,
      slug: study.slug,
    })),
  );
}

export async function generateMetadata({ params }: CaseStudyPageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const study = getApprovedCaseStudyBySlug(slug);
  const isPublished = hasApprovedCaseStudies();

  if (!study || !isPublished) {
    return buildPageMetadata({
      title: 'Case Study | CMSN-HR',
      description: 'Verified customer story from CMSN-HR.',
      path: `/customers/${slug}`,
      locale,
      noIndex: true,
    });
  }

  return buildPageMetadata({
    title: `${study.companyName} Case Study | CMSN-HR`,
    description: study.summary,
    path: `/customers/${slug}`,
    locale,
    eyebrow: 'Customer Story',
    type: 'article',
  });
}

export default async function CaseStudyArticlePage({ params }: CaseStudyPageProps) {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const study = getApprovedCaseStudyBySlug(slug);

  if (!study) {
    notFound();
  }

  const dict = getDictionary(locale);
  const tArticle = dict.customers.article;
  const cta = dict.customers.cta;

  return (
    <>
      {/* 1. Article Hero & Metadata Strip */}
      <Section surface="base" rhythm="default" bordered className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
        <Container className="space-y-6">
          <nav aria-label="Breadcrumb" className="text-xs font-medium text-[rgb(var(--text-muted))]">
            <Link
              href="/customers"
              className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-700 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{tArticle.backToIndex}</span>
            </Link>
          </nav>

          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[rgb(var(--text-secondary))]">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full surface font-semibold">
              <Building2 className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
              {study.companyName}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-primary-50 text-primary-700">
              {study.industry}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[rgb(var(--bg-muted))]">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              {study.readTimeMinutes} {tArticle.readTimeSuffix}
            </span>
          </div>

          <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))] max-w-4xl">
            {study.headline}
          </h1>

          <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed max-w-3xl">
            {study.summary}
          </p>

          {study.highlights.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              {study.highlights.map((metric) => (
                <div
                  key={metric.label}
                  className="surface rounded-2xl p-5 border border-[rgb(var(--border-base))] space-y-1"
                >
                  <p className="text-2xl font-bold text-primary-700">{metric.value}</p>
                  <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">
                    {metric.label}
                  </p>
                  {metric.detail && (
                    <p className="text-xs text-[rgb(var(--text-muted))]">{metric.detail}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Container>
      </Section>

      {/* 2. Article Body & Snapshot Sidebar */}
      <Section surface="tinted" rhythm="default" bordered>
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8 space-y-10">
              <article className="space-y-4">
                <h2 className="text-2xl font-bold text-[rgb(var(--text-primary))]">
                  {study.challenge.heading}
                </h2>
                <div className="space-y-4 text-base text-[rgb(var(--text-secondary))] leading-relaxed">
                  {study.challenge.paragraphs.map((p, idx) => (
                    <p key={idx}>{p}</p>
                  ))}
                </div>
              </article>

              <article className="space-y-4">
                <h2 className="text-2xl font-bold text-[rgb(var(--text-primary))]">
                  {study.solution.heading}
                </h2>
                <div className="space-y-4 text-base text-[rgb(var(--text-secondary))] leading-relaxed">
                  {study.solution.paragraphs.map((p, idx) => (
                    <p key={idx}>{p}</p>
                  ))}
                </div>
              </article>

              <article className="space-y-4">
                <h2 className="text-2xl font-bold text-[rgb(var(--text-primary))]">
                  {study.results.heading}
                </h2>
                <div className="space-y-4 text-base text-[rgb(var(--text-secondary))] leading-relaxed">
                  {study.results.paragraphs.map((p, idx) => (
                    <p key={idx}>{p}</p>
                  ))}
                </div>

                {study.results.outcomes.length > 0 && (
                  <div className="surface rounded-2xl p-6 border border-[rgb(var(--border-base))] space-y-3 mt-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-primary-700">
                      {tArticle.outcomesHeading}
                    </h3>
                    <ul className="space-y-2.5">
                      {study.results.outcomes.map((outcome) => (
                        <li
                          key={outcome}
                          className="flex items-start gap-2.5 text-sm text-[rgb(var(--text-secondary))]"
                        >
                          <CheckCircle2
                            className="w-4 h-4 text-success-600 shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span>{outcome}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>

              {study.quote?.approved && (
                <blockquote className="surface rounded-2xl p-6 sm:p-8 border-l-4 border-l-primary-600 space-y-4">
                  <Quote className="w-6 h-6 text-primary-500" aria-hidden="true" />
                  <p className="text-lg font-medium text-[rgb(var(--text-primary))] leading-relaxed">
                    &ldquo;{study.quote.text}&rdquo;
                  </p>
                  <footer className="text-sm text-[rgb(var(--text-secondary))]">
                    <span className="font-semibold text-[rgb(var(--text-primary))]">
                      {study.quote.attributionName}
                    </span>{' '}
                    &mdash; {study.quote.attributionRole}, {study.companyName}
                  </footer>
                </blockquote>
              )}
            </div>

            {/* Sidebar Snapshot */}
            <aside className="lg:col-span-4 space-y-6">
              <div className="surface rounded-2xl p-6 border border-[rgb(var(--border-base))] space-y-5 lg:sticky lg:top-24">
                <h2 className="text-base font-bold text-[rgb(var(--text-primary))]">
                  {tArticle.organizationSnapshot}
                </h2>

                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-xs font-medium text-[rgb(var(--text-muted))]">
                      {tArticle.industryLabel}
                    </dt>
                    <dd className="font-medium text-[rgb(var(--text-primary))] mt-0.5">
                      {study.industry}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-medium text-[rgb(var(--text-muted))]">
                      {tArticle.sizeLabel}
                    </dt>
                    <dd className="font-medium text-[rgb(var(--text-primary))] mt-0.5 inline-flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
                      {study.companySize}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-medium text-[rgb(var(--text-muted))]">
                      {tArticle.countryLabel}
                    </dt>
                    <dd className="font-medium text-[rgb(var(--text-primary))] mt-0.5 inline-flex items-center gap-1.5">
                      <Globe2 className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
                      {study.country}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-medium text-[rgb(var(--text-muted))]">
                      {tArticle.publishedLabel}
                    </dt>
                    <dd className="font-mono text-xs text-[rgb(var(--text-secondary))] mt-0.5">
                      {study.publishedAt}
                    </dd>
                  </div>
                </dl>

                {study.modulesUsed.length > 0 && (
                  <div className="pt-4 border-t border-[rgb(var(--border-subtle))] space-y-2.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-muted))] inline-flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                      {tArticle.modulesUsedHeading}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {study.modulesUsed.map((mod) => (
                        <span
                          key={mod}
                          className="px-2.5 py-1 rounded text-xs font-medium bg-[rgb(var(--bg-muted))] text-[rgb(var(--text-secondary))]"
                        >
                          {mod}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
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
