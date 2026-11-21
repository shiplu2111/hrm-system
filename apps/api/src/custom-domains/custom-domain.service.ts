import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import type {
  CustomDomainView,
  TenantDnsRecord,
  VerifyCustomDomainResult,
} from '@hrm/shared-types';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DnsVerificationService } from './dns/dns-verification.service';
import { AutomaticTlsProvider } from './tls/tls-certificate.provider';
import type { CreateCustomDomainDto } from './dto/custom-domain.dto';

const RESERVED_DOMAINS = new Set([
  'localhost',
  'cmsnbd.com',
  'api.cmsnbd.com',
  'app.cmsnbd.com',
  'platform.cmsnbd.com',
  'hrmplatform.com',
]);

@Injectable()
export class CustomDomainService {
  private readonly logger = new Logger(CustomDomainService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly dnsService: DnsVerificationService,
    private readonly tlsProvider: AutomaticTlsProvider,
  ) {}

  /**
   * Registers a new custom domain for the tenant and returns DNS records to create.
   */
  async createCustomDomain(
    tenantId: string,
    dto: CreateCustomDomainDto,
    userId?: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<CustomDomainView> {
    const normalizedDomain = dto.domain.trim().toLowerCase();

    // Check reserved domains
    if (RESERVED_DOMAINS.has(normalizedDomain) || normalizedDomain.endsWith('.cmsnbd.com')) {
      throw new BadRequestException({
        code: 'DOMAIN_RESERVED',
        message: `Domain '${normalizedDomain}' is a reserved platform domain and cannot be used as a custom domain.`,
      });
    }

    // Check uniqueness across all tenants
    const existing = await (this.prisma.unscoped as any).tenantCustomDomain.findUnique({
      where: { domain: normalizedDomain },
    });
    if (existing) {
      if (existing.tenantId === tenantId) {
        throw new ConflictException({
          code: 'DOMAIN_ALREADY_REGISTERED',
          message: `Domain '${normalizedDomain}' is already configured for this organization.`,
        });
      }
      throw new ConflictException({
        code: 'DOMAIN_IN_USE',
        message: `Domain '${normalizedDomain}' is already registered by another organization.`,
      });
    }

    // Generate unique verification token
    const verificationToken = `hrm-verify-${crypto.randomBytes(16).toString('hex')}`;
    const dnsRecords = this.dnsService.generateDnsRecords(normalizedDomain, verificationToken);

    const created = await (this.prisma.unscoped as any).tenantCustomDomain.create({
      data: {
        tenantId,
        domain: normalizedDomain,
        status: 'pending_verification',
        verificationToken,
        dnsRecords: dnsRecords as any,
        sslStatus: 'pending',
        createdBy: userId ?? null,
      },
    });

    await this.auditService.log({
      tenantId,
      userId: userId ?? '00000000-0000-0000-0000-000000000000',
      action: AuditAction.create,
      module: 'settings',
      recordId: created.id,
      newValue: {
        domain: normalizedDomain,
        verificationToken,
      },
      ipAddress: meta?.ipAddress,
      device: meta?.userAgent,
    });

    return this.mapCustomDomainView(created);
  }

  /**
   * Lists all custom domains configured for a tenant.
   */
  async listCustomDomains(tenantId: string): Promise<CustomDomainView[]> {
    const list = await (this.prisma.unscoped as any).tenantCustomDomain.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return list.map(this.mapCustomDomainView);
  }

  /**
   * Retrieves a single custom domain by ID.
   */
  async getCustomDomain(tenantId: string, domainId: string): Promise<CustomDomainView> {
    const domain = await (this.prisma.unscoped as any).tenantCustomDomain.findFirst({
      where: { id: domainId, tenantId },
    });
    if (!domain) {
      throw new NotFoundException(`Custom domain with ID '${domainId}' not found.`);
    }
    return this.mapCustomDomainView(domain);
  }

  /**
   * Verifies DNS records for the domain and automatically provisions TLS certificates upon success.
   */
  async verifyCustomDomain(
    tenantId: string,
    domainId: string,
    userId?: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<VerifyCustomDomainResult> {
    const record = await (this.prisma.unscoped as any).tenantCustomDomain.findFirst({
      where: { id: domainId, tenantId },
    });
    if (!record) {
      throw new NotFoundException(`Custom domain '${domainId}' not found.`);
    }

    const check = await this.dnsService.verifyDnsRecords(
      record.domain,
      record.verificationToken,
      record.dnsRecords as TenantDnsRecord[],
    );

    const now = new Date();

    if (!check.verified) {
      // DNS verification did not pass
      const updated = await (this.prisma.unscoped as any).tenantCustomDomain.update({
        where: { id: record.id },
        data: {
          dnsRecords: check.dnsRecords as any,
          lastCheckedAt: now,
          status: 'pending_verification',
          errorMessage: check.errorMessage ?? 'DNS records verification pending or mismatched.',
        },
      });

      return {
        tenantId,
        customDomain: record.domain,
        status: updated.status,
        verified: false,
        dnsRecords: check.dnsRecords,
        checkedAt: now.toISOString(),
        message: updated.errorMessage,
      };
    }

    // DNS verification succeeded -> Automatically provision TLS certificate!
    this.logger.log(
      `DNS verified for domain '${record.domain}'. Provisioning automated TLS certificate...`,
    );

    let certResult;
    try {
      // Transition to provisioning_tls
      await (this.prisma.unscoped as any).tenantCustomDomain.update({
        where: { id: record.id },
        data: {
          status: 'provisioning_tls',
          sslStatus: 'provisioning',
          verifiedAt: now,
          lastCheckedAt: now,
          dnsRecords: check.dnsRecords as any,
          errorMessage: null,
        },
      });

      certResult = await this.tlsProvider.provisionCertificate(record.domain);
    } catch (certErr: any) {
      this.logger.error(`TLS provisioning failed for '${record.domain}': ${certErr.message}`);
      await (this.prisma.unscoped as any).tenantCustomDomain.update({
        where: { id: record.id },
        data: {
          status: 'failed',
          sslStatus: 'failed',
          errorMessage: `TLS Provisioning failed: ${certErr.message}`,
        },
      });

      throw new BadRequestException({
        code: 'TLS_PROVISION_FAILED',
        message: `Domain verified but TLS certificate provisioning failed: ${certErr.message}`,
      });
    }

    // Mark domain active and secure
    const secured = await (this.prisma.unscoped as any).tenantCustomDomain.update({
      where: { id: record.id },
      data: {
        status: 'active',
        sslStatus: 'active',
        sslCertificateId: certResult.certificateId,
        sslIssuedAt: certResult.issuedAt,
        sslExpiresAt: certResult.expiresAt,
        sslDetails: {
          issuer: certResult.issuer,
          san: certResult.san,
          serialNumber: certResult.serialNumber,
          fingerprint: certResult.fingerprint,
          autoRenew: certResult.autoRenew,
        },
        verifiedAt: now,
        lastCheckedAt: now,
        errorMessage: null,
      },
    });

    await this.auditService.log({
      tenantId,
      userId: userId ?? '00000000-0000-0000-0000-000000000000',
      action: AuditAction.update,
      module: 'settings',
      recordId: secured.id,
      newValue: {
        domain: secured.domain,
        status: 'active',
        sslStatus: 'active',
        sslCertificateId: certResult.certificateId,
        sslExpiresAt: certResult.expiresAt.toISOString(),
      },
      ipAddress: meta?.ipAddress,
      device: meta?.userAgent,
    });

    return {
      tenantId,
      customDomain: secured.domain,
      status: secured.status,
      verified: true,
      dnsRecords: check.dnsRecords,
      checkedAt: now.toISOString(),
      message: 'Domain verified and TLS certificate provisioned successfully.',
    };
  }

  /**
   * Deletes a custom domain and revokes its certificate.
   */
  async deleteCustomDomain(
    tenantId: string,
    domainId: string,
    userId?: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const domain = await (this.prisma.unscoped as any).tenantCustomDomain.findFirst({
      where: { id: domainId, tenantId },
    });
    if (!domain) {
      throw new NotFoundException(`Custom domain '${domainId}' not found.`);
    }

    if (domain.sslCertificateId) {
      await this.tlsProvider
        .revokeCertificate(domain.sslCertificateId, domain.domain)
        .catch((err) => this.logger.warn(`Failed to revoke cert: ${err.message}`));
    }

    await (this.prisma.unscoped as any).tenantCustomDomain.delete({
      where: { id: domainId },
    });

    await this.auditService.log({
      tenantId,
      userId: userId ?? '00000000-0000-0000-0000-000000000000',
      action: AuditAction.delete,
      module: 'settings',
      recordId: domainId,
      oldValue: {
        domain: domain.domain,
        status: domain.status,
      },
      ipAddress: meta?.ipAddress,
      device: meta?.userAgent,
    });
  }

  /**
   * Finds an active custom domain for tenant-resolved login (AUTH_FLOW.md §5).
   */
  async findActiveDomain(domain: string) {
    const normalizedDomain = domain.trim().toLowerCase();
    return (this.prisma.unscoped as any).tenantCustomDomain.findFirst({
      where: {
        domain: normalizedDomain,
        status: 'active',
      },
      include: {
        tenant: true,
      },
    });
  }

  private mapCustomDomainView(record: any): CustomDomainView {
    return {
      id: record.id,
      tenantId: record.tenantId,
      domain: record.domain,
      status: record.status,
      verificationToken: record.verificationToken,
      dnsRecords: record.dnsRecords as any,
      sslStatus: record.sslStatus,
      sslCertificateId: record.sslCertificateId ?? null,
      sslIssuedAt: record.sslIssuedAt ? new Date(record.sslIssuedAt).toISOString() : null,
      sslExpiresAt: record.sslExpiresAt ? new Date(record.sslExpiresAt).toISOString() : null,
      sslDetails: record.sslDetails ?? null,
      verifiedAt: record.verifiedAt ? new Date(record.verifiedAt).toISOString() : null,
      lastCheckedAt: record.lastCheckedAt ? new Date(record.lastCheckedAt).toISOString() : null,
      errorMessage: record.errorMessage ?? null,
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
    };
  }
}
