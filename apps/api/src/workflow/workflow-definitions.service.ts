import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type WorkflowEntityType } from '@prisma/client';
import type { WorkflowDefinitionRecord } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateWorkflowDefinitionDto,
  ListWorkflowDefinitionsQueryDto,
  UpdateWorkflowDefinitionDto,
} from './dto/workflow.dto';
import { parseDefinitionSteps, parseDateString } from './workflow.utils';

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

@Injectable()
export class WorkflowDefinitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
  ) {}

  async list(
    companyId: string,
    query: ListWorkflowDefinitionsQueryDto,
  ): Promise<WorkflowDefinitionRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.workflowDefinition.findMany({
      where: {
        companyId,
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ entityType: 'asc' }, { name: 'asc' }],
    });

    return rows.map((row) => this.toRecord(row));
  }

  async get(companyId: string, definitionId: string): Promise<WorkflowDefinitionRecord> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const row = await this.prisma.unscoped.workflowDefinition.findFirst({
      where: { id: definitionId, companyId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Workflow definition not found',
      });
    }
    return this.toRecord(row);
  }

  async create(
    companyId: string,
    dto: CreateWorkflowDefinitionDto,
  ): Promise<WorkflowDefinitionRecord> {
    await this.companyScope.assertCompanyInTenant(companyId);
    this.validateSteps(dto.steps);

    if (dto.isDefault) {
      await this.clearDefaultFlag(companyId, dto.entityType);
    }

    const row = await this.prisma.unscoped.workflowDefinition.create({
      data: {
        companyId,
        entityType: dto.entityType,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        steps: dto.steps as unknown as Prisma.InputJsonValue,
        triggerConfig:
          dto.triggerConfig != null
            ? (dto.triggerConfig as unknown as Prisma.InputJsonValue)
            : undefined,
        isDefault: dto.isDefault ?? false,
        isActive: dto.isActive ?? true,
        effectiveFrom: parseDateString(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? parseDateString(dto.effectiveTo) : null,
      },
    });

    return this.toRecord(row);
  }

  async update(
    companyId: string,
    definitionId: string,
    dto: UpdateWorkflowDefinitionDto,
  ): Promise<WorkflowDefinitionRecord> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const existing = await this.prisma.unscoped.workflowDefinition.findFirst({
      where: { id: definitionId, companyId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Workflow definition not found',
      });
    }

    if (dto.steps) {
      this.validateSteps(dto.steps);
    }

    if (dto.isDefault) {
      await this.clearDefaultFlag(companyId, dto.entityType ?? existing.entityType);
    }

    const row = await this.prisma.unscoped.workflowDefinition.update({
      where: { id: definitionId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() ?? null }
          : {}),
        ...(dto.triggerConfig !== undefined
          ? {
              triggerConfig:
                dto.triggerConfig != null
                  ? (dto.triggerConfig as unknown as Prisma.InputJsonValue)
                  : Prisma.DbNull,
            }
          : {}),
        ...(dto.entityType !== undefined ? { entityType: dto.entityType } : {}),
        ...(dto.steps !== undefined
          ? { steps: dto.steps as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.effectiveFrom !== undefined
          ? { effectiveFrom: parseDateString(dto.effectiveFrom) }
          : {}),
        ...(dto.effectiveTo !== undefined
          ? {
              effectiveTo: dto.effectiveTo
                ? parseDateString(dto.effectiveTo)
                : null,
            }
          : {}),
      },
    });

    return this.toRecord(row);
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

  private validateSteps(steps: CreateWorkflowDefinitionDto['steps']) {
    if (!steps.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Workflow definition requires at least one step',
      });
    }
    const orders = new Set(steps.map((s) => s.order));
    if (orders.size !== steps.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Workflow step order values must be unique',
      });
    }
  }

  private async clearDefaultFlag(
    companyId: string,
    entityType: WorkflowEntityType,
  ) {
    await this.prisma.unscoped.workflowDefinition.updateMany({
      where: { companyId, entityType, isDefault: true },
      data: { isDefault: false },
    });
  }

  private toRecord(row: {
    id: string;
    companyId: string;
    entityType: WorkflowEntityType;
    name: string;
    description: string | null;
    steps: unknown;
    triggerConfig?: unknown;
    isDefault: boolean;
    isActive: boolean;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): WorkflowDefinitionRecord {
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
      effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: row.effectiveTo?.toISOString().slice(0, 10) ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
