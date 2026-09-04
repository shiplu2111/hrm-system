import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { PermissionsService } from './permissions.service';

describe('PermissionsService (ROLES_PERMISSIONS.md)', () => {
  const baseUser: AuthenticatedUser = {
    id: 'user-1',
    tenantId: 'tenant-1',
    roleId: 'role-1',
    roleName: 'HR Admin',
    employeeId: 'emp-1',
    email: 'hr@example.com',
    permissions: [
      { module: 'leave', action: 'view' },
      { module: 'leave', action: 'approve' },
    ],
  };

  let prisma: { unscoped: { permission: { findMany: jest.Mock } } };
  let service: PermissionsService;

  beforeEach(() => {
    prisma = {
      unscoped: {
        permission: {
          findMany: jest.fn(),
        },
      },
    };
    service = new PermissionsService(prisma as unknown as PrismaService);
  });

  it('allows access when JWT permissions include the module:action', () => {
    expect(service.hasPermission(baseUser, 'leave', 'view')).toBe(true);
    expect(service.hasPermission(baseUser, 'leave', 'approve')).toBe(true);
  });

  it('denies access when JWT permissions omit the module:action', () => {
    expect(service.hasPermission(baseUser, 'payroll', 'finalize')).toBe(false);
    expect(service.hasPermission(baseUser, 'settings', 'delete')).toBe(false);
  });

  it('assertPermission passes for allowed non-sensitive actions from JWT', async () => {
    await expect(
      service.assertPermission(baseUser, 'leave', 'view'),
    ).resolves.toBeUndefined();
    expect(prisma.unscoped.permission.findMany).not.toHaveBeenCalled();
  });

  it('assertPermission throws ForbiddenException for denied non-sensitive actions', async () => {
    await expect(
      service.assertPermission(baseUser, 'settings', 'delete'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.unscoped.permission.findMany).not.toHaveBeenCalled();
  });

  it('assertPermission throws ForbiddenException for denied sensitive actions after DB reload', async () => {
    prisma.unscoped.permission.findMany.mockResolvedValue([
      { module: 'leave', action: 'view' },
    ]);

    await expect(
      service.assertPermission(baseUser, 'payroll', 'finalize'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reloads permissions from DB for sensitive approve/finalize actions', async () => {
    prisma.unscoped.permission.findMany.mockResolvedValue([
      { module: 'leave', action: 'view' },
    ]);

    await expect(
      service.assertPermission(baseUser, 'leave', 'approve'),
    ).rejects.toMatchObject({
      response: { code: 'FORBIDDEN' },
    });

    expect(prisma.unscoped.permission.findMany).toHaveBeenCalledWith({
      where: { roleId: 'role-1' },
      select: { module: true, action: true },
    });
  });

  it('allows sensitive action when DB permissions still grant it', async () => {
    prisma.unscoped.permission.findMany.mockResolvedValue([
      { module: 'payroll', action: 'finalize' },
    ]);

    const payrollUser: AuthenticatedUser = {
      ...baseUser,
      permissions: [{ module: 'payroll', action: 'view' }],
    };

    await expect(
      service.assertPermission(payrollUser, 'payroll', 'finalize'),
    ).resolves.toBeUndefined();
  });
});
