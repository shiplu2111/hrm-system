import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStage,
  OfferLetterStatus,
  Prisma,
} from '@prisma/client';
import type { OfferLetterRecord, WorkflowInstanceRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { StorageService } from '../storage/storage.service';
import type {
  OfferLetterActionDto,
  UpsertOfferLetterDto,
} from './dto/recruitment.dto';
import { renderOfferLetterPdf } from './offer-letter-pdf.generator';
import { OfferLetterWorkflowService } from './offer-letter-workflow.service';
import {
  formatOfferMoney,
  formatCandidateName,
  resolveOfferLetterDisplayStatus,
  resolveOfferTemplateLabel,
} from './recruitment.utils';

const OFFER_LETTER_INCLUDE = {
  application: {
    include: {
      candidate: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
  },
  department: { select: { name: true } },
  designation: { select: { name: true } },
  employmentType: { select: { name: true } },
  workLocation: { select: { name: true } },
  company: { select: { name: true } },
} satisfies Prisma.OfferLetterInclude;

type OfferWithRelations = Prisma.OfferLetterGetPayload<{
  include: typeof OFFER_LETTER_INCLUDE;
}>;

@Injectable()
export class OfferLettersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly storageService: StorageService,
    private readonly offerWorkflow: OfferLetterWorkflowService,
  ) {}

  async getOrCreateForApplication(
    applicationId: string,
    user: AuthenticatedUser,
  ): Promise<OfferLetterRecord> {
    const application = await this.findApplicationOrThrow(applicationId);
    await this.companyScope.assertCompanyInTenant(application.companyId);

    const existing = await this.prisma.unscoped.offerLetter.findUnique({
      where: { applicationId },
      include: OFFER_LETTER_INCLUDE,
    });
    if (existing) {
      const workflow = await this.offerWorkflow.findForOfferLetter(existing.id);
      return this.toRecord(existing, workflow);
    }

    const requisition = await this.prisma.unscoped.jobRequisition.findUnique({
      where: { id: application.requisitionId },
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        employmentType: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    });
    if (!requisition) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Requisition not found for application',
      });
    }

    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() + 30);
    const expiryDate = new Date(startDate);
    expiryDate.setUTCDate(expiryDate.getUTCDate() + 14);

    const row = await this.prisma.unscoped.offerLetter.create({
      data: {
        tenantId: application.tenantId,
        companyId: application.companyId,
        applicationId,
        jobTitle: requisition.title,
        departmentId: requisition.departmentId,
        designationId: requisition.designationId,
        employmentTypeId: requisition.employmentTypeId,
        workLocationId: requisition.locationId,
        startDate,
        expiryDate,
        currency: 'AUD',
        status: OfferLetterStatus.draft,
      },
      include: OFFER_LETTER_INCLUDE,
    });

    await this.auditService.log({
      tenantId: row.tenantId,
      userId: user.id,
      action: 'create',
      module: 'recruitment',
      recordId: row.id,
      newValue: { applicationId },
    });

    return this.toRecord(row, null);
  }

  async update(
    offerLetterId: string,
    dto: UpsertOfferLetterDto,
    user: AuthenticatedUser,
  ): Promise<OfferLetterRecord> {
    const existing = await this.findOrThrow(offerLetterId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    if (existing.status !== OfferLetterStatus.draft) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only draft offer letters can be edited',
      });
    }

    await this.validateOrgRefs(existing.companyId, dto);

    const row = await this.prisma.unscoped.offerLetter.update({
      where: { id: offerLetterId },
      data: {
        ...(dto.template !== undefined ? { template: dto.template } : {}),
        ...(dto.jobTitle !== undefined ? { jobTitle: dto.jobTitle.trim() } : {}),
        ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
        ...(dto.designationId !== undefined ? { designationId: dto.designationId } : {}),
        ...(dto.employmentTypeId !== undefined
          ? { employmentTypeId: dto.employmentTypeId }
          : {}),
        ...(dto.workLocationId !== undefined
          ? { workLocationId: dto.workLocationId }
          : {}),
        ...(dto.annualSalary !== undefined ? { annualSalary: dto.annualSalary } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: new Date(dto.startDate) }
          : {}),
        ...(dto.reportingTo !== undefined
          ? { reportingTo: dto.reportingTo?.trim() ?? null }
          : {}),
        ...(dto.signingBonus !== undefined ? { signingBonus: dto.signingBonus } : {}),
        ...(dto.equityNotes !== undefined
          ? { equityNotes: dto.equityNotes?.trim() ?? null }
          : {}),
        ...(dto.probationMonths !== undefined
          ? { probationMonths: dto.probationMonths }
          : {}),
        ...(dto.expiryDate !== undefined
          ? { expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null }
          : {}),
        ...(dto.additionalTerms !== undefined
          ? { additionalTerms: dto.additionalTerms?.trim() ?? null }
          : {}),
      },
      include: OFFER_LETTER_INCLUDE,
    });

    await this.auditService.log({
      tenantId: row.tenantId,
      userId: user.id,
      action: 'update',
      module: 'recruitment',
      recordId: row.id,
    });

    const workflow = await this.offerWorkflow.findForOfferLetter(offerLetterId);
    return this.toRecord(row, workflow);
  }

  async generatePdf(
    offerLetterId: string,
    user: AuthenticatedUser,
  ): Promise<OfferLetterRecord> {
    const row = await this.findOrThrow(offerLetterId);
    await this.companyScope.assertCompanyInTenant(row.companyId);

    if (
      row.status !== OfferLetterStatus.draft &&
      row.status !== OfferLetterStatus.approved &&
      row.status !== OfferLetterStatus.sent &&
      row.status !== OfferLetterStatus.accepted
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'PDF can only be generated for draft or approved offers',
      });
    }

    const pdfBuffer = await this.buildPdfBuffer(row);
    const candidateName = formatCandidateName(
      row.application.candidate.firstName,
      row.application.candidate.lastName,
    );
    const filename = `offer-${candidateName.replace(/\s+/g, '-').toLowerCase()}.pdf`;

    if (row.fileKey) {
      await this.storageService.delete(row.fileKey).catch(() => undefined);
    }

    const fileKey = this.storageService.buildOfferLetterKey(
      row.tenantId,
      row.id,
      filename,
    );
    await this.storageService.upload(fileKey, pdfBuffer, {
      contentType: 'application/pdf',
      originalName: filename,
      size: pdfBuffer.length,
    });

    const updated = await this.prisma.unscoped.offerLetter.update({
      where: { id: offerLetterId },
      data: { fileKey, generatedAt: new Date() },
      include: OFFER_LETTER_INCLUDE,
    });

    await this.auditService.log({
      tenantId: updated.tenantId,
      userId: user.id,
      action: 'update',
      module: 'recruitment',
      recordId: updated.id,
      newValue: { pdfGenerated: true },
    });

    const workflow = await this.offerWorkflow.findForOfferLetter(offerLetterId);
    return this.toRecord(updated, workflow);
  }

  async submit(offerLetterId: string, user: AuthenticatedUser): Promise<OfferLetterRecord> {
    const row = await this.findOrThrow(offerLetterId);
    await this.companyScope.assertCompanyInTenant(row.companyId);

    if (row.status !== OfferLetterStatus.draft) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only draft offers can be submitted for approval',
      });
    }

    const requesterEmployeeId = user.employeeId;
    if (!requesterEmployeeId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'An employee profile is required to submit an offer letter',
      });
    }

    await this.generatePdf(offerLetterId, user);

    await this.offerWorkflow.startForOfferLetter({
      companyId: row.companyId,
      tenantId: row.tenantId,
      offerLetterId: row.id,
      requesterEmployeeId,
      requesterUserId: user.id,
    });

    const updated = await this.prisma.unscoped.offerLetter.update({
      where: { id: offerLetterId },
      data: { status: OfferLetterStatus.pending_approval },
      include: OFFER_LETTER_INCLUDE,
    });

    const workflow = await this.offerWorkflow.findForOfferLetter(offerLetterId);
    return this.toRecord(updated, workflow);
  }

  async approve(
    offerLetterId: string,
    user: AuthenticatedUser,
    dto: OfferLetterActionDto,
  ): Promise<OfferLetterRecord> {
    const row = await this.findOrThrow(offerLetterId);
    await this.companyScope.assertCompanyInTenant(row.companyId);

    if (row.status !== OfferLetterStatus.pending_approval) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Offer letter is not pending approval',
      });
    }

    const requesterEmployeeId = user.employeeId;
    if (!requesterEmployeeId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'An employee profile is required',
      });
    }

    const transition = await this.offerWorkflow.approve({
      offerLetterId: row.id,
      user,
      comment: dto.comment,
      audit: {
        tenantId: row.tenantId,
        module: 'recruitment',
        recordId: row.id,
      },
      companyId: row.companyId,
      tenantId: row.tenantId,
      requesterEmployeeId,
      requesterUserId: user.id,
    });

    let updated = row;
    if (transition.fullyApproved) {
      await this.generatePdf(offerLetterId, user);
      updated = await this.prisma.unscoped.offerLetter.update({
        where: { id: offerLetterId },
        data: { status: OfferLetterStatus.approved },
        include: OFFER_LETTER_INCLUDE,
      });
      await this.ensureApplicationOfferStage(row.applicationId);
    } else if (transition.rejected) {
      updated = await this.prisma.unscoped.offerLetter.update({
        where: { id: offerLetterId },
        data: { status: OfferLetterStatus.cancelled },
        include: OFFER_LETTER_INCLUDE,
      });
    }

    return this.toRecord(updated, transition.instance);
  }

  async reject(
    offerLetterId: string,
    user: AuthenticatedUser,
    dto: OfferLetterActionDto,
  ): Promise<OfferLetterRecord> {
    const row = await this.findOrThrow(offerLetterId);
    await this.companyScope.assertCompanyInTenant(row.companyId);

    if (row.status !== OfferLetterStatus.pending_approval) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Offer letter is not pending approval',
      });
    }

    const requesterEmployeeId = user.employeeId;
    if (!requesterEmployeeId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'An employee profile is required',
      });
    }

    const transition = await this.offerWorkflow.reject({
      offerLetterId: row.id,
      user,
      comment: dto.comment,
      audit: {
        tenantId: row.tenantId,
        module: 'recruitment',
        recordId: row.id,
      },
      companyId: row.companyId,
      tenantId: row.tenantId,
      requesterEmployeeId,
      requesterUserId: user.id,
    });

    const updated = await this.prisma.unscoped.offerLetter.update({
      where: { id: offerLetterId },
      data: { status: OfferLetterStatus.cancelled },
      include: OFFER_LETTER_INCLUDE,
    });

    return this.toRecord(updated, transition.instance);
  }

  async send(offerLetterId: string, user: AuthenticatedUser): Promise<OfferLetterRecord> {
    const row = await this.findOrThrow(offerLetterId);
    await this.companyScope.assertCompanyInTenant(row.companyId);

    if (
      row.status !== OfferLetterStatus.approved &&
      row.status !== OfferLetterStatus.sent
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Offer must be approved before it can be sent',
      });
    }

    if (!row.fileKey) {
      await this.generatePdf(offerLetterId, user);
    }

    const updated = await this.prisma.unscoped.offerLetter.update({
      where: { id: offerLetterId },
      data: {
        status: OfferLetterStatus.sent,
        sentAt: new Date(),
      },
      include: OFFER_LETTER_INCLUDE,
    });

    await this.ensureApplicationOfferStage(row.applicationId);

    await this.auditService.log({
      tenantId: updated.tenantId,
      userId: user.id,
      action: 'update',
      module: 'recruitment',
      recordId: updated.id,
      newValue: { status: 'sent' },
    });

    const workflow = await this.offerWorkflow.findForOfferLetter(offerLetterId);
    return this.toRecord(updated, workflow);
  }

  async accept(offerLetterId: string, user: AuthenticatedUser): Promise<OfferLetterRecord> {
    const row = await this.findOrThrow(offerLetterId);
    await this.companyScope.assertCompanyInTenant(row.companyId);

    if (
      row.status !== OfferLetterStatus.sent &&
      row.status !== OfferLetterStatus.approved
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only sent or approved offers can be marked as accepted',
      });
    }

    const updated = await this.prisma.unscoped.offerLetter.update({
      where: { id: offerLetterId },
      data: {
        status: OfferLetterStatus.accepted,
        acceptedAt: new Date(),
      },
      include: OFFER_LETTER_INCLUDE,
    });

    await this.prisma.unscoped.jobApplication.update({
      where: { id: row.applicationId },
      data: {
        stage: ApplicationStage.offer,
        stageUpdatedAt: new Date(),
      },
    });

    await this.auditService.log({
      tenantId: updated.tenantId,
      userId: user.id,
      action: 'update',
      module: 'recruitment',
      recordId: updated.id,
      newValue: { status: 'accepted' },
    });

    const workflow = await this.offerWorkflow.findForOfferLetter(offerLetterId);
    return this.toRecord(updated, workflow);
  }

  async downloadFile(
    offerLetterId: string,
    user: AuthenticatedUser,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const row = await this.findOrThrow(offerLetterId);
    await this.companyScope.assertCompanyInTenant(row.companyId);

    if (!row.fileKey) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Offer letter PDF has not been generated yet',
      });
    }

    const { buffer, meta } = await this.storageService.read(row.fileKey);
    const candidateName = formatCandidateName(
      row.application.candidate.firstName,
      row.application.candidate.lastName,
    );
    return {
      buffer,
      contentType: meta.contentType ?? 'application/pdf',
      filename: meta.originalName ?? `offer-${candidateName}.pdf`,
    };
  }

  async findAcceptedForApplication(applicationId: string) {
    return this.prisma.unscoped.offerLetter.findFirst({
      where: {
        applicationId,
        status: OfferLetterStatus.accepted,
      },
    });
  }

  private async ensureApplicationOfferStage(applicationId: string) {
    const application = await this.prisma.unscoped.jobApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) return;
    if (
      application.stage === ApplicationStage.offer ||
      application.stage === ApplicationStage.hired
    ) {
      return;
    }
    await this.prisma.unscoped.jobApplication.update({
      where: { id: applicationId },
      data: {
        stage: ApplicationStage.offer,
        stageUpdatedAt: new Date(),
      },
    });
  }

  private async buildPdfBuffer(row: OfferWithRelations): Promise<Buffer> {
    const candidateName = formatCandidateName(
      row.application.candidate.firstName,
      row.application.candidate.lastName,
    );

    return renderOfferLetterPdf({
      companyName: row.company.name,
      candidateName,
      candidateEmail: row.application.candidate.email,
      letterDate: new Date().toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      jobTitle: row.jobTitle,
      department: row.department?.name,
      employmentType: row.employmentType?.name,
      reportingTo: row.reportingTo ?? undefined,
      startDate: row.startDate.toISOString().slice(0, 10),
      workLocation: row.workLocation?.name,
      annualSalary: formatOfferMoney(
        row.annualSalary != null ? Number(row.annualSalary) : null,
        row.currency,
      ),
      signingBonus: formatOfferMoney(
        row.signingBonus != null ? Number(row.signingBonus) : null,
        row.currency,
      ),
      equityNotes: row.equityNotes ?? undefined,
      probationLabel:
        row.probationMonths != null
          ? `${row.probationMonths} month${row.probationMonths === 1 ? '' : 's'}`
          : undefined,
      expiryDate: row.expiryDate?.toISOString().slice(0, 10),
      additionalTerms: row.additionalTerms ?? undefined,
      templateLabel: resolveOfferTemplateLabel(row.template),
    });
  }

  private async validateOrgRefs(
    companyId: string,
    dto: {
      departmentId?: string | null;
      designationId?: string | null;
      employmentTypeId?: string | null;
      workLocationId?: string | null;
    },
  ) {
    if (dto.departmentId) {
      await this.prisma.unscoped.department.findFirstOrThrow({
        where: { id: dto.departmentId, companyId },
      });
    }
    if (dto.designationId) {
      await this.prisma.unscoped.designation.findFirstOrThrow({
        where: { id: dto.designationId, companyId },
      });
    }
    if (dto.employmentTypeId) {
      await this.prisma.unscoped.employmentType.findFirstOrThrow({
        where: { id: dto.employmentTypeId, companyId },
      });
    }
    if (dto.workLocationId) {
      await this.prisma.unscoped.location.findFirstOrThrow({
        where: { id: dto.workLocationId, companyId },
      });
    }
  }

  async findOrThrow(offerLetterId: string): Promise<OfferWithRelations> {
    const row = await this.prisma.unscoped.offerLetter.findUnique({
      where: { id: offerLetterId },
      include: OFFER_LETTER_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Offer letter not found',
      });
    }
    return row;
  }

  private async findApplicationOrThrow(applicationId: string) {
    const row = await this.prisma.unscoped.jobApplication.findUnique({
      where: { id: applicationId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Job application not found',
      });
    }
    return row;
  }

  private toRecord(
    row: OfferWithRelations,
    workflow: WorkflowInstanceRecord | null,
  ): OfferLetterRecord {
    const candidateName = formatCandidateName(
      row.application.candidate.firstName,
      row.application.candidate.lastName,
    );
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      applicationId: row.applicationId,
      candidateName,
      status: row.status,
      displayStatus: resolveOfferLetterDisplayStatus(row.status, workflow),
      template: row.template,
      templateLabel: resolveOfferTemplateLabel(row.template),
      jobTitle: row.jobTitle,
      departmentId: row.departmentId,
      departmentName: row.department?.name,
      designationId: row.designationId,
      designationName: row.designation?.name,
      employmentTypeId: row.employmentTypeId,
      employmentTypeName: row.employmentType?.name,
      workLocationId: row.workLocationId,
      workLocationName: row.workLocation?.name,
      annualSalary: row.annualSalary != null ? Number(row.annualSalary) : null,
      currency: row.currency,
      startDate: row.startDate.toISOString().slice(0, 10),
      reportingTo: row.reportingTo,
      signingBonus: row.signingBonus != null ? Number(row.signingBonus) : null,
      equityNotes: row.equityNotes,
      probationMonths: row.probationMonths,
      expiryDate: row.expiryDate?.toISOString().slice(0, 10) ?? null,
      additionalTerms: row.additionalTerms,
      fileKey: row.fileKey,
      generatedAt: row.generatedAt?.toISOString() ?? null,
      sentAt: row.sentAt?.toISOString() ?? null,
      acceptedAt: row.acceptedAt?.toISOString() ?? null,
      declinedAt: row.declinedAt?.toISOString() ?? null,
      downloadUrl: row.fileKey ? `/offer-letters/${row.id}/download` : undefined,
      workflow,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
