import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomFieldEntityType, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  parseOptionsInput,
  slugifyFieldKey,
} from '../custom-fields/field-validation.utils';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateCustomFieldDto,
  UpdateCustomFieldDto,
} from '../documents/dto/documents.dto';

@Injectable()
export class CustomFieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async listFields(
    companyId: string,
    entityType?: CustomFieldEntityType,
    contextId?: string | null,
  ) {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.customFieldDefinition.findMany({
      where: {
        companyId,
        ...(entityType ? { entityType } : {}),
        ...(contextId !== undefined ? { contextId } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });

    return rows.map((row) => this.toResponse(row));
  }

  async createField(
    companyId: string,
    dto: CreateCustomFieldDto,
    user: AuthenticatedUser,
    meta?: { ipAddress?: string; device?: string },
  ) {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    await this.assertContext(companyId, dto.entityType, dto.contextId);

    const fieldKey = dto.fieldKey?.trim() || slugifyFieldKey(dto.label);
    if (!fieldKey) {
      throw new ConflictException({
        code: 'VALIDATION_ERROR',
        message: 'Field key could not be generated from label',
      });
    }

    try {
      const created = await this.prisma.unscoped.customFieldDefinition.create({
        data: {
          companyId,
          entityType: dto.entityType,
          contextId: dto.contextId ?? null,
          fieldKey,
          label: dto.label.trim(),
          fieldType: dto.fieldType,
          required: dto.required ?? false,
          options: parseOptionsInput(dto.options) as Prisma.InputJsonValue,
          sortOrder: dto.sortOrder ?? 0,
        },
      });

      await this.auditService.log({
        tenantId: company.tenantId,
        userId: user.id,
        action: 'create',
        module: 'settings',
        recordId: created.id,
        newValue: this.toResponse(created) as Record<string, unknown>,
        ipAddress: meta?.ipAddress,
        device: meta?.device,
      });

      return this.toResponse(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'A field with this key already exists for this entity',
        });
      }
      throw error;
    }
  }

  async updateField(
    companyId: string,
    id: string,
    dto: UpdateCustomFieldDto,
    user: AuthenticatedUser,
    meta?: { ipAddress?: string; device?: string },
  ) {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const existing = await this.getFieldOrThrow(companyId, id);

    const updated = await this.prisma.unscoped.customFieldDefinition.update({
      where: { id },
      data: {
        ...(dto.label != null ? { label: dto.label.trim() } : {}),
        ...(dto.fieldType != null ? { fieldType: dto.fieldType } : {}),
        ...(dto.required !== undefined ? { required: dto.required } : {}),
        ...(dto.options !== undefined
          ? { options: parseOptionsInput(dto.options) as Prisma.InputJsonValue }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'update',
      module: 'settings',
      recordId: id,
      oldValue: this.toResponse(existing) as Record<string, unknown>,
      newValue: this.toResponse(updated) as Record<string, unknown>,
      ipAddress: meta?.ipAddress,
      device: meta?.device,
    });

    return this.toResponse(updated);
  }

  async deleteField(
    companyId: string,
    id: string,
    user: AuthenticatedUser,
    meta?: { ipAddress?: string; device?: string },
  ): Promise<void> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const existing = await this.getFieldOrThrow(companyId, id);

    await this.prisma.unscoped.customFieldDefinition.delete({ where: { id } });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'delete',
      module: 'settings',
      recordId: id,
      oldValue: this.toResponse(existing) as Record<string, unknown>,
      ipAddress: meta?.ipAddress,
      device: meta?.device,
    });
  }

  private async getFieldOrThrow(companyId: string, id: string) {
    const row = await this.prisma.unscoped.customFieldDefinition.findFirst({
      where: { id, companyId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Custom field not found',
      });
    }
    return row;
  }

  private async assertContext(
    companyId: string,
    entityType: CustomFieldEntityType,
    contextId?: string | null,
  ): Promise<void> {
    if (entityType === CustomFieldEntityType.document) {
      if (!contextId) {
        throw new ConflictException({
          code: 'VALIDATION_ERROR',
          message: 'Document fields require contextId (document type id)',
        });
      }
      const docType = await this.prisma.unscoped.documentType.findFirst({
        where: { id: contextId, companyId },
      });
      if (!docType) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Document type not found',
        });
      }
      return;
    }

    if (contextId) {
      throw new ConflictException({
        code: 'VALIDATION_ERROR',
        message: 'contextId is only valid for document entity fields',
      });
    }
  }

  private toResponse(
    row: Prisma.CustomFieldDefinitionGetPayload<object>,
  ) {
    return {
      id: row.id,
      companyId: row.companyId,
      entityType: row.entityType,
      contextId: row.contextId,
      fieldKey: row.fieldKey,
      label: row.label,
      fieldType: row.fieldType,
      required: row.required,
      options: Array.isArray(row.options) ? row.options : [],
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
