import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, SafetyComplianceRecord, SafetyInspection } from '@prisma/client';
import type {
  HealthSafetySummary,
  SafetyComplianceRecordView,
  SafetyInspectionChecklistItem,
  SafetyInspectionRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateSafetyInspectionDto,
  UpdateSafetyComplianceDto,
} from './dto/health-safety.dto';
import { computeDaysIncidentFree } from './health-safety.utils';
import { HealthSafetyRulesService } from './health-safety-rules.service';

type ComplianceWithEmployee = SafetyComplianceRecord & {
  employee: { firstName: string; lastName: string } | null;
};

type InspectionWithInspector = SafetyInspection & {
  inspectorEmployee: { firstName: string; lastName: string } | null;
};

@Injectable()
export class SafetyComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly rulesService: HealthSafetyRulesService,
  ) {}

  async getSummary(companyId: string): Promise<HealthSafetySummary> {
    await this.companyScope.assertCompanyInTenant(companyId);
    await this.syncComplianceFromRules(companyId);

    const yearStart = new Date();
    yearStart.setUTCMonth(0, 1);
    yearStart.setUTCHours(0, 0, 0, 0);
    const now = new Date();

    const [
      openIncidentCount,
      regulatorReportsDueCount,
      injuryLogCountThisYear,
      complianceRecords,
      lastIncident,
    ] = await Promise.all([
      this.prisma.unscoped.workplaceIncident.count({
        where: {
          companyId,
          status: { in: ['reported', 'under_investigation'] },
        },
      }),
      this.prisma.unscoped.workplaceIncident.count({
        where: {
          companyId,
          regulatorReportRequired: true,
          regulatorReportSubmittedAt: null,
          regulatorReportDueAt: { lte: now },
        },
      }),
      this.prisma.unscoped.injuryLogEntry.count({
        where: { companyId, recordedAt: { gte: yearStart } },
      }),
      this.prisma.unscoped.safetyComplianceRecord.findMany({
        where: { companyId },
        select: { status: true },
      }),
      this.prisma.unscoped.workplaceIncident.findFirst({
        where: { companyId },
        orderBy: { occurredAt: 'desc' },
        select: { occurredAt: true },
      }),
    ]);

    const totalCompliance = complianceRecords.length;
    const compliantCount = complianceRecords.filter(
      (row) => row.status === 'compliant',
    ).length;
    const complianceOverdueCount = complianceRecords.filter(
      (row) => row.status === 'overdue',
    ).length;
    const complianceCompliantPercent =
      totalCompliance === 0
        ? 100
        : Math.round((compliantCount / totalCompliance) * 100);

    return {
      openIncidentCount,
      regulatorReportsDueCount,
      injuryLogCountThisYear,
      complianceOverdueCount,
      complianceCompliantPercent,
      daysIncidentFree: computeDaysIncidentFree(
        lastIncident?.occurredAt ?? null,
        now,
      ),
    };
  }

  async listCompliance(companyId: string): Promise<SafetyComplianceRecordView[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    await this.syncComplianceFromRules(companyId);

    const rows = await this.prisma.unscoped.safetyComplianceRecord.findMany({
      where: { companyId },
      include: {
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });

    return rows.map((row) => this.toComplianceRecord(row));
  }

  async updateCompliance(
    recordId: string,
    dto: UpdateSafetyComplianceDto,
    user: AuthenticatedUser,
  ): Promise<SafetyComplianceRecordView> {
    const existing = await this.prisma.unscoped.safetyComplianceRecord.findUnique({
      where: { id: recordId },
      include: {
        employee: { select: { firstName: true, lastName: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException('Compliance record not found');
    }
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    const row = await this.prisma.unscoped.safetyComplianceRecord.update({
      where: { id: recordId },
      data: {
        status: dto.status,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        completedAt: dto.completedAt
          ? new Date(dto.completedAt)
          : dto.status === 'compliant'
            ? new Date()
            : undefined,
      },
      include: {
        employee: { select: { firstName: true, lastName: true } },
      },
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'health_safety',
      recordId: row.id,
      oldValue: { status: existing.status },
      newValue: { status: row.status, completedAt: row.completedAt },
    });

    return this.toComplianceRecord(row);
  }

  async listInspections(companyId: string): Promise<SafetyInspectionRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.safetyInspection.findMany({
      where: { companyId },
      include: {
        inspectorEmployee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { inspectedAt: 'desc' },
      take: 20,
    });

    return rows.map((row) => this.toInspectionRecord(row));
  }

  async createInspection(
    companyId: string,
    dto: CreateSafetyInspectionDto,
    user: AuthenticatedUser,
  ): Promise<SafetyInspectionRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    const passed = dto.checklistItems.filter((item) => item.passed).length;
    const scorePercent =
      dto.checklistItems.length === 0
        ? null
        : Math.round((passed / dto.checklistItems.length) * 100);

    const row = await this.prisma.unscoped.safetyInspection.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        title: dto.title.trim(),
        inspectedAt: new Date(dto.inspectedAt),
        inspectorEmployeeId: dto.inspectorEmployeeId,
        status: 'completed',
        scorePercent,
        checklistItems: dto.checklistItems as unknown as Prisma.InputJsonValue,
        createdByUserId: user.id,
      },
      include: {
        inspectorEmployee: { select: { firstName: true, lastName: true } },
      },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'health_safety',
      recordId: row.id,
      newValue: { title: row.title, scorePercent: row.scorePercent },
    });

    return this.toInspectionRecord(row);
  }

  async syncComplianceFromRules(companyId: string): Promise<void> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    const sampleEmployee = await this.prisma.unscoped.employee.findFirst({
      where: { companyId, deletedAt: null, employmentStatus: 'active' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!sampleEmployee) {
      return;
    }

    const rules = await this.rulesService.resolveForEmployee(
      sampleEmployee.id,
      new Date(),
    );
    const requirements = rules.complianceRequirements ?? [];

    for (const requirement of requirements) {
      const dueDate = requirement.frequencyDays
        ? new Date(Date.now() + requirement.frequencyDays * 24 * 60 * 60 * 1000)
        : requirement.renewalMonths
          ? new Date(
              Date.now() + requirement.renewalMonths * 30 * 24 * 60 * 60 * 1000,
            )
          : null;

      await this.prisma.unscoped.safetyComplianceRecord.upsert({
        where: {
          companyId_requirementKey_scopeKey: {
            companyId,
            requirementKey: requirement.key,
            scopeKey: 'company',
          },
        },
        create: {
          tenantId: company.tenantId,
          companyId,
          requirementKey: requirement.key,
          title: requirement.title,
          description: requirement.description ?? null,
          requirementType: requirement.type,
          status: 'pending',
          dueDate,
          scopeKey: 'company',
          sourceRuleType: 'health_safety',
          metadata: {},
        },
        update: {
          title: requirement.title,
          description: requirement.description ?? null,
          requirementType: requirement.type,
        },
      });
    }

    const now = new Date();
    await this.prisma.unscoped.safetyComplianceRecord.updateMany({
      where: {
        companyId,
        status: { in: ['pending', 'compliant'] },
        dueDate: { lt: now },
      },
      data: { status: 'overdue' },
    });
  }

  private toComplianceRecord(row: ComplianceWithEmployee): SafetyComplianceRecordView {
    return {
      id: row.id,
      companyId: row.companyId,
      requirementKey: row.requirementKey,
      title: row.title,
      description: row.description,
      requirementType: row.requirementType,
      status: row.status,
      dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      employeeId: row.employeeId,
      employeeName: row.employee
        ? `${row.employee.firstName} ${row.employee.lastName}`.trim()
        : null,
      scopeKey: row.scopeKey,
      sourceRuleType: row.sourceRuleType,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toInspectionRecord(row: InspectionWithInspector): SafetyInspectionRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      title: row.title,
      inspectedAt: row.inspectedAt.toISOString(),
      status: row.status,
      inspectorEmployeeId: row.inspectorEmployeeId,
      inspectorEmployeeName: row.inspectorEmployee
        ? `${row.inspectorEmployee.firstName} ${row.inspectorEmployee.lastName}`.trim()
        : null,
      scorePercent: row.scorePercent,
      checklistItems: Array.isArray(row.checklistItems)
        ? (row.checklistItems as unknown as SafetyInspectionChecklistItem[])
        : [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
