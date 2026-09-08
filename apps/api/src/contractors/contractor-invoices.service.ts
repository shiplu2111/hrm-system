import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import type { ContractorInvoice, ContractorPaymentTerms } from '@prisma/client';
import type { ContractorInvoiceRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  ContractorInvoiceActionDto,
  CreateContractorInvoiceDto,
  ListContractorInvoicesQueryDto,
} from './dto/contractors.dto';
import { validateInvoiceAgainstContract } from './contractor-payment-structure.utils';
import {
  computeInvoiceDueDate,
  generateInvoiceNumber,
} from './contractor.utils';
import { formatMoney, parseMoney } from '../payroll/payroll.utils';

type InvoiceWithRelations = ContractorInvoice & {
  contractor: { legalName: string; displayName: string | null };
  contract: { contractNumber: string; paymentTerms: ContractorPaymentTerms };
};

@Injectable()
export class ContractorInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async list(
    companyId: string,
    query: ListContractorInvoicesQueryDto,
  ): Promise<ContractorInvoiceRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.contractorInvoice.findMany({
      where: {
        companyId,
        contractorId: query.contractorId,
        status: query.status,
      },
      include: this.defaultInclude(),
      orderBy: { issuedAt: 'desc' },
    });

    return rows.map((row) => this.toRecord(row));
  }

  async create(
    companyId: string,
    dto: CreateContractorInvoiceDto,
    user: AuthenticatedUser,
  ): Promise<ContractorInvoiceRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    const contract = await this.prisma.unscoped.contractorContract.findFirst({
      where: {
        id: dto.contractId,
        companyId,
        contractorId: dto.contractorId,
        status: { in: ['active', 'draft'] },
      },
      include: { milestones: true },
    });
    if (!contract) {
      throw new NotFoundException('Active contract not found for contractor');
    }

    const milestone = dto.milestoneId
      ? contract.milestones.find((row) => row.id === dto.milestoneId)
      : undefined;

    const invoicedAggregate = await this.prisma.unscoped.contractorInvoice.aggregate({
      where: {
        contractId: contract.id,
        status: { notIn: ['rejected', 'cancelled'] },
      },
      _sum: { amount: true },
    });

    const validationError = validateInvoiceAgainstContract({
      paymentStructure: contract.paymentStructure,
      fixedFeeAmount: contract.fixedFeeAmount
        ? formatMoney(contract.fixedFeeAmount)
        : contract.annualValue
          ? formatMoney(contract.annualValue)
          : null,
      hourlyRate: contract.hourlyRate ? formatMoney(contract.hourlyRate) : null,
      invoiceAmount: dto.amount,
      hoursWorked: dto.hoursWorked ?? null,
      milestoneAmount: milestone ? formatMoney(milestone.amount) : null,
      milestoneStatus: milestone?.status ?? null,
      invoicedTotalExcludingCurrent: formatMoney(invoicedAggregate._sum.amount ?? new Decimal(0)),
    });

    if (validationError) {
      throw new BadRequestException(validationError);
    }

    const issuedAt = new Date(dto.issuedAt);
    const dueAt = computeInvoiceDueDate(issuedAt, contract.paymentTerms);
    const year = issuedAt.getUTCFullYear();
    const count = await this.prisma.unscoped.contractorInvoice.count({
      where: {
        companyId,
        createdAt: {
          gte: new Date(Date.UTC(year, 0, 1)),
          lt: new Date(Date.UTC(year + 1, 0, 1)),
        },
      },
    });

    const row = await this.prisma.unscoped.contractorInvoice.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        contractorId: dto.contractorId,
        contractId: dto.contractId,
        milestoneId: dto.milestoneId ?? null,
        invoiceNumber: generateInvoiceNumber(count, year),
        periodLabel: dto.periodLabel?.trim() || null,
        description: dto.description?.trim() || null,
        lineItems: (dto.lineItems ?? []) as object,
        hoursWorked: dto.hoursWorked ? new Decimal(dto.hoursWorked) : null,
        hourlyRate: contract.hourlyRate,
        amount: parseMoney(dto.amount),
        currency: dto.currency?.toUpperCase() ?? contract.currency,
        issuedAt,
        dueAt,
        status: 'draft',
        createdByUserId: user.id,
      },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'contractors',
      recordId: row.id,
      newValue: { invoiceNumber: row.invoiceNumber, amount: dto.amount },
    });

    return this.toRecord(row);
  }

  async submit(invoiceId: string, user: AuthenticatedUser): Promise<ContractorInvoiceRecord> {
    const existing = await this.findOrThrow(invoiceId);
    const row = await this.transition(invoiceId, user, 'draft', 'submitted');

    if (existing.milestoneId) {
      await this.prisma.unscoped.contractorContractMilestone.updateMany({
        where: { id: existing.milestoneId, status: 'pending' },
        data: { status: 'invoiced' },
      });
    }

    return row;
  }

  async approve(
    invoiceId: string,
    user: AuthenticatedUser,
  ): Promise<ContractorInvoiceRecord> {
    return this.transition(invoiceId, user, 'submitted', 'approved', {
      approvedByUserId: user.id,
    });
  }

  async reject(
    invoiceId: string,
    user: AuthenticatedUser,
    _dto: ContractorInvoiceActionDto,
  ): Promise<ContractorInvoiceRecord> {
    const existing = await this.findOrThrow(invoiceId);
    const row = await this.transition(invoiceId, user, 'submitted', 'rejected');

    if (existing.milestoneId) {
      await this.prisma.unscoped.contractorContractMilestone.updateMany({
        where: { id: existing.milestoneId, status: 'invoiced' },
        data: { status: 'pending' },
      });
    }

    return row;
  }

  async markPaid(
    invoiceId: string,
    user: AuthenticatedUser,
    dto: ContractorInvoiceActionDto,
  ): Promise<ContractorInvoiceRecord> {
    const existing = await this.findOrThrow(invoiceId);
    const row = await this.transition(invoiceId, user, ['approved', 'scheduled'], 'paid', {
      paidAt: new Date(),
      paymentReference: dto.paymentReference?.trim() || null,
    });

    if (existing.milestoneId) {
      await this.prisma.unscoped.contractorContractMilestone.updateMany({
        where: { id: existing.milestoneId },
        data: { status: 'paid' },
      });
    }

    return row;
  }

  private async transition(
    invoiceId: string,
    user: AuthenticatedUser,
    from: string | string[],
    to: ContractorInvoice['status'],
    extra: Record<string, unknown> = {},
  ): Promise<ContractorInvoiceRecord> {
    const existing = await this.findOrThrow(invoiceId);
    const allowed = Array.isArray(from) ? from : [from];
    if (!allowed.includes(existing.status)) {
      throw new BadRequestException(`Cannot move invoice from ${existing.status} to ${to}`);
    }

    const row = await this.prisma.unscoped.contractorInvoice.update({
      where: { id: invoiceId },
      data: { status: to, ...extra },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: to === 'paid' ? 'finalize' : to === 'approved' ? 'approve' : 'update',
      module: 'contractors',
      recordId: row.id,
      oldValue: { status: existing.status },
      newValue: { status: row.status },
    });

    return this.toRecord(row);
  }

  private async findOrThrow(invoiceId: string) {
    const row = await this.prisma.unscoped.contractorInvoice.findUnique({
      where: { id: invoiceId },
    });
    if (!row) {
      throw new NotFoundException('Contractor invoice not found');
    }
    await this.companyScope.assertCompanyInTenant(row.companyId);
    return row;
  }

  private defaultInclude() {
    return {
      contractor: { select: { legalName: true, displayName: true } },
      contract: { select: { contractNumber: true, paymentTerms: true } },
    };
  }

  private toRecord(row: InvoiceWithRelations): ContractorInvoiceRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      contractorId: row.contractorId,
      contractorName: row.contractor.displayName ?? row.contractor.legalName,
      contractId: row.contractId,
      contractNumber: row.contract.contractNumber,
      milestoneId: row.milestoneId,
      invoiceNumber: row.invoiceNumber,
      periodLabel: row.periodLabel,
      description: row.description,
      lineItems: Array.isArray(row.lineItems)
        ? (row.lineItems as unknown as ContractorInvoiceRecord['lineItems'])
        : [],
      hoursWorked: row.hoursWorked ? row.hoursWorked.toFixed(2) : null,
      hourlyRate: row.hourlyRate ? formatMoney(row.hourlyRate) : null,
      amount: formatMoney(row.amount),
      currency: row.currency,
      issuedAt: row.issuedAt.toISOString(),
      dueAt: row.dueAt.toISOString(),
      status: row.status,
      paidAt: row.paidAt?.toISOString() ?? null,
      paymentReference: row.paymentReference,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
