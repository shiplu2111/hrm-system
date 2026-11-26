/** Marketing Lead, Demo Request & Contact Message Contracts (Stage F.0 / F.1 / F.2 / F.3) */

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'closed';

export type ContactMessageTopic = 'sales' | 'partnership' | 'other';

export interface PublicLeadSubmissionPayload {
  name: string;
  workEmail: string;
  company?: string;
  country?: string;
  employeeCountBand?: string;
  topic?: ContactMessageTopic | string;
  message?: string;
  sourcePage?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;
  privacyConsent: boolean;
  marketingConsent?: boolean;
  attributionConsent?: boolean;
  captchaToken: string;
  /** Bot trap honeypot field; must remain empty on real submissions */
  website?: string;
}

export interface PublicLeadSubmissionResponse {
  accepted: true;
  message: string;
}

export interface PublicLeadErasureResult {
  leadsDeleted: number;
  demoRequestsDeleted: number;
  contactMessagesDeleted: number;
  totalDeleted: number;
}

export type PlatformLeadRecordKind = 'lead' | 'demo' | 'contact';

export interface PlatformLeadStaffOption {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleName: string;
}

export interface PlatformLeadItem {
  id: string;
  kind: PlatformLeadRecordKind;
  name: string;
  workEmail: string;
  company: string | null;
  country: string | null;
  employeeCountBand: string | null;
  topic: string | null;
  message: string | null;
  sourcePage: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  referrer: string | null;
  privacyConsent: boolean;
  marketingConsent: boolean;
  consentAt: string | null;
  status: LeadStatus;
  assigneeUserId: string | null;
  assigneeName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformLeadActivityItem {
  id: string;
  action: string;
  userId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  reason: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  createdAt: string;
}

export interface PlatformLeadDetail extends PlatformLeadItem {
  activity: PlatformLeadActivityItem[];
}

export interface PlatformLeadsListQuery {
  kind?: PlatformLeadRecordKind | 'leads_and_contacts';
  status?: LeadStatus | 'all';
  country?: string;
  source?: string;
  from?: string;
  to?: string;
  search?: string;
  assigneeUserId?: string;
  page?: number;
  pageSize?: number;
}

export interface PlatformLeadsListResponse {
  items: PlatformLeadItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: {
    countries: string[];
    sources: string[];
    statuses: LeadStatus[];
  };
  staff: PlatformLeadStaffOption[];
  countsByStatus: Record<LeadStatus, number>;
}

export interface UpdatePlatformLeadInput {
  status?: LeadStatus;
  assigneeUserId?: string | null;
  notes?: string;
  noteAppend?: string;
  reason?: string;
}

export type EmailSubscriptionChannel = 'blog' | 'changelog' | 'subprocessors';

export interface PublicNewsletterSubscribePayload {
  email: string;
  channel?: EmailSubscriptionChannel | string;
  consentGranted: boolean;
  consentText: string;
  consentVersion?: string;
  sourcePage?: string;
  website?: string;
}

export interface PublicNewsletterSubscribeResponse {
  accepted: true;
  message: string;
}
