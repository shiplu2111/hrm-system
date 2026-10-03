import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LeaveRequestStatus, RoleDataScope } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { PrismaService } from '../database/prisma.service';
import type { NotificationEngineService } from '../notifications/notification-engine.service';
import type { CompanyScopeService } from '../organization/company-scope.service';
import { DataScopeService } from '../rbac/data-scope.service';
import type { WorkflowInstancesService } from '../workflow/workflow-instances.service';
import type { LeaveAttendanceService } from './leave-attendance.service';
import type { LeaveBalancesService } from './leave-balances.service';
import { LeaveRequestsService } from './leave-requests.service';
import type { LeaveWorkflowService } from './leave-workflow.service';

describe('LeaveRequestsService data scope (ROLES_PERMISSIONS.md §5)', () => {
  const manager: AuthenticatedUser = {
    id: 'u-mgr',
    tenantId: 't1',
    roleId: 'role-mgr',
    roleName: 'Manager',
    employeeId: 'mgr-1',
    email: 'mgr@test.com',
    permissions: [],
  };

  const pendingRequest = (employeeId: string) => ({
    id: 'req-1',
    employeeId,
    leaveTypeId: 'lt-1',
    status: LeaveRequestStatus.pending,
    startDate: new Date('2026-10-05T00:00:00.000Z'),
    endDate: new Date('2026-10-06T00:00:00.000Z'),
    halfDay: false,
    totalDays: 2,
    approvalChain: [],
    employee: { id: employeeId, companyId: 'c1', tenantId: 't1' },
  });

  let prisma: {
    unscoped: {
      leaveRequest: { findFirst: jest.Mock };
      role: { findUnique: jest.Mock };
      $queryRaw: jest.Mock;
    };
    scoped: { employee: { findFirst: jest.Mock } };
  };
  let balancesService: { findEffectivePolicy: jest.Mock };
  let leaveWorkflow: { approve: jest.Mock; reject: jest.Mock };
  let service: LeaveRequestsService;

  beforeEach(() => {
    prisma = {
      unscoped: {
        leaveRequest: { findFirst: jest.fn() },
        role: { findUnique: jest.fn().mockResolvedValue({ dataScope: RoleDataScope.team }) },
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'emp-report' }]),
      },
      scoped: {
        employee: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'emp-report',
            tenantId: 't1',
            companyId: 'c1',
            firstName: 'Rita',
            lastName: 'Report',
            probationEndDate: null,
          }),
        },
      },
    };
    balancesService = { findEffectivePolicy: jest.fn().mockResolvedValue(null) };
    leaveWorkflow = { approve: jest.fn(), reject: jest.fn() };

    service = new LeaveRequestsService(
      prisma as unknown as PrismaService,
      { assertCompanyInTenant: jest.fn() } as unknown as CompanyScopeService,
      balancesService as unknown as LeaveBalancesService,
      {} as LeaveAttendanceService,
      {} as NotificationEngineService,
      leaveWorkflow as unknown as LeaveWorkflowService,
      {} as WorkflowInstancesService,
      new DataScopeService(prisma as unknown as PrismaService),
    );
  });

  it('rejects approval of a request outside the manager reporting tree', async () => {
    prisma.unscoped.leaveRequest.findFirst.mockResolvedValue(pendingRequest('emp-stranger'));

    const result = service.approve('req-1', manager, {});
    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    await expect(result).rejects.toMatchObject({ response: { code: 'OUT_OF_SCOPE' } });
    expect(leaveWorkflow.approve).not.toHaveBeenCalled();
  });

  it('rejects rejection of a request outside the manager reporting tree', async () => {
    prisma.unscoped.leaveRequest.findFirst.mockResolvedValue(pendingRequest('emp-stranger'));

    await expect(service.reject('req-1', manager, {})).rejects.toMatchObject({
      response: { code: 'OUT_OF_SCOPE' },
    });
    expect(leaveWorkflow.reject).not.toHaveBeenCalled();
  });

  it('lets a manager act on a request from their report', async () => {
    prisma.unscoped.leaveRequest.findFirst.mockResolvedValue(pendingRequest('emp-report'));

    await expect(service.approve('req-1', manager, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(balancesService.findEffectivePolicy).toHaveBeenCalled();
  });

  it('hides requests outside the reporting tree from detail reads', async () => {
    prisma.unscoped.leaveRequest.findFirst.mockResolvedValue(pendingRequest('emp-stranger'));

    await expect(service.get('req-1', manager)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
