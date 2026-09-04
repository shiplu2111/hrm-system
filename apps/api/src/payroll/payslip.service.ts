import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayrollRunStatus, type Payslip } from '@prisma/client';
import type { PayslipRecord } from '@hrm/shared-types';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { FileMeta } from '../storage/storage.types';
import { PayrollCalculationService } from './payroll-calculation.service';
import { renderPayslipPdf } from './payslip-pdf.generator';
import { formatDateOnly, formatMoney } from './payroll.utils';

@Injectable()
export class PayslipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly payrollCalculationService: PayrollCalculationService,
    private readonly auditService: AuditService,
  ) {}

  async listForEmployee(employeeId: string): Promise<PayslipRecord[]> {
    await this.assertEmployee(employeeId);
    const rows = await this.prisma.unscoped.payslip.findMany({
      where: { payrollRun: { employeeId, deletedAt: null } },
      include: {
        payrollRun: { select: { employeeId: true } },
      },
      orderBy: { generatedAt: 'desc' },
    });

    return Promise.all(rows.map((row) => this.toRecord(row)));
  }

  async getForRun(companyId: string, runId: string): Promise<PayslipRecord> {
    const row = await this.prisma.unscoped.payslip.findFirst({
      where: {
        payrollRunId: runId,
        payrollRun: { payrollPeriod: { companyId }, deletedAt: null },
      },
      include: { payrollRun: { select: { employeeId: true } } },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Payslip not found for this payroll run',
      });
    }
    return this.toRecord(row);
  }

  async downloadPayslipFile(
    employeeId: string,
    payslipId: string,
    user: AuthenticatedUser,
  ): Promise<{ buffer: Buffer; meta: FileMeta; filename: string }> {
    await this.assertEmployee(employeeId);
    this.assertCanAccessPayslip(employeeId, user);

    const row = await this.prisma.unscoped.payslip.findFirst({
      where: {
        id: payslipId,
        payrollRun: { employeeId, deletedAt: null },
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Payslip not found',
      });
    }

    const { buffer, meta } = await this.storageService.read(row.fileKey);
    return {
      buffer,
      meta,
      filename: meta.originalName ?? 'payslip.pdf',
    };
  }

  /**
   * Generate and store payslip PDF on payroll finalization (MODULES.md §19).
   * Idempotent — returns existing payslip if already generated.
   */
  async generateForPayrollRun(
    runId: string,
    tenantId: string,
    userId: string,
  ): Promise<PayslipRecord> {
    const existing = await this.prisma.unscoped.payslip.findUnique({
      where: { payrollRunId: runId },
      include: { payrollRun: { select: { employeeId: true } } },
    });
    if (existing) {
      return this.toRecord(existing);
    }

    const run = await this.prisma.unscoped.payrollRun.findFirst({
      where: { id: runId, deletedAt: null },
      include: {
        payrollPeriod: {
          include: { company: { select: { name: true, tenantId: true } } },
        },
        employee: {
          include: {
            department: { select: { name: true } },
            designation: { select: { name: true } },
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Payroll run not found',
      });
    }

    if (
      run.status !== PayrollRunStatus.finalized &&
      run.status !== PayrollRunStatus.paid
    ) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Payslips can only be generated for finalized payroll runs',
      });
    }

    const asOf = formatDateOnly(run.payrollPeriod.endDate);
    const calculation = await this.payrollCalculationService.compute({
      employeeId: run.employeeId,
      asOf,
    });

    const pdfBuffer = await renderPayslipPdf({
      companyName: run.payrollPeriod.company.name,
      employeeName: `${run.employee.firstName} ${run.employee.lastName}`.trim(),
      employeeNumber: run.employee.employeeNumber,
      department: run.employee.department?.name,
      designation: run.employee.designation?.name,
      periodLabel: `${formatDateOnly(run.payrollPeriod.startDate)} — ${formatDateOnly(run.payrollPeriod.endDate)}`,
      paymentDate: formatDateOnly(run.payrollPeriod.paymentDate),
      earnings: calculation.earnings.map((line) => ({
        label: line.componentName,
        amount: line.amount,
      })),
      deductions: calculation.deductions.map((line) => ({
        label: line.componentName,
        amount: line.amount,
      })),
      grossPay: calculation.grossPay,
      totalDeductions: calculation.totalDeductions,
      netPay: calculation.netPay,
    });

    const fileKey = this.storageService.buildPayslipKey(tenantId, runId);
    await this.storageService.upload(fileKey, pdfBuffer, {
      contentType: 'application/pdf',
      originalName: `payslip-${run.employee.employeeNumber}-${asOf}.pdf`,
      size: pdfBuffer.length,
    });

    const row = await this.prisma.unscoped.payslip.create({
      data: {
        payrollRunId: runId,
        fileKey,
        generatedAt: new Date(),
      },
      include: { payrollRun: { select: { employeeId: true } } },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'create',
      module: 'payroll',
      recordId: row.id,
      newValue: {
        ...this.toRecordSync(row),
        payrollRunId: runId,
        calculationSummary: {
          grossPay: calculation.grossPay,
          netPay: calculation.netPay,
        },
      } as unknown as Record<string, unknown>,
    });

    return this.toRecord(row);
  }

  private async toRecord(
    row: Payslip & { payrollRun: { employeeId: string } },
  ): Promise<PayslipRecord> {
    const employeeId = row.payrollRun.employeeId;
    return {
      ...this.toRecordSync(row),
      downloadUrl: `/employees/${employeeId}/payslips/${row.id}/download`,
    };
  }

  private toRecordSync(
    row: Payslip & { payrollRun: { employeeId: string } },
  ): PayslipRecord {
    return {
      id: row.id,
      payrollRunId: row.payrollRunId,
      employeeId: row.payrollRun.employeeId,
      fileKey: row.fileKey,
      generatedAt: row.generatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async assertEmployee(employeeId: string) {
    const row = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }
  }

  private assertCanAccessPayslip(
    employeeId: string,
    user: AuthenticatedUser,
  ): void {
    if (
      user.employeeId &&
      user.employeeId !== employeeId &&
      !this.canViewAnyEmployeePayslip(user)
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Cannot download another employee payslip',
      });
    }
  }

  private canViewAnyEmployeePayslip(user: AuthenticatedUser): boolean {
    return user.permissions.some(
      (permission) =>
        permission.module === 'payroll' &&
        ['create', 'edit', 'approve', 'finalize'].includes(permission.action),
    );
  }
}
