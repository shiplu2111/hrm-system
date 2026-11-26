import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiClient } from '../../../../../api/client';
import {
  CountrySolutionTemplate,
  getSocialSecurityLabel,
} from '../../../../../components/solutions/CountrySolutionTemplate';
import { getDictionary, interpolate, resolveWebsiteLocale } from '../../../../../i18n';
import { buildPageMetadata } from '../../../../../lib/seo';

// Short ISR cache window so retired countries return 404 after cache refresh
export const revalidate = 10;
export const dynamicParams = true;

export async function generateStaticParams() {
  const countries = await apiClient.countries.list({ revalidate: 10 }).catch(() => []);
  return countries.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const country = await apiClient.countries.getBySlug(slug, { revalidate: 10 });

  if (!country) {
    return {};
  }

  const socialSecurity = getSocialSecurityLabel(
    country.statutorySupport.socialSecurityType,
    dict,
  );

  return buildPageMetadata({
    title: interpolate(dict.countries.detail.metaTitleTemplate, { country: country.name }),
    description: interpolate(dict.countries.detail.metaDescriptionTemplate, {
      country: country.name,
      currency: country.currency,
      socialSecurity,
    }),
    path: `/solutions/countries/${slug}`,
    locale,
    eyebrow: `${country.name} (${country.currency})`,
  });
}

export default async function CountrySolutionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const allActive = await apiClient.countries.list({ revalidate: 10 });
  const normalized = slug.trim().toLowerCase();
  const country =
    allActive.find(
      (c) => c.slug === normalized || c.isoCode.toLowerCase() === normalized,
    ) ?? null;

  if (!country) {
    notFound();
  }

  return (
    <CountrySolutionTemplate
      country={country}
      allActiveCountries={allActive}
      dict={dict}
    />
  );
}
