import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { WorkflowInstanceStep } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { DataScopeService } from '../rbac/data-scope.service';

@Injectable()
export class WorkflowAssigneeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  async assertCanActOnStep(input: {
    requesterEmployeeId: string;
    step: WorkflowInstanceStep;
    user: AuthenticatedUser;
  }): Promise<void> {
    const requester = await this.prisma.unscoped.employee.findFirst({
      where: { id: input.requesterEmployeeId, deletedAt: null },
      select: { id: true },
    });
    if (!requester) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Requester employee not found',
      });
    }

    const [allowed] = await this.canActOnSteps(input.user, [input]);
    if (allowed) return;

    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: `You are not authorized for the ${input.step.roleName} approval step`,
    });
  }

  /**
   * Same rules as `assertCanActOnStep`, evaluated for many steps with a fixed number of queries.
   * Manager steps: the requester's (skip-level) manager, or a Company Owner / HR Admin.
   * Role steps: a Company Owner, or a user with that role whose data scope reaches the requester.
   */
  async canActOnSteps(
    user: AuthenticatedUser,
    items: Array<{ requesterEmployeeId: string; step: WorkflowInstanceStep }>,
  ): Promise<boolean[]> {
    if (items.length === 0) return [];

    const role = await this.prisma.unscoped.role.findUnique({
      where: { id: user.roleId },
      select: { name: true },
    });
    const roleName = role?.name ?? '';
    const isOverseer = roleName === 'Company Owner' || roleName === 'HR Admin';

    const managerOf = await this.loadManagerIds(items.map((item) => item.requesterEmployeeId));
    const skipLevelLookups = items
      .filter((item) => item.step.assigneeType === 'skip_level_manager')
      .map((item) => managerOf.get(item.requesterEmployeeId))
      .filter((id): id is string => !!id);
    const skipLevelOf = await this.loadManagerIds(skipLevelLookups);

    return Promise.all(
      items.map(async ({ requesterEmployeeId, step }) => {
        if (!managerOf.has(requesterEmployeeId)) return false;
        const managerId = managerOf.get(requesterEmployeeId) ?? null;

        if (step.assigneeType === 'direct_manager') {
          return (!!user.employeeId && user.employeeId === managerId) || isOverseer;
        }
        if (step.assigneeType === 'skip_level_manager') {
          const skipLevelId = managerId ? (skipLevelOf.get(managerId) ?? null) : null;
          return (!!user.employeeId && user.employeeId === skipLevelId) || isOverseer;
        }
        if (roleName === 'Company Owner') return true;
        if (roleName !== step.roleName) return false;
        return this.dataScope.canAccessEmployee(user, requesterEmployeeId, { includeSelf: false });
      }),
    );
  }

  /** employeeId → managerId (null when the employee has no manager); missing ids are omitted. */
  private async loadManagerIds(employeeIds: string[]): Promise<Map<string, string | null>> {
    const ids = [...new Set(employeeIds)];
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.unscoped.employee.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, managerId: true },
    });
    return new Map(rows.map((row) => [row.id, row.managerId]));
  }

  /** Resolve user IDs who can act on the current workflow step (for approval.pending). */
  async resolveApproverUserIds(input: {
    step: WorkflowInstanceStep;
    requesterEmployeeId: string;
    tenantId: string;
  }): Promise<string[]> {
    if (input.step.assigneeType === 'direct_manager') {
      const requester = await this.prisma.unscoped.employee.findFirst({
        where: { id: input.requesterEmployeeId, deletedAt: null },
        select: { managerId: true },
      });
      if (!requester?.managerId) return [];

      const managerUser = await this.prisma.unscoped.user.findFirst({
        where: {
          employeeId: requester.managerId,
          isActive: true,
          tenantId: input.tenantId,
        },
        select: { id: true },
      });
      return managerUser ? [managerUser.id] : [];
    }

    if (input.step.assigneeType === 'skip_level_manager') {
      const skipLevelManagerId = await this.getSkipLevelManagerId(
        input.requesterEmployeeId,
      );
      if (!skipLevelManagerId) return [];

      const skipUser = await this.prisma.unscoped.user.findFirst({
        where: {
          employeeId: skipLevelManagerId,
          isActive: true,
          tenantId: input.tenantId,
        },
        select: { id: true },
      });
      return skipUser ? [skipUser.id] : [];
    }

    const users = await this.prisma.unscoped.user.findMany({
      where: {
        tenantId: input.tenantId,
        isActive: true,
        role: { name: input.step.roleName },
      },
      select: { id: true },
    });

    if (users.length > 0) return users.map((u) => u.id);

    if (input.step.roleName === 'Manager') {
      return this.resolveApproverUserIds({
        step: { ...input.step, assigneeType: 'direct_manager' },
        requesterEmployeeId: input.requesterEmployeeId,
        tenantId: input.tenantId,
      });
    }

    return [];
  }

  private async getSkipLevelManagerId(employeeId: string): Promise<string | null> {
    const employee = await this.prisma.unscoped.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { managerId: true },
    });
    if (!employee?.managerId) return null;

    const manager = await this.prisma.unscoped.employee.findFirst({
      where: { id: employee.managerId, deletedAt: null },
      select: { managerId: true },
    });
    return manager?.managerId ?? null;
  }
}
