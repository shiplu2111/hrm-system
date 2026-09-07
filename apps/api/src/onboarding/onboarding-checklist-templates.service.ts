import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OnboardingChecklistTemplateRecord } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateOnboardingTemplateDto,
  CreateOnboardingTemplateItemDto,
  ListOnboardingTemplatesQueryDto,
  UpdateOnboardingTemplateDto,
  UpdateOnboardingTemplateItemDto,
} from './dto/onboarding.dto';
import { toTemplateItemRecord, toTemplateRecord } from './onboarding.utils';

const TEMPLATE_INCLUDE = {
  _count: { select: { items: true } },
  items: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
    include: {
      documentType: { select: { name: true } },
    },
  },
};

@Injectable()
export class OnboardingChecklistTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
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
      include: { _count: { select: { items: true } } },
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
  ): Promise<OnboardingChecklistTemplateRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    if (dto.isDefault) {
      await this.clearDefaultFlag(companyId);
    }

    const row = await this.prisma.unscoped.onboardingChecklistTemplate.create({
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
    dto: UpdateOnboardingTemplateDto,
  ): Promise<OnboardingChecklistTemplateRecord> {
    const existing = await this.findOrThrow(templateId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    if (dto.isDefault) {
      await this.clearDefaultFlag(existing.companyId, templateId);
    }

    const row = await this.prisma.unscoped.onboardingChecklistTemplate.update({
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

  async addItem(
    templateId: string,
    dto: CreateOnboardingTemplateItemDto,
  ) {
    const template = await this.findOrThrow(templateId);
    await this.companyScope.assertCompanyInTenant(template.companyId);
    await this.assertDocumentTypeForCompany(
      template.companyId,
      dto.documentTypeId,
      dto.taskType,
    );

    const row = await this.prisma.unscoped.onboardingChecklistTemplateItem.create({
      data: {
        templateId,
        title: dto.title.trim(),
        description: dto.description?.trim() ?? null,
        category: dto.category,
        taskType: dto.taskType,
        documentTypeId: dto.documentTypeId ?? null,
        assetCategory: dto.assetCategory ?? null,
        policyDocumentUrl: dto.policyDocumentUrl?.trim() ?? null,
        assigneeLabel: dto.assigneeLabel?.trim() ?? null,
        dueDaysOffset: dto.dueDaysOffset ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isRequired: dto.isRequired ?? true,
      },
      include: { documentType: { select: { name: true } } },
    });

    return toTemplateItemRecord(row);
  }

  async updateItem(
    itemId: string,
    dto: UpdateOnboardingTemplateItemDto,
  ) {
    const existing = await this.findItemOrThrow(itemId);
    const template = await this.findOrThrow(existing.templateId);
    await this.companyScope.assertCompanyInTenant(template.companyId);

    if (dto.documentTypeId !== undefined || dto.taskType !== undefined) {
      await this.assertDocumentTypeForCompany(
        template.companyId,
        dto.documentTypeId ?? existing.documentTypeId ?? undefined,
        dto.taskType ?? existing.taskType,
      );
    }

    const row = await this.prisma.unscoped.onboardingChecklistTemplateItem.update({
      where: { id: itemId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() ?? null }
          : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.taskType !== undefined ? { taskType: dto.taskType } : {}),
        ...(dto.documentTypeId !== undefined
          ? { documentTypeId: dto.documentTypeId }
          : {}),
        ...(dto.assetCategory !== undefined
          ? { assetCategory: dto.assetCategory }
          : {}),
        ...(dto.policyDocumentUrl !== undefined
          ? { policyDocumentUrl: dto.policyDocumentUrl?.trim() ?? null }
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
      include: { documentType: { select: { name: true } } },
    });

    return toTemplateItemRecord(row);
  }

  async deleteItem(itemId: string): Promise<void> {
    const existing = await this.findItemOrThrow(itemId);
    const template = await this.findOrThrow(existing.templateId);
    await this.companyScope.assertCompanyInTenant(template.companyId);

    await this.prisma.unscoped.onboardingChecklistTemplateItem.delete({
      where: { id: itemId },
    });
  }

  async findDefaultTemplate(companyId: string) {
    return this.prisma.unscoped.onboardingChecklistTemplate.findFirst({
      where: { companyId, isDefault: true, isActive: true },
      include: TEMPLATE_INCLUDE,
    });
  }

  private async clearDefaultFlag(
    companyId: string,
    exceptTemplateId?: string,
  ): Promise<void> {
    await this.prisma.unscoped.onboardingChecklistTemplate.updateMany({
      where: {
        companyId,
        isDefault: true,
        ...(exceptTemplateId ? { id: { not: exceptTemplateId } } : {}),
      },
      data: { isDefault: false },
    });
  }

  private async assertDocumentTypeForCompany(
    companyId: string,
    documentTypeId: string | undefined,
    taskType: string,
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
    });
    if (!docType) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Document type not found',
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
