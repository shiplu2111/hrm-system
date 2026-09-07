import type {
  CreateSupportTicketInput,
  KbArticleListItem,
  SupportTicketRecord,
} from '@hrm/shared-types';
import { request } from './client';

export function listKbArticles(params?: {
  search?: string;
}): Promise<KbArticleListItem[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request<KbArticleListItem[]>(`/tenant/support/kb/articles${suffix}`);
}

export function listSupportTickets(): Promise<SupportTicketRecord[]> {
  return request<SupportTicketRecord[]>('/tenant/support/tickets');
}

export function createSupportTicket(
  input: CreateSupportTicketInput,
): Promise<SupportTicketRecord> {
  return request<SupportTicketRecord>('/tenant/support/tickets', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
