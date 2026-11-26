import type {
  CmsAuthorDto,
  CmsCareerDto,
  CmsCareerStatus,
  CmsChangelogEntryDto,
  CmsChangelogTag,
  CmsDashboardSummaryDto,
  CmsFaqDto,
  CmsLocale,
  CmsMediaDto,
  CmsMediaUsageDto,
  CmsMenuDto,
  CmsPageDeletionImpactDto,
  CmsPageDetailDto,
  CmsPageDto,
  CmsPagePresenceResponseDto,
  CmsPageStatus,
  CmsPageVersionDto,
  CmsPostCategoryDto,
  CmsPostDto,
  CmsPostStatus,
  CmsPreviewTokenResponseDto,
  CmsRedirectCsvImportResultDto,
  CmsRedirectRuleDto,
  CmsRedirectType,
  CmsResolvedPageDto,
  CmsSiteSettingsBundleDto,
  CmsSlugAvailabilityDto,
  CmsTranslationStatus,
  CmsUpdateMediaInput,
  CreateCmsCustomPageInput,
  DuplicateCmsPageInput,
  PermanentDeleteCmsPageInput,
  ReorderCmsMenuItemsInput,
  TrashCmsPageInput,
  UpsertCmsMenuItemInput,
  UpsertCmsRedirectInput,
} from '@hrm/shared-types';
import { getPlatformAccessToken } from './api-client';

const CMS_API_BASE = '/api/v1/platform/cms';

export class CmsApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CmsApiError';
  }
}

async function cmsApiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getPlatformAccessToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${CMS_API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorObj = (body?.error && typeof body.error === 'object' ? body.error : body) as Record<
      string,
      unknown
    >;
    const errorMsg =
      (typeof errorObj?.message === 'string' && errorObj.message) ||
      (typeof body?.message === 'string' && body.message) ||
      `CMS API request failed (${res.status})`;
    const code =
      (typeof errorObj?.code === 'string' && errorObj.code) ||
      (typeof body?.code === 'string' && body.code) ||
      undefined;
    const details =
      (errorObj?.details && typeof errorObj.details === 'object'
        ? (errorObj.details as Record<string, unknown>)
        : errorObj) ?? undefined;
    throw new CmsApiError(errorMsg, res.status, code, details);
  }

  return body as T;
}

export interface ListCmsMediaQuery {
  folder?: string;
  tag?: string;
  mimeGroup?: 'all' | 'images' | 'pdfs';
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listCmsMedia(
  query: ListCmsMediaQuery = {},
): Promise<{ items: CmsMediaDto[]; total: number }> {
  const params = new URLSearchParams();
  if (query.folder && query.folder !== 'all') params.set('folder', query.folder);
  if (query.tag && query.tag !== 'all') params.set('tag', query.tag);
  if (query.mimeGroup && query.mimeGroup !== 'all') params.set('mimeGroup', query.mimeGroup);
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.limit) params.set('limit', String(query.limit));
  if (query.offset !== undefined) params.set('offset', String(query.offset));

  const qs = params.toString();
  const res = await cmsApiFetch<{ data: CmsMediaDto[]; meta?: { total?: number } }>(
    `/media${qs ? `?${qs}` : ''}`,
  );
  return {
    items: res.data ?? [],
    total: res.meta?.total ?? (res.data?.length ?? 0),
  };
}

export interface UploadCmsMediaPayload {
  file: File;
  folder?: string;
  tags?: string[];
  altEn?: string;
  altBn?: string;
  captionEn?: string;
  captionBn?: string;
  width?: number;
  height?: number;
}

export async function uploadCmsMedia(payload: UploadCmsMediaPayload): Promise<CmsMediaDto> {
  const formData = new FormData();
  formData.append('file', payload.file);
  if (payload.folder) formData.append('folder', payload.folder);
  if (payload.tags && payload.tags.length > 0) {
    formData.append('tags', JSON.stringify(payload.tags));
  }
  if (payload.altEn?.trim()) formData.append('altEn', payload.altEn.trim());
  if (payload.altBn?.trim()) formData.append('altBn', payload.altBn.trim());
  if (payload.captionEn?.trim()) formData.append('captionEn', payload.captionEn.trim());
  if (payload.captionBn?.trim()) formData.append('captionBn', payload.captionBn.trim());
  if (payload.width) formData.append('width', String(payload.width));
  if (payload.height) formData.append('height', String(payload.height));

  const res = await cmsApiFetch<{ data: CmsMediaDto }>('/media', {
    method: 'POST',
    body: formData,
  });
  return res.data;
}

export async function getCmsMediaUsage(id: string): Promise<CmsMediaUsageDto> {
  const res = await cmsApiFetch<{ data: CmsMediaUsageDto }>(
    `/media/${encodeURIComponent(id)}/usage`,
  );
  return res.data;
}

export async function updateCmsMedia(
  id: string,
  input: CmsUpdateMediaInput,
): Promise<CmsMediaDto> {
  const res = await cmsApiFetch<{ data: CmsMediaDto }>(`/media/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function deleteCmsMedia(
  id: string,
  forceDraftUnlink = false,
): Promise<{ id: string; deleted: true }> {
  const qs = forceDraftUnlink ? '?force=true' : '';
  const res = await cmsApiFetch<{ data: { id: string; deleted: true } }>(
    `/media/${encodeURIComponent(id)}${qs}`,
    {
      method: 'DELETE',
    },
  );
  return res.data;
}

export async function fetchCmsDashboard(): Promise<CmsDashboardSummaryDto> {
  const res = await cmsApiFetch<{ data: CmsDashboardSummaryDto }>('/dashboard');
  return res.data;
}

export type CreateCmsCustomPagePayload = CreateCmsCustomPageInput;

export async function checkCmsSlugAvailability(
  slug: string,
): Promise<CmsSlugAvailabilityDto> {
  const res = await cmsApiFetch<{ data: CmsSlugAvailabilityDto }>(
    `/slug-availability?slug=${encodeURIComponent(slug)}`,
  );
  return res.data;
}

export async function listCmsMenus(): Promise<CmsMenuDto[]> {
  const res = await cmsApiFetch<{ data: CmsMenuDto[] }>('/menus');
  return res.data ?? [];
}

export async function ensureDefaultCmsMenus(): Promise<CmsMenuDto[]> {
  const res = await cmsApiFetch<{ data: CmsMenuDto[] }>('/menus/ensure-defaults', {
    method: 'POST',
  });
  return res.data ?? [];
}

export async function createCmsMenuItem(
  menuId: string,
  payload: UpsertCmsMenuItemInput,
): Promise<CmsMenuDto> {
  const res = await cmsApiFetch<{ data: CmsMenuDto }>(
    `/menus/${encodeURIComponent(menuId)}/items`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export async function updateCmsMenuItem(
  menuId: string,
  itemId: string,
  payload: Partial<UpsertCmsMenuItemInput>,
): Promise<CmsMenuDto> {
  const res = await cmsApiFetch<{ data: CmsMenuDto }>(
    `/menus/${encodeURIComponent(menuId)}/items/${encodeURIComponent(itemId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export async function deleteCmsMenuItem(
  menuId: string,
  itemId: string,
): Promise<CmsMenuDto> {
  const res = await cmsApiFetch<{ data: CmsMenuDto }>(
    `/menus/${encodeURIComponent(menuId)}/items/${encodeURIComponent(itemId)}`,
    {
      method: 'DELETE',
    },
  );
  return res.data;
}

export async function reorderCmsMenuItems(
  menuId: string,
  payload: ReorderCmsMenuItemsInput,
): Promise<CmsMenuDto> {
  const res = await cmsApiFetch<{ data: CmsMenuDto }>(
    `/menus/${encodeURIComponent(menuId)}/reorder`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export async function listCmsRedirects(filters?: {
  search?: string;
  redirectType?: CmsRedirectType | 'all';
  isActive?: 'all' | 'true' | 'false';
}): Promise<CmsRedirectRuleDto[]> {
  const params = new URLSearchParams();
  if (filters?.search?.trim()) params.set('search', filters.search.trim());
  if (filters?.redirectType && filters.redirectType !== 'all') {
    params.set('redirectType', filters.redirectType);
  }
  if (filters?.isActive && filters.isActive !== 'all') {
    params.set('isActive', filters.isActive);
  }
  const qs = params.toString();
  const res = await cmsApiFetch<{ data: CmsRedirectRuleDto[] }>(
    `/redirects${qs ? `?${qs}` : ''}`,
  );
  return res.data ?? [];
}

export async function createCmsRedirect(
  payload: UpsertCmsRedirectInput,
): Promise<CmsRedirectRuleDto> {
  const res = await cmsApiFetch<{ data: CmsRedirectRuleDto }>('/redirects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateCmsRedirect(
  id: string,
  payload: Partial<UpsertCmsRedirectInput>,
): Promise<CmsRedirectRuleDto> {
  const res = await cmsApiFetch<{ data: CmsRedirectRuleDto }>(
    `/redirects/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export async function deleteCmsRedirect(
  id: string,
): Promise<{ id: string; deleted: true }> {
  const res = await cmsApiFetch<{ data: { id: string; deleted: true } }>(
    `/redirects/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  );
  return res.data;
}

export async function importCmsRedirectsCsv(
  csv: string,
): Promise<CmsRedirectCsvImportResultDto> {
  const res = await cmsApiFetch<{ data: CmsRedirectCsvImportResultDto }>(
    '/redirects/import-csv',
    {
      method: 'POST',
      body: JSON.stringify({ csv }),
    },
  );
  return res.data;
}

export async function exportCmsRedirectsCsv(): Promise<string> {
  const token = getPlatformAccessToken();
  const res = await fetch(`${CMS_API_BASE}/redirects/export-csv`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`CSV export failed (HTTP ${res.status})`);
  }
  return res.text();
}

export async function getCmsSiteSettingsBundle(): Promise<CmsSiteSettingsBundleDto> {
  const res = await cmsApiFetch<{ data: CmsSiteSettingsBundleDto }>('/site-settings');
  return res.data;
}

export async function updateCmsSiteSettingsBundle(
  payload: Partial<CmsSiteSettingsBundleDto>,
): Promise<CmsSiteSettingsBundleDto> {
  const res = await cmsApiFetch<{ data: CmsSiteSettingsBundleDto }>('/site-settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function createCmsCustomPage(
  payload: CreateCmsCustomPagePayload,
): Promise<CmsPageDto> {
  const res = await cmsApiFetch<{ data: CmsPageDto }>('/pages', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export interface CreateCmsPostDraftPayload {
  slug: string;
  categoryId: string;
  authorId: string;
  coverMediaId?: string | null;
  coverAltEn?: string | null;
  coverAltBn?: string | null;
  titleEn: string;
  excerptEn: string;
  bodyHtmlEn: string;
  bodyJsonEn?: Record<string, unknown>;
  titleBn?: string | null;
  excerptBn?: string | null;
  bodyHtmlBn?: string | null;
  bodyJsonBn?: Record<string, unknown> | null;
  isBnTranslated?: boolean;
  seoTitleEn?: string | null;
  seoDescriptionEn?: string | null;
  seoTitleBn?: string | null;
  seoDescriptionBn?: string | null;
  publishedAt?: string | null;
  relatedPostIds?: string[];
  tags?: string[];
  readingTimeMinutes?: number;
}

export interface ListCmsPostsQuery {
  status?: CmsPostStatus | 'all';
  categoryId?: string;
  authorId?: string;
  localeStatus?: 'all' | 'bn_translated' | 'bn_missing';
  tag?: string;
  search?: string;
  includeTrashed?: boolean;
}

export async function listCmsPosts(query: ListCmsPostsQuery = {}): Promise<CmsPostDto[]> {
  const params = new URLSearchParams();
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.categoryId && query.categoryId !== 'all') params.set('categoryId', query.categoryId);
  if (query.authorId && query.authorId !== 'all') params.set('authorId', query.authorId);
  if (query.localeStatus && query.localeStatus !== 'all') params.set('localeStatus', query.localeStatus);
  if (query.tag?.trim()) params.set('tag', query.tag.trim());
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.includeTrashed) params.set('includeTrashed', 'true');
  const qs = params.toString();
  const res = await cmsApiFetch<{ data: CmsPostDto[] }>(`/posts${qs ? `?${qs}` : ''}`);
  return res.data ?? [];
}

export async function getCmsPost(postId: string): Promise<CmsPostDto> {
  const res = await cmsApiFetch<{ data: CmsPostDto }>(`/posts/${encodeURIComponent(postId)}`);
  return res.data;
}

export async function createCmsPostDraft(
  payload: CreateCmsPostDraftPayload,
): Promise<CmsPostDto> {
  const res = await cmsApiFetch<{ data: CmsPostDto }>('/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateCmsPostDraft(
  postId: string,
  payload: Partial<CreateCmsPostDraftPayload>,
): Promise<CmsPostDto> {
  const res = await cmsApiFetch<{ data: CmsPostDto }>(
    `/posts/${encodeURIComponent(postId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export async function publishCmsPost(postId: string): Promise<CmsPostDto> {
  const res = await cmsApiFetch<{ data: CmsPostDto }>(
    `/posts/${encodeURIComponent(postId)}/publish`,
    { method: 'POST' },
  );
  return res.data;
}

export async function scheduleCmsPost(
  postId: string,
  payload: { scheduledAt: string; timezone?: string },
): Promise<CmsPostDto> {
  const res = await cmsApiFetch<{ data: CmsPostDto }>(
    `/posts/${encodeURIComponent(postId)}/schedule`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export async function unpublishCmsPost(postId: string): Promise<CmsPostDto> {
  const res = await cmsApiFetch<{ data: CmsPostDto }>(
    `/posts/${encodeURIComponent(postId)}/unpublish`,
    { method: 'POST' },
  );
  return res.data;
}

export async function trashCmsPost(postId: string): Promise<CmsPostDto> {
  const res = await cmsApiFetch<{ data: CmsPostDto }>(
    `/posts/${encodeURIComponent(postId)}`,
    { method: 'DELETE' },
  );
  return res.data;
}

export async function restoreCmsPost(postId: string): Promise<CmsPostDto> {
  const res = await cmsApiFetch<{ data: CmsPostDto }>(
    `/posts/${encodeURIComponent(postId)}/restore`,
    { method: 'POST' },
  );
  return res.data;
}

export async function permanentDeleteCmsPost(
  postId: string,
  confirmText: string,
): Promise<{ id: string; slug: string; deleted: true }> {
  const res = await cmsApiFetch<{ data: { id: string; slug: string; deleted: true } }>(
    `/posts/${encodeURIComponent(postId)}/permanent`,
    {
      method: 'DELETE',
      body: JSON.stringify({ confirmText }),
    },
  );
  return res.data;
}

export async function listCmsPostCategories(): Promise<CmsPostCategoryDto[]> {
  const res = await cmsApiFetch<{ data: CmsPostCategoryDto[] }>('/blog/categories');
  return res.data ?? [];
}

export async function createCmsPostCategory(payload: {
  slug: string;
  nameEn: string;
  nameBn?: string | null;
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  sortOrder?: number;
}): Promise<CmsPostCategoryDto> {
  const res = await cmsApiFetch<{ data: CmsPostCategoryDto }>('/blog/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateCmsPostCategory(
  id: string,
  payload: Partial<{
    slug: string;
    nameEn: string;
    nameBn?: string | null;
    descriptionEn?: string | null;
    descriptionBn?: string | null;
    sortOrder?: number;
  }>,
): Promise<CmsPostCategoryDto> {
  const res = await cmsApiFetch<{ data: CmsPostCategoryDto }>(
    `/blog/categories/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export async function deleteCmsPostCategory(
  id: string,
): Promise<{ id: string; deleted: true }> {
  const res = await cmsApiFetch<{ data: { id: string; deleted: true } }>(
    `/blog/categories/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
  return res.data;
}

export async function listCmsAuthors(): Promise<CmsAuthorDto[]> {
  const res = await cmsApiFetch<{ data: CmsAuthorDto[] }>('/blog/authors');
  return res.data ?? [];
}

export async function createCmsAuthor(payload: {
  slug: string;
  displayName: string;
  displayNameBn?: string | null;
  roleTitle?: string | null;
  roleTitleBn?: string | null;
  bioEn?: string | null;
  bioBn?: string | null;
  avatarMediaId?: string | null;
  isActive?: boolean;
}): Promise<CmsAuthorDto> {
  const res = await cmsApiFetch<{ data: CmsAuthorDto }>('/blog/authors', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateCmsAuthor(
  id: string,
  payload: Partial<{
    slug: string;
    displayName: string;
    displayNameBn?: string | null;
    roleTitle?: string | null;
    roleTitleBn?: string | null;
    bioEn?: string | null;
    bioBn?: string | null;
    avatarMediaId?: string | null;
    isActive?: boolean;
  }>,
): Promise<CmsAuthorDto> {
  const res = await cmsApiFetch<{ data: CmsAuthorDto }>(
    `/blog/authors/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export async function deleteCmsAuthor(
  id: string,
): Promise<{ id: string; deleted: true }> {
  const res = await cmsApiFetch<{ data: { id: string; deleted: true } }>(
    `/blog/authors/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
  return res.data;
}

export interface UpsertCmsChangelogPayload {
  slug: string;
  versionLabel?: string;
  releaseDate: string;
  tag: CmsChangelogTag;
  moduleRefs?: string | null;
  titleEn: string;
  summaryEn?: string;
  bodyHtmlEn?: string;
  bodyJsonEn?: Record<string, unknown>;
  highlightsEn?: string[];
  titleBn?: string | null;
  summaryBn?: string | null;
  bodyHtmlBn?: string | null;
  bodyJsonBn?: Record<string, unknown> | null;
  highlightsBn?: string[];
  isBnTranslated?: boolean;
  isPublished?: boolean;
}

export async function listCmsChangelog(query?: {
  tag?: CmsChangelogTag | 'all';
  visibility?: 'all' | 'published' | 'hidden' | 'trashed';
  search?: string;
  includeTrashed?: boolean;
}): Promise<CmsChangelogEntryDto[]> {
  const params = new URLSearchParams();
  if (query?.tag && query.tag !== 'all') params.set('tag', query.tag);
  if (query?.visibility && query.visibility !== 'all') params.set('visibility', query.visibility);
  if (query?.search?.trim()) params.set('search', query.search.trim());
  if (query?.includeTrashed) params.set('includeTrashed', 'true');
  const qs = params.toString();
  const res = await cmsApiFetch<{ data: CmsChangelogEntryDto[] }>(
    `/changelog${qs ? `?${qs}` : ''}`,
  );
  return res.data ?? [];
}

export async function createCmsChangelogEntry(
  payload: UpsertCmsChangelogPayload,
): Promise<CmsChangelogEntryDto> {
  const res = await cmsApiFetch<{ data: CmsChangelogEntryDto }>('/changelog', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateCmsChangelogEntry(
  id: string,
  payload: Partial<UpsertCmsChangelogPayload>,
): Promise<CmsChangelogEntryDto> {
  const res = await cmsApiFetch<{ data: CmsChangelogEntryDto }>(
    `/changelog/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export async function publishCmsChangelogEntry(id: string): Promise<CmsChangelogEntryDto> {
  const res = await cmsApiFetch<{ data: CmsChangelogEntryDto }>(
    `/changelog/${encodeURIComponent(id)}/publish`,
    { method: 'POST' },
  );
  return res.data;
}

export async function unpublishCmsChangelogEntry(id: string): Promise<CmsChangelogEntryDto> {
  const res = await cmsApiFetch<{ data: CmsChangelogEntryDto }>(
    `/changelog/${encodeURIComponent(id)}/unpublish`,
    { method: 'POST' },
  );
  return res.data;
}

export async function trashCmsChangelogEntry(id: string): Promise<CmsChangelogEntryDto> {
  const res = await cmsApiFetch<{ data: CmsChangelogEntryDto }>(
    `/changelog/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
  return res.data;
}

export async function restoreCmsChangelogEntry(id: string): Promise<CmsChangelogEntryDto> {
  const res = await cmsApiFetch<{ data: CmsChangelogEntryDto }>(
    `/changelog/${encodeURIComponent(id)}/restore`,
    { method: 'POST' },
  );
  return res.data;
}

export async function permanentDeleteCmsChangelogEntry(
  id: string,
): Promise<{ id: string; slug: string; deleted: true }> {
  const res = await cmsApiFetch<{ data: { id: string; slug: string; deleted: true } }>(
    `/changelog/${encodeURIComponent(id)}/permanent`,
    { method: 'DELETE' },
  );
  return res.data;
}

export interface UpsertCmsCareerPayload {
  slug: string;
  department?: string;
  locationType: string;
  locationText: string;
  employmentType: string;
  titleEn: string;
  summaryEn?: string;
  descriptionHtmlEn: string;
  descriptionJsonEn?: Record<string, unknown>;
  titleBn?: string | null;
  summaryBn?: string | null;
  descriptionHtmlBn?: string | null;
  descriptionJsonBn?: Record<string, unknown> | null;
  isBnTranslated?: boolean;
  status?: CmsCareerStatus;
  applyEmail?: string | null;
  applyUrl?: string | null;
  closesAt?: string | null;
}

export async function listCmsCareers(query?: {
  status?: CmsCareerStatus | 'all';
  department?: string;
  search?: string;
  includeTrashed?: boolean;
}): Promise<CmsCareerDto[]> {
  const params = new URLSearchParams();
  if (query?.status && query.status !== 'all') params.set('status', query.status);
  if (query?.department && query.department !== 'all') params.set('department', query.department);
  if (query?.search?.trim()) params.set('search', query.search.trim());
  if (query?.includeTrashed) params.set('includeTrashed', 'true');
  const qs = params.toString();
  const res = await cmsApiFetch<{ data: CmsCareerDto[] }>(`/careers${qs ? `?${qs}` : ''}`);
  return res.data ?? [];
}

export async function createCmsCareer(payload: UpsertCmsCareerPayload): Promise<CmsCareerDto> {
  const res = await cmsApiFetch<{ data: CmsCareerDto }>('/careers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateCmsCareer(
  id: string,
  payload: Partial<UpsertCmsCareerPayload>,
): Promise<CmsCareerDto> {
  const res = await cmsApiFetch<{ data: CmsCareerDto }>(`/careers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function setCmsCareerStatus(
  id: string,
  status: CmsCareerStatus,
): Promise<CmsCareerDto> {
  const res = await cmsApiFetch<{ data: CmsCareerDto }>(
    `/careers/${encodeURIComponent(id)}/status`,
    {
      method: 'POST',
      body: JSON.stringify({ status }),
    },
  );
  return res.data;
}

export async function trashCmsCareer(id: string): Promise<CmsCareerDto> {
  const res = await cmsApiFetch<{ data: CmsCareerDto }>(`/careers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return res.data;
}

export async function restoreCmsCareer(id: string): Promise<CmsCareerDto> {
  const res = await cmsApiFetch<{ data: CmsCareerDto }>(
    `/careers/${encodeURIComponent(id)}/restore`,
    { method: 'POST' },
  );
  return res.data;
}

export async function permanentDeleteCmsCareer(
  id: string,
): Promise<{ id: string; slug: string; deleted: true }> {
  const res = await cmsApiFetch<{ data: { id: string; slug: string; deleted: true } }>(
    `/careers/${encodeURIComponent(id)}/permanent`,
    { method: 'DELETE' },
  );
  return res.data;
}

export async function runCmsScheduledJobs(): Promise<{
  publishedPages: number;
  publishedPosts: number;
  publishedChangelog: number;
}> {
  const res = await cmsApiFetch<{
    data: {
      publishedPages?: number;
      publishedPosts?: number;
      publishedChangelog?: number;
      pagesPublished?: number;
      postsPublished?: number;
      changelogPublished?: number;
    };
  }>('/jobs/run-scheduled', { method: 'POST' });
  const d = res.data ?? {};
  return {
    publishedPages: d.publishedPages ?? d.pagesPublished ?? 0,
    publishedPosts: d.publishedPosts ?? d.postsPublished ?? 0,
    publishedChangelog: d.publishedChangelog ?? d.changelogPublished ?? 0,
  };
}

export interface ListCmsPagesQuery {
  status?: CmsPageStatus | 'all';
  kind?: 'system' | 'custom' | 'all';
  search?: string;
  includeTrashed?: boolean;
}

export async function listCmsPages(query: ListCmsPagesQuery = {}): Promise<CmsPageDto[]> {
  const params = new URLSearchParams();
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.kind && query.kind !== 'all') params.set('kind', query.kind);
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.includeTrashed) params.set('includeTrashed', 'true');
  const qs = params.toString();
  const res = await cmsApiFetch<{ data: CmsPageDto[] }>(`/pages${qs ? `?${qs}` : ''}`);
  return res.data ?? [];
}

export async function fetchCmsPageDetail(pageId: string): Promise<CmsPageDetailDto> {
  const res = await cmsApiFetch<{ data: CmsPageDetailDto }>(
    `/pages/${encodeURIComponent(pageId)}`,
  );
  return res.data;
}

export interface SaveCmsPageVersionPayload {
  locale: CmsLocale;
  title: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalPath?: string | null;
  ogImageUrl?: string | null;
  noIndex?: boolean;
  blocks: unknown[];
  isTranslated?: boolean;
  translationStatus?: CmsTranslationStatus;
  changeNote?: string | null;
  publishImmediately?: boolean;
  baseVersionId?: string;
  expectedVersionNumber?: number;
  isAutosave?: boolean;
  forceOverwrite?: boolean;
}

export async function saveCmsPageVersion(
  pageId: string,
  payload: SaveCmsPageVersionPayload,
): Promise<CmsPageVersionDto> {
  const res = await cmsApiFetch<{ data: CmsPageVersionDto }>(
    `/pages/${encodeURIComponent(pageId)}/versions`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export async function restoreCmsPageVersion(
  pageId: string,
  versionId: string,
  note?: string,
): Promise<CmsPageVersionDto> {
  const res = await cmsApiFetch<{ data: CmsPageVersionDto }>(
    `/pages/${encodeURIComponent(pageId)}/versions/${encodeURIComponent(versionId)}/restore`,
    {
      method: 'POST',
      body: JSON.stringify({ note }),
    },
  );
  return res.data;
}

export async function getCmsPagePresence(
  pageId: string,
): Promise<CmsPagePresenceResponseDto> {
  const res = await cmsApiFetch<{ data: CmsPagePresenceResponseDto }>(
    `/pages/${encodeURIComponent(pageId)}/presence`,
  );
  return res.data;
}

export async function heartbeatCmsPagePresence(
  pageId: string,
  payload: { locale: CmsLocale; sessionId: string; baseVersionNumber?: number },
): Promise<CmsPagePresenceResponseDto> {
  const res = await cmsApiFetch<{ data: CmsPagePresenceResponseDto }>(
    `/pages/${encodeURIComponent(pageId)}/presence`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export async function releaseCmsPagePresence(
  pageId: string,
  sessionId: string,
): Promise<{ released: true }> {
  const res = await cmsApiFetch<{ data: { released: true } }>(
    `/pages/${encodeURIComponent(pageId)}/presence?sessionId=${encodeURIComponent(sessionId)}`,
    { method: 'DELETE' },
  );
  return res.data;
}

export async function createCmsPagePreviewToken(
  pageId: string,
  locale: CmsLocale = 'en',
): Promise<CmsPreviewTokenResponseDto> {
  const res = await cmsApiFetch<{ data: CmsPreviewTokenResponseDto }>(
    `/pages/${encodeURIComponent(pageId)}/preview-token`,
    {
      method: 'POST',
      body: JSON.stringify({ locale }),
    },
  );
  return res.data;
}

export async function resolveCmsDraftPreview(token: string): Promise<CmsResolvedPageDto> {
  const res = await fetch(
    `/api/v1/public/content/preview?token=${encodeURIComponent(token)}`,
    { cache: 'no-store' },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message || body?.message || 'Preview token is invalid or expired.');
  }
  return body.data as CmsResolvedPageDto;
}

export async function publishCmsPage(
  pageId: string,
  payload: { locale?: CmsLocale; versionId?: string; note?: string } = {},
): Promise<CmsPageDto> {
  const res = await cmsApiFetch<{ data: CmsPageDto }>(
    `/pages/${encodeURIComponent(pageId)}/publish`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export async function scheduleCmsPage(
  pageId: string,
  payload: { scheduledAt: string; timezone?: string; locale?: CmsLocale; versionId?: string; note?: string },
): Promise<CmsPageDto> {
  const res = await cmsApiFetch<{ data: CmsPageDto }>(
    `/pages/${encodeURIComponent(pageId)}/schedule`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export async function duplicateCmsPage(
  pageId: string,
  payload: DuplicateCmsPageInput = {},
): Promise<CmsPageDto> {
  const res = await cmsApiFetch<{ data: CmsPageDto }>(
    `/pages/${encodeURIComponent(pageId)}/duplicate`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export async function unpublishCmsPage(
  pageId: string,
  reason?: string,
): Promise<CmsPageDto> {
  const res = await cmsApiFetch<{ data: CmsPageDto }>(
    `/pages/${encodeURIComponent(pageId)}/unpublish`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  );
  return res.data;
}

export async function getCmsPageDeletionImpact(
  pageId: string,
): Promise<CmsPageDeletionImpactDto> {
  const res = await cmsApiFetch<{ data: CmsPageDeletionImpactDto }>(
    `/pages/${encodeURIComponent(pageId)}/deletion-impact`,
  );
  return res.data;
}

export async function deleteCmsPage(
  pageId: string,
  payload: TrashCmsPageInput = {},
): Promise<CmsPageDto> {
  const res = await cmsApiFetch<{ data: CmsPageDto }>(
    `/pages/${encodeURIComponent(pageId)}`,
    {
      method: 'DELETE',
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export async function permanentDeleteCmsPage(
  pageId: string,
  payload: PermanentDeleteCmsPageInput,
): Promise<{ id: string; slug: string; deleted: true }> {
  const res = await cmsApiFetch<{ data: { id: string; slug: string; deleted: true } }>(
    `/pages/${encodeURIComponent(pageId)}/permanent`,
    {
      method: 'DELETE',
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export async function getCmsTrashRetention(): Promise<{ days: number }> {
  const res = await cmsApiFetch<{ data: { days: number } }>('/trash/retention');
  return res.data;
}

export async function updateCmsTrashRetention(days: number): Promise<{ days: number }> {
  const res = await cmsApiFetch<{ data: { days: number } }>('/trash/retention', {
    method: 'PUT',
    body: JSON.stringify({ days }),
  });
  return res.data;
}

export async function purgeExpiredCmsTrashNow(): Promise<{
  purgedCount: number;
  purgedIds: string[];
  retentionDays: number;
}> {
  const res = await cmsApiFetch<{
    data: { purgedCount: number; purgedIds: string[]; retentionDays: number };
  }>('/jobs/purge-trash', { method: 'POST' });
  return res.data;
}

export async function restoreCmsPage(pageId: string): Promise<CmsPageDto> {
  const res = await cmsApiFetch<{ data: CmsPageDto }>(
    `/pages/${encodeURIComponent(pageId)}/restore`,
    {
      method: 'POST',
    },
  );
  return res.data;
}

export async function submitCmsLegalApproval(
  pageId: string,
  payload: { locale?: CmsLocale; versionId?: string; note?: string } = {},
): Promise<CmsPageDto> {
  const res = await cmsApiFetch<{ data: CmsPageDto }>(
    `/pages/${encodeURIComponent(pageId)}/submit-approval`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export async function approveCmsLegalPage(
  pageId: string,
  payload: { note?: string; publishNow?: boolean } = {},
): Promise<CmsPageDto> {
  const res = await cmsApiFetch<{ data: CmsPageDto }>(
    `/pages/${encodeURIComponent(pageId)}/approve`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export interface UpsertCmsFaqPayload {
  category: string;
  pageSlug?: string | null;
  questionEn: string;
  answerEn: string;
  answerJsonEn?: Record<string, unknown>;
  questionBn?: string | null;
  answerBn?: string | null;
  answerJsonBn?: Record<string, unknown> | null;
  isBnTranslated?: boolean;
  sortOrder?: number;
  isPublished?: boolean;
}

export async function listCmsFaqs(query?: {
  category?: string;
  pageSlug?: string;
  search?: string;
  isPublished?: boolean;
}): Promise<CmsFaqDto[]> {
  const params = new URLSearchParams();
  if (query?.category && query.category !== 'all') params.set('category', query.category);
  if (query?.pageSlug && query.pageSlug !== 'all') params.set('pageSlug', query.pageSlug);
  if (query?.search?.trim()) params.set('search', query.search.trim());
  if (query?.isPublished !== undefined) {
    params.set('isPublished', query.isPublished ? 'true' : 'false');
  }
  const qs = params.toString();
  const res = await cmsApiFetch<{ data: CmsFaqDto[] }>(`/faqs${qs ? `?${qs}` : ''}`);
  return res.data ?? [];
}

export async function createCmsFaq(payload: UpsertCmsFaqPayload): Promise<CmsFaqDto> {
  const res = await cmsApiFetch<{ data: CmsFaqDto }>('/faqs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateCmsFaq(
  id: string,
  payload: Partial<UpsertCmsFaqPayload>,
): Promise<CmsFaqDto> {
  const res = await cmsApiFetch<{ data: CmsFaqDto }>(`/faqs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteCmsFaq(id: string): Promise<{ id: string; deleted: true }> {
  const res = await cmsApiFetch<{ data: { id: string; deleted: true } }>(
    `/faqs/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
  return res.data;
}
