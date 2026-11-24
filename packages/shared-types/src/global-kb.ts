// packages/shared-types/src/global-kb.ts
// Shared types for Global Knowledge Base (MODULES.md §45, Phase 2 Admin Panel Stage W)

export type GlobalKbStatus = 'draft' | 'published';

export interface GlobalKbCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  articleCount: number;
  publishedCount: number;
  draftCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GlobalKbArticleListItem {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySlug?: string;
  title: string;
  slug: string;
  summary: string;
  status: GlobalKbStatus;
  published: boolean;
  viewCount: number;
  targetCountries: string[];
  targetPlans: string[];
  tags: string[];
  authorUserId: string | null;
  authorName: string | null;
  lastUpdatedByUserId: string | null;
  lastUpdatedByName: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GlobalKbArticleDetail extends GlobalKbArticleListItem {
  body: string;
}

export interface CreateGlobalKbCategoryInput {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
}

export interface UpdateGlobalKbCategoryInput {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
}

export interface CreateGlobalKbArticleInput {
  categoryId: string;
  title: string;
  slug?: string;
  summary: string;
  body: string;
  status?: GlobalKbStatus;
  targetCountries?: string[];
  targetPlans?: string[];
  tags?: string[];
}

export interface UpdateGlobalKbArticleInput {
  categoryId?: string;
  title?: string;
  slug?: string;
  summary?: string;
  body?: string;
  status?: GlobalKbStatus;
  targetCountries?: string[];
  targetPlans?: string[];
  tags?: string[];
}

export interface GlobalKbArticlesQuery {
  search?: string;
  categoryId?: string;
  status?: GlobalKbStatus | 'all';
  country?: string;
  plan?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
}

export interface GlobalKbArticlesResponse {
  items: GlobalKbArticleListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  counts: {
    all: number;
    published: number;
    draft: number;
  };
  categoriesCount: number;
  totalViews: number;
}

export interface IncrementArticleViewResult {
  articleId: string;
  viewCount: number;
}
