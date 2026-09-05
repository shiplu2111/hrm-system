import { Injectable, NotFoundException } from '@nestjs/common';
import {
  WorkflowInstanceStatus,
  type WorkflowEntityType,
  type WorkflowInstance,
} from '@prisma/client';
import type { WorkflowInstanceRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type { ListWorkflowInstancesQueryDto } from './dto/workflow.dto';
import { WorkflowEngineService } from './workflow-engine.service';

@Injectable()
export class WorkflowInstancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly engine: WorkflowEngineService,
  ) {}

  async list(
    companyId: string,
    query: ListWorkflowInstancesQueryDto,
  ): Promise<{ data: WorkflowInstanceRecord[]; total: number }> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const where = {
      companyId,
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.unscoped.workflowInstance.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.unscoped.workflowInstance.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.engine.toRecord(row)),
      total,
    };
  }

  async get(instanceId: string): Promise<WorkflowInstanceRecord> {
    const row = await this.findOrThrow(instanceId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    return this.engine.toRecord(row);
  }

  async listPendingForUser(
    companyId: string,
    user: AuthenticatedUser,
  ): Promise<WorkflowInstanceRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const role = await this.prisma.unscoped.role.findUnique({
      where: { id: user.roleId },
      select: { name: true },
    });
    const roleName = role?.name ?? '';

    const pending = await this.prisma.unscoped.workflowInstance.findMany({
      where: {
        companyId,
        status: WorkflowInstanceStatus.pending,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const filtered: WorkflowInstance[] = [];
    for (const row of pending) {
      const record = this.engine.toRecord(row);
      const current = record.steps.find((s) => s.status === 'pending');
      if (!current) continue;

      const requester = await this.prisma.unscoped.employee.findFirst({
        where: { id: row.requesterEmployeeId },
        select: { managerId: true },
      });

      if (current.assigneeType === 'direct_manager') {
        if (user.employeeId && user.employeeId === requester?.managerId) {
          filtered.push(row);
          continue;
        }
        if (roleName === 'Company Owner' || roleName === 'HR Admin') {
          filtered.push(row);
        }
        continue;
      }

      if (roleName === current.roleName || roleName === 'Company Owner') {
        filtered.push(row);
      }
    }

    return filtered.map((row) => this.engine.toRecord(row));
  }

  async findByEntity(
    entityType: WorkflowEntityType,
    entityId: string,
  ): Promise<WorkflowInstanceRecord | null> {
    const row = await this.engine.findByEntity(entityType, entityId);
    return row ? this.engine.toRecord(row) : null;
  }

  private async findOrThrow(instanceId: string): Promise<WorkflowInstance> {
    const row = await this.prisma.unscoped.workflowInstance.findUnique({
      where: { id: instanceId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Workflow instance not found',
      });
    }
    return row;
  }
}
