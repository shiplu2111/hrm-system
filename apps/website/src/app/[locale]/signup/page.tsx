import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Sparkles } from 'lucide-react';
import { apiClient } from '../../../api/client';
import { Container, Section } from '../../../components/marketing';
import { StartFreeTrialForm } from '../../../components/signup/StartFreeTrialForm';
import { formatNumber, getDictionary, interpolate, resolveWebsiteLocale } from '../../../i18n';
import { getLegalDocument } from '../../../lib/legal';
import { buildPageMetadata } from '../../../lib/seo';

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  return buildPageMetadata({
    title: dict.signup.metaTitle,
    description: dict.signup.metaDescription,
    path: '/signup',
    locale,
    eyebrow: dict.signup.eyebrow,
  });
}

export default async function StartFreeTrialPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const copy = dict.signup;
  const termsDoc = getLegalDocument('terms');

  const [trialConfig, countries] = await Promise.all([
    apiClient.signup.getTrialConfig({ revalidate: 30 }),
    apiClient.countries.list({ revalidate: 60 }),
  ]);

  const heading = trialConfig
    ? interpolate(copy.title, { trialDays: formatNumber(trialConfig.trialDays, locale) })
    : copy.titleFallback;

  return (
    <Section surface="tinted" rhythm="default" className="relative overflow-hidden">
      <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
      <Container>
        <div className="max-w-xl mx-auto text-center space-y-4 mb-8">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full surface text-xs font-semibold text-[rgb(var(--text-secondary))]">
            <Sparkles className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
            <span>{copy.eyebrow}</span>
          </span>

          <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
            {heading}
          </h1>

          <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed">
            {copy.subtitle}
          </p>
        </div>

        <Suspense fallback={null}>
          <StartFreeTrialForm
            countries={countries}
            trialConfig={trialConfig}
            legalTermsVersion={termsDoc.version}
          />
        </Suspense>
      </Container>
    </Section>
  );
}
