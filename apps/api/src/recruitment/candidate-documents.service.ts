import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CandidateDocumentRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { assertValidDocumentUpload } from '../storage/document-file.policy';
import { StorageService } from '../storage/storage.service';
import { CandidatesService } from './candidates.service';

const DOCUMENT_INCLUDE = {
  uploadedBy: {
    select: {
      email: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.CandidateDocumentInclude;

type DocumentRow = Prisma.CandidateDocumentGetPayload<{
  include: typeof DOCUMENT_INCLUDE;
}>;

const FILE_URL_TTL_SECONDS = 900;

@Injectable()
export class CandidateDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly candidatesService: CandidatesService,
    private readonly storageService: StorageService,
  ) {}

  async list(candidateId: string): Promise<CandidateDocumentRecord[]> {
    const candidate = await this.candidatesService.findOrThrow(candidateId);
    await this.companyScope.assertCompanyInTenant(candidate.companyId);

    const rows = await this.prisma.unscoped.candidateDocument.findMany({
      where: { candidateId },
      include: DOCUMENT_INCLUDE,
      orderBy: { uploadedAt: 'desc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async upload(
    candidateId: string,
    file: Express.Multer.File,
    label: string | undefined,
    user: AuthenticatedUser,
  ): Promise<CandidateDocumentRecord> {
    assertValidDocumentUpload(file);
    const candidate = await this.candidatesService.findOrThrow(candidateId);
    await this.companyScope.assertCompanyInTenant(candidate.companyId);

    const fileKey = this.storageService.buildCandidateDocumentKey(
      candidate.tenantId,
      candidateId,
      file.originalname,
    );
    await this.storageService.upload(fileKey, file.buffer, {
      contentType: file.mimetype,
      originalName: file.originalname,
      size: file.size,
    });

    let row: DocumentRow;
    try {
      row = await this.prisma.unscoped.candidateDocument.create({
        data: {
          tenantId: candidate.tenantId,
          candidateId,
          label: label?.trim() || file.originalname,
          fileKey,
          originalName: file.originalname,
          contentType: file.mimetype,
          sizeBytes: file.size,
          uploadedByUserId: user.id,
        },
        include: DOCUMENT_INCLUDE,
      });
    } catch (error) {
      await this.storageService.delete(fileKey).catch(() => undefined);
      throw error;
    }

    await this.auditService.log({
      tenantId: candidate.tenantId,
      userId: user.id,
      action: 'create',
      module: 'recruitment',
      recordId: candidateId,
      newValue: { documentId: row.id, label: row.label },
    });

    return this.toRecord(row);
  }

  async getFileUrl(documentId: string) {
    const doc = await this.findOrThrow(documentId);
    const url = await this.storageService.getUrl(doc.fileKey, FILE_URL_TTL_SECONDS);
    return {
      url,
      expiresInSeconds: FILE_URL_TTL_SECONDS,
      originalName: doc.originalName,
    };
  }

  async remove(documentId: string, user: AuthenticatedUser): Promise<void> {
    const doc = await this.findOrThrow(documentId);
    await this.prisma.unscoped.candidateDocument.delete({ where: { id: documentId } });
    await this.storageService.delete(doc.fileKey).catch(() => undefined);

    await this.auditService.log({
      tenantId: doc.tenantId,
      userId: user.id,
      action: 'delete',
      module: 'recruitment',
      recordId: doc.candidateId,
      oldValue: { documentId, label: doc.label, originalName: doc.originalName },
    });
  }

  private async findOrThrow(documentId: string) {
    const doc = await this.prisma.unscoped.candidateDocument.findUnique({
      where: { id: documentId },
      include: { candidate: { select: { companyId: true } } },
    });
    if (!doc) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Document not found' });
    }
    await this.companyScope.assertCompanyInTenant(doc.candidate.companyId);
    return doc;
  }

  private toRecord(row: DocumentRow): CandidateDocumentRecord {
    const employee = row.uploadedBy?.employee;
    return {
      id: row.id,
      candidateId: row.candidateId,
      label: row.label,
      originalName: row.originalName,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
      uploadedByName: employee
        ? `${employee.firstName} ${employee.lastName}`.trim()
        : (row.uploadedBy?.email ?? null),
      uploadedAt: row.uploadedAt.toISOString(),
    };
  }
}
