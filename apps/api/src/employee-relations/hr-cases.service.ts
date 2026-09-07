import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { HrCase, HrCaseDisciplinaryAction, HrCaseInvestigationRecord, HrCaseNote, HrCaseParty } from '@prisma/client';
import type {
  HrCaseDetailRecord,
  HrCaseDisciplinaryActionRecord,
  HrCaseInvestigationRecordView,
  HrCaseNoteRecord,
  HrCasePartyRecord,
  HrCaseSensitiveField,
  HrCaseStatus,
  HrCaseSummary,
  HrCaseSummaryRecord,
  RevealedHrCaseField,
} from '@hrm/shared-types';
import type { AuditAction } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { SensitiveFieldService } from '../crypto/sensitive-field.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateDisciplinaryActionDto,
  CreateHrCaseDto,
  CreateHrCaseNoteDto,
  CreateInvestigationRecordDto,
  ListHrCasesQueryDto,
  RevealHrCaseFieldDto,
  TransitionHrCaseStatusDto,
  UpdateHrCaseDto,
  UpsertHrCasePartiesDto,
} from './dto/employee-relations.dto';
import { auditSnapshotForCase, sanitizeAuditPayload } from './hr-case-audit.utils';
import { assertHrCaseStatusTransition, isHrCaseTerminal } from './hr-case.utils';
import { generateCaseNumber, startOfUtcQuarter } from './employee-relations.utils';

type CaseWithRelations = HrCase & {
  assignedOfficer: {
    firstName: string;
    lastName: string;
  } | null;
  subjectEmployee: {
    firstName: string;
    lastName: string;
  } | null;
  reportingEmployee: {
    firstName: string;
    lastName: string;
  } | null;
  parties: Array<
    HrCaseParty & {
      employee: {
        firstName: string;
        lastName: string;
        department: { name: string } | null;
      } | null;
    }
  >;
  notes: HrCaseNote[];
  disciplinaryActions: HrCaseDisciplinaryAction[];
  investigationRecords: HrCaseInvestigationRecord[];
};

@Injectable()
export class HrCasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly sensitiveFields: SensitiveFieldService,
  ) {}

  async getSummary(companyId: string): Promise<HrCaseSummary> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const quarterStart = startOfUtcQuarter(new Date());
    const [openCaseCount, investigatingCount, resolvedThisQuarterCount] =
      await Promise.all([
        this.prisma.unscoped.hrCase.count({
          where: { companyId, status: 'open' },
        }),
        this.prisma.unscoped.hrCase.count({
          where: { companyId, status: 'investigating' },
        }),
        this.prisma.unscoped.hrCase.count({
          where: {
            companyId,
            status: { in: ['resolved', 'closed'] },
            closedAt: { gte: quarterStart },
          },
        }),
      ]);

    return { openCaseCount, investigatingCount, resolvedThisQuarterCount };
  }

  async listCases(
    companyId: string,
    query: ListHrCasesQueryDto,
  ): Promise<HrCaseSummaryRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const search = query.search?.trim();
    const rows = await this.prisma.unscoped.hrCase.findMany({
      where: {
        companyId,
        caseType: query.caseType,
        status: query.status,
        priority: query.priority,
        ...(search
          ? {
              OR: [
                { caseNumber: { contains: search, mode: 'insensitive' } },
                { title: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        assignedOfficer: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return rows.map((row) => this.toSummaryRecord(row));
  }

  async getCaseDetail(caseId: string): Promise<HrCaseDetailRecord> {
    const row = await this.getCaseWithRelationsOrThrow(caseId);
    return this.toDetailRecord(row);
  }

  async createCase(
    companyId: string,
    dto: CreateHrCaseDto,
    user: AuthenticatedUser,
  ): Promise<HrCaseDetailRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const year = new Date().getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

    const countForYear = await this.prisma.unscoped.hrCase.count({
      where: {
        companyId,
        createdAt: { gte: yearStart, lt: yearEnd },
      },
    });
    const caseNumber = generateCaseNumber(countForYear, year);

    if (dto.subjectEmployeeId) {
      await this.assertEmployeeInCompany(dto.subjectEmployeeId, companyId);
    }
    if (dto.reportingEmployeeId) {
      await this.assertEmployeeInCompany(dto.reportingEmployeeId, companyId);
    }
    if (dto.assignedOfficerEmployeeId) {
      await this.assertEmployeeInCompany(dto.assignedOfficerEmployeeId, companyId);
    }

    const row = await this.prisma.unscoped.hrCase.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        caseNumber,
        title: dto.title.trim(),
        caseType: dto.caseType,
        priority: dto.priority ?? 'medium',
        subjectEmployeeId: dto.subjectEmployeeId,
        reportingEmployeeId: dto.reportingEmployeeId,
        assignedOfficerEmployeeId: dto.assignedOfficerEmployeeId,
        detailsEncrypted: dto.details?.trim()
          ? this.sensitiveFields.encrypt(dto.details.trim())
          : null,
        isRestricted: dto.isRestricted ?? true,
        createdByUserId: user.id,
        parties: dto.parties?.length
          ? {
              create: dto.parties.map((party) => ({
                tenantId: company.tenantId,
                employeeId: party.employeeId,
                partyRole: party.partyRole,
                anonymizedLabel: party.anonymizedLabel?.trim() || null,
                isAnonymized: party.isAnonymized ?? false,
              })),
            }
          : undefined,
      },
      include: this.caseInclude(),
    });

    await this.logCaseAudit({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      recordId: row.id,
      newValue: auditSnapshotForCase(row),
    });

    return this.toDetailRecord(row as CaseWithRelations);
  }

  async updateCase(
    caseId: string,
    dto: UpdateHrCaseDto,
    user: AuthenticatedUser,
  ): Promise<HrCaseDetailRecord> {
    const existing = await this.getCaseOrThrow(caseId);
    if (isHrCaseTerminal(existing.status as HrCaseStatus)) {
      throw new BadRequestException('Closed cases cannot be modified');
    }

    if (dto.assignedOfficerEmployeeId) {
      await this.assertEmployeeInCompany(
        dto.assignedOfficerEmployeeId,
        existing.companyId,
      );
    }

    const row = await this.prisma.unscoped.hrCase.update({
      where: { id: caseId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.outcome !== undefined ? { outcome: dto.outcome } : {}),
        ...(dto.assignedOfficerEmployeeId !== undefined
          ? { assignedOfficerEmployeeId: dto.assignedOfficerEmployeeId }
          : {}),
        ...(dto.details !== undefined
          ? {
              detailsEncrypted: dto.details.trim()
                ? this.sensitiveFields.encrypt(dto.details.trim())
                : null,
            }
          : {}),
        ...(dto.resolutionNotes !== undefined
          ? {
              resolutionNotesEncrypted: dto.resolutionNotes.trim()
                ? this.sensitiveFields.encrypt(dto.resolutionNotes.trim())
                : null,
            }
          : {}),
        ...(dto.isRestricted !== undefined ? { isRestricted: dto.isRestricted } : {}),
      },
      include: this.caseInclude(),
    });

    await this.logCaseAudit({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      recordId: caseId,
      oldValue: auditSnapshotForCase(existing),
      newValue: sanitizeAuditPayload({
        ...auditSnapshotForCase(row),
        ...dto,
      }),
    });

    return this.toDetailRecord(row as CaseWithRelations);
  }

  async transitionStatus(
    caseId: string,
    dto: TransitionHrCaseStatusDto,
    user: AuthenticatedUser,
  ): Promise<HrCaseDetailRecord> {
    const existing = await this.getCaseOrThrow(caseId);
    const fromStatus = existing.status as HrCaseStatus;
    const toStatus = dto.status as HrCaseStatus;

    assertHrCaseStatusTransition(fromStatus, toStatus);

    const closedAt =
      toStatus === 'resolved' || toStatus === 'closed'
        ? new Date()
        : toStatus === 'open' || toStatus === 'investigating'
          ? null
          : existing.closedAt;

    const row = await this.prisma.unscoped.hrCase.update({
      where: { id: caseId },
      data: {
        status: toStatus,
        closedAt,
      },
      include: this.caseInclude(),
    });

    await this.logCaseAudit({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      recordId: caseId,
      oldValue: { status: fromStatus },
      newValue: {
        status: toStatus,
        statusTransition: `${fromStatus} -> ${toStatus}`,
        reason: dto.reason?.trim() || null,
        closedAt: closedAt?.toISOString() ?? null,
      },
    });

    return this.toDetailRecord(row as CaseWithRelations);
  }

  async addNote(
    caseId: string,
    dto: CreateHrCaseNoteDto,
    user: AuthenticatedUser,
  ): Promise<HrCaseNoteRecord> {
    const existing = await this.getCaseOrThrow(caseId);
    if (isHrCaseTerminal(existing.status as HrCaseStatus)) {
      throw new BadRequestException('Cannot add notes to closed cases');
    }

    const note = await this.prisma.unscoped.hrCaseNote.create({
      data: {
        tenantId: existing.tenantId,
        caseId,
        contentEncrypted: this.sensitiveFields.encrypt(dto.content.trim()),
        createdByUserId: user.id,
      },
    });

    await this.logCaseAudit({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'create',
      recordId: note.id,
      newValue: {
        caseId,
        noteId: note.id,
        noteAdded: true,
      },
    });

    return this.toNoteRecord(note);
  }

  async addDisciplinaryAction(
    caseId: string,
    dto: CreateDisciplinaryActionDto,
    user: AuthenticatedUser,
  ): Promise<HrCaseDisciplinaryActionRecord> {
    const existing = await this.getCaseOrThrow(caseId);
    if (isHrCaseTerminal(existing.status as HrCaseStatus)) {
      throw new BadRequestException('Cannot add disciplinary actions to closed cases');
    }

    const action = await this.prisma.unscoped.hrCaseDisciplinaryAction.create({
      data: {
        tenantId: existing.tenantId,
        companyId: existing.companyId,
        caseId,
        actionType: dto.actionType,
        effectiveDate: this.parseDate(dto.effectiveDate),
        letterReference: dto.letterReference?.trim() || null,
        detailsEncrypted: dto.details?.trim()
          ? this.sensitiveFields.encrypt(dto.details.trim())
          : null,
        issuedByUserId: user.id,
      },
    });

    await this.logCaseAudit({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'create',
      recordId: action.id,
      newValue: {
        caseId,
        actionId: action.id,
        actionType: dto.actionType,
        effectiveDate: dto.effectiveDate,
        hasDetails: Boolean(dto.details?.trim()),
      },
    });

    return this.toDisciplinaryRecord(action);
  }

  async addInvestigationRecord(
    caseId: string,
    dto: CreateInvestigationRecordDto,
    user: AuthenticatedUser,
  ): Promise<HrCaseInvestigationRecordView> {
    const existing = await this.getCaseOrThrow(caseId);
    if (isHrCaseTerminal(existing.status as HrCaseStatus)) {
      throw new BadRequestException('Cannot add investigation records to closed cases');
    }

    const record = await this.prisma.unscoped.hrCaseInvestigationRecord.create({
      data: {
        tenantId: existing.tenantId,
        caseId,
        recordType: dto.recordType,
        title: dto.title.trim(),
        recordedAt: dto.recordedAt
          ? this.parseDate(dto.recordedAt)
          : new Date(),
        contentEncrypted: this.sensitiveFields.encrypt(dto.content.trim()),
        createdByUserId: user.id,
      },
    });

    await this.logCaseAudit({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'create',
      recordId: record.id,
      newValue: {
        caseId,
        investigationRecordId: record.id,
        recordType: dto.recordType,
        title: dto.title.trim(),
        recordedAt: dto.recordedAt ?? null,
        hasContent: true,
      },
    });

    return this.toInvestigationRecord(record);
  }

  async replaceParties(
    caseId: string,
    dto: UpsertHrCasePartiesDto,
    user: AuthenticatedUser,
  ): Promise<HrCasePartyRecord[]> {
    const existing = await this.getCaseOrThrow(caseId);
    if (isHrCaseTerminal(existing.status as HrCaseStatus)) {
      throw new BadRequestException('Cannot modify parties on closed cases');
    }

    for (const party of dto.parties) {
      if (party.employeeId) {
        await this.assertEmployeeInCompany(party.employeeId, existing.companyId);
      }
    }

    const priorPartyCount = await this.prisma.unscoped.hrCaseParty.count({
      where: { caseId },
    });

    await this.prisma.unscoped.hrCaseParty.deleteMany({ where: { caseId } });

    const created = await this.prisma.unscoped.$transaction(
      dto.parties.map((party) =>
        this.prisma.unscoped.hrCaseParty.create({
          data: {
            tenantId: existing.tenantId,
            caseId,
            employeeId: party.employeeId,
            partyRole: party.partyRole,
            anonymizedLabel: party.anonymizedLabel?.trim() || null,
            isAnonymized: party.isAnonymized ?? false,
          },
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
                department: { select: { name: true } },
              },
            },
          },
        }),
      ),
    );

    await this.logCaseAudit({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      recordId: caseId,
      oldValue: { partyCount: priorPartyCount },
      newValue: {
        partiesUpdated: dto.parties.length,
        partyRoles: dto.parties.map((p) => p.partyRole),
      },
    });

    return created.map((row) => this.toPartyRecord(row));
  }

  async revealField(
    caseId: string,
    dto: RevealHrCaseFieldDto,
    user: AuthenticatedUser,
  ): Promise<RevealedHrCaseField> {
    const existing = await this.getCaseOrThrow(caseId);
    let value: string | null = null;

    switch (dto.field as HrCaseSensitiveField) {
      case 'details':
        value = this.sensitiveFields.reveal(existing.detailsEncrypted);
        break;
      case 'resolutionNotes':
        value = this.sensitiveFields.reveal(existing.resolutionNotesEncrypted);
        break;
      case 'noteContent': {
        if (!dto.noteId) {
          throw new BadRequestException('noteId is required for noteContent reveal');
        }
        const note = await this.prisma.unscoped.hrCaseNote.findFirst({
          where: { id: dto.noteId, caseId },
        });
        if (!note) throw new NotFoundException('Case note not found');
        value = this.sensitiveFields.reveal(note.contentEncrypted);
        break;
      }
      case 'actionDetails': {
        if (!dto.actionId) {
          throw new BadRequestException('actionId is required for actionDetails reveal');
        }
        const action = await this.prisma.unscoped.hrCaseDisciplinaryAction.findFirst({
          where: { id: dto.actionId, caseId },
        });
        if (!action) throw new NotFoundException('Disciplinary action not found');
        value = this.sensitiveFields.reveal(action.detailsEncrypted);
        break;
      }
      case 'investigationContent': {
        if (!dto.investigationRecordId) {
          throw new BadRequestException(
            'investigationRecordId is required for investigationContent reveal',
          );
        }
        const record = await this.prisma.unscoped.hrCaseInvestigationRecord.findFirst({
          where: { id: dto.investigationRecordId, caseId },
        });
        if (!record) throw new NotFoundException('Investigation record not found');
        value = this.sensitiveFields.reveal(record.contentEncrypted);
        break;
      }
      default:
        throw new BadRequestException('Unsupported reveal field');
    }

    if (!value) {
      throw new NotFoundException('No confidential content stored for this field');
    }

    await this.logCaseAudit({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      recordId: caseId,
      newValue: {
        sensitiveReveal: true,
        field: dto.field,
        noteId: dto.noteId ?? null,
        actionId: dto.actionId ?? null,
        investigationRecordId: dto.investigationRecordId ?? null,
      },
    });

    return {
      field: dto.field as HrCaseSensitiveField,
      value,
      noteId: dto.noteId,
      actionId: dto.actionId,
      investigationRecordId: dto.investigationRecordId,
    };
  }

  private async logCaseAudit(params: {
    tenantId: string;
    userId: string;
    action: AuditAction;
    recordId: string;
    oldValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
  }): Promise<void> {
    await this.auditService.log({
      tenantId: params.tenantId,
      userId: params.userId,
      action: params.action,
      module: 'employee_relations',
      recordId: params.recordId,
      oldValue: params.oldValue ?? null,
      newValue: params.newValue ?? null,
    });
  }

  private caseInclude() {
    return {
      assignedOfficer: { select: { firstName: true, lastName: true } },
      subjectEmployee: { select: { firstName: true, lastName: true } },
      reportingEmployee: { select: { firstName: true, lastName: true } },
      parties: {
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: [{ createdAt: 'asc' as const }],
      },
      notes: { orderBy: [{ createdAt: 'desc' as const }] },
      disciplinaryActions: { orderBy: [{ effectiveDate: 'desc' as const }] },
      investigationRecords: { orderBy: [{ createdAt: 'desc' as const }] },
    };
  }

  private async getCaseOrThrow(caseId: string): Promise<HrCase> {
    const row = await this.prisma.unscoped.hrCase.findUnique({
      where: { id: caseId },
    });
    if (!row) throw new NotFoundException('HR case not found');
    return row;
  }

  private async getCaseWithRelationsOrThrow(caseId: string): Promise<CaseWithRelations> {
    const row = await this.prisma.unscoped.hrCase.findUnique({
      where: { id: caseId },
      include: this.caseInclude(),
    });
    if (!row) throw new NotFoundException('HR case not found');
    return row as CaseWithRelations;
  }

  private async assertEmployeeInCompany(
    employeeId: string,
    companyId: string,
  ): Promise<void> {
    const employee = await this.prisma.unscoped.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) {
      throw new BadRequestException(`Invalid date "${value}", expected YYYY-MM-DD`);
    }
    return new Date(Date.UTC(year, month - 1, day));
  }

  private officerName(row: CaseWithRelations | (HrCase & { assignedOfficer: { firstName: string; lastName: string } | null })): string | null {
    if (!row.assignedOfficer) return null;
    return `${row.assignedOfficer.firstName} ${row.assignedOfficer.lastName}`.trim();
  }

  private toSummaryRecord(
    row: HrCase & { assignedOfficer: { firstName: string; lastName: string } | null },
  ): HrCaseSummaryRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      caseNumber: row.caseNumber,
      title: row.title,
      caseType: row.caseType,
      status: row.status,
      priority: row.priority,
      outcome: row.outcome,
      assignedOfficerName: this.officerName(row),
      isRestricted: row.isRestricted,
      openedAt: row.openedAt.toISOString(),
      closedAt: row.closedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toDetailRecord(row: CaseWithRelations): HrCaseDetailRecord {
    return {
      ...this.toSummaryRecord(row),
      subjectEmployeeId: row.subjectEmployeeId,
      subjectEmployeeName: row.subjectEmployee
        ? `${row.subjectEmployee.firstName} ${row.subjectEmployee.lastName}`.trim()
        : null,
      reportingEmployeeId: row.reportingEmployeeId,
      reportingEmployeeName: row.reportingEmployee
        ? `${row.reportingEmployee.firstName} ${row.reportingEmployee.lastName}`.trim()
        : null,
      hasDetails: Boolean(row.detailsEncrypted),
      hasResolutionNotes: Boolean(row.resolutionNotesEncrypted),
      parties: row.parties.map((party) => this.toPartyRecord(party)),
      notes: row.notes.map((note) => this.toNoteRecord(note)),
      disciplinaryActions: row.disciplinaryActions.map((action) =>
        this.toDisciplinaryRecord(action),
      ),
      investigationRecords: row.investigationRecords.map((record) =>
        this.toInvestigationRecord(record),
      ),
    };
  }

  private toPartyRecord(
    row: HrCaseParty & {
      employee: {
        firstName: string;
        lastName: string;
        department: { name: string } | null;
      } | null;
    },
  ): HrCasePartyRecord {
    const employeeName = row.employee
      ? `${row.employee.firstName} ${row.employee.lastName}`.trim()
      : null;

    return {
      id: row.id,
      partyRole: row.partyRole,
      employeeId: row.isAnonymized ? null : row.employeeId,
      employeeName: row.isAnonymized ? null : employeeName,
      departmentName: row.isAnonymized ? null : (row.employee?.department?.name ?? null),
      anonymizedLabel: row.isAnonymized
        ? (row.anonymizedLabel ?? 'Protected identity')
        : null,
      isAnonymized: row.isAnonymized,
    };
  }

  private toNoteRecord(row: HrCaseNote): HrCaseNoteRecord {
    return {
      id: row.id,
      caseId: row.caseId,
      contentRestricted: true,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toDisciplinaryRecord(
    row: HrCaseDisciplinaryAction,
  ): HrCaseDisciplinaryActionRecord {
    return {
      id: row.id,
      caseId: row.caseId,
      actionType: row.actionType,
      effectiveDate: row.effectiveDate.toISOString().slice(0, 10),
      letterReference: row.letterReference,
      detailsRestricted: Boolean(row.detailsEncrypted),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toInvestigationRecord(
    row: HrCaseInvestigationRecord,
  ): HrCaseInvestigationRecordView {
    return {
      id: row.id,
      caseId: row.caseId,
      recordType: row.recordType,
      title: row.title,
      contentRestricted: true,
      recordedAt: row.recordedAt.toISOString(),
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
