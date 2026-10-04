import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExpenseClaimStatus, Prisma, type ExpenseCategory } from '@prisma/client';
import type { ExpenseCategoryRecord, ExpenseCategoryUsage } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateExpenseCategoryDto,
  ListExpenseCategoriesQueryDto,
  UpdateExpenseCategoryDto,
} from './dto/expense.dto';
import { assertLimitOrder, monthBounds } from './expense.utils';

@Injectable()
export class ExpenseCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async list(
    companyId: string,
    query: ListExpenseCategoriesQueryDto,
  ): Promise<ExpenseCategoryRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.expenseCategory.findMany({
      where: {
        companyId,
        ...(query.activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ name: 'asc' }],
    });

    const usage = await this.loadUsage(companyId);
    return rows.map((row) => ({
      ...this.toRecord(row),
      usage: usage.get(row.id) ?? { claimCount: 0, openClaimCount: 0, monthToDateAmount: 0 },
    }));
  }

  async create(
    companyId: string,
    dto: CreateExpenseCategoryDto,
    user: AuthenticatedUser,
  ): Promise<ExpenseCategoryRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    this.assertLimits(dto.maxAmountPerClaim ?? null, dto.maxAmountPerMonth ?? null);

    const row = await this.withUniqueName(() =>
      this.prisma.unscoped.expenseCategory.create({
        data: {
          tenantId: company.tenantId,
          companyId,
          name: dto.name,
          description: dto.description || null,
          maxAmountPerClaim: this.toDecimal(dto.maxAmountPerClaim),
          maxAmountPerMonth: this.toDecimal(dto.maxAmountPerMonth),
          receiptRequired: dto.receiptRequired ?? true,
          isActive: dto.isActive ?? true,
        },
      }),
    );

    await this.auditService.log({
      tenantId: row.tenantId,
      userId: user.id,
      action: 'create',
      module: 'expense',
      recordId: row.id,
      newValue: this.auditSnapshot(row),
    });

    return this.toRecord(row);
  }

  async update(
    categoryId: string,
    dto: UpdateExpenseCategoryDto,
    user: AuthenticatedUser,
  ): Promise<ExpenseCategoryRecord> {
    const existing = await this.findOrThrow(categoryId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    const perClaim =
      dto.maxAmountPerClaim !== undefined
        ? dto.maxAmountPerClaim
        : this.toNumber(existing.maxAmountPerClaim);
    const perMonth =
      dto.maxAmountPerMonth !== undefined
        ? dto.maxAmountPerMonth
        : this.toNumber(existing.maxAmountPerMonth);
    this.assertLimits(perClaim, perMonth);

    const row = await this.withUniqueName(() =>
      this.prisma.unscoped.expenseCategory.update({
        where: { id: categoryId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description || null }
            : {}),
          ...(dto.maxAmountPerClaim !== undefined
            ? { maxAmountPerClaim: this.toDecimal(dto.maxAmountPerClaim) }
            : {}),
          ...(dto.maxAmountPerMonth !== undefined
            ? { maxAmountPerMonth: this.toDecimal(dto.maxAmountPerMonth) }
            : {}),
          ...(dto.receiptRequired !== undefined
            ? { receiptRequired: dto.receiptRequired }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      }),
    );

    await this.auditService.log({
      tenantId: row.tenantId,
      userId: user.id,
      action: 'update',
      module: 'expense',
      recordId: row.id,
      oldValue: this.auditSnapshot(existing),
      newValue: this.auditSnapshot(row),
    });

    return this.toRecord(row);
  }

  async findOrThrow(categoryId: string) {
    const row = await this.prisma.unscoped.expenseCategory.findUnique({
      where: { id: categoryId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Expense category not found',
      });
    }
    return row;
  }

  private async loadUsage(companyId: string): Promise<Map<string, ExpenseCategoryUsage>> {
    const { start, end } = monthBounds(new Date());
    const [byStatus, monthToDate] = await Promise.all([
      this.prisma.unscoped.expenseClaim.groupBy({
        by: ['categoryId', 'status'],
        where: { companyId },
        _count: { _all: true },
      }),
      this.prisma.unscoped.expenseClaim.groupBy({
        by: ['categoryId'],
        where: {
          companyId,
          expenseDate: { gte: start, lte: end },
          status: {
            in: [
              ExpenseClaimStatus.pending_approval,
              ExpenseClaimStatus.approved,
              ExpenseClaimStatus.reimbursed,
            ],
          },
        },
        _sum: { amount: true },
      }),
    ]);

    const usage = new Map<string, ExpenseCategoryUsage>();
    const entry = (categoryId: string) => {
      let value = usage.get(categoryId);
      if (!value) {
        value = { claimCount: 0, openClaimCount: 0, monthToDateAmount: 0 };
        usage.set(categoryId, value);
      }
      return value;
    };
    for (const row of byStatus) {
      const value = entry(row.categoryId);
      value.claimCount += row._count._all;
      if (
        row.status === ExpenseClaimStatus.draft ||
        row.status === ExpenseClaimStatus.pending_approval
      ) {
        value.openClaimCount += row._count._all;
      }
    }
    for (const row of monthToDate) {
      entry(row.categoryId).monthToDateAmount = Number(row._sum.amount ?? 0);
    }
    return usage;
  }

  private assertLimits(perClaim: number | null, perMonth: number | null) {
    try {
      assertLimitOrder(perClaim, perMonth);
    } catch (error) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: error instanceof Error ? error.message : 'Invalid limits',
      });
    }
  }

  private async withUniqueName<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'An expense category with this name already exists',
        });
      }
      throw error;
    }
  }

  private toDecimal(value: number | null | undefined): Prisma.Decimal | null {
    return value == null ? null : new Prisma.Decimal(value);
  }

  private toNumber(value: Prisma.Decimal | null): number | null {
    return value == null ? null : Number(value);
  }

  private auditSnapshot(row: ExpenseCategory) {
    return {
      name: row.name,
      maxAmountPerClaim: this.toNumber(row.maxAmountPerClaim),
      maxAmountPerMonth: this.toNumber(row.maxAmountPerMonth),
      receiptRequired: row.receiptRequired,
      isActive: row.isActive,
    };
  }

  private toRecord(row: ExpenseCategory): ExpenseCategoryRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      name: row.name,
      description: row.description,
      maxAmountPerClaim: this.toNumber(row.maxAmountPerClaim),
      maxAmountPerMonth: this.toNumber(row.maxAmountPerMonth),
      receiptRequired: row.receiptRequired,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
