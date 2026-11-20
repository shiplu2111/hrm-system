import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { NotificationDeliveryService } from '../../notifications/notification-delivery.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { PlatformSupportAccessService } from './platform-support-access.service';

describe('PlatformSupportAccessService', () => {
  let service: PlatformSupportAccessService;

  const mockPrisma = {
    unscoped: {
      tenant: {
        findUnique: jest.fn(),
      },
      tenantSetting: {
        findUnique: jest.fn(),
      },
      supportAccessRequest: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    },
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const mockPlatformAudit = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockNotificationDelivery = {
    deliverInApp: jest.fn().mockResolvedValue(undefined),
    deliverEmailWithRetry: jest.fn().mockResolvedValue(undefined),
  };

  const mockStaff = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'sarah.support@platform.corp',
    firstName: 'Sarah',
    lastName: 'Connor',
    roleName: 'Platform Support Engineer',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformSupportAccessService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PlatformAuditService, useValue: mockPlatformAudit },
        {
          provide: NotificationDeliveryService,
          useValue: mockNotificationDelivery,
        },
      ],
    }).compile();

    service = module.get<PlatformSupportAccessService>(
      PlatformSupportAccessService,
    );
  });

  describe('requestAccess', () => {
    const tenantId = '22222222-2222-2222-2222-222222222222';

    it('rejects duration greater than 240 minutes (max 4 hours)', async () => {
      await expect(
        service.requestAccess(
          tenantId,
          {
            reason: 'Detailed justification for troubleshooting',
            durationMinutes: 300,
            accessMode: 'read_only',
          },
          mockStaff,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects duration less than 15 minutes', async () => {
      await expect(
        service.requestAccess(
          tenantId,
          {
            reason: 'Detailed justification for troubleshooting',
            durationMinutes: 10,
            accessMode: 'read_only',
          },
          mockStaff,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects short or empty reasons (minimum 10 chars)', async () => {
      await expect(
        service.requestAccess(
          tenantId,
          {
            reason: 'Fix bug',
            durationMinutes: 60,
            accessMode: 'read_only',
          },
          mockStaff,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('auto-approves immediately if tenant has pre-authorised support access in settings', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        name: 'Acme Global',
        subdomain: 'acme',
        deletedAt: null,
        companies: [{ id: 'company-uuid-1', name: 'Acme Corp' }],
      });

      mockPrisma.unscoped.tenantSetting.findUnique.mockResolvedValue({
        value: { preauthorized: true },
      });

      mockPrisma.unscoped.user.findMany.mockResolvedValue([
        { id: 'owner-uuid-1', email: 'owner@acme.com' },
      ]);

      const now = new Date();
      mockPrisma.unscoped.supportAccessRequest.create.mockImplementation(
        ({ data }) =>
          Promise.resolve({
            id: 'request-uuid-1',
            ...data,
            createdAt: now,
            updatedAt: now,
          }),
      );

      const result = await service.requestAccess(
        tenantId,
        {
          reason: 'Investigating payroll calculation discrepancy reported by client',
          durationMinutes: 120,
          accessMode: 'read_only',
        },
        mockStaff,
      );

      expect(result.status).toBe('approved');
      expect(result.autoApproved).toBe(true);
      expect(result.expiresAt).not.toBeNull();
      expect(mockPlatformAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'support_access.auto_approved',
        }),
      );
      expect(mockPrisma.unscoped.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            device: expect.stringContaining('Sarah Connor'),
          }),
        }),
      );
      expect(mockNotificationDelivery.deliverInApp).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'support.access_granted',
        }),
      );
    });

    it('creates pending request and notifies Company Owner when tenant has NOT pre-authorised access', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        name: 'Beta Logistics',
        subdomain: 'beta',
        deletedAt: null,
        companies: [{ id: 'company-uuid-2', name: 'Beta Logistics' }],
      });

      mockPrisma.unscoped.tenantSetting.findUnique.mockResolvedValue(null);

      mockPrisma.unscoped.user.findMany.mockResolvedValue([
        { id: 'owner-uuid-2', email: 'owner@beta.com' },
      ]);

      const now = new Date();
      mockPrisma.unscoped.supportAccessRequest.create.mockImplementation(
        ({ data }) =>
          Promise.resolve({
            id: 'request-uuid-2',
            ...data,
            createdAt: now,
            updatedAt: now,
          }),
      );

      const result = await service.requestAccess(
        tenantId,
        {
          reason: 'Reviewing employee roster synchronization errors',
          durationMinutes: 60,
          accessMode: 'read_write',
        },
        mockStaff,
      );

      expect(result.status).toBe('pending');
      expect(result.autoApproved).toBe(false);
      expect(mockPlatformAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'support_access.requested',
        }),
      );
      expect(mockNotificationDelivery.deliverInApp).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'support.access_requested',
        }),
      );
      expect(mockNotificationDelivery.deliverEmailWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'support.access_requested',
          toEmail: 'owner@beta.com',
        }),
      );
    });
  });

  describe('issueImpersonationToken', () => {
    it('issues signed JWT scoped to tenant with support claims and custom JTI', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

      mockPrisma.unscoped.supportAccessRequest.findUnique.mockResolvedValue({
        id: 'request-uuid-3',
        tenantId: 'tenant-uuid-3',
        platformUserId: mockStaff.id,
        staffName: 'Sarah Connor',
        staffEmail: mockStaff.email,
        accessMode: 'read_only',
        status: 'approved',
        revokedAt: null,
        expiresAt,
        tenant: {
          id: 'tenant-uuid-3',
          name: 'Cyberdyne Systems',
          subdomain: 'cyberdyne',
        },
      });

      mockPrisma.unscoped.user.findFirst.mockResolvedValue({
        id: 'target-user-uuid',
        roleId: 'role-uuid',
        role: {
          name: 'Company Owner',
          dataScope: 'all',
          permissions: [{ module: 'employee', action: 'view' }],
        },
        employeeId: 'emp-uuid',
      });

      mockJwtService.signAsync.mockResolvedValue('jwt.impersonation.token');
      mockPrisma.unscoped.supportAccessRequest.update.mockResolvedValue({});
      mockPrisma.unscoped.auditLog.create.mockResolvedValue({});

      const response = await service.issueImpersonationToken(
        'request-uuid-3',
        mockStaff,
      );

      expect(response.accessToken).toBe('jwt.impersonation.token');
      expect(response.accessMode).toBe('read_only');
      expect(response.tenantName).toBe('Cyberdyne Systems');
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          support_access: true,
          support_request_id: 'request-uuid-3',
          platform_user_id: mockStaff.id,
          access_mode: 'read_only',
          staff_name: 'Sarah Connor',
        }),
        expect.anything(),
      );
      expect(mockPrisma.unscoped.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            device: expect.stringContaining('Sarah Connor'),
          }),
        }),
      );
    });

    it('rejects token issuance if grant is expired or revoked', async () => {
      mockPrisma.unscoped.supportAccessRequest.findUnique.mockResolvedValue({
        id: 'request-uuid-4',
        tenantId: 'tenant-uuid-4',
        status: 'revoked',
        revokedAt: new Date(),
        expiresAt: new Date(),
        tenant: { id: 'tenant-uuid-4', name: 'Test', subdomain: 'test' },
      });

      await expect(
        service.issueImpersonationToken('request-uuid-4', mockStaff),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('revokeSession', () => {
    it('marks grant revoked and dual-logs to platform and tenant logs', async () => {
      mockPrisma.unscoped.supportAccessRequest.findUnique.mockResolvedValue({
        id: 'request-uuid-5',
        tenantId: 'tenant-uuid-5',
        staffName: 'Sarah Connor',
        staffEmail: mockStaff.email,
        tenant: { id: 'tenant-uuid-5', name: 'Test', subdomain: 'test' },
      });

      const now = new Date();
      mockPrisma.unscoped.supportAccessRequest.update.mockResolvedValue({
        id: 'request-uuid-5',
        tenantId: 'tenant-uuid-5',
        status: 'revoked',
        revokedAt: now,
        revokedReason: 'Resolved customer ticket',
        durationMinutes: 60,
        createdAt: now,
        updatedAt: now,
        tenant: { id: 'tenant-uuid-5', name: 'Test', subdomain: 'test' },
      });

      const res = await service.revokeSession(
        'request-uuid-5',
        { reason: 'Resolved customer ticket' },
        mockStaff,
      );

      expect(res.status).toBe('revoked');
      expect(mockPlatformAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'support_access.revoked',
        }),
      );
      expect(mockPrisma.unscoped.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            device: expect.stringContaining('Sarah Connor'),
          }),
        }),
      );
    });
  });
});
