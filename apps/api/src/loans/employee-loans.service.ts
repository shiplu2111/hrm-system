import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeLoanStatus,
  Prisma,
  type EmployeeLoan,
  type LoanInstallment,
} from '@prisma/client';
import type {
  EmployeeLoanRecord,
  LoanInstallmentRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateEmployeeLoanDto,
  ListEmployeeLoansQueryDto,
  RejectEmployeeLoanDto,
} from './dto/loan.dto';
import { LoanPayrollService } from './loan-payroll.service';
import {
  addMonthsUtc,
  buildInstallmentSchedule,
  buildLoanReferenceNumber,
  calculateLoanTotals,
  formatDateValue,
  parseDateString,
} from './loan.utils';

type LoanWithRelations = EmployeeLoan & {
  employee: { firstName: string; lastName: string; employeeNumber: string };
  installments: LoanInstallment[];
};

@Injectable()
export class EmployeeLoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly loanPayroll: LoanPayrollService,
  ) {}

  async list(
    companyId: string,
    query: ListEmployeeLoansQueryDto,
  ): Promise<EmployeeLoanRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.employeeLoan.findMany({
      where: {
        companyId,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.status
          ? { status: query.status as EmployeeLoanStatus }
          : {}),
      },
      include: this.defaultInclude(),
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    return rows.map((row) => this.toRecord(row));
  }

  async get(loanId: string): Promise<EmployeeLoanRecord> {
    const row = await this.findOrThrow(loanId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    return this.toRecord(row);
  }

  async create(
    companyId: string,
    dto: CreateEmployeeLoanDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeLoanRecord> {
    const employee = await this.assertEmployee(dto.employeeId, companyId);
    const totals = calculateLoanTotals(
      dto.principalAmount,
      dto.interestRatePercent ?? 0,
      dto.tenorMonths,
    );

    const count = await this.prisma.unscoped.employeeLoan.count({
      where: { companyId },
    });
    const referenceNumber = buildLoanReferenceNumber(count);

    const row = await this.prisma.unscoped.employeeLoan.create({
      data: {
        tenantId: employee.tenantId,
        companyId,
        employeeId: dto.employeeId,
        referenceNumber,
        loanKind: dto.loanKind,
        purposeLabel: dto.purposeLabel?.trim() ?? null,
        principalAmount: new Prisma.Decimal(dto.principalAmount),
        interestRatePercent: new Prisma.Decimal(dto.interestRatePercent ?? 0),
        tenorMonths: dto.tenorMonths,
        monthlyInstallment: new Prisma.Decimal(totals.monthlyInstallment),
        totalRepayable: new Prisma.Decimal(totals.totalRepayable),
        remainingBalance: new Prisma.Decimal(totals.totalRepayable),
        deductFromPayroll: dto.deductFromPayroll ?? true,
        notes: dto.notes?.trim() ?? null,
        status: EmployeeLoanStatus.pending_approval,
      },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: employee.tenantId,
      userId: user.id,
      action: 'create',
      module: 'payroll',
      recordId: row.id,
      newValue: this.toRecord(row) as unknown as Record<string, unknown>,
    });

    if (dto.approve === true) {
      return this.approve(row.id, user, {
        firstDueDate: dto.firstDueDate,
      });
    }

    return this.toRecord(row);
  }

  async approve(
    loanId: string,
    user: AuthenticatedUser,
    options?: { firstDueDate?: string },
  ): Promise<EmployeeLoanRecord> {
    const existing = await this.findOrThrow(loanId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    if (existing.status !== EmployeeLoanStatus.pending_approval) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only pending loans can be approved',
      });
    }

    const firstDueDate = options?.firstDueDate
      ? parseDateString(options.firstDueDate)
      : addMonthsUtc(new Date(), 1);

    const schedule = buildInstallmentSchedule({
      principal: Number(existing.principalAmount),
      interestRatePercent: Number(existing.interestRatePercent),
      tenorMonths: existing.tenorMonths,
      firstDueDate,
    });

    const payComponentId = await this.loanPayroll.ensureLoanDeductionComponent(
      existing.companyId,
    );
    const salaryStructureId = existing.deductFromPayroll
      ? await this.loanPayroll.ensureLoanSalaryStructure({
          employeeId: existing.employeeId,
          payComponentId,
          effectiveFrom: firstDueDate,
        })
      : null;

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      await tx.loanInstallment.createMany({
        data: schedule.map((item) => ({
          loanId: existing.id,
          tenantId: existing.tenantId,
          installmentNumber: item.installmentNumber,
          dueDate: item.dueDate,
          principalPortion: new Prisma.Decimal(item.principalPortion),
          interestPortion: new Prisma.Decimal(item.interestPortion),
          totalDue: new Prisma.Decimal(item.totalDue),
        })),
      });

      return tx.employeeLoan.update({
        where: { id: loanId },
        data: {
          status: EmployeeLoanStatus.active,
          approvedAt: new Date(),
          disbursedAt: new Date(),
          firstDueDate,
          payComponentId,
          salaryStructureId,
        },
        include: this.defaultInclude(),
      });
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'approve',
      module: 'payroll',
      recordId: loanId,
      newValue: { status: 'active', installments: schedule.length },
    });

    return this.toRecord(row);
  }

  async reject(
    loanId: string,
    user: AuthenticatedUser,
    dto: RejectEmployeeLoanDto,
  ): Promise<EmployeeLoanRecord> {
    const existing = await this.findOrThrow(loanId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    if (existing.status !== EmployeeLoanStatus.pending_approval) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only pending loans can be rejected',
      });
    }

    const row = await this.prisma.unscoped.employeeLoan.update({
      where: { id: loanId },
      data: {
        status: EmployeeLoanStatus.rejected,
        rejectedAt: new Date(),
        notes: dto.notes?.trim() ?? existing.notes,
      },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'reject',
      module: 'payroll',
      recordId: loanId,
    });

    return this.toRecord(row);
  }

  private async assertEmployee(employeeId: string, companyId: string) {
    const row = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true, tenantId: true, companyId: true },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }
    return row;
  }

  private async findOrThrow(loanId: string): Promise<LoanWithRelations> {
    const row = await this.prisma.unscoped.employeeLoan.findUnique({
      where: { id: loanId },
      include: this.defaultInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee loan not found',
      });
    }
    return row;
  }

  private defaultInclude() {
    return {
      employee: {
        select: { firstName: true, lastName: true, employeeNumber: true },
      },
      installments: { orderBy: { installmentNumber: 'asc' as const } },
    };
  }

  private toRecord(row: LoanWithRelations): EmployeeLoanRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      employeeId: row.employeeId,
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      employeeNumber: row.employee.employeeNumber,
      referenceNumber: row.referenceNumber,
      loanKind: row.loanKind,
      purposeLabel: row.purposeLabel,
      principalAmount: Number(row.principalAmount),
      interestRatePercent: Number(row.interestRatePercent),
      tenorMonths: row.tenorMonths,
      monthlyInstallment: Number(row.monthlyInstallment),
      totalRepayable: Number(row.totalRepayable),
      repaidAmount: Number(row.repaidAmount),
      remainingBalance: Number(row.remainingBalance),
      installmentsPaid: row.installmentsPaid,
      installmentsTotal: row.tenorMonths,
      deductFromPayroll: row.deductFromPayroll,
      status: row.status,
      firstDueDate: row.firstDueDate ? formatDateValue(row.firstDueDate) : null,
      disbursedAt: row.disbursedAt?.toISOString() ?? null,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      rejectedAt: row.rejectedAt?.toISOString() ?? null,
      payComponentId: row.payComponentId,
      salaryStructureId: row.salaryStructureId,
      notes: row.notes,
      installments: row.installments.map((item) => this.toInstallmentRecord(item)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toInstallmentRecord(row: LoanInstallment): LoanInstallmentRecord {
    return {
      id: row.id,
      loanId: row.loanId,
      installmentNumber: row.installmentNumber,
      dueDate: formatDateValue(row.dueDate),
      principalPortion: Number(row.principalPortion),
      interestPortion: Number(row.interestPortion),
      totalDue: Number(row.totalDue),
      status: row.status,
      paidAt: row.paidAt?.toISOString() ?? null,
      payrollRunId: row.payrollRunId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
