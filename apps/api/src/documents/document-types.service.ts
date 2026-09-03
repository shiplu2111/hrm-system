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
  CreateDocumentTypeDto,
  DocumentTypeFieldDto,
  UpdateDocumentTypeDto,
} from '../documents/dto/documents.dto';

@Injectable()
export class DocumentTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async listDocumentTypes(companyId: string) {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.documentType.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      include: {
        fieldDefinitions: {
          where: { entityType: CustomFieldEntityType.document },
          orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
        },
        _count: { select: { employeeDocuments: true } },
      },
    });

    return rows.map((row) => this.toResponse(row));
  }

  async getDocumentType(companyId: string, id: string) {
    await this.companyScope.assertCompanyInTenant(companyId);
    const row = await this.getTypeOrThrow(companyId, id);
    return this.toResponse(row);
  }

  async createDocumentType(
    companyId: string,
    dto: CreateDocumentTypeDto,
    user: AuthenticatedUser,
    meta?: { ipAddress?: string; device?: string },
  ) {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    try {
      const created = await this.prisma.unscoped.$transaction(async (tx) => {
        const docType = await tx.documentType.create({
          data: {
            companyId,
            name: dto.name.trim(),
            description: dto.description?.trim() ?? null,
            scope: dto.scope ?? 'employee',
            requiresVerification: dto.requiresVerification ?? false,
            tracksExpiry: dto.tracksExpiry ?? false,
          },
        });

        if (dto.fields?.length) {
          await this.createFieldRows(tx, companyId, docType.id, dto.fields);
        }

        return tx.documentType.findUniqueOrThrow({
          where: { id: docType.id },
          include: {
            fieldDefinitions: {
              where: { entityType: CustomFieldEntityType.document },
              orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
            },
            _count: { select: { employeeDocuments: true } },
          },
        });
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
          message: 'Document type name already exists',
        });
      }
      throw error;
    }
  }

  async updateDocumentType(
    companyId: string,
    id: string,
    dto: UpdateDocumentTypeDto,
    user: AuthenticatedUser,
    meta?: { ipAddress?: string; device?: string },
  ) {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const existing = await this.getTypeOrThrow(companyId, id);

    try {
      const updated = await this.prisma.unscoped.documentType.update({
        where: { id },
        data: {
          ...(dto.name != null ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() ?? null }
            : {}),
          ...(dto.scope != null ? { scope: dto.scope } : {}),
          ...(dto.requiresVerification !== undefined
            ? { requiresVerification: dto.requiresVerification }
            : {}),
          ...(dto.tracksExpiry !== undefined
            ? { tracksExpiry: dto.tracksExpiry }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        include: {
          fieldDefinitions: {
            where: { entityType: CustomFieldEntityType.document },
            orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
          },
          _count: { select: { employeeDocuments: true } },
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Document type name already exists',
        });
      }
      throw error;
    }
  }

  async replaceDocumentTypeFields(
    companyId: string,
    id: string,
    fields: DocumentTypeFieldDto[],
    user: AuthenticatedUser,
    meta?: { ipAddress?: string; device?: string },
  ) {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const existing = await this.getTypeOrThrow(companyId, id);

    const updated = await this.prisma.unscoped.$transaction(async (tx) => {
      await tx.customFieldDefinition.deleteMany({
        where: {
          companyId,
          entityType: CustomFieldEntityType.document,
          contextId: id,
        },
      });

      if (fields.length) {
        await this.createFieldRows(tx, companyId, id, fields);
      }

      return tx.documentType.findUniqueOrThrow({
        where: { id },
        include: {
          fieldDefinitions: {
            where: { entityType: CustomFieldEntityType.document },
            orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
          },
          _count: { select: { employeeDocuments: true } },
        },
      });
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'update',
      module: 'settings',
      recordId: id,
      oldValue: {
        fields: existing.fieldDefinitions.map((f) => f.fieldKey),
      },
      newValue: {
        fields: updated.fieldDefinitions.map((f) => f.fieldKey),
      },
      ipAddress: meta?.ipAddress,
      device: meta?.device,
    });

    return this.toResponse(updated);
  }

  async deleteDocumentType(
    companyId: string,
    id: string,
    user: AuthenticatedUser,
    meta?: { ipAddress?: string; device?: string },
  ): Promise<void> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const existing = await this.getTypeOrThrow(companyId, id);

    const inUse = await this.prisma.unscoped.employeeDocument.count({
      where: { documentTypeId: id },
    });
    if (inUse > 0) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Cannot delete document type with uploaded documents',
      });
    }

    await this.prisma.unscoped.documentType.delete({ where: { id } });

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

  private async createFieldRows(
    tx: Prisma.TransactionClient,
    companyId: string,
    documentTypeId: string,
    fields: DocumentTypeFieldDto[],
  ): Promise<void> {
    const usedKeys = new Set<string>();

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      let fieldKey = field.fieldKey?.trim() || slugifyFieldKey(field.label);
      while (usedKeys.has(fieldKey)) {
        fieldKey = `${fieldKey}_${i + 1}`;
      }
      usedKeys.add(fieldKey);

      await tx.customFieldDefinition.create({
        data: {
          companyId,
          entityType: CustomFieldEntityType.document,
          contextId: documentTypeId,
          fieldKey,
          label: field.label.trim(),
          fieldType: field.fieldType,
          required: field.required ?? false,
          options: parseOptionsInput(field.options) as Prisma.InputJsonValue,
          sortOrder: field.sortOrder ?? i,
        },
      });
    }
  }

  private async getTypeOrThrow(companyId: string, id: string) {
    const row = await this.prisma.unscoped.documentType.findFirst({
      where: { id, companyId },
      include: {
        fieldDefinitions: {
          where: { entityType: CustomFieldEntityType.document },
          orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
        },
        _count: { select: { employeeDocuments: true } },
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Document type not found',
      });
    }
    return row;
  }

  private toResponse(
    row: Prisma.DocumentTypeGetPayload<{
      include: {
        fieldDefinitions: true;
        _count: { select: { employeeDocuments: true } };
      };
    }>,
  ) {
    return {
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      description: row.description,
      scope: row.scope,
      requiresVerification: row.requiresVerification,
      tracksExpiry: row.tracksExpiry,
      isActive: row.isActive,
      documentCount: row._count.employeeDocuments,
      fields: row.fieldDefinitions.map((f) => ({
        id: f.id,
        fieldKey: f.fieldKey,
        label: f.label,
        fieldType: f.fieldType,
        required: f.required,
        options: Array.isArray(f.options) ? f.options : [],
        sortOrder: f.sortOrder,
        isActive: f.isActive,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
