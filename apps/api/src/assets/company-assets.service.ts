import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import {
  AssetAssignmentStatus,
  AssetStatus,
  EmploymentStatus,
  OffboardingStatus,
  Prisma,
} from '@prisma/client';
import type {
  CompanyAssetRecord,
  EmployeeAssetAssignmentRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { OffboardingTaskSyncService } from '../offboarding/offboarding-task-sync.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { OnboardingTaskSyncService } from '../onboarding/onboarding-task-sync.service';
import { DataScopeService } from '../rbac/data-scope.service';
import type {
  AssignAssetDto,
  CreateCompanyAssetDto,
  ListAssetAssignmentsQueryDto,
  ListCompanyAssetsQueryDto,
  ReturnAssetDto,
} from './dto/assets.dto';
import { toAssetRecord, toAssignmentRecord } from './assets.utils';

const ASSET_INCLUDE = {
  assignments: {
    where: { status: AssetAssignmentStatus.active },
    include: {
      employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
    },
  },
} as const;

const ASSIGNMENT_INCLUDE = {
  asset: { select: { name: true, assetTag: true } },
  employee: { select: { firstName: true, lastName: true } },
} as const;

/** Accepts `YYYY-MM-DD` or a full ISO timestamp and keeps the calendar date. */
function toDateOnly(value: string): string {
  return value.slice(0, 10);
}

/** Server and users may sit in different time zones, so "today" allows one day of slack. */
function isAfterToday(date: string): boolean {
  const limit = new Date();
  limit.setUTCDate(limit.getUTCDate() + 1);
  return date > limit.toISOString().slice(0, 10);
}

@Injectable()
export class CompanyAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly dataScope: DataScopeService,
    private readonly offboardingSync: OffboardingTaskSyncService,
    @Optional()
    @Inject(forwardRef(() => OnboardingTaskSyncService))
    private readonly onboardingSync?: OnboardingTaskSyncService,
  ) {}

  async list(
    companyId: string,
    query: ListCompanyAssetsQueryDto,
    user: AuthenticatedUser,
  ): Promise<CompanyAssetRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    if (query.employeeId) {
      await this.dataScope.assertEmployeeInScope(user, query.employeeId);
    }

    const rows = await this.prisma.unscoped.companyAsset.findMany({
      where: {
        companyId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.employeeId
          ? {
              assignments: {
                some: {
                  employeeId: query.employeeId,
                  status: AssetAssignmentStatus.active,
                },
              },
            }
          : {}),
      },
      include: ASSET_INCLUDE,
      orderBy: [{ status: 'asc' }, { assetTag: 'asc' }],
    });

    return rows.map((row) => toAssetRecord(row));
  }

  async get(assetId: string): Promise<CompanyAssetRecord> {
    const row = await this.findOrThrow(assetId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    return toAssetRecord(row);
  }

  async create(
    companyId: string,
    dto: CreateCompanyAssetDto,
    user: AuthenticatedUser,
  ): Promise<CompanyAssetRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const assetTag = dto.assetTag.trim();
    const name = dto.name.trim();
    if (!assetTag || !name) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Asset name and tag are required',
      });
    }
    if (
      dto.purchaseDate &&
      dto.warrantyExpiryDate &&
      toDateOnly(dto.warrantyExpiryDate) < toDateOnly(dto.purchaseDate)
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Warranty expiry cannot be before the purchase date',
      });
    }

    const duplicate = await this.prisma.unscoped.companyAsset.findFirst({
      where: { companyId, assetTag: { equals: assetTag, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `Asset tag ${assetTag} is already in the register`,
      });
    }

    let row;
    try {
      row = await this.prisma.unscoped.companyAsset.create({
        data: {
          tenantId: company.tenantId,
          companyId,
          name,
          assetTag,
          category: dto.category,
          serialNumber: dto.serialNumber?.trim() || null,
          purchaseDate: dto.purchaseDate
            ? new Date(`${toDateOnly(dto.purchaseDate)}T00:00:00.000Z`)
            : null,
          warrantyExpiryDate: dto.warrantyExpiryDate
            ? new Date(`${toDateOnly(dto.warrantyExpiryDate)}T00:00:00.000Z`)
            : null,
          purchaseValue:
            dto.purchaseValue != null ? new Prisma.Decimal(dto.purchaseValue) : null,
          currency: dto.currency?.trim().toUpperCase() || 'AUD',
          notes: dto.notes?.trim() || null,
          status: AssetStatus.available,
        },
        include: ASSET_INCLUDE,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          code: 'CONFLICT',
          message: `Asset tag ${assetTag} is already in the register`,
        });
      }
      throw err;
    }

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'employee',
      recordId: row.id,
      newValue: toAssetRecord(row) as unknown as Record<string, unknown>,
    });

    return toAssetRecord(row);
  }

  async assign(
    assetId: string,
    dto: AssignAssetDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeAssetAssignmentRecord> {
    const asset = await this.findOrThrow(assetId);
    const company = await this.companyScope.assertCompanyInTenant(asset.companyId);
    await this.dataScope.assertEmployeeInScope(user, dto.employeeId);

    if (asset.status !== AssetStatus.available) {
      const holder = asset.assignments[0]?.employee;
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: holder
          ? `${asset.name} is already assigned to ${holder.firstName} ${holder.lastName}`.trim()
          : 'Only available assets can be assigned',
      });
    }

    const employee = await this.prisma.unscoped.employee.findFirst({
      where: { id: dto.employeeId, companyId: asset.companyId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, employmentStatus: true },
    });
    if (!employee) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Employee not found' });
    }
    const employeeName = `${employee.firstName} ${employee.lastName}`.trim();
    if (employee.employmentStatus === EmploymentStatus.terminated) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `${employeeName} has left the company — assets can't be assigned`,
      });
    }
    const offboarding = await this.prisma.unscoped.employeeOffboarding.findFirst({
      where: { employeeId: employee.id, status: OffboardingStatus.in_progress },
      select: { id: true },
    });
    if (offboarding) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `${employeeName} is being offboarded — assets can't be assigned`,
      });
    }

    const assignedOn = dto.assignedAt ? toDateOnly(dto.assignedAt) : null;
    if (assignedOn && isAfterToday(assignedOn)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'The assignment date cannot be in the future',
      });
    }

    if (dto.onboardingTaskId) {
      const task = await this.onboardingSync?.findLinkableProvisioningTask(
        employee.id,
        dto.onboardingTaskId,
      );
      if (!task) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: "That onboarding step isn't pending for this employee",
        });
      }
      if (task.assetCategory && task.assetCategory !== asset.category) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `That onboarding step needs a ${task.assetCategory.replace('_', ' ')}`,
        });
      }
    }

    const assignment = await this.prisma.unscoped.$transaction(async (tx) => {
      const claimed = await tx.companyAsset.updateMany({
        where: { id: assetId, status: AssetStatus.available },
        data: { status: AssetStatus.assigned },
      });
      if (claimed.count === 0) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: `${asset.name} was just assigned by someone else — refresh and try again`,
        });
      }

      return tx.employeeAssetAssignment.create({
        data: {
          assetId,
          employeeId: employee.id,
          assignedAt: assignedOn ? new Date(`${assignedOn}T00:00:00.000Z`) : new Date(),
          conditionOnAssign: dto.conditionOnAssign?.trim() || null,
          notes: dto.notes?.trim() || null,
          assignedByUserId: user.id,
          onboardingTaskId: dto.onboardingTaskId ?? null,
        },
        include: ASSIGNMENT_INCLUDE,
      });
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'update',
      module: 'employee',
      recordId: assetId,
      oldValue: { status: AssetStatus.available },
      newValue: {
        status: AssetStatus.assigned,
        assignmentId: assignment.id,
        employeeId: employee.id,
        conditionOnAssign: assignment.conditionOnAssign,
      },
    });

    const checklistUpdates =
      (await this.onboardingSync?.syncAfterAssetAssignment({
        employeeId: employee.id,
        assetId,
        assetCategory: asset.category,
        assignmentId: assignment.id,
        onboardingTaskId: dto.onboardingTaskId,
      })) ?? [];

    const refreshed = await this.prisma.unscoped.employeeAssetAssignment.findUniqueOrThrow({
      where: { id: assignment.id },
      include: ASSIGNMENT_INCLUDE,
    });
    return { ...toAssignmentRecord(refreshed), checklistUpdates };
  }

  async returnAsset(
    assetId: string,
    dto: ReturnAssetDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeAssetAssignmentRecord> {
    const asset = await this.findOrThrow(assetId);
    const company = await this.companyScope.assertCompanyInTenant(asset.companyId);

    const activeAssignment = await this.prisma.unscoped.employeeAssetAssignment.findFirst({
      where: { assetId, status: AssetAssignmentStatus.active },
    });
    if (!activeAssignment) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Asset is not currently assigned',
      });
    }
    await this.dataScope.assertEmployeeInScope(user, activeAssignment.employeeId);

    const returnedOn = dto.returnedAt ? toDateOnly(dto.returnedAt) : null;
    if (returnedOn) {
      if (isAfterToday(returnedOn)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'The return date cannot be in the future',
        });
      }
      if (returnedOn < activeAssignment.assignedAt.toISOString().slice(0, 10)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'The return date cannot be before the asset was assigned',
        });
      }
    }

    if (dto.offboardingTaskId) {
      const task = await this.offboardingSync.findLinkableReturnTask(
        activeAssignment.employeeId,
        dto.offboardingTaskId,
      );
      if (!task) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: "That offboarding step doesn't belong to this employee",
        });
      }
      if (task.assetCategory && task.assetCategory !== asset.category) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `That offboarding step covers ${task.assetCategory.replace('_', ' ')} assets`,
        });
      }
    }

    const updated = await this.prisma.unscoped.$transaction(async (tx) => {
      const row = await tx.employeeAssetAssignment.update({
        where: { id: activeAssignment.id },
        data: {
          status: AssetAssignmentStatus.returned,
          returnedAt: returnedOn ? new Date(`${returnedOn}T00:00:00.000Z`) : new Date(),
          conditionOnReturn: dto.conditionOnReturn?.trim() || null,
          notes: dto.notes?.trim() || activeAssignment.notes,
          returnedByUserId: user.id,
          offboardingTaskId: dto.offboardingTaskId ?? activeAssignment.offboardingTaskId,
        },
        include: ASSIGNMENT_INCLUDE,
      });

      await tx.companyAsset.update({
        where: { id: assetId },
        data: { status: AssetStatus.available },
      });

      return row;
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'update',
      module: 'employee',
      recordId: assetId,
      oldValue: { status: AssetStatus.assigned, assignmentId: updated.id },
      newValue: {
        status: AssetStatus.available,
        returnedAssignmentId: updated.id,
        employeeId: updated.employeeId,
        conditionOnReturn: updated.conditionOnReturn,
      },
    });

    const offboardingNotes = await this.offboardingSync.syncAfterAssetReturn({
      assignmentId: updated.id,
      employeeId: updated.employeeId,
      assetCategory: asset.category,
      linkedTaskId: updated.offboardingTaskId,
      userId: user.id,
      tenantId: company.tenantId,
    });
    const onboardingNotes =
      (await this.onboardingSync?.syncAfterAssetReturn({
        employeeId: updated.employeeId,
        assetId,
      })) ?? [];

    const refreshed = await this.prisma.unscoped.employeeAssetAssignment.findUniqueOrThrow({
      where: { id: updated.id },
      include: ASSIGNMENT_INCLUDE,
    });
    return {
      ...toAssignmentRecord(refreshed),
      checklistUpdates: [...offboardingNotes, ...onboardingNotes],
    };
  }

  async listAssignments(
    companyId: string,
    query: ListAssetAssignmentsQueryDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeAssetAssignmentRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    if (query.employeeId) {
      await this.dataScope.assertEmployeeInScope(user, query.employeeId);
    }

    const rows = await this.prisma.unscoped.employeeAssetAssignment.findMany({
      where: {
        asset: { companyId },
        employeeId: query.employeeId ?? (await this.dataScope.employeeIdFilter(user)),
        ...(query.assetId ? { assetId: query.assetId } : {}),
        ...(query.activeOnly ? { status: AssetAssignmentStatus.active } : {}),
      },
      include: ASSIGNMENT_INCLUDE,
      orderBy: { assignedAt: 'desc' },
    });

    return rows.map((row) => toAssignmentRecord(row));
  }

  async countActiveAssignmentsForEmployee(
    employeeId: string,
    category?: string,
  ): Promise<number> {
    return this.prisma.unscoped.employeeAssetAssignment.count({
      where: {
        employeeId,
        status: AssetAssignmentStatus.active,
        ...(category ? { asset: { category: category as never } } : {}),
      },
    });
  }

  private async findOrThrow(assetId: string) {
    const row = await this.prisma.unscoped.companyAsset.findUnique({
      where: { id: assetId },
      include: ASSET_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Asset not found',
      });
    }
    return row;
  }
}
