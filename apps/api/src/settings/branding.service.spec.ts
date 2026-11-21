import { Test, TestingModule } from '@nestjs/testing';
import { BrandingService } from './branding.service';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FeatureGateService } from '../billing/feature-gate.service';
import { CustomDomainService } from '../custom-domains/custom-domain.service';
import { NotFoundException } from '@nestjs/common';

describe('BrandingService', () => {
  let service: BrandingService;
  let prisma: any;
  let auditService: any;
  let featureGate: any;

  const mockTenantId = '22222222-2222-2222-2222-222222222222';
  const mockTenant = {
    id: mockTenantId,
    name: 'Acme Corp',
    subdomain: 'acme',
    planId: 'business',
    brandings: null,
    customDomains: [],
  };

  beforeEach(async () => {
    prisma = {
      unscoped: {
        tenant: {
          findUnique: jest.fn().mockResolvedValue(mockTenant),
        },
        tenantBranding: {
          upsert: jest.fn().mockImplementation(({ create, update }) => ({
            id: 'brand-1',
            tenantId: mockTenantId,
            logoUrl: create?.logoUrl ?? update?.logoUrl,
            faviconUrl: create?.faviconUrl ?? update?.faviconUrl,
            primaryColor: create?.primaryColor ?? update?.primaryColor ?? '#2563EB',
            secondaryColor: create?.secondaryColor ?? update?.secondaryColor ?? '#1E40AF',
            companyDisplayName: create?.companyDisplayName ?? update?.companyDisplayName,
            senderName: create?.senderName ?? update?.senderName,
            senderEmail: create?.senderEmail ?? update?.senderEmail,
          })),
        },
        tenantSetting: {
          upsert: jest.fn().mockResolvedValue({}),
        },
        tenantCustomDomain: {
          findFirst: jest.fn(),
        },
      },
    };

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    featureGate = {
      evaluateFeature: jest.fn().mockResolvedValue({
        key: 'white_label',
        enabled: true,
        source: 'plan_default',
        planCode: 'business',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandingService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: FeatureGateService, useValue: featureGate },
        { provide: CustomDomainService, useValue: {} },
      ],
    }).compile();

    service = module.get<BrandingService>(BrandingService);
  });

  it('retrieves default branding when no custom branding has been configured yet', async () => {
    const res = await service.getBranding(mockTenantId);

    expect(res.tenantId).toBe(mockTenantId);
    expect(res.tenantName).toBe('Acme Corp');
    expect(res.primaryColor).toBe('#2563EB');
    expect(res.logoUrl).toBeNull();
    expect(res.emailSenderName).toBe('People & Culture');
    expect(res.emailSenderAddress).toBe('notifications@cmsnbd.com');
  });

  it('updates branding, logo, colors, and email sender settings, syncing to tenant_settings', async () => {
    const updated = await service.updateBranding(
      mockTenantId,
      {
        logoUrl: 'https://cdn.acme.com/logo.svg',
        faviconUrl: 'https://cdn.acme.com/favicon.ico',
        primaryColor: '#059669',
        secondaryColor: '#047857',
        appTitle: 'Acme Global People',
        emailSenderName: 'Acme People Ops',
        emailSenderAddress: 'hr@acme.com',
      },
      '11111111-1111-1111-1111-111111111111',
      { ipAddress: '127.0.0.1' },
    );

    // Verified tenantBranding.upsert called
    expect(prisma.unscoped.tenantBranding.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: mockTenantId },
      }),
    );

    // Verified tenantSetting.upsert called with category: branding, key: default
    expect(prisma.unscoped.tenantSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_category_key: {
            tenantId: mockTenantId,
            category: 'branding',
            key: 'default',
          },
        },
      }),
    );

    // Verified audit log called
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: mockTenantId,
        action: 'update',
        module: 'settings',
      }),
    );
  });

  it('resolves public tenant and branding from subdomain', async () => {
    prisma.unscoped.tenant.findUnique.mockResolvedValueOnce({
      id: mockTenantId,
      name: 'Acme Corp',
      subdomain: 'acme',
      status: 'active',
      brandings: {
        logoUrl: 'https://cdn.acme.com/logo.png',
        faviconUrl: null,
        primaryColor: '#059669',
        secondaryColor: '#047857',
        companyDisplayName: 'Acme Portal',
        senderName: 'Acme HR',
        senderEmail: 'hr@acme.com',
      },
      customDomains: [],
    });

    const res = await service.resolvePublicTenant('acme');
    expect(res.tenantId).toBe(mockTenantId);
    expect(res.name).toBe('Acme Corp');
    expect(res.branding.primaryColor).toBe('#059669');
    expect(res.branding.logoUrl).toBe('https://cdn.acme.com/logo.png');
  });

  it('resolves public tenant from active custom domain', async () => {
    prisma.unscoped.tenantCustomDomain.findFirst.mockResolvedValueOnce({
      domain: 'hr.acme.com',
      status: 'active',
      sslStatus: 'active',
      tenant: {
        id: mockTenantId,
        name: 'Acme Corp',
        subdomain: 'acme',
        status: 'active',
        brandings: {
          logoUrl: 'https://cdn.acme.com/logo.png',
          primaryColor: '#059669',
          companyDisplayName: 'Acme HR',
          senderName: 'Acme HR',
          senderEmail: 'hr@acme.com',
        },
      },
    });

    const res = await service.resolvePublicTenant(undefined, 'hr.acme.com');
    expect(res.tenantId).toBe(mockTenantId);
    expect(res.subdomain).toBe('acme');
    expect(res.customDomain?.domain).toBe('hr.acme.com');
    expect(res.customDomain?.sslStatus).toBe('active');
  });

  it('throws NotFoundException when no matching tenant found for subdomain or domain', async () => {
    prisma.unscoped.tenantCustomDomain.findFirst.mockResolvedValueOnce(null);
    prisma.unscoped.tenant.findUnique.mockResolvedValueOnce(null);

    await expect(service.resolvePublicTenant('non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });
});
