import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { InjuryLogEntry } from '@prisma/client';
import type { InjuryLogEntryRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateInjuryLogEntryDto,
  ListInjuryLogQueryDto,
} from './dto/health-safety.dto';
import { HealthSafetyRulesService } from './health-safety-rules.service';

type InjuryWithRelations = InjuryLogEntry & {
  employee: { firstName: string; lastName: string };
  incident: { incidentNumber: string } | null;
};

@Injectable()
export class InjuryLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly rulesService: HealthSafetyRulesService,
  ) {}

  async list(
    companyId: string,
    query: ListInjuryLogQueryDto,
  ): Promise<InjuryLogEntryRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.injuryLogEntry.findMany({
      where: {
        companyId,
        employeeId: query.employeeId,
        incidentId: query.incidentId,
      },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        incident: { select: { incidentNumber: true } },
      },
      orderBy: { recordedAt: 'desc' },
      take: query.limit ?? 50,
    });

    return rows.map((row) => this.toRecord(row));
  }

  async create(
    companyId: string,
    dto: CreateInjuryLogEntryDto,
    user: AuthenticatedUser,
  ): Promise<InjuryLogEntryRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    const employee = await this.prisma.unscoped.employee.findFirst({
      where: {
        id: dto.employeeId,
        companyId,
        deletedAt: null,
        employmentStatus: 'active',
      },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (dto.incidentId) {
      const incident = await this.prisma.unscoped.workplaceIncident.findFirst({
        where: { id: dto.incidentId, companyId },
        select: { id: true },
      });
      if (!incident) {
        throw new NotFoundException('Incident not found');
      }
    }

    const rules = await this.rulesService.resolveForEmployee(
      dto.employeeId,
      new Date(dto.recordedAt),
    );
    if (rules.injuryLog?.requireBodyPart && !dto.bodyPart?.trim()) {
      throw new BadRequestException(
        'Body part is required for injury log entries in this country',
      );
    }

    const row = await this.prisma.unscoped.injuryLogEntry.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        incidentId: dto.incidentId,
        employeeId: dto.employeeId,
        injuryType: dto.injuryType.trim(),
        bodyPart: dto.bodyPart?.trim() || null,
        treatmentSummary: dto.treatmentSummary?.trim() || null,
        medicalAttention: dto.medicalAttention ?? 'none',
        daysLost: dto.daysLost ?? 0,
        recordedAt: new Date(dto.recordedAt),
        recordedByUserId: user.id,
        notes: dto.notes?.trim() || null,
      },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        incident: { select: { incidentNumber: true } },
      },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'health_safety',
      recordId: row.id,
      newValue: {
        employeeId: row.employeeId,
        injuryType: row.injuryType,
        incidentId: row.incidentId,
      },
    });

    return this.toRecord(row);
  }

  private toRecord(row: InjuryWithRelations): InjuryLogEntryRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      incidentId: row.incidentId,
      incidentNumber: row.incident?.incidentNumber ?? null,
      employeeId: row.employeeId,
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      injuryType: row.injuryType,
      bodyPart: row.bodyPart,
      treatmentSummary: row.treatmentSummary,
      medicalAttention: row.medicalAttention,
      daysLost: row.daysLost,
      recordedAt: row.recordedAt.toISOString(),
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
