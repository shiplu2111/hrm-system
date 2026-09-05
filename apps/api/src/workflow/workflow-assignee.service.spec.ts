import { ForbiddenException } from '@nestjs/common';
import type { WorkflowInstanceStep } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
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
      employee: { findFirst: jest.Mock };
      role: { findUnique: jest.Mock };
    };
  };
  let service: WorkflowAssigneeService;

  beforeEach(() => {
    prisma = {
      unscoped: {
        employee: {
          findFirst: jest.fn().mockResolvedValue({ managerId: 'mgr-1' }),
        },
        role: {
          findUnique: jest.fn(),
        },
      },
    };
    service = new WorkflowAssigneeService(prisma as unknown as PrismaService);
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
});
