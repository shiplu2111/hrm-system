import type { Metadata } from 'next';
import { CtaBanner } from '@/components/CtaBanner';
import { Faq, pricingFaq } from '@/components/Faq';
import { ComparisonTable } from '@/components/pricing/ComparisonTable';
import { PricingPlans } from '@/components/pricing/PricingPlans';
import { PageHero, Section, SectionHeading } from '@/components/ui/Section';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'CMSN-HR plans for every stage: Starter, Business and Enterprise. Priced per company in BDT or USD, billed monthly or yearly.',
};

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Pick the plan that fits your team"
        description="Transparent pricing per company, not per user. Every plan includes the mobile app, guided onboarding and data migration."
      />

      <Section className="pt-14 sm:pt-16">
        <PricingPlans />
      </Section>

      <Section id="compare" className="bg-slate-50">
        <SectionHeading eyebrow="Compare plans" title="Everything that's included" />
        <div className="mt-12">
          <ComparisonTable />
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="FAQ" title="Buying CMSN-HR" />
        <div className="mt-12">
          <Faq items={pricingFaq} />
        </div>
      </Section>

      <CtaBanner title="Not sure which plan is right?" description="Tell us about your company and we'll recommend a plan and walk you through it live." />
    </>
  );
}
