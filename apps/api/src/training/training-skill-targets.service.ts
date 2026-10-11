import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  DesignationSkillTargetRecord,
  EmployeeSkillGapRow,
  SkillGapBySkill,
  SkillGapReport,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { DataScopeService } from '../rbac/data-scope.service';
import { formatDateValue } from '../contracts/employment-contract.utils';
import type { ListSkillTargetsQueryDto, SetSkillTargetDto } from './dto/training.dto';
import { assessSkillGap } from './skill-gap.rules';
import { TrainingSkillsService } from './training-skills.service';

const TARGET_INCLUDE = {
  designation: { select: { name: true } },
  skill: { select: { name: true, category: true } },
} satisfies Prisma.DesignationSkillTargetInclude;

type TargetWithRelations = Prisma.DesignationSkillTargetGetPayload<{ include: typeof TARGET_INCLUDE }>;

@Injectable()
export class TrainingSkillTargetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly dataScope: DataScopeService,
    private readonly skillsService: TrainingSkillsService,
  ) {}

  async listTargets(companyId: string, query: ListSkillTargetsQueryDto): Promise<DesignationSkillTargetRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const rows = await this.prisma.unscoped.designationSkillTarget.findMany({
      where: { companyId, designationId: query.designationId },
      include: TARGET_INCLUDE,
      orderBy: [{ designation: { name: 'asc' } }, { skill: { name: 'asc' } }],
    });
    return rows.map((row) => this.toRecord(row));
  }

  /** Sets (or changes) the level a designation should reach in a skill. */
  async setTarget(
    companyId: string,
    dto: SetSkillTargetDto,
    user: AuthenticatedUser,
  ): Promise<DesignationSkillTargetRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const designation = await this.prisma.unscoped.designation.findFirst({
      where: { id: dto.designationId, companyId },
      select: { id: true },
    });
    if (!designation) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Designation not found' });
    const skill = await this.skillsService.getSkillOrThrow(dto.skillId, company.tenantId);
    if (skill.companyId !== companyId) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Skill not found' });

    const key = { designationId_skillId: { designationId: dto.designationId, skillId: dto.skillId } };
    const existing = await this.prisma.unscoped.designationSkillTarget.findUnique({
      where: key,
      select: { targetLevel: true },
    });
    const row = await this.prisma.unscoped.designationSkillTarget.upsert({
      where: key,
      create: {
        tenantId: company.tenantId,
        companyId,
        designationId: dto.designationId,
        skillId: dto.skillId,
        targetLevel: dto.targetLevel,
      },
      update: { targetLevel: dto.targetLevel },
      include: TARGET_INCLUDE,
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: existing ? 'update' : 'create',
      module: 'training',
      recordId: row.id,
      oldValue: existing ? { targetLevel: existing.targetLevel } : undefined,
      newValue: { entity: 'skill_target', ...dto },
    });

    return this.toRecord(row);
  }

  async deleteTarget(targetId: string, user: AuthenticatedUser): Promise<void> {
    const existing = user.tenantId
      ? await this.prisma.unscoped.designationSkillTarget.findFirst({ where: { id: targetId, tenantId: user.tenantId } })
      : null;
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Skill target not found' });

    await this.prisma.unscoped.designationSkillTarget.delete({ where: { id: targetId } });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'delete',
      module: 'training',
      recordId: targetId,
      oldValue: {
        entity: 'skill_target',
        designationId: existing.designationId,
        skillId: existing.skillId,
        targetLevel: existing.targetLevel,
      },
    });
  }

  /** Current employees in scope against their designation's targets. */
  async getGapReport(companyId: string, user: AuthenticatedUser): Promise<SkillGapReport> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const scope = await this.dataScope.employeeIdFilter(user);

    const [targets, employees] = await Promise.all([
      this.prisma.unscoped.designationSkillTarget.findMany({ where: { companyId }, include: TARGET_INCLUDE }),
      this.prisma.unscoped.employee.findMany({
        where: { companyId, deletedAt: null, employmentStatus: { not: 'terminated' }, id: scope },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
          designationId: true,
          department: { select: { name: true } },
        },
      }),
    ]);

    const targetsByDesignation = new Map<string, TargetWithRelations[]>();
    for (const target of targets) {
      targetsByDesignation.set(target.designationId, [...(targetsByDesignation.get(target.designationId) ?? []), target]);
    }
    const targeted = employees.filter((row) => row.designationId && targetsByDesignation.has(row.designationId));
    const ratings = targeted.length
      ? await this.prisma.unscoped.employeeSkill.findMany({
          where: { companyId, employeeId: { in: targeted.map((row) => row.id) } },
          select: { employeeId: true, skillId: true, level: true, assessedAt: true },
        })
      : [];
    const ratingAt = new Map(ratings.map((row) => [`${row.employeeId}:${row.skillId}`, row]));

    const bySkill = new Map<string, SkillGapBySkill>();
    const rows: EmployeeSkillGapRow[] = targeted.map((employee) => {
      const designationTargets = targetsByDesignation.get(employee.designationId!)!;
      const items = designationTargets
        .map((target) => {
          const rating = ratingAt.get(`${employee.id}:${target.skillId}`);
          const { status, gap } = assessSkillGap(target.targetLevel, rating?.level ?? null);
          const skillStats = bySkill.get(target.skillId) ?? {
            skillId: target.skillId,
            skillName: target.skill.name,
            skillCategory: target.skill.category,
            targetedEmployees: 0,
            belowCount: 0,
            notAssessedCount: 0,
          };
          skillStats.targetedEmployees += 1;
          if (status === 'below') skillStats.belowCount += 1;
          if (status === 'not_assessed') skillStats.notAssessedCount += 1;
          bySkill.set(target.skillId, skillStats);
          return {
            skillId: target.skillId,
            skillName: target.skill.name,
            skillCategory: target.skill.category,
            targetLevel: target.targetLevel,
            currentLevel: rating?.level ?? null,
            assessedAt: rating?.assessedAt ? formatDateValue(rating.assessedAt) : null,
            status,
            gap,
          };
        })
        .sort((a, b) => b.gap - a.gap || a.skillName.localeCompare(b.skillName));
      return {
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
        employeeNumber: employee.employeeNumber,
        departmentName: employee.department?.name ?? null,
        designationId: employee.designationId!,
        designationName: designationTargets[0].designation.name,
        targetCount: items.length,
        metCount: items.filter((item) => item.status === 'met').length,
        totalGap: items.reduce((sum, item) => sum + item.gap, 0),
        items,
      };
    });
    rows.sort((a, b) => b.totalGap - a.totalGap || a.employeeName.localeCompare(b.employeeName));

    return {
      employees: rows,
      skills: [...bySkill.values()].sort(
        (a, b) => b.belowCount + b.notAssessedCount - (a.belowCount + a.notAssessedCount) || a.skillName.localeCompare(b.skillName),
      ),
      summary: {
        employeesWithTargets: rows.length,
        employeesMeetingAll: rows.filter((row) => row.metCount === row.targetCount).length,
        openGaps: rows.reduce((sum, row) => sum + row.targetCount - row.metCount, 0),
        designationsWithTargets: targetsByDesignation.size,
        employeesWithoutTargets: employees.length - rows.length,
      },
    };
  }

  private toRecord(row: TargetWithRelations): DesignationSkillTargetRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      designationId: row.designationId,
      designationName: row.designation.name,
      skillId: row.skillId,
      skillName: row.skill.name,
      skillCategory: row.skill.category,
      targetLevel: row.targetLevel,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
