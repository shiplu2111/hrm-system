import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { LeavePolicyRecord } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type { CreateLeavePolicyDto, UpdateLeavePolicyDto } from './dto/leave.dto';
import { decimalToNumber, formatDateValue, parseDateString } from './leave.utils';

@Injectable()
export class LeavePoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
  ) {}

  async list(companyId: string, leaveTypeId?: string): Promise<LeavePolicyRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const rows = await this.prisma.unscoped.leavePolicy.findMany({
      where: {
        companyId,
        ...(leaveTypeId ? { leaveTypeId } : {}),
      },
      orderBy: [{ leaveTypeId: 'asc' }, { effectiveFrom: 'desc' }],
    });
    return rows.map((row) => this.toRecord(row));
  }

  /**
   * Adds a policy version. The version in effect on `effectiveFrom` is closed the day
   * before, so past accruals keep resolving to the rules that applied at the time.
   */
  async create(companyId: string, dto: CreateLeavePolicyDto): Promise<LeavePolicyRecord> {
    await this.companyScope.assertCompanyInTenant(companyId);
    await this.assertLeaveType(companyId, dto.leaveTypeId);

    const effectiveFrom = parseDateString(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? parseDateString(dto.effectiveTo) : null;
    this.assertDateRange(effectiveFrom, effectiveTo);

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      const versions = await tx.leavePolicy.findMany({
        where: { companyId, leaveTypeId: dto.leaveTypeId },
        orderBy: { effectiveFrom: 'asc' },
      });

      const later = versions.find((v) => v.effectiveFrom >= effectiveFrom);
      if (later) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: `A policy version already starts on ${formatDateValue(later.effectiveFrom)}. Edit that version or choose a later effective date.`,
        });
      }

      const covering = versions.find(
        (v) => v.effectiveTo === null || v.effectiveTo >= effectiveFrom,
      );
      if (covering) {
        const dayBefore = new Date(effectiveFrom);
        dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
        await tx.leavePolicy.update({
          where: { id: covering.id },
          data: { effectiveTo: dayBefore },
        });
      }

      return tx.leavePolicy.create({
        data: {
          companyId,
          leaveTypeId: dto.leaveTypeId,
          entitlementDays: dto.entitlementDays,
          accrualType: dto.accrualType,
          carryForwardMax: dto.carryForwardMax ?? null,
          expiryMonths: dto.expiryMonths ?? null,
          encashmentAllowed: dto.encashmentAllowed ?? false,
          probationRestricted: dto.probationRestricted ?? true,
          allowNegativeBalance: dto.allowNegativeBalance ?? false,
          negativeBalanceCap: dto.allowNegativeBalance ? (dto.negativeBalanceCap ?? null) : null,
          halfDayAllowed: dto.halfDayAllowed ?? true,
          deductPublicHolidays: dto.deductPublicHolidays ?? false,
          approvalSteps: (dto.approvalSteps ?? [
            { roleName: 'Manager' },
            { roleName: 'HR Admin' },
          ]) as unknown as Prisma.InputJsonValue,
          yearlyAccrualAnchor: dto.yearlyAccrualAnchor ?? 'financial_year',
          effectiveFrom,
          effectiveTo,
        },
      });
    });
    return this.toRecord(row);
  }

  async update(
    companyId: string,
    policyId: string,
    dto: UpdateLeavePolicyDto,
  ): Promise<LeavePolicyRecord> {
    const existing = await this.findOrThrow(companyId, policyId);

    if (dto.effectiveFrom !== undefined || dto.effectiveTo !== undefined) {
      const from =
        dto.effectiveFrom !== undefined
          ? parseDateString(dto.effectiveFrom)
          : existing.effectiveFrom;
      const to =
        dto.effectiveTo !== undefined
          ? dto.effectiveTo
            ? parseDateString(dto.effectiveTo)
            : null
          : existing.effectiveTo;
      this.assertDateRange(from, to);

      const overlap = await this.prisma.unscoped.leavePolicy.findFirst({
        where: {
          companyId,
          leaveTypeId: existing.leaveTypeId,
          id: { not: policyId },
          ...(to ? { effectiveFrom: { lte: to } } : {}),
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
        },
      });
      if (overlap) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: `These dates overlap the version effective from ${formatDateValue(overlap.effectiveFrom)}`,
        });
      }
    }

    const row = await this.prisma.unscoped.leavePolicy.update({
      where: { id: policyId },
      data: {
        ...(dto.entitlementDays !== undefined
          ? { entitlementDays: dto.entitlementDays }
          : {}),
        ...(dto.accrualType !== undefined ? { accrualType: dto.accrualType } : {}),
        ...(dto.carryForwardMax !== undefined
          ? { carryForwardMax: dto.carryForwardMax }
          : {}),
        ...(dto.expiryMonths !== undefined ? { expiryMonths: dto.expiryMonths } : {}),
        ...(dto.encashmentAllowed !== undefined
          ? { encashmentAllowed: dto.encashmentAllowed }
          : {}),
        ...(dto.probationRestricted !== undefined
          ? { probationRestricted: dto.probationRestricted }
          : {}),
        ...(dto.allowNegativeBalance !== undefined
          ? {
              allowNegativeBalance: dto.allowNegativeBalance,
              ...(dto.allowNegativeBalance ? {} : { negativeBalanceCap: null }),
            }
          : {}),
        ...(dto.negativeBalanceCap !== undefined && dto.allowNegativeBalance !== false
          ? { negativeBalanceCap: dto.negativeBalanceCap }
          : {}),
        ...(dto.halfDayAllowed !== undefined
          ? { halfDayAllowed: dto.halfDayAllowed }
          : {}),
        ...(dto.deductPublicHolidays !== undefined
          ? { deductPublicHolidays: dto.deductPublicHolidays }
          : {}),
        ...(dto.approvalSteps !== undefined
          ? { approvalSteps: dto.approvalSteps as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.yearlyAccrualAnchor !== undefined
          ? { yearlyAccrualAnchor: dto.yearlyAccrualAnchor }
          : {}),
        ...(dto.effectiveFrom !== undefined
          ? { effectiveFrom: parseDateString(dto.effectiveFrom) }
          : {}),
        ...(dto.effectiveTo !== undefined
          ? { effectiveTo: dto.effectiveTo ? parseDateString(dto.effectiveTo) : null }
          : {}),
      },
    });
    return this.toRecord(row);
  }

  private assertDateRange(from: Date, to: Date | null) {
    if (to && to < from) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Effective to must be on or after effective from',
      });
    }
  }

  private async findOrThrow(companyId: string, policyId: string) {
    await this.companyScope.assertCompanyInTenant(companyId);
    const row = await this.prisma.unscoped.leavePolicy.findFirst({
      where: { id: policyId, companyId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Leave policy not found',
      });
    }
    return row;
  }

  private async assertLeaveType(companyId: string, leaveTypeId: string) {
    const row = await this.prisma.unscoped.leaveType.findFirst({
      where: { id: leaveTypeId, companyId },
    });
    if (!row) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Leave type not found in this company',
      });
    }
  }

  private toRecord(row: Prisma.LeavePolicyGetPayload<object>): LeavePolicyRecord {
    const steps = Array.isArray(row.approvalSteps)
      ? (row.approvalSteps as Array<{ roleName: string }>)
      : [];

    return {
      id: row.id,
      companyId: row.companyId,
      leaveTypeId: row.leaveTypeId,
      entitlementDays: decimalToNumber(row.entitlementDays),
      accrualType: row.accrualType,
      carryForwardMax: row.carryForwardMax
        ? decimalToNumber(row.carryForwardMax)
        : null,
      expiryMonths: row.expiryMonths,
      encashmentAllowed: row.encashmentAllowed,
      probationRestricted: row.probationRestricted,
      allowNegativeBalance: row.allowNegativeBalance,
      negativeBalanceCap: row.negativeBalanceCap
        ? decimalToNumber(row.negativeBalanceCap)
        : null,
      halfDayAllowed: row.halfDayAllowed,
      deductPublicHolidays: row.deductPublicHolidays,
      approvalSteps: steps,
      yearlyAccrualAnchor: row.yearlyAccrualAnchor,
      effectiveFrom: formatDateValue(row.effectiveFrom),
      effectiveTo: row.effectiveTo ? formatDateValue(row.effectiveTo) : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
