import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  JobRequisitionStatus,
  Prisma,
  type JobRequisition,
} from '@prisma/client';
import type { JobRequisitionRecord, WorkflowInstanceRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateJobRequisitionDto,
  ListJobRequisitionsQueryDto,
  RequisitionActionDto,
  UpdateJobRequisitionDto,
} from './dto/recruitment.dto';
import { JobRequisitionWorkflowService } from './job-requisition-workflow.service';
import {
  buildRequisitionReferenceNumber,
  resolvePostingDisplayStatus,
  resolveRequisitionDisplayStatus,
} from './recruitment.utils';

type RequisitionWithRelations = JobRequisition & {
  department: { name: string } | null;
  designation: { name: string } | null;
  jobLevel: { name: string } | null;
  employmentType: { name: string } | null;
  location: { name: string } | null;
  requestedBy: { firstName: string; lastName: string } | null;
  posting: {
    id: string;
    tenantId: string;
    companyId: string;
    requisitionId: string;
    title: string;
    summary: string | null;
    description: string;
    status: import('@prisma/client').JobPostingStatus;
    publishedAt: Date | null;
    closedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  _count: { applications: number };
};

@Injectable()
export class JobRequisitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly requisitionWorkflow: JobRequisitionWorkflowService,
  ) {}

  async list(
    companyId: string,
    query: ListJobRequisitionsQueryDto,
  ): Promise<JobRequisitionRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.jobRequisition.findMany({
      where: {
        companyId,
        ...(query.status ? { status: query.status } : {}),
      },
      include: this.defaultInclude(),
      orderBy: [{ createdAt: 'desc' }],
    });

    const records: JobRequisitionRecord[] = [];
    for (const row of rows) {
      const workflow = await this.requisitionWorkflow.findForRequisition(row.id);
      records.push(this.toRecord(row, workflow));
    }
    return records;
  }

  async get(requisitionId: string): Promise<JobRequisitionRecord> {
    const row = await this.findOrThrow(requisitionId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    const workflow = await this.requisitionWorkflow.findForRequisition(requisitionId);
    return this.toRecord(row, workflow);
  }

  async create(
    companyId: string,
    dto: CreateJobRequisitionDto,
    user: AuthenticatedUser,
  ): Promise<JobRequisitionRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    await this.validateOrgRefs(companyId, dto);

    const count = await this.prisma.unscoped.jobRequisition.count({
      where: { companyId },
    });

    const row = await this.prisma.unscoped.jobRequisition.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        referenceNumber: buildRequisitionReferenceNumber(count),
        title: dto.title.trim(),
        departmentId: dto.departmentId,
        designationId: dto.designationId,
        jobLevelId: dto.jobLevelId,
        employmentTypeId: dto.employmentTypeId,
        locationId: dto.locationId,
        description: dto.description.trim(),
        headcount: dto.headcount ?? 1,
        status: JobRequisitionStatus.draft,
        requestedByEmployeeId:
          dto.requestedByEmployeeId ?? user.employeeId ?? undefined,
      },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: row.tenantId,
      userId: user.id,
      action: 'create',
      module: 'recruitment',
      recordId: row.id,
      newValue: { referenceNumber: row.referenceNumber },
    });

    return this.toRecord(row, null);
  }

  async update(
    requisitionId: string,
    dto: UpdateJobRequisitionDto,
    user: AuthenticatedUser,
  ): Promise<JobRequisitionRecord> {
    const existing = await this.findOrThrow(requisitionId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    if (
      existing.status !== JobRequisitionStatus.draft &&
      existing.status !== JobRequisitionStatus.pending_approval
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only draft or pending requisitions can be edited',
      });
    }

    await this.validateOrgRefs(existing.companyId, dto);

    const row = await this.prisma.unscoped.jobRequisition.update({
      where: { id: requisitionId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.departmentId !== undefined
          ? { departmentId: dto.departmentId }
          : {}),
        ...(dto.designationId !== undefined
          ? { designationId: dto.designationId }
          : {}),
        ...(dto.jobLevelId !== undefined ? { jobLevelId: dto.jobLevelId } : {}),
        ...(dto.employmentTypeId !== undefined
          ? { employmentTypeId: dto.employmentTypeId }
          : {}),
        ...(dto.locationId !== undefined ? { locationId: dto.locationId } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        ...(dto.headcount !== undefined ? { headcount: dto.headcount } : {}),
      },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: row.tenantId,
      userId: user.id,
      action: 'update',
      module: 'recruitment',
      recordId: row.id,
    });

    const workflow = await this.requisitionWorkflow.findForRequisition(requisitionId);
    return this.toRecord(row, workflow);
  }

  async submit(
    requisitionId: string,
    user: AuthenticatedUser,
  ): Promise<JobRequisitionRecord> {
    const row = await this.findOrThrow(requisitionId);
    await this.companyScope.assertCompanyInTenant(row.companyId);

    if (row.status !== JobRequisitionStatus.draft) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only draft requisitions can be submitted for approval',
      });
    }

    const requesterEmployeeId =
      row.requestedByEmployeeId ?? user.employeeId ?? null;
    if (!requesterEmployeeId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A requester employee is required to submit a requisition',
      });
    }

    const workflow = await this.requisitionWorkflow.startForRequisition({
      companyId: row.companyId,
      tenantId: row.tenantId,
      requisitionId: row.id,
      requesterEmployeeId,
      requesterUserId: user.id,
    });

    const updated = await this.prisma.unscoped.jobRequisition.update({
      where: { id: requisitionId },
      data: { status: JobRequisitionStatus.pending_approval },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: updated.tenantId,
      userId: user.id,
      action: 'update',
      module: 'recruitment',
      recordId: updated.id,
      newValue: { status: 'pending_approval' },
    });

    return this.toRecord(updated, workflow);
  }

  async approve(
    requisitionId: string,
    user: AuthenticatedUser,
    dto: RequisitionActionDto,
  ): Promise<JobRequisitionRecord> {
    const row = await this.findOrThrow(requisitionId);
    await this.companyScope.assertCompanyInTenant(row.companyId);

    if (row.status !== JobRequisitionStatus.pending_approval) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Requisition is not pending approval',
      });
    }

    const requesterEmployeeId = row.requestedByEmployeeId;
    if (!requesterEmployeeId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Requisition has no requester employee',
      });
    }

    const transition = await this.requisitionWorkflow.approve({
      requisitionId: row.id,
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
      updated = await this.prisma.unscoped.jobRequisition.update({
        where: { id: row.id },
        data: {
          status: JobRequisitionStatus.open,
          openedAt: new Date(),
          closedAt: null,
        },
        include: this.defaultInclude(),
      });
    } else if (transition.rejected) {
      updated = await this.prisma.unscoped.jobRequisition.update({
        where: { id: row.id },
        data: { status: JobRequisitionStatus.cancelled },
        include: this.defaultInclude(),
      });
    }

    return this.toRecord(updated, transition.instance);
  }

  async reject(
    requisitionId: string,
    user: AuthenticatedUser,
    dto: RequisitionActionDto,
  ): Promise<JobRequisitionRecord> {
    const row = await this.findOrThrow(requisitionId);
    await this.companyScope.assertCompanyInTenant(row.companyId);

    if (row.status !== JobRequisitionStatus.pending_approval) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Requisition is not pending approval',
      });
    }

    const requesterEmployeeId = row.requestedByEmployeeId;
    if (!requesterEmployeeId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Requisition has no requester employee',
      });
    }

    const transition = await this.requisitionWorkflow.reject({
      requisitionId: row.id,
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

    const updated = await this.prisma.unscoped.jobRequisition.update({
      where: { id: row.id },
      data: { status: JobRequisitionStatus.cancelled },
      include: this.defaultInclude(),
    });

    return this.toRecord(updated, transition.instance);
  }

  async open(
    requisitionId: string,
    user: AuthenticatedUser,
  ): Promise<JobRequisitionRecord> {
    const existing = await this.findOrThrow(requisitionId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    if (existing.status !== JobRequisitionStatus.closed) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only closed requisitions can be reopened',
      });
    }

    const row = await this.prisma.unscoped.jobRequisition.update({
      where: { id: requisitionId },
      data: {
        status: JobRequisitionStatus.open,
        openedAt: new Date(),
        closedAt: null,
      },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: row.tenantId,
      userId: user.id,
      action: 'update',
      module: 'recruitment',
      recordId: row.id,
      newValue: { status: 'open' },
    });

    const workflow = await this.requisitionWorkflow.findForRequisition(requisitionId);
    return this.toRecord(row, workflow);
  }

  async close(
    requisitionId: string,
    user: AuthenticatedUser,
  ): Promise<JobRequisitionRecord> {
    const existing = await this.findOrThrow(requisitionId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    const row = await this.prisma.unscoped.jobRequisition.update({
      where: { id: requisitionId },
      data: {
        status: JobRequisitionStatus.closed,
        closedAt: new Date(),
      },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: row.tenantId,
      userId: user.id,
      action: 'update',
      module: 'recruitment',
      recordId: row.id,
      newValue: { status: 'closed' },
    });

    const workflow = await this.requisitionWorkflow.findForRequisition(requisitionId);
    return this.toRecord(row, workflow);
  }

  async findOrThrow(requisitionId: string): Promise<RequisitionWithRelations> {
    const row = await this.prisma.unscoped.jobRequisition.findUnique({
      where: { id: requisitionId },
      include: this.defaultInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Job requisition not found',
      });
    }
    return row;
  }

  private defaultInclude(): Prisma.JobRequisitionInclude {
    return {
      department: { select: { name: true } },
      designation: { select: { name: true } },
      jobLevel: { select: { name: true } },
      employmentType: { select: { name: true } },
      location: { select: { name: true } },
      requestedBy: { select: { firstName: true, lastName: true } },
      posting: { select: { id: true, status: true, title: true, summary: true, description: true, publishedAt: true, closedAt: true, expiresAt: true, tenantId: true, companyId: true, requisitionId: true, createdAt: true, updatedAt: true } },
      _count: { select: { applications: true } },
    };
  }

  private async validateOrgRefs(
    companyId: string,
    dto: {
      departmentId?: string;
      designationId?: string;
      jobLevelId?: string;
      employmentTypeId?: string;
      locationId?: string;
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
    if (dto.jobLevelId) {
      await this.prisma.unscoped.jobLevel.findFirstOrThrow({
        where: { id: dto.jobLevelId, companyId },
      });
    }
    if (dto.employmentTypeId) {
      await this.prisma.unscoped.employmentType.findFirstOrThrow({
        where: { id: dto.employmentTypeId, companyId },
      });
    }
    if (dto.locationId) {
      await this.prisma.unscoped.location.findFirstOrThrow({
        where: { id: dto.locationId, companyId },
      });
    }
  }

  private toRecord(
    row: RequisitionWithRelations,
    workflow: WorkflowInstanceRecord | null,
  ): JobRequisitionRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      referenceNumber: row.referenceNumber,
      title: row.title,
      departmentId: row.departmentId,
      departmentName: row.department?.name,
      designationId: row.designationId,
      designationName: row.designation?.name,
      jobLevelId: row.jobLevelId,
      jobLevelName: row.jobLevel?.name,
      employmentTypeId: row.employmentTypeId,
      employmentTypeName: row.employmentType?.name,
      locationId: row.locationId,
      locationName: row.location?.name,
      description: row.description,
      headcount: row.headcount,
      status: row.status,
      displayStatus: resolveRequisitionDisplayStatus(row.status, workflow),
      requestedByEmployeeId: row.requestedByEmployeeId,
      requestedByName: row.requestedBy
        ? `${row.requestedBy.firstName} ${row.requestedBy.lastName}`.trim()
        : undefined,
      openedAt: row.openedAt?.toISOString() ?? null,
      closedAt: row.closedAt?.toISOString() ?? null,
      posting: row.posting
        ? {
            id: row.posting.id,
            tenantId: row.posting.tenantId,
            companyId: row.posting.companyId,
            requisitionId: row.posting.requisitionId,
            title: row.posting.title,
            summary: row.posting.summary,
            description: row.posting.description,
            status: row.posting.status,
            displayStatus: resolvePostingDisplayStatus(row.posting.status),
            publishedAt: row.posting.publishedAt?.toISOString() ?? null,
            closedAt: row.posting.closedAt?.toISOString() ?? null,
            expiresAt: row.posting.expiresAt?.toISOString().slice(0, 10) ?? null,
            createdAt: row.posting.createdAt.toISOString(),
            updatedAt: row.posting.updatedAt.toISOString(),
          }
        : null,
      applicationCount: row._count.applications,
      workflow,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
