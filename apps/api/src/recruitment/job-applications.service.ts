import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStage,
  JobRequisitionStatus,
  OfferLetterStatus,
  Prisma,
  type JobApplication,
  type JobApplicationResume,
} from '@prisma/client';
import type {
  JobApplicationRecord,
  JobApplicationResumeRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { EmployeesService } from '../employees/employees.service';
import { CompanyScopeService } from '../organization/company-scope.service';
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
  formatCandidateName,
  resolveApplicationDisplayStage,
} from './recruitment.utils';

type ApplicationWithRelations = JobApplication & {
  candidate: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
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

    const row = await this.prisma.unscoped.jobApplication.update({
      where: { id: applicationId },
      data: {
        stage: dto.stage,
        rating: dto.rating ?? existing.rating,
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
      newValue: { stage: dto.stage },
    });

    if (dto.stage === ApplicationStage.interview) {
      await this.interviewRoundsService.ensureRounds(applicationId);
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

  async hire(
    applicationId: string,
    dto: HireApplicationDto,
    user: AuthenticatedUser,
  ): Promise<JobApplicationRecord> {
    const existing = await this.findOrThrow(applicationId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    if (existing.hiredEmployeeId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This application has already been converted to an employee',
      });
    }

    if (
      existing.stage !== ApplicationStage.offer &&
      existing.stage !== ApplicationStage.hired
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only candidates in the offer stage can be hired',
      });
    }

    if (existing.stage === ApplicationStage.hired) {
      return this.toRecord(existing);
    }

    const offer = await this.prisma.unscoped.offerLetter.findFirst({
      where: {
        applicationId,
        status: OfferLetterStatus.accepted,
      },
    });
    if (!offer) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'An accepted offer letter is required before converting to employee',
      });
    }

    const employeeNumber =
      dto.employeeNumber?.trim() ??
      (await this.generateEmployeeNumber(existing.tenantId));

    const hireDate =
      dto.hireDate ?? offer.startDate.toISOString().slice(0, 10);

    let probationEndDate: string | null = null;
    if (offer.probationMonths != null && offer.probationMonths > 0) {
      const probationEnd = new Date(offer.startDate);
      probationEnd.setUTCMonth(probationEnd.getUTCMonth() + offer.probationMonths);
      probationEndDate = probationEnd.toISOString().slice(0, 10);
    }

    const employee = await this.employeesService.createEmployee({
      companyId: existing.companyId,
      employeeNumber,
      firstName: existing.candidate.firstName,
      lastName: existing.candidate.lastName,
      personalInfo: {
        email: existing.candidate.email,
        ...(existing.candidate.phone ? { phone: existing.candidate.phone } : {}),
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
      departmentId: offer.departmentId ?? existing.requisition.departmentId,
      designationId: offer.designationId ?? existing.requisition.designationId,
      employmentTypeId:
        offer.employmentTypeId ?? existing.requisition.employmentTypeId,
      workLocationId: offer.workLocationId ?? existing.requisition.locationId,
      hireDate,
      probationEndDate,
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
    const count = await this.prisma.unscoped.employee.count({
      where: { tenantId, deletedAt: null },
    });
    return `EMP-${String(count + 1).padStart(3, '0')}`;
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
