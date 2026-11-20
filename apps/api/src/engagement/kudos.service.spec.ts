import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { KudosService } from './kudos.service';

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const COMPANY_ID = '10000000-0000-4000-8000-000000000010';
const KUDOS_ID = '10000000-0000-4000-8000-000000000285';
const FROM_EMP_ID = '10000000-0000-4000-8000-000000000041';
const TO_EMP_ID = '10000000-0000-4000-8000-000000000042';
const ADMIN_USER_ID = '10000000-0000-4000-8000-000000000060';

const adminActor: AuthenticatedUser = {
  id: ADMIN_USER_ID,
  tenantId: TENANT_ID,
  roleId: '10000000-0000-4000-8000-000000000031',
  roleName: 'HR Admin',
  employeeId: '10000000-0000-4000-8000-000000000040',
  email: 'hr@cmsnbd.com',
  permissions: [],
  authMethod: 'jwt',
};

function makeKudosRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: KUDOS_ID,
    tenantId: TENANT_ID,
    companyId: COMPANY_ID,
    fromEmployeeId: FROM_EMP_ID,
    toEmployeeId: TO_EMP_ID,
    kudosType: 'peer',
    message: 'Great teamwork shipping the quarterly release!',
    moderationStatus: 'active',
    removedAt: null,
    removedByUserId: null,
    removalReason: null,
    createdByUserId: ADMIN_USER_ID,
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    updatedAt: new Date('2026-11-01T10:00:00.000Z'),
    fromEmployee: { firstName: 'Tariq', lastName: 'Hasan' },
    toEmployee: { firstName: 'Nadia', lastName: 'Karim', managerId: null },
    removedByUser: null,
    ...overrides,
  };
}

function setup() {
  const prisma = {
    unscoped: {
      employeeKudos: {
        findMany: jest.fn().mockResolvedValue([makeKudosRow()]),
        findFirst: jest.fn().mockResolvedValue(makeKudosRow()),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue(makeKudosRow()),
        update: jest.fn().mockResolvedValue(
          makeKudosRow({
            moderationStatus: 'removed',
            removedAt: new Date('2026-11-10T08:00:00.000Z'),
            removedByUserId: ADMIN_USER_ID,
            removalReason: 'Inappropriate language',
            removedByUser: {
              id: ADMIN_USER_ID,
              email: 'hr@cmsnbd.com',
              employee: { firstName: 'HR', lastName: 'Admin' },
            },
          }),
        ),
      },
      employee: {
        findFirst: jest.fn().mockResolvedValue({ id: FROM_EMP_ID, managerId: null, companyId: COMPANY_ID }),
      },
    },
  };

  const companyScope = {
    requireTenantId: jest.fn().mockReturnValue(TENANT_ID),
    assertCompanyInTenant: jest.fn().mockResolvedValue({
      id: COMPANY_ID,
      tenantId: TENANT_ID,
      name: 'Demo Corp',
    }),
  };

  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const notificationEngine = {
    emit: jest.fn().mockResolvedValue(undefined),
  };

  const service = new KudosService(
    prisma as never,
    companyScope as never,
    auditService as never,
    notificationEngine as never,
  );

  return { service, prisma, companyScope, auditService };
}

describe('KudosService', () => {
  it('filters public listFeed strictly to active and tenant-scoped records', async () => {
    const { service, prisma } = setup();
    const feed = await service.listFeed(COMPANY_ID, { limit: 15 });

    expect(feed).toHaveLength(1);
    expect(feed[0]).not.toHaveProperty('removalReason');
    expect(prisma.unscoped.employeeKudos.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_ID,
          companyId: COMPANY_ID,
          moderationStatus: 'active',
        }),
        take: 15,
      }),
    );
  });

  it('lists moderation feed with summary counts and keyword search', async () => {
    const { service, prisma } = setup();
    prisma.unscoped.employeeKudos.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(4);

    const res = await service.listForModeration(COMPANY_ID, {
      status: 'removed',
      q: 'release',
    });

    expect(res.summary).toEqual({
      activeCount: 5,
      removedCount: 2,
      peerCount: 3,
      managerCount: 2,
      thisMonthCount: 4,
    });
    expect(prisma.unscoped.employeeKudos.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_ID,
          companyId: COMPANY_ID,
          moderationStatus: 'removed',
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it('allows delegated kudos creation when allowDelegate is true', async () => {
    const { service, prisma } = setup();
    await service.create(
      COMPANY_ID,
      {
        fromEmployeeId: FROM_EMP_ID,
        toEmployeeId: TO_EMP_ID,
        message: 'Fantastic mentoring this sprint!',
      },
      adminActor,
      { allowDelegate: true },
    );

    expect(prisma.unscoped.employeeKudos.create).toHaveBeenCalled();
  });

  it('forbids delegated kudos creation when allowDelegate is false', async () => {
    const { service, prisma } = setup();
    await expect(
      service.create(
        COMPANY_ID,
        {
          fromEmployeeId: FROM_EMP_ID,
          toEmployeeId: TO_EMP_ID,
          message: 'Trying to spoof sender',
        },
        adminActor,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.unscoped.employeeKudos.create).not.toHaveBeenCalled();
  });

  it('removes an inappropriate kudos post with reason and writes audit log', async () => {
    const { service, prisma, auditService } = setup();

    const result = await service.removeKudos(
      KUDOS_ID,
      { reason: '  Inappropriate language  ' },
      adminActor,
    );

    expect(result.moderationStatus).toBe('removed');
    expect(result.removedByName).toBe('HR Admin');
    expect(result.removalReason).toBe('Inappropriate language');

    expect(prisma.unscoped.employeeKudos.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: KUDOS_ID, tenantId: TENANT_ID },
      }),
    );

    expect(prisma.unscoped.employeeKudos.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          moderationStatus: 'removed',
          removedByUserId: ADMIN_USER_ID,
          removalReason: 'Inappropriate language',
        }),
      }),
    );

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        userId: ADMIN_USER_ID,
        action: 'delete',
        module: 'engagement',
        recordId: KUDOS_ID,
        oldValue: expect.objectContaining({
          moderationStatus: 'active',
        }),
        newValue: expect.objectContaining({
          moderationStatus: 'removed',
          removalReason: 'Inappropriate language',
        }),
      }),
    );
  });

  it('throws NotFoundException when trying to remove a cross-tenant or missing kudos', async () => {
    const { service, prisma } = setup();
    prisma.unscoped.employeeKudos.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.removeKudos(KUDOS_ID, { reason: 'Spam' }, adminActor),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when removing an already removed kudos', async () => {
    const { service, prisma } = setup();
    prisma.unscoped.employeeKudos.findFirst.mockResolvedValueOnce(
      makeKudosRow({ moderationStatus: 'removed' }),
    );

    await expect(
      service.removeKudos(KUDOS_ID, { reason: 'Spam' }, adminActor),
    ).rejects.toThrow(ConflictException);
  });

  it('restores a removed kudos post and logs restore audit event', async () => {
    const { service, prisma, auditService } = setup();
    prisma.unscoped.employeeKudos.findFirst.mockResolvedValueOnce(
      makeKudosRow({
        moderationStatus: 'removed',
        removedAt: new Date('2026-11-10T08:00:00.000Z'),
        removedByUserId: ADMIN_USER_ID,
        removalReason: 'Mistake',
      }),
    );
    prisma.unscoped.employeeKudos.update.mockResolvedValueOnce(makeKudosRow());

    const result = await service.restoreKudos(KUDOS_ID, adminActor);

    expect(result.moderationStatus).toBe('active');
    expect(result.removalReason).toBeNull();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        userId: ADMIN_USER_ID,
        action: 'restore',
        module: 'engagement',
        recordId: KUDOS_ID,
      }),
    );
  });

  it('throws ConflictException when restoring an already active kudos', async () => {
    const { service } = setup();
    await expect(service.restoreKudos(KUDOS_ID, adminActor)).rejects.toThrow(ConflictException);
  });
});

