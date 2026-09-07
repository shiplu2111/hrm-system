import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { AssetAssignmentStatus, AssetStatus, Prisma } from '@prisma/client';
import type {
  CompanyAssetRecord,
  EmployeeAssetAssignmentRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { OnboardingTaskSyncService } from '../onboarding/onboarding-task-sync.service';
import type {
  AssignAssetDto,
  CreateCompanyAssetDto,
  ListAssetAssignmentsQueryDto,
  ListCompanyAssetsQueryDto,
  ReturnAssetDto,
} from './dto/assets.dto';
import { toAssetRecord, toAssignmentRecord } from './assets.utils';

@Injectable()
export class CompanyAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    @Optional()
    @Inject(forwardRef(() => OnboardingTaskSyncService))
    private readonly onboardingSync?: OnboardingTaskSyncService,
  ) {}

  async list(
    companyId: string,
    query: ListCompanyAssetsQueryDto,
  ): Promise<CompanyAssetRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

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
      include: {
        assignments: {
          where: { status: AssetAssignmentStatus.active },
          include: {
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
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

    const row = await this.prisma.unscoped.companyAsset.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        name: dto.name.trim(),
        assetTag: dto.assetTag.trim(),
        category: dto.category,
        serialNumber: dto.serialNumber?.trim() ?? null,
        purchaseDate: dto.purchaseDate
          ? new Date(`${dto.purchaseDate}T00:00:00.000Z`)
          : null,
        warrantyExpiryDate: dto.warrantyExpiryDate
          ? new Date(`${dto.warrantyExpiryDate}T00:00:00.000Z`)
          : null,
        purchaseValue:
          dto.purchaseValue != null
            ? new Prisma.Decimal(dto.purchaseValue)
            : null,
        currency: dto.currency?.trim() ?? 'AUD',
        notes: dto.notes?.trim() ?? null,
        status: AssetStatus.available,
      },
      include: {
        assignments: {
          where: { status: AssetAssignmentStatus.active },
          include: {
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

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

    if (asset.status !== AssetStatus.available) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only available assets can be assigned',
      });
    }

    const employee = await this.prisma.unscoped.employee.findFirst({
      where: {
        id: dto.employeeId,
        companyId: asset.companyId,
        deletedAt: null,
      },
    });
    if (!employee) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    const assignment = await this.prisma.unscoped.$transaction(async (tx) => {
      const created = await tx.employeeAssetAssignment.create({
        data: {
          assetId,
          employeeId: dto.employeeId,
          assignedAt: dto.assignedAt
            ? new Date(`${dto.assignedAt}T00:00:00.000Z`)
            : new Date(),
          conditionOnAssign: dto.conditionOnAssign?.trim() ?? null,
          notes: dto.notes?.trim() ?? null,
          assignedByUserId: user.id,
          onboardingTaskId: dto.onboardingTaskId ?? null,
        },
        include: {
          asset: { select: { name: true, assetTag: true } },
          employee: { select: { firstName: true, lastName: true } },
        },
      });

      await tx.companyAsset.update({
        where: { id: assetId },
        data: { status: AssetStatus.assigned },
      });

      return created;
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'update',
      module: 'employee',
      recordId: assetId,
      newValue: { assignmentId: assignment.id, employeeId: dto.employeeId },
    });

    if (this.onboardingSync) {
      await this.onboardingSync.syncAfterAssetAssignment({
        employeeId: dto.employeeId,
        assetId,
        assetCategory: asset.category,
        onboardingTaskId: dto.onboardingTaskId,
      });
    }

    return toAssignmentRecord(assignment);
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
      include: {
        asset: { select: { name: true, assetTag: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
    });

    if (!activeAssignment) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Asset is not currently assigned',
      });
    }

    const returnedAt = dto.returnedAt
      ? new Date(`${dto.returnedAt}T00:00:00.000Z`)
      : new Date();

    const updated = await this.prisma.unscoped.$transaction(async (tx) => {
      const row = await tx.employeeAssetAssignment.update({
        where: { id: activeAssignment.id },
        data: {
          status: AssetAssignmentStatus.returned,
          returnedAt,
          conditionOnReturn: dto.conditionOnReturn?.trim() ?? null,
          notes: dto.notes?.trim() ?? activeAssignment.notes,
          returnedByUserId: user.id,
          offboardingTaskId: dto.offboardingTaskId ?? null,
        },
        include: {
          asset: { select: { name: true, assetTag: true } },
          employee: { select: { firstName: true, lastName: true } },
        },
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
      newValue: { returnedAssignmentId: updated.id },
    });

    return toAssignmentRecord(updated);
  }

  async listAssignments(
    companyId: string,
    query: ListAssetAssignmentsQueryDto,
  ): Promise<EmployeeAssetAssignmentRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.employeeAssetAssignment.findMany({
      where: {
        asset: { companyId },
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.activeOnly ? { status: AssetAssignmentStatus.active } : {}),
      },
      include: {
        asset: { select: { name: true, assetTag: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
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
        ...(category
          ? { asset: { category: category as never } }
          : {}),
      },
    });
  }

  private async findOrThrow(assetId: string) {
    const row = await this.prisma.unscoped.companyAsset.findUnique({
      where: { id: assetId },
      include: {
        assignments: {
          where: { status: AssetAssignmentStatus.active },
          include: {
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
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
