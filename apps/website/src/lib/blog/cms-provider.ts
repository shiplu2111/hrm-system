import 'server-only';

import type {
  CmsPublicBlogListResultDto,
  CmsPublicPostDto,
  CmsPublicPostSummaryDto,
} from '@hrm/shared-types';
import { DEFAULT_LOCALE, type WebsiteLocale } from '../../i18n/types';
import type {
  BlogCategorySummary,
  BlogContentProvider,
  BlogListQuery,
  BlogListResult,
  BlogPostDetail,
  BlogPostSummary,
} from './types';
import { fetchCmsJsonWithFallback } from '../cms-resilient-cache';

function getServerApiBase(): string {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000'
  ).replace(/\/+$/, '');
}

function getBrowserApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
}

export function resolveCmsAssetUrl(rawUrl?: string | null): string | undefined {
  const cleaned = rawUrl?.trim();
  if (!cleaned) return undefined;
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) return cleaned;
  if (cleaned.startsWith('/api/')) {
    return `${getBrowserApiBase()}${cleaned}`;
  }
  return cleaned;
}

function mapSummary(
  post: CmsPublicPostSummaryDto | CmsPublicPostDto,
  requestedLocale: WebsiteLocale,
): BlogPostSummary {
  const useBn = requestedLocale === 'bn' && post.resolvedLocale === 'bn';
  const title = (useBn && post.titleBn ? post.titleBn : post.titleEn).trim();
  const excerpt = (useBn && post.excerptBn ? post.excerptBn : post.excerptEn).trim();
  const category =
    requestedLocale === 'bn' && post.category.nameBn
      ? post.category.nameBn
      : post.category.nameEn;
  const author =
    requestedLocale === 'bn' && post.author.displayNameBn
      ? post.author.displayNameBn
      : post.author.displayName;
  const authorRole =
    (requestedLocale === 'bn' && post.author.roleTitleBn
      ? post.author.roleTitleBn
      : post.author.roleTitle) || undefined;
  const coverAlt =
    (useBn && post.coverAltBn ? post.coverAltBn : post.coverAltEn) || undefined;

  const fullPost = post as Partial<CmsPublicPostDto>;
  const seoTitle =
    (useBn && fullPost.seoTitleBn ? fullPost.seoTitleBn : fullPost.seoTitleEn) || undefined;
  const seoDescription =
    (useBn && fullPost.seoDescriptionBn
      ? fullPost.seoDescriptionBn
      : fullPost.seoDescriptionEn) || undefined;

  return {
    id: post.id,
    slug: post.slug,
    title,
    excerpt,
    category,
    categorySlug: post.category.slug,
    author,
    authorRole,
    authorAvatarUrl: resolveCmsAssetUrl(post.author.avatarUrl),
    publishedAt: post.publishedAt || new Date().toISOString(),
    updatedAt: post.updatedAt || post.publishedAt || undefined,
    readingTimeMinutes: Math.max(1, post.readingTimeMinutes || 1),
    tags: Array.isArray(post.tags) ? post.tags : [],
    coverImage: resolveCmsAssetUrl(fullPost.coverImageUrl),
    coverAlt,
    resolvedLocale: post.resolvedLocale,
    fallbackUsed: post.fallbackUsed,
    seoTitle,
    seoDescription,
  };
}

function mapDetail(post: CmsPublicPostDto, requestedLocale: WebsiteLocale): BlogPostDetail {
  const summary = mapSummary(post, requestedLocale);
  const useBn = requestedLocale === 'bn' && post.resolvedLocale === 'bn';
  const html = (useBn && post.bodyHtmlBn ? post.bodyHtmlBn : post.bodyHtmlEn) || '';
  return {
    ...summary,
    content: html,
    contentHtml: html,
    relatedPosts: Array.isArray(post.relatedPosts)
      ? post.relatedPosts.map((rel) => mapSummary(rel, requestedLocale))
      : undefined,
  };
}

export class CmsBlogContentProvider implements BlogContentProvider {
  private readonly locale: WebsiteLocale;

  constructor(locale: WebsiteLocale = DEFAULT_LOCALE) {
    this.locale = locale;
  }

  private async fetchPostsApi(query: BlogListQuery = {}): Promise<CmsPublicBlogListResultDto | null> {
    const params = new URLSearchParams();
    params.set('locale', this.locale);
    if (query.categorySlug && query.categorySlug !== 'all') {
      params.set('categorySlug', query.categorySlug.trim().toLowerCase());
    }
    if (query.tag?.trim()) params.set('tag', query.tag.trim());
    if (query.search?.trim()) params.set('search', query.search.trim());
    if (query.page) params.set('page', String(Math.max(1, query.page)));
    if (query.pageSize) params.set('pageSize', String(Math.min(100, Math.max(1, query.pageSize))));

    const queryString = params.toString();
    const res = await fetchCmsJsonWithFallback<CmsPublicBlogListResultDto>({
      cacheKey: `cms:posts:list:${queryString}`,
      url: `${getServerApiBase()}/api/v1/public/content/posts?${queryString}`,
      revalidateSeconds: 30,
      tags: ['cms-posts'],
      timeoutMs: 2500,
      treat404AsAuthoritative: false,
    });
    return res.ok ? res.data : null;
  }

  async hasPublishedPosts(): Promise<boolean> {
    const res = await this.fetchPostsApi({ page: 1, pageSize: 1 });
    if (!res) return false;
    return Boolean(res.meta?.hasPublishedPosts ?? (res.meta?.total ?? 0) > 0);
  }

  async listCategories(): Promise<BlogCategorySummary[]> {
    const res = await this.fetchPostsApi({ page: 1, pageSize: 1 });
    if (!res?.meta?.categories) return [];
    return res.meta.categories.map((c) => ({
      name: this.locale === 'bn' && c.nameBn ? c.nameBn : c.nameEn,
      slug: c.slug,
      postCount: c.postCount,
    }));
  }

  async listPublishedPosts(query: BlogListQuery = {}): Promise<BlogListResult> {
    const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 6));
    const res = await this.fetchPostsApi({ ...query, pageSize });
    if (!res || !Array.isArray(res.data)) {
      return {
        items: [],
        total: 0,
        page: 1,
        pageSize,
        totalPages: 1,
        categories: [],
      };
    }

    return {
      items: res.data.map((p) => mapSummary(p, this.locale)),
      total: res.meta?.total ?? res.data.length,
      page: res.meta?.page ?? 1,
      pageSize: res.meta?.pageSize ?? pageSize,
      totalPages: res.meta?.totalPages ?? 1,
      categories: (res.meta?.categories ?? []).map((c) => ({
        name: this.locale === 'bn' && c.nameBn ? c.nameBn : c.nameEn,
        slug: c.slug,
        postCount: c.postCount,
      })),
    };
  }

  async getPostBySlug(slug: string): Promise<BlogPostDetail | null> {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) return null;
    const res = await fetchCmsJsonWithFallback<{ data?: CmsPublicPostDto }>({
      cacheKey: `cms:post:${this.locale}:${normalized}`,
      url: `${getServerApiBase()}/api/v1/public/content/posts/${encodeURIComponent(normalized)}?locale=${this.locale}`,
      revalidateSeconds: 30,
      tags: ['cms-posts', `cms-post:${normalized}`],
      timeoutMs: 2500,
      treat404AsAuthoritative: true,
    });
    if (!res.ok || !res.data?.data) return null;
    return mapDetail(res.data.data, this.locale);
  }

  async getRelatedPosts(post: BlogPostDetail, limit = 3): Promise<BlogPostSummary[]> {
    if (Array.isArray(post.relatedPosts) && post.relatedPosts.length > 0) {
      return post.relatedPosts.slice(0, limit);
    }
    const list = await this.listPublishedPosts({
      categorySlug: post.categorySlug,
      pageSize: limit + 1,
    });
    return list.items.filter((p) => p.slug !== post.slug).slice(0, limit);
  }
}
