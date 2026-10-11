import type {
  CreateKbArticleInput,
  CreateKbCategoryInput,
  CreateSupportTicketInput,
  CreateSupportTicketMessageInput,
  KbArticleListItem,
  KbArticleRecord,
  KbArticleStatusFilter,
  KbCategoryRecord,
  SupportAgent,
  SupportQueueList,
  SupportQueueQuery,
  SupportTicketDetail,
  SupportTicketRecord,
  UpdateKbArticleInput,
  UpdateKbCategoryInput,
  UpdateSupportTicketInput,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function listKbCategories(): Promise<KbCategoryRecord[]> {
  return tenantApiRequest<KbCategoryRecord[]>('/tenant/support/kb/categories');
}

export function createKbCategory(
  input: CreateKbCategoryInput,
): Promise<KbCategoryRecord> {
  return tenantApiRequest<KbCategoryRecord>('/tenant/support/kb/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateKbCategory(
  categoryId: string,
  input: UpdateKbCategoryInput,
): Promise<KbCategoryRecord> {
  return tenantApiRequest<KbCategoryRecord>(
    `/tenant/support/kb/categories/${categoryId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteKbCategory(categoryId: string): Promise<{ deleted: boolean }> {
  return tenantApiRequest<{ deleted: boolean }>(
    `/tenant/support/kb/categories/${categoryId}`,
    { method: 'DELETE' },
  );
}

export function listKbArticles(params?: {
  search?: string;
  categoryId?: string;
  status?: KbArticleStatusFilter;
}): Promise<KbArticleListItem[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.categoryId) query.set('categoryId', params.categoryId);
  if (params?.status && params.status !== 'all') query.set('status', params.status);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return tenantApiRequest<KbArticleListItem[]>(
    `/tenant/support/kb/articles${suffix}`,
  );
}

/** `preview` lets editors open an article without counting a view. */
export function getKbArticle(
  articleId: string,
  options: { preview?: boolean } = {},
): Promise<KbArticleRecord> {
  return tenantApiRequest<KbArticleRecord>(
    `/tenant/support/kb/articles/${articleId}${options.preview ? '?preview=true' : ''}`,
  );
}

export function createKbArticle(
  input: CreateKbArticleInput,
): Promise<KbArticleRecord> {
  return tenantApiRequest<KbArticleRecord>('/tenant/support/kb/articles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateKbArticle(
  articleId: string,
  input: UpdateKbArticleInput,
): Promise<KbArticleRecord> {
  return tenantApiRequest<KbArticleRecord>(
    `/tenant/support/kb/articles/${articleId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteKbArticle(articleId: string): Promise<{ deleted: boolean }> {
  return tenantApiRequest<{ deleted: boolean }>(
    `/tenant/support/kb/articles/${articleId}`,
    { method: 'DELETE' },
  );
}

export function listSupportTickets(): Promise<SupportTicketRecord[]> {
  return tenantApiRequest<SupportTicketRecord[]>('/tenant/support/tickets');
}

export function listSupportQueue(params: SupportQueueQuery): Promise<SupportQueueList> {
  const query = new URLSearchParams();
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.priority) query.set('priority', params.priority);
  if (params.assignee && params.assignee !== 'all') query.set('assignee', params.assignee);
  if (params.search?.trim()) query.set('search', params.search.trim());
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return tenantApiRequest<SupportQueueList>(`/tenant/support/queue${suffix}`);
}

export function listSupportAgents(): Promise<SupportAgent[]> {
  return tenantApiRequest<SupportAgent[]>('/tenant/support/agents');
}

export function getSupportTicket(ticketId: string): Promise<SupportTicketDetail> {
  return tenantApiRequest<SupportTicketDetail>(
    `/tenant/support/tickets/${ticketId}`,
  );
}

export function createSupportTicket(
  input: CreateSupportTicketInput,
): Promise<SupportTicketDetail> {
  return tenantApiRequest<SupportTicketDetail>('/tenant/support/tickets', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateSupportTicket(
  ticketId: string,
  input: UpdateSupportTicketInput,
): Promise<SupportTicketDetail> {
  return tenantApiRequest<SupportTicketDetail>(
    `/tenant/support/tickets/${ticketId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function addSupportTicketMessage(
  ticketId: string,
  input: CreateSupportTicketMessageInput,
): Promise<SupportTicketDetail> {
  return tenantApiRequest<SupportTicketDetail>(
    `/tenant/support/tickets/${ticketId}/messages`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}
