import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OnboardingTaskType } from '@prisma/client';
import type { OnboardingChecklistTemplateRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateOnboardingTemplateDto,
  CreateOnboardingTemplateItemDto,
  ListOnboardingTemplatesQueryDto,
  ReorderOnboardingTemplateItemsDto,
  UpdateOnboardingTemplateDto,
  UpdateOnboardingTemplateItemDto,
} from './dto/onboarding.dto';
import {
  nextCopyName,
  normalizeTemplateItemFields,
  toTemplateItemRecord,
  toTemplateRecord,
  validateItemOrder,
} from './onboarding.utils';

const ITEM_INCLUDE = {
  documentType: { select: { name: true, requiresVerification: true } },
};

const TEMPLATE_INCLUDE = {
  _count: { select: { items: true, onboardings: true } },
  items: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
    include: ITEM_INCLUDE,
  },
};

@Injectable()
export class OnboardingChecklistTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async list(
    companyId: string,
    query: ListOnboardingTemplatesQueryDto,
  ): Promise<OnboardingChecklistTemplateRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.onboardingChecklistTemplate.findMany({
      where: {
        companyId,
        ...(query.activeOnly ? { isActive: true } : {}),
      },
      include: { _count: { select: { items: true, onboardings: true } } },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    return rows.map((row) => toTemplateRecord(row));
  }

  async get(templateId: string): Promise<OnboardingChecklistTemplateRecord> {
    const row = await this.findOrThrow(templateId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    return toTemplateRecord(row, true);
  }

  async create(
    companyId: string,
    dto: CreateOnboardingTemplateDto,
    user: AuthenticatedUser,
  ): Promise<OnboardingChecklistTemplateRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const name = dto.name.trim();
    const isActive = dto.isActive ?? true;
    const isDefault = dto.isDefault ?? false;

    if (isDefault && !isActive) {
      throw this.inactiveDefaultError();
    }
    await this.assertNameAvailable(companyId, name);

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      if (isDefault) {
        await tx.onboardingChecklistTemplate.updateMany({
          where: { companyId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.onboardingChecklistTemplate.create({
        data: {
          tenantId: company.tenantId,
          companyId,
          name,
          description: dto.description?.trim() || null,
          isDefault,
          isActive,
        },
        include: TEMPLATE_INCLUDE,
      });
    });

    await this.audit(user, row.tenantId, 'create', row.id, null, {
      name: row.name,
      isDefault: row.isDefault,
      isActive: row.isActive,
    });

    return toTemplateRecord(row, true);
  }

  async update(
    templateId: string,
    dto: UpdateOnboardingTemplateDto,
    user: AuthenticatedUser,
  ): Promise<OnboardingChecklistTemplateRecord> {
    const existing = await this.findOrThrow(templateId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    const name = dto.name !== undefined ? dto.name.trim() : existing.name;
    if (name.toLowerCase() !== existing.name.toLowerCase()) {
      await this.assertNameAvailable(existing.companyId, name, templateId);
    }

    const isActive = dto.isActive ?? existing.isActive;
    // Deactivating the default also retires it as the default, so hires stop using it.
    const isDefault = isActive ? (dto.isDefault ?? existing.isDefault) : false;
    if (dto.isDefault === true && !isActive) {
      throw this.inactiveDefaultError();
    }

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      if (isDefault && !existing.isDefault) {
        await tx.onboardingChecklistTemplate.updateMany({
          where: { companyId: existing.companyId, isDefault: true, id: { not: templateId } },
          data: { isDefault: false },
        });
      }
      return tx.onboardingChecklistTemplate.update({
        where: { id: templateId },
        data: {
          name,
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
          isDefault,
          isActive,
        },
        include: TEMPLATE_INCLUDE,
      });
    });

    await this.audit(
      user,
      row.tenantId,
      'update',
      row.id,
      {
        name: existing.name,
        description: existing.description,
        isDefault: existing.isDefault,
        isActive: existing.isActive,
      },
      {
        name: row.name,
        description: row.description,
        isDefault: row.isDefault,
        isActive: row.isActive,
      },
    );

    return toTemplateRecord(row, true);
  }

  async remove(templateId: string, user: AuthenticatedUser): Promise<void> {
    const existing = await this.findOrThrow(templateId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    if (existing._count.onboardings > 0) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `This template has been used for ${existing._count.onboardings} onboarding${
          existing._count.onboardings === 1 ? '' : 's'
        }. Deactivate it instead so their history is kept.`,
      });
    }

    await this.prisma.unscoped.onboardingChecklistTemplate.delete({
      where: { id: templateId },
    });

    await this.audit(user, existing.tenantId, 'delete', templateId, {
      name: existing.name,
      itemCount: existing._count.items,
    });
  }

  async duplicate(
    templateId: string,
    user: AuthenticatedUser,
  ): Promise<OnboardingChecklistTemplateRecord> {
    const source = await this.findOrThrow(templateId);
    await this.companyScope.assertCompanyInTenant(source.companyId);

    const siblings = await this.prisma.unscoped.onboardingChecklistTemplate.findMany({
      where: { companyId: source.companyId },
      select: { name: true },
    });
    const name = nextCopyName(
      source.name,
      siblings.map((row) => row.name),
    );

    const row = await this.prisma.unscoped.onboardingChecklistTemplate.create({
      data: {
        tenantId: source.tenantId,
        companyId: source.companyId,
        name,
        description: source.description,
        isDefault: false,
        isActive: true,
        items: {
          create: source.items.map((item, index) => ({
            title: item.title,
            description: item.description,
            category: item.category,
            taskType: item.taskType,
            documentTypeId: item.documentTypeId,
            assetCategory: item.assetCategory,
            policyDocumentUrl: item.policyDocumentUrl,
            assigneeLabel: item.assigneeLabel,
            dueDaysOffset: item.dueDaysOffset,
            sortOrder: index,
            isRequired: item.isRequired,
          })),
        },
      },
      include: TEMPLATE_INCLUDE,
    });

    await this.audit(user, row.tenantId, 'create', row.id, null, {
      name: row.name,
      duplicatedFrom: source.id,
      itemCount: source.items.length,
    });

    return toTemplateRecord(row, true);
  }

  async addItem(
    templateId: string,
    dto: CreateOnboardingTemplateItemDto,
    user: AuthenticatedUser,
  ) {
    const template = await this.findOrThrow(templateId);
    await this.companyScope.assertCompanyInTenant(template.companyId);

    const fields = normalizeTemplateItemFields(dto.taskType, dto);
    await this.assertDocumentTypeForCompany(
      template.companyId,
      fields.documentTypeId,
      dto.taskType,
    );

    const nextSortOrder =
      template.items.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;

    const row = await this.prisma.unscoped.onboardingChecklistTemplateItem.create({
      data: {
        templateId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        category: dto.category,
        taskType: dto.taskType,
        ...fields,
        assigneeLabel: dto.assigneeLabel?.trim() || null,
        dueDaysOffset: dto.dueDaysOffset ?? null,
        sortOrder: dto.sortOrder ?? nextSortOrder,
        isRequired: dto.isRequired ?? true,
      },
      include: ITEM_INCLUDE,
    });

    await this.audit(user, template.tenantId, 'update', templateId, null, {
      itemAdded: { id: row.id, title: row.title, taskType: row.taskType },
    });

    return toTemplateItemRecord(row);
  }

  async updateItem(
    itemId: string,
    dto: UpdateOnboardingTemplateItemDto,
    user: AuthenticatedUser,
  ) {
    const existing = await this.findItemOrThrow(itemId);
    const template = await this.findOrThrow(existing.templateId);
    await this.companyScope.assertCompanyInTenant(template.companyId);

    const taskType = dto.taskType ?? existing.taskType;
    const fields = normalizeTemplateItemFields(taskType, {
      documentTypeId:
        dto.documentTypeId !== undefined ? dto.documentTypeId : existing.documentTypeId,
      assetCategory:
        dto.assetCategory !== undefined ? dto.assetCategory : existing.assetCategory,
      policyDocumentUrl:
        dto.policyDocumentUrl !== undefined
          ? dto.policyDocumentUrl
          : existing.policyDocumentUrl,
    });

    if (
      fields.documentTypeId !== existing.documentTypeId ||
      taskType !== existing.taskType
    ) {
      await this.assertDocumentTypeForCompany(
        template.companyId,
        fields.documentTypeId,
        taskType,
      );
    }

    const row = await this.prisma.unscoped.onboardingChecklistTemplateItem.update({
      where: { id: itemId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        taskType,
        ...fields,
        ...(dto.assigneeLabel !== undefined
          ? { assigneeLabel: dto.assigneeLabel?.trim() || null }
          : {}),
        ...(dto.dueDaysOffset !== undefined
          ? { dueDaysOffset: dto.dueDaysOffset }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isRequired !== undefined ? { isRequired: dto.isRequired } : {}),
      },
      include: ITEM_INCLUDE,
    });

    await this.audit(
      user,
      template.tenantId,
      'update',
      template.id,
      { item: this.itemSnapshot(existing) },
      { item: this.itemSnapshot(row) },
    );

    return toTemplateItemRecord(row);
  }

  async deleteItem(itemId: string, user: AuthenticatedUser): Promise<void> {
    const existing = await this.findItemOrThrow(itemId);
    const template = await this.findOrThrow(existing.templateId);
    await this.companyScope.assertCompanyInTenant(template.companyId);

    await this.prisma.unscoped.onboardingChecklistTemplateItem.delete({
      where: { id: itemId },
    });

    await this.audit(user, template.tenantId, 'update', template.id, {
      itemRemoved: this.itemSnapshot(existing),
    });
  }

  async reorderItems(
    templateId: string,
    dto: ReorderOnboardingTemplateItemsDto,
    user: AuthenticatedUser,
  ): Promise<OnboardingChecklistTemplateRecord> {
    const template = await this.findOrThrow(templateId);
    await this.companyScope.assertCompanyInTenant(template.companyId);

    const check = validateItemOrder(
      template.items.map((item) => item.id),
      dto.itemIds,
    );
    if (!check.ok) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: check.reason });
    }

    await this.prisma.unscoped.$transaction(
      dto.itemIds.map((id, index) =>
        this.prisma.unscoped.onboardingChecklistTemplateItem.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    await this.audit(
      user,
      template.tenantId,
      'update',
      templateId,
      { itemOrder: template.items.map((item) => item.id) },
      { itemOrder: dto.itemIds },
    );

    return this.get(templateId);
  }

  async findDefaultTemplate(companyId: string) {
    return this.prisma.unscoped.onboardingChecklistTemplate.findFirst({
      where: { companyId, isDefault: true, isActive: true },
      include: TEMPLATE_INCLUDE,
    });
  }

  private itemSnapshot(item: {
    id: string;
    title: string;
    taskType: OnboardingTaskType;
    documentTypeId: string | null;
    dueDaysOffset: number | null;
    isRequired: boolean;
  }) {
    return {
      id: item.id,
      title: item.title,
      taskType: item.taskType,
      documentTypeId: item.documentTypeId,
      dueDaysOffset: item.dueDaysOffset,
      isRequired: item.isRequired,
    };
  }

  private async audit(
    user: AuthenticatedUser,
    tenantId: string,
    action: 'create' | 'update' | 'delete',
    recordId: string,
    oldValue: Record<string, unknown> | null,
    newValue?: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.log({
      tenantId,
      userId: user.id,
      action,
      module: 'employee',
      recordId,
      oldValue,
      newValue: newValue ?? null,
    });
  }

  private inactiveDefaultError() {
    return new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'An inactive template cannot be the default. Activate it first.',
    });
  }

  private async assertNameAvailable(
    companyId: string,
    name: string,
    exceptTemplateId?: string,
  ): Promise<void> {
    const clash = await this.prisma.unscoped.onboardingChecklistTemplate.findFirst({
      where: {
        companyId,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptTemplateId ? { id: { not: exceptTemplateId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `A checklist template named "${name}" already exists`,
      });
    }
  }

  private async assertDocumentTypeForCompany(
    companyId: string,
    documentTypeId: string | null,
    taskType: OnboardingTaskType,
  ): Promise<void> {
    const needsDocumentType =
      taskType === 'document_collection' || taskType === 'policy_acceptance';

    if (needsDocumentType && !documentTypeId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Document type is required for document and policy tasks',
      });
    }

    if (!documentTypeId) return;

    const docType = await this.prisma.unscoped.documentType.findFirst({
      where: { id: documentTypeId, companyId, isActive: true },
      select: { scope: true },
    });
    if (!docType) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Document type not found',
      });
    }
    if (docType.scope !== 'employee') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Choose an employee document type; company-wide documents cannot be collected per employee',
      });
    }
  }

  private async findOrThrow(templateId: string) {
    const row = await this.prisma.unscoped.onboardingChecklistTemplate.findUnique({
      where: { id: templateId },
      include: TEMPLATE_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Onboarding checklist template not found',
      });
    }
    return row;
  }

  private async findItemOrThrow(itemId: string) {
    const row = await this.prisma.unscoped.onboardingChecklistTemplateItem.findUnique({
      where: { id: itemId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Onboarding checklist template item not found',
      });
    }
    return row;
  }
}
