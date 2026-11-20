import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  Prisma,
  WorkplaceIncident,
  WorkplaceIncidentParty,
} from '@prisma/client';
import type {
  IncidentReportingRuleConfig,
  WorkplaceIncidentRecord,
  WorkplaceIncidentStatus,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { buildSafetyIncidentReportedVariables } from '../notifications/notification.helpers';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { DataScopeService } from '../rbac/data-scope.service';
import type {
  CreateEmployeeIncidentDto,
  CreateWorkplaceIncidentDto,
  IncidentPartyDto,
  ListIncidentsQueryDto,
  UpdateWorkplaceIncidentDto,
} from './dto/health-safety.dto';
import {
  buildIncidentReportingConfig,
  generateIncidentNumber,
  parseStoredReportingConfig,
  resolveRegulatorReporting,
  validateAndSanitizeCountrySpecificData,
} from './health-safety.utils';
import { HealthSafetyRulesService } from './health-safety-rules.service';

const INCIDENT_INCLUDE = {
  reportedByEmployee: { select: { firstName: true, lastName: true } },
  regulatorSubmittedByUser: {
    select: {
      id: true,
      email: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  },
  parties: {
    include: {
      employee: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.WorkplaceIncidentInclude;

type IncidentWithRelations = WorkplaceIncident & {
  reportedByEmployee: { firstName: string; lastName: string };
  regulatorSubmittedByUser?: {
    id: string;
    email: string;
    employee: { firstName: string; lastName: string } | null;
  } | null;
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
    private readonly dataScope: DataScopeService,
  ) {}

  async list(
    companyId: string,
    query: ListIncidentsQueryDto,
    user: AuthenticatedUser,
  ): Promise<WorkplaceIncidentRecord[]> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    const search = query.search?.trim();
    const scopeWhere = await this.scopeWhere(user);
    const rows = await this.prisma.unscoped.workplaceIncident.findMany({
      where: {
        tenantId: company.tenantId,
        companyId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.severity ? { severity: query.severity } : {}),
        ...(query.incidentType ? { incidentType: query.incidentType } : {}),
        ...(query.regulatorRequiredOnly === 'true'
          ? { regulatorReportRequired: true }
          : {}),
        ...(scopeWhere ? { AND: [scopeWhere] } : {}),
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
      include: INCIDENT_INCLUDE,
      orderBy: { occurredAt: 'desc' },
      take: query.limit ?? 50,
    });

    return rows.map((row) => this.toRecord(row));
  }

  async getById(
    incidentId: string,
    user: AuthenticatedUser,
  ): Promise<WorkplaceIncidentRecord> {
    const row = await this.findIncidentOrThrow(incidentId);
    await this.assertIncidentInScope(user, row);
    const resolvedConfig = await this.resolveConfigForIncident(row);
    return this.toRecord(row, resolvedConfig);
  }

  async createForEmployee(
    employeeId: string,
    dto: CreateEmployeeIncidentDto,
    user: AuthenticatedUser,
  ): Promise<WorkplaceIncidentRecord> {
    if (user.employeeId && user.employeeId !== employeeId) {
      throw new ForbiddenException('Cannot report an incident for another employee');
    }
    await this.dataScope.assertEmployeeInScope(user, employeeId);

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
    if (reporterId !== user.employeeId) {
      await this.dataScope.assertEmployeeInScope(user, reporterId);
    }

    const dedupedParties = this.dedupeParties(dto.parties);
    await this.assertActiveEmployee(reporterId, companyId, company.tenantId);
    await Promise.all(
      dedupedParties.map((party) =>
        this.assertActiveEmployee(party.employeeId, companyId, company.tenantId),
      ),
    );

    const occurredAt = new Date(dto.occurredAt);
    const { rules, layers } = await this.rulesService.resolveWithMetadataForEmployee(
      reporterId,
      occurredAt,
    );
    const regulator = resolveRegulatorReporting({
      rules,
      severity: dto.severity,
      incidentType: dto.incidentType,
      occurredAt,
    });
    const resolvedConfig = buildIncidentReportingConfig(rules, layers, occurredAt);

    const countrySpecificData = validateAndSanitizeCountrySpecificData({
      data: dto.countrySpecificData,
      fields: resolvedConfig.reportingFields,
      regulatorRequired: regulator.required,
      enforceRequired: dto.countrySpecificData !== undefined,
      enforceRegulatorRequired: false,
    });

    const year = occurredAt.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
    const countForYear = await this.prisma.unscoped.workplaceIncident.count({
      where: {
        tenantId: company.tenantId,
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
        countrySpecificData: countrySpecificData as Prisma.InputJsonValue,
        resolvedRuleSnapshot: resolvedConfig as unknown as Prisma.InputJsonValue,
        createdByUserId: user.id,
        parties: dedupedParties.length
          ? {
              create: dedupedParties.map((party) => ({
                tenantId: company.tenantId,
                employeeId: party.employeeId,
                partyRole: party.partyRole,
              })),
            }
          : undefined,
      },
      include: INCIDENT_INCLUDE,
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
        countrySpecificData,
      },
    });

    return this.toRecord(row, resolvedConfig);
  }

  async update(
    incidentId: string,
    dto: UpdateWorkplaceIncidentDto,
    user: AuthenticatedUser,
  ): Promise<WorkplaceIncidentRecord> {
    const existing = await this.findIncidentOrThrow(incidentId);
    await this.assertIncidentInScope(user, existing);
    const resolvedConfig = await this.resolveConfigForIncident(existing);
    const fields = resolvedConfig?.reportingFields ?? [];

    const existingCountryData = this.normalizeJsonObject(existing.countrySpecificData);
    const mergedCountryData =
      dto.countrySpecificData !== undefined
        ? { ...existingCountryData, ...dto.countrySpecificData }
        : existingCountryData;

    const shouldValidateData =
      fields.length > 0 &&
      (dto.countrySpecificData !== undefined || dto.regulatorReportSubmitted === true);

    const validatedCountryData = shouldValidateData
      ? validateAndSanitizeCountrySpecificData({
          data: mergedCountryData,
          fields,
          regulatorRequired: existing.regulatorReportRequired,
          enforceRequired: true,
          enforceRegulatorRequired: dto.regulatorReportSubmitted === true,
        })
      : existingCountryData;

    const updateData: Prisma.WorkplaceIncidentUpdateInput = {};
    if (dto.status) {
      updateData.status = dto.status;
      if (dto.status === 'resolved' || dto.status === 'closed') {
        updateData.resolvedAt = existing.resolvedAt ?? new Date();
      } else {
        updateData.resolvedAt = null;
      }
    }
    if (dto.investigationNotes !== undefined) {
      updateData.investigationNotes = dto.investigationNotes.trim() || null;
    }
    if (dto.countrySpecificData !== undefined) {
      updateData.countrySpecificData = validatedCountryData as Prisma.InputJsonValue;
    }
    if (dto.regulatorReferenceNumber !== undefined) {
      updateData.regulatorReferenceNumber = dto.regulatorReferenceNumber.trim() || null;
    }
    if (dto.regulatorReportSubmitted === true) {
      updateData.regulatorReportSubmittedAt =
        existing.regulatorReportSubmittedAt ?? new Date();
      updateData.regulatorSubmittedByUser = { connect: { id: user.id } };
    }
    if (!existing.resolvedRuleSnapshot && resolvedConfig) {
      updateData.resolvedRuleSnapshot = resolvedConfig as unknown as Prisma.InputJsonValue;
    }

    if (dto.parties !== undefined) {
      const dedupedParties = this.dedupeParties(dto.parties);
      await Promise.all(
        dedupedParties.map((party) =>
          this.assertActiveEmployee(
            party.employeeId,
            existing.companyId,
            existing.tenantId,
          ),
        ),
      );
      updateData.parties = {
        deleteMany: {},
        create: dedupedParties.map((party) => ({
          tenantId: existing.tenantId,
          employeeId: party.employeeId,
          partyRole: party.partyRole,
        })),
      };
    }

    const row = await this.prisma.unscoped.workplaceIncident.update({
      where: { id: incidentId },
      data: updateData,
      include: INCIDENT_INCLUDE,
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'health_safety',
      recordId: row.id,
      oldValue: {
        status: existing.status,
        investigationNotes: existing.investigationNotes,
        regulatorReportSubmittedAt: existing.regulatorReportSubmittedAt,
        regulatorReferenceNumber: existing.regulatorReferenceNumber,
        countrySpecificData: existingCountryData,
      },
      newValue: {
        status: row.status,
        investigationNotes: row.investigationNotes,
        regulatorReportSubmittedAt: row.regulatorReportSubmittedAt,
        regulatorReferenceNumber: row.regulatorReferenceNumber,
        countrySpecificData: row.countrySpecificData,
      },
    });

    return this.toRecord(row, resolvedConfig);
  }

  private async resolveConfigForIncident(
    row: IncidentWithRelations,
  ): Promise<IncidentReportingRuleConfig | null> {
    const stored = parseStoredReportingConfig(row.resolvedRuleSnapshot);
    if (stored) {
      return stored;
    }
    if (typeof this.rulesService?.resolveWithMetadataForEmployee !== 'function') {
      return null;
    }

    try {
      const { rules, layers } =
        await this.rulesService.resolveWithMetadataForEmployee(
          row.reportedByEmployeeId,
          row.occurredAt,
        );
      return buildIncidentReportingConfig(rules, layers, row.occurredAt);
    } catch {
      const { rules, layers } =
        await this.rulesService.resolveWithMetadataForCompany(
          row.companyId,
          row.occurredAt,
        );
      return buildIncidentReportingConfig(rules, layers, row.occurredAt);
    }
  }

  private async findIncidentOrThrow(
    incidentId: string,
  ): Promise<IncidentWithRelations> {
    const row = await this.prisma.unscoped.workplaceIncident.findUnique({
      where: { id: incidentId },
      include: INCIDENT_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException('Incident not found');
    }
    await this.companyScope.assertCompanyInTenant(row.companyId);
    return row;
  }

  private async scopeWhere(
    user: AuthenticatedUser,
  ): Promise<Prisma.WorkplaceIncidentWhereInput | undefined> {
    const ids = await this.dataScope.employeeIds(user);
    if (!ids) return undefined;
    return {
      OR: [
        { reportedByEmployeeId: { in: ids } },
        { parties: { some: { employeeId: { in: ids } } } },
        { createdByUserId: user.id },
      ],
    };
  }

  private async assertIncidentInScope(
    user: AuthenticatedUser,
    row: IncidentWithRelations,
  ): Promise<void> {
    const ids = await this.dataScope.employeeIds(user);
    if (
      !ids ||
      row.createdByUserId === user.id ||
      ids.includes(row.reportedByEmployeeId) ||
      row.parties.some((party) => ids.includes(party.employeeId))
    ) {
      return;
    }
    throw new ForbiddenException({
      code: 'OUT_OF_SCOPE',
      message: 'This incident is outside your reporting line',
    });
  }

  private async assertActiveEmployee(
    employeeId: string,
    companyId: string,
    tenantId: string,
  ) {
    const employee = await this.prisma.unscoped.employee.findFirst({
      where: {
        id: employeeId,
        tenantId,
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

  private dedupeParties(parties?: IncidentPartyDto[]): IncidentPartyDto[] {
    if (!parties?.length) return [];
    const map = new Map<string, IncidentPartyDto>();
    for (const party of parties) {
      map.set(party.employeeId, party);
    }
    return [...map.values()];
  }

  private normalizeJsonObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private employeeName(employee: { firstName: string; lastName: string }): string {
    return `${employee.firstName} ${employee.lastName}`.trim();
  }

  private submitterName(
    user?: {
      email: string;
      employee: { firstName: string; lastName: string } | null;
    } | null,
  ): string | null {
    if (!user) return null;
    if (user.employee) {
      const full = this.employeeName(user.employee);
      if (full.length > 0) return full;
    }
    return user.email;
  }

  private toRecord(
    row: IncidentWithRelations,
    resolvedReportingConfig: IncidentReportingRuleConfig | null = parseStoredReportingConfig(
      row.resolvedRuleSnapshot,
    ),
  ): WorkplaceIncidentRecord {
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
      regulatorReportSubmittedByName: this.submitterName(
        row.regulatorSubmittedByUser,
      ),
      regulatorReferenceNumber: row.regulatorReferenceNumber ?? null,
      regulatorName: row.regulatorName,
      countrySpecificData: this.normalizeJsonObject(row.countrySpecificData),
      resolvedReportingConfig,
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
