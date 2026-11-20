import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  LeaveAccrualType,
  PermissionAction,
  RoleDataScope,
  TenantStatus,
  TenantSuspensionMode,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { PlatformTenantLifecycleService } from './platform-tenant-lifecycle.service';

describe('PlatformTenantLifecycleService', () => {
  let service: PlatformTenantLifecycleService;
  let mockPrisma: any;
  let mockAuditService: any;

  beforeEach(async () => {
    mockAuditService = {
      log: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
    };

    mockPrisma = {
      unscoped: {
        tenant: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        country: {
          findFirst: jest.fn(),
          create: jest.fn(),
        },
        company: {
          create: jest.fn(),
        },
        role: {
          create: jest.fn(),
        },
        permission: {
          create: jest.fn(),
        },
        documentType: {
          create: jest.fn(),
        },
        leaveType: {
          create: jest.fn(),
        },
        leavePolicy: {
          create: jest.fn(),
        },
        tenantSetting: {
          create: jest.fn(),
        },
        employee: {
          create: jest.fn(),
        },
        user: {
          create: jest.fn(),
        },
        $transaction: jest.fn().mockImplementation(async (callback) => {
          return callback(mockPrisma.unscoped);
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformTenantLifecycleService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: PlatformAuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<PlatformTenantLifecycleService>(
      PlatformTenantLifecycleService,
    );
  });

  describe('provisionTenant', () => {
    const validDto = {
      name: 'Acme International',
      subdomain: 'acme-corp',
      ownerFirstName: 'John',
      ownerLastName: 'Doe',
      ownerEmail: 'john.doe@acme.com',
      planId: 'business',
      countryCode: 'USA',
      storageDriver: 'local' as const,
      reason: 'New enterprise customer onboarding',
    };

    it('should throw BadRequestException if reason is missing or whitespace', async () => {
      await expect(
        service.provisionTenant({ ...validDto, reason: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if subdomain is already registered', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 'existing-tenant',
        subdomain: 'acme-corp',
      });

      await expect(service.provisionTenant(validDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should successfully provision a tenant, company, roles, doc types, leave policies, and owner user', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.unscoped.country.findFirst.mockResolvedValue({
        id: 'country-usa',
        isoCode: 'USA',
        currency: 'USD',
        timezone: 'America/New_York',
        dateFormat: 'YYYY-MM-DD',
      });

      const fakeTenant = {
        id: 'new-tenant-123',
        name: validDto.name,
        subdomain: validDto.subdomain,
        planId: 'business',
        status: TenantStatus.active,
        createdAt: new Date(),
      };
      mockPrisma.unscoped.tenant.create.mockResolvedValue(fakeTenant);

      const fakeCompany = {
        id: 'company-123',
        tenantId: fakeTenant.id,
        name: 'Acme International HQ',
      };
      mockPrisma.unscoped.company.create.mockResolvedValue(fakeCompany);

      mockPrisma.unscoped.role.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: `role-${data.name.replace(/\s+/g, '-')}`, ...data }),
      );
      mockPrisma.unscoped.permission.create.mockResolvedValue({ id: 'perm-1' });
      mockPrisma.unscoped.documentType.create.mockResolvedValue({ id: 'doc-1' });
      mockPrisma.unscoped.leaveType.create.mockResolvedValue({ id: 'lt-1' });
      mockPrisma.unscoped.leavePolicy.create.mockResolvedValue({ id: 'lp-1' });
      mockPrisma.unscoped.tenantSetting.create.mockResolvedValue({ id: 'ts-1' });
      mockPrisma.unscoped.employee.create.mockResolvedValue({
        id: 'emp-1',
        employeeNumber: 'EMP-001',
      });
      mockPrisma.unscoped.user.create.mockResolvedValue({
        id: 'user-owner-1',
        email: validDto.ownerEmail,
      });

      const result = await service.provisionTenant(validDto, 'platform-admin-1');

      expect(result).toEqual({
        tenantId: fakeTenant.id,
        name: fakeTenant.name,
        subdomain: fakeTenant.subdomain,
        status: 'Active',
        companyId: fakeCompany.id,
        ownerUserId: 'user-owner-1',
        ownerEmail: 'john.doe@acme.com',
        invitationSent: true,
        message: expect.stringContaining('Acme International'),
      });

      // Verify audit log with mandatory reason
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'platform-admin-1',
          action: 'tenant.provisioned',
          module: 'tenant',
          recordId: fakeTenant.id,
          reason: validDto.reason,
        }),
      );
    });

    it('should create default country if none exists in database', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.unscoped.country.findFirst.mockResolvedValue(null);
      mockPrisma.unscoped.country.create.mockResolvedValue({
        id: 'country-glb',
        isoCode: 'GLB',
        currency: 'USD',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
      });

      mockPrisma.unscoped.tenant.create.mockResolvedValue({
        id: 'tenant-trial',
        name: 'Trial Co',
        subdomain: 'trialco',
        planId: 'trial',
        status: TenantStatus.trial,
        createdAt: new Date(),
      });
      mockPrisma.unscoped.company.create.mockResolvedValue({ id: 'comp-1' });
      mockPrisma.unscoped.role.create.mockResolvedValue({ id: 'role-1' });
      mockPrisma.unscoped.permission.create.mockResolvedValue({ id: 'perm-1' });
      mockPrisma.unscoped.documentType.create.mockResolvedValue({ id: 'doc-1' });
      mockPrisma.unscoped.leaveType.create.mockResolvedValue({ id: 'lt-1' });
      mockPrisma.unscoped.leavePolicy.create.mockResolvedValue({ id: 'lp-1' });
      mockPrisma.unscoped.tenantSetting.create.mockResolvedValue({ id: 'ts-1' });
      mockPrisma.unscoped.employee.create.mockResolvedValue({ id: 'emp-1' });
      mockPrisma.unscoped.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'trial@example.com',
      });

      await service.provisionTenant({
        ...validDto,
        planId: 'trial',
        countryCode: undefined,
        ownerEmail: 'trial@example.com',
      });

      expect(mockPrisma.unscoped.country.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isoCode: 'GLB' }),
      });
    });
  });

  describe('suspendTenant', () => {
    const existingTenant = {
      id: 'tenant-10',
      name: 'Suspended Org',
      subdomain: 'suspended',
      planId: 'starter',
      status: TenantStatus.active,
      suspensionMode: null,
      createdAt: new Date(),
    };

    it('should require a non-empty reason', async () => {
      await expect(
        service.suspendTenant('tenant-10', {
          mode: 'read_only',
          reason: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid suspension mode', async () => {
      await expect(
        service.suspendTenant('tenant-10', {
          mode: 'invalid_mode' as any,
          reason: 'Non-payment',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if tenant does not exist', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.suspendTenant('unknown-id', {
          mode: 'read_only',
          reason: 'Non-payment',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if tenant is already deleted or pending deletion', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        ...existingTenant,
        status: TenantStatus.deleted,
      });

      await expect(
        service.suspendTenant('tenant-10', {
          mode: 'read_only',
          reason: 'Already deleted',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should suspend tenant with read_only mode and log to audit log', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue(existingTenant);
      mockPrisma.unscoped.tenant.update.mockResolvedValue({
        ...existingTenant,
        status: TenantStatus.suspended,
        suspensionMode: TenantSuspensionMode.read_only,
        suspensionReason: 'Overdue invoices',
        suspendedAt: new Date(),
      });

      const result = await service.suspendTenant(
        'tenant-10',
        { mode: 'read_only', reason: 'Overdue invoices' },
        'admin-user',
      );

      expect(result.status).toBe('Suspended');
      expect(result.suspensionMode).toBe('read_only');
      expect(result.suspensionReason).toBe('Overdue invoices');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-user',
          action: 'tenant.suspended',
          module: 'tenant',
          recordId: 'tenant-10',
          reason: 'Overdue invoices',
        }),
      );
    });

    it('should suspend tenant with fully_blocked mode', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue(existingTenant);
      mockPrisma.unscoped.tenant.update.mockResolvedValue({
        ...existingTenant,
        status: TenantStatus.suspended,
        suspensionMode: TenantSuspensionMode.fully_blocked,
        suspensionReason: 'Terms violation',
        suspendedAt: new Date(),
      });

      const result = await service.suspendTenant(
        'tenant-10',
        { mode: 'fully_blocked', reason: 'Terms violation' },
        'admin-user',
      );

      expect(result.status).toBe('Suspended');
      expect(result.suspensionMode).toBe('fully_blocked');
    });
  });

  describe('restoreTenant', () => {
    it('should require a non-empty reason', async () => {
      await expect(
        service.restoreTenant('tenant-10', { reason: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if tenant not found', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue(null);
      await expect(
        service.restoreTenant('unknown', { reason: 'Resolved' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject restoring already active tenant', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 't-1',
        status: TenantStatus.active,
      });

      await expect(
        service.restoreTenant('t-1', { reason: 'Already fine' }),
      ).rejects.toThrow('Tenant is already active');
    });

    it('should reject restoring permanently deleted tenant', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 't-1',
        status: TenantStatus.deleted,
      });

      await expect(
        service.restoreTenant('t-1', { reason: 'Cannot recover' }),
      ).rejects.toThrow('Cannot restore a permanently deleted tenant');
    });

    it('should restore suspended tenant to active when trial is expired or absent', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 't-1',
        name: 'Restored Co',
        subdomain: 'restored',
        status: TenantStatus.suspended,
        suspensionMode: TenantSuspensionMode.read_only,
        trialEndsAt: null,
        createdAt: new Date(),
      });

      mockPrisma.unscoped.tenant.update.mockResolvedValue({
        id: 't-1',
        name: 'Restored Co',
        subdomain: 'restored',
        status: TenantStatus.active,
        suspensionMode: null,
        suspensionReason: null,
        suspendedAt: null,
        scheduledDeletionAt: null,
        cancelledAt: null,
        cancelReason: null,
        createdAt: new Date(),
      });

      const result = await service.restoreTenant(
        't-1',
        { reason: 'Invoice payment confirmed' },
        'admin-user',
      );

      expect(result.status).toBe('Active');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-user',
          action: 'tenant.restored',
          reason: 'Invoice payment confirmed',
        }),
      );
    });

    it('should restore to trial status if trial window is still active', async () => {
      const futureTrialEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 't-2',
        name: 'Trial Co',
        subdomain: 'trialco',
        status: TenantStatus.suspended,
        trialEndsAt: futureTrialEnd,
        createdAt: new Date(),
      });

      mockPrisma.unscoped.tenant.update.mockResolvedValue({
        id: 't-2',
        name: 'Trial Co',
        subdomain: 'trialco',
        status: TenantStatus.trial,
        trialEndsAt: futureTrialEnd,
        createdAt: new Date(),
      });

      const result = await service.restoreTenant('t-2', {
        reason: 'False alarm resolved',
      });
      expect(result.status).toBe('Trial');
    });
  });

  describe('cancelTenant', () => {
    it('should require a non-empty reason', async () => {
      await expect(
        service.cancelTenant('tenant-10', { reason: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if tenant not found', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue(null);
      await expect(
        service.cancelTenant('t-none', { reason: 'Customer requested' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should cancel tenant and record in audit log', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 't-10',
        name: 'Cancelling Co',
        subdomain: 'cancelling',
        status: TenantStatus.active,
        createdAt: new Date(),
      });

      mockPrisma.unscoped.tenant.update.mockResolvedValue({
        id: 't-10',
        name: 'Cancelling Co',
        subdomain: 'cancelling',
        status: TenantStatus.cancelled,
        cancelledAt: new Date(),
        cancelReason: 'Customer requested termination',
        createdAt: new Date(),
      });

      const result = await service.cancelTenant(
        't-10',
        { reason: 'Customer requested termination' },
        'admin-user',
      );

      expect(result.status).toBe('Cancelled');
      expect(result.cancelReason).toBe('Customer requested termination');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-user',
          action: 'tenant.cancelled',
          reason: 'Customer requested termination',
        }),
      );
    });
  });

  describe('scheduleDeletion', () => {
    it('should require a non-empty reason', async () => {
      await expect(
        service.scheduleDeletion('t-1', { reason: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set status to pending_deletion with default 30-day grace period', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 't-1',
        name: 'Expiring Co',
        subdomain: 'expiring',
        status: TenantStatus.cancelled,
        createdAt: new Date(),
      });

      mockPrisma.unscoped.tenant.update.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 't-1',
          name: 'Expiring Co',
          subdomain: 'expiring',
          status: data.status,
          scheduledDeletionAt: data.scheduledDeletionAt,
          createdAt: new Date(),
        }),
      );

      const result = await service.scheduleDeletion(
        't-1',
        { reason: 'Account termination request' },
        'admin-user',
      );

      expect(result.status).toBe('Pending_deletion');
      expect(result.scheduledDeletionAt).toBeDefined();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant.deletion_scheduled',
          reason: 'Account termination request',
          newValue: expect.objectContaining({
            gracePeriodDays: 30,
          }),
        }),
      );
    });
  });

  describe('hardDeleteTenant', () => {
    it('should require a non-empty reason', async () => {
      await expect(
        service.hardDeleteTenant('t-1', { reason: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if tenant not found', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue(null);
      await expect(
        service.hardDeleteTenant('unknown', { reason: 'Purge' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject hard delete if tenant is not in pending_deletion status', async () => {
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 't-1',
        status: TenantStatus.active,
      });

      await expect(
        service.hardDeleteTenant('t-1', { reason: 'Purge' }),
      ).rejects.toThrow('tenant must first be scheduled for deletion');
    });

    it('should reject hard delete if 30-day grace period has not elapsed', async () => {
      const futureDeletionDate = new Date(
        Date.now() + 15 * 24 * 60 * 60 * 1000,
      ); // 15 days remaining
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 't-1',
        status: TenantStatus.pending_deletion,
        scheduledDeletionAt: futureDeletionDate,
      });

      await expect(
        service.hardDeleteTenant('t-1', { reason: 'Premature purge' }),
      ).rejects.toThrow(
        'Cannot hard delete tenant before 30-day grace period has elapsed',
      );
    });

    it('should execute hard delete when 30-day grace period has elapsed', async () => {
      const pastDeletionDate = new Date(Date.now() - 1000); // Expired
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 't-1',
        name: 'Dead Co',
        subdomain: 'deadco',
        status: TenantStatus.pending_deletion,
        scheduledDeletionAt: pastDeletionDate,
      });

      mockPrisma.unscoped.tenant.update.mockResolvedValue({
        id: 't-1',
        status: TenantStatus.deleted,
        deletedAt: new Date(),
      });

      const result = await service.hardDeleteTenant(
        't-1',
        { reason: 'Grace period expired, executing permanent purge' },
        'cron-worker',
      );

      expect(result.success).toBe(true);
      expect(result.tenantId).toBe('t-1');

      // Verify audit log written before hard delete
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'cron-worker',
          action: 'tenant.hard_deleted',
          module: 'tenant',
          recordId: 't-1',
          reason: 'Grace period expired, executing permanent purge',
        }),
      );

      // Verify tenant marked as deleted
      expect(mockPrisma.unscoped.tenant.update).toHaveBeenCalledWith({
        where: { id: 't-1' },
        data: {
          status: TenantStatus.deleted,
          deletedAt: expect.any(Date),
        },
      });
    });
  });

  describe('processScheduledDeletions', () => {
    it('should find expired pending_deletion tenants and hard delete them', async () => {
      const pastDate = new Date(Date.now() - 10000);
      mockPrisma.unscoped.tenant.findMany.mockResolvedValue([
        {
          id: 't-exp-1',
          name: 'Expired Co 1',
          subdomain: 'exp1',
          status: TenantStatus.pending_deletion,
          scheduledDeletionAt: pastDate,
        },
        {
          id: 't-exp-2',
          name: 'Expired Co 2',
          subdomain: 'exp2',
          status: TenantStatus.pending_deletion,
          scheduledDeletionAt: pastDate,
        },
      ]);

      mockPrisma.unscoped.tenant.findUnique
        .mockResolvedValueOnce({
          id: 't-exp-1',
          name: 'Expired Co 1',
          subdomain: 'exp1',
          status: TenantStatus.pending_deletion,
          scheduledDeletionAt: pastDate,
        })
        .mockResolvedValueOnce({
          id: 't-exp-2',
          name: 'Expired Co 2',
          subdomain: 'exp2',
          status: TenantStatus.pending_deletion,
          scheduledDeletionAt: pastDate,
        });

      mockPrisma.unscoped.tenant.update.mockResolvedValue({
        status: TenantStatus.deleted,
      });

      const res = await service.processScheduledDeletions('system-cron');

      expect(res.processedCount).toBe(2);
      expect(res.deletedTenantIds).toEqual(['t-exp-1', 't-exp-2']);
      expect(mockAuditService.log).toHaveBeenCalledTimes(2);
    });
  });
});
