import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomFieldEntityType, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { validateCustomFieldValues } from '../custom-fields/field-validation.utils';
import { PrismaService } from '../database/prisma.service';
import { getTenantIdFromSession } from '../tenant/tenant.context';
import type {
  CreateEmployeeDocumentDto,
  UpdateEmployeeDocumentDto,
} from './dto/documents.dto';

@Injectable()
export class EmployeeDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listDocuments(employeeId: string) {
    await this.assertEmployee(employeeId);

    const rows = await this.prisma.unscoped.employeeDocument.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      include: {
        documentType: {
          select: {
            id: true,
            name: true,
            requiresVerification: true,
            tracksExpiry: true,
          },
        },
      },
    });

    return rows.map((row) => this.toResponse(row));
  }

  async getDocument(employeeId: string, documentId: string) {
    await this.assertEmployee(employeeId);
    const row = await this.getDocOrThrow(employeeId, documentId);
    return this.toResponse(row);
  }

  async createDocument(
    employeeId: string,
    dto: CreateEmployeeDocumentDto,
    user: AuthenticatedUser,
    meta?: { ipAddress?: string; device?: string },
  ) {
    const employee = await this.assertEmployee(employeeId);

    const docType = await this.prisma.unscoped.documentType.findFirst({
      where: { id: dto.documentTypeId, companyId: employee.companyId, isActive: true },
      include: {
        fieldDefinitions: {
          where: {
            entityType: CustomFieldEntityType.document,
            isActive: true,
          },
        },
      },
    });

    if (!docType) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Document type not found',
      });
    }

    const validatedFields = validateCustomFieldValues(
      docType.fieldDefinitions,
      dto.fields ?? {},
    );

    if (docType.tracksExpiry && !dto.expiryDate) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Expiry date is required for this document type',
      });
    }

    const created = await this.prisma.unscoped.employeeDocument.create({
      data: {
        employeeId,
        documentTypeId: dto.documentTypeId,
        fields: validatedFields as Prisma.InputJsonValue,
        fileKey: dto.fileKey?.trim() || null,
        expiryDate: dto.expiryDate ? this.parseDate(dto.expiryDate) : null,
      },
      include: {
        documentType: {
          select: {
            id: true,
            name: true,
            requiresVerification: true,
            tracksExpiry: true,
          },
        },
      },
    });

    await this.auditService.log({
      tenantId: employee.tenantId,
      userId: user.id,
      action: 'create',
      module: 'employee',
      recordId: created.id,
      newValue: this.toResponse(created) as Record<string, unknown>,
      ipAddress: meta?.ipAddress,
      device: meta?.device,
    });

    return this.toResponse(created);
  }

  async updateDocument(
    employeeId: string,
    documentId: string,
    dto: UpdateEmployeeDocumentDto,
    user: AuthenticatedUser,
    meta?: { ipAddress?: string; device?: string },
  ) {
    const employee = await this.assertEmployee(employeeId);
    const existing = await this.getDocOrThrow(employeeId, documentId);

    const docType = await this.prisma.unscoped.documentType.findFirst({
      where: { id: existing.documentTypeId },
      include: {
        fieldDefinitions: {
          where: {
            entityType: CustomFieldEntityType.document,
            isActive: true,
          },
        },
      },
    });

    if (!docType) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Document type not found',
      });
    }

    const mergedFields =
      dto.fields !== undefined
        ? validateCustomFieldValues(docType.fieldDefinitions, dto.fields)
        : (existing.fields as Record<string, unknown>);

    const updated = await this.prisma.unscoped.employeeDocument.update({
      where: { id: documentId },
      data: {
        ...(dto.fields !== undefined
          ? { fields: mergedFields as Prisma.InputJsonValue }
          : {}),
        ...(dto.fileKey !== undefined ? { fileKey: dto.fileKey?.trim() || null } : {}),
        ...(dto.expiryDate !== undefined
          ? {
              expiryDate: dto.expiryDate ? this.parseDate(dto.expiryDate) : null,
            }
          : {}),
        ...(dto.fields !== undefined || dto.fileKey !== undefined
          ? { verifiedAt: null }
          : {}),
      },
      include: {
        documentType: {
          select: {
            id: true,
            name: true,
            requiresVerification: true,
            tracksExpiry: true,
          },
        },
      },
    });

    await this.auditService.log({
      tenantId: employee.tenantId,
      userId: user.id,
      action: 'update',
      module: 'employee',
      recordId: documentId,
      oldValue: this.toResponse(existing) as Record<string, unknown>,
      newValue: this.toResponse(updated) as Record<string, unknown>,
      ipAddress: meta?.ipAddress,
      device: meta?.device,
    });

    return this.toResponse(updated);
  }

  async verifyDocument(
    employeeId: string,
    documentId: string,
    user: AuthenticatedUser,
    meta?: { ipAddress?: string; device?: string },
  ) {
    const employee = await this.assertEmployee(employeeId);
    const existing = await this.getDocOrThrow(employeeId, documentId);

    const updated = await this.prisma.unscoped.employeeDocument.update({
      where: { id: documentId },
      data: { verifiedAt: new Date() },
      include: {
        documentType: {
          select: {
            id: true,
            name: true,
            requiresVerification: true,
            tracksExpiry: true,
          },
        },
      },
    });

    await this.auditService.log({
      tenantId: employee.tenantId,
      userId: user.id,
      action: 'approve',
      module: 'employee',
      recordId: documentId,
      oldValue: { verifiedAt: existing.verifiedAt?.toISOString() ?? null },
      newValue: { verifiedAt: updated.verifiedAt?.toISOString() ?? null },
      ipAddress: meta?.ipAddress,
      device: meta?.device,
    });

    return this.toResponse(updated);
  }

  async deleteDocument(
    employeeId: string,
    documentId: string,
    user: AuthenticatedUser,
    meta?: { ipAddress?: string; device?: string },
  ): Promise<void> {
    const employee = await this.assertEmployee(employeeId);
    const existing = await this.getDocOrThrow(employeeId, documentId);

    await this.prisma.unscoped.employeeDocument.delete({
      where: { id: documentId },
    });

    await this.auditService.log({
      tenantId: employee.tenantId,
      userId: user.id,
      action: 'delete',
      module: 'employee',
      recordId: documentId,
      oldValue: this.toResponse(existing) as Record<string, unknown>,
      ipAddress: meta?.ipAddress,
      device: meta?.device,
    });
  }

  private async assertEmployee(employeeId: string) {
    const tenantId = getTenantIdFromSession();
    const row = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true, tenantId: true, companyId: true },
    });

    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    if (tenantId && row.tenantId !== tenantId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    return row;
  }

  private async getDocOrThrow(employeeId: string, documentId: string) {
    const row = await this.prisma.unscoped.employeeDocument.findFirst({
      where: { id: documentId, employeeId },
      include: {
        documentType: {
          select: {
            id: true,
            name: true,
            requiresVerification: true,
            tracksExpiry: true,
          },
        },
      },
    });

    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Document not found',
      });
    }

    return row;
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private toResponse(
    row: Prisma.EmployeeDocumentGetPayload<{
      include: {
        documentType: {
          select: {
            id: true;
            name: true;
            requiresVerification: true;
            tracksExpiry: true;
          };
        };
      };
    }>,
  ) {
    const verified = !!row.verifiedAt;
    let status: 'verified' | 'pending' | 'expiring_soon' = verified
      ? 'verified'
      : 'pending';

    if (row.expiryDate) {
      const expiry = row.expiryDate.getTime();
      const now = Date.now();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (expiry - now <= thirtyDays && expiry >= now) {
        status = 'expiring_soon';
      }
    }

    return {
      id: row.id,
      employeeId: row.employeeId,
      documentTypeId: row.documentTypeId,
      documentTypeName: row.documentType.name,
      fields: row.fields as Record<string, unknown>,
      fileKey: row.fileKey,
      expiryDate: row.expiryDate?.toISOString().slice(0, 10) ?? null,
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
      status,
      requiresVerification: row.documentType.requiresVerification,
      tracksExpiry: row.documentType.tracksExpiry,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
