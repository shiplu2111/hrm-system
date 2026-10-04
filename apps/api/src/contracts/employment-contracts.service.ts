import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmploymentContractStatus,
  Prisma,
  type EmploymentContract,
  type EmploymentContractDocument,
} from '@prisma/client';
import type {
  EmploymentContractDocumentRecord,
  EmploymentContractRecord,
  EmploymentContractRenewalWorkflow,
  WorkflowInstanceRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { DataScopeService } from '../rbac/data-scope.service';
import { PermissionsService } from '../rbac/permissions.service';
import { assertValidDocumentUpload } from '../storage/document-file.policy';
import { StorageService } from '../storage/storage.service';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import {
  buildApprovalPendingVariables,
  buildContractRenewalVariables,
} from '../notifications/notification.helpers';
import { WorkflowAssigneeService } from '../workflow/workflow-assignee.service';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { getCurrentWorkflowStep } from '../workflow/workflow.utils';
import { ContractExpirySettingsService } from './contract-expiry-settings.service';
import { ContractWorkflowService } from './contract-workflow.service';
import type {
  ContractRenewalActionDto,
  CreateEmploymentContractDto,
  ListEmploymentContractsQueryDto,
  RenewEmploymentContractDto,
  UpdateEmploymentContractDto,
} from './dto/employment-contract.dto';
import {
  computeDisplayStatus,
  formatDateValue,
  parseDateString,
  parseOvertimeRule,
} from './employment-contract.utils';

type ContractWithRelations = EmploymentContract & {
  employee: { firstName: string; lastName: string; employeeNumber: string };
  documents: EmploymentContractDocument[];
};

@Injectable()
export class EmploymentContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
    private readonly contractWorkflow: ContractWorkflowService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly workflowAssignee: WorkflowAssigneeService,
    private readonly notificationEngine: NotificationEngineService,
    private readonly permissions: PermissionsService,
    private readonly dataScope: DataScopeService,
    private readonly expirySettings: ContractExpirySettingsService,
  ) {}

  async list(
    companyId: string,
    query: ListEmploymentContractsQueryDto,
    user: AuthenticatedUser,
  ): Promise<EmploymentContractRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    if (query.employeeId) {
      await this.dataScope.assertEmployeeInScope(user, query.employeeId);
    }

    const rows = await this.prisma.unscoped.employmentContract.findMany({
      where: {
        companyId,
        employeeId: query.employeeId ?? (await this.dataScope.employeeIdFilter(user)),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ status: 'asc' }, { endDate: 'asc' }, { createdAt: 'desc' }],
      include: this.defaultInclude(),
    });

    const workflowMap = await this.loadWorkflowMap(rows.map((r) => r.id));
    const warningDays = await this.expirySettings.getWindowDays(companyId);
    const records = rows.map((row) =>
      this.toRecord(row, workflowMap.get(row.id), warningDays),
    );
    if (query.displayStatus) {
      return records.filter((r) => r.displayStatus === query.displayStatus);
    }
    return records;
  }

  async get(
    contractId: string,
    user: AuthenticatedUser,
  ): Promise<EmploymentContractRecord> {
    const row = await this.findOrThrow(contractId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    await this.dataScope.assertEmployeeInScope(user, row.employeeId);
    const workflow = await this.contractWorkflow.findForContract(contractId);
    return this.present(row, workflow);
  }

  async create(
    companyId: string,
    dto: CreateEmploymentContractDto,
    user: AuthenticatedUser,
  ): Promise<EmploymentContractRecord> {
    await this.companyScope.assertCompanyInTenant(companyId);
    await this.dataScope.assertEmployeeInScope(user, dto.employeeId, { includeSelf: false });
    const employee = await this.assertEmployee(dto.employeeId, companyId);

    this.validateDates(dto.startDate, dto.endDate);

    const status = dto.activate
      ? EmploymentContractStatus.active
      : EmploymentContractStatus.draft;

    const row = await this.prisma.unscoped.employmentContract.create({
      data: {
        tenantId: employee.tenantId,
        companyId,
        employeeId: dto.employeeId,
        contractType: dto.contractType,
        status,
        startDate: parseDateString(dto.startDate),
        endDate: dto.endDate ? parseDateString(dto.endDate) : null,
        probationEndDate: dto.probationEndDate
          ? parseDateString(dto.probationEndDate)
          : null,
        workingHoursPerWeek:
          dto.workingHoursPerWeek != null
            ? new Prisma.Decimal(dto.workingHoursPerWeek)
            : null,
        payRate: dto.payRate != null ? new Prisma.Decimal(dto.payRate) : null,
        payFrequency: dto.payFrequency ?? null,
        currency: dto.currency ?? 'AUD',
        leaveEntitlementDays:
          dto.leaveEntitlementDays != null
            ? new Prisma.Decimal(dto.leaveEntitlementDays)
            : null,
        overtimeRule: dto.overtimeRule
          ? (dto.overtimeRule as unknown as Prisma.InputJsonValue)
          : undefined,
        noticePeriodDays: dto.noticePeriodDays ?? null,
        employerNoticeDays: dto.employerNoticeDays ?? null,
        terminationConditions: dto.terminationConditions?.trim() ?? null,
        signedAt: dto.signedAt ? new Date(dto.signedAt) : null,
      },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: employee.tenantId,
      userId: user.id,
      action: 'create',
      module: 'employee',
      recordId: row.id,
      newValue: this.toRecord(row, null) as unknown as Record<string, unknown>,
    });

    return this.present(row, null);
  }

  async update(
    contractId: string,
    dto: UpdateEmploymentContractDto,
    user: AuthenticatedUser,
  ): Promise<EmploymentContractRecord> {
    const existing = await this.findOrThrow(contractId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);
    await this.dataScope.assertEmployeeInScope(user, existing.employeeId, {
      includeSelf: false,
    });

    const changesTerms = Object.entries(dto).some(
      ([key, value]) => key !== 'status' && value !== undefined,
    );
    if (changesTerms) {
      if (existing.status === EmploymentContractStatus.terminated) {
        throw new BadRequestException({
          code: 'CONTRACT_LOCKED',
          message: 'Terminated contracts can’t be edited',
        });
      }
      const workflow = await this.contractWorkflow.findForContract(contractId);
      if (workflow?.status === 'pending') {
        throw new BadRequestException({
          code: 'CONTRACT_LOCKED',
          message: 'Contract terms can’t change while the renewal is awaiting approval',
        });
      }
    }

    if (dto.startDate !== undefined || dto.endDate !== undefined) {
      this.validateDates(
        dto.startDate ?? formatDateValue(existing.startDate),
        dto.endDate !== undefined
          ? dto.endDate
          : existing.endDate
            ? formatDateValue(existing.endDate)
            : null,
      );
    }

    const row = await this.prisma.unscoped.employmentContract.update({
      where: { id: contractId },
      data: {
        ...(dto.contractType !== undefined ? { contractType: dto.contractType } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: parseDateString(dto.startDate) }
          : {}),
        ...(dto.endDate !== undefined
          ? { endDate: dto.endDate ? parseDateString(dto.endDate) : null }
          : {}),
        ...(dto.endDate !== undefined &&
        (dto.endDate ?? null) !==
          (existing.endDate ? formatDateValue(existing.endDate) : null)
          ? { expiryAlertSentAt: null }
          : {}),
        ...(dto.probationEndDate !== undefined
          ? {
              probationEndDate: dto.probationEndDate
                ? parseDateString(dto.probationEndDate)
                : null,
            }
          : {}),
        ...(dto.workingHoursPerWeek !== undefined
          ? {
              workingHoursPerWeek:
                dto.workingHoursPerWeek != null
                  ? new Prisma.Decimal(dto.workingHoursPerWeek)
                  : null,
            }
          : {}),
        ...(dto.payRate !== undefined
          ? {
              payRate:
                dto.payRate != null ? new Prisma.Decimal(dto.payRate) : null,
            }
          : {}),
        ...(dto.payFrequency !== undefined ? { payFrequency: dto.payFrequency } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.leaveEntitlementDays !== undefined
          ? {
              leaveEntitlementDays:
                dto.leaveEntitlementDays != null
                  ? new Prisma.Decimal(dto.leaveEntitlementDays)
                  : null,
            }
          : {}),
        ...(dto.overtimeRule !== undefined
          ? {
              overtimeRule:
                dto.overtimeRule != null
                  ? (dto.overtimeRule as unknown as Prisma.InputJsonValue)
                  : Prisma.DbNull,
            }
          : {}),
        ...(dto.noticePeriodDays !== undefined
          ? { noticePeriodDays: dto.noticePeriodDays }
          : {}),
        ...(dto.employerNoticeDays !== undefined
          ? { employerNoticeDays: dto.employerNoticeDays }
          : {}),
        ...(dto.terminationConditions !== undefined
          ? { terminationConditions: dto.terminationConditions?.trim() ?? null }
          : {}),
        ...(dto.signedAt !== undefined
          ? { signedAt: dto.signedAt ? new Date(dto.signedAt) : null }
          : {}),
      },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'employee',
      recordId: contractId,
      oldValue: this.toRecord(existing, null) as unknown as Record<string, unknown>,
      newValue: this.toRecord(row, null) as unknown as Record<string, unknown>,
    });

    const workflow = await this.contractWorkflow.findForContract(contractId);
    return this.present(row, workflow);
  }

  async activate(contractId: string, user: AuthenticatedUser) {
    return this.update(
      contractId,
      { status: EmploymentContractStatus.active },
      user,
    );
  }

  async terminate(contractId: string, user: AuthenticatedUser) {
    return this.update(
      contractId,
      { status: EmploymentContractStatus.terminated },
      user,
    );
  }

  async renew(
    contractId: string,
    dto: RenewEmploymentContractDto,
    user: AuthenticatedUser,
  ): Promise<EmploymentContractRecord> {
    const existing = await this.findOrThrow(contractId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);
    await this.dataScope.assertEmployeeInScope(user, existing.employeeId, {
      includeSelf: false,
    });
    this.validateDates(dto.startDate, dto.endDate);

    const row = await this.prisma.unscoped.employmentContract.create({
      data: {
        tenantId: existing.tenantId,
        companyId: existing.companyId,
        employeeId: existing.employeeId,
        contractType: existing.contractType,
        status: EmploymentContractStatus.draft,
        startDate: parseDateString(dto.startDate),
        endDate: dto.endDate ? parseDateString(dto.endDate) : null,
        probationEndDate: dto.probationEndDate
          ? parseDateString(dto.probationEndDate)
          : existing.probationEndDate,
        workingHoursPerWeek: existing.workingHoursPerWeek,
        payRate: existing.payRate,
        payFrequency: existing.payFrequency,
        currency: existing.currency,
        leaveEntitlementDays: existing.leaveEntitlementDays,
        overtimeRule: existing.overtimeRule ?? undefined,
        noticePeriodDays: existing.noticePeriodDays,
        employerNoticeDays: existing.employerNoticeDays,
        terminationConditions: existing.terminationConditions,
        renewedFromId: existing.id,
      },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'create',
      module: 'employee',
      recordId: row.id,
      newValue: {
        renewedFromId: existing.id,
        contractId: row.id,
      },
    });

    if (dto.submit !== false) {
      return this.submitRenewal(row.id, user);
    }

    return this.present(row, null);
  }

  async submitRenewal(
    renewalContractId: string,
    user: AuthenticatedUser,
  ): Promise<EmploymentContractRecord> {
    const row = await this.findOrThrow(renewalContractId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    await this.dataScope.assertEmployeeInScope(user, row.employeeId, { includeSelf: false });

    if (row.status !== EmploymentContractStatus.draft) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only draft renewal contracts can be submitted',
      });
    }
    if (!row.renewedFromId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Contract is not a renewal',
      });
    }

    const instance = await this.contractWorkflow.startForRenewal({
      companyId: row.companyId,
      tenantId: row.tenantId,
      renewalContractId: row.id,
      requesterEmployeeId: row.employeeId,
      requesterUserId: user.id,
    });

    await this.emitApprovalPending(row, instance);

    return this.present(row, instance);
  }

  async approveRenewal(
    renewalContractId: string,
    user: AuthenticatedUser,
    dto: ContractRenewalActionDto,
  ): Promise<EmploymentContractRecord> {
    const row = await this.findOrThrow(renewalContractId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    await this.assertCanDecideRenewal(user, row.employeeId);

    if (!row.renewedFromId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Contract is not a renewal',
      });
    }

    const transition = await this.contractWorkflow.approve({
      renewalContractId: row.id,
      user,
      comment: dto.comment,
      audit: {
        tenantId: row.tenantId,
        module: 'employee',
        recordId: row.id,
      },
      companyId: row.companyId,
      tenantId: row.tenantId,
      requesterEmployeeId: row.employeeId,
      requesterUserId: user.id,
    });

    let updated = row;
    if (transition.fullyApproved) {
      updated = await this.prisma.unscoped.employmentContract.update({
        where: { id: row.id },
        data: { status: EmploymentContractStatus.active },
        include: this.defaultInclude(),
      });

      await this.emitRenewalOutcome('contract.renewal.approved', updated);
    } else if (!transition.rejected) {
      await this.emitApprovalPending(row, transition.instance);
    }

    return this.present(updated, transition.instance);
  }

  async rejectRenewal(
    renewalContractId: string,
    user: AuthenticatedUser,
    dto: ContractRenewalActionDto,
  ): Promise<EmploymentContractRecord> {
    const row = await this.findOrThrow(renewalContractId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    await this.assertCanDecideRenewal(user, row.employeeId);

    if (!row.renewedFromId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Contract is not a renewal',
      });
    }

    const transition = await this.contractWorkflow.reject({
      renewalContractId: row.id,
      user,
      comment: dto.comment,
      audit: {
        tenantId: row.tenantId,
        module: 'employee',
        recordId: row.id,
      },
      companyId: row.companyId,
      tenantId: row.tenantId,
      requesterEmployeeId: row.employeeId,
      requesterUserId: user.id,
    });

    await this.emitRenewalOutcome('contract.renewal.rejected', row);

    return this.present(row, transition.instance);
  }

  /** The workflow engine still checks the user is eligible for the current step. */
  private async assertCanDecideRenewal(
    user: AuthenticatedUser,
    employeeId: string,
  ): Promise<void> {
    if (await this.dataScope.isOrgWide(user)) {
      await this.permissions.assertPermission(user, 'employee', 'approve');
      return;
    }
    await this.dataScope.assertEmployeeInScope(user, employeeId, { includeSelf: false });
  }

  private async emitApprovalPending(
    contract: ContractWithRelations,
    instance: WorkflowInstanceRecord,
  ): Promise<void> {
    const currentStep = getCurrentWorkflowStep(instance.steps);
    if (!currentStep) return;

    const employeeName =
      `${contract.employee.firstName} ${contract.employee.lastName}`.trim();
    const approverUserIds = await this.workflowAssignee.resolveApproverUserIds({
      step: currentStep,
      requesterEmployeeId: contract.employeeId,
      tenantId: contract.tenantId,
    });

    if (approverUserIds.length === 0) return;

    await this.notificationEngine.emit({
      tenantId: contract.tenantId,
      companyId: contract.companyId,
      eventType: 'approval.pending',
      subjectEmployeeId: contract.employeeId,
      directUserIds: approverUserIds,
      variables: buildApprovalPendingVariables({
        employeeName,
        entityLabel: 'contract renewal',
        stepName: currentStep.roleName,
      }),
      payload: {
        contractId: contract.id,
        workflowInstanceId: instance.id,
        entityType: 'contract',
        eventType: 'approval.pending',
      },
    });
  }

  private async emitRenewalOutcome(
    eventType: 'contract.renewal.approved' | 'contract.renewal.rejected',
    contract: ContractWithRelations,
  ): Promise<void> {
    const employeeName =
      `${contract.employee.firstName} ${contract.employee.lastName}`.trim();

    await this.notificationEngine.emit({
      tenantId: contract.tenantId,
      companyId: contract.companyId,
      eventType,
      subjectEmployeeId: contract.employeeId,
      variables: buildContractRenewalVariables({
        employeeName,
        startDate: formatDateValue(contract.startDate),
        endDate: contract.endDate ? formatDateValue(contract.endDate) : 'Open-ended',
      }),
      payload: {
        contractId: contract.id,
        renewedFromId: contract.renewedFromId,
        eventType,
      },
    });
  }

  async uploadDocument(
    contractId: string,
    label: string,
    file: Express.Multer.File,
    user: AuthenticatedUser,
  ): Promise<EmploymentContractDocumentRecord> {
    assertValidDocumentUpload(file);
    const contract = await this.findOrThrow(contractId);
    await this.companyScope.assertCompanyInTenant(contract.companyId);
    await this.dataScope.assertEmployeeInScope(user, contract.employeeId, {
      includeSelf: false,
    });

    const storageKey = this.storageService.buildEmploymentContractKey(
      contract.tenantId,
      contractId,
      file.originalname,
    );

    await this.storageService.upload(storageKey, file.buffer, {
      contentType: file.mimetype,
      originalName: file.originalname,
      size: file.size,
    });

    const doc = await this.prisma.unscoped.employmentContractDocument.create({
      data: {
        contractId,
        tenantId: contract.tenantId,
        label: label.trim(),
        fileKey: storageKey,
        originalName: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
      },
    });

    await this.auditService.log({
      tenantId: contract.tenantId,
      userId: user.id,
      action: 'create',
      module: 'employee',
      recordId: doc.id,
      newValue: { contractId, label, fileKey: storageKey },
    });

    return this.toDocumentRecord(doc);
  }

  async getDocumentFileUrl(
    contractId: string,
    documentId: string,
    user: AuthenticatedUser,
  ) {
    const contract = await this.findOrThrow(contractId);
    await this.companyScope.assertCompanyInTenant(contract.companyId);
    await this.dataScope.assertEmployeeInScope(user, contract.employeeId);

    const doc = await this.prisma.unscoped.employmentContractDocument.findFirst({
      where: { id: documentId, contractId },
    });
    if (!doc) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Contract document not found',
      });
    }

    const url = await this.storageService.getUrl(doc.fileKey, 900);
    return { url, expiresInSeconds: 900, fileKey: doc.fileKey };
  }

  async deleteDocument(
    contractId: string,
    documentId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const contract = await this.findOrThrow(contractId);
    await this.companyScope.assertCompanyInTenant(contract.companyId);
    await this.dataScope.assertEmployeeInScope(user, contract.employeeId, {
      includeSelf: false,
    });

    const doc = await this.prisma.unscoped.employmentContractDocument.findFirst({
      where: { id: documentId, contractId },
    });
    if (!doc) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Contract document not found',
      });
    }

    await this.storageService.delete(doc.fileKey).catch(() => undefined);
    await this.prisma.unscoped.employmentContractDocument.delete({
      where: { id: documentId },
    });

    await this.auditService.log({
      tenantId: contract.tenantId,
      userId: user.id,
      action: 'delete',
      module: 'employee',
      recordId: documentId,
      oldValue: { contractId, fileKey: doc.fileKey },
    });
  }

  private validateDates(startDate: string, endDate?: string | null) {
    if (!endDate) return;
    if (parseDateString(endDate) < parseDateString(startDate)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'endDate must be on or after startDate',
      });
    }
  }

  private async assertEmployee(employeeId: string, companyId: string) {
    const row = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true, tenantId: true, companyId: true },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }
    return row;
  }

  private async findOrThrow(contractId: string): Promise<ContractWithRelations> {
    const row = await this.prisma.unscoped.employmentContract.findUnique({
      where: { id: contractId },
      include: this.defaultInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employment contract not found',
      });
    }
    return row;
  }

  private defaultInclude() {
    return {
      employee: {
        select: { firstName: true, lastName: true, employeeNumber: true },
      },
      documents: { orderBy: { uploadedAt: 'desc' as const } },
    };
  }

  private async loadWorkflowMap(contractIds: string[]) {
    const map = new Map<string, WorkflowInstanceRecord | null>();
    if (contractIds.length === 0) return map;

    const instances = await this.prisma.unscoped.workflowInstance.findMany({
      where: {
        entityType: 'contract',
        entityId: { in: contractIds },
      },
    });

    for (const id of contractIds) {
      const instance = instances.find((i) => i.entityId === id);
      map.set(id, instance ? this.workflowEngine.toRecord(instance) : null);
    }

    return map;
  }

  private toRenewalWorkflow(
    instance: WorkflowInstanceRecord | null,
  ): EmploymentContractRenewalWorkflow | null {
    if (!instance) return null;
    const currentStep = getCurrentWorkflowStep(instance.steps);
    return {
      instanceId: instance.id,
      status: instance.status,
      currentStep: currentStep
        ? {
            order: currentStep.order,
            roleName: currentStep.roleName,
            assigneeType: currentStep.assigneeType,
          }
        : null,
    };
  }

  /** Record for API responses, with "expiring soon" based on the company's alert window. */
  private async present(
    row: ContractWithRelations,
    workflow: WorkflowInstanceRecord | null | undefined,
  ): Promise<EmploymentContractRecord> {
    return this.toRecord(row, workflow, await this.expirySettings.getWindowDays(row.companyId));
  }

  private toRecord(
    row: ContractWithRelations,
    workflow: WorkflowInstanceRecord | null | undefined,
    warningDays?: number,
  ): EmploymentContractRecord {
    const renewalWorkflow = this.toRenewalWorkflow(workflow ?? null);
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      employeeId: row.employeeId,
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      employeeNumber: row.employee.employeeNumber,
      contractType: row.contractType,
      status: row.status,
      displayStatus: computeDisplayStatus({
        status: row.status,
        startDate: row.startDate,
        endDate: row.endDate,
        renewalWorkflowStatus: renewalWorkflow?.status ?? null,
        warningDays,
      }),
      startDate: formatDateValue(row.startDate),
      endDate: row.endDate ? formatDateValue(row.endDate) : null,
      probationEndDate: row.probationEndDate
        ? formatDateValue(row.probationEndDate)
        : null,
      workingHoursPerWeek:
        row.workingHoursPerWeek != null ? Number(row.workingHoursPerWeek) : null,
      payRate: row.payRate != null ? Number(row.payRate) : null,
      payFrequency: row.payFrequency,
      currency: row.currency,
      leaveEntitlementDays:
        row.leaveEntitlementDays != null ? Number(row.leaveEntitlementDays) : null,
      overtimeRule: parseOvertimeRule(row.overtimeRule),
      noticePeriodDays: row.noticePeriodDays,
      employerNoticeDays: row.employerNoticeDays,
      terminationConditions: row.terminationConditions,
      renewedFromId: row.renewedFromId,
      signedAt: row.signedAt?.toISOString() ?? null,
      renewalWorkflow,
      documents: row.documents.map((doc) => this.toDocumentRecord(doc)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toDocumentRecord(
    doc: EmploymentContractDocument,
  ): EmploymentContractDocumentRecord {
    return {
      id: doc.id,
      contractId: doc.contractId,
      label: doc.label,
      originalName: doc.originalName,
      contentType: doc.contentType,
      sizeBytes: doc.sizeBytes,
      uploadedAt: doc.uploadedAt.toISOString(),
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}
