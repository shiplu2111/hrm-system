import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  Prisma,
  WorkflowInstanceStatus,
  type WorkflowDefinition,
  type WorkflowEntityType,
} from '@prisma/client';
import type { WorkflowDefinitionRecord, WorkflowDefinitionStep } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateWorkflowDefinitionDto,
  ListWorkflowDefinitionsQueryDto,
  UpdateWorkflowDefinitionDto,
} from './dto/workflow.dto';
import {
  WORKFLOW_MODULE_LABELS,
  normalizeWorkflowDefinition,
  unconnectedModuleMessage,
  type WorkflowDefinitionDraft,
} from './workflow-definition.rules';
import {
  describeWorkflowRouting,
  parseDateString,
  parseDefinitionSteps,
  pickMatchingWorkflowDefinition,
  type WorkflowRoutingResult,
} from './workflow.utils';

function parseTriggerConfig(value: unknown): WorkflowDefinitionRecord['triggerConfig'] {
  if (value == null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (record.type !== 'always' && record.type !== 'amount_threshold') return null;
  return {
    type: record.type,
    operator:
      record.operator === 'gt' || record.operator === 'gte'
        ? record.operator
        : undefined,
    value: typeof record.value === 'number' ? record.value : undefined,
    currency: typeof record.currency === 'string' ? record.currency : undefined,
  };
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

interface InstanceUsage {
  total: number;
  pending: number;
}

const NO_USAGE: InstanceUsage = { total: 0, pending: 0 };

@Injectable()
export class WorkflowDefinitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async list(
    companyId: string,
    query: ListWorkflowDefinitionsQueryDto,
  ): Promise<WorkflowDefinitionRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.workflowDefinition.findMany({
      where: { companyId },
      orderBy: [{ entityType: 'asc' }, { name: 'asc' }],
    });
    const usage = await this.usageByDefinition(companyId);
    const routing = this.routingFor(rows);

    return rows
      .filter((row) => !query.entityType || row.entityType === query.entityType)
      .filter((row) => !query.activeOnly || row.isActive)
      .map((row) => this.toRecord(row, usage.get(row.id), routing.get(row.id)));
  }

  async get(companyId: string, definitionId: string): Promise<WorkflowDefinitionRecord> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const row = await this.findOrThrow(companyId, definitionId);
    return this.toDetailedRecord(row);
  }

  async findById(definitionId: string): Promise<WorkflowDefinitionRecord | null> {
    const row = await this.prisma.unscoped.workflowDefinition.findUnique({
      where: { id: definitionId },
    });
    return row ? this.toRecord(row) : null;
  }

  async create(
    companyId: string,
    dto: CreateWorkflowDefinitionDto,
    user: AuthenticatedUser,
  ): Promise<WorkflowDefinitionRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    const unconnected = unconnectedModuleMessage(dto.entityType);
    if (unconnected) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: unconnected });
    }

    const name = dto.name.trim();
    const isActive = dto.isActive ?? true;
    const normalized = this.normalizeOrThrow({
      entityType: dto.entityType,
      triggerConfig: dto.triggerConfig ?? null,
      steps: await this.canonicalRoleSteps(dto.steps),
      isDefault: dto.isDefault ?? false,
      isActive,
      effectiveFrom: dto.effectiveFrom.slice(0, 10),
      effectiveTo: dto.effectiveTo?.slice(0, 10) ?? null,
    });
    await this.assertUniqueName(companyId, dto.entityType, name);

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      if (normalized.isDefault) {
        await tx.workflowDefinition.updateMany({
          where: { companyId, entityType: dto.entityType, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.workflowDefinition.create({
        data: {
          companyId,
          entityType: dto.entityType,
          name,
          description: dto.description?.trim() || null,
          steps: normalized.steps as unknown as Prisma.InputJsonValue,
          triggerConfig: normalized.triggerConfig as unknown as Prisma.InputJsonValue,
          isDefault: normalized.isDefault,
          isActive,
          effectiveFrom: parseDateString(dto.effectiveFrom.slice(0, 10)),
          effectiveTo: dto.effectiveTo ? parseDateString(dto.effectiveTo.slice(0, 10)) : null,
        },
      });
    });

    const record = await this.toDetailedRecord(row);
    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: AuditAction.create,
      module: 'settings',
      recordId: row.id,
      newValue: this.auditSnapshot(record),
    });
    return record;
  }

  async update(
    companyId: string,
    definitionId: string,
    dto: UpdateWorkflowDefinitionDto,
    user: AuthenticatedUser,
  ): Promise<WorkflowDefinitionRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const existing = await this.findOrThrow(companyId, definitionId);
    const before = await this.toDetailedRecord(existing);

    const entityType = dto.entityType ?? existing.entityType;
    if (entityType !== existing.entityType) {
      const unconnected = unconnectedModuleMessage(entityType);
      if (unconnected) {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: unconnected });
      }
      if (before.instanceCount > 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message:
            "This workflow has already routed requests, so its module can't change; create a new workflow instead",
        });
      }
    }

    const name = dto.name?.trim() ?? existing.name;
    const isActive = dto.isActive ?? existing.isActive;
    const effectiveFrom = dto.effectiveFrom?.slice(0, 10) ?? before.effectiveFrom;
    const effectiveTo =
      dto.effectiveTo !== undefined ? (dto.effectiveTo?.slice(0, 10) ?? null) : before.effectiveTo;
    const normalized = this.normalizeOrThrow({
      entityType,
      triggerConfig: dto.triggerConfig !== undefined ? dto.triggerConfig : before.triggerConfig,
      steps: dto.steps ? await this.canonicalRoleSteps(dto.steps) : before.steps,
      isDefault: dto.isDefault ?? existing.isDefault,
      isActive,
      effectiveFrom,
      effectiveTo,
    });
    if (name.toLowerCase() !== existing.name.toLowerCase() || entityType !== existing.entityType) {
      await this.assertUniqueName(companyId, entityType, name, definitionId);
    }

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      if (normalized.isDefault) {
        await tx.workflowDefinition.updateMany({
          where: { companyId, entityType, isDefault: true, id: { not: definitionId } },
          data: { isDefault: false },
        });
      }
      return tx.workflowDefinition.update({
        where: { id: definitionId },
        data: {
          entityType,
          name,
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
          steps: normalized.steps as unknown as Prisma.InputJsonValue,
          triggerConfig: normalized.triggerConfig as unknown as Prisma.InputJsonValue,
          isDefault: normalized.isDefault,
          isActive,
          effectiveFrom: parseDateString(effectiveFrom),
          effectiveTo: effectiveTo ? parseDateString(effectiveTo) : null,
        },
      });
    });

    const record = await this.toDetailedRecord(row);
    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: AuditAction.update,
      module: 'settings',
      recordId: definitionId,
      oldValue: this.auditSnapshot(before),
      newValue: this.auditSnapshot(record),
    });
    return record;
  }

  /** Only never-used workflows can be deleted; past requests keep pointing at the ones they ran on. */
  async remove(companyId: string, definitionId: string, user: AuthenticatedUser): Promise<void> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const existing = await this.findOrThrow(companyId, definitionId);
    const before = await this.toDetailedRecord(existing);

    if (before.instanceCount > 0) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `This workflow has routed ${before.instanceCount} request${before.instanceCount === 1 ? '' : 's'}, so it can't be deleted; turn it off instead`,
      });
    }

    await this.prisma.unscoped.workflowDefinition.delete({ where: { id: definitionId } });
    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: AuditAction.delete,
      module: 'settings',
      recordId: definitionId,
      oldValue: this.auditSnapshot(before),
    });
  }

  async findEffectiveDefault(
    companyId: string,
    entityType: WorkflowEntityType,
    asOf: Date = new Date(),
  ): Promise<WorkflowDefinitionRecord | null> {
    const row = await this.prisma.unscoped.workflowDefinition.findFirst({
      where: {
        companyId,
        entityType,
        isDefault: true,
        isActive: true,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    return row ? this.toRecord(row) : null;
  }

  async findMatchingDefinition(
    companyId: string,
    entityType: WorkflowEntityType,
    context: { amount?: number },
    asOf: Date = new Date(),
  ): Promise<WorkflowDefinitionRecord | null> {
    const rows = await this.prisma.unscoped.workflowDefinition.findMany({
      where: {
        companyId,
        entityType,
        isActive: true,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }],
    });

    const records = rows.map((row) => this.toRecord(row));
    return pickMatchingWorkflowDefinition(records, context);
  }

  private normalizeOrThrow(draft: WorkflowDefinitionDraft) {
    const result = normalizeWorkflowDefinition(draft);
    if (!result.ok) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: result.message });
    }
    return result.value;
  }

  /** Role steps must name a role in this tenant; the stored name takes the role's exact spelling. */
  private async canonicalRoleSteps(
    steps: CreateWorkflowDefinitionDto['steps'],
  ): Promise<WorkflowDefinitionStep[]> {
    const roleSteps = steps.filter((step) => step.assigneeType === 'role');
    const roles = roleSteps.length
      ? await this.prisma.scoped.role.findMany({ select: { name: true } })
      : [];
    const byName = new Map(roles.map((role) => [role.name.trim().toLowerCase(), role.name]));

    return steps.map((step) => {
      let roleName = step.roleName;
      if (step.assigneeType === 'role') {
        const match = byName.get(step.roleName.trim().toLowerCase());
        if (!match) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: `Step ${step.order}: there is no role named "${step.roleName.trim()}"`,
          });
        }
        roleName = match;
      }
      return {
        order: step.order,
        assigneeType: step.assigneeType,
        roleName,
        ...(step.condition
          ? {
              condition: {
                type: 'amount_threshold' as const,
                operator: step.condition.operator,
                value: step.condition.value,
              },
            }
          : {}),
      };
    });
  }

  private async assertUniqueName(
    companyId: string,
    entityType: WorkflowEntityType,
    name: string,
    excludeId?: string,
  ) {
    const clash = await this.prisma.unscoped.workflowDefinition.findFirst({
      where: {
        companyId,
        entityType,
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `Another ${WORKFLOW_MODULE_LABELS[entityType].toLowerCase()} workflow is already called "${name}"`,
      });
    }
  }

  private async findOrThrow(companyId: string, definitionId: string) {
    const row = await this.prisma.unscoped.workflowDefinition.findFirst({
      where: { id: definitionId, companyId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Workflow definition not found',
      });
    }
    return row;
  }

  private async usageByDefinition(
    companyId: string,
    definitionId?: string,
  ): Promise<Map<string, InstanceUsage>> {
    const groups = await this.prisma.unscoped.workflowInstance.groupBy({
      by: ['definitionId', 'status'],
      where: {
        companyId,
        definitionId: definitionId ?? { not: null },
      },
      _count: { _all: true },
    });
    const usage = new Map<string, InstanceUsage>();
    for (const group of groups) {
      if (!group.definitionId) continue;
      const entry = usage.get(group.definitionId) ?? { total: 0, pending: 0 };
      entry.total += group._count._all;
      if (group.status === WorkflowInstanceStatus.pending) entry.pending += group._count._all;
      usage.set(group.definitionId, entry);
    }
    return usage;
  }

  private routingFor(rows: WorkflowDefinition[]): Map<string, WorkflowRoutingResult> {
    return describeWorkflowRouting(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        entityType: row.entityType,
        isDefault: row.isDefault,
        isActive: row.isActive,
        effectiveFrom: dateOnly(row.effectiveFrom),
        effectiveTo: row.effectiveTo ? dateOnly(row.effectiveTo) : null,
        triggerConfig: parseTriggerConfig(row.triggerConfig),
      })),
      dateOnly(new Date()),
    );
  }

  private async toDetailedRecord(row: WorkflowDefinition): Promise<WorkflowDefinitionRecord> {
    const [usage, peers] = await Promise.all([
      this.usageByDefinition(row.companyId, row.id),
      this.prisma.unscoped.workflowDefinition.findMany({
        where: { companyId: row.companyId, entityType: row.entityType },
      }),
    ]);
    return this.toRecord(row, usage.get(row.id), this.routingFor(peers).get(row.id));
  }

  private auditSnapshot(record: WorkflowDefinitionRecord): Record<string, unknown> {
    return {
      entityType: record.entityType,
      name: record.name,
      description: record.description,
      triggerConfig: record.triggerConfig,
      steps: record.steps,
      isDefault: record.isDefault,
      isActive: record.isActive,
      effectiveFrom: record.effectiveFrom,
      effectiveTo: record.effectiveTo,
    };
  }

  private toRecord(
    row: WorkflowDefinition,
    usage: InstanceUsage = NO_USAGE,
    routing?: WorkflowRoutingResult,
  ): WorkflowDefinitionRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      entityType: row.entityType,
      name: row.name,
      description: row.description,
      steps: parseDefinitionSteps(row.steps),
      triggerConfig: parseTriggerConfig(row.triggerConfig),
      isDefault: row.isDefault,
      isActive: row.isActive,
      effectiveFrom: dateOnly(row.effectiveFrom),
      effectiveTo: row.effectiveTo ? dateOnly(row.effectiveTo) : null,
      instanceCount: usage.total,
      pendingInstanceCount: usage.pending,
      routingStatus: routing?.status ?? (row.isActive ? 'in_use' : 'inactive'),
      routingOverriddenBy: routing?.overriddenBy ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
