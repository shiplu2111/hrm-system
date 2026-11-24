// apps/api/src/platform/api-registry/platform-api-registry.service.spec.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantApiKeyStatus, TenantOAuthClientStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import {
  PlatformApiRegistryService,
  resolveBaselinePlanLimits,
} from './platform-api-registry.service';

describe('PlatformApiRegistryService', () => {
  let service: PlatformApiRegistryService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      unscoped: {
        tenantApiKey: {
          count: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
          createMany: jest.fn(),
          aggregate: jest.fn(),
        },
        tenantOAuthClient: {
          count: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
          createMany: jest.fn(),
        },
        tenantOAuthAccessToken: {
          updateMany: jest.fn(),
        },
        tenantRateLimitOverride: {
          count: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
          upsert: jest.fn(),
          delete: jest.fn(),
        },
        tenant: {
          count: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
        },
        user: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        platformUser: {
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue(null),
        },
      },
    };

    audit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformApiRegistryService,
        { provide: PrismaService, useValue: prisma },
        { provide: PlatformAuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<PlatformApiRegistryService>(PlatformApiRegistryService);
  });

  describe('resolveBaselinePlanLimits', () => {
    it('resolves correct default rates for enterprise plan', () => {
      const res = resolveBaselinePlanLimits('enterprise');
      expect(res.rateLimitPerMin).toBe(1000);
      expect(res.burstLimit).toBe(2000);
      expect(res.planTier).toBe('Enterprise');
    });

    it('resolves correct default rates for business plan', () => {
      const res = resolveBaselinePlanLimits('business');
      expect(res.rateLimitPerMin).toBe(300);
      expect(res.burstLimit).toBe(500);
      expect(res.planTier).toBe('Business');
    });

    it('resolves correct default rates for starter plan', () => {
      const res = resolveBaselinePlanLimits('starter');
      expect(res.rateLimitPerMin).toBe(120);
      expect(res.burstLimit).toBe(200);
    });

    it('resolves correct default rates for free plan', () => {
      const res = resolveBaselinePlanLimits('free');
      expect(res.rateLimitPerMin).toBe(60);
      expect(res.burstLimit).toBe(100);
    });
  });

  describe('revokeApiKey', () => {
    it('throws BadRequestException if reason is empty', async () => {
      await expect(
        service.revokeApiKey(
          'key-1',
          { reason: '   ' },
          { id: 'user-1', email: 'admin@platform.com' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if key does not exist', async () => {
      prisma.unscoped.tenantApiKey.findUnique.mockResolvedValue(null);

      await expect(
        service.revokeApiKey(
          'non-existent',
          { reason: 'Suspected token leakage' },
          { id: 'user-1', email: 'admin@platform.com' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('revokes active key and writes to platform audit log', async () => {
      const mockKey = {
        id: 'key-1',
        tenantId: 'tenant-1',
        name: 'Payroll Integration',
        prefix: 'hrm_live_1234',
        scopes: ['read:payroll'],
        status: TenantApiKeyStatus.active,
        createdAt: new Date(),
        tenant: { id: 'tenant-1', name: 'Acme', subdomain: 'acme' },
      };

      prisma.unscoped.tenantApiKey.findUnique.mockResolvedValue(mockKey);
      prisma.unscoped.tenantApiKey.update.mockResolvedValue({
        ...mockKey,
        status: TenantApiKeyStatus.revoked,
        revokedAt: new Date(),
        revokedByUserId: 'user-1',
      });

      const result = await service.revokeApiKey(
        'key-1',
        { reason: 'Compromised developer machine' },
        { id: 'user-1', email: 'admin@platform.com' },
      );

      expect(result.status).toBe('revoked');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'api_access',
          action: 'api_key:revoke',
          recordId: 'key-1',
          reason: 'Compromised developer machine',
        }),
      );
    });
  });

  describe('setRateLimitOverride', () => {
    it('throws BadRequestException if reason is missing', async () => {
      await expect(
        service.setRateLimitOverride(
          'tenant-1',
          { rateLimitPerMin: 500, reason: '' },
          { id: 'user-1' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if rateLimit is out of range', async () => {
      await expect(
        service.setRateLimitOverride(
          'tenant-1',
          { rateLimitPerMin: 5, reason: 'Valid reason' },
          { id: 'user-1' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('upserts override and logs to platform audit', async () => {
      prisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'Acme',
        subdomain: 'acme',
        planId: 'business',
      });
      prisma.unscoped.tenantRateLimitOverride.findUnique.mockResolvedValue(null);
      prisma.unscoped.tenantRateLimitOverride.upsert.mockResolvedValue({
        id: 'override-1',
        tenantId: 'tenant-1',
        rateLimitPerMin: 1500,
        burstLimit: 3000,
        reason: 'Migration event',
        grantedByUserId: 'user-1',
        expiresAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.setRateLimitOverride(
        'tenant-1',
        { rateLimitPerMin: 1500, burstLimit: 3000, reason: 'Migration event' },
        { id: 'user-1', email: 'admin@platform.com' },
      );

      expect(res.effectiveRateLimitPerMin).toBe(1500);
      expect(res.effectiveBurstLimit).toBe(3000);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'api_access',
          action: 'rate_limit:set_override',
        }),
      );
    });
  });
});
