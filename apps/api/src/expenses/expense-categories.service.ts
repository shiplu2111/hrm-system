import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ExpenseCategoryRecord } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateExpenseCategoryDto,
  ListExpenseCategoriesQueryDto,
  UpdateExpenseCategoryDto,
} from './dto/expense.dto';

@Injectable()
export class ExpenseCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
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

    return rows.map((row) => this.toRecord(row));
  }

  async create(
    companyId: string,
    dto: CreateExpenseCategoryDto,
  ): Promise<ExpenseCategoryRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    const row = await this.prisma.unscoped.expenseCategory.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        maxAmountPerClaim:
          dto.maxAmountPerClaim != null
            ? new Prisma.Decimal(dto.maxAmountPerClaim)
            : null,
        maxAmountPerMonth:
          dto.maxAmountPerMonth != null
            ? new Prisma.Decimal(dto.maxAmountPerMonth)
            : null,
        receiptRequired: dto.receiptRequired ?? true,
        isActive: dto.isActive ?? true,
      },
    });

    return this.toRecord(row);
  }

  async update(
    categoryId: string,
    dto: UpdateExpenseCategoryDto,
  ): Promise<ExpenseCategoryRecord> {
    const existing = await this.findOrThrow(categoryId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    const row = await this.prisma.unscoped.expenseCategory.update({
      where: { id: categoryId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() ?? null }
          : {}),
        ...(dto.maxAmountPerClaim !== undefined
          ? {
              maxAmountPerClaim:
                dto.maxAmountPerClaim != null
                  ? new Prisma.Decimal(dto.maxAmountPerClaim)
                  : null,
            }
          : {}),
        ...(dto.maxAmountPerMonth !== undefined
          ? {
              maxAmountPerMonth:
                dto.maxAmountPerMonth != null
                  ? new Prisma.Decimal(dto.maxAmountPerMonth)
                  : null,
            }
          : {}),
        ...(dto.receiptRequired !== undefined
          ? { receiptRequired: dto.receiptRequired }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
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

  private toRecord(row: {
    id: string;
    tenantId: string;
    companyId: string;
    name: string;
    description: string | null;
    maxAmountPerClaim: Prisma.Decimal | null;
    maxAmountPerMonth: Prisma.Decimal | null;
    receiptRequired: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): ExpenseCategoryRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      name: row.name,
      description: row.description,
      maxAmountPerClaim: row.maxAmountPerClaim
        ? Number(row.maxAmountPerClaim)
        : null,
      maxAmountPerMonth: row.maxAmountPerMonth
        ? Number(row.maxAmountPerMonth)
        : null,
      receiptRequired: row.receiptRequired,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
