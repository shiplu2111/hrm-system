import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Coins,
  FileSpreadsheet,
  Globe2,
  ShieldCheck,
} from 'lucide-react';
import type { PublicCountry } from '../../api/types';
import { interpolate, type WebsiteDictionary } from '../../i18n';
import { ButtonLink, Container, CtaBand, LocaleLink, Section, SectionHeader } from '../marketing';

export function formatPayFrequency(freq: string, dict: WebsiteDictionary): string {
  const key = freq.toLowerCase() as keyof WebsiteDictionary['countries']['frequencies'];
  return dict.countries.frequencies[key] ?? freq.replace(/_/g, ' ');
}

export function getSocialSecurityLabel(
  socialSecurityType: PublicCountry['statutorySupport']['socialSecurityType'],
  dict: WebsiteDictionary,
): string {
  const items = dict.countries.detail.statutorySection.items.socialSecurity;
  if (socialSecurityType === 'superannuation') return items.titleSuperannuation;
  if (socialSecurityType === 'pension') return items.titlePension;
  return items.titleDefault;
}

interface CountrySolutionTemplateProps {
  country: PublicCountry;
  allActiveCountries: PublicCountry[];
  dict: WebsiteDictionary;
}

export function CountrySolutionTemplate({
  country,
  allActiveCountries,
  dict,
}: CountrySolutionTemplateProps) {
  const c = dict.countries.detail;
  const statutory = c.statutorySection;
  const socialSecurityLabel = getSocialSecurityLabel(country.statutorySupport.socialSecurityType, dict);
  const formattedFrequencies = country.payFrequencies.map((f) => formatPayFrequency(f, dict)).join(', ');
  const otherCountries = allActiveCountries.filter((item) => item.slug !== country.slug);

  const statutoryCards = [
    {
      key: 'tax',
      icon: FileSpreadsheet,
      title: statutory.items.tax.title,
      supported: country.statutorySupport.tax,
      description: country.statutorySupport.tax
        ? statutory.items.tax.supportedDesc
        : statutory.items.tax.configurableDesc,
    },
    {
      key: 'socialSecurity',
      icon: ShieldCheck,
      title: socialSecurityLabel,
      supported: country.statutorySupport.socialSecurityOrSuperannuation,
      description: country.statutorySupport.socialSecurityOrSuperannuation
        ? statutory.items.socialSecurity.supportedDesc
        : statutory.items.socialSecurity.configurableDesc,
    },
    {
      key: 'leave',
      icon: CalendarDays,
      title: statutory.items.leave.title,
      supported: country.statutorySupport.statutoryLeave,
      description: country.statutorySupport.statutoryLeave
        ? statutory.items.leave.supportedDesc
        : statutory.items.leave.configurableDesc,
    },
    {
      key: 'publicHolidays',
      icon: Globe2,
      title: statutory.items.publicHolidays.title,
      supported: country.statutorySupport.publicHolidays,
      description: country.statutorySupport.publicHolidays
        ? statutory.items.publicHolidays.supportedDesc
        : statutory.items.publicHolidays.configurableDesc,
    },
  ];

  return (
    <>
      {/* 1. Country Hero */}
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
            <span className="text-[rgb(var(--text-secondary))]">{c.breadcrumbSolutions}</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            <LocaleLink
              href="/solutions/countries"
              className="hover:text-primary-600 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {c.breadcrumbCountries}
            </LocaleLink>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="text-[rgb(var(--text-primary))] font-semibold">{country.name}</span>
          </nav>

          <div className="max-w-4xl space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full surface text-xs font-semibold text-[rgb(var(--text-secondary))]">
                <Globe2 className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
                <span>{interpolate(c.eyebrow, { isoCode: country.isoCode })}</span>
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-semibold bg-success-50 text-success-700 border border-success-200">
                {c.activeBadge}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-mono font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                <Coins className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{country.currency}</span>
              </span>
            </div>

            <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              {interpolate(c.headlineTemplate, { country: country.name })}
            </h1>

            <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed max-w-3xl">
              {interpolate(c.summaryTemplate, {
                country: country.name,
                currency: country.currency,
              })}
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <ButtonLink
                href={`/signup?country=${encodeURIComponent(country.isoCode)}`}
                variant="primary"
                size="lg"
                trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
              >
                {c.cta.primaryLabel}
              </ButtonLink>
              <ButtonLink href="/demo" variant="outline" size="lg">
                {c.cta.secondaryLabel}
              </ButtonLink>
            </div>
          </div>

          {/* Key Country Configuration Strip */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="surface rounded-xl p-5">
              <p className="text-xs font-medium text-[rgb(var(--text-muted))]">{c.facts.currencyLabel}</p>
              <p className="mt-1.5 font-mono text-2xl font-bold text-[rgb(var(--text-primary))]">
                {country.currency}
              </p>
            </div>
            <div className="surface rounded-xl p-5">
              <p className="text-xs font-medium text-[rgb(var(--text-muted))]">{c.facts.frequenciesLabel}</p>
              <p className="mt-1.5 text-lg font-semibold text-[rgb(var(--text-primary))]">
                {formattedFrequencies}
              </p>
            </div>
            <div className="surface rounded-xl p-5">
              <p className="text-xs font-medium text-[rgb(var(--text-muted))]">{c.facts.statesLabel}</p>
              <p className="mt-1.5 text-lg font-semibold text-[rgb(var(--text-primary))]">
                {country.statesCount > 0
                  ? interpolate(c.facts.statesValueTemplate, { count: country.statesCount })
                  : c.facts.statesFallback}
              </p>
            </div>
            <div className="surface rounded-xl p-5">
              <p className="text-xs font-medium text-[rgb(var(--text-muted))]">{c.facts.statusLabel}</p>
              <p className="mt-1.5 text-lg font-semibold text-success-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{c.facts.statusActiveValue}</span>
              </p>
            </div>
          </div>
        </Container>
      </Section>

      {/* 2. Statutory Capabilities Supported */}
      <Section surface="surface" rhythm="default" bordered>
        <Container>
          <SectionHeader
            align="left"
            eyebrow={statutory.eyebrow}
            title={interpolate(statutory.titleTemplate, { country: country.name })}
            subtitle={statutory.subtitle}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {statutoryCards.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.key} className="surface rounded-xl p-6 sm:p-8 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="w-11 h-11 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center border border-primary-100 shrink-0">
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-semibold border ${
                        item.supported
                          ? 'bg-success-50 text-success-700 border-success-200'
                          : 'bg-primary-50 text-primary-700 border-primary-200'
                      }`}
                    >
                      {item.supported ? statutory.supportedLabel : statutory.configurableLabel}
                    </span>
                  </div>

                  <h3 className="text-xl font-semibold text-[rgb(var(--text-primary))]">{item.title}</h3>
                  <p className="text-sm sm:text-base text-[rgb(var(--text-secondary))] leading-relaxed">
                    {item.description}
                  </p>
                </article>
              );
            })}
          </div>

          {/* Help Center Statutory Reference Policy (No printed tax rates!) */}
          <div className="mt-10 rounded-xl border border-primary-200 bg-primary-50/60 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary-700">
                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{c.helpCenterNotice.badge}</span>
              </span>
              <h3 className="text-lg sm:text-xl font-semibold text-[rgb(var(--text-primary))]">
                {c.helpCenterNotice.title}
              </h3>
              <p className="text-sm sm:text-base text-[rgb(var(--text-secondary))] leading-relaxed">
                {c.helpCenterNotice.description}
              </p>
            </div>
            <div className="shrink-0">
              <ButtonLink
                href={`/help?category=country-compliance&country=${encodeURIComponent(country.slug)}`}
                variant="outline"
                size="md"
                trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
              >
                {c.helpCenterNotice.cta}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </Section>

      {/* 3. Other Active Countries Switcher */}
      {otherCountries.length > 0 && (
        <Section surface="muted" rhythm="compact" bordered>
          <Container>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[rgb(var(--text-primary))]">
                  {c.otherCountries.heading}
                </h2>
                <p className="text-sm text-[rgb(var(--text-secondary))]">{c.otherCountries.subtitle}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {otherCountries.map((other) => (
                  <LocaleLink
                    key={other.id}
                    href={`/solutions/countries/${other.slug}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg surface text-sm font-semibold text-[rgb(var(--text-primary))] hover:border-primary-300 hover:text-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <span>{other.name}</span>
                    <span className="font-mono text-xs text-[rgb(var(--text-muted))]">{other.currency}</span>
                  </LocaleLink>
                ))}
              </div>
            </div>
          </Container>
        </Section>
      )}

      {/* 4. Closing CTA Band */}
      <CtaBand
        tone="dark"
        eyebrow={interpolate(c.cta.eyebrowTemplate, { country: country.name })}
        title={interpolate(c.cta.titleTemplate, {
          country: country.name,
          currency: country.currency,
        })}
        description={c.cta.description}
        actions={
          <>
            <ButtonLink
              href={`/signup?country=${encodeURIComponent(country.isoCode)}`}
              variant="inverse"
              size="lg"
              trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
            >
              {c.cta.primaryLabel}
            </ButtonLink>
            <ButtonLink
              href="/demo"
              variant="outline"
              size="lg"
              className="border-primary-400 bg-transparent text-white hover:bg-primary-800 hover:text-white"
            >
              {c.cta.secondaryLabel}
            </ButtonLink>
          </>
        }
        footnote={dict.home.cta.footnote}
      />
    </>
  );
}
