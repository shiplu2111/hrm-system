import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Candidate } from '@prisma/client';
import type { CandidateRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateCandidateDto,
  ListCandidatesQueryDto,
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

    const row = await this.prisma.unscoped.candidate.create({
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
