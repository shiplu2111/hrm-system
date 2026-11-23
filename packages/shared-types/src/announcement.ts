export type PlatformAnnouncementSeverity = 'info' | 'warning' | 'critical';

export type PlatformAnnouncementAudienceType =
  | 'all'
  | 'by_plan'
  | 'by_country'
  | 'specific_tenants';

export type PlatformAnnouncementStatus = 'draft' | 'published' | 'archived';

export interface PlatformAnnouncementStats {
  targetTenantCount: number;
  targetUserCount: number;
  readCount: number;
  dismissalCount: number;
}

export interface PlatformAnnouncement {
  id: string;
  title: string;
  body: string;
  severity: PlatformAnnouncementSeverity;
  audienceType: PlatformAnnouncementAudienceType;
  targetPlans: string[];
  targetCountries: string[];
  targetTenantIds: string[];
  rolesOnly: boolean;
  startTime: string;
  endTime: string | null;
  dismissible: boolean;
  sendEmail: boolean;
  emailSentAt: string | null;
  status: PlatformAnnouncementStatus;
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
  active?: boolean;
  stats?: PlatformAnnouncementStats;
}

export interface CreatePlatformAnnouncementInput {
  title: string;
  body: string;
  severity: PlatformAnnouncementSeverity;
  audienceType: PlatformAnnouncementAudienceType;
  targetPlans?: string[];
  targetCountries?: string[];
  targetTenantIds?: string[];
  rolesOnly?: boolean;
  startTime: string;
  endTime?: string | null;
  dismissible?: boolean;
  sendEmail?: boolean;
  status?: PlatformAnnouncementStatus;
}

export interface UpdatePlatformAnnouncementInput {
  title?: string;
  body?: string;
  severity?: PlatformAnnouncementSeverity;
  audienceType?: PlatformAnnouncementAudienceType;
  targetPlans?: string[];
  targetCountries?: string[];
  targetTenantIds?: string[];
  rolesOnly?: boolean;
  startTime?: string;
  endTime?: string | null;
  dismissible?: boolean;
  sendEmail?: boolean;
  status?: PlatformAnnouncementStatus;
}

export interface AudiencePreviewQuery {
  audienceType: PlatformAnnouncementAudienceType;
  targetPlans?: string[];
  targetCountries?: string[];
  targetTenantIds?: string[];
  rolesOnly?: boolean;
}

export interface AudiencePreviewSampleTenant {
  id: string;
  name: string;
  subdomain: string;
  planId: string;
  country?: string | null;
}

export interface AudiencePreviewResult {
  tenantCount: number;
  userCount: number;
  sampleTenants: AudiencePreviewSampleTenant[];
}

export interface TenantActiveAnnouncement {
  id: string;
  title: string;
  body: string;
  severity: PlatformAnnouncementSeverity;
  startTime: string;
  endTime: string | null;
  dismissible: boolean;
  rolesOnly: boolean;
}

export interface TenantPreviewQuery {
  announcementId?: string;
  tenantId?: string;
  planId?: string;
  country?: string;
  roleName?: string;
  announcementData?: Partial<CreatePlatformAnnouncementInput>;
}

export interface TenantPreviewResult {
  matches: boolean;
  matchReasons: string[];
  banner: TenantActiveAnnouncement | null;
  tenantInfo: {
    id: string;
    name: string;
    subdomain: string;
    planId: string;
    country: string;
    roleName: string;
  };
}
