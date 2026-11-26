import type { Metadata } from 'next';
import nextDynamic from 'next/dynamic';
import { ArrowRight, CreditCard } from 'lucide-react';
import { apiClient } from '../../../api/client';
import {
  ButtonLink,
  Container,
  CtaBand,
  Section,
  SectionHeader,
} from '../../../components/marketing';
import { PricingInteractive } from '../../../components/pricing/PricingInteractive';

const FaqAccordion = nextDynamic(() =>
  import('../../../components/marketing/FaqAccordion').then((m) => m.FaqAccordion),
);
import { getDictionary, resolveWebsiteLocale } from '../../../i18n';
import { fetchPublicCmsFaqs } from '../../../lib/cms-faqs';
import { buildPageMetadata } from '../../../lib/seo';

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
    title: dict.pricing.metaTitle,
    description: dict.pricing.metaDescription,
    path: '/pricing',
    locale,
    eyebrow: dict.pricing.eyebrow,
  });
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const pricing = dict.pricing;
  const [plans, cmsFaqRes] = await Promise.all([
    apiClient.plans.list({ revalidate: 10 }),
    fetchPublicCmsFaqs({ locale, pageSlug: 'pricing' }),
  ]);
  const faqItems = cmsFaqRes.items.length > 0 ? cmsFaqRes.items : pricing.faq.items;

  return (
    <>
      {/* 1. Hero */}
      <Section surface="base" rhythm="default" bordered className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
        <Container>
          <div className="max-w-4xl space-y-6">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full surface text-xs font-semibold text-[rgb(var(--text-secondary))]">
              <CreditCard className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
              <span>{pricing.eyebrow}</span>
            </span>

            <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              {pricing.title}
            </h1>

            <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed max-w-3xl">
              {pricing.subtitle}
            </p>
          </div>
        </Container>
      </Section>

      {/* 2. Plans, Toggle, Currency Switcher, Calculator & Compare Matrix */}
      <PricingInteractive plans={plans} />

      {/* 3. Billing, Trial & Subscription FAQ */}
      {faqItems.length > 0 && (
        <Section surface="base" rhythm="default" bordered id="faq">
          <Container className="space-y-10">
            <SectionHeader
              align="left"
              eyebrow={pricing.faq.eyebrow}
              title={pricing.faq.title}
              subtitle={pricing.faq.subtitle}
            />
            <FaqAccordion items={faqItems} />
          </Container>
        </Section>
      )}

      {/* 4. Closing CTA Band */}
      <CtaBand
        tone="dark"
        title={pricing.cta.heading}
        description={pricing.cta.body}
        actions={
          <>
            <ButtonLink
              href={`/signup`}
              variant="inverse"
              size="lg"
              trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
            >
              {pricing.cta.primaryCta}
            </ButtonLink>
            <ButtonLink
              href="/contact?topic=sales&plan=enterprise"
              variant="outline"
              size="lg"
              className="border-primary-400 bg-transparent text-white hover:bg-primary-800 hover:text-white"
            >
              {pricing.cta.secondaryCta}
            </ButtonLink>
          </>
        }
        footnote={dict.home.cta.footnote}
      />
    </>
  );
}
