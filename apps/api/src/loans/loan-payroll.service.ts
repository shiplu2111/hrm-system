import { Injectable } from '@nestjs/common';
import {
  EmployeeLoanStatus,
  LoanInstallmentStatus,
  PayComponentCalculationType,
  PayComponentType,
  Prisma,
  SalaryStructureComponentType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PAY_FORMULA_LOAN_INSTALLMENT } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { LOAN_DEDUCTION_COMPONENT_NAME } from './loan.utils';

const ZERO = new Decimal(0);

export interface LoanFormulaSnapshot {
  installmentAmount: Decimal;
  remainingBalance: Decimal;
  activeCount: Decimal;
}

@Injectable()
export class LoanPayrollService {
  constructor(private readonly prisma: PrismaService) {}

  async getFormulaSnapshot(
    employeeId: string,
    periodFrom: Date,
    periodTo: Date,
  ): Promise<LoanFormulaSnapshot> {
    const installments = await this.prisma.unscoped.loanInstallment.findMany({
      where: {
        status: LoanInstallmentStatus.scheduled,
        dueDate: { gte: periodFrom, lte: periodTo },
        loan: {
          employeeId,
          status: EmployeeLoanStatus.active,
          deductFromPayroll: true,
        },
      },
      include: {
        loan: { select: { remainingBalance: true } },
      },
    });

    let installmentAmount = ZERO;
    for (const row of installments) {
      installmentAmount = installmentAmount.plus(row.totalDue);
    }

    const activeLoans = await this.prisma.unscoped.employeeLoan.findMany({
      where: {
        employeeId,
        status: EmployeeLoanStatus.active,
        deductFromPayroll: true,
      },
      select: { remainingBalance: true },
    });

    const remainingBalance = activeLoans.reduce(
      (sum, loan) => sum.plus(loan.remainingBalance),
      ZERO,
    );

    return {
      installmentAmount,
      remainingBalance,
      activeCount: new Decimal(activeLoans.length),
    };
  }

  async ensureLoanDeductionComponent(companyId: string): Promise<string> {
    const existing = await this.prisma.unscoped.payComponent.findFirst({
      where: { companyId, name: LOAN_DEDUCTION_COMPONENT_NAME },
    });
    if (existing) return existing.id;

    const created = await this.prisma.unscoped.payComponent.create({
      data: {
        companyId,
        name: LOAN_DEDUCTION_COMPONENT_NAME,
        type: PayComponentType.deduction,
        calculationType: PayComponentCalculationType.formula,
        formula: PAY_FORMULA_LOAN_INSTALLMENT as unknown as Prisma.InputJsonValue,
      },
    });

    return created.id;
  }

  async ensureLoanSalaryStructure(input: {
    employeeId: string;
    payComponentId: string;
    effectiveFrom: Date;
  }): Promise<string> {
    const existing = await this.prisma.unscoped.salaryStructure.findFirst({
      where: {
        employeeId: input.employeeId,
        componentId: input.payComponentId,
        componentType: SalaryStructureComponentType.deduction,
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.effectiveFrom } }],
      },
    });
    if (existing) return existing.id;

    const created = await this.prisma.unscoped.salaryStructure.create({
      data: {
        employeeId: input.employeeId,
        componentType: SalaryStructureComponentType.deduction,
        componentId: input.payComponentId,
        amountOrFormula: {},
        effectiveFrom: input.effectiveFrom,
      },
    });

    return created.id;
  }

  async settleDueInstallments(input: {
    employeeId: string;
    payrollRunId: string;
    periodFrom: Date;
    periodTo: Date;
  }): Promise<number> {
    const dueInstallments = await this.prisma.unscoped.loanInstallment.findMany({
      where: {
        status: LoanInstallmentStatus.scheduled,
        dueDate: { gte: input.periodFrom, lte: input.periodTo },
        loan: {
          employeeId: input.employeeId,
          status: EmployeeLoanStatus.active,
          deductFromPayroll: true,
        },
      },
      include: { loan: true },
      orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }],
    });

    if (dueInstallments.length === 0) return 0;

    const now = new Date();
    let settled = 0;

    for (const installment of dueInstallments) {
      await this.prisma.unscoped.loanInstallment.update({
        where: { id: installment.id },
        data: {
          status: LoanInstallmentStatus.paid,
          paidAt: now,
          payrollRunId: input.payrollRunId,
        },
      });

      const repaidAmount = installment.loan.repaidAmount.plus(installment.totalDue);
      const remainingBalance = installment.loan.remainingBalance.minus(
        installment.totalDue,
      );
      const installmentsPaid = installment.loan.installmentsPaid + 1;
      const isFullyPaid =
        remainingBalance.lte(0) ||
        installmentsPaid >= installment.loan.tenorMonths;

      await this.prisma.unscoped.employeeLoan.update({
        where: { id: installment.loanId },
        data: {
          repaidAmount,
          remainingBalance: remainingBalance.lt(0) ? ZERO : remainingBalance,
          installmentsPaid,
          status: isFullyPaid
            ? EmployeeLoanStatus.fully_paid
            : EmployeeLoanStatus.active,
        },
      });

      settled += 1;
    }

    return settled;
  }
}
