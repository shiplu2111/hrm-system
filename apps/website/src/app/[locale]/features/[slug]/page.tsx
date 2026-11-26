import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FeatureDetailTemplate } from '../../../../components/features/FeatureDetailTemplate';
import { DEFAULT_LOCALE, getDictionary, resolveWebsiteLocale, SUPPORTED_LOCALES } from '../../../../i18n';
import type { FeaturePageSpec } from '../../../../i18n/dictionaries/features.en';
import { buildPageMetadata } from '../../../../lib/seo';

export const revalidate = 60;

export function generateStaticParams() {
  const dict = getDictionary(DEFAULT_LOCALE);
  const slugs = Object.keys(dict.features.pages);
  return SUPPORTED_LOCALES.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const spec = (dict.features.pages as Record<string, FeaturePageSpec>)[slug];
  if (!spec) {
    return {};
  }
  return buildPageMetadata({
    title: spec.title,
    description: spec.summary,
    path: `/features/${slug}`,
    locale,
    eyebrow: spec.eyebrow ?? 'Feature',
  });
}

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const spec = (dict.features.pages as Record<string, FeaturePageSpec>)[slug];

  if (!spec) {
    notFound();
  }

  return <FeatureDetailTemplate spec={spec} dict={dict} />;
}
