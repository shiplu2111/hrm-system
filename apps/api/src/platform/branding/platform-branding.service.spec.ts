import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { FeatureGateService } from '../../billing/feature-gate.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { PlatformBrandingService } from './platform-branding.service';

describe('PlatformBrandingService', () => {
  let service: PlatformBrandingService;
  let mockPrisma: any;
  let mockFeatureGate: any;
  let mockAudit: any;

  const mockTenant = {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Globex Industries',
    subdomain: 'globex',
    planId: 'enterprise',
    status: 'active',
  };

  const mockStarterTenant = {
    id: '10000000-0000-4000-8000-000000000002',
    name: 'Vertex Health',
    subdomain: 'vertex',
    planId: 'starter',
    status: 'active',
  };

  beforeEach(async () => {
    mockPrisma = {
      unscoped: {
        tenant: {
          findUnique: jest.fn(),
        },
        tenantSetting: {
          findUnique: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
          upsert: jest.fn(),
          update: jest.fn(),
        },
      },
    };

    mockFeatureGate = {
      evaluateFeature: jest.fn(),
    };

    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformBrandingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FeatureGateService, useValue: mockFeatureGate },
        { provide: PlatformAuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<PlatformBrandingService>(PlatformBrandingService);
  });

  describe('getBranding', () => {
    it('returns branding view with FeatureGate entitlement', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue(mockTenant);
      mockFeatureGate.evaluateFeature.mockResolvedValue({
        key: 'custom_domains',
        enabled: true,
        source: 'plan_default',
      });
      mockPrisma.unscoped.tenantSetting.findUnique.mockResolvedValue(null);

      const result = await service.getBranding(mockTenant.id);

      expect(result.tenantId).toBe(mockTenant.id);
      expect(result.tenantName).toBe('Globex Industries');
      expect(result.primaryColor).toBe('#4F46E5');
      expect(result.featureEntitlement.enabled).toBe(true);
      expect(result.featureEntitlement.source).toBe('plan_default');
    });

    it('throws NotFoundException if tenant is not found', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue(null);

      await expect(service.getBranding('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateBranding & FeatureGate plan gating', () => {
    it('blocks custom domain addition when FeatureGate evaluates to false', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue(mockStarterTenant);
      mockFeatureGate.evaluateFeature.mockResolvedValue({
        key: 'custom_domains',
        enabled: false,
        source: 'plan_default',
        reason: 'Feature requires Enterprise tier',
      });
      mockPrisma.unscoped.tenantSetting.findUnique.mockResolvedValue(null);

      await expect(
        service.updateBranding(
          mockStarterTenant.id,
          { customDomain: 'hr.vertexhealth.com' },
          { id: 'actor-1' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows custom domain addition when FeatureGate evaluates to true', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue(mockTenant);
      mockFeatureGate.evaluateFeature.mockResolvedValue({
        key: 'custom_domains',
        enabled: true,
        source: 'plan_default',
      });
      mockPrisma.unscoped.tenantSetting.findUnique.mockResolvedValue(null);
      mockPrisma.unscoped.tenantSetting.upsert.mockResolvedValue({});

      const result = await service.updateBranding(
        mockTenant.id,
        {
          primaryColor: '#6366F1',
          customDomain: 'hr.globex.io',
        },
        { id: 'actor-1' },
      );

      expect(mockPrisma.unscoped.tenantSetting.upsert).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant_branding.update',
          module: 'tenant_branding',
        }),
      );
      expect(result.tenantId).toBe(mockTenant.id);
    });
  });

  describe('verifyCustomDomain (Re-check)', () => {
    it('verifies custom domain and updates DNS status', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue(mockTenant);
      mockFeatureGate.evaluateFeature.mockResolvedValue({
        key: 'custom_domains',
        enabled: true,
        source: 'plan_default',
      });
      mockPrisma.unscoped.tenantSetting.findUnique.mockResolvedValue({
        value: {
          customDomain: 'hr.globex.io',
          domainStatus: 'pending',
          verificationToken: 'hrm-verify-token-123',
        },
      });
      mockPrisma.unscoped.tenantSetting.upsert.mockResolvedValue({});

      const result = await service.verifyCustomDomain(mockTenant.id, { id: 'actor-1' });

      expect(result.verified).toBe(true);
      expect(result.status).toBe('verified');
      expect(result.dnsRecords.length).toBe(2);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'custom_domain.verify',
        }),
      );
    });

    it('throws BadRequestException if no custom domain configured', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue(mockTenant);
      mockFeatureGate.evaluateFeature.mockResolvedValue({
        key: 'custom_domains',
        enabled: true,
        source: 'plan_default',
      });
      mockPrisma.unscoped.tenantSetting.findUnique.mockResolvedValue(null);

      await expect(service.verifyCustomDomain(mockTenant.id, { id: 'actor-1' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('disableCustomDomain', () => {
    it('disables custom domain with reason and audit log', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue(mockTenant);
      mockFeatureGate.evaluateFeature.mockResolvedValue({
        key: 'custom_domains',
        enabled: true,
        source: 'plan_default',
      });
      mockPrisma.unscoped.tenantSetting.findUnique.mockResolvedValue({
        value: {
          customDomain: 'hr.globex.io',
          domainStatus: 'verified',
        },
      });
      mockPrisma.unscoped.tenantSetting.upsert.mockResolvedValue({});

      const result = await service.disableCustomDomain(
        mockTenant.id,
        { reason: 'Customer requested DNS migration' },
        { id: 'actor-1' },
      );

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'custom_domain.disable',
          reason: 'Customer requested DNS migration',
        }),
      );
      expect(result.tenantId).toBe(mockTenant.id);
    });
  });
});
