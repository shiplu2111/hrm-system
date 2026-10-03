import { ForbiddenException } from '@nestjs/common';
import { RoleDataScope } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DataScopeService } from './data-scope.service';

const SELF = '00000000-0000-4000-8000-000000000001';
const REPORT = '00000000-0000-4000-8000-000000000002';
const INDIRECT = '00000000-0000-4000-8000-000000000003';
const OUTSIDER = '00000000-0000-4000-8000-000000000004';

function user(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'u1',
    tenantId: 't1',
    roleId: 'r1',
    roleName: 'Manager',
    employeeId: SELF,
    permissions: [],
    ...overrides,
  } as AuthenticatedUser;
}

function setup(dataScope: RoleDataScope, reportIds: string[] = [REPORT, INDIRECT]) {
  const prisma = {
    unscoped: {
      role: { findUnique: jest.fn().mockResolvedValue({ dataScope }) },
      $queryRaw: jest.fn().mockResolvedValue(reportIds.map((id) => ({ id }))),
    },
  };
  return { prisma, service: new DataScopeService(prisma as never) };
}

describe('DataScopeService', () => {
  it('treats company-wide roles as unrestricted', async () => {
    const { prisma, service } = setup(RoleDataScope.all);
    const u = user();

    expect(await service.isOrgWide(u)).toBe(true);
    expect(await service.employeeIds(u)).toBeNull();
    expect(await service.employeeIdFilter(u)).toBeUndefined();
    expect(await service.canAccessEmployee(u, OUTSIDER)).toBe(true);
    expect(prisma.unscoped.$queryRaw).not.toHaveBeenCalled();
  });

  it('limits team-scoped roles to self plus the reporting tree', async () => {
    const { service } = setup(RoleDataScope.team);
    const u = user();

    expect(await service.isOrgWide(u)).toBe(false);
    expect(await service.employeeIds(u)).toEqual([SELF, REPORT, INDIRECT]);
    expect(await service.employeeIdFilter(u, { includeSelf: false })).toEqual({ in: [REPORT, INDIRECT] });
    expect(await service.canAccessEmployee(u, INDIRECT)).toBe(true);
    expect(await service.canAccessEmployee(u, OUTSIDER)).toBe(false);
  });

  it('excludes the user themselves for approvals', async () => {
    const { service } = setup(RoleDataScope.team);
    const u = user();

    await expect(service.assertEmployeeInScope(u, SELF)).resolves.toBeUndefined();
    await expect(service.assertEmployeeInScope(u, SELF, { includeSelf: false })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects out-of-scope employees with OUT_OF_SCOPE', async () => {
    const { service } = setup(RoleDataScope.team);

    await expect(service.assertEmployeeInScope(user(), OUTSIDER)).rejects.toMatchObject({
      response: { code: 'OUT_OF_SCOPE' },
    });
    await expect(service.assertEmployeeInScope(user(), null)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('gives a team-scoped user without an employee record no reach', async () => {
    const { prisma, service } = setup(RoleDataScope.team);
    const u = user({ employeeId: null });

    expect(await service.employeeIds(u)).toEqual([]);
    expect(prisma.unscoped.$queryRaw).not.toHaveBeenCalled();
  });

  it('resolves the scope once per authenticated user object', async () => {
    const { prisma, service } = setup(RoleDataScope.team);
    const u = user();

    await service.employeeIds(u);
    await service.canAccessEmployee(u, REPORT);
    await service.isOrgWide(u);

    expect(prisma.unscoped.role.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.unscoped.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
