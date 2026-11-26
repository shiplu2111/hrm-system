import type { Metadata } from 'next';
import { LegalDocumentView } from '../../../components/legal/LegalDocumentView';
import { getDictionary, resolveWebsiteLocale } from '../../../i18n';
import { getLegalDocument } from '../../../lib/legal';
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
  const doc = getLegalDocument('terms');
  return buildPageMetadata({
    title: locale === 'bn' ? dict.legal.nav.terms : doc.title,
    description: doc.summary,
    path: '/terms',
    locale,
    eyebrow: locale === 'bn' ? 'আইনি নথি' : 'Legal',
  });
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const doc = getLegalDocument('terms');
  return <LegalDocumentView doc={doc} locale={locale} />;
}
