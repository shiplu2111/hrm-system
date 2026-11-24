// packages/shared-types/src/platform-audit.ts

export interface PlatformAuditLogItem {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  userRole: string | null;
  tenantId: string | null;
  tenantName: string | null;
  tenantSubdomain: string | null;
  module: string;
  action: string;
  recordId: string | null;
  reason: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface PlatformAuditLogQuery {
  userId?: string;
  tenantId?: string;
  module?: string;
  action?: string;
  recordId?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface PlatformAuditLogResponse {
  items: PlatformAuditLogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PlatformAuditFilterStaff {
  id: string;
  name: string;
  email: string;
  roleName: string;
}

export interface PlatformAuditFilterTenant {
  id: string;
  name: string;
  subdomain: string;
}

export interface PlatformAuditFilterOptions {
  staffMembers: PlatformAuditFilterStaff[];
  tenants: PlatformAuditFilterTenant[];
  modules: string[];
  actions: string[];
}
