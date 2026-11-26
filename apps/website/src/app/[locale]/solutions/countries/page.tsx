import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, CheckCircle2, Coins, Globe2 } from 'lucide-react';
import { apiClient } from '../../../../api/client';
import {
  ButtonLink,
  Container,
  CtaBand,
  Hero,
  Section,
  SectionHeader,
} from '../../../../components/marketing';
import { CountrySelector } from '../../../../components/solutions/CountrySelector';
import {
  formatPayFrequency,
  getSocialSecurityLabel,
} from '../../../../components/solutions/CountrySolutionTemplate';
import {
  createTranslator,
  formatNumber,
  getDictionary,
  interpolate,
  resolveWebsiteLocale,
} from '../../../../i18n';
import { buildPageMetadata } from '../../../../lib/seo';

// Short cache window so retiring a country in Platform Admin removes it promptly
export const revalidate = 10;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  return buildPageMetadata({
    title: dict.countries.index.metaTitle,
    description: dict.countries.index.metaDescription,
    path: '/solutions/countries',
    locale,
    eyebrow: dict.countries.index.eyebrow,
  });
}

export default async function CountriesIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const t = createTranslator(dict);
  const countries = await apiClient.countries.list({ revalidate: 10 });

  return (
    <>
      <Hero
        layout="centered"
        eyebrow={t('countries.index.eyebrow')}
        eyebrowTag={interpolate(dict.countries.index.activeCountBadge, {
          count: formatNumber(countries.length, locale),
        })}
        title={t('countries.index.title')}
        subtitle={t('countries.index.subtitle')}
        visual={<CountrySelector countries={countries} />}
      />

      {/* Active Countries Grid */}
      <Section surface="surface" rhythm="default" bordered>
        <Container>
          {countries.length === 0 ? (
            <div className="surface rounded-2xl p-10 text-center max-w-xl mx-auto space-y-4">
              <div className="w-12 h-12 rounded-lg bg-secondary-100 text-secondary-600 flex items-center justify-center mx-auto">
                <Globe2 className="w-6 h-6" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-semibold text-[rgb(var(--text-primary))]">
                {t('countries.index.emptyTitle')}
              </h2>
              <p className="text-sm sm:text-base text-[rgb(var(--text-secondary))]">
                {t('countries.index.emptyDescription')}
              </p>
              <div className="pt-2">
                <ButtonLink href="/demo" variant="primary" size="md">
                  {t('countries.index.emptyCta')}
                </ButtonLink>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {countries.map((country) => {
                const frequencies = country.payFrequencies
                  .map((f) => formatPayFrequency(f, dict))
                  .join(', ');
                const socialSecurityTitle = getSocialSecurityLabel(
                  country.statutorySupport.socialSecurityType,
                  dict,
                );

                const statutoryItems = [
                  {
                    label: dict.countries.detail.statutorySection.items.tax.title,
                    enabled: country.statutorySupport.tax,
                  },
                  {
                    label: socialSecurityTitle,
                    enabled: country.statutorySupport.socialSecurityOrSuperannuation,
                  },
                  {
                    label: dict.countries.detail.statutorySection.items.leave.title,
                    enabled: country.statutorySupport.statutoryLeave,
                  },
                  {
                    label: dict.countries.detail.statutorySection.items.publicHolidays.title,
                    enabled: country.statutorySupport.publicHolidays,
                  },
                ];

                return (
                  <article
                    key={country.id}
                    className="surface rounded-xl p-6 sm:p-8 flex flex-col justify-between transition-shadow hover:shadow-card-hover"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <span className="font-mono text-xs font-semibold text-primary-600">
                            {country.isoCode}
                          </span>
                          <h2 className="text-2xl font-semibold text-[rgb(var(--text-primary))]">
                            <Link
                              href={`/solutions/countries/${country.slug}`}
                              className="hover:text-primary-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded"
                            >
                              {country.name}
                            </Link>
                          </h2>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-mono font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                          <Coins className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{country.currency}</span>
                        </span>
                      </div>

                      <div className="py-3 border-y border-[rgb(var(--border-base))] grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-[rgb(var(--text-muted))] block">
                            {t('countries.index.cardCurrencyLabel')}
                          </span>
                          <span className="font-mono font-semibold text-[rgb(var(--text-primary))]">
                            {country.currency}
                          </span>
                        </div>
                        <div>
                          <span className="text-[rgb(var(--text-muted))] block">
                            {t('countries.index.cardFrequenciesLabel')}
                          </span>
                          <span className="font-semibold text-[rgb(var(--text-primary))]">{frequencies}</span>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-muted))]">
                          {t('countries.index.cardStatutoryLabel')}
                        </p>
                        <ul className="space-y-1.5">
                          {statutoryItems.map((item) => (
                            <li
                              key={item.label}
                              className="flex items-center gap-2 text-sm text-[rgb(var(--text-primary))]"
                            >
                              <CheckCircle2
                                className={`w-4 h-4 shrink-0 ${
                                  item.enabled ? 'text-success-600' : 'text-secondary-400'
                                }`}
                                aria-hidden="true"
                              />
                              <span>{item.label}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-[rgb(var(--border-base))] flex flex-col gap-2.5">
                      <ButtonLink
                        href={`/solutions/countries/${country.slug}`}
                        variant="outline"
                        size="md"
                        className="w-full"
                        trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
                      >
                        {t('countries.index.cardViewDetailsCta')}
                      </ButtonLink>
                      <ButtonLink
                        href={`/signup?country=${encodeURIComponent(country.isoCode)}`}
                        variant="primary"
                        size="md"
                        className="w-full"
                      >
                        {t('countries.index.cardTrialCta')}
                      </ButtonLink>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Help Center Statutory Reference Notice */}
          <div className="mt-12 rounded-xl border border-primary-200 bg-primary-50/60 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary-700">
                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('countries.detail.helpCenterNotice.badge')}</span>
              </span>
              <SectionHeader
                align="left"
                title={t('countries.detail.helpCenterNotice.title')}
                subtitle={t('countries.detail.helpCenterNotice.description')}
                className="mb-0 md:mb-0"
              />
            </div>
            <div className="shrink-0">
              <ButtonLink
                href="/help?category=country-compliance"
                variant="outline"
                size="md"
                trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
              >
                {t('countries.detail.helpCenterNotice.cta')}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </Section>

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
