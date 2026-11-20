import { Test, TestingModule } from '@nestjs/testing';
import { PlatformTenantsController } from './platform-tenants.controller';
import { PlatformTenantsService } from './platform-tenants.service';
import { PlatformTenantLifecycleService } from './platform-tenant-lifecycle.service';
import { TenantLifecycleQueueService } from './tenant-lifecycle-queue.service';
import { Reflector } from '@nestjs/core';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';

describe('PlatformTenantsController', () => {
  let controller: PlatformTenantsController;
  let mockTenantsService: any;
  let mockLifecycleService: any;
  let mockLifecycleQueue: any;

  beforeEach(async () => {
    mockTenantsService = {
      listTenantsPaged: jest.fn().mockResolvedValue({
        items: [
          { id: 't-1', name: 'Acme', subdomain: 'acme', plan: 'Enterprise', status: 'Active' },
        ],
        total: 1,
        page: 1,
        pageSize: 1,
        totalPages: 1,
      }),
      listTenants: jest.fn().mockResolvedValue([
        { id: 't-1', name: 'Acme', subdomain: 'acme', plan: 'Enterprise', status: 'Active' },
      ]),
      getTenant: jest.fn().mockResolvedValue({
        id: 't-1',
        name: 'Acme',
        subdomain: 'acme',
        plan: 'Enterprise',
        status: 'Active',
      }),
    };

    mockLifecycleService = {
      suspendTenant: jest.fn().mockResolvedValue({
        id: 't-1',
        status: 'Suspended',
        suspensionMode: 'read_only',
      }),
      restoreTenant: jest.fn().mockResolvedValue({
        id: 't-1',
        status: 'Active',
      }),
      cancelTenant: jest.fn().mockResolvedValue({
        id: 't-1',
        status: 'Cancelled',
      }),
      scheduleDeletion: jest.fn().mockResolvedValue({
        id: 't-1',
        status: 'Pending_deletion',
        scheduledDeletionAt: new Date().toISOString(),
      }),
    };

    mockLifecycleQueue = {
      enqueueProvisioning: jest.fn().mockResolvedValue({
        tenantId: 't-new',
        name: 'New Tenant',
        subdomain: 'newtenant',
        status: 'Active',
        companyId: 'comp-new',
        ownerUserId: 'user-new',
        ownerEmail: 'owner@new.com',
        invitationSent: true,
      }),
      enqueueHardDelete: jest.fn().mockResolvedValue({
        success: true,
        tenantId: 't-1',
        message: 'Deleted successfully',
      }),
      enqueueProcessScheduledDeletions: jest.fn().mockResolvedValue({
        processedCount: 3,
        deletedTenantIds: ['t-1', 't-2', 't-3'],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformTenantsController],
      providers: [
        { provide: PlatformTenantsService, useValue: mockTenantsService },
        { provide: PlatformTenantLifecycleService, useValue: mockLifecycleService },
        { provide: TenantLifecycleQueueService, useValue: mockLifecycleQueue },
        Reflector,
      ],
    })
      .overrideGuard(PlatformAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PlatformPermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PlatformTenantsController>(PlatformTenantsController);
  });

  it('should list tenants', async () => {
    const res = await controller.listTenants('acme', 'enterprise', 'active');
    expect(res.data).toHaveLength(1);
    expect(res.meta?.total).toBe(1);
    expect(mockTenantsService.listTenantsPaged).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'acme',
        plan: 'enterprise',
        status: 'active',
      }),
    );
  });

  it('should get a tenant by id', async () => {
    const res = await controller.getTenant('t-1');
    expect(res.data.id).toBe('t-1');
    expect(mockTenantsService.getTenant).toHaveBeenCalledWith('t-1');
  });

  it('should provision tenant via queue', async () => {
    const dto = {
      name: 'New Tenant',
      subdomain: 'newtenant',
      ownerFirstName: 'Alice',
      ownerLastName: 'Smith',
      ownerEmail: 'owner@new.com',
      reason: 'Sales team signed contract',
    };
    const req = { user: { id: 'staff-123' } };

    const res = await controller.provisionTenant(dto, req);
    expect(res.data.tenantId).toBe('t-new');
    expect(mockLifecycleQueue.enqueueProvisioning).toHaveBeenCalledWith(
      dto,
      'staff-123',
    );
  });

  it('should suspend tenant via service', async () => {
    const dto = { mode: 'read_only' as const, reason: 'Payment overdue' };
    const req = { user: { id: 'staff-123' } };

    const res = await controller.suspendTenant('t-1', dto, req);
    expect(res.data.status).toBe('Suspended');
    expect(mockLifecycleService.suspendTenant).toHaveBeenCalledWith(
      't-1',
      dto,
      'staff-123',
    );
  });

  it('should restore tenant via service', async () => {
    const dto = { reason: 'Payment cleared' };
    const req = { user: { id: 'staff-123' } };

    const res = await controller.restoreTenant('t-1', dto, req);
    expect(res.data.status).toBe('Active');
    expect(mockLifecycleService.restoreTenant).toHaveBeenCalledWith(
      't-1',
      dto,
      'staff-123',
    );
  });

  it('should cancel tenant via service', async () => {
    const dto = { reason: 'Customer requested cancellation' };
    const req = { user: { id: 'staff-123' } };

    const res = await controller.cancelTenant('t-1', dto, req);
    expect(res.data.status).toBe('Cancelled');
    expect(mockLifecycleService.cancelTenant).toHaveBeenCalledWith(
      't-1',
      dto,
      'staff-123',
    );
  });

  it('should schedule deletion via service', async () => {
    const dto = { reason: 'GDPR right to be forgotten', gracePeriodDays: 30 };
    const req = { user: { id: 'staff-123' } };

    const res = await controller.scheduleDeletion('t-1', dto, req);
    expect(res.data.status).toBe('Pending_deletion');
    expect(mockLifecycleService.scheduleDeletion).toHaveBeenCalledWith(
      't-1',
      dto,
      'staff-123',
    );
  });

  it('should hard delete tenant via queue', async () => {
    const dto = { reason: '30-day grace period elapsed, purge tenant' };
    const req = { user: { id: 'staff-123' } };

    const res = await controller.hardDeleteTenant('t-1', dto, req);
    expect(res.data.success).toBe(true);
    expect(mockLifecycleQueue.enqueueHardDelete).toHaveBeenCalledWith(
      't-1',
      dto,
      'staff-123',
    );
  });

  it('should process scheduled deletions via queue', async () => {
    const req = { user: { id: 'staff-123' } };

    const res = await controller.processScheduledDeletions(req);
    expect(res.data.processedCount).toBe(3);
    expect(mockLifecycleQueue.enqueueProcessScheduledDeletions).toHaveBeenCalledWith(
      'staff-123',
    );
  });
});
