import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayrollPeriodStatus, PayrollRunStatus, type PayrollPeriod } from '@prisma/client';
import type {
  PayrollPeriodRecord,
  PayrollPeriodSummary,
  PayrollRunStatus as SharedPayrollRunStatus,
} from '@hrm/shared-types';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreatePayrollPeriodDto,
  ListPayrollPeriodsQueryDto,
  UpdatePayrollPeriodDto,
} from './dto/payroll-periods.dto';
import { formatDateOnly, parseDateOnly } from './payroll.utils';
import { summarizePeriodRuns } from './payroll-run.utils';

@Injectable()
export class PayrollPeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async list(
    companyId: string,
    query: ListPayrollPeriodsQueryDto,
  ): Promise<PayrollPeriodRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const rows = await this.prisma.unscoped.payrollPeriod.findMany({
      where: {
        companyId,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
    const summaries = await this.summaries(rows.map((row) => row.id));
    return rows.map((row) => this.toRecord(row, summaries.get(row.id)));
  }

  async get(companyId: string, periodId: string): Promise<PayrollPeriodRecord> {
    const row = await this.findOrThrow(companyId, periodId);
    const summaries = await this.summaries([row.id]);
    return this.toRecord(row, summaries.get(row.id));
  }

  async create(
    companyId: string,
    dto: CreatePayrollPeriodDto,
    user: AuthenticatedUser,
  ): Promise<PayrollPeriodRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const startDate = parseDateOnly(dto.startDate, 'startDate');
    const endDate = parseDateOnly(dto.endDate, 'endDate');
    const paymentDate = parseDateOnly(dto.paymentDate, 'paymentDate');
    this.assertDates(startDate, endDate, paymentDate);

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      const created = await tx.payrollPeriod.create({
        data: {
          companyId,
          startDate,
          endDate,
          paymentDate,
          status: PayrollPeriodStatus.draft,
        },
      });
      await this.auditService.log(
        {
          tenantId: company.tenantId,
          userId: user.id,
          action: 'create',
          module: 'payroll',
          recordId: created.id,
          newValue: this.toRecord(created) as unknown as Record<string, unknown>,
        },
        tx,
      );
      return created;
    });

    return this.toRecord(row, summarizePeriodRuns([]));
  }

  async update(
    companyId: string,
    periodId: string,
    dto: UpdatePayrollPeriodDto,
    user: AuthenticatedUser,
  ): Promise<PayrollPeriodRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const existing = await this.findOrThrow(companyId, periodId);

    if (existing.status === PayrollPeriodStatus.closed) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Closed payroll periods cannot be modified',
      });
    }

    const startDate = dto.startDate
      ? parseDateOnly(dto.startDate, 'startDate')
      : existing.startDate;
    const endDate = dto.endDate
      ? parseDateOnly(dto.endDate, 'endDate')
      : existing.endDate;
    const paymentDate = dto.paymentDate
      ? parseDateOnly(dto.paymentDate, 'paymentDate')
      : existing.paymentDate;
    this.assertDates(startDate, endDate, paymentDate);

    const datesChanged =
      startDate.getTime() !== existing.startDate.getTime() ||
      endDate.getTime() !== existing.endDate.getTime();
    if (datesChanged) {
      const calculated = await this.prisma.unscoped.payrollRun.count({
        where: {
          payrollPeriodId: periodId,
          deletedAt: null,
          status: { notIn: [PayrollRunStatus.draft, PayrollRunStatus.cancelled] },
        },
      });
      if (calculated > 0) {
        throw new ConflictException({
          code: 'CONFLICT',
          message:
            'The period dates can’t change after pay has been calculated for it. Only the payment date can still be changed.',
        });
      }
    }

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      const updated = await tx.payrollPeriod.update({
        where: { id: periodId },
        data: {
          ...(dto.startDate !== undefined ? { startDate } : {}),
          ...(dto.endDate !== undefined ? { endDate } : {}),
          ...(dto.paymentDate !== undefined ? { paymentDate } : {}),
        },
      });
      await this.auditService.log(
        {
          tenantId: company.tenantId,
          userId: user.id,
          action: 'update',
          module: 'payroll',
          recordId: updated.id,
          oldValue: this.toRecord(existing) as unknown as Record<string, unknown>,
          newValue: this.toRecord(updated) as unknown as Record<string, unknown>,
        },
        tx,
      );
      return updated;
    });

    const summaries = await this.summaries([row.id]);
    return this.toRecord(row, summaries.get(row.id));
  }

  private assertDates(startDate: Date, endDate: Date, paymentDate: Date): void {
    if (endDate < startDate) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'endDate must be on or after startDate',
      });
    }
    if (paymentDate < startDate) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'paymentDate must be on or after startDate',
      });
    }
  }

  private async summaries(periodIds: string[]): Promise<Map<string, PayrollPeriodSummary>> {
    const runs = periodIds.length
      ? await this.prisma.unscoped.payrollRun.findMany({
          where: { payrollPeriodId: { in: periodIds }, deletedAt: null },
          select: {
            payrollPeriodId: true,
            status: true,
            grossPay: true,
            totalDeductions: true,
            netPay: true,
            grossPayBase: true,
            totalDeductionsBase: true,
            netPayBase: true,
            baseCurrency: true,
            exchangeRate: true,
          },
        })
      : [];
    const byPeriod = new Map<string, typeof runs>();
    for (const run of runs) {
      const list = byPeriod.get(run.payrollPeriodId) ?? [];
      list.push(run);
      byPeriod.set(run.payrollPeriodId, list);
    }
    return new Map(
      periodIds.map((id) => [
        id,
        summarizePeriodRuns(
          (byPeriod.get(id) ?? []).map((run) => ({
            ...run,
            status: run.status as SharedPayrollRunStatus,
          })),
        ),
      ]),
    );
  }

  private async findOrThrow(companyId: string, periodId: string) {
    await this.companyScope.assertCompanyInTenant(companyId);
    const row = await this.prisma.unscoped.payrollPeriod.findFirst({
      where: { id: periodId, companyId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Payroll period not found',
      });
    }
    return row;
  }

  private toRecord(row: PayrollPeriod, summary?: PayrollPeriodSummary): PayrollPeriodRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      startDate: formatDateOnly(row.startDate),
      endDate: formatDateOnly(row.endDate),
      paymentDate: formatDateOnly(row.paymentDate),
      status: row.status,
      ...(summary ? { summary } : {}),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
