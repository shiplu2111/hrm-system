import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStage,
  type CandidateSource,
  JobRequisitionStatus,
  OfferLetterStatus,
  Prisma,
  type JobApplication,
  type JobApplicationResume,
} from '@prisma/client';
import type {
  CandidateHirePrefill,
  JobApplicationRecord,
  JobApplicationResumeRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { EmployeesService } from '../employees/employees.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { PermissionsService } from '../rbac/permissions.service';
import { assertValidDocumentUpload } from '../storage/document-file.policy';
import { StorageService } from '../storage/storage.service';
import { ApplicationInterviewRoundsService } from './application-interview-rounds.service';
import { CandidatesService } from './candidates.service';
import type {
  CreateJobApplicationDto,
  HireApplicationDto,
  ListJobApplicationsQueryDto,
  UpdateApplicationStageDto,
} from './dto/recruitment.dto';
import { JobRequisitionsService } from './job-requisitions.service';
import { EmployeeOnboardingService } from '../onboarding/employee-onboarding.service';
import {
  addMonthsIsoDate,
  formatCandidateName,
  matchReportingToEmployee,
  nextEmployeeNumber,
  resolveApplicationDisplayStage,
  stageChangeBlockReason,
} from './recruitment.utils';

type ApplicationWithRelations = JobApplication & {
  candidate: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    source: CandidateSource;
    yearsExperience: number | null;
  };
  requisition: {
    title: string;
    referenceNumber: string;
    departmentId: string | null;
    designationId: string | null;
    employmentTypeId: string | null;
    locationId: string | null;
  };
  resume: JobApplicationResume | null;
};

@Injectable()
export class JobApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly candidatesService: CandidatesService,
    private readonly requisitionsService: JobRequisitionsService,
    private readonly storageService: StorageService,
    private readonly employeesService: EmployeesService,
    private readonly interviewRoundsService: ApplicationInterviewRoundsService,
    private readonly employeeOnboardingService: EmployeeOnboardingService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(
    companyId: string,
    query: ListJobApplicationsQueryDto,
  ): Promise<JobApplicationRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.jobApplication.findMany({
      where: {
        companyId,
        ...(query.requisitionId ? { requisitionId: query.requisitionId } : {}),
        ...(query.candidateId ? { candidateId: query.candidateId } : {}),
        ...(query.stage ? { stage: query.stage } : {}),
      },
      include: this.defaultInclude(),
      orderBy: [{ stageUpdatedAt: 'desc' }],
    });

    return rows.map((row) => this.toRecord(row));
  }

  async get(applicationId: string): Promise<JobApplicationRecord> {
    const row = await this.findOrThrow(applicationId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    return this.toRecord(row);
  }

  async create(
    companyId: string,
    dto: CreateJobApplicationDto,
    user: AuthenticatedUser,
  ): Promise<JobApplicationRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const candidate = await this.candidatesService.findOrThrow(dto.candidateId);
    const requisition = await this.requisitionsService.findOrThrow(
      dto.requisitionId,
    );

    if (candidate.companyId !== companyId || requisition.companyId !== companyId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Candidate and requisition must belong to the same company',
      });
    }

    if (requisition.status !== JobRequisitionStatus.open) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Applications can only be created for open requisitions',
      });
    }

    if (dto.stage === ApplicationStage.hired) {
      throw new BadRequestException({
        code: 'INVALID_STAGE_TRANSITION',
        message: 'New applications cannot start in the hired stage',
      });
    }

    const existing = await this.prisma.unscoped.jobApplication.findUnique({
      where: {
        candidateId_requisitionId: {
          candidateId: dto.candidateId,
          requisitionId: dto.requisitionId,
        },
      },
    });
    if (existing) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Candidate has already applied to this requisition',
      });
    }

    const row = await this.prisma.unscoped.jobApplication.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        candidateId: dto.candidateId,
        requisitionId: dto.requisitionId,
        postingId: dto.postingId,
        stage: dto.stage ?? ApplicationStage.applied,
        coverLetter: dto.coverLetter?.trim(),
        stageUpdatedAt: new Date(),
      },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: row.tenantId,
      userId: user.id,
      action: 'create',
      module: 'recruitment',
      recordId: row.id,
    });

    return this.toRecord(row);
  }

  async updateStage(
    applicationId: string,
    dto: UpdateApplicationStageDto,
    user: AuthenticatedUser,
  ): Promise<JobApplicationRecord> {
    const existing = await this.findOrThrow(applicationId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    const blockReason = stageChangeBlockReason(
      existing.stage,
      dto.stage,
      existing.hiredEmployeeId,
    );
    if (blockReason) {
      throw new BadRequestException({
        code: 'INVALID_STAGE_TRANSITION',
        message: blockReason,
      });
    }

    const stageChanged = existing.stage !== dto.stage;
    const row = await this.prisma.unscoped.jobApplication.update({
      where: { id: applicationId },
      data: {
        stage: dto.stage,
        rating: dto.rating ?? existing.rating,
        ...(stageChanged ? { stageUpdatedAt: new Date() } : {}),
      },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: row.tenantId,
      userId: user.id,
      action: 'update',
      module: 'recruitment',
      recordId: row.id,
      oldValue: { stage: existing.stage },
      newValue: {
        stage: dto.stage,
        ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
      },
    });

    if (stageChanged && dto.stage === ApplicationStage.interview) {
      await this.interviewRoundsService.ensureRounds(applicationId);
    }
    if (
      stageChanged &&
      (dto.stage === ApplicationStage.rejected ||
        dto.stage === ApplicationStage.withdrawn)
    ) {
      await this.interviewRoundsService.releaseScheduledRounds(applicationId);
    }

    return this.toRecord(row);
  }

  async uploadResume(
    applicationId: string,
    file: Express.Multer.File,
    user: AuthenticatedUser,
  ): Promise<JobApplicationResumeRecord> {
    assertValidDocumentUpload(file);
    const application = await this.findOrThrow(applicationId);
    await this.companyScope.assertCompanyInTenant(application.companyId);

    const storageKey = this.storageService.buildApplicationResumeKey(
      application.tenantId,
      applicationId,
      file.originalname,
    );

    await this.storageService.upload(storageKey, file.buffer, {
      contentType: file.mimetype,
      originalName: file.originalname,
      size: file.size,
    });

    if (application.resume) {
      await this.storageService.delete(application.resume.fileKey).catch(() => undefined);
    }

    const resume = await this.prisma.unscoped.jobApplicationResume.upsert({
      where: { applicationId },
      create: {
        applicationId,
        tenantId: application.tenantId,
        fileKey: storageKey,
        originalName: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
      },
      update: {
        fileKey: storageKey,
        originalName: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
        uploadedAt: new Date(),
      },
    });

    await this.auditService.log({
      tenantId: application.tenantId,
      userId: user.id,
      action: 'update',
      module: 'recruitment',
      recordId: applicationId,
      newValue: { resumeUploaded: true },
    });

    return this.toResumeRecord(resume);
  }

  /** Add Employee form defaults for the Convert to Employee flow (Stage 17.3). */
  async getHirePrefill(
    applicationId: string,
    user: AuthenticatedUser,
  ): Promise<CandidateHirePrefill> {
    await this.permissions.assertPermission(user, 'employee', 'create');
    const existing = await this.findOrThrow(applicationId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);
    const offer = await this.assertConvertible(existing);

    const hireDate = offer.startDate.toISOString().slice(0, 10);
    const manager = await this.matchManager(existing.companyId, offer.reportingTo);

    return {
      applicationId,
      companyId: existing.companyId,
      offerLetterId: offer.id,
      candidateName: formatCandidateName(
        existing.candidate.firstName,
        existing.candidate.lastName,
      ),
      firstName: existing.candidate.firstName,
      lastName: existing.candidate.lastName,
      email: existing.candidate.email,
      phone: existing.candidate.phone,
      employeeNumber: await this.generateEmployeeNumber(existing.tenantId),
      hireDate,
      jobTitle: offer.jobTitle,
      departmentId: offer.departmentId ?? existing.requisition.departmentId,
      designationId: offer.designationId ?? existing.requisition.designationId,
      employmentTypeId: offer.employmentTypeId ?? existing.requisition.employmentTypeId,
      workLocationId: offer.workLocationId ?? existing.requisition.locationId,
      managerId: manager?.id ?? null,
      reportingTo: offer.reportingTo,
      probationEndDate:
        offer.probationMonths != null && offer.probationMonths > 0
          ? addMonthsIsoDate(hireDate, offer.probationMonths)
          : null,
      annualSalary: offer.annualSalary != null ? Number(offer.annualSalary) : null,
      currency: offer.currency,
      signingBonus: offer.signingBonus != null ? Number(offer.signingBonus) : null,
    };
  }

  async hire(
    applicationId: string,
    dto: HireApplicationDto,
    user: AuthenticatedUser,
  ): Promise<JobApplicationRecord> {
    await this.permissions.assertPermission(user, 'employee', 'create');
    const existing = await this.findOrThrow(applicationId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);
    const offer = await this.assertConvertible(existing);

    const employeeNumber =
      dto.employeeNumber?.trim() ||
      (await this.generateEmployeeNumber(existing.tenantId));

    const hireDate =
      dto.hireDate ?? offer.startDate.toISOString().slice(0, 10);

    const probationEndDate =
      dto.probationEndDate !== undefined
        ? dto.probationEndDate || null
        : offer.probationMonths != null && offer.probationMonths > 0
          ? addMonthsIsoDate(hireDate, offer.probationMonths)
          : null;

    const managerId =
      dto.managerId !== undefined
        ? dto.managerId
        : ((await this.matchManager(existing.companyId, offer.reportingTo))?.id ?? null);

    const submittedInfo = dto.personalInfo ?? {};
    const submittedContact =
      submittedInfo.contact && typeof submittedInfo.contact === 'object'
        ? (submittedInfo.contact as Record<string, unknown>)
        : {};

    const employee = await this.employeesService.createEmployee({
      companyId: existing.companyId,
      employeeNumber,
      firstName: dto.firstName?.trim() || existing.candidate.firstName,
      lastName: dto.lastName?.trim() || existing.candidate.lastName,
      employmentStatus: dto.employmentStatus,
      personalInfo: {
        ...submittedInfo,
        contact: {
          email: existing.candidate.email,
          ...(existing.candidate.phone ? { phone: existing.candidate.phone } : {}),
          ...submittedContact,
        },
        hiredFromApplicationId: applicationId,
        offerLetterId: offer.id,
        ...(offer.annualSalary != null
          ? { annualSalary: Number(offer.annualSalary), currency: offer.currency }
          : {}),
        ...(offer.signingBonus != null
          ? { signingBonus: Number(offer.signingBonus) }
          : {}),
        ...(offer.equityNotes ? { equityNotes: offer.equityNotes } : {}),
      },
      departmentId:
        dto.departmentId !== undefined
          ? dto.departmentId
          : (offer.departmentId ?? existing.requisition.departmentId),
      designationId:
        dto.designationId !== undefined
          ? dto.designationId
          : (offer.designationId ?? existing.requisition.designationId),
      employmentTypeId:
        dto.employmentTypeId !== undefined
          ? dto.employmentTypeId
          : (offer.employmentTypeId ?? existing.requisition.employmentTypeId),
      workLocationId:
        dto.workLocationId !== undefined
          ? dto.workLocationId
          : (offer.workLocationId ?? existing.requisition.locationId),
      managerId,
      costCentreId: dto.costCentreId ?? null,
      hireDate,
      probationEndDate,
      confirmationDate: dto.confirmationDate || null,
    });

    const row = await this.prisma.unscoped.jobApplication.update({
      where: { id: applicationId },
      data: {
        stage: ApplicationStage.hired,
        hiredEmployeeId: employee.id,
        stageUpdatedAt: new Date(),
      },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: row.tenantId,
      userId: user.id,
      action: 'update',
      module: 'recruitment',
      recordId: row.id,
      newValue: { stage: 'hired', hiredEmployeeId: employee.id },
    });

    await this.employeeOnboardingService.startFromHire({
      tenantId: row.tenantId,
      companyId: row.companyId,
      employeeId: employee.id,
      hireDate,
      userId: user.id,
    });

    return this.toRecord(row);
  }

  async getResumeFileUrl(applicationId: string) {
    const application = await this.findOrThrow(applicationId);
    await this.companyScope.assertCompanyInTenant(application.companyId);

    if (!application.resume) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Resume not found for this application',
      });
    }

    const url = await this.storageService.getUrl(application.resume.fileKey, 900);
    return {
      url,
      expiresInSeconds: 900,
      fileKey: application.resume.fileKey,
    };
  }

  async findOrThrow(applicationId: string): Promise<ApplicationWithRelations> {
    const row = await this.prisma.unscoped.jobApplication.findUnique({
      where: { id: applicationId },
      include: this.defaultInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Job application not found',
      });
    }
    return row;
  }

  private defaultInclude(): Prisma.JobApplicationInclude {
    return {
      candidate: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          source: true,
          yearsExperience: true,
        },
      },
      requisition: {
        select: {
          title: true,
          referenceNumber: true,
          departmentId: true,
          designationId: true,
          employmentTypeId: true,
          locationId: true,
        },
      },
      resume: true,
    };
  }

  private toRecord(row: ApplicationWithRelations): JobApplicationRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      candidateId: row.candidateId,
      candidateName: formatCandidateName(
        row.candidate.firstName,
        row.candidate.lastName,
      ),
      candidateEmail: row.candidate.email,
      candidatePhone: row.candidate.phone,
      candidateSource: row.candidate.source,
      requisitionId: row.requisitionId,
      requisitionTitle: row.requisition.title,
      requisitionReference: row.requisition.referenceNumber,
      postingId: row.postingId,
      stage: row.stage,
      displayStage: resolveApplicationDisplayStage(row.stage),
      rating: row.rating != null ? Number(row.rating) : null,
      coverLetter: row.coverLetter,
      appliedAt: row.appliedAt.toISOString(),
      stageUpdatedAt: row.stageUpdatedAt.toISOString(),
      hiredEmployeeId: row.hiredEmployeeId,
      yearsExperience: row.candidate.yearsExperience,
      resume: row.resume ? this.toResumeRecord(row.resume) : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async generateEmployeeNumber(tenantId: string): Promise<string> {
    const rows = await this.prisma.unscoped.employee.findMany({
      where: { tenantId },
      select: { employeeNumber: true },
    });
    return nextEmployeeNumber(
      rows.map((r) => r.employeeNumber),
      rows.length + 1,
    );
  }

  private async matchManager(companyId: string, reportingTo: string | null) {
    if (!reportingTo?.trim()) return null;
    const employees = await this.prisma.unscoped.employee.findMany({
      where: { companyId, deletedAt: null, employmentStatus: { not: 'terminated' } },
      select: { id: true, firstName: true, lastName: true },
    });
    return matchReportingToEmployee(reportingTo, employees);
  }

  /** Validates a candidate can be converted and returns their accepted offer. */
  private async assertConvertible(existing: ApplicationWithRelations) {
    if (existing.hiredEmployeeId || existing.stage === ApplicationStage.hired) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This application has already been converted to an employee',
      });
    }
    if (existing.stage !== ApplicationStage.offer) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only candidates in the offer stage can be hired',
      });
    }
    const offer = await this.prisma.unscoped.offerLetter.findFirst({
      where: { applicationId: existing.id, status: OfferLetterStatus.accepted },
    });
    if (!offer) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'An accepted offer letter is required before converting to employee',
      });
    }
    return offer;
  }

  private toResumeRecord(resume: JobApplicationResume): JobApplicationResumeRecord {
    return {
      id: resume.id,
      applicationId: resume.applicationId,
      originalName: resume.originalName,
      contentType: resume.contentType,
      sizeBytes: resume.sizeBytes,
      uploadedAt: resume.uploadedAt.toISOString(),
    };
  }
}
