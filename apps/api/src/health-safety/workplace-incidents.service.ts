import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  WorkplaceIncident,
  WorkplaceIncidentParty,
} from '@prisma/client';
import type {
  WorkplaceIncidentRecord,
  WorkplaceIncidentStatus,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { buildSafetyIncidentReportedVariables } from '../notifications/notification.helpers';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateEmployeeIncidentDto,
  CreateWorkplaceIncidentDto,
  ListIncidentsQueryDto,
  UpdateWorkplaceIncidentDto,
} from './dto/health-safety.dto';
import {
  generateIncidentNumber,
  resolveRegulatorReporting,
} from './health-safety.utils';
import { HealthSafetyRulesService } from './health-safety-rules.service';

type IncidentWithRelations = WorkplaceIncident & {
  reportedByEmployee: { firstName: string; lastName: string };
  parties: Array<
    WorkplaceIncidentParty & {
      employee: { firstName: string; lastName: string };
    }
  >;
};

@Injectable()
export class WorkplaceIncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly notificationEngine: NotificationEngineService,
    private readonly rulesService: HealthSafetyRulesService,
  ) {}

  async list(
    companyId: string,
    query: ListIncidentsQueryDto,
  ): Promise<WorkplaceIncidentRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const search = query.search?.trim();
    const rows = await this.prisma.unscoped.workplaceIncident.findMany({
      where: {
        companyId,
        status: query.status,
        severity: query.severity,
        ...(search
          ? {
              OR: [
                { incidentNumber: { contains: search, mode: 'insensitive' } },
                { location: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        reportedByEmployee: { select: { firstName: true, lastName: true } },
        parties: {
          include: {
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { occurredAt: 'desc' },
      take: query.limit ?? 50,
    });

    return rows.map((row) => this.toRecord(row));
  }

  async getById(incidentId: string): Promise<WorkplaceIncidentRecord> {
    const row = await this.findIncidentOrThrow(incidentId);
    return this.toRecord(row);
  }

  async createForEmployee(
    employeeId: string,
    dto: CreateEmployeeIncidentDto,
    user: AuthenticatedUser,
  ): Promise<WorkplaceIncidentRecord> {
    if (user.employeeId && user.employeeId !== employeeId) {
      throw new ForbiddenException('Cannot report an incident for another employee');
    }

    const employee = await this.prisma.unscoped.employee.findFirst({
      where: { id: employeeId, deletedAt: null, employmentStatus: 'active' },
      select: { companyId: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return this.create(
      employee.companyId,
      { ...dto, reportedByEmployeeId: employeeId },
      user,
    );
  }

  async create(
    companyId: string,
    dto: CreateWorkplaceIncidentDto,
    user: AuthenticatedUser,
  ): Promise<WorkplaceIncidentRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const reporterId = dto.reportedByEmployeeId ?? user.employeeId;

    if (!reporterId) {
      throw new BadRequestException('Reporter employee is required');
    }

    if (
      user.employeeId &&
      user.employeeId !== reporterId &&
      !dto.reportedByEmployeeId
    ) {
      throw new ForbiddenException('Cannot report on behalf of another employee');
    }

    await this.assertActiveEmployee(reporterId, companyId);
    const partyIds = dto.parties?.map((party) => party.employeeId) ?? [];
    await Promise.all(
      partyIds.map((id) => this.assertActiveEmployee(id, companyId)),
    );

    const occurredAt = new Date(dto.occurredAt);
    const rules = await this.rulesService.resolveForEmployee(reporterId, occurredAt);
    const regulator = resolveRegulatorReporting({
      rules,
      severity: dto.severity,
      incidentType: dto.incidentType,
      occurredAt,
    });

    const year = occurredAt.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
    const countForYear = await this.prisma.unscoped.workplaceIncident.count({
      where: {
        companyId,
        occurredAt: { gte: yearStart, lt: yearEnd },
      },
    });

    const row = await this.prisma.unscoped.workplaceIncident.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        incidentNumber: generateIncidentNumber(countForYear, year),
        incidentType: dto.incidentType,
        severity: dto.severity,
        location: dto.location.trim(),
        occurredAt,
        description: dto.description.trim(),
        reportedByEmployeeId: reporterId,
        gpsLat: dto.gpsLat,
        gpsLng: dto.gpsLng,
        regulatorReportRequired: regulator.required,
        regulatorReportDueAt: regulator.dueAt,
        regulatorName: regulator.regulatorName,
        createdByUserId: user.id,
        parties: dto.parties?.length
          ? {
              create: dto.parties.map((party) => ({
                tenantId: company.tenantId,
                employeeId: party.employeeId,
                partyRole: party.partyRole,
              })),
            }
          : undefined,
      },
      include: {
        reportedByEmployee: { select: { firstName: true, lastName: true } },
        parties: {
          include: {
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    const reporterName = this.employeeName(row.reportedByEmployee);

    await this.notificationEngine.emit({
      tenantId: company.tenantId,
      companyId,
      eventType: 'safety.incident.reported',
      subjectEmployeeId: reporterId,
      variables: buildSafetyIncidentReportedVariables({
        incidentNumber: row.incidentNumber,
        incidentType: row.incidentType,
        severity: row.severity,
        location: row.location,
        reporterName,
        regulatorReportRequired: row.regulatorReportRequired,
      }),
      payload: {
        incidentId: row.id,
        regulatorReportRequired: row.regulatorReportRequired,
      },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'health_safety',
      recordId: row.id,
      newValue: {
        incidentNumber: row.incidentNumber,
        incidentType: row.incidentType,
        severity: row.severity,
        regulatorReportRequired: row.regulatorReportRequired,
      },
    });

    return this.toRecord(row);
  }

  async update(
    incidentId: string,
    dto: UpdateWorkplaceIncidentDto,
    user: AuthenticatedUser,
  ): Promise<WorkplaceIncidentRecord> {
    const existing = await this.findIncidentOrThrow(incidentId);

    const updateData: Record<string, unknown> = {};
    if (dto.status) {
      updateData.status = dto.status;
      if (dto.status === 'resolved' || dto.status === 'closed') {
        updateData.resolvedAt = new Date();
      }
    }
    if (dto.investigationNotes !== undefined) {
      updateData.investigationNotes = dto.investigationNotes.trim() || null;
    }
    if (dto.regulatorReportSubmitted === true) {
      updateData.regulatorReportSubmittedAt = new Date();
    }

    const row = await this.prisma.unscoped.workplaceIncident.update({
      where: { id: incidentId },
      data: updateData,
      include: {
        reportedByEmployee: { select: { firstName: true, lastName: true } },
        parties: {
          include: {
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'health_safety',
      recordId: row.id,
      oldValue: { status: existing.status },
      newValue: {
        status: row.status,
        regulatorReportSubmittedAt: row.regulatorReportSubmittedAt,
      },
    });

    return this.toRecord(row);
  }

  private async findIncidentOrThrow(
    incidentId: string,
  ): Promise<IncidentWithRelations> {
    const row = await this.prisma.unscoped.workplaceIncident.findUnique({
      where: { id: incidentId },
      include: {
        reportedByEmployee: { select: { firstName: true, lastName: true } },
        parties: {
          include: {
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('Incident not found');
    }
    await this.companyScope.assertCompanyInTenant(row.companyId);
    return row;
  }

  private async assertActiveEmployee(employeeId: string, companyId: string) {
    const employee = await this.prisma.unscoped.employee.findFirst({
      where: {
        id: employeeId,
        companyId,
        deletedAt: null,
        employmentStatus: 'active',
      },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found or not active');
    }
  }

  private employeeName(employee: { firstName: string; lastName: string }): string {
    return `${employee.firstName} ${employee.lastName}`.trim();
  }

  private toRecord(row: IncidentWithRelations): WorkplaceIncidentRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      incidentNumber: row.incidentNumber,
      incidentType: row.incidentType,
      severity: row.severity,
      status: row.status as WorkplaceIncidentStatus,
      location: row.location,
      occurredAt: row.occurredAt.toISOString(),
      description: row.description,
      reportedByEmployeeId: row.reportedByEmployeeId,
      reportedByEmployeeName: this.employeeName(row.reportedByEmployee),
      gpsLat: row.gpsLat ? Number(row.gpsLat) : null,
      gpsLng: row.gpsLng ? Number(row.gpsLng) : null,
      regulatorReportRequired: row.regulatorReportRequired,
      regulatorReportDueAt: row.regulatorReportDueAt?.toISOString() ?? null,
      regulatorReportSubmittedAt:
        row.regulatorReportSubmittedAt?.toISOString() ?? null,
      regulatorName: row.regulatorName,
      investigationNotes: row.investigationNotes,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      parties: row.parties.map((party) => ({
        employeeId: party.employeeId,
        employeeName: this.employeeName(party.employee),
        partyRole: party.partyRole,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
