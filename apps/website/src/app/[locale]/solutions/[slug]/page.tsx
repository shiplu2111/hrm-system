import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SolutionSegmentTemplate } from '../../../../components/solutions/SolutionSegmentTemplate';
import {
  DEFAULT_LOCALE,
  getDictionary,
  resolveWebsiteLocale,
  SUPPORTED_LOCALES,
  type WebsiteDictionary,
} from '../../../../i18n';
import type { SolutionSegmentSpec, SolutionSlug } from '../../../../i18n/dictionaries/solutions.en';
import { buildPageMetadata } from '../../../../lib/seo';

export const revalidate = 60;

function findSegmentSpec(slug: string, dict: WebsiteDictionary): SolutionSegmentSpec | null {
  const segments = dict.solutions.segments;
  if (Object.prototype.hasOwnProperty.call(segments, slug)) {
    return segments[slug as SolutionSlug];
  }
  return null;
}

export function generateStaticParams() {
  const dict = getDictionary(DEFAULT_LOCALE);
  const slugs = Object.keys(dict.solutions.segments);
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
  const spec = findSegmentSpec(slug, dict);
  if (!spec) {
    return {};
  }
  return buildPageMetadata({
    title: spec.title,
    description: spec.summary,
    path: `/solutions/${slug}`,
    locale,
    eyebrow: spec.eyebrow ?? 'Solutions',
  });
}

export default async function SolutionSegmentPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const spec = findSegmentSpec(slug, dict);

  if (!spec) {
    notFound();
  }

  return <SolutionSegmentTemplate spec={spec} dict={dict} />;
}
