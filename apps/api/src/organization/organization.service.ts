import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from './company-scope.service';
import type {
  CreateCostCentreDto,
  CreateDepartmentDto,
  CreateDesignationDto,
  CreateJobLevelDto,
  CreateNamedEntityDto,
  UpdateCostCentreDto,
  UpdateDepartmentDto,
  UpdateDesignationDto,
  UpdateJobLevelDto,
  UpdateNamedEntityDto,
} from './dto/organization.dto';

export interface DepartmentTreeNode {
  id: string;
  companyId: string;
  name: string;
  parentDepartmentId: string | null;
  employeeCount: number;
  children: DepartmentTreeNode[];
}

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
  ) {}

  // --- Departments (hierarchical) ---

  async listDepartments(companyId: string) {
    await this.companyScope.assertCompanyInTenant(companyId);
    const departments = await this.prisma.unscoped.department.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: true } } },
    });

    return departments.map((row) => ({
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      parentDepartmentId: row.parentDepartmentId,
      employeeCount: row._count.employees,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async getDepartmentTree(companyId: string): Promise<DepartmentTreeNode[]> {
    const flat = await this.listDepartments(companyId);
    const nodes = new Map<string, DepartmentTreeNode>();

    for (const row of flat) {
      nodes.set(row.id, {
        id: row.id,
        companyId: row.companyId,
        name: row.name,
        parentDepartmentId: row.parentDepartmentId,
        employeeCount: row.employeeCount,
        children: [],
      });
    }

    const roots: DepartmentTreeNode[] = [];
    for (const node of nodes.values()) {
      if (node.parentDepartmentId && nodes.has(node.parentDepartmentId)) {
        nodes.get(node.parentDepartmentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async createDepartment(companyId: string, dto: CreateDepartmentDto) {
    await this.companyScope.assertCompanyInTenant(companyId);
    if (dto.parentDepartmentId) {
      await this.assertDepartmentInCompany(companyId, dto.parentDepartmentId);
    }

    const created = await this.prisma.unscoped.department.create({
      data: {
        companyId,
        name: dto.name.trim(),
        parentDepartmentId: dto.parentDepartmentId ?? null,
      },
    });

    return this.toDepartment(created, 0);
  }

  async updateDepartment(
    companyId: string,
    departmentId: string,
    dto: UpdateDepartmentDto,
  ) {
    await this.assertDepartmentInCompany(companyId, departmentId);

    if (dto.parentDepartmentId) {
      if (dto.parentDepartmentId === departmentId) {
        throw new ConflictException({
          code: 'VALIDATION_ERROR',
          message: 'Department cannot be its own parent',
        });
      }
      await this.assertDepartmentInCompany(companyId, dto.parentDepartmentId);
      await this.assertNoDepartmentCycle(
        companyId,
        departmentId,
        dto.parentDepartmentId,
      );
    }

    const updated = await this.prisma.unscoped.department.update({
      where: { id: departmentId },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.parentDepartmentId !== undefined
          ? { parentDepartmentId: dto.parentDepartmentId }
          : {}),
      },
      include: { _count: { select: { employees: true } } },
    });

    return this.toDepartment(updated, updated._count.employees);
  }

  async deleteDepartment(companyId: string, departmentId: string): Promise<void> {
    await this.assertDepartmentInCompany(companyId, departmentId);

    const childCount = await this.prisma.unscoped.department.count({
      where: { companyId, parentDepartmentId: departmentId },
    });
    if (childCount > 0) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Cannot delete department with child departments',
      });
    }

    const employeeCount = await this.prisma.unscoped.employee.count({
      where: { departmentId, deletedAt: null },
    });
    if (employeeCount > 0) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Cannot delete department with assigned employees',
      });
    }

    await this.prisma.unscoped.department.delete({ where: { id: departmentId } });
  }

  // --- Job levels ---

  async listJobLevels(companyId: string) {
    await this.companyScope.assertCompanyInTenant(companyId);
    return this.prisma.unscoped.jobLevel.findMany({
      where: { companyId },
      orderBy: [{ rank: 'asc' }, { code: 'asc' }],
    });
  }

  async createJobLevel(companyId: string, dto: CreateJobLevelDto) {
    await this.companyScope.assertCompanyInTenant(companyId);
    try {
      return await this.prisma.unscoped.jobLevel.create({
        data: {
          companyId,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          rank: dto.rank,
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Job level code already exists');
      throw error;
    }
  }

  async updateJobLevel(
    companyId: string,
    id: string,
    dto: UpdateJobLevelDto,
  ) {
    await this.assertJobLevelInCompany(companyId, id);
    try {
      return await this.prisma.unscoped.jobLevel.update({
        where: { id },
        data: {
          ...(dto.code != null ? { code: dto.code.trim().toUpperCase() } : {}),
          ...(dto.name != null ? { name: dto.name.trim() } : {}),
          ...(dto.rank != null ? { rank: dto.rank } : {}),
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Job level code already exists');
      throw error;
    }
  }

  async deleteJobLevel(companyId: string, id: string): Promise<void> {
    await this.assertJobLevelInCompany(companyId, id);
    const inUse = await this.prisma.unscoped.designation.count({
      where: { jobLevelId: id },
    });
    if (inUse > 0) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Job level is referenced by designations',
      });
    }
    await this.prisma.unscoped.jobLevel.delete({ where: { id } });
  }

  // --- Designations ---

  async listDesignations(companyId: string) {
    await this.companyScope.assertCompanyInTenant(companyId);
    return this.prisma.unscoped.designation.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      include: {
        department: { select: { id: true, name: true } },
        jobLevel: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async createDesignation(companyId: string, dto: CreateDesignationDto) {
    await this.companyScope.assertCompanyInTenant(companyId);
    if (dto.departmentId) {
      await this.assertDepartmentInCompany(companyId, dto.departmentId);
    }
    if (dto.jobLevelId) {
      await this.assertJobLevelInCompany(companyId, dto.jobLevelId);
    }

    return this.prisma.unscoped.designation.create({
      data: {
        companyId,
        name: dto.name.trim(),
        departmentId: dto.departmentId ?? null,
        jobLevelId: dto.jobLevelId ?? null,
        salaryGrade: dto.salaryGrade?.trim() ?? null,
      },
      include: {
        department: { select: { id: true, name: true } },
        jobLevel: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async updateDesignation(
    companyId: string,
    id: string,
    dto: UpdateDesignationDto,
  ) {
    await this.assertDesignationInCompany(companyId, id);
    if (dto.departmentId) {
      await this.assertDepartmentInCompany(companyId, dto.departmentId);
    }
    if (dto.jobLevelId) {
      await this.assertJobLevelInCompany(companyId, dto.jobLevelId);
    }

    return this.prisma.unscoped.designation.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.departmentId !== undefined
          ? { departmentId: dto.departmentId }
          : {}),
        ...(dto.jobLevelId !== undefined ? { jobLevelId: dto.jobLevelId } : {}),
        ...(dto.salaryGrade !== undefined
          ? { salaryGrade: dto.salaryGrade?.trim() ?? null }
          : {}),
      },
      include: {
        department: { select: { id: true, name: true } },
        jobLevel: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async deleteDesignation(companyId: string, id: string): Promise<void> {
    await this.assertDesignationInCompany(companyId, id);
    const inUse = await this.prisma.unscoped.employee.count({
      where: { designationId: id, deletedAt: null },
    });
    if (inUse > 0) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Designation is assigned to employees',
      });
    }
    await this.prisma.unscoped.designation.delete({ where: { id } });
  }

  // --- Employment types ---

  async listEmploymentTypes(companyId: string) {
    await this.companyScope.assertCompanyInTenant(companyId);
    return this.prisma.unscoped.employmentType.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  async createEmploymentType(companyId: string, dto: CreateNamedEntityDto) {
    await this.companyScope.assertCompanyInTenant(companyId);
    return this.prisma.unscoped.employmentType.create({
      data: { companyId, name: dto.name.trim() },
    });
  }

  async updateEmploymentType(
    companyId: string,
    id: string,
    dto: UpdateNamedEntityDto,
  ) {
    await this.assertEmploymentTypeInCompany(companyId, id);
    return this.prisma.unscoped.employmentType.update({
      where: { id },
      data: { ...(dto.name != null ? { name: dto.name.trim() } : {}) },
    });
  }

  async deleteEmploymentType(companyId: string, id: string): Promise<void> {
    await this.assertEmploymentTypeInCompany(companyId, id);
    const inUse = await this.prisma.unscoped.employee.count({
      where: { employmentTypeId: id, deletedAt: null },
    });
    if (inUse > 0) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Employment type is assigned to employees',
      });
    }
    await this.prisma.unscoped.employmentType.delete({ where: { id } });
  }

  // --- Teams ---

  async listTeams(companyId: string) {
    await this.companyScope.assertCompanyInTenant(companyId);
    return this.prisma.unscoped.team.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  async createTeam(companyId: string, dto: CreateNamedEntityDto) {
    await this.companyScope.assertCompanyInTenant(companyId);
    return this.prisma.unscoped.team.create({
      data: { companyId, name: dto.name.trim() },
    });
  }

  async updateTeam(companyId: string, id: string, dto: UpdateNamedEntityDto) {
    await this.assertTeamInCompany(companyId, id);
    return this.prisma.unscoped.team.update({
      where: { id },
      data: { ...(dto.name != null ? { name: dto.name.trim() } : {}) },
    });
  }

  async deleteTeam(companyId: string, id: string): Promise<void> {
    await this.assertTeamInCompany(companyId, id);
    await this.prisma.unscoped.team.delete({ where: { id } });
  }

  // --- Cost centres ---

  async listCostCentres(companyId: string) {
    await this.companyScope.assertCompanyInTenant(companyId);
    return this.prisma.unscoped.costCentre.findMany({
      where: { companyId },
      orderBy: { code: 'asc' },
    });
  }

  async createCostCentre(companyId: string, dto: CreateCostCentreDto) {
    await this.companyScope.assertCompanyInTenant(companyId);
    try {
      return await this.prisma.unscoped.costCentre.create({
        data: {
          companyId,
          name: dto.name.trim(),
          code: dto.code.trim().toUpperCase(),
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Cost centre code already exists');
      throw error;
    }
  }

  async updateCostCentre(
    companyId: string,
    id: string,
    dto: UpdateCostCentreDto,
  ) {
    await this.assertCostCentreInCompany(companyId, id);
    try {
      return await this.prisma.unscoped.costCentre.update({
        where: { id },
        data: {
          ...(dto.name != null ? { name: dto.name.trim() } : {}),
          ...(dto.code != null ? { code: dto.code.trim().toUpperCase() } : {}),
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Cost centre code already exists');
      throw error;
    }
  }

  async deleteCostCentre(companyId: string, id: string): Promise<void> {
    await this.assertCostCentreInCompany(companyId, id);
    const inUse = await this.prisma.unscoped.employee.count({
      where: { costCentreId: id, deletedAt: null },
    });
    if (inUse > 0) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Cost centre is assigned to employees',
      });
    }
    await this.prisma.unscoped.costCentre.delete({ where: { id } });
  }

  // --- Helpers ---

  private toDepartment(
    row: {
      id: string;
      companyId: string;
      name: string;
      parentDepartmentId: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    employeeCount: number,
  ) {
    return {
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      parentDepartmentId: row.parentDepartmentId,
      employeeCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async assertDepartmentInCompany(
    companyId: string,
    departmentId: string,
  ) {
    const row = await this.prisma.unscoped.department.findFirst({
      where: { id: departmentId, companyId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Department not found',
      });
    }
    return row;
  }

  private async assertNoDepartmentCycle(
    companyId: string,
    departmentId: string,
    newParentId: string,
  ): Promise<void> {
    let cursor: string | null = newParentId;
    while (cursor) {
      if (cursor === departmentId) {
        throw new ConflictException({
          code: 'VALIDATION_ERROR',
          message: 'Department hierarchy cycle detected',
        });
      }
      const parent: { parentDepartmentId: string | null } | null =
        await this.prisma.unscoped.department.findFirst({
          where: { id: cursor, companyId },
          select: { parentDepartmentId: true },
        });
      cursor = parent?.parentDepartmentId ?? null;
    }
  }

  private async assertJobLevelInCompany(companyId: string, id: string) {
    const row = await this.prisma.unscoped.jobLevel.findFirst({
      where: { id, companyId },
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Job level not found' });
    }
    return row;
  }

  private async assertDesignationInCompany(companyId: string, id: string) {
    const row = await this.prisma.unscoped.designation.findFirst({
      where: { id, companyId },
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Designation not found' });
    }
    return row;
  }

  private async assertEmploymentTypeInCompany(companyId: string, id: string) {
    const row = await this.prisma.unscoped.employmentType.findFirst({
      where: { id, companyId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employment type not found',
      });
    }
    return row;
  }

  private async assertTeamInCompany(companyId: string, id: string) {
    const row = await this.prisma.unscoped.team.findFirst({
      where: { id, companyId },
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Team not found' });
    }
    return row;
  }

  private async assertCostCentreInCompany(companyId: string, id: string) {
    const row = await this.prisma.unscoped.costCentre.findFirst({
      where: { id, companyId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Cost centre not found',
      });
    }
    return row;
  }

  private rethrowUnique(error: unknown, message: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({ code: 'CONFLICT', message });
    }
  }
}
