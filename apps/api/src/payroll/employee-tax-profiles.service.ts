import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  EmployeeTaxProfileView,
  RevealedSensitiveField,
} from '@hrm/shared-types';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SensitiveFieldService } from '../crypto/sensitive-field.service';
import { PrismaService } from '../database/prisma.service';

export interface UpdateEmployeeTaxProfileInput {
  taxIdNumber?: string | null;
  bankAccountNumber?: string | null;
  taxSettings?: Record<string, unknown>;
}

@Injectable()
export class EmployeeTaxProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sensitiveFields: SensitiveFieldService,
    private readonly auditService: AuditService,
  ) {}

  async getMasked(employeeId: string): Promise<EmployeeTaxProfileView> {
    const row = await this.findProfileOrThrow(employeeId);
    return this.toMaskedView(row);
  }

  async revealField(
    employeeId: string,
    field: 'taxIdNumber' | 'bankAccountNumber',
    user: AuthenticatedUser,
    meta?: { ipAddress?: string; device?: string },
  ): Promise<RevealedSensitiveField> {
    const row = await this.findProfileOrThrow(employeeId);
    const stored =
      field === 'taxIdNumber' ? row.taxIdNumber : row.bankAccountNumber;
    const value = this.sensitiveFields.reveal(stored);
    if (!value) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `${field} is not set for this employee`,
      });
    }

    await this.auditService.log({
      tenantId: (await this.loadEmployeeTenant(employeeId)).tenantId,
      userId: user.id,
      action: 'update',
      module: 'payroll',
      recordId: row.id,
      newValue: { field, employeeId, sensitiveReveal: true },
      ipAddress: meta?.ipAddress,
      device: meta?.device,
    });

    return { field, value };
  }

  async upsert(
    employeeId: string,
    input: UpdateEmployeeTaxProfileInput,
    user: AuthenticatedUser,
    meta?: { ipAddress?: string; device?: string },
  ): Promise<EmployeeTaxProfileView> {
    const employee = await this.loadEmployeeTenant(employeeId);
    const existing = await this.prisma.unscoped.employeeTaxProfile.findFirst({
      where: { employeeId },
    });

    const data: Prisma.EmployeeTaxProfileUpdateInput = {};

    if (input.taxIdNumber !== undefined) {
      data.taxIdNumber = this.sensitiveFields.encryptIfPresent(
        input.taxIdNumber ?? undefined,
      );
    }
    if (input.bankAccountNumber !== undefined) {
      data.bankAccountNumber = this.sensitiveFields.encryptIfPresent(
        input.bankAccountNumber ?? undefined,
      );
    }
    if (input.taxSettings !== undefined) {
      data.taxSettings = input.taxSettings as Prisma.InputJsonValue;
    }

    const row = existing
      ? await this.prisma.unscoped.employeeTaxProfile.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.unscoped.employeeTaxProfile.create({
          data: {
            employeeId,
            taxSettings: (input.taxSettings ?? {}) as Prisma.InputJsonValue,
            taxIdNumber: this.sensitiveFields.encryptIfPresent(
              input.taxIdNumber ?? undefined,
            ),
            bankAccountNumber: this.sensitiveFields.encryptIfPresent(
              input.bankAccountNumber ?? undefined,
            ),
          },
        });

    await this.auditService.log({
      tenantId: employee.tenantId,
      userId: user.id,
      action: existing ? 'update' : 'create',
      module: 'payroll',
      recordId: row.id,
      newValue: {
        employeeId,
        taxIdNumber: row.taxIdNumber ? '****' : null,
        bankAccountNumber: row.bankAccountNumber ? '****' : null,
      },
      ipAddress: meta?.ipAddress,
      device: meta?.device,
    });

    return this.toMaskedView(row);
  }

  maskStoredTaxId(stored: string | null | undefined): string {
    return this.sensitiveFields.mask(stored) ?? '';
  }

  private async findProfileOrThrow(employeeId: string) {
    await this.assertEmployee(employeeId);
    const row = await this.prisma.unscoped.employeeTaxProfile.findFirst({
      where: { employeeId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Tax profile not found for this employee',
      });
    }
    return row;
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

  private async loadEmployeeTenant(employeeId: string) {
    const employee = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { tenantId: true },
    });
    if (!employee) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }
    return employee;
  }

  private toMaskedView(row: {
    id: string;
    employeeId: string;
    taxIdNumber: string | null;
    bankAccountNumber: string | null;
    taxSettings: unknown;
    updatedAt: Date;
  }): EmployeeTaxProfileView {
    return {
      id: row.id,
      employeeId: row.employeeId,
      taxIdNumberMasked: this.sensitiveFields.mask(row.taxIdNumber),
      bankAccountNumberMasked: this.sensitiveFields.mask(row.bankAccountNumber),
      taxSettings:
        row.taxSettings && typeof row.taxSettings === 'object'
          ? (row.taxSettings as Record<string, unknown>)
          : {},
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
