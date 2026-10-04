import { ForbiddenException } from '@nestjs/common';
import type { WorkflowInstanceStep } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { DataScopeService } from '../rbac/data-scope.service';
import { WorkflowAssigneeService } from './workflow-assignee.service';

describe('WorkflowAssigneeService (ROLES_PERMISSIONS.md §6)', () => {
  const directManagerStep: WorkflowInstanceStep = {
    order: 1,
    assigneeType: 'direct_manager',
    roleName: 'Manager',
    status: 'pending',
    actedByUserId: null,
    actedByEmployeeId: null,
    actedAt: null,
    comment: null,
  };

  const hrStep: WorkflowInstanceStep = {
    order: 2,
    assigneeType: 'role',
    roleName: 'HR Admin',
    status: 'pending',
    actedByUserId: null,
    actedByEmployeeId: null,
    actedAt: null,
    comment: null,
  };

  let prisma: {
    unscoped: {
      employee: { findFirst: jest.Mock; findMany: jest.Mock };
      role: { findUnique: jest.Mock };
    };
  };
  let service: WorkflowAssigneeService;
  let dataScope: { canAccessEmployee: jest.Mock };
  const managers: Record<string, string | null> = {
    'emp-1': 'mgr-1',
    'emp-2': 'mgr-2',
    'mgr-1': 'director-1',
  };

  beforeEach(() => {
    dataScope = { canAccessEmployee: jest.fn().mockResolvedValue(true) };
    prisma = {
      unscoped: {
        employee: {
          findFirst: jest.fn().mockResolvedValue({ id: 'emp-1' }),
          findMany: jest.fn().mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
            Promise.resolve(
              where.id.in
                .filter((id) => id in managers)
                .map((id) => ({ id, managerId: managers[id] })),
            ),
          ),
        },
        role: {
          findUnique: jest.fn(),
        },
      },
    };
    service = new WorkflowAssigneeService(
      prisma as unknown as PrismaService,
      dataScope as unknown as DataScopeService,
    );
  });

  it('allows the requester direct manager on direct_manager steps', async () => {
    const user: AuthenticatedUser = {
      id: 'u1',
      tenantId: 't1',
      roleId: 'r1',
      roleName: 'Manager',
      employeeId: 'mgr-1',
      email: 'mgr@test.com',
      permissions: [],
    };

    await expect(
      service.assertCanActOnStep({
        requesterEmployeeId: 'emp-1',
        step: directManagerStep,
        user,
      }),
    ).resolves.toBeUndefined();
  });

  it('allows HR Admin override on direct_manager steps', async () => {
    prisma.unscoped.role.findUnique.mockResolvedValue({ name: 'HR Admin' });
    const user: AuthenticatedUser = {
      id: 'u2',
      tenantId: 't1',
      roleId: 'r2',
      roleName: 'HR Admin',
      employeeId: 'other',
      email: 'hr@test.com',
      permissions: [],
    };

    await expect(
      service.assertCanActOnStep({
        requesterEmployeeId: 'emp-1',
        step: directManagerStep,
        user,
      }),
    ).resolves.toBeUndefined();
  });

  it('allows matching role on role steps', async () => {
    prisma.unscoped.role.findUnique.mockResolvedValue({ name: 'HR Admin' });
    const user: AuthenticatedUser = {
      id: 'u3',
      tenantId: 't1',
      roleId: 'r3',
      roleName: 'HR Admin',
      employeeId: 'hr-1',
      email: 'hr@test.com',
      permissions: [],
    };

    await expect(
      service.assertCanActOnStep({
        requesterEmployeeId: 'emp-1',
        step: hrStep,
        user,
      }),
    ).resolves.toBeUndefined();
  });

  it('denies a team-scoped role step holder for requesters outside their reporting line', async () => {
    prisma.unscoped.role.findUnique.mockResolvedValue({ name: 'Manager' });
    dataScope.canAccessEmployee.mockResolvedValue(false);
    const user: AuthenticatedUser = {
      id: 'u5',
      tenantId: 't1',
      roleId: 'r5',
      roleName: 'Manager',
      employeeId: 'mgr-2',
      email: 'mgr2@test.com',
      permissions: [],
    };

    await expect(
      service.assertCanActOnStep({
        requesterEmployeeId: 'emp-1',
        step: { ...hrStep, roleName: 'Manager' },
        user,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(dataScope.canAccessEmployee).toHaveBeenCalledWith(user, 'emp-1', {
      includeSelf: false,
    });
  });

  it('denies unrelated users', async () => {
    prisma.unscoped.role.findUnique.mockResolvedValue({ name: 'Employee' });
    const user: AuthenticatedUser = {
      id: 'u4',
      tenantId: 't1',
      roleId: 'r4',
      roleName: 'Employee',
      employeeId: 'emp-2',
      email: 'emp@test.com',
      permissions: [],
    };

    await expect(
      service.assertCanActOnStep({
        requesterEmployeeId: 'emp-1',
        step: hrStep,
        user,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('evaluates many steps in one pass for approval queues', async () => {
    prisma.unscoped.role.findUnique.mockResolvedValue({ name: 'Manager' });
    const user: AuthenticatedUser = {
      id: 'u6',
      tenantId: 't1',
      roleId: 'r6',
      roleName: 'Manager',
      employeeId: 'mgr-1',
      email: 'mgr@test.com',
      permissions: [],
    };

    await expect(
      service.canActOnSteps(user, [
        { requesterEmployeeId: 'emp-1', step: directManagerStep },
        { requesterEmployeeId: 'emp-2', step: directManagerStep },
        { requesterEmployeeId: 'emp-1', step: hrStep },
        { requesterEmployeeId: 'missing', step: directManagerStep },
      ]),
    ).resolves.toEqual([true, false, false, false]);
    expect(prisma.unscoped.employee.findMany).toHaveBeenCalledTimes(1);
  });

  it('matches skip-level managers through the reporting chain', async () => {
    prisma.unscoped.role.findUnique.mockResolvedValue({ name: 'Manager' });
    const user: AuthenticatedUser = {
      id: 'u7',
      tenantId: 't1',
      roleId: 'r7',
      roleName: 'Manager',
      employeeId: 'director-1',
      email: 'director@test.com',
      permissions: [],
    };

    await expect(
      service.canActOnSteps(user, [
        { requesterEmployeeId: 'emp-1', step: { ...directManagerStep, assigneeType: 'skip_level_manager' } },
        { requesterEmployeeId: 'emp-1', step: directManagerStep },
      ]),
    ).resolves.toEqual([true, false]);
  });
});
