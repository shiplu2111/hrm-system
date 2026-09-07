import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EmployeeSkill, Skill } from '@prisma/client';
import type { EmployeeSkillRecord, SkillRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { formatDateValue } from '../contracts/employment-contract.utils';
import type {
  CreateSkillDto,
  ListEmployeeSkillsQueryDto,
  ListSkillsQueryDto,
  UpdateEmployeeSkillDto,
  UpdateSkillDto,
  UpsertEmployeeSkillDto,
} from './dto/training.dto';

type SkillWithCounts = Skill & {
  _count: { employeeSkills: number };
};

type EmployeeSkillWithRelations = EmployeeSkill & {
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string;
    department: { name: string } | null;
  };
  skill: { name: string; category: string | null };
};

@Injectable()
export class TrainingSkillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async listSkills(companyId: string, query: ListSkillsQueryDto): Promise<SkillRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.skill.findMany({
      where: {
        companyId,
        category: query.category,
      },
      include: { _count: { select: { employeeSkills: true } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return rows.map((row) => this.toSkillRecord(row as SkillWithCounts));
  }

  async createSkill(
    companyId: string,
    dto: CreateSkillDto,
    user: AuthenticatedUser,
  ): Promise<SkillRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    try {
      const row = await this.prisma.unscoped.skill.create({
        data: {
          tenantId: company.tenantId,
          companyId,
          name: dto.name.trim(),
          category: dto.category?.trim() || null,
          description: dto.description?.trim() || null,
        },
        include: { _count: { select: { employeeSkills: true } } },
      });

      await this.auditService.log({
        tenantId: company.tenantId,
        userId: user.id,
        action: 'create',
        module: 'training',
        recordId: row.id,
        newValue: { ...dto },
      });

      return this.toSkillRecord(row as SkillWithCounts);
    } catch {
      throw new ConflictException('A skill with this name already exists');
    }
  }

  async updateSkill(
    skillId: string,
    dto: UpdateSkillDto,
    user: AuthenticatedUser,
  ): Promise<SkillRecord> {
    const existing = await this.getSkillOrThrow(skillId);

    try {
      const row = await this.prisma.unscoped.skill.update({
        where: { id: skillId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.category !== undefined ? { category: dto.category?.trim() || null } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
        },
        include: { _count: { select: { employeeSkills: true } } },
      });

      await this.auditService.log({
        tenantId: existing.tenantId,
        userId: user.id,
        action: 'update',
        module: 'training',
        recordId: skillId,
        newValue: { ...dto },
      });

      return this.toSkillRecord(row as SkillWithCounts);
    } catch {
      throw new ConflictException('A skill with this name already exists');
    }
  }

  async listEmployeeSkills(
    companyId: string,
    query: ListEmployeeSkillsQueryDto,
  ): Promise<EmployeeSkillRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.employeeSkill.findMany({
      where: {
        companyId,
        employeeId: query.employeeId,
        skillId: query.skillId,
        level: query.level,
      },
      include: this.employeeSkillInclude(),
      orderBy: [{ skill: { category: 'asc' } }, { skill: { name: 'asc' } }],
    });

    return rows.map((row) => this.toEmployeeSkillRecord(row as EmployeeSkillWithRelations));
  }

  async upsertEmployeeSkill(
    companyId: string,
    dto: UpsertEmployeeSkillDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeSkillRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    await this.assertEmployeeInCompany(dto.employeeId, companyId);
    await this.getSkillOrThrow(dto.skillId, companyId);

    const row = await this.prisma.unscoped.employeeSkill.upsert({
      where: {
        employeeId_skillId: {
          employeeId: dto.employeeId,
          skillId: dto.skillId,
        },
      },
      create: {
        tenantId: company.tenantId,
        companyId,
        employeeId: dto.employeeId,
        skillId: dto.skillId,
        level: dto.level,
        assessedAt: dto.assessedAt ? this.parseDate(dto.assessedAt) : null,
        notes: dto.notes?.trim() || null,
      },
      update: {
        level: dto.level,
        assessedAt: dto.assessedAt ? this.parseDate(dto.assessedAt) : null,
        notes: dto.notes?.trim() || null,
      },
      include: this.employeeSkillInclude(),
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'update',
      module: 'training',
      recordId: row.id,
      newValue: { ...dto },
    });

    return this.toEmployeeSkillRecord(row as EmployeeSkillWithRelations);
  }

  async updateEmployeeSkill(
    assignmentId: string,
    dto: UpdateEmployeeSkillDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeSkillRecord> {
    const existing = await this.getEmployeeSkillOrThrow(assignmentId);

    const row = await this.prisma.unscoped.employeeSkill.update({
      where: { id: assignmentId },
      data: {
        ...(dto.level !== undefined ? { level: dto.level } : {}),
        ...(dto.assessedAt !== undefined
          ? { assessedAt: dto.assessedAt ? this.parseDate(dto.assessedAt) : null }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      },
      include: this.employeeSkillInclude(),
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'training',
      recordId: assignmentId,
      newValue: { ...dto },
    });

    return this.toEmployeeSkillRecord(row as EmployeeSkillWithRelations);
  }

  async deleteEmployeeSkill(assignmentId: string, user: AuthenticatedUser): Promise<void> {
    const existing = await this.getEmployeeSkillOrThrow(assignmentId);

    await this.prisma.unscoped.employeeSkill.delete({
      where: { id: assignmentId },
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'delete',
      module: 'training',
      recordId: assignmentId,
    });
  }

  async getSkillOrThrow(skillId: string, companyId?: string): Promise<Skill> {
    const row = await this.prisma.unscoped.skill.findFirst({
      where: { id: skillId, ...(companyId ? { companyId } : {}) },
    });
    if (!row) {
      throw new NotFoundException('Skill not found');
    }
    return row;
  }

  private async getEmployeeSkillOrThrow(assignmentId: string): Promise<EmployeeSkill> {
    const row = await this.prisma.unscoped.employeeSkill.findUnique({
      where: { id: assignmentId },
    });
    if (!row) {
      throw new NotFoundException('Employee skill assignment not found');
    }
    return row;
  }

  private employeeSkillInclude() {
    return {
      employee: {
        select: {
          firstName: true,
          lastName: true,
          employeeNumber: true,
          department: { select: { name: true } },
        },
      },
      skill: { select: { name: true, category: true } },
    };
  }

  private async assertEmployeeInCompany(
    employeeId: string,
    companyId: string,
  ): Promise<void> {
    const employee = await this.prisma.unscoped.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) {
      throw new ConflictException(`Invalid date "${value}", expected YYYY-MM-DD`);
    }
    return new Date(Date.UTC(year, month - 1, day));
  }

  private toSkillRecord(row: SkillWithCounts): SkillRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      category: row.category,
      description: row.description,
      assignmentCount: row._count.employeeSkills,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toEmployeeSkillRecord(row: EmployeeSkillWithRelations): EmployeeSkillRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      employeeId: row.employeeId,
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      employeeNumber: row.employee.employeeNumber,
      departmentName: row.employee.department?.name ?? null,
      skillId: row.skillId,
      skillName: row.skill.name,
      skillCategory: row.skill.category,
      level: row.level,
      assessedAt: row.assessedAt ? formatDateValue(row.assessedAt) : null,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
