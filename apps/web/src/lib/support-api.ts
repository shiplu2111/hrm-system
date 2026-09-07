import type {
  CreateSupportTicketInput,
  CreateSupportTicketMessageInput,
  KbArticleListItem,
  KbArticleRecord,
  KbCategoryRecord,
  SupportTicketDetail,
  SupportTicketRecord,
} from '@hrm/shared-types';
import { portalApiRequest } from '@hrm/portal-ui';

const PORTAL = 'employee' as const;

export function listKbCategories(): Promise<KbCategoryRecord[]> {
  return portalApiRequest<KbCategoryRecord[]>(
    PORTAL,
    '/tenant/support/kb/categories',
  );
}

export function listKbArticles(params?: {
  search?: string;
  categoryId?: string;
}): Promise<KbArticleListItem[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.categoryId) query.set('categoryId', params.categoryId);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return portalApiRequest<KbArticleListItem[]>(
    PORTAL,
    `/tenant/support/kb/articles${suffix}`,
  );
}

export function getKbArticle(articleId: string): Promise<KbArticleRecord> {
  return portalApiRequest<KbArticleRecord>(
    PORTAL,
    `/tenant/support/kb/articles/${articleId}`,
  );
}

export function listSupportTickets(): Promise<SupportTicketRecord[]> {
  return portalApiRequest<SupportTicketRecord[]>(
    PORTAL,
    '/tenant/support/tickets',
  );
}

export function getSupportTicket(ticketId: string): Promise<SupportTicketDetail> {
  return portalApiRequest<SupportTicketDetail>(
    PORTAL,
    `/tenant/support/tickets/${ticketId}`,
  );
}

export function createSupportTicket(
  input: CreateSupportTicketInput,
): Promise<SupportTicketDetail> {
  return portalApiRequest<SupportTicketDetail>(
    PORTAL,
    '/tenant/support/tickets',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function addSupportTicketMessage(
  ticketId: string,
  input: CreateSupportTicketMessageInput,
): Promise<SupportTicketDetail> {
  return portalApiRequest<SupportTicketDetail>(
    PORTAL,
    `/tenant/support/tickets/${ticketId}/messages`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}
