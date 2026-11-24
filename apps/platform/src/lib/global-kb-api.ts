// apps/platform/src/lib/global-kb-api.ts
import {
  CreateGlobalKbArticleInput,
  CreateGlobalKbCategoryInput,
  GlobalKbArticleDetail,
  GlobalKbArticlesQuery,
  GlobalKbArticlesResponse,
  GlobalKbCategory,
  IncrementArticleViewResult,
  UpdateGlobalKbArticleInput,
  UpdateGlobalKbCategoryInput,
} from '@hrm/shared-types';
import { getPlatformAccessToken } from './api-client';

const API_BASE = '/api/v1/platform/knowledge-base';

async function platformKbFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getPlatformAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const body = await res.json();
  if (!res.ok) {
    const errorMsg = body?.error?.message || body?.message || `HTTP ${res.status} request failed`;
    const err = new Error(errorMsg);
    (err as any).statusCode = res.status;
    (err as any).errorData = body?.error || body;
    throw err;
  }

  return body.data as T;
}

export async function listGlobalKbCategories(): Promise<GlobalKbCategory[]> {
  return platformKbFetch<GlobalKbCategory[]>('/categories');
}

export async function createGlobalKbCategory(
  input: CreateGlobalKbCategoryInput,
): Promise<GlobalKbCategory> {
  return platformKbFetch<GlobalKbCategory>('/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateGlobalKbCategory(
  id: string,
  input: UpdateGlobalKbCategoryInput,
): Promise<GlobalKbCategory> {
  return platformKbFetch<GlobalKbCategory>(`/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteGlobalKbCategory(
  id: string,
): Promise<{ success: boolean; id: string }> {
  return platformKbFetch<{ success: boolean; id: string }>(`/categories/${id}`, {
    method: 'DELETE',
  });
}

export async function listGlobalKbArticles(
  query: GlobalKbArticlesQuery = {},
): Promise<GlobalKbArticlesResponse> {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.categoryId && query.categoryId !== 'all') params.set('categoryId', query.categoryId);
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.country && query.country !== 'all') params.set('country', query.country);
  if (query.plan && query.plan !== 'all') params.set('plan', query.plan);
  if (query.tag && query.tag !== 'all') params.set('tag', query.tag);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));

  const qs = params.toString();
  return platformKbFetch<GlobalKbArticlesResponse>(`/articles${qs ? `?${qs}` : ''}`);
}

export async function getGlobalKbArticle(
  id: string,
  preview: boolean = false,
): Promise<GlobalKbArticleDetail> {
  const qs = preview ? '?preview=true' : '';
  return platformKbFetch<GlobalKbArticleDetail>(`/articles/${id}${qs}`);
}

export async function createGlobalKbArticle(
  input: CreateGlobalKbArticleInput,
): Promise<GlobalKbArticleDetail> {
  return platformKbFetch<GlobalKbArticleDetail>('/articles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateGlobalKbArticle(
  id: string,
  input: UpdateGlobalKbArticleInput,
): Promise<GlobalKbArticleDetail> {
  return platformKbFetch<GlobalKbArticleDetail>(`/articles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteGlobalKbArticle(
  id: string,
): Promise<{ success: boolean; id: string }> {
  return platformKbFetch<{ success: boolean; id: string }>(`/articles/${id}`, {
    method: 'DELETE',
  });
}

export async function incrementGlobalKbArticleView(
  id: string,
): Promise<IncrementArticleViewResult> {
  return platformKbFetch<IncrementArticleViewResult>(`/articles/${id}/view`, {
    method: 'POST',
  });
}
