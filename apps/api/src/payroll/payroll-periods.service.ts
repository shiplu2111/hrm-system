import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayrollPeriodStatus, Prisma, type PayrollPeriod } from '@prisma/client';
import type { PayrollPeriodRecord } from '@hrm/shared-types';
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
      orderBy: { startDate: 'desc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async get(companyId: string, periodId: string): Promise<PayrollPeriodRecord> {
    const row = await this.findOrThrow(companyId, periodId);
    return this.toRecord(row);
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

    if (endDate < startDate) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'endDate must be on or after startDate',
      });
    }

    const row = await this.prisma.unscoped.payrollPeriod.create({
      data: {
        companyId,
        startDate,
        endDate,
        paymentDate,
        status: PayrollPeriodStatus.draft,
      },
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

    if (endDate < startDate) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'endDate must be on or after startDate',
      });
    }

    const row = await this.prisma.unscoped.payrollPeriod.update({
      where: { id: periodId },
      data: {
        ...(dto.startDate !== undefined ? { startDate } : {}),
        ...(dto.endDate !== undefined ? { endDate } : {}),
        ...(dto.paymentDate !== undefined ? { paymentDate } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'update',
      module: 'payroll',
      recordId: row.id,
      oldValue: this.toRecord(existing) as unknown as Record<string, unknown>,
      newValue: this.toRecord(row) as unknown as Record<string, unknown>,
    });

    return this.toRecord(row);
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

  private toRecord(row: PayrollPeriod): PayrollPeriodRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      startDate: formatDateOnly(row.startDate),
      endDate: formatDateOnly(row.endDate),
      paymentDate: formatDateOnly(row.paymentDate),
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
