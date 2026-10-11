import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type EmployeeSkill, type Skill } from '@prisma/client';
import type { EmployeeSkillRecord, SkillRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { DataScopeService } from '../rbac/data-scope.service';
import { formatDateValue } from '../contracts/employment-contract.utils';
import type {
  CreateSkillDto,
  ListEmployeeSkillsQueryDto,
  ListSkillsQueryDto,
  UpdateEmployeeSkillDto,
  UpdateSkillDto,
  UpsertEmployeeSkillDto,
} from './dto/training.dto';
import { assertNotFuture, parseDateOnly } from './certification.rules';
import { startOfUtcDay } from './training.utils';

const SKILL_INCLUDE = {
  _count: { select: { employeeSkills: true, designationTargets: true } },
} satisfies Prisma.SkillInclude;

const EMPLOYEE_SKILL_INCLUDE = {
  employee: {
    select: {
      firstName: true,
      lastName: true,
      employeeNumber: true,
      department: { select: { name: true } },
    },
  },
  skill: { select: { name: true, category: true } },
} satisfies Prisma.EmployeeSkillInclude;

type SkillWithCounts = Prisma.SkillGetPayload<{ include: typeof SKILL_INCLUDE }>;
type EmployeeSkillWithRelations = Prisma.EmployeeSkillGetPayload<{ include: typeof EMPLOYEE_SKILL_INCLUDE }>;

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function trimOrNull(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function duplicateSkill(name: string): never {
  throw new ConflictException({ code: 'DUPLICATE_SKILL', message: `“${name}” is already in the skill catalog` });
}

@Injectable()
export class TrainingSkillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly dataScope: DataScopeService,
  ) {}

  async listSkills(companyId: string, query: ListSkillsQueryDto): Promise<SkillRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.skill.findMany({
      where: { companyId, category: query.category },
      include: SKILL_INCLUDE,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return rows.map((row) => this.toSkillRecord(row));
  }

  async createSkill(companyId: string, dto: CreateSkillDto, user: AuthenticatedUser): Promise<SkillRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const name = cleanName(dto.name);
    await this.assertNameAvailable(companyId, name);

    let row: SkillWithCounts;
    try {
      row = await this.prisma.unscoped.skill.create({
        data: {
          tenantId: company.tenantId,
          companyId,
          name,
          category: trimOrNull(dto.category),
          description: trimOrNull(dto.description),
        },
        include: SKILL_INCLUDE,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') duplicateSkill(name);
      throw error;
    }

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'training',
      recordId: row.id,
      newValue: { entity: 'skill', ...dto },
    });

    return this.toSkillRecord(row);
  }

  async updateSkill(skillId: string, dto: UpdateSkillDto, user: AuthenticatedUser): Promise<SkillRecord> {
    const existing = await this.getSkillOrThrow(skillId, user.tenantId);
    const name = dto.name !== undefined ? cleanName(dto.name) : existing.name;
    if (name.toLowerCase() !== existing.name.toLowerCase()) {
      await this.assertNameAvailable(existing.companyId, name, skillId);
    }

    let row: SkillWithCounts;
    try {
      row = await this.prisma.unscoped.skill.update({
        where: { id: skillId },
        data: {
          name,
          ...(dto.category !== undefined ? { category: trimOrNull(dto.category) } : {}),
          ...(dto.description !== undefined ? { description: trimOrNull(dto.description) } : {}),
        },
        include: SKILL_INCLUDE,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') duplicateSkill(name);
      throw error;
    }

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'training',
      recordId: skillId,
      oldValue: { name: existing.name, category: existing.category, description: existing.description },
      newValue: { entity: 'skill', ...dto },
    });

    return this.toSkillRecord(row);
  }

  /** Removes the skill with every rating and designation target for it. */
  async deleteSkill(
    skillId: string,
    user: AuthenticatedUser,
  ): Promise<{ removedRatings: number; removedTargets: number }> {
    const existing = await this.getSkillOrThrow(skillId, user.tenantId);
    const [ratings, targets] = await this.prisma.unscoped.$transaction([
      this.prisma.unscoped.employeeSkill.deleteMany({ where: { skillId } }),
      this.prisma.unscoped.designationSkillTarget.deleteMany({ where: { skillId } }),
      this.prisma.unscoped.skill.delete({ where: { id: skillId } }),
    ]);

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'delete',
      module: 'training',
      recordId: skillId,
      oldValue: {
        entity: 'skill',
        name: existing.name,
        category: existing.category,
        removedRatings: ratings.count,
        removedTargets: targets.count,
      },
    });

    return { removedRatings: ratings.count, removedTargets: targets.count };
  }

  async listEmployeeSkills(
    companyId: string,
    query: ListEmployeeSkillsQueryDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeSkillRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    if (query.employeeId) {
      await this.dataScope.assertEmployeeInScope(user, query.employeeId);
    }

    const rows = await this.prisma.unscoped.employeeSkill.findMany({
      where: {
        companyId,
        employeeId: query.employeeId ?? (await this.dataScope.employeeIdFilter(user)),
        skillId: query.skillId,
        level: query.level,
      },
      include: EMPLOYEE_SKILL_INCLUDE,
      orderBy: [{ skill: { category: 'asc' } }, { skill: { name: 'asc' } }],
    });

    return rows.map((row) => this.toEmployeeSkillRecord(row));
  }

  /** Sets an employee's level for a skill (a matrix cell); the assessed date defaults to today. */
  async upsertEmployeeSkill(
    companyId: string,
    dto: UpsertEmployeeSkillDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeSkillRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    await this.assertEmployeeCanBeRated(dto.employeeId, companyId);
    await this.dataScope.assertEmployeeInScope(user, dto.employeeId);
    const skill = await this.getSkillOrThrow(dto.skillId, company.tenantId);
    if (skill.companyId !== companyId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Skill not found' });
    }

    const today = new Date();
    const assessedAt = dto.assessedAt ? parseDateOnly(dto.assessedAt, 'assessedAt') : startOfUtcDay(today);
    assertNotFuture(assessedAt, today, 'The assessment date');

    const existing = await this.prisma.unscoped.employeeSkill.findUnique({
      where: { employeeId_skillId: { employeeId: dto.employeeId, skillId: dto.skillId } },
      select: { level: true },
    });

    const row = await this.prisma.unscoped.employeeSkill.upsert({
      where: { employeeId_skillId: { employeeId: dto.employeeId, skillId: dto.skillId } },
      create: {
        tenantId: company.tenantId,
        companyId,
        employeeId: dto.employeeId,
        skillId: dto.skillId,
        level: dto.level,
        assessedAt,
        notes: trimOrNull(dto.notes),
      },
      update: {
        level: dto.level,
        assessedAt,
        ...(dto.notes !== undefined ? { notes: trimOrNull(dto.notes) } : {}),
      },
      include: EMPLOYEE_SKILL_INCLUDE,
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: existing ? 'update' : 'create',
      module: 'training',
      recordId: row.id,
      oldValue: existing ? { level: existing.level } : undefined,
      newValue: { entity: 'employee_skill', ...dto },
    });

    return this.toEmployeeSkillRecord(row);
  }

  async updateEmployeeSkill(
    assignmentId: string,
    dto: UpdateEmployeeSkillDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeSkillRecord> {
    const existing = await this.getEmployeeSkillOrThrow(assignmentId, user.tenantId);
    await this.dataScope.assertEmployeeInScope(user, existing.employeeId);

    let assessedAt: Date | null | undefined;
    if (dto.assessedAt !== undefined) {
      assessedAt = dto.assessedAt ? parseDateOnly(dto.assessedAt, 'assessedAt') : null;
      assertNotFuture(assessedAt, new Date(), 'The assessment date');
    }

    const row = await this.prisma.unscoped.employeeSkill.update({
      where: { id: assignmentId },
      data: {
        ...(dto.level !== undefined ? { level: dto.level } : {}),
        ...(assessedAt !== undefined ? { assessedAt } : {}),
        ...(dto.notes !== undefined ? { notes: trimOrNull(dto.notes) } : {}),
      },
      include: EMPLOYEE_SKILL_INCLUDE,
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'training',
      recordId: assignmentId,
      oldValue: { level: existing.level },
      newValue: { entity: 'employee_skill', ...dto },
    });

    return this.toEmployeeSkillRecord(row);
  }

  async deleteEmployeeSkill(assignmentId: string, user: AuthenticatedUser): Promise<void> {
    const existing = await this.getEmployeeSkillOrThrow(assignmentId, user.tenantId);
    await this.dataScope.assertEmployeeInScope(user, existing.employeeId);

    await this.prisma.unscoped.employeeSkill.delete({ where: { id: assignmentId } });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'delete',
      module: 'training',
      recordId: assignmentId,
      oldValue: {
        entity: 'employee_skill',
        employeeId: existing.employeeId,
        skillId: existing.skillId,
        level: existing.level,
      },
    });
  }

  async getSkillOrThrow(skillId: string, tenantId: string | null): Promise<Skill> {
    const row = tenantId ? await this.prisma.unscoped.skill.findFirst({ where: { id: skillId, tenantId } }) : null;
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Skill not found' });
    return row;
  }

  private async getEmployeeSkillOrThrow(assignmentId: string, tenantId: string | null): Promise<EmployeeSkill> {
    const row = tenantId
      ? await this.prisma.unscoped.employeeSkill.findFirst({ where: { id: assignmentId, tenantId } })
      : null;
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Skill rating not found' });
    return row;
  }

  private async assertNameAvailable(companyId: string, name: string, excludeId?: string): Promise<void> {
    const clash = await this.prisma.unscoped.skill.findFirst({
      where: {
        companyId,
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (clash) duplicateSkill(name);
  }

  private async assertEmployeeCanBeRated(employeeId: string, companyId: string): Promise<void> {
    const employee = await this.prisma.unscoped.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { employmentStatus: true },
    });
    if (!employee) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Employee not found' });
    }
    if (employee.employmentStatus === 'terminated') {
      throw new BadRequestException({
        code: 'EMPLOYEE_TERMINATED',
        message: 'Skills can’t be rated for a terminated employee',
      });
    }
  }

  private toSkillRecord(row: SkillWithCounts): SkillRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      category: row.category,
      description: row.description,
      assignmentCount: row._count.employeeSkills,
      targetCount: row._count.designationTargets,
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
