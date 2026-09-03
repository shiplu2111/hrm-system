import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmploymentStatus,
  LifecycleEventType,
  Prisma,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { getTenantIdFromSession } from '../tenant/tenant.context';
import type { CreateLifecycleEventDto } from './dto/lifecycle.dto';

const employeeSelect = {
  id: true,
  tenantId: true,
  companyId: true,
  employeeNumber: true,
  firstName: true,
  lastName: true,
  employmentStatus: true,
  departmentId: true,
  designationId: true,
  employmentTypeId: true,
  managerId: true,
  hireDate: true,
  probationEndDate: true,
  confirmationDate: true,
  workLocationId: true,
  costCentreId: true,
  deletedAt: true,
} satisfies Prisma.EmployeeSelect;

type EmployeeRow = Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }>;

export interface LifecycleEventResponse {
  id: string;
  employeeId: string;
  eventType: LifecycleEventType;
  effectiveDate: string;
  details: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class LifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listEvents(
    employeeId: string,
    eventType?: LifecycleEventType,
  ): Promise<LifecycleEventResponse[]> {
    await this.getEmployeeOrThrow(employeeId);

    const rows = await this.prisma.unscoped.employeeLifecycleEvent.findMany({
      where: {
        employeeId,
        ...(eventType ? { eventType } : {}),
      },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
    });

    return rows.map((row) => this.toResponse(row));
  }

  async getEvent(eventId: string): Promise<LifecycleEventResponse> {
    const row = await this.prisma.unscoped.employeeLifecycleEvent.findUnique({
      where: { id: eventId },
    });

    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Lifecycle event not found',
      });
    }

    await this.getEmployeeOrThrow(row.employeeId);
    return this.toResponse(row);
  }

  async createEvent(
    employeeId: string,
    dto: CreateLifecycleEventDto,
    user: AuthenticatedUser,
    requestMeta?: { ipAddress?: string; device?: string },
  ): Promise<LifecycleEventResponse> {
    const includeDeleted = dto.eventType === LifecycleEventType.rehire;
    const employee = await this.getEmployeeOrThrow(employeeId, { includeDeleted });
    const oldSnapshot = this.employeeAuditSnapshot(employee);

    const { employeeUpdate, enrichedDetails } = this.resolveEventEffects(
      employee,
      dto,
    );

    return this.prisma.unscoped.$transaction(async (tx) => {
      let updatedEmployee = employee;

      if (employeeUpdate) {
        updatedEmployee = await tx.employee.update({
          where: { id: employeeId },
          data: employeeUpdate,
          select: employeeSelect,
        });
      }

      const event = await tx.employeeLifecycleEvent.create({
        data: {
          employeeId,
          eventType: dto.eventType,
          effectiveDate: this.parseDate(dto.effectiveDate),
          details: enrichedDetails as Prisma.InputJsonValue,
          createdBy: user.id,
        },
      });

      await this.auditService.log(
        {
          tenantId: employee.tenantId,
          userId: user.id,
          action: 'create',
          module: 'employee',
          recordId: event.id,
          oldValue: null,
          newValue: {
            lifecycleEvent: this.toResponse(event),
            eventType: dto.eventType,
          },
          ipAddress: requestMeta?.ipAddress,
          device: requestMeta?.device,
        },
        tx,
      );

      if (employeeUpdate) {
        await this.auditService.log(
          {
            tenantId: employee.tenantId,
            userId: user.id,
            action: 'update',
            module: 'employee',
            recordId: employeeId,
            oldValue: oldSnapshot,
            newValue: this.employeeAuditSnapshot(updatedEmployee),
            ipAddress: requestMeta?.ipAddress,
            device: requestMeta?.device,
          },
          tx,
        );
      }

      return this.toResponse(event);
    });
  }

  private resolveEventEffects(
    employee: EmployeeRow,
    dto: CreateLifecycleEventDto,
  ): {
    employeeUpdate: Prisma.EmployeeUpdateInput | null;
    enrichedDetails: Record<string, unknown>;
  } {
    const details = dto.details ?? {};
    const enriched: Record<string, unknown> = { ...details };

    switch (dto.eventType) {
      case LifecycleEventType.promotion: {
        const newDesignationId = this.requireUuid(
          details.newDesignationId,
          'newDesignationId',
        );
        enriched.previousDesignationId = employee.designationId;
        enriched.newDesignationId = newDesignationId;

        const update: Prisma.EmployeeUpdateInput = {
          designation: { connect: { id: newDesignationId } },
        };

        if (details.newDepartmentId !== undefined && details.newDepartmentId !== null) {
          const deptId = this.requireUuid(details.newDepartmentId, 'newDepartmentId');
          enriched.previousDepartmentId = employee.departmentId;
          enriched.newDepartmentId = deptId;
          update.department = { connect: { id: deptId } };
        }

        if (details.newManagerId !== undefined && details.newManagerId !== null) {
          const mgrId = this.requireUuid(details.newManagerId, 'newManagerId');
          enriched.previousManagerId = employee.managerId;
          enriched.newManagerId = mgrId;
          update.manager = { connect: { id: mgrId } };
        }

        return { employeeUpdate: update, enrichedDetails: enriched };
      }

      case LifecycleEventType.transfer: {
        const hasDept = details.newDepartmentId != null && details.newDepartmentId !== '';
        const hasLocation =
          details.newWorkLocationId != null && details.newWorkLocationId !== '';
        const hasCostCentre =
          details.newCostCentreId != null && details.newCostCentreId !== '';
        const hasManager =
          details.newManagerId != null && details.newManagerId !== '';

        if (!hasDept && !hasLocation && !hasCostCentre && !hasManager) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message:
              'Transfer requires at least one of newDepartmentId, newWorkLocationId, newCostCentreId, or newManagerId',
          });
        }

        const update: Prisma.EmployeeUpdateInput = {};

        if (hasDept) {
          const deptId = this.requireUuid(details.newDepartmentId, 'newDepartmentId');
          enriched.previousDepartmentId = employee.departmentId;
          enriched.newDepartmentId = deptId;
          update.department = { connect: { id: deptId } };
        }
        if (hasLocation) {
          const locId = this.requireUuid(
            details.newWorkLocationId,
            'newWorkLocationId',
          );
          enriched.previousWorkLocationId = employee.workLocationId;
          enriched.newWorkLocationId = locId;
          update.workLocation = { connect: { id: locId } };
        }
        if (hasCostCentre) {
          const ccId = this.requireUuid(details.newCostCentreId, 'newCostCentreId');
          enriched.previousCostCentreId = employee.costCentreId;
          enriched.newCostCentreId = ccId;
          update.costCentre = { connect: { id: ccId } };
        }
        if (hasManager) {
          const mgrId = this.requireUuid(details.newManagerId, 'newManagerId');
          enriched.previousManagerId = employee.managerId;
          enriched.newManagerId = mgrId;
          update.manager = { connect: { id: mgrId } };
        }

        return { employeeUpdate: update, enrichedDetails: enriched };
      }

      case LifecycleEventType.salary_revision: {
        const previousAmount = this.requireNumber(
          details.previousAmount,
          'previousAmount',
        );
        const newAmount = this.requireNumber(details.newAmount, 'newAmount');
        enriched.previousAmount = previousAmount;
        enriched.newAmount = newAmount;
        if (details.currency) enriched.currency = String(details.currency);
        if (details.reason) enriched.reason = String(details.reason);

        return { employeeUpdate: null, enrichedDetails: enriched };
      }

      case LifecycleEventType.probation: {
        const newProbationEndDate = this.requireDateString(
          details.newProbationEndDate,
          'newProbationEndDate',
        );
        enriched.previousProbationEndDate = employee.probationEndDate
          ? employee.probationEndDate.toISOString().slice(0, 10)
          : null;
        enriched.newProbationEndDate = newProbationEndDate;

        return {
          employeeUpdate: {
            probationEndDate: this.parseDate(newProbationEndDate),
          },
          enrichedDetails: enriched,
        };
      }

      case LifecycleEventType.confirmation: {
        const confirmationDate =
          typeof details.confirmationDate === 'string'
            ? details.confirmationDate
            : dto.effectiveDate;
        this.requireDateString(confirmationDate, 'confirmationDate');
        enriched.previousConfirmationDate = employee.confirmationDate
          ? employee.confirmationDate.toISOString().slice(0, 10)
          : null;
        enriched.confirmationDate = confirmationDate;

        return {
          employeeUpdate: {
            confirmationDate: this.parseDate(confirmationDate),
            employmentStatus: EmploymentStatus.active,
          },
          enrichedDetails: enriched,
        };
      }

      case LifecycleEventType.suspension: {
        if (!details.reason || typeof details.reason !== 'string') {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: 'Suspension requires a reason',
          });
        }
        enriched.previousEmploymentStatus = employee.employmentStatus;
        enriched.reason = details.reason;
        if (details.suspensionEndDate) {
          enriched.suspensionEndDate = String(details.suspensionEndDate);
        }

        return {
          employeeUpdate: { employmentStatus: EmploymentStatus.inactive },
          enrichedDetails: enriched,
        };
      }

      case LifecycleEventType.resignation: {
        enriched.previousEmploymentStatus = employee.employmentStatus;
        if (details.reason) enriched.reason = String(details.reason);
        if (details.lastWorkingDate) {
          enriched.lastWorkingDate = String(details.lastWorkingDate);
        }

        return {
          employeeUpdate: { employmentStatus: EmploymentStatus.terminated },
          enrichedDetails: enriched,
        };
      }

      case LifecycleEventType.termination: {
        if (!details.reason || typeof details.reason !== 'string') {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: 'Termination requires a reason',
          });
        }
        enriched.previousEmploymentStatus = employee.employmentStatus;
        enriched.reason = details.reason;
        if (details.lastWorkingDate) {
          enriched.lastWorkingDate = String(details.lastWorkingDate);
        }

        return {
          employeeUpdate: { employmentStatus: EmploymentStatus.terminated },
          enrichedDetails: enriched,
        };
      }

      case LifecycleEventType.rehire: {
        if (employee.deletedAt) {
          enriched.wasDeleted = true;
        }
        enriched.previousEmploymentStatus = employee.employmentStatus;

        const update: Prisma.EmployeeUpdateInput = {
          employmentStatus: EmploymentStatus.active,
          deletedAt: null,
        };

        if (details.newHireDate) {
          const hireDate = this.requireDateString(details.newHireDate, 'newHireDate');
          enriched.newHireDate = hireDate;
          update.hireDate = this.parseDate(hireDate);
        }

        if (details.newDepartmentId) {
          const deptId = this.requireUuid(details.newDepartmentId, 'newDepartmentId');
          update.department = { connect: { id: deptId } };
          enriched.newDepartmentId = deptId;
        }
        if (details.newDesignationId) {
          const desigId = this.requireUuid(
            details.newDesignationId,
            'newDesignationId',
          );
          update.designation = { connect: { id: desigId } };
          enriched.newDesignationId = desigId;
        }
        if (details.newEmploymentTypeId) {
          const typeId = this.requireUuid(
            details.newEmploymentTypeId,
            'newEmploymentTypeId',
          );
          update.employmentType = { connect: { id: typeId } };
          enriched.newEmploymentTypeId = typeId;
        }

        return { employeeUpdate: update, enrichedDetails: enriched };
      }

      default:
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `Unsupported lifecycle event type: ${dto.eventType}`,
        });
    }
  }

  private async getEmployeeOrThrow(
    employeeId: string,
    options?: { includeDeleted?: boolean },
  ): Promise<EmployeeRow> {
    const tenantId = getTenantIdFromSession();
    const row = await this.prisma.scoped.employee.findFirst({
      where: {
        id: employeeId,
        ...(options?.includeDeleted ? {} : { deletedAt: null }),
      },
      select: employeeSelect,
    });

    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    if (tenantId && row.tenantId !== tenantId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    return row;
  }

  private employeeAuditSnapshot(
    employee: EmployeeRow,
  ): Record<string, unknown> {
    return {
      employmentStatus: employee.employmentStatus,
      departmentId: employee.departmentId,
      designationId: employee.designationId,
      employmentTypeId: employee.employmentTypeId,
      managerId: employee.managerId,
      workLocationId: employee.workLocationId,
      costCentreId: employee.costCentreId,
      hireDate: employee.hireDate.toISOString().slice(0, 10),
      probationEndDate: employee.probationEndDate?.toISOString().slice(0, 10) ?? null,
      confirmationDate:
        employee.confirmationDate?.toISOString().slice(0, 10) ?? null,
    };
  }

  private toResponse(
    row: Prisma.EmployeeLifecycleEventGetPayload<object>,
  ): LifecycleEventResponse {
    return {
      id: row.id,
      employeeId: row.employeeId,
      eventType: row.eventType,
      effectiveDate: row.effectiveDate.toISOString().slice(0, 10),
      details: row.details as Record<string, unknown>,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private requireUuid(value: unknown, field: string): string {
    if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `${field} must be a valid UUID`,
      });
    }
    return value;
  }

  private requireNumber(value: unknown, field: string): number {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `${field} must be a number`,
      });
    }
    return num;
  }

  private requireDateString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `${field} must be an ISO date (YYYY-MM-DD)`,
      });
    }
    return value;
  }
}
