import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Container, Section } from '../../../../components/marketing';
import { VerifyEmailClient } from '../../../../components/signup/VerifyEmailClient';
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
    title: dict.signup.verify.metaTitle,
    description: dict.signup.verify.metaDescription,
    path: '/signup/verify',
    locale,
    noIndex: true,
  });
}

export default function VerifySignupPage() {
  return (
    <Section surface="tinted" rhythm="default" className="relative overflow-hidden">
      <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
      <Container>
        <Suspense fallback={null}>
          <VerifyEmailClient />
        </Suspense>
      </Container>
    </Section>
  );
}
