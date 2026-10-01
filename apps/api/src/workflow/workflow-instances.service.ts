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

const PENDING_SCAN_BATCH = 500;

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
    entityType?: WorkflowEntityType,
  ): Promise<WorkflowInstanceRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const role = await this.prisma.unscoped.role.findUnique({
      where: { id: user.roleId },
      select: { name: true },
    });
    const roleName = role?.name ?? '';
    const isOverseer = roleName === 'Company Owner' || roleName === 'HR Admin';

    const assigned: WorkflowInstanceRecord[] = [];
    let cursor: string | undefined;
    for (;;) {
      const batch: WorkflowInstance[] = await this.prisma.unscoped.workflowInstance.findMany({
        where: {
          companyId,
          status: WorkflowInstanceStatus.pending,
          ...(entityType ? { entityType } : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: PENDING_SCAN_BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) break;
      cursor = batch[batch.length - 1].id;

      const managerOf = await this.loadManagerIds(batch.map((row) => row.requesterEmployeeId));
      const needsSkipLevel = new Set<string>();
      const candidates = batch.map((row) => {
        const record = this.engine.toRecord(row);
        const current = record.steps.find((s) => s.status === 'pending');
        const managerId = managerOf.get(row.requesterEmployeeId) ?? null;
        if (current?.assigneeType === 'skip_level_manager' && managerId) {
          needsSkipLevel.add(managerId);
        }
        return { record, current, managerId };
      });
      const skipLevelOf = await this.loadManagerIds([...needsSkipLevel], true);

      for (const { record, current, managerId } of candidates) {
        if (!current) continue;
        if (current.assigneeType === 'direct_manager') {
          if ((user.employeeId && user.employeeId === managerId) || isOverseer) {
            assigned.push(record);
          }
        } else if (current.assigneeType === 'skip_level_manager') {
          const skipLevelId = managerId ? skipLevelOf.get(managerId) : undefined;
          if ((user.employeeId && user.employeeId === skipLevelId) || isOverseer) {
            assigned.push(record);
          }
        } else if (roleName === current.roleName || roleName === 'Company Owner') {
          assigned.push(record);
        }
      }

      if (batch.length < PENDING_SCAN_BATCH) break;
    }

    return assigned;
  }

  /** Maps each employee id to its manager id (null when the employee has none). */
  private async loadManagerIds(
    employeeIds: string[],
    activeOnly = false,
  ): Promise<Map<string, string | null>> {
    if (employeeIds.length === 0) return new Map();
    const rows = await this.prisma.unscoped.employee.findMany({
      where: {
        id: { in: [...new Set(employeeIds)] },
        ...(activeOnly ? { deletedAt: null } : {}),
      },
      select: { id: true, managerId: true },
    });
    return new Map(rows.map((row) => [row.id, row.managerId]));
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
