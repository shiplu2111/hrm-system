export type BlogPostStatus = 'draft' | 'published';

export interface BlogPostSummary {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  categorySlug: string;
  author: string;
  authorRole?: string;
  authorAvatarUrl?: string;
  publishedAt: string;
  updatedAt?: string;
  readingTimeMinutes: number;
  tags: string[];
  coverImage?: string;
  coverAlt?: string;
  resolvedLocale?: 'en' | 'bn';
  fallbackUsed?: boolean;
  seoTitle?: string;
  seoDescription?: string;
}

export interface BlogPostDetail extends BlogPostSummary {
  content: string;
  contentHtml: string;
  relatedPosts?: BlogPostSummary[];
}

export interface BlogCategorySummary {
  name: string;
  slug: string;
  postCount: number;
}

export interface BlogListQuery {
  categorySlug?: string;
  tag?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface BlogListResult {
  items: BlogPostSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  categories: BlogCategorySummary[];
}

/**
 * Abstract content-loading contract for the public Blog powered by CMS APIs.
 */
export interface BlogContentProvider {
  listPublishedPosts(query?: BlogListQuery): Promise<BlogListResult>;
  listCategories(): Promise<BlogCategorySummary[]>;
  getPostBySlug(slug: string): Promise<BlogPostDetail | null>;
  getRelatedPosts(post: BlogPostDetail, limit?: number): Promise<BlogPostSummary[]>;
  hasPublishedPosts(): Promise<boolean>;
}
