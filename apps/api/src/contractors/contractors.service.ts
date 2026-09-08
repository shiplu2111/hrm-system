import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import type { Contractor } from '@prisma/client';
import type {
  ContractorRecord,
  ContractorSummary,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateContractorDto,
  ListContractorsQueryDto,
} from './dto/contractors.dto';
import { generateContractorNumber } from './contractor.utils';
import { formatMoney } from '../payroll/payroll.utils';

type ContractorWithOwner = Contractor & {
  owner: { firstName: string; lastName: string } | null;
  _count: { contracts: number };
};

@Injectable()
export class ContractorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async getSummary(companyId: string): Promise<ContractorSummary> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const now = new Date();
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const [
      totalContractors,
      activeContracts,
      expiringWithin60Days,
      overdueContracts,
      outstandingInvoices,
      pendingInvoiceCount,
    ] = await Promise.all([
      this.prisma.unscoped.contractor.count({ where: { companyId } }),
      this.prisma.unscoped.contractorContract.count({
        where: { companyId, status: 'active', endDate: { gte: now } },
      }),
      this.prisma.unscoped.contractorContract.count({
        where: {
          companyId,
          status: 'active',
          endDate: { gte: now, lte: in60Days },
        },
      }),
      this.prisma.unscoped.contractorContract.count({
        where: { companyId, status: { in: ['active', 'expired'] }, endDate: { lt: now } },
      }),
      this.prisma.unscoped.contractorInvoice.aggregate({
        where: {
          companyId,
          status: { in: ['submitted', 'approved', 'scheduled'] },
        },
        _sum: { amount: true },
      }),
      this.prisma.unscoped.contractorInvoice.count({
        where: {
          companyId,
          status: { in: ['submitted', 'approved'] },
        },
      }),
    ]);

    return {
      totalContractors,
      activeContracts,
      expiringWithin60Days,
      overdueContracts,
      outstandingInvoiceAmount: formatMoney(
        outstandingInvoices._sum.amount ?? new Decimal(0),
      ),
      pendingInvoiceCount,
    };
  }

  async list(
    companyId: string,
    query: ListContractorsQueryDto,
  ): Promise<ContractorRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const search = query.search?.trim();

    const rows = await this.prisma.unscoped.contractor.findMany({
      where: {
        companyId,
        status: query.status,
        ...(search
          ? {
              OR: [
                { legalName: { contains: search, mode: 'insensitive' } },
                { contractorNumber: { contains: search, mode: 'insensitive' } },
                { contactName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        owner: { select: { firstName: true, lastName: true } },
        _count: { select: { contracts: true } },
      },
      orderBy: { legalName: 'asc' },
    });

    const records: ContractorRecord[] = [];
    for (const row of rows) {
      records.push(await this.toRecord(row));
    }
    return records;
  }

  async getById(contractorId: string): Promise<ContractorRecord> {
    const row = await this.findOrThrow(contractorId);
    return this.toRecord(row);
  }

  async create(
    companyId: string,
    dto: CreateContractorDto,
    user: AuthenticatedUser,
  ): Promise<ContractorRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const year = new Date().getUTCFullYear();
    const count = await this.prisma.unscoped.contractor.count({
      where: {
        companyId,
        createdAt: {
          gte: new Date(Date.UTC(year, 0, 1)),
          lt: new Date(Date.UTC(year + 1, 0, 1)),
        },
      },
    });

    const row = await this.prisma.unscoped.contractor.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        contractorNumber: generateContractorNumber(count, year),
        legalName: dto.legalName.trim(),
        displayName: dto.displayName?.trim() || null,
        contractorKind: dto.contractorKind ?? 'consultant',
        category: dto.category?.trim() || null,
        contactName: dto.contactName?.trim() || null,
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        location: dto.location?.trim() || null,
        taxId: dto.taxId?.trim() || null,
        status: dto.status ?? 'active',
        ownerEmployeeId: dto.ownerEmployeeId,
        createdByUserId: user.id,
      },
      include: {
        owner: { select: { firstName: true, lastName: true } },
        _count: { select: { contracts: true } },
      },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'contractors',
      recordId: row.id,
      newValue: { contractorNumber: row.contractorNumber, legalName: row.legalName },
    });

    return this.toRecord(row);
  }

  private async findOrThrow(contractorId: string): Promise<ContractorWithOwner> {
    const row = await this.prisma.unscoped.contractor.findUnique({
      where: { id: contractorId },
      include: {
        owner: { select: { firstName: true, lastName: true } },
        _count: { select: { contracts: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Contractor not found');
    }
    await this.companyScope.assertCompanyInTenant(row.companyId);
    return row;
  }

  private async toRecord(row: ContractorWithOwner): Promise<ContractorRecord> {
    const outstanding = await this.prisma.unscoped.contractorInvoice.aggregate({
      where: {
        contractorId: row.id,
        status: { in: ['submitted', 'approved', 'scheduled'] },
      },
      _sum: { amount: true },
    });

    return {
      id: row.id,
      companyId: row.companyId,
      contractorNumber: row.contractorNumber,
      legalName: row.legalName,
      displayName: row.displayName,
      contractorKind: row.contractorKind,
      category: row.category,
      contactName: row.contactName,
      email: row.email,
      phone: row.phone,
      location: row.location,
      taxId: row.taxId,
      status: row.status,
      ownerEmployeeId: row.ownerEmployeeId,
      ownerEmployeeName: row.owner
        ? `${row.owner.firstName} ${row.owner.lastName}`.trim()
        : null,
      activeContractCount: row._count.contracts,
      outstandingInvoiceAmount: formatMoney(
        outstanding._sum.amount ?? new Decimal(0),
      ),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
