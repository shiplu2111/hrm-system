export type TenantCustomDomainStatus =
  | 'unconfigured'
  | 'pending'
  | 'verified'
  | 'failed'
  | 'disabled';

export type TenantDnsRecordType = 'CNAME' | 'TXT' | 'A';

export type TenantDnsRecordStatus =
  | 'configured'
  | 'missing'
  | 'propagating'
  | 'error';

export interface TenantDnsRecord {
  type: TenantDnsRecordType;
  name: string;
  expectedValue: string;
  currentValue: string | null;
  status: TenantDnsRecordStatus;
  purpose: string;
}

export interface TenantBrandingView {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  planCode: string;
  // Branding assets & theme
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  appTitle: string;
  emailSenderName: string;
  emailSenderAddress: string;
  showPoweredBy: boolean;
  // Custom Domain & SSL
  customDomain: string | null;
  domainStatus: TenantCustomDomainStatus;
  verificationToken: string | null;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  sslStatus: 'active' | 'provisioning' | 'failed' | 'pending' | 'disabled';
  dnsRecords: TenantDnsRecord[];
  failureReason: string | null;
  disabledAt: string | null;
  disabledReason: string | null;
  // Plan feature entitlement evaluation
  featureEntitlement: {
    feature: string;
    enabled: boolean;
    source: string;
    planCode: string;
    reason?: string | null;
  };
}

export interface UpdateTenantBrandingInput {
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  appTitle?: string;
  emailSenderName?: string;
  emailSenderAddress?: string;
  showPoweredBy?: boolean;
  customDomain?: string | null;
}

export interface VerifyCustomDomainResult {
  tenantId: string;
  customDomain: string;
  status: TenantCustomDomainStatus;
  verified: boolean;
  dnsRecords: TenantDnsRecord[];
  checkedAt: string;
  message: string;
}

export interface DisableCustomDomainInput {
  reason: string;
}

export interface CustomDomainView {
  id: string;
  tenantId: string;
  domain: string;
  status: 'pending_verification' | 'verified' | 'dns_failed' | 'provisioning_tls' | 'active' | 'failed' | 'disabled';
  verificationToken: string;
  dnsRecords: TenantDnsRecord[];
  sslStatus: 'pending' | 'provisioning' | 'active' | 'failed' | 'expired';
  sslCertificateId: string | null;
  sslIssuedAt: string | null;
  sslExpiresAt: string | null;
  sslDetails?: {
    issuer?: string;
    san?: string[];
    serialNumber?: string;
    autoRenew?: boolean;
  } | null;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomDomainInput {
  domain: string;
}

/**
 * Public Tenant & Branding Resolution (AUTH_FLOW.md §5)
 */
export interface TenantPublicResolveView {
  tenantId: string;
  name: string;
  subdomain: string;
  status: string;
  branding: {
    logoUrl: string | null;
    faviconUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    appTitle: string;
    emailSenderName: string;
    emailSenderAddress: string;
    showPoweredBy: boolean;
  };
  customDomain?: {
    domain: string;
    status: string;
    sslStatus: string;
  } | null;
}

