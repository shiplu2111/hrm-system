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
  const doc = getLegalDocument('privacy');
  return buildPageMetadata({
    title: locale === 'bn' ? dict.legal.nav.privacy : doc.title,
    description: doc.summary,
    path: '/privacy',
    locale,
    eyebrow: locale === 'bn' ? 'আইনি ও গোপনীয়তা' : 'Legal & Privacy',
  });
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const doc = getLegalDocument('privacy');
  return <LegalDocumentView doc={doc} locale={locale} />;
}
