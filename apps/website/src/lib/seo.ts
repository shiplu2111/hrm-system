import type { Metadata } from 'next';
import { env } from '../env';
import {
  DEFAULT_LOCALE,
  LOCALE_OG_TAGS,
  localizePath,
  SUPPORTED_LOCALES,
  type WebsiteLocale,
} from '../i18n/types';
import type { FaqItem } from '../components/marketing/FaqAccordion';
import type { BreadcrumbItem } from '../components/help/HelpBreadcrumbs';

export function getSiteUrl(): string {
  return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
}

/**
 * Staging and non-production deployments are explicitly marked `noindex`.
 * Production indexing is active only when `NEXT_PUBLIC_APP_ENV === 'production'`
 * and staging/noindex overrides are absent.
 */
export function isIndexableProduction(): boolean {
  return (
    process.env.NEXT_PUBLIC_APP_ENV === 'production' &&
    process.env.SITE_IS_STAGING !== 'true' &&
    process.env.NEXT_PUBLIC_NOINDEX !== 'true'
  );
}

export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  const cleaned = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return cleaned.replace(/\/+$/, '') || '/';
}

export function absoluteUrl(pathname: string): string {
  const base = getSiteUrl();
  const path = normalizePathname(pathname);
  return path === '/' ? `${base}/` : `${base}${path}`;
}

export function buildHreflangLanguages(pathname: string): Record<string, string> {
  const normalized = normalizePathname(pathname);
  const languages: Record<string, string> = {};

  for (const loc of SUPPORTED_LOCALES) {
    if (loc === DEFAULT_LOCALE) {
      languages[loc] = absoluteUrl(normalized);
    } else {
      const prefixed = normalized === '/' ? `/${loc}` : `/${loc}${normalized}`;
      languages[loc] = absoluteUrl(prefixed);
    }
  }

  languages['x-default'] = absoluteUrl(normalized);
  return languages;
}

export function buildOgImageUrl(options: { title: string; eyebrow?: string }): string {
  const params = new URLSearchParams();
  params.set('title', options.title.slice(0, 96));
  if (options.eyebrow) {
    params.set('eyebrow', options.eyebrow.slice(0, 48));
  }
  return `${getSiteUrl()}/api/og?${params.toString()}`;
}

export interface PageMetadataInput {
  title: string;
  description: string;
  path: string;
  locale?: WebsiteLocale;
  eyebrow?: string;
  ogImageUrl?: string | null;
  type?: 'website' | 'article';
  noIndex?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
  alternatesTypes?: Record<string, string>;
}

/**
 * Standardized SEO metadata factory ensuring every route has a unique title,
 * meta description, canonical URL, hreflang links, Open Graph + Twitter cards
 * with dynamically generated OG images, and strict staging noindex enforcement.
 */
export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const localizedPath = localizePath(input.path, locale);
  const canonical = absoluteUrl(localizedPath);
  const languages = buildHreflangLanguages(input.path);
  const ogImage =
    input.ogImageUrl?.trim() ||
    buildOgImageUrl({
      title: input.title,
      eyebrow: input.eyebrow || 'CMSN-HR SaaS Platform',
    });

  const allowIndex = isIndexableProduction() && !input.noIndex;

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical,
      languages,
      ...(input.alternatesTypes ? { types: input.alternatesTypes } : {}),
    },
    robots: allowIndex
      ? {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      }
      : {
        index: false,
        follow: false,
        nocache: true,
      },
    openGraph: {
      type: input.type || 'website',
      locale: LOCALE_OG_TAGS[locale] ?? 'en_US',
      alternateLocale: SUPPORTED_LOCALES.filter((l) => l !== locale).map(
        (l) => LOCALE_OG_TAGS[l],
      ),
      url: canonical,
      siteName: 'CMSN-HR',
      title: input.title,
      description: input.description,
      ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
      ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: input.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      images: [ogImage],
    },
  };
}

export function buildOrganizationJsonLd() {
  const base = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'CMSN-HR',
    legalName: 'CMSN-HR SaaS Platform',
    url: base,
    logo: `${base}/icon.svg`,
    description:
      'Multi-tenant, country-configurable HR, payroll, and offline-first attendance SaaS platform engineered for financial accuracy.',
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'sales',
        url: `${base}/contact?topic=sales`,
      },
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        url: `${base}/help`,
      },
    ],
  };
}

export function buildSoftwareApplicationJsonLd(description: string) {
  const base = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'CMSN-HR',
    url: base,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    description,
    offers: {
      '@type': 'Offer',
      url: `${base}/pricing`,
      priceCurrency: 'USD',
      availability: 'https://schema.org/OnlineOnly',
    },
    publisher: {
      '@type': 'Organization',
      name: 'CMSN-HR',
      url: base,
    },
  };
}

export function buildFaqPageJsonLd(items: readonly FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      },
    })),
  };
}

export function buildBreadcrumbListJsonLd(items: readonly BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };
}

/**
 * Escapes HTML-significant characters inside JSON-LD `<script>` tags so
 * embedded strings like `</script>` cannot break out of the script element.
 */
export function safeJsonLdStringify(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
