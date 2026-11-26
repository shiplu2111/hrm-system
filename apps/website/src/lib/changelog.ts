import 'server-only';

import type { CmsChangelogEntryDto, CmsChangelogTag, CmsLocale } from '@hrm/shared-types';
import { DEFAULT_LOCALE, type WebsiteLocale } from '../i18n/types';
import { fetchCmsJsonWithFallback } from './cms-resilient-cache';

export type ChangelogTag = 'New' | 'Improved' | 'Fixed';

export interface ChangelogEntry {
  readonly id: string;
  readonly slug: string;
  readonly date: string;
  readonly tag: ChangelogTag;
  readonly title: string;
  readonly summary: string;
  readonly contentHtml?: string;
  readonly details: readonly string[];
  readonly area?: string;
  readonly fallbackUsed?: boolean;
}

function getServerApiBase(): string {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000'
  ).replace(/\/+$/, '');
}

function mapCmsTagToUiTag(tag: CmsChangelogTag): ChangelogTag {
  switch (tag) {
    case 'new':
      return 'New';
    case 'fixed':
      return 'Fixed';
    case 'improved':
    case 'security':
    default:
      return 'Improved';
  }
}

type PublicChangelogItem = CmsChangelogEntryDto & {
  resolvedLocale: CmsLocale;
  fallbackUsed: boolean;
};

export async function fetchPublishedChangelogEntries(
  locale: WebsiteLocale = DEFAULT_LOCALE,
  options?: { tag?: ChangelogTag | 'all' },
): Promise<ChangelogEntry[]> {
  const params = new URLSearchParams({
    locale,
    page: '1',
    pageSize: '50',
  });
  if (options?.tag && options.tag !== 'all') {
    params.set('tag', options.tag.toLowerCase());
  }

  const queryString = params.toString();
  const res = await fetchCmsJsonWithFallback<{ data?: PublicChangelogItem[] }>({
    cacheKey: `cms:changelog:${queryString}`,
    url: `${getServerApiBase()}/api/v1/public/content/changelog?${queryString}`,
    revalidateSeconds: 30,
    tags: ['cms-changelog'],
    timeoutMs: 2500,
    treat404AsAuthoritative: false,
  });

  if (!res.ok || !Array.isArray(res.data?.data)) return [];
  const rows = res.data.data;

    return rows
      .filter((r) => r.isPublished)
      .map((entry) => {
        const useBn = locale === 'bn' && entry.resolvedLocale === 'bn';
        const title = (useBn && entry.titleBn ? entry.titleBn : entry.titleEn).trim();
        const summary = (useBn && entry.summaryBn ? entry.summaryBn : entry.summaryEn).trim();
        const contentHtml =
          (useBn && entry.bodyHtmlBn ? entry.bodyHtmlBn : entry.bodyHtmlEn)?.trim() || undefined;
        const details =
          useBn && Array.isArray(entry.highlightsBn) && entry.highlightsBn.length > 0
            ? entry.highlightsBn
            : entry.highlightsEn ?? [];

        return {
          id: entry.id,
          slug: entry.slug,
          date: entry.releaseDate,
          tag: mapCmsTagToUiTag(entry.tag),
          title,
          summary,
          contentHtml,
          details,
          area: entry.moduleRefs?.trim() || undefined,
          fallbackUsed: entry.fallbackUsed,
        };
      });
}
