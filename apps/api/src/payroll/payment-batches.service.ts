import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentBatchItemStatus,
  PaymentBatchStatus,
  PayrollRunStatus,
  type PaymentBatch,
  type PaymentBatchItem,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type {
  PaymentBatchItemRecord,
  PaymentBatchRecord,
  PaymentBatchStatus as SharedPaymentBatchStatus,
  PaymentBatchTransitionResult,
} from '@hrm/shared-types';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type { CreatePaymentBatchDto } from './dto/payment-batches.dto';
import {
  assertPaymentBatchTransition,
  generatePaymentBatchReference,
} from './payment-batch.utils';
import { formatMoney } from './payroll.utils';

type BatchWithItems = PaymentBatch & {
  items: (PaymentBatchItem & {
    employee: { firstName: string; lastName: string };
  })[];
};

@Injectable()
export class PaymentBatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async list(companyId: string): Promise<PaymentBatchRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const rows = await this.prisma.unscoped.paymentBatch.findMany({
      where: { companyId },
      include: this.itemInclude(),
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async get(companyId: string, batchId: string): Promise<PaymentBatchRecord> {
    const row = await this.findOrThrow(companyId, batchId);
    return this.toRecord(row);
  }

  /** Build a draft batch from finalized (unbatched) runs in a payroll period. */
  async create(
    companyId: string,
    dto: CreatePaymentBatchDto,
    user: AuthenticatedUser,
  ): Promise<PaymentBatchRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    const period = await this.prisma.unscoped.payrollPeriod.findFirst({
      where: { id: dto.payrollPeriodId, companyId },
    });
    if (!period) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Payroll period not found',
      });
    }

    const runs = await this.prisma.unscoped.payrollRun.findMany({
      where: {
        payrollPeriodId: dto.payrollPeriodId,
        deletedAt: null,
        status: { in: [PayrollRunStatus.finalized, PayrollRunStatus.paid] },
        paymentBatchItem: null,
        ...(dto.payrollRunIds?.length
          ? { id: { in: dto.payrollRunIds } }
          : {}),
      },
    });

    if (runs.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No eligible finalized payroll runs available for this batch',
      });
    }

    const totalAmount = runs.reduce(
      (sum, run) => sum.plus(run.netPay),
      new Decimal(0),
    );

    const row = await this.prisma.unscoped.paymentBatch.create({
      data: {
        companyId,
        payrollPeriodId: dto.payrollPeriodId,
        referenceNumber: generatePaymentBatchReference(period.endDate),
        status: PaymentBatchStatus.draft,
        totalAmount,
        itemCount: runs.length,
        items: {
          create: runs.map((run) => ({
            payrollRunId: run.id,
            employeeId: run.employeeId,
            amount: run.netPay,
            status: PaymentBatchItemStatus.pending,
          })),
        },
      },
      include: this.itemInclude(),
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'payroll',
      recordId: row.id,
      newValue: this.toRecord(row) as unknown as Record<string, unknown>,
    });

    return this.toRecord(row);
  }

  async submit(
    companyId: string,
    batchId: string,
    user: AuthenticatedUser,
  ): Promise<PaymentBatchTransitionResult> {
    return this.transition(companyId, batchId, 'pending', user, {
      submittedAt: new Date(),
    });
  }

  async markPaid(
    companyId: string,
    batchId: string,
    user: AuthenticatedUser,
    transactionReference?: string,
  ): Promise<PaymentBatchTransitionResult> {
    return this.transition(companyId, batchId, 'paid', user, {
      paidAt: new Date(),
      transactionReference: transactionReference?.trim() || null,
      itemStatus: PaymentBatchItemStatus.paid,
      itemTransactionReference: transactionReference?.trim() || null,
    });
  }

  async markFailed(
    companyId: string,
    batchId: string,
    user: AuthenticatedUser,
    failureReason: string,
  ): Promise<PaymentBatchTransitionResult> {
    return this.transition(companyId, batchId, 'failed', user, {
      failedAt: new Date(),
      failureReason: failureReason.trim(),
      itemStatus: PaymentBatchItemStatus.failed,
      itemFailureReason: failureReason.trim(),
    });
  }

  private async transition(
    companyId: string,
    batchId: string,
    targetStatus: SharedPaymentBatchStatus,
    user: AuthenticatedUser,
    extras: {
      submittedAt?: Date;
      paidAt?: Date;
      failedAt?: Date;
      transactionReference?: string | null;
      failureReason?: string;
      itemStatus?: PaymentBatchItemStatus;
      itemTransactionReference?: string | null;
      itemFailureReason?: string;
    },
  ): Promise<PaymentBatchTransitionResult> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const existing = await this.findOrThrow(companyId, batchId);
    const previousStatus = existing.status as SharedPaymentBatchStatus;

    if (previousStatus === targetStatus) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Payment batch is already in the requested status',
      });
    }

    assertPaymentBatchTransition(previousStatus, targetStatus);

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      const updated = await tx.paymentBatch.update({
        where: { id: batchId },
        data: {
          status: targetStatus as PaymentBatchStatus,
          ...(extras.submittedAt ? { submittedAt: extras.submittedAt } : {}),
          ...(extras.paidAt ? { paidAt: extras.paidAt } : {}),
          ...(extras.failedAt ? { failedAt: extras.failedAt } : {}),
          ...(extras.transactionReference !== undefined
            ? { transactionReference: extras.transactionReference }
            : {}),
          ...(extras.failureReason !== undefined
            ? { failureReason: extras.failureReason }
            : {}),
        },
        include: this.itemInclude(),
      });

      if (extras.itemStatus) {
        await tx.paymentBatchItem.updateMany({
          where: { paymentBatchId: batchId },
          data: {
            status: extras.itemStatus,
            ...(extras.itemTransactionReference !== undefined
              ? { transactionReference: extras.itemTransactionReference }
              : {}),
            ...(extras.itemFailureReason !== undefined
              ? { failureReason: extras.itemFailureReason }
              : {}),
          },
        });
      }

      return tx.paymentBatch.findUniqueOrThrow({
        where: { id: batchId },
        include: this.itemInclude(),
      });
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: targetStatus === 'paid' ? 'finalize' : 'update',
      module: 'payroll',
      recordId: batchId,
      oldValue: {
        ...this.toRecord(existing),
        transition: { from: previousStatus, to: targetStatus },
      } as unknown as Record<string, unknown>,
      newValue: this.toRecord(row) as unknown as Record<string, unknown>,
    });

    return {
      batch: this.toRecord(row),
      previousStatus,
      newStatus: targetStatus,
    };
  }

  private itemInclude() {
    return {
      items: {
        include: {
          employee: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'asc' as const },
      },
    };
  }

  private async findOrThrow(
    companyId: string,
    batchId: string,
  ): Promise<BatchWithItems> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const row = await this.prisma.unscoped.paymentBatch.findFirst({
      where: { id: batchId, companyId },
      include: this.itemInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Payment batch not found',
      });
    }
    return row;
  }

  private toRecord(row: BatchWithItems): PaymentBatchRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      payrollPeriodId: row.payrollPeriodId,
      referenceNumber: row.referenceNumber,
      status: row.status as SharedPaymentBatchStatus,
      totalAmount: formatMoney(row.totalAmount),
      itemCount: row.itemCount,
      transactionReference: row.transactionReference,
      failureReason: row.failureReason,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      paidAt: row.paidAt?.toISOString() ?? null,
      failedAt: row.failedAt?.toISOString() ?? null,
      items: row.items.map((item) => this.toItemRecord(item)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toItemRecord(
    item: PaymentBatchItem & {
      employee: { firstName: string; lastName: string };
    },
  ): PaymentBatchItemRecord {
    return {
      id: item.id,
      payrollRunId: item.payrollRunId,
      employeeId: item.employeeId,
      employeeName: `${item.employee.firstName} ${item.employee.lastName}`.trim(),
      amount: formatMoney(item.amount),
      status: item.status,
      transactionReference: item.transactionReference,
      failureReason: item.failureReason,
    };
  }
}
