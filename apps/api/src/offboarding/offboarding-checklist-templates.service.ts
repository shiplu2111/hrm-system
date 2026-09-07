import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OffboardingTaskType } from '@prisma/client';
import type { OffboardingChecklistTemplateRecord } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateOffboardingTemplateDto,
  CreateOffboardingTemplateItemDto,
  ListOffboardingTemplatesQueryDto,
  UpdateOffboardingTemplateDto,
  UpdateOffboardingTemplateItemDto,
} from './dto/offboarding.dto';
import { toTemplateItemRecord, toTemplateRecord } from './offboarding.utils';

const TEMPLATE_INCLUDE = {
  _count: { select: { items: true } },
  items: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
  },
};

@Injectable()
export class OffboardingChecklistTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
  ) {}

  async list(
    companyId: string,
    query: ListOffboardingTemplatesQueryDto,
  ): Promise<OffboardingChecklistTemplateRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.offboardingChecklistTemplate.findMany({
      where: {
        companyId,
        ...(query.activeOnly ? { isActive: true } : {}),
      },
      include: { _count: { select: { items: true } } },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    return rows.map((row) => toTemplateRecord(row));
  }

  async get(templateId: string): Promise<OffboardingChecklistTemplateRecord> {
    const row = await this.findOrThrow(templateId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    return toTemplateRecord(row, true);
  }

  async create(
    companyId: string,
    dto: CreateOffboardingTemplateDto,
  ): Promise<OffboardingChecklistTemplateRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    if (dto.isDefault) {
      await this.clearDefaultFlag(companyId);
    }

    const row = await this.prisma.unscoped.offboardingChecklistTemplate.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        isDefault: dto.isDefault ?? false,
        isActive: dto.isActive ?? true,
      },
      include: TEMPLATE_INCLUDE,
    });

    return toTemplateRecord(row, true);
  }

  async update(
    templateId: string,
    dto: UpdateOffboardingTemplateDto,
  ): Promise<OffboardingChecklistTemplateRecord> {
    const existing = await this.findOrThrow(templateId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    if (dto.isDefault) {
      await this.clearDefaultFlag(existing.companyId, templateId);
    }

    const row = await this.prisma.unscoped.offboardingChecklistTemplate.update({
      where: { id: templateId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() ?? null }
          : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: TEMPLATE_INCLUDE,
    });

    return toTemplateRecord(row, true);
  }

  async addItem(templateId: string, dto: CreateOffboardingTemplateItemDto) {
    const template = await this.findOrThrow(templateId);
    await this.companyScope.assertCompanyInTenant(template.companyId);
    this.assertTaskShape(dto.taskType, dto.assetCategory);

    const row = await this.prisma.unscoped.offboardingChecklistTemplateItem.create({
      data: {
        templateId,
        title: dto.title.trim(),
        description: dto.description?.trim() ?? null,
        category: dto.category,
        taskType: dto.taskType,
        assetCategory: dto.assetCategory ?? null,
        assigneeLabel: dto.assigneeLabel?.trim() ?? null,
        dueDaysOffset: dto.dueDaysOffset ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isRequired: dto.isRequired ?? true,
      },
    });

    return toTemplateItemRecord(row);
  }

  async updateItem(itemId: string, dto: UpdateOffboardingTemplateItemDto) {
    const existing = await this.findItemOrThrow(itemId);
    const template = await this.findOrThrow(existing.templateId);
    await this.companyScope.assertCompanyInTenant(template.companyId);

    if (dto.taskType !== undefined || dto.assetCategory !== undefined) {
      this.assertTaskShape(
        dto.taskType ?? existing.taskType,
        dto.assetCategory ?? existing.assetCategory ?? undefined,
      );
    }

    const row = await this.prisma.unscoped.offboardingChecklistTemplateItem.update({
      where: { id: itemId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() ?? null }
          : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.taskType !== undefined ? { taskType: dto.taskType } : {}),
        ...(dto.assetCategory !== undefined
          ? { assetCategory: dto.assetCategory }
          : {}),
        ...(dto.assigneeLabel !== undefined
          ? { assigneeLabel: dto.assigneeLabel?.trim() ?? null }
          : {}),
        ...(dto.dueDaysOffset !== undefined
          ? { dueDaysOffset: dto.dueDaysOffset }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isRequired !== undefined ? { isRequired: dto.isRequired } : {}),
      },
    });

    return toTemplateItemRecord(row);
  }

  async deleteItem(itemId: string): Promise<void> {
    const existing = await this.findItemOrThrow(itemId);
    const template = await this.findOrThrow(existing.templateId);
    await this.companyScope.assertCompanyInTenant(template.companyId);

    await this.prisma.unscoped.offboardingChecklistTemplateItem.delete({
      where: { id: itemId },
    });
  }

  async findDefaultTemplate(companyId: string) {
    return this.prisma.unscoped.offboardingChecklistTemplate.findFirst({
      where: { companyId, isDefault: true, isActive: true },
      include: TEMPLATE_INCLUDE,
    });
  }

  private assertTaskShape(
    taskType: OffboardingTaskType,
    assetCategory?: string,
  ): void {
    if (taskType === OffboardingTaskType.asset_return && !assetCategory) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Asset category is required for asset return tasks',
      });
    }
  }

  private async clearDefaultFlag(
    companyId: string,
    exceptTemplateId?: string,
  ): Promise<void> {
    await this.prisma.unscoped.offboardingChecklistTemplate.updateMany({
      where: {
        companyId,
        isDefault: true,
        ...(exceptTemplateId ? { id: { not: exceptTemplateId } } : {}),
      },
      data: { isDefault: false },
    });
  }

  private async findOrThrow(templateId: string) {
    const row = await this.prisma.unscoped.offboardingChecklistTemplate.findUnique({
      where: { id: templateId },
      include: TEMPLATE_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Offboarding checklist template not found',
      });
    }
    return row;
  }

  private async findItemOrThrow(itemId: string) {
    const row = await this.prisma.unscoped.offboardingChecklistTemplateItem.findUnique({
      where: { id: itemId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Offboarding checklist template item not found',
      });
    }
    return row;
  }
}
