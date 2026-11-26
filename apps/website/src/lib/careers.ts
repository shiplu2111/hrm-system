import 'server-only';

import type { CmsCareerDto, CmsCareerStatus, CmsLocale } from '@hrm/shared-types';
import { DEFAULT_LOCALE, type WebsiteLocale } from '../i18n/types';
import { fetchCmsJsonWithFallback } from './cms-resilient-cache';

export interface WebsiteCareerListing {
  readonly id: string;
  readonly slug: string;
  readonly status: CmsCareerStatus;
  readonly title: string;
  readonly department: string;
  readonly location: string;
  readonly workMode: string;
  readonly employmentType: string;
  readonly summary: string;
  readonly descriptionHtml: string;
  readonly applyEmail?: string;
  readonly applyUrl?: string;
  readonly publishedAt?: string;
  readonly closesAt?: string;
  readonly fallbackUsed: boolean;
}

function getServerApiBase(): string {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000'
  ).replace(/\/+$/, '');
}

type PublicCareerPayload = CmsCareerDto & {
  resolvedLocale: CmsLocale;
  fallbackUsed: boolean;
};

function mapCareer(raw: PublicCareerPayload, locale: WebsiteLocale): WebsiteCareerListing {
  const useBn = locale === 'bn' && raw.resolvedLocale === 'bn';
  return {
    id: raw.id,
    slug: raw.slug,
    status: raw.status,
    title: (useBn && raw.titleBn ? raw.titleBn : raw.titleEn).trim(),
    department: raw.department,
    location: raw.locationText,
    workMode: raw.locationType,
    employmentType: raw.employmentType,
    summary: (useBn && raw.summaryBn ? raw.summaryBn : raw.summaryEn).trim(),
    descriptionHtml:
      (useBn && raw.descriptionHtmlBn ? raw.descriptionHtmlBn : raw.descriptionHtmlEn) || '',
    applyEmail: raw.applyEmail?.trim() || undefined,
    applyUrl: raw.applyUrl?.trim() || undefined,
    publishedAt: raw.publishedAt || undefined,
    closesAt: raw.closesAt || undefined,
    fallbackUsed: Boolean(raw.fallbackUsed),
  };
}

export async function fetchOpenCareerListings(
  locale: WebsiteLocale = DEFAULT_LOCALE,
  department?: string,
): Promise<WebsiteCareerListing[]> {
  const params = new URLSearchParams({ locale });
  if (department) params.set('department', department);
  const queryString = params.toString();
  const res = await fetchCmsJsonWithFallback<{ data?: PublicCareerPayload[] }>({
    cacheKey: `cms:careers:list:${queryString}`,
    url: `${getServerApiBase()}/api/v1/public/content/careers?${queryString}`,
    revalidateSeconds: 30,
    tags: ['cms-careers'],
    timeoutMs: 2500,
    treat404AsAuthoritative: false,
  });

  if (!res.ok || !Array.isArray(res.data?.data)) return [];
  return res.data.data
    .filter((r) => r.status === 'open')
    .map((r) => mapCareer(r, locale));
}

export async function fetchCareerBySlug(
  slug: string,
  locale: WebsiteLocale = DEFAULT_LOCALE,
): Promise<WebsiteCareerListing | null> {
  const cleanSlug = slug.trim().toLowerCase();
  if (!cleanSlug) return null;
  const res = await fetchCmsJsonWithFallback<{ data?: PublicCareerPayload }>({
    cacheKey: `cms:career:${locale}:${cleanSlug}`,
    url: `${getServerApiBase()}/api/v1/public/content/careers/${encodeURIComponent(cleanSlug)}?locale=${locale}`,
    revalidateSeconds: 30,
    tags: ['cms-careers', `cms-career:${cleanSlug}`],
    timeoutMs: 2500,
    treat404AsAuthoritative: true,
  });

  if (!res.ok || !res.data?.data) return null;
  return mapCareer(res.data.data, locale);
}
