// apps/api/src/platform/audit/platform-audit.service.spec.ts
import { ForbiddenException } from '@nestjs/common';
import { PlatformActorContext, PlatformAuditService } from './platform-audit.service';

describe('PlatformAuditService', () => {
  let service: PlatformAuditService;
  let mockPrisma: any;

  const ownerActor: PlatformActorContext = {
    id: 'user-owner',
    email: 'platform.owner@cmsnbd.com',
    roleName: 'Platform Owner',
  };

  const adminActor: PlatformActorContext = {
    id: 'user-admin',
    email: 'platform.admin@cmsnbd.com',
    roleName: 'Platform Admin',
  };

  const auditorActor: PlatformActorContext = {
    id: 'user-auditor',
    email: 'auditor@cmsnbd.com',
    roleName: 'Read-Only Auditor',
  };

  const unauthorizedActor: PlatformActorContext = {
    id: 'user-guest',
    email: 'support.agent@cmsnbd.com',
    roleName: 'Support Agent',
    permissions: [{ module: 'support', action: 'view' }],
  };

  beforeEach(() => {
    mockPrisma = {
      unscoped: {
        platformAuditLog: {
          create: jest.fn().mockResolvedValue({ id: 'log-1' }),
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
        platformUser: {
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
        },
        tenant: {
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        platformRole: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      },
    };

    service = new PlatformAuditService(mockPrisma as any);
  });

  describe('Role Gating (AUDIT_LOG.md §5)', () => {
    it('allows Platform Owner, Platform Admin, and Read-Only Auditor', () => {
      expect(service.canAccess(ownerActor)).toBe(true);
      expect(service.canAccess(adminActor)).toBe(true);
      expect(service.canAccess(auditorActor)).toBe(true);
    });

    it('rejects unauthorized roles from viewing platform audit logs', () => {
      expect(service.canAccess(unauthorizedActor)).toBe(false);
      expect(() => service.assertAccess(unauthorizedActor)).toThrow(ForbiddenException);
    });
  });

  describe('Append-Only Logging & Redaction', () => {
    it('redacts passwords, tokens, and secrets in oldValue and newValue', async () => {
      await service.log({
        userId: 'u-1',
        module: 'staff',
        action: 'staff:reset_password',
        oldValue: { password: 'plain_password', role: 'Support' },
        newValue: { password: 'new_secret_pwd', role: 'Support', token: 'jwt_abc' },
      });

      expect(mockPrisma.unscoped.platformAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u-1',
          module: 'staff',
          action: 'staff:reset_password',
          oldValue: { password: '[redacted]', role: 'Support' },
          newValue: { password: '[redacted]', role: 'Support', token: '[redacted]' },
        }),
      });
    });

    it('associates tenantId from recordId for tenant module when tenantId is omitted', async () => {
      await service.log({
        userId: 'u-1',
        module: 'tenant',
        action: 'tenant:suspend',
        recordId: '10000000-0000-4000-8000-000000000002',
        reason: 'Past due',
      });

      expect(mockPrisma.unscoped.platformAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: '10000000-0000-4000-8000-000000000002',
          recordId: '10000000-0000-4000-8000-000000000002',
        }),
      });
    });
  });

  describe('Listing & Filtering', () => {
    it('filters audit logs by tenant, module, and date range', async () => {
      const mockRows = [
        {
          id: 'log-1',
          userId: 'u-1',
          tenantId: 't-1',
          module: 'tenants',
          action: 'tenant:provision',
          recordId: 't-1',
          reason: 'Initial setup',
          oldValue: null,
          newValue: { name: 'Acme' },
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome',
          createdAt: new Date('2026-11-20T10:00:00Z'),
          user: { id: 'u-1', email: 'owner@cmsnbd.com', firstName: 'Platform', lastName: 'Owner', role: { name: 'Platform Owner' } },
          tenant: { id: 't-1', name: 'Acme', subdomain: 'acme' },
        },
      ];

      mockPrisma.unscoped.platformAuditLog.findMany.mockResolvedValue(mockRows);
      mockPrisma.unscoped.platformAuditLog.count.mockResolvedValue(1);

      const result = await service.list(
        {
          tenantId: 't-1',
          module: 'tenants',
          from: '2026-11-01',
          to: '2026-11-30',
        },
        auditorActor,
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].tenantName).toBe('Acme');
      expect(result.items[0].userEmail).toBe('owner@cmsnbd.com');
      expect(result.totalPages).toBe(1);
    });
  });

  describe('CSV Export', () => {
    it('generates properly formatted CSV with quotes and headers', async () => {
      const mockRows = [
        {
          id: 'log-1',
          userId: 'u-1',
          tenantId: 't-1',
          module: 'billing',
          action: 'subscription:plan_change',
          recordId: 't-1',
          reason: 'Customer upgrade, approved by CFO',
          oldValue: { plan: 'Starter' },
          newValue: { plan: 'Enterprise' },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla',
          createdAt: new Date('2026-11-20T10:00:00Z'),
          user: { id: 'u-1', email: 'admin@cmsnbd.com', firstName: 'Admin', lastName: 'User', role: { name: 'Platform Admin' } },
          tenant: { id: 't-1', name: 'TechFlow, Inc.', subdomain: 'techflow' },
        },
      ];

      mockPrisma.unscoped.platformAuditLog.findMany.mockResolvedValue(mockRows);
      mockPrisma.unscoped.platformAuditLog.count.mockResolvedValue(1);

      const csv = await service.exportCsv({}, adminActor);

      expect(csv).toContain('Timestamp (UTC),Staff Name,Staff Email,Role,Tenant,Tenant Subdomain,Module,Action,Record ID,Reason,Old Value (JSON),New Value (JSON),IP Address,User Agent');
      expect(csv).toContain('"Admin User"');
      expect(csv).toContain('"admin@cmsnbd.com"');
      expect(csv).toContain('"TechFlow, Inc."');
      expect(csv).toContain('"Customer upgrade, approved by CFO"');
    });
  });
});
