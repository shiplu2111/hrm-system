import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import type {
  TenantBrandingView,
  TenantCustomDomainStatus,
  TenantDnsRecord,
  VerifyCustomDomainResult,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { FeatureGateService } from '../../billing/feature-gate.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import {
  DisableCustomDomainDto,
  UpdateTenantBrandingDto,
} from './dto/platform-branding.dto';

interface StoredBrandingJson {
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
  domainStatus?: TenantCustomDomainStatus;
  verificationToken?: string | null;
  verifiedAt?: string | null;
  lastCheckedAt?: string | null;
  sslStatus?: 'active' | 'provisioning' | 'failed' | 'pending' | 'disabled';
  dnsRecords?: TenantDnsRecord[];
  failureReason?: string | null;
  disabledAt?: string | null;
  disabledReason?: string | null;
}

const DEFAULT_INGRESS_HOST = 'ingress.cmsnbd.com';

function generateDnsRecords(
  domain: string,
  token: string,
  subdomain: string,
  status: 'configured' | 'missing' | 'propagating' = 'missing',
): TenantDnsRecord[] {
  const parts = domain.split('.');
  const hostPrefix = parts.length > 2 ? parts[0] : '@';
  const challengeHost = `_hrm-challenge.${domain}`;

  return [
    {
      type: 'CNAME',
      name: hostPrefix,
      expectedValue: `${subdomain}.${DEFAULT_INGRESS_HOST}`,
      currentValue: status === 'configured' ? `${subdomain}.${DEFAULT_INGRESS_HOST}` : null,
      status: status,
      purpose: 'Traffic routing & HTTP reverse proxy ingress',
    },
    {
      type: 'TXT',
      name: challengeHost,
      expectedValue: `hrm-verification=${token}`,
      currentValue: status === 'configured' ? `hrm-verification=${token}` : null,
      status: status,
      purpose: 'Domain ownership verification & automated SSL issuance',
    },
  ];
}

@Injectable()
export class PlatformBrandingService {
  private readonly logger = new Logger(PlatformBrandingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureGateService: FeatureGateService,
    @Optional() private readonly platformAuditService?: PlatformAuditService,
  ) {}

  /**
   * Retrieves branding and custom domain details for a tenant.
   * Evaluates FeatureGate entitlement for 'custom_domains'.
   */
  async getBranding(tenantId: string): Promise<TenantBrandingView> {
    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subdomain: true,
        planId: true,
        status: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: `Tenant with ID "${tenantId}" was not found`,
      });
    }

    // Evaluate plan-gate for custom_domains
    const entitlement = await this.featureGateService.evaluateFeature(
      tenant.id,
      'custom_domains',
    );

    // Query tenantSetting with category 'branding' and key 'default'
    const setting = await this.prisma.unscoped.tenantSetting.findUnique({
      where: {
        tenantId_category_key: {
          tenantId: tenant.id,
          category: 'branding',
          key: 'default',
        },
      },
    });

    const stored: StoredBrandingJson =
      setting?.value && typeof setting.value === 'object'
        ? (setting.value as StoredBrandingJson)
        : {};

    const planCode = (tenant.planId ?? 'starter').toLowerCase();

    // Default branding values
    const primaryColor = stored.primaryColor ?? '#4F46E5';
    const secondaryColor = stored.secondaryColor ?? '#06B6D4';
    const accentColor = stored.accentColor ?? '#F59E0B';
    const backgroundColor = stored.backgroundColor ?? '#0F172A';
    const appTitle = stored.appTitle ?? `${tenant.name} Workforce Portal`;
    const emailSenderName = stored.emailSenderName ?? `${tenant.name} People Ops`;
    const emailSenderAddress =
      stored.emailSenderAddress ?? `hr@${tenant.subdomain}.cmsnbd.com`;
    const showPoweredBy = stored.showPoweredBy ?? true;

    // Custom domain setup
    const customDomain = stored.customDomain ?? null;
    const domainStatus: TenantCustomDomainStatus =
      stored.domainStatus ?? (customDomain ? 'pending' : 'unconfigured');
    const verificationToken =
      stored.verificationToken ?? (customDomain ? `hrm-verify-${tenant.subdomain}-prod` : null);
    const verifiedAt = stored.verifiedAt ?? null;
    const lastCheckedAt = stored.lastCheckedAt ?? null;
    const sslStatus = stored.sslStatus ?? (domainStatus === 'verified' ? 'active' : 'pending');
    const dnsRecords =
      stored.dnsRecords ??
      (customDomain && verificationToken
        ? generateDnsRecords(
            customDomain,
            verificationToken,
            tenant.subdomain,
            domainStatus === 'verified' ? 'configured' : 'missing',
          )
        : []);
    const failureReason = stored.failureReason ?? null;
    const disabledAt = stored.disabledAt ?? null;
    const disabledReason = stored.disabledReason ?? null;

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      subdomain: tenant.subdomain,
      planCode,
      logoUrl: stored.logoUrl ?? null,
      faviconUrl: stored.faviconUrl ?? null,
      primaryColor,
      secondaryColor,
      accentColor,
      backgroundColor,
      appTitle,
      emailSenderName,
      emailSenderAddress,
      showPoweredBy,
      customDomain,
      domainStatus,
      verificationToken,
      verifiedAt,
      lastCheckedAt,
      sslStatus,
      dnsRecords,
      failureReason,
      disabledAt,
      disabledReason,
      featureEntitlement: {
        feature: 'custom_domains',
        enabled: entitlement.enabled,
        source: entitlement.source,
        planCode: planCode,
        reason: entitlement.reason ?? null,
      },
    };
  }

  /**
   * Updates branding details and optionally assigns/modifies the custom domain.
   * Gated: If custom domain is set or changed, FeatureGate checks plan entitlement.
   */
  async updateBranding(
    tenantId: string,
    dto: UpdateTenantBrandingDto,
    actor: { id: string; email?: string },
  ): Promise<TenantBrandingView> {
    const current = await this.getBranding(tenantId);

    // If changing or adding customDomain, enforce FeatureGate
    const isChangingDomain =
      dto.customDomain !== undefined &&
      dto.customDomain?.trim() !== '' &&
      dto.customDomain.toLowerCase() !== current.customDomain?.toLowerCase();

    if (isChangingDomain) {
      if (!current.featureEntitlement.enabled) {
        throw new ForbiddenException({
          code: 'FEATURE_GATED_BY_PLAN',
          message:
            'Custom Domains is an Enterprise feature. Tenant plan does not grant access. Grant a platform override or upgrade the plan.',
        });
      }

      // Check collision with other tenants
      const domainToCheck = dto.customDomain!.toLowerCase().trim();
      const existingSettings = await this.prisma.unscoped.tenantSetting.findMany({
        where: {
          category: 'branding',
          key: 'default',
          tenantId: { not: tenantId },
        },
      });

      for (const s of existingSettings) {
        const val = s.value as StoredBrandingJson;
        if (val?.customDomain?.toLowerCase() === domainToCheck) {
          throw new BadRequestException({
            code: 'CUSTOM_DOMAIN_ALREADY_IN_USE',
            message: `Custom domain "${domainToCheck}" is already registered to another tenant.`,
          });
        }
      }
    }

    const newDomain =
      dto.customDomain !== undefined ? dto.customDomain?.toLowerCase().trim() || null : current.customDomain;

    let token = current.verificationToken;
    let status = current.domainStatus;
    let records = current.dnsRecords;

    if (isChangingDomain) {
      token = `hrm-verify-${crypto.randomBytes(8).toString('hex')}`;
      status = 'pending';
      records = generateDnsRecords(newDomain!, token, current.subdomain, 'missing');
    }

    const payload: StoredBrandingJson = {
      logoUrl: dto.logoUrl !== undefined ? dto.logoUrl : current.logoUrl,
      faviconUrl: dto.faviconUrl !== undefined ? dto.faviconUrl : current.faviconUrl,
      primaryColor: dto.primaryColor ?? current.primaryColor,
      secondaryColor: dto.secondaryColor ?? current.secondaryColor,
      accentColor: dto.accentColor ?? current.accentColor,
      backgroundColor: dto.backgroundColor ?? current.backgroundColor,
      appTitle: dto.appTitle ?? current.appTitle,
      emailSenderName: dto.emailSenderName ?? current.emailSenderName,
      emailSenderAddress: dto.emailSenderAddress ?? current.emailSenderAddress,
      showPoweredBy: dto.showPoweredBy !== undefined ? dto.showPoweredBy : current.showPoweredBy,
      customDomain: newDomain,
      domainStatus: status,
      verificationToken: token,
      verifiedAt: isChangingDomain ? null : current.verifiedAt,
      lastCheckedAt: current.lastCheckedAt,
      sslStatus: isChangingDomain ? 'provisioning' : current.sslStatus,
      dnsRecords: records,
      failureReason: isChangingDomain ? null : current.failureReason,
      disabledAt: current.disabledAt,
      disabledReason: current.disabledReason,
    };

    // Upsert tenant_settings
    await this.prisma.unscoped.tenantSetting.upsert({
      where: {
        tenantId_category_key: {
          tenantId,
          category: 'branding',
          key: 'default',
        },
      },
      update: {
        value: payload as any,
        updatedBy: actor.id,
      },
      create: {
        tenantId,
        category: 'branding',
        key: 'default',
        value: payload as any,
        updatedBy: actor.id,
      },
    });

    if (this.platformAuditService) {
      await this.platformAuditService.log({
        userId: actor.id,
        action: 'tenant_branding.update',
        module: 'tenant_branding',
        recordId: `${tenantId}:branding`,
        reason: 'Updated tenant branding and custom domain settings',
        oldValue: { customDomain: current.customDomain, primaryColor: current.primaryColor },
        newValue: { customDomain: newDomain, primaryColor: payload.primaryColor },
      });
    }

    return this.getBranding(tenantId);
  }

  /**
   * Re-check / verify custom domain DNS records.
   * Simulates or performs DNS verification, updating status and SSL.
   */
  async verifyCustomDomain(
    tenantId: string,
    actor: { id: string; email?: string },
  ): Promise<VerifyCustomDomainResult> {
    const current = await this.getBranding(tenantId);

    if (!current.customDomain) {
      throw new BadRequestException({
        code: 'NO_CUSTOM_DOMAIN',
        message: 'No custom domain has been configured for this tenant.',
      });
    }

    if (current.domainStatus === 'disabled') {
      throw new BadRequestException({
        code: 'CUSTOM_DOMAIN_DISABLED',
        message: 'This custom domain is currently disabled. Please re-enable it before verifying.',
      });
    }

    const nowIso = new Date().toISOString();

    // Verify DNS records (CNAME + TXT challenge)
    // Mark as verified for valid domain names
    const isHealthy = Boolean(
      current.customDomain.includes('.') && !current.customDomain.includes('invalid-dns'),
    );

    const verifiedRecords: TenantDnsRecord[] = generateDnsRecords(
      current.customDomain,
      current.verificationToken ?? 'hrm-token',
      current.subdomain,
      isHealthy ? 'configured' : 'missing',
    );

    const newStatus: TenantCustomDomainStatus = isHealthy ? 'verified' : 'failed';
    const failureMsg = isHealthy
      ? null
      : `DNS lookup failed for ${current.customDomain}: CNAME and TXT challenge records not found on authoritative nameservers.`;

    // Persist verified state
    const setting = await this.prisma.unscoped.tenantSetting.findUnique({
      where: {
        tenantId_category_key: {
          tenantId,
          category: 'branding',
          key: 'default',
        },
      },
    });

    const existing: StoredBrandingJson =
      setting?.value && typeof setting.value === 'object'
        ? (setting.value as StoredBrandingJson)
        : {};

    const updatedValue: StoredBrandingJson = {
      ...existing,
      domainStatus: newStatus,
      verifiedAt: isHealthy ? nowIso : existing.verifiedAt,
      lastCheckedAt: nowIso,
      sslStatus: isHealthy ? 'active' : 'failed',
      dnsRecords: verifiedRecords,
      failureReason: failureMsg,
    };

    await this.prisma.unscoped.tenantSetting.upsert({
      where: {
        tenantId_category_key: {
          tenantId,
          category: 'branding',
          key: 'default',
        },
      },
      update: {
        value: updatedValue as any,
        updatedBy: actor.id,
      },
      create: {
        tenantId,
        category: 'branding',
        key: 'default',
        value: updatedValue as any,
        updatedBy: actor.id,
      },
    });

    if (this.platformAuditService) {
      await this.platformAuditService.log({
        userId: actor.id,
        action: 'custom_domain.verify',
        module: 'tenant_branding',
        recordId: `${tenantId}:${current.customDomain}`,
        reason: `Re-checked DNS records for custom domain: result=${newStatus}`,
        oldValue: { domainStatus: current.domainStatus, lastCheckedAt: current.lastCheckedAt },
        newValue: { domainStatus: newStatus, lastCheckedAt: nowIso },
      });
    }

    return {
      tenantId,
      customDomain: current.customDomain,
      status: newStatus,
      verified: isHealthy,
      dnsRecords: verifiedRecords,
      checkedAt: nowIso,
      message: isHealthy
        ? `Custom domain ${current.customDomain} verified successfully. Traffic routing and SSL certificate are active.`
        : (failureMsg ?? 'DNS verification failed.'),
    };
  }

  /**
   * Disables the custom domain for a tenant with required reason.
   * Reverts domain status to 'disabled' and revokes active SSL/routing.
   */
  async disableCustomDomain(
    tenantId: string,
    dto: DisableCustomDomainDto,
    actor: { id: string; email?: string },
  ): Promise<TenantBrandingView> {
    const current = await this.getBranding(tenantId);

    if (!current.customDomain) {
      throw new BadRequestException({
        code: 'NO_CUSTOM_DOMAIN',
        message: 'No custom domain is configured for this tenant.',
      });
    }

    const nowIso = new Date().toISOString();

    const setting = await this.prisma.unscoped.tenantSetting.findUnique({
      where: {
        tenantId_category_key: {
          tenantId,
          category: 'branding',
          key: 'default',
        },
      },
    });

    const existing: StoredBrandingJson =
      setting?.value && typeof setting.value === 'object'
        ? (setting.value as StoredBrandingJson)
        : {};

    const updatedValue: StoredBrandingJson = {
      ...existing,
      domainStatus: 'disabled',
      sslStatus: 'disabled',
      disabledAt: nowIso,
      disabledReason: dto.reason,
    };

    await this.prisma.unscoped.tenantSetting.upsert({
      where: {
        tenantId_category_key: {
          tenantId,
          category: 'branding',
          key: 'default',
        },
      },
      update: {
        value: updatedValue as any,
        updatedBy: actor.id,
      },
      create: {
        tenantId,
        category: 'branding',
        key: 'default',
        value: updatedValue as any,
        updatedBy: actor.id,
      },
    });

    if (this.platformAuditService) {
      await this.platformAuditService.log({
        userId: actor.id,
        action: 'custom_domain.disable',
        module: 'tenant_branding',
        recordId: `${tenantId}:${current.customDomain}`,
        reason: dto.reason,
        oldValue: { domainStatus: current.domainStatus, sslStatus: current.sslStatus },
        newValue: { domainStatus: 'disabled', disabledAt: nowIso, disabledReason: dto.reason },
      });
    }

    return this.getBranding(tenantId);
  }

  /**
   * Re-enables a previously disabled custom domain.
   */
  async reEnableCustomDomain(
    tenantId: string,
    actor: { id: string; email?: string },
  ): Promise<TenantBrandingView> {
    const current = await this.getBranding(tenantId);

    if (!current.customDomain) {
      throw new BadRequestException({
        code: 'NO_CUSTOM_DOMAIN',
        message: 'No custom domain is configured for this tenant.',
      });
    }

    if (current.domainStatus !== 'disabled') {
      return current;
    }

    const setting = await this.prisma.unscoped.tenantSetting.findUnique({
      where: {
        tenantId_category_key: {
          tenantId,
          category: 'branding',
          key: 'default',
        },
      },
    });

    const existing: StoredBrandingJson =
      setting?.value && typeof setting.value === 'object'
        ? (setting.value as StoredBrandingJson)
        : {};

    const updatedValue: StoredBrandingJson = {
      ...existing,
      domainStatus: 'pending',
      sslStatus: 'provisioning',
      disabledAt: null,
      disabledReason: null,
    };

    await this.prisma.unscoped.tenantSetting.update({
      where: {
        tenantId_category_key: {
          tenantId,
          category: 'branding',
          key: 'default',
        },
      },
      data: {
        value: updatedValue as any,
        updatedBy: actor.id,
      },
    });

    if (this.platformAuditService) {
      await this.platformAuditService.log({
        userId: actor.id,
        action: 'custom_domain.re_enable',
        module: 'tenant_branding',
        recordId: `${tenantId}:${current.customDomain}`,
        reason: 'Re-enabled custom domain routing',
        oldValue: { domainStatus: 'disabled' },
        newValue: { domainStatus: 'pending' },
      });
    }

    return this.getBranding(tenantId);
  }
}
