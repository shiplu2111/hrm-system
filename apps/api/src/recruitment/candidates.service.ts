import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Candidate } from '@prisma/client';
import type { CandidateRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateCandidateDto,
  ListCandidatesQueryDto,
  UpdateCandidateDto,
} from './dto/recruitment.dto';
import { formatCandidateName } from './recruitment.utils';

type CandidateWithCount = Candidate & {
  _count: { applications: number };
};

@Injectable()
export class CandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async list(
    companyId: string,
    query: ListCandidatesQueryDto,
  ): Promise<CandidateRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const search = query.search?.trim();
    const rows = await this.prisma.unscoped.candidate.findMany({
      where: {
        companyId,
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: Prisma.QueryMode.insensitive } },
                { lastName: { contains: search, mode: Prisma.QueryMode.insensitive } },
                { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
              ],
            }
          : {}),
      },
      include: { _count: { select: { applications: true } } },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return rows.map((row) => this.toRecord(row));
  }

  async get(candidateId: string): Promise<CandidateRecord> {
    const row = await this.findOrThrow(candidateId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    return this.toRecord(row);
  }

  async create(
    companyId: string,
    dto: CreateCandidateDto,
    user: AuthenticatedUser,
  ): Promise<CandidateRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    const row = await this.prisma.unscoped.candidate
      .create({
        data: {
          tenantId: company.tenantId,
          companyId,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email: dto.email.trim().toLowerCase(),
          phone: dto.phone?.trim(),
          source: dto.source,
          yearsExperience: dto.yearsExperience,
          notes: dto.notes?.trim(),
        },
        include: { _count: { select: { applications: true } } },
      })
      .catch((error: unknown) => this.rethrowDuplicateEmail(error));

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
    candidateId: string,
    dto: UpdateCandidateDto,
    user: AuthenticatedUser,
  ): Promise<CandidateRecord> {
    const existing = await this.findOrThrow(candidateId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    const blankToNull = (value: string | null | undefined) =>
      value === undefined ? undefined : value?.trim() || null;

    const data: Prisma.CandidateUpdateInput = {
      ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
      ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
      ...(dto.phone !== undefined ? { phone: blankToNull(dto.phone) } : {}),
      ...(dto.source !== undefined ? { source: dto.source } : {}),
      ...(dto.yearsExperience !== undefined
        ? { yearsExperience: dto.yearsExperience }
        : {}),
      ...(dto.notes !== undefined ? { notes: blankToNull(dto.notes) } : {}),
    };

    const row = await this.prisma.unscoped.candidate
      .update({
        where: { id: candidateId },
        data,
        include: { _count: { select: { applications: true } } },
      })
      .catch((error: unknown) => this.rethrowDuplicateEmail(error));

    await this.auditService.log({
      tenantId: row.tenantId,
      userId: user.id,
      action: 'update',
      module: 'recruitment',
      recordId: row.id,
      oldValue: {
        firstName: existing.firstName,
        lastName: existing.lastName,
        email: existing.email,
        phone: existing.phone,
        source: existing.source,
        yearsExperience: existing.yearsExperience,
      },
      newValue: {
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        source: row.source,
        yearsExperience: row.yearsExperience,
      },
    });

    return this.toRecord(row);
  }

  async findOrThrow(candidateId: string): Promise<CandidateWithCount> {
    const row = await this.prisma.unscoped.candidate.findUnique({
      where: { id: candidateId },
      include: { _count: { select: { applications: true } } },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Candidate not found',
      });
    }
    return row;
  }

  private rethrowDuplicateEmail(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'A candidate with this email already exists in this company',
      });
    }
    throw error;
  }

  private toRecord(row: CandidateWithCount): CandidateRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: formatCandidateName(row.firstName, row.lastName),
      email: row.email,
      phone: row.phone,
      source: row.source,
      yearsExperience: row.yearsExperience,
      notes: row.notes,
      applicationCount: row._count.applications,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
