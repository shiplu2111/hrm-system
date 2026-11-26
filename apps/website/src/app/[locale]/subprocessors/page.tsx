import type { Metadata } from 'next';
import nextDynamic from 'next/dynamic';
import Link from 'next/link';
import { Calendar, CheckCircle2, Info, ShieldCheck } from 'lucide-react';
import { apiClient } from '../../../api/client';
import { Container, Section } from '../../../components/marketing';

const BlogSubscribeBox = nextDynamic(() =>
  import('../../../components/blog/BlogSubscribeBox').then((m) => m.BlogSubscribeBox),
);
import { formatDate, formatNumber, getDictionary, interpolate, localizePath, resolveWebsiteLocale } from '../../../i18n';
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
    title: dict.legal.subprocessors.title,
    description: dict.legal.subprocessors.subtitle,
    path: '/subprocessors',
    locale,
    eyebrow: dict.legal.subprocessors.eyebrow,
  });
}

export default async function SubprocessorsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const copy = dict.legal.subprocessors;
  const navCopy = dict.legal.nav;
  const data = await apiClient.legal.getSubprocessors({ cache: 'no-store' });

  const navItems = [
    { slug: 'terms', href: '/terms', label: navCopy.terms },
    { slug: 'privacy', href: '/privacy', label: navCopy.privacy },
    { slug: 'cookies', href: '/cookies', label: navCopy.cookies },
    { slug: 'dpa', href: '/dpa', label: navCopy.dpa },
    { slug: 'subprocessors', href: '/subprocessors', label: navCopy.subprocessors },
    { slug: 'security', href: '/security', label: navCopy.security },
  ];

  return (
    <>
      <Section surface="tinted" rhythm="default" className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
        <Container size="narrow">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full surface text-xs font-semibold text-[rgb(var(--text-secondary))]">
              <ShieldCheck className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
              <span>{copy.eyebrow}</span>
            </span>

            <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              {copy.title}
            </h1>

            <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed">
              {copy.subtitle}
            </p>

            {data && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <span
                  data-testid="subprocessors-last-updated"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full surface border border-[rgb(var(--border-base))] text-xs font-medium text-[rgb(var(--text-primary))]"
                >
                  <Calendar className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
                  <span>
                    {copy.lastUpdatedLabel}:{' '}
                    <strong className="font-mono">{formatDate(data.lastUpdated, locale)}</strong>
                  </span>
                </span>

                <span
                  data-testid="subprocessors-active-count"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-50 border border-success-200 text-xs font-semibold text-success-700"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  {interpolate(copy.activeCountLabel, { count: formatNumber(data.totalActive, locale) })}
                </span>
              </div>
            )}
          </div>
        </Container>
      </Section>

      <Section surface="base" rhythm="default">
        <Container size="narrow">
          <div className="space-y-10">
            {/* Cross Links */}
            <nav aria-label="Legal documents" className="flex flex-wrap gap-2 border-b border-[rgb(var(--border-base))] pb-4">
              {navItems.map((item) => {
                const active = item.slug === 'subprocessors';
                return (
                  <Link
                    key={item.href}
                    href={localizePath(item.href, locale)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${active
                      ? 'bg-primary-600 text-white'
                      : 'surface border border-[rgb(var(--border-base))] text-[rgb(var(--text-secondary))] hover:border-primary-400'
                      }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {!data ? (
              <div
                data-testid="subprocessors-unavailable"
                className="surface rounded-2xl border border-warning-200 bg-warning-50 p-6 text-sm text-warning-900"
              >
                {copy.unavailableFallback}
              </div>
            ) : (
              <>
                {/* Active Subprocessors List */}
                <section aria-labelledby="active-subprocessors-heading" className="space-y-4">
                  <h2
                    id="active-subprocessors-heading"
                    className="text-xl font-bold text-[rgb(var(--text-primary))]"
                  >
                    {copy.tableTitle}
                  </h2>

                  {data.subprocessors.length === 0 ? (
                    <div className="surface rounded-2xl border border-[rgb(var(--border-base))] p-6 text-sm text-[rgb(var(--text-muted))]">
                      No external third-party subprocessors are currently configured.
                    </div>
                  ) : (
                    <div data-testid="subprocessors-list" className="space-y-3">
                      {data.subprocessors.map((sub) => (
                        <article
                          key={sub.id}
                          data-testid={`subprocessor-card-${sub.id}`}
                          data-category={sub.category}
                          className="surface rounded-2xl border border-[rgb(var(--border-base))] p-5 sm:p-6 shadow-xs space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-bold text-[rgb(var(--text-primary))]">
                                {sub.name}
                              </h3>
                              <span className="px-2.5 py-0.5 rounded-full bg-primary-50 border border-primary-200 text-2xs font-semibold text-primary-700">
                                {sub.categoryLabel}
                              </span>
                            </div>
                            <span className="text-xs font-mono text-[rgb(var(--text-muted))]">
                              {sub.region}
                            </span>
                          </div>

                          <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
                            {sub.purpose}
                          </p>

                          <p className="text-xs text-[rgb(var(--text-muted))]">
                            <strong>{copy.tableHeaders.dataProcessed}:</strong> {sub.dataProcessed}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                {/* Categories Without External Vendors */}
                {data.unconfiguredCategories.length > 0 && (
                  <section aria-labelledby="unconfigured-heading" className="space-y-3">
                    <h2
                      id="unconfigured-heading"
                      className="text-sm font-bold uppercase tracking-wider text-[rgb(var(--text-muted))]"
                    >
                      {copy.unconfiguredTitle}
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {data.unconfiguredCategories.map((noteItem) => (
                        <div
                          key={noteItem.category}
                          data-testid={`subprocessor-unconfigured-${noteItem.category}`}
                          className="surface rounded-xl border border-[rgb(var(--border-base))] p-4 space-y-1 text-xs"
                        >
                          <div className="font-semibold text-[rgb(var(--text-primary))] flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-[rgb(var(--text-muted))]" aria-hidden="true" />
                            {noteItem.categoryLabel}
                          </div>
                          <p className="text-[rgb(var(--text-secondary))] leading-relaxed">
                            {noteItem.note}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            {/* Email Subscription for Subprocessor Changes */}
            <section aria-label={copy.subscribeHeading} data-testid="subprocessors-subscribe-section">
              <BlogSubscribeBox
                channel="subprocessors"
                headingOverride={copy.subscribeHeading}
                descriptionOverride={copy.subscribeDescription}
                consentPrefixOverride={copy.subscribeConsentPrefix}
              />
            </section>
          </div>
        </Container>
      </Section>
    </>
  );
}
