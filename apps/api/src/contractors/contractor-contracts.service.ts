import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ContractorContract, ContractorContractMilestone } from '@prisma/client';
import type {
  ContractorContractMilestoneRecord,
  ContractorContractRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateContractorContractDto,
  ListContractorContractsQueryDto,
  UpdateContractorPaymentTermsDto,
} from './dto/contractors.dto';
import { resolveDefaultPaymentStructure } from './contractor-payment-structure.utils';
import {
  daysUntilExpiry,
  generateContractNumber,
  resolveContractStatus,
} from './contractor.utils';
import { formatMoney, parseMoney } from '../payroll/payroll.utils';

type ContractWithRelations = ContractorContract & {
  contractor: { legalName: string; displayName: string | null };
  owner: { firstName: string; lastName: string } | null;
  milestones: ContractorContractMilestone[];
};

@Injectable()
export class ContractorContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async list(
    companyId: string,
    query: ListContractorContractsQueryDto = {},
  ): Promise<ContractorContractRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.contractorContract.findMany({
      where: {
        companyId,
        contractorId: query.contractorId,
        paymentStructure: query.paymentStructure,
        paymentTerms: query.paymentTerms,
      },
      include: this.defaultInclude(),
      orderBy: { endDate: 'asc' },
    });

    return rows.map((row) => this.toRecord(row));
  }

  async listForContractor(contractorId: string): Promise<ContractorContractRecord[]> {
    const contractor = await this.prisma.unscoped.contractor.findUnique({
      where: { id: contractorId },
      select: { companyId: true },
    });
    if (!contractor) {
      throw new NotFoundException('Contractor not found');
    }
    await this.companyScope.assertCompanyInTenant(contractor.companyId);

    const rows = await this.prisma.unscoped.contractorContract.findMany({
      where: { contractorId },
      include: this.defaultInclude(),
      orderBy: { endDate: 'desc' },
    });

    return rows.map((row) => this.toRecord(row));
  }

  async create(
    companyId: string,
    dto: CreateContractorContractDto,
    user: AuthenticatedUser,
  ): Promise<ContractorContractRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    const contractor = await this.prisma.unscoped.contractor.findFirst({
      where: { id: dto.contractorId, companyId },
    });
    if (!contractor) {
      throw new NotFoundException('Contractor not found');
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('Contract end date must be after start date');
    }

    const paymentStructure = resolveDefaultPaymentStructure({
      paymentStructure: dto.paymentStructure,
      billingFrequency: dto.billingFrequency,
    });

    this.validatePaymentStructureFields(dto, paymentStructure);

    const year = startDate.getUTCFullYear();
    const count = await this.prisma.unscoped.contractorContract.count({
      where: {
        companyId,
        createdAt: {
          gte: new Date(Date.UTC(year, 0, 1)),
          lt: new Date(Date.UTC(year + 1, 0, 1)),
        },
      },
    });

    const storedStatus = dto.status ?? 'active';
    const status = resolveContractStatus({
      storedStatus,
      startDate,
      endDate,
    });

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      const contract = await tx.contractorContract.create({
        data: {
          tenantId: company.tenantId,
          companyId,
          contractorId: dto.contractorId,
          contractNumber: generateContractNumber(count, year),
          title: dto.title.trim(),
          scopeDescription: dto.scopeDescription?.trim() || null,
          status,
          startDate,
          endDate,
          annualValue: dto.annualValue ? parseMoney(dto.annualValue) : null,
          fixedFeeAmount: dto.fixedFeeAmount ? parseMoney(dto.fixedFeeAmount) : null,
          hourlyRate: dto.hourlyRate ? parseMoney(dto.hourlyRate) : null,
          currency: dto.currency?.toUpperCase() ?? 'AUD',
          paymentStructure,
          paymentTerms: dto.paymentTerms ?? 'net_30',
          billingFrequency:
            paymentStructure === 'milestone' ? 'milestone' : dto.billingFrequency ?? 'monthly',
          autoRenewal: dto.autoRenewal ?? false,
          ownerEmployeeId: dto.ownerEmployeeId ?? contractor.ownerEmployeeId,
          createdByUserId: user.id,
        },
      });

      if (paymentStructure === 'milestone' && dto.milestones?.length) {
        await tx.contractorContractMilestone.createMany({
          data: dto.milestones.map((milestone, index) => ({
            tenantId: company.tenantId,
            companyId,
            contractId: contract.id,
            title: milestone.title.trim(),
            description: milestone.description?.trim() || null,
            amount: parseMoney(milestone.amount),
            targetDate: milestone.targetDate ? new Date(milestone.targetDate) : null,
            sortOrder: milestone.sortOrder ?? index,
          })),
        });
      }

      return tx.contractorContract.findUniqueOrThrow({
        where: { id: contract.id },
        include: this.defaultInclude(),
      });
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'contractors',
      recordId: row.id,
      newValue: {
        contractNumber: row.contractNumber,
        contractorId: row.contractorId,
        paymentStructure,
      },
    });

    return this.toRecord(row);
  }

  async updatePaymentTerms(
    contractId: string,
    dto: UpdateContractorPaymentTermsDto,
    user: AuthenticatedUser,
  ): Promise<ContractorContractRecord> {
    const existing = await this.prisma.unscoped.contractorContract.findUnique({
      where: { id: contractId },
      include: {
        milestones: { orderBy: { sortOrder: 'asc' } },
        invoices: {
          where: { status: { notIn: ['rejected', 'cancelled'] } },
          select: { id: true },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('Contractor contract not found');
    }
    const company = await this.companyScope.assertCompanyInTenant(existing.companyId);

    if (existing.status === 'terminated') {
      throw new BadRequestException('Terminated contracts cannot modify payment terms');
    }
    if (
      dto.paymentStructure !== existing.paymentStructure &&
      existing.invoices.length > 0
    ) {
      throw new BadRequestException(
        'Cannot change payment structure after invoices exist on this contract',
      );
    }

    this.validatePaymentStructureFields(dto, dto.paymentStructure);

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      if (dto.paymentStructure === 'milestone') {
        const incoming = dto.milestones ?? [];
        const incomingIds = new Set(incoming.map((m) => m.id).filter(Boolean) as string[]);

        for (const existingMilestone of existing.milestones) {
          const locked = existingMilestone.status !== 'pending';
          if (locked && !incomingIds.has(existingMilestone.id)) {
            throw new BadRequestException(
              `Milestone "${existingMilestone.title}" is already ${existingMilestone.status} and cannot be removed`,
            );
          }
          if (locked) {
            const match = incoming.find((m) => m.id === existingMilestone.id);
            if (match && !parseMoney(match.amount).eq(existingMilestone.amount)) {
              throw new BadRequestException(
                `Milestone "${existingMilestone.title}" is ${existingMilestone.status} and its amount cannot change`,
              );
            }
          }
        }

        const removablePendingIds = existing.milestones
          .filter((m) => m.status === 'pending' && !incomingIds.has(m.id))
          .map((m) => m.id);
        if (removablePendingIds.length > 0) {
          await tx.contractorContractMilestone.deleteMany({
            where: { id: { in: removablePendingIds } },
          });
        }

        for (let index = 0; index < incoming.length; index += 1) {
          const item = incoming[index];
          const existingMatch = item.id
            ? existing.milestones.find((m) => m.id === item.id)
            : undefined;
          if (existingMatch) {
            if (existingMatch.status === 'pending') {
              await tx.contractorContractMilestone.update({
                where: { id: existingMatch.id },
                data: {
                  title: item.title.trim(),
                  description: item.description?.trim() || null,
                  amount: parseMoney(item.amount),
                  targetDate: item.targetDate ? new Date(item.targetDate) : null,
                  sortOrder: item.sortOrder ?? index,
                },
              });
            }
          } else {
            await tx.contractorContractMilestone.create({
              data: {
                tenantId: company.tenantId,
                companyId: existing.companyId,
                contractId,
                title: item.title.trim(),
                description: item.description?.trim() || null,
                amount: parseMoney(item.amount),
                targetDate: item.targetDate ? new Date(item.targetDate) : null,
                sortOrder: item.sortOrder ?? index,
              },
            });
          }
        }
      } else {
        const pendingIds = existing.milestones
          .filter((m) => m.status === 'pending')
          .map((m) => m.id);
        if (pendingIds.length > 0) {
          await tx.contractorContractMilestone.deleteMany({
            where: { id: { in: pendingIds } },
          });
        }
      }

      return tx.contractorContract.update({
        where: { id: contractId },
        data: {
          paymentStructure: dto.paymentStructure,
          paymentTerms: dto.paymentTerms,
          billingFrequency:
            dto.paymentStructure === 'milestone'
              ? 'milestone'
              : (dto.billingFrequency ?? existing.billingFrequency),
          fixedFeeAmount:
            dto.paymentStructure === 'fixed_project_fee'
              ? dto.fixedFeeAmount
                ? parseMoney(dto.fixedFeeAmount)
                : dto.annualValue
                  ? parseMoney(dto.annualValue)
                  : null
              : null,
          annualValue:
            dto.annualValue !== undefined
              ? dto.annualValue
                ? parseMoney(dto.annualValue)
                : null
              : dto.paymentStructure === 'fixed_project_fee' && dto.fixedFeeAmount
                ? parseMoney(dto.fixedFeeAmount)
                : existing.annualValue,
          hourlyRate:
            dto.paymentStructure === 'hourly_invoice' && dto.hourlyRate
              ? parseMoney(dto.hourlyRate)
              : null,
          currency: dto.currency?.toUpperCase() ?? existing.currency,
          autoRenewal: dto.autoRenewal ?? existing.autoRenewal,
          noticePeriodDays: dto.noticePeriodDays ?? existing.noticePeriodDays,
          scopeDescription:
            dto.scopeDescription !== undefined
              ? dto.scopeDescription.trim() || null
              : existing.scopeDescription,
        },
        include: this.defaultInclude(),
      });
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'update',
      module: 'contractors',
      recordId: contractId,
      oldValue: {
        paymentStructure: existing.paymentStructure,
        paymentTerms: existing.paymentTerms,
        billingFrequency: existing.billingFrequency,
        fixedFeeAmount: existing.fixedFeeAmount ? formatMoney(existing.fixedFeeAmount) : null,
        hourlyRate: existing.hourlyRate ? formatMoney(existing.hourlyRate) : null,
      },
      newValue: {
        paymentStructure: row.paymentStructure,
        paymentTerms: row.paymentTerms,
        billingFrequency: row.billingFrequency,
        fixedFeeAmount: row.fixedFeeAmount ? formatMoney(row.fixedFeeAmount) : null,
        hourlyRate: row.hourlyRate ? formatMoney(row.hourlyRate) : null,
      },
    });

    return this.toRecord(row);
  }

  private validatePaymentStructureFields(
    dto: Pick<
      CreateContractorContractDto | UpdateContractorPaymentTermsDto,
      'fixedFeeAmount' | 'annualValue' | 'hourlyRate' | 'milestones'
    >,
    paymentStructure: ReturnType<typeof resolveDefaultPaymentStructure>,
  ): void {
    if (paymentStructure === 'fixed_project_fee' && !dto.fixedFeeAmount && !dto.annualValue) {
      throw new BadRequestException(
        'Fixed project fee contracts require fixedFeeAmount or annualValue',
      );
    }
    if (paymentStructure === 'hourly_invoice' && !dto.hourlyRate) {
      throw new BadRequestException('Hourly contracts require hourlyRate');
    }
    if (paymentStructure === 'milestone' && (!dto.milestones || dto.milestones.length === 0)) {
      throw new BadRequestException('Milestone contracts require at least one milestone');
    }
  }

  private defaultInclude() {
    return {
      contractor: { select: { legalName: true, displayName: true } },
      owner: { select: { firstName: true, lastName: true } },
      milestones: { orderBy: { sortOrder: 'asc' as const } },
    };
  }

  private toRecord(row: ContractWithRelations): ContractorContractRecord {
    const status = resolveContractStatus({
      storedStatus: row.status,
      startDate: row.startDate,
      endDate: row.endDate,
    });

    return {
      id: row.id,
      companyId: row.companyId,
      contractorId: row.contractorId,
      contractorName: row.contractor.displayName ?? row.contractor.legalName,
      contractNumber: row.contractNumber,
      title: row.title,
      scopeDescription: row.scopeDescription,
      status,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      daysUntilExpiry: daysUntilExpiry(row.endDate),
      annualValue: row.annualValue ? formatMoney(row.annualValue) : null,
      fixedFeeAmount: row.fixedFeeAmount ? formatMoney(row.fixedFeeAmount) : null,
      hourlyRate: row.hourlyRate ? formatMoney(row.hourlyRate) : null,
      currency: row.currency,
      paymentStructure: row.paymentStructure,
      paymentTerms: row.paymentTerms,
      billingFrequency: row.billingFrequency,
      autoRenewal: row.autoRenewal,
      noticePeriodDays: row.noticePeriodDays,
      ownerEmployeeId: row.ownerEmployeeId,
      ownerEmployeeName: row.owner
        ? `${row.owner.firstName} ${row.owner.lastName}`.trim()
        : null,
      milestones: row.milestones.map((milestone) => this.toMilestoneRecord(milestone)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toMilestoneRecord(
    row: ContractorContractMilestone,
  ): ContractorContractMilestoneRecord {
    return {
      id: row.id,
      contractId: row.contractId,
      title: row.title,
      description: row.description,
      amount: formatMoney(row.amount),
      targetDate: row.targetDate?.toISOString().slice(0, 10) ?? null,
      sortOrder: row.sortOrder,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
