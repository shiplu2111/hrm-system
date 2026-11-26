import type {
  CmsPageKind,
  CmsPublicSitemapPageDto,
  CmsResolvedPageDto,
} from '@hrm/shared-types';
import type { WebsiteLocale } from '../i18n/types';
import { fetchCmsJsonWithFallback } from './cms-resilient-cache';
import {
  getBundledSystemPageDefault,
  isCmsSystemSlug,
  listBundledSystemSitemapPages,
} from './cms-system-defaults';

function getWebsiteApiBase(): string {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000'
  ).replace(/\/+$/, '');
}

function normalizePageSlug(slug: string): string {
  const cleaned = slug.trim().replace(/^\/+|\/+$/g, '').toLowerCase();
  return cleaned || 'home';
}

export async function fetchPublishedCmsPageBySlug(
  slug: string,
  locale: WebsiteLocale,
): Promise<CmsResolvedPageDto | null> {
  const normalizedSlug = normalizePageSlug(slug);
  const apiBase = getWebsiteApiBase();
  const res = await fetchCmsJsonWithFallback<{ data?: CmsResolvedPageDto }>({
    cacheKey: `cms:page:${locale}:${normalizedSlug}`,
    url: `${apiBase}/api/v1/public/content/pages/${encodeURIComponent(normalizedSlug)}?locale=${encodeURIComponent(locale)}`,
    revalidateSeconds: 60,
    tags: ['cms-pages', `cms-page:${normalizedSlug}`],
    timeoutMs: 3000,
    treat404AsAuthoritative: true,
  });

  if (res.ok && res.data?.data) {
    return res.data.data;
  }

  // If the CMS API has no live/cached record (unreachable on cold cache or unimported system page),
  // seamlessly serve bundled Stage A.4 default content for system pages so they never blank or 500.
  if (isCmsSystemSlug(normalizedSlug)) {
    return getBundledSystemPageDefault(normalizedSlug, locale);
  }

  return null;
}

export async function fetchAllPublishedCmsPages(
  kind?: CmsPageKind,
): Promise<CmsPublicSitemapPageDto[]> {
  const apiBase = getWebsiteApiBase();
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  const res = await fetchCmsJsonWithFallback<{ data?: CmsPublicSitemapPageDto[] }>({
    cacheKey: `cms:pages:list:${kind || 'all'}`,
    url: `${apiBase}/api/v1/public/content/pages${query}`,
    revalidateSeconds: 60,
    tags: ['cms-pages'],
    timeoutMs: 3000,
    treat404AsAuthoritative: false,
  });

  if (res.ok && Array.isArray(res.data?.data)) {
    return res.data.data;
  }

  return kind === 'custom' ? [] : listBundledSystemSitemapPages();
}

export async function fetchCmsPreviewByToken(
  token: string,
  locale: WebsiteLocale,
): Promise<CmsResolvedPageDto | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const apiBase = getWebsiteApiBase();
  try {
    const res = await fetch(
      `${apiBase}/api/v1/public/content/preview?token=${encodeURIComponent(trimmed)}&locale=${encodeURIComponent(locale)}`,
      { cache: 'no-store', signal: AbortSignal.timeout(3500) },
    );
    if (!res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as {
      data?: CmsResolvedPageDto;
    };
    return body.data ?? null;
  } catch {
    return null;
  }
}
