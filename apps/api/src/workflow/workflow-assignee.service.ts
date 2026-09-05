import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { WorkflowInstanceStep } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class WorkflowAssigneeService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanActOnStep(input: {
    requesterEmployeeId: string;
    step: WorkflowInstanceStep;
    user: AuthenticatedUser;
  }): Promise<void> {
    const requester = await this.prisma.unscoped.employee.findFirst({
      where: { id: input.requesterEmployeeId, deletedAt: null },
      select: { managerId: true },
    });
    if (!requester) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Requester employee not found',
      });
    }

    const role = await this.prisma.unscoped.role.findUnique({
      where: { id: input.user.roleId },
      select: { name: true },
    });
    const roleName = role?.name ?? '';

    if (input.step.assigneeType === 'direct_manager') {
      if (input.user.employeeId && input.user.employeeId === requester.managerId) {
        return;
      }
      if (roleName === 'Company Owner' || roleName === 'HR Admin') {
        return;
      }
    } else if (roleName === input.step.roleName || roleName === 'Company Owner') {
      return;
    }

    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: `You are not authorized for the ${input.step.roleName} approval step`,
    });
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
}
