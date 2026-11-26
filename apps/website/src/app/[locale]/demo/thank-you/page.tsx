import { Suspense } from 'react';
import type { Metadata } from 'next';
import { DemoThankYouClient } from '../../../../components/leads/DemoThankYouClient';
import { Container, Section } from '../../../../components/marketing';
import { getDictionary, resolveWebsiteLocale } from '../../../../i18n';
import { buildPageMetadata } from '../../../../lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  return buildPageMetadata({
    title: dict.leads.demo.thankYou.metaTitle,
    description: dict.leads.demo.thankYou.metaDescription,
    path: '/demo/thank-you',
    locale,
    noIndex: true,
  });
}

export default function DemoThankYouPage() {
  return (
    <Section surface="tinted" rhythm="default" className="relative overflow-hidden">
      <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
      <Container>
        <Suspense fallback={null}>
          <DemoThankYouClient />
        </Suspense>
      </Container>
    </Section>
  );
}
