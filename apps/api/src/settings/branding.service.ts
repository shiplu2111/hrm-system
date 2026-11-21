import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type {
  TenantBrandingView,
  TenantCustomDomainStatus,
  TenantDnsRecord,
  TenantPublicResolveView,
  UpdateTenantBrandingInput,
} from '@hrm/shared-types';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FeatureGateService } from '../billing/feature-gate.service';
import { CustomDomainService } from '../custom-domains/custom-domain.service';
import type { UpdateTenantBrandingDto } from './dto/branding.dto';

const DEFAULT_BRANDING = {
  primaryColor: '#2563EB',
  secondaryColor: '#1E40AF',
  accentColor: '#F59E0B',
  backgroundColor: '#F8FAFC',
  appTitle: 'HR & Workforce Portal',
  emailSenderName: 'People & Culture',
  emailSenderAddress: 'notifications@cmsnbd.com',
  showPoweredBy: true,
};

@Injectable()
export class BrandingService {
  private readonly logger = new Logger(BrandingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Optional() private readonly featureGateService?: FeatureGateService,
    @Optional() private readonly customDomainService?: CustomDomainService,
  ) {}

  /**
   * Retrieves the comprehensive branding and custom domain status for a tenant.
   */
  async getBranding(tenantId: string): Promise<TenantBrandingView> {
    const tenant = await (this.prisma.unscoped as any).tenant.findUnique({
      where: { id: tenantId },
      include: {
        brandings: true,
        customDomains: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant '${tenantId}' not found.`);
    }

    // Check plan entitlement for white_labeling
    let featureEntitlement = {
      feature: 'white_label',
      enabled: true,
      source: 'plan_default',
      planCode: tenant.planId ?? 'starter',
      reason: null as string | null,
    };

    if (this.featureGateService) {
      try {
        const evalRes = await this.featureGateService.evaluateFeature(tenantId, 'white_label');
        featureEntitlement = {
          feature: 'white_label',
          enabled: evalRes.enabled,
          source: evalRes.source,
          planCode: evalRes.planCode ?? tenant.planId ?? 'starter',
          reason: evalRes.reason ?? null,
        };
      } catch (err: any) {
        this.logger.debug(`FeatureGate evaluation fallback: ${err.message}`);
      }
    }

    const branding = tenant.brandings;
    const latestDomain = tenant.customDomains?.[0] ?? null;

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      subdomain: tenant.subdomain,
      planCode: tenant.planId ?? 'starter',
      logoUrl: branding?.logoUrl ?? null,
      faviconUrl: branding?.faviconUrl ?? null,
      primaryColor: branding?.primaryColor ?? DEFAULT_BRANDING.primaryColor,
      secondaryColor: branding?.secondaryColor ?? DEFAULT_BRANDING.secondaryColor,
      accentColor: DEFAULT_BRANDING.accentColor,
      backgroundColor: DEFAULT_BRANDING.backgroundColor,
      appTitle: branding?.companyDisplayName ?? DEFAULT_BRANDING.appTitle,
      emailSenderName: branding?.senderName ?? DEFAULT_BRANDING.emailSenderName,
      emailSenderAddress: branding?.senderEmail ?? DEFAULT_BRANDING.emailSenderAddress,
      showPoweredBy: DEFAULT_BRANDING.showPoweredBy,
      customDomain: latestDomain?.domain ?? null,
      domainStatus: (latestDomain?.status ?? 'unconfigured') as TenantCustomDomainStatus,
      verificationToken: latestDomain?.verificationToken ?? null,
      verifiedAt: latestDomain?.verifiedAt ? new Date(latestDomain.verifiedAt).toISOString() : null,
      lastCheckedAt: latestDomain?.lastCheckedAt ? new Date(latestDomain.lastCheckedAt).toISOString() : null,
      sslStatus: latestDomain?.sslStatus ?? 'disabled',
      dnsRecords: (latestDomain?.dnsRecords as TenantDnsRecord[]) ?? [],
      failureReason: latestDomain?.errorMessage ?? null,
      disabledAt: null,
      disabledReason: null,
      featureEntitlement,
    };
  }

  /**
   * Updates tenant branding assets, colors, and email sender details.
   */
  async updateBranding(
    tenantId: string,
    dto: UpdateTenantBrandingDto,
    userId?: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<TenantBrandingView> {
    const tenant = await (this.prisma.unscoped as any).tenant.findUnique({
      where: { id: tenantId },
      include: { brandings: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant '${tenantId}' not found.`);
    }

    const prev = tenant.brandings;

    // Upsert tenant_brandings
    const updated = await (this.prisma.unscoped as any).tenantBranding.upsert({
      where: { tenantId },
      create: {
        tenantId,
        logoUrl: dto.logoUrl ?? null,
        faviconUrl: dto.faviconUrl ?? null,
        primaryColor: dto.primaryColor ?? DEFAULT_BRANDING.primaryColor,
        secondaryColor: dto.secondaryColor ?? DEFAULT_BRANDING.secondaryColor,
        companyDisplayName: dto.appTitle ?? null,
        senderName: dto.emailSenderName ?? null,
        senderEmail: dto.emailSenderAddress ?? null,
      },
      update: {
        logoUrl: dto.logoUrl !== undefined ? dto.logoUrl : prev?.logoUrl,
        faviconUrl: dto.faviconUrl !== undefined ? dto.faviconUrl : prev?.faviconUrl,
        primaryColor: dto.primaryColor ?? prev?.primaryColor ?? DEFAULT_BRANDING.primaryColor,
        secondaryColor: dto.secondaryColor !== undefined ? dto.secondaryColor : prev?.secondaryColor,
        companyDisplayName: dto.appTitle !== undefined ? dto.appTitle : prev?.companyDisplayName,
        senderName: dto.emailSenderName !== undefined ? dto.emailSenderName : prev?.senderName,
        senderEmail: dto.emailSenderAddress !== undefined ? dto.emailSenderAddress : prev?.senderEmail,
      },
    });

    // Sync to tenant_settings (category: branding, key: default) for backward compatibility
    try {
      await (this.prisma.unscoped as any).tenantSetting.upsert({
        where: {
          tenantId_category_key: {
            tenantId,
            category: 'branding',
            key: 'default',
          },
        },
        create: {
          tenantId,
          category: 'branding',
          key: 'default',
          value: {
            logoUrl: updated.logoUrl,
            faviconUrl: updated.faviconUrl,
            primaryColor: updated.primaryColor,
            secondaryColor: updated.secondaryColor,
            companyDisplayName: updated.companyDisplayName,
            senderName: updated.senderName,
            senderEmail: updated.senderEmail,
          },
          updatedBy: userId ?? '00000000-0000-0000-0000-000000000000',
        },
        update: {
          value: {
            logoUrl: updated.logoUrl,
            faviconUrl: updated.faviconUrl,
            primaryColor: updated.primaryColor,
            secondaryColor: updated.secondaryColor,
            companyDisplayName: updated.companyDisplayName,
            senderName: updated.senderName,
            senderEmail: updated.senderEmail,
          },
          updatedBy: userId ?? '00000000-0000-0000-0000-000000000000',
        },
      });
    } catch (settingErr: any) {
      this.logger.warn(`Failed to sync branding to tenant_settings: ${settingErr.message}`);
    }

    // Audit log
    await this.auditService.log({
      tenantId,
      userId: userId ?? '00000000-0000-0000-0000-000000000000',
      action: AuditAction.update,
      module: 'settings',
      recordId: updated.id,
      oldValue: prev
        ? {
            logoUrl: prev.logoUrl,
            primaryColor: prev.primaryColor,
            senderName: prev.senderName,
            senderEmail: prev.senderEmail,
          }
        : null,
      newValue: {
        logoUrl: updated.logoUrl,
        primaryColor: updated.primaryColor,
        senderName: updated.senderName,
        senderEmail: updated.senderEmail,
      },
      ipAddress: meta?.ipAddress,
      device: meta?.userAgent,
    });

    return this.getBranding(tenantId);
  }

  /**
   * Public tenant and branding resolution (AUTH_FLOW.md §5).
   * Resolves tenant from either custom domain (e.g. hr.acmecorp.com) or subdomain (e.g. acme).
   */
  async resolvePublicTenant(
    subdomain?: string,
    customDomain?: string,
  ): Promise<TenantPublicResolveView> {
    let tenant: any = null;
    let resolvedCustomDomain: any = null;

    if (customDomain) {
      const normalizedDomain = customDomain.trim().toLowerCase();
      resolvedCustomDomain = await (this.prisma.unscoped as any).tenantCustomDomain.findFirst({
        where: {
          domain: normalizedDomain,
          status: 'active',
        },
        include: { tenant: { include: { brandings: true } } },
      });

      if (resolvedCustomDomain) {
        tenant = resolvedCustomDomain.tenant;
      }
    }

    if (!tenant && subdomain) {
      const normalizedSubdomain = subdomain.trim().toLowerCase();
      tenant = await (this.prisma.unscoped as any).tenant.findUnique({
        where: { subdomain: normalizedSubdomain },
        include: {
          brandings: true,
          customDomains: {
            where: { status: 'active' },
            take: 1,
          },
        },
      });
      if (tenant?.customDomains?.[0]) {
        resolvedCustomDomain = tenant.customDomains[0];
      }
    }

    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'No active tenant matches the provided subdomain or custom domain.',
      });
    }

    const branding = tenant.brandings;

    return {
      tenantId: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      status: tenant.status,
      branding: {
        logoUrl: branding?.logoUrl ?? null,
        faviconUrl: branding?.faviconUrl ?? null,
        primaryColor: branding?.primaryColor ?? DEFAULT_BRANDING.primaryColor,
        secondaryColor: branding?.secondaryColor ?? DEFAULT_BRANDING.secondaryColor,
        appTitle: branding?.companyDisplayName ?? DEFAULT_BRANDING.appTitle,
        emailSenderName: branding?.senderName ?? DEFAULT_BRANDING.emailSenderName,
        emailSenderAddress: branding?.senderEmail ?? DEFAULT_BRANDING.emailSenderAddress,
        showPoweredBy: DEFAULT_BRANDING.showPoweredBy,
      },
      customDomain: resolvedCustomDomain
        ? {
            domain: resolvedCustomDomain.domain,
            status: resolvedCustomDomain.status,
            sslStatus: resolvedCustomDomain.sslStatus,
          }
        : null,
    };
  }
}
