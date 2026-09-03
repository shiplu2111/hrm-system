import {
  BadRequestException,
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

  async create(companyId: string, dto: CreateLeavePolicyDto): Promise<LeavePolicyRecord> {
    await this.companyScope.assertCompanyInTenant(companyId);
    await this.assertLeaveType(companyId, dto.leaveTypeId);

    const row = await this.prisma.unscoped.leavePolicy.create({
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
        negativeBalanceCap: dto.negativeBalanceCap ?? null,
        halfDayAllowed: dto.halfDayAllowed ?? true,
        deductPublicHolidays: dto.deductPublicHolidays ?? false,
        approvalSteps: (dto.approvalSteps ?? [
          { roleName: 'Manager' },
          { roleName: 'HR Admin' },
        ]) as unknown as Prisma.InputJsonValue,
        yearlyAccrualAnchor: dto.yearlyAccrualAnchor ?? 'financial_year',
        effectiveFrom: parseDateString(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? parseDateString(dto.effectiveTo) : null,
      },
    });
    return this.toRecord(row);
  }

  async update(
    companyId: string,
    policyId: string,
    dto: UpdateLeavePolicyDto,
  ): Promise<LeavePolicyRecord> {
    await this.findOrThrow(companyId, policyId);
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
          ? { allowNegativeBalance: dto.allowNegativeBalance }
          : {}),
        ...(dto.negativeBalanceCap !== undefined
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
