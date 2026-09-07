import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JobPostingStatus, JobRequisitionStatus, Prisma } from '@prisma/client';
import type { JobPostingRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateJobPostingDto,
  ListJobPostingsQueryDto,
  UpdateJobPostingDto,
} from './dto/recruitment.dto';
import { JobRequisitionsService } from './job-requisitions.service';
import { resolvePostingDisplayStatus } from './recruitment.utils';

type PostingWithRelations = Prisma.JobPostingGetPayload<{
  include: {
    requisition: { select: { title: true; referenceNumber: true; status: true } };
  };
}>;

@Injectable()
export class JobPostingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly requisitionsService: JobRequisitionsService,
  ) {}

  async list(
    companyId: string,
    query: ListJobPostingsQueryDto,
  ): Promise<JobPostingRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.jobPosting.findMany({
      where: {
        companyId,
        ...(query.status ? { status: query.status } : {}),
      },
      include: this.defaultInclude(),
      orderBy: [{ createdAt: 'desc' }],
    });

    return rows.map((row) => this.toRecord(row));
  }

  async get(postingId: string): Promise<JobPostingRecord> {
    const row = await this.findOrThrow(postingId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    return this.toRecord(row);
  }

  async create(
    companyId: string,
    dto: CreateJobPostingDto,
    user: AuthenticatedUser,
  ): Promise<JobPostingRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const requisition = await this.requisitionsService.findOrThrow(
      dto.requisitionId,
    );

    if (requisition.companyId !== companyId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Requisition does not belong to this company',
      });
    }

    if (requisition.posting) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A posting already exists for this requisition',
      });
    }

    if (requisition.status !== JobRequisitionStatus.open) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Requisition must be approved and open before creating a posting',
      });
    }

    const row = await this.prisma.unscoped.jobPosting.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        requisitionId: dto.requisitionId,
        title: dto.title?.trim() ?? requisition.title,
        summary: dto.summary?.trim(),
        description: dto.description?.trim() ?? requisition.description,
        status: JobPostingStatus.draft,
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

  async update(
    postingId: string,
    dto: UpdateJobPostingDto,
    user: AuthenticatedUser,
  ): Promise<JobPostingRecord> {
    const existing = await this.findOrThrow(postingId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    const row = await this.prisma.unscoped.jobPosting.update({
      where: { id: postingId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.summary !== undefined ? { summary: dto.summary.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
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

    return this.toRecord(row);
  }

  async publish(
    postingId: string,
    user: AuthenticatedUser,
  ): Promise<JobPostingRecord> {
    const existing = await this.findOrThrow(postingId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    if (existing.requisition.status !== JobRequisitionStatus.open) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Requisition must be open before publishing a posting',
      });
    }

    const row = await this.prisma.unscoped.jobPosting.update({
      where: { id: postingId },
      data: {
        status: JobPostingStatus.published,
        publishedAt: new Date(),
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
      newValue: { status: 'published' },
    });

    return this.toRecord(row);
  }

  async close(
    postingId: string,
    user: AuthenticatedUser,
  ): Promise<JobPostingRecord> {
    const existing = await this.findOrThrow(postingId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    const row = await this.prisma.unscoped.jobPosting.update({
      where: { id: postingId },
      data: {
        status: JobPostingStatus.closed,
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

    return this.toRecord(row);
  }

  async findOrThrow(postingId: string): Promise<PostingWithRelations> {
    const row = await this.prisma.unscoped.jobPosting.findUnique({
      where: { id: postingId },
      include: this.defaultInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Job posting not found',
      });
    }
    return row;
  }

  private defaultInclude() {
    return {
      requisition: {
        select: { title: true, referenceNumber: true, status: true },
      },
    };
  }

  private toRecord(row: PostingWithRelations): JobPostingRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      requisitionId: row.requisitionId,
      title: row.title,
      summary: row.summary,
      description: row.description,
      status: row.status,
      displayStatus: resolvePostingDisplayStatus(row.status),
      publishedAt: row.publishedAt?.toISOString() ?? null,
      closedAt: row.closedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString().slice(0, 10) ?? null,
      requisitionTitle: row.requisition.title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
