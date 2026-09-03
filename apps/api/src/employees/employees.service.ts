import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmploymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { getTenantIdFromSession } from '../tenant/tenant.context';
import type { CreateEmployeeDto, UpdateEmployeeDto } from '../organization/dto/organization.dto';

const employeeInclude = {
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
  employmentType: { select: { id: true, name: true } },
  manager: {
    select: { id: true, firstName: true, lastName: true, employeeNumber: true },
  },
  workLocation: { select: { id: true, name: true } },
  costCentre: { select: { id: true, name: true, code: true } },
  company: { select: { id: true, name: true } },
} satisfies Prisma.EmployeeInclude;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
  ) {}

  async listEmployees(companyId?: string) {
    const tenantId = getTenantIdFromSession();
    if (!tenantId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Tenant context is required',
      });
    }

    if (companyId) {
      await this.companyScope.assertCompanyInTenant(companyId);
    }

    const rows = await this.prisma.scoped.employee.findMany({
      where: {
        deletedAt: null,
        ...(companyId ? { companyId } : {}),
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: employeeInclude,
    });

    return rows.map((row) => this.toEmployeeResponse(row));
  }

  async getEmployee(id: string) {
    const row = await this.prisma.scoped.employee.findFirst({
      where: { id, deletedAt: null },
      include: employeeInclude,
    });

    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    return this.toEmployeeResponse(row);
  }

  async createEmployee(dto: CreateEmployeeDto) {
    const tenantId = getTenantIdFromSession();
    if (!tenantId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Tenant context is required',
      });
    }

    await this.companyScope.assertCompanyInTenant(dto.companyId);
    await this.validateEmployeeReferences(dto.companyId, dto);

    try {
      const created = await this.prisma.scoped.employee.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          employeeNumber: dto.employeeNumber.trim(),
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          personalInfo: (dto.personalInfo ?? {}) as Prisma.InputJsonValue,
          employmentStatus:
            (dto.employmentStatus as EmploymentStatus | undefined) ??
            EmploymentStatus.active,
          departmentId: dto.departmentId ?? null,
          designationId: dto.designationId ?? null,
          employmentTypeId: dto.employmentTypeId ?? null,
          managerId: dto.managerId ?? null,
          hireDate: this.parseDate(dto.hireDate),
          probationEndDate: dto.probationEndDate
            ? this.parseDate(dto.probationEndDate)
            : null,
          confirmationDate: dto.confirmationDate
            ? this.parseDate(dto.confirmationDate)
            : null,
          workLocationId: dto.workLocationId ?? null,
          costCentreId: dto.costCentreId ?? null,
        },
        include: employeeInclude,
      });

      return this.toEmployeeResponse(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Employee number already exists for this tenant',
        });
      }
      throw error;
    }
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto) {
    const existing = await this.getEmployee(id);
    await this.validateEmployeeReferences(existing.companyId, dto);

    if (dto.managerId && dto.managerId === id) {
      throw new ConflictException({
        code: 'VALIDATION_ERROR',
        message: 'Employee cannot be their own manager',
      });
    }

    try {
      const updated = await this.prisma.scoped.employee.update({
        where: { id },
        data: {
          ...(dto.employeeNumber != null
            ? { employeeNumber: dto.employeeNumber.trim() }
            : {}),
          ...(dto.firstName != null ? { firstName: dto.firstName.trim() } : {}),
          ...(dto.lastName != null ? { lastName: dto.lastName.trim() } : {}),
          ...(dto.personalInfo != null
            ? { personalInfo: dto.personalInfo as Prisma.InputJsonValue }
            : {}),
          ...(dto.employmentStatus != null
            ? { employmentStatus: dto.employmentStatus as EmploymentStatus }
            : {}),
          ...(dto.departmentId !== undefined
            ? { departmentId: dto.departmentId }
            : {}),
          ...(dto.designationId !== undefined
            ? { designationId: dto.designationId }
            : {}),
          ...(dto.employmentTypeId !== undefined
            ? { employmentTypeId: dto.employmentTypeId }
            : {}),
          ...(dto.managerId !== undefined ? { managerId: dto.managerId } : {}),
          ...(dto.hireDate != null ? { hireDate: this.parseDate(dto.hireDate) } : {}),
          ...(dto.probationEndDate !== undefined
            ? {
                probationEndDate: dto.probationEndDate
                  ? this.parseDate(dto.probationEndDate)
                  : null,
              }
            : {}),
          ...(dto.confirmationDate !== undefined
            ? {
                confirmationDate: dto.confirmationDate
                  ? this.parseDate(dto.confirmationDate)
                  : null,
              }
            : {}),
          ...(dto.workLocationId !== undefined
            ? { workLocationId: dto.workLocationId }
            : {}),
          ...(dto.costCentreId !== undefined
            ? { costCentreId: dto.costCentreId }
            : {}),
        },
        include: employeeInclude,
      });

      return this.toEmployeeResponse(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Employee number already exists for this tenant',
        });
      }
      throw error;
    }
  }

  async deleteEmployee(id: string): Promise<void> {
    await this.getEmployee(id);
    await this.prisma.scoped.employee.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async validateEmployeeReferences(
    companyId: string,
    dto: CreateEmployeeDto | UpdateEmployeeDto,
  ): Promise<void> {
    if (dto.departmentId) {
      const row = await this.prisma.unscoped.department.findFirst({
        where: { id: dto.departmentId, companyId },
      });
      if (!row) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Department not found in company',
        });
      }
    }

    if (dto.designationId) {
      const row = await this.prisma.unscoped.designation.findFirst({
        where: { id: dto.designationId, companyId },
      });
      if (!row) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Designation not found in company',
        });
      }
    }

    if (dto.employmentTypeId) {
      const row = await this.prisma.unscoped.employmentType.findFirst({
        where: { id: dto.employmentTypeId, companyId },
      });
      if (!row) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Employment type not found in company',
        });
      }
    }

    if (dto.managerId) {
      const row = await this.prisma.scoped.employee.findFirst({
        where: { id: dto.managerId, deletedAt: null },
      });
      if (!row) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Manager not found',
        });
      }
    }

    if (dto.workLocationId) {
      const row = await this.prisma.unscoped.location.findFirst({
        where: { id: dto.workLocationId, companyId },
      });
      if (!row) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Work location not found in company',
        });
      }
    }

    if (dto.costCentreId) {
      const row = await this.prisma.unscoped.costCentre.findFirst({
        where: { id: dto.costCentreId, companyId },
      });
      if (!row) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Cost centre not found in company',
        });
      }
    }
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private toEmployeeResponse(
    row: Prisma.EmployeeGetPayload<{ include: typeof employeeInclude }>,
  ) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      employeeNumber: row.employeeNumber,
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: `${row.firstName} ${row.lastName}`,
      personalInfo: row.personalInfo as Record<string, unknown>,
      employmentStatus: row.employmentStatus,
      departmentId: row.departmentId,
      designationId: row.designationId,
      employmentTypeId: row.employmentTypeId,
      managerId: row.managerId,
      hireDate: row.hireDate.toISOString().slice(0, 10),
      probationEndDate: row.probationEndDate?.toISOString().slice(0, 10) ?? null,
      confirmationDate:
        row.confirmationDate?.toISOString().slice(0, 10) ?? null,
      workLocationId: row.workLocationId,
      costCentreId: row.costCentreId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      department: row.department,
      designation: row.designation,
      employmentType: row.employmentType,
      manager: row.manager
        ? {
            ...row.manager,
            fullName: `${row.manager.firstName} ${row.manager.lastName}`,
          }
        : null,
      workLocation: row.workLocation,
      costCentre: row.costCentre,
      company: row.company,
    };
  }
}
