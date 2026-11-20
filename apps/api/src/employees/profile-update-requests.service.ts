import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  Prisma,
  ProfileUpdateFieldKey,
  ProfileUpdateRequestStatus,
} from '@prisma/client';
import type {
  EmployeeAddress,
  EmployeeContact,
  EmergencyContact,
  ProfileUpdateRequestRecord,
} from '@hrm/shared-types';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { DataScopeService } from '../rbac/data-scope.service';
import { getTenantIdFromSession } from '../tenant/tenant.context';
import type {
  CreateProfileUpdateRequestDto,
  DecideProfileUpdateRequestDto,
  UpdateSelfProfileDto,
} from './dto/self-profile.dto';
import { EmployeesService } from './employees.service';

const requestInclude = {
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
    },
  },
} satisfies Prisma.ProfileUpdateRequestInclude;

type RequestWithEmployee = Prisma.ProfileUpdateRequestGetPayload<{
  include: typeof requestInclude;
}>;

@Injectable()
export class ProfileUpdateRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeesService: EmployeesService,
    private readonly companyScope: CompanyScopeService,
    private readonly dataScope: DataScopeService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Direct-edit self-service subset (MODULES.md §04 & §24):
   * Only personalInfo.contact, personalInfo.emergencyContact, and personalInfo.address
   * may be mutated directly by the employee. Employment, identity, salary, and dependents stay locked.
   */
  async updateSelfProfile(
    employeeId: string,
    dto: UpdateSelfProfileDto,
    user: AuthenticatedUser,
  ) {
    const existing = await this.employeesService.getEmployee(employeeId);
    const prevInfo = this.asRecord(existing.personalInfo);

    const nextContact = this.cleanStringRecord<EmployeeContact>({
      ...(this.asRecord(prevInfo.contact) as EmployeeContact),
      ...(dto.contact
        ? {
            ...(dto.contact.email !== undefined ? { email: dto.contact.email.trim() } : {}),
            ...(dto.contact.phone !== undefined ? { phone: dto.contact.phone.trim() } : {}),
            ...(dto.contact.mobile !== undefined ? { mobile: dto.contact.mobile.trim() } : {}),
          }
        : {}),
    });

    const nextEmergency = this.cleanStringRecord<EmergencyContact>({
      ...(this.asRecord(prevInfo.emergencyContact) as EmergencyContact),
      ...(dto.emergencyContact
        ? {
            ...(dto.emergencyContact.name !== undefined
              ? { name: dto.emergencyContact.name.trim() }
              : {}),
            ...(dto.emergencyContact.phone !== undefined
              ? { phone: dto.emergencyContact.phone.trim() }
              : {}),
            ...(dto.emergencyContact.relationship !== undefined
              ? { relationship: dto.emergencyContact.relationship.trim() }
              : {}),
          }
        : {}),
    });

    const nextAddress = this.cleanStringRecord<EmployeeAddress>({
      ...(this.asRecord(prevInfo.address) as EmployeeAddress),
      ...(dto.address
        ? {
            ...(dto.address.line1 !== undefined ? { line1: dto.address.line1.trim() } : {}),
            ...(dto.address.line2 !== undefined ? { line2: dto.address.line2.trim() } : {}),
            ...(dto.address.city !== undefined ? { city: dto.address.city.trim() } : {}),
            ...(dto.address.state !== undefined ? { state: dto.address.state.trim() } : {}),
            ...(dto.address.postalCode !== undefined
              ? { postalCode: dto.address.postalCode.trim() }
              : {}),
            ...(dto.address.country !== undefined ? { country: dto.address.country.trim() } : {}),
          }
        : {}),
    });

    const nextPersonalInfo: Record<string, unknown> = {
      ...prevInfo,
      ...(dto.contact !== undefined ? { contact: nextContact } : {}),
      ...(dto.emergencyContact !== undefined ? { emergencyContact: nextEmergency } : {}),
      ...(dto.address !== undefined ? { address: nextAddress } : {}),
    };

    await this.prisma.scoped.employee.update({
      where: { id: employeeId },
      data: {
        personalInfo: nextPersonalInfo as Prisma.InputJsonValue,
      },
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: AuditAction.update,
      module: 'employees',
      recordId: employeeId,
      oldValue: {
        contact: prevInfo.contact ?? null,
        emergencyContact: prevInfo.emergencyContact ?? null,
        address: prevInfo.address ?? null,
      },
      newValue: {
        contact: nextPersonalInfo.contact ?? null,
        emergencyContact: nextPersonalInfo.emergencyContact ?? null,
        address: nextPersonalInfo.address ?? null,
      },
    });

    return this.employeesService.getEmployee(employeeId);
  }

  async listForEmployee(employeeId: string): Promise<ProfileUpdateRequestRecord[]> {
    await this.employeesService.getEmployee(employeeId);
    const rows = await this.prisma.scoped.profileUpdateRequest.findMany({
      where: { employeeId },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
    });
    return this.hydrateReviewerNames(rows);
  }

  async listForCompany(
    companyId: string,
    status?: ProfileUpdateRequestStatus,
  ): Promise<ProfileUpdateRequestRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const rows = await this.prisma.scoped.profileUpdateRequest.findMany({
      where: {
        companyId,
        ...(status ? { status } : {}),
      },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
    });
    return this.hydrateReviewerNames(rows);
  }

  async createRequest(
    employeeId: string,
    dto: CreateProfileUpdateRequestDto,
    user: AuthenticatedUser,
  ): Promise<ProfileUpdateRequestRecord> {
    const employee = await this.employeesService.getEmployee(employeeId);
    const fieldKey = dto.fieldKey as ProfileUpdateFieldKey;
    const requestedValue = dto.requestedValue.trim();
    const reason = dto.reason.trim();

    if (!requestedValue || !reason) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Requested value and reason are required',
      });
    }

    const existingPending = await this.prisma.scoped.profileUpdateRequest.findFirst({
      where: {
        employeeId,
        fieldKey,
        status: ProfileUpdateRequestStatus.pending,
      },
    });
    if (existingPending) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'A pending update request already exists for this field',
      });
    }

    const currentValue = this.resolveCurrentValue(employee, fieldKey);
    const created = await this.prisma.scoped.profileUpdateRequest.create({
      data: {
        tenantId: employee.tenantId,
        companyId: employee.companyId,
        employeeId,
        fieldKey,
        currentValue,
        requestedValue,
        reason,
        effectiveDate: dto.effectiveDate ? this.parseDate(dto.effectiveDate) : null,
        requestedByUserId: user.id,
      },
      include: requestInclude,
    });

    await this.auditService.log({
      tenantId: employee.tenantId,
      userId: user.id,
      action: AuditAction.create,
      module: 'profile_update_requests',
      recordId: created.id,
      newValue: {
        employeeId,
        fieldKey,
        currentValue,
        requestedValue,
        reason,
      },
    });

    await this.notifyHrAdmins(employee.tenantId, employee.companyId, employee.fullName, fieldKey, user.id);
    return this.toRecord(created, null);
  }

  async cancelRequest(
    requestId: string,
    user: AuthenticatedUser,
  ): Promise<ProfileUpdateRequestRecord> {
    const existing = await this.getRequestOrThrow(requestId);
    if (user.employeeId !== existing.employeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You can only cancel your own profile update requests',
      });
    }
    if (existing.status !== ProfileUpdateRequestStatus.pending) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Only pending requests can be cancelled',
      });
    }

    const updated = await this.prisma.scoped.profileUpdateRequest.update({
      where: { id: requestId },
      data: { status: ProfileUpdateRequestStatus.cancelled },
      include: requestInclude,
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: AuditAction.update,
      module: 'profile_update_requests',
      recordId: requestId,
      oldValue: { status: existing.status },
      newValue: { status: updated.status },
    });

    return this.toRecord(updated, null);
  }

  async approveRequest(
    requestId: string,
    dto: DecideProfileUpdateRequestDto,
    user: AuthenticatedUser,
  ): Promise<ProfileUpdateRequestRecord> {
    const existing = await this.getRequestOrThrow(requestId);
    await this.dataScope.assertEmployeeInScope(user, existing.employeeId, {
      includeSelf: false,
    });

    if (existing.status !== ProfileUpdateRequestStatus.pending) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Only pending requests can be approved',
      });
    }

    const autoApply =
      existing.fieldKey === ProfileUpdateFieldKey.first_name ||
      existing.fieldKey === ProfileUpdateFieldKey.last_name;

    const updated = await this.prisma.unscoped.$transaction(async (tx) => {
      if (existing.fieldKey === ProfileUpdateFieldKey.first_name) {
        await tx.employee.update({
          where: { id: existing.employeeId },
          data: { firstName: existing.requestedValue.trim() },
        });
      } else if (existing.fieldKey === ProfileUpdateFieldKey.last_name) {
        await tx.employee.update({
          where: { id: existing.employeeId },
          data: { lastName: existing.requestedValue.trim() },
        });
      }

      const decided = await tx.profileUpdateRequest.update({
        where: { id: requestId },
        data: {
          status: ProfileUpdateRequestStatus.approved,
          reviewedByUserId: user.id,
          reviewedAt: new Date(),
          reviewComment: dto.comment?.trim() || null,
          appliedOnApproval: autoApply,
        },
        include: requestInclude,
      });

      await this.auditService.log(
        {
          tenantId: existing.tenantId,
          userId: user.id,
          action: AuditAction.approve,
          module: 'profile_update_requests',
          recordId: requestId,
          oldValue: {
            status: existing.status,
            currentValue: existing.currentValue,
          },
          newValue: {
            status: decided.status,
            requestedValue: existing.requestedValue,
            appliedOnApproval: autoApply,
            comment: decided.reviewComment,
          },
        },
        tx,
      );

      return decided;
    });

    await this.notifyEmployeeDecision(existing, 'profile.update_approved', updated.reviewComment);
    return (await this.hydrateReviewerNames([updated]))[0];
  }

  async rejectRequest(
    requestId: string,
    dto: DecideProfileUpdateRequestDto,
    user: AuthenticatedUser,
  ): Promise<ProfileUpdateRequestRecord> {
    const existing = await this.getRequestOrThrow(requestId);
    await this.dataScope.assertEmployeeInScope(user, existing.employeeId, {
      includeSelf: false,
    });

    if (existing.status !== ProfileUpdateRequestStatus.pending) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Only pending requests can be rejected',
      });
    }

    const updated = await this.prisma.scoped.profileUpdateRequest.update({
      where: { id: requestId },
      data: {
        status: ProfileUpdateRequestStatus.rejected,
        reviewedByUserId: user.id,
        reviewedAt: new Date(),
        reviewComment: dto.comment?.trim() || null,
        appliedOnApproval: false,
      },
      include: requestInclude,
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: AuditAction.reject,
      module: 'profile_update_requests',
      recordId: requestId,
      oldValue: { status: existing.status },
      newValue: { status: updated.status, comment: updated.reviewComment },
    });

    await this.notifyEmployeeDecision(existing, 'profile.update_rejected', updated.reviewComment);
    return (await this.hydrateReviewerNames([updated]))[0];
  }

  private async getRequestOrThrow(requestId: string): Promise<RequestWithEmployee> {
    const tenantId = getTenantIdFromSession();
    const row = await this.prisma.scoped.profileUpdateRequest.findFirst({
      where: { id: requestId, ...(tenantId ? { tenantId } : {}) },
      include: requestInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Profile update request not found',
      });
    }
    return row;
  }

  private resolveCurrentValue(
    employee: Awaited<ReturnType<EmployeesService['getEmployee']>>,
    fieldKey: ProfileUpdateFieldKey,
  ): string | null {
    switch (fieldKey) {
      case ProfileUpdateFieldKey.first_name:
        return employee.firstName;
      case ProfileUpdateFieldKey.last_name:
        return employee.lastName;
      case ProfileUpdateFieldKey.work_location:
        return employee.workLocation?.name ?? null;
      case ProfileUpdateFieldKey.department:
        return employee.department?.name ?? null;
      case ProfileUpdateFieldKey.designation:
        return employee.designation?.name ?? null;
      case ProfileUpdateFieldKey.manager:
        return employee.manager?.fullName ?? null;
      case ProfileUpdateFieldKey.dependents: {
        const deps = (this.asRecord(employee.personalInfo).dependents ?? []) as Array<{
          name?: string;
        }>;
        if (!Array.isArray(deps) || deps.length === 0) return null;
        return deps
          .map((d) => d.name)
          .filter(Boolean)
          .join(', ');
      }
      case ProfileUpdateFieldKey.bank_or_tax:
      case ProfileUpdateFieldKey.other:
        return null;
    }
  }

  private async hydrateReviewerNames(
    rows: RequestWithEmployee[],
  ): Promise<ProfileUpdateRequestRecord[]> {
    const reviewerIds = Array.from(
      new Set(
        rows
          .map((row) => row.reviewedByUserId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const reviewerNames = new Map<string, string>();
    if (reviewerIds.length > 0) {
      const users = await this.prisma.unscoped.user.findMany({
        where: { id: { in: reviewerIds } },
        select: {
          id: true,
          email: true,
          employee: { select: { firstName: true, lastName: true } },
        },
      });
      for (const u of users) {
        reviewerNames.set(
          u.id,
          u.employee
            ? `${u.employee.firstName} ${u.employee.lastName}`.trim()
            : u.email,
        );
      }
    }

    return rows.map((row) =>
      this.toRecord(
        row,
        row.reviewedByUserId ? reviewerNames.get(row.reviewedByUserId) ?? null : null,
      ),
    );
  }

  private toRecord(
    row: RequestWithEmployee,
    reviewedByName: string | null,
  ): ProfileUpdateRequestRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      employeeId: row.employeeId,
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      employeeNumber: row.employee.employeeNumber,
      fieldKey: row.fieldKey,
      currentValue: row.currentValue,
      requestedValue: row.requestedValue,
      reason: row.reason,
      effectiveDate: row.effectiveDate ? row.effectiveDate.toISOString().slice(0, 10) : null,
      status: row.status,
      requestedByUserId: row.requestedByUserId,
      reviewedByUserId: row.reviewedByUserId,
      reviewedByName,
      reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
      reviewComment: row.reviewComment,
      appliedOnApproval: row.appliedOnApproval,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async notifyHrAdmins(
    tenantId: string,
    companyId: string,
    employeeName: string,
    fieldKey: ProfileUpdateFieldKey,
    requesterUserId: string,
  ): Promise<void> {
    try {
      const recipients = await this.prisma.unscoped.user.findMany({
        where: {
          tenantId,
          id: { not: requesterUserId },
          isActive: true,
          role: {
            dataScope: { not: 'own' },
            permissions: {
              some: { module: 'employee', action: 'edit' },
            },
          },
        },
        select: { id: true },
        take: 10,
      });
      if (recipients.length === 0) return;

      await this.prisma.unscoped.inAppNotification.createMany({
        data: recipients.map((r) => ({
          tenantId,
          companyId,
          userId: r.id,
          eventType: 'profile.update_requested',
          title: 'Profile update request',
          body: `${employeeName} requested an update to ${fieldKey.replace(/_/g, ' ')}.`,
          payload: { fieldKey },
        })),
      });
    } catch {
      // Non-blocking in-app notification
    }
  }

  private async notifyEmployeeDecision(
    request: RequestWithEmployee,
    eventType: 'profile.update_approved' | 'profile.update_rejected',
    comment: string | null,
  ): Promise<void> {
    try {
      const approved = eventType === 'profile.update_approved';
      await this.prisma.unscoped.inAppNotification.create({
        data: {
          tenantId: request.tenantId,
          companyId: request.companyId,
          userId: request.requestedByUserId,
          eventType,
          title: approved ? 'Profile update approved' : 'Profile update rejected',
          body: approved
            ? `Your ${request.fieldKey.replace(/_/g, ' ')} change request was approved.`
            : `Your ${request.fieldKey.replace(/_/g, ' ')} change request was rejected.${comment ? ` Reason: ${comment}` : ''}`,
          payload: { requestId: request.id, fieldKey: request.fieldKey },
        },
      });
    } catch {
      // Non-blocking in-app notification
    }
  }

  private parseDate(value: string): Date {
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private cleanStringRecord<T extends object>(input: T): Partial<T> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) out[key] = trimmed;
      }
    }
    return out as Partial<T>;
  }
}
