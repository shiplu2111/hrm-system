import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ExpenseClaimStatus,
  Prisma,
  type ExpenseClaim,
  type ExpenseClaimReceipt,
  type ExpenseCategory,
} from '@prisma/client';
import type {
  ExpenseClaimReceiptRecord,
  ExpenseClaimRecord,
  WorkflowInstanceRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import {
  buildApprovalPendingVariables,
  buildExpenseOutcomeVariables,
} from '../notifications/notification.helpers';
import { CompanyScopeService } from '../organization/company-scope.service';
import { assertValidDocumentUpload } from '../storage/document-file.policy';
import { StorageService } from '../storage/storage.service';
import { WorkflowAssigneeService } from '../workflow/workflow-assignee.service';
import { getCurrentWorkflowStep } from '../workflow/workflow.utils';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseWorkflowService } from './expense-workflow.service';
import type {
  CreateExpenseClaimDto,
  ExpenseClaimActionDto,
  ListExpenseClaimsQueryDto,
  RejectExpenseClaimDto,
} from './dto/expense.dto';
import {
  assertCategoryLimits,
  buildExpenseReferenceNumber,
  formatDateValue,
  parseDateString,
  resolveExpenseDisplayStatus,
} from './expense.utils';

type ClaimWithRelations = ExpenseClaim & {
  employee: { firstName: string; lastName: string; employeeNumber: string };
  category: ExpenseCategory;
  receipts: ExpenseClaimReceipt[];
};

@Injectable()
export class ExpenseClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly categoriesService: ExpenseCategoriesService,
    private readonly expenseWorkflow: ExpenseWorkflowService,
    private readonly workflowAssignee: WorkflowAssigneeService,
    private readonly notificationEngine: NotificationEngineService,
    private readonly storageService: StorageService,
  ) {}

  async list(
    companyId: string,
    query: ListExpenseClaimsQueryDto,
  ): Promise<ExpenseClaimRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.expenseClaim.findMany({
      where: {
        companyId,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.status
          ? { status: query.status as ExpenseClaimStatus }
          : {}),
      },
      include: this.defaultInclude(),
      orderBy: [{ createdAt: 'desc' }],
    });

    const records: ExpenseClaimRecord[] = [];
    for (const row of rows) {
      const workflow = await this.expenseWorkflow.findForClaim(row.id);
      records.push(this.toRecord(row, workflow));
    }
    return records;
  }

  async get(claimId: string): Promise<ExpenseClaimRecord> {
    const row = await this.findOrThrow(claimId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    const workflow = await this.expenseWorkflow.findForClaim(claimId);
    return this.toRecord(row, workflow);
  }

  async create(
    companyId: string,
    dto: CreateExpenseClaimDto,
    user: AuthenticatedUser,
  ): Promise<ExpenseClaimRecord> {
    const employee = await this.assertEmployee(dto.employeeId, companyId);
    const category = await this.categoriesService.findOrThrow(dto.categoryId);
    if (category.companyId !== companyId || !category.isActive) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Expense category is not available',
      });
    }

    await this.validateLimits({
      employeeId: dto.employeeId,
      categoryId: dto.categoryId,
      amount: dto.amount,
      category,
      expenseDate: parseDateString(dto.expenseDate),
    });

    const count = await this.prisma.unscoped.expenseClaim.count({
      where: { companyId },
    });
    const referenceNumber = buildExpenseReferenceNumber(count);

    const row = await this.prisma.unscoped.expenseClaim.create({
      data: {
        tenantId: employee.tenantId,
        companyId,
        employeeId: dto.employeeId,
        categoryId: dto.categoryId,
        referenceNumber,
        expenseDate: parseDateString(dto.expenseDate),
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency?.trim().toUpperCase() ?? 'AUD',
        description: dto.description?.trim() ?? null,
        status: ExpenseClaimStatus.draft,
      },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: employee.tenantId,
      userId: user.id,
      action: 'create',
      module: 'expense',
      recordId: row.id,
      newValue: { referenceNumber, amount: dto.amount },
    });

    if (dto.submit === true) {
      return this.submit(row.id, user);
    }

    return this.toRecord(row, null);
  }

  async submit(
    claimId: string,
    user: AuthenticatedUser,
  ): Promise<ExpenseClaimRecord> {
    const row = await this.findOrThrow(claimId);
    await this.companyScope.assertCompanyInTenant(row.companyId);

    if (row.status !== ExpenseClaimStatus.draft) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only draft claims can be submitted',
      });
    }

    if (row.category.receiptRequired && row.receipts.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'At least one receipt is required for this category',
      });
    }

    await this.validateLimits({
      employeeId: row.employeeId,
      categoryId: row.categoryId,
      amount: Number(row.amount),
      category: row.category,
      expenseDate: row.expenseDate,
      excludeClaimId: row.id,
    });

    const instance = await this.expenseWorkflow.startForClaim({
      companyId: row.companyId,
      tenantId: row.tenantId,
      claimId: row.id,
      requesterEmployeeId: row.employeeId,
      requesterUserId: user.id,
      amount: Number(row.amount),
    });

    const updated = await this.prisma.unscoped.expenseClaim.update({
      where: { id: claimId },
      data: {
        status: ExpenseClaimStatus.pending_approval,
        submittedAt: new Date(),
      },
      include: this.defaultInclude(),
    });

    await this.emitApprovalPending(updated, instance);

    return this.toRecord(updated, instance);
  }

  async approve(
    claimId: string,
    user: AuthenticatedUser,
    dto: ExpenseClaimActionDto,
  ): Promise<ExpenseClaimRecord> {
    const row = await this.findOrThrow(claimId);
    await this.companyScope.assertCompanyInTenant(row.companyId);

    if (row.status !== ExpenseClaimStatus.pending_approval) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Claim is not pending approval',
      });
    }

    const transition = await this.expenseWorkflow.approve({
      claimId: row.id,
      user,
      comment: dto.comment,
      audit: {
        tenantId: row.tenantId,
        module: 'expense',
        recordId: row.id,
      },
      companyId: row.companyId,
      tenantId: row.tenantId,
      requesterEmployeeId: row.employeeId,
      requesterUserId: user.id,
      amount: Number(row.amount),
    });

    let updated = row;
    if (transition.fullyApproved) {
      updated = await this.prisma.unscoped.expenseClaim.update({
        where: { id: row.id },
        data: {
          status: ExpenseClaimStatus.approved,
          approvedAt: new Date(),
        },
        include: this.defaultInclude(),
      });
      await this.emitOutcome('expense.approved', updated);
    } else if (!transition.rejected) {
      await this.emitApprovalPending(row, transition.instance);
    }

    return this.toRecord(updated, transition.instance);
  }

  async reject(
    claimId: string,
    user: AuthenticatedUser,
    dto: RejectExpenseClaimDto,
  ): Promise<ExpenseClaimRecord> {
    const row = await this.findOrThrow(claimId);
    await this.companyScope.assertCompanyInTenant(row.companyId);

    if (row.status !== ExpenseClaimStatus.pending_approval) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Claim is not pending approval',
      });
    }

    const transition = await this.expenseWorkflow.reject({
      claimId: row.id,
      user,
      comment: dto.comment ?? dto.reason,
      audit: {
        tenantId: row.tenantId,
        module: 'expense',
        recordId: row.id,
      },
      companyId: row.companyId,
      tenantId: row.tenantId,
      requesterEmployeeId: row.employeeId,
      requesterUserId: user.id,
      amount: Number(row.amount),
    });

    const updated = await this.prisma.unscoped.expenseClaim.update({
      where: { id: row.id },
      data: {
        status: ExpenseClaimStatus.rejected,
        rejectedAt: new Date(),
        rejectionReason: dto.reason?.trim() ?? dto.comment?.trim() ?? null,
      },
      include: this.defaultInclude(),
    });

    await this.emitOutcome('expense.rejected', updated);

    return this.toRecord(updated, transition.instance);
  }

  async cancel(
    claimId: string,
    user: AuthenticatedUser,
  ): Promise<ExpenseClaimRecord> {
    const row = await this.findOrThrow(claimId);
    await this.companyScope.assertCompanyInTenant(row.companyId);

    if (
      row.status !== ExpenseClaimStatus.draft &&
      row.status !== ExpenseClaimStatus.pending_approval
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only draft or pending claims can be cancelled',
      });
    }

    const instance = await this.expenseWorkflow.findForClaim(claimId);
    if (instance && instance.status === 'pending') {
      await this.expenseWorkflow.cancelForClaim(claimId);
    }

    const updated = await this.prisma.unscoped.expenseClaim.update({
      where: { id: claimId },
      data: { status: ExpenseClaimStatus.cancelled },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: row.tenantId,
      userId: user.id,
      action: 'update',
      module: 'expense',
      recordId: claimId,
    });

    return this.toRecord(updated, instance);
  }

  async markReimbursed(
    claimId: string,
    user: AuthenticatedUser,
  ): Promise<ExpenseClaimRecord> {
    const row = await this.findOrThrow(claimId);
    await this.companyScope.assertCompanyInTenant(row.companyId);

    if (row.status !== ExpenseClaimStatus.approved) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only approved claims can be marked reimbursed',
      });
    }

    const updated = await this.prisma.unscoped.expenseClaim.update({
      where: { id: claimId },
      data: {
        status: ExpenseClaimStatus.reimbursed,
        reimbursedAt: new Date(),
      },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: row.tenantId,
      userId: user.id,
      action: 'approve',
      module: 'expense',
      recordId: claimId,
    });

    const workflow = await this.expenseWorkflow.findForClaim(claimId);
    return this.toRecord(updated, workflow);
  }

  async uploadReceipt(
    claimId: string,
    file: Express.Multer.File,
    user: AuthenticatedUser,
  ): Promise<ExpenseClaimReceiptRecord> {
    assertValidDocumentUpload(file);
    const claim = await this.findOrThrow(claimId);
    await this.companyScope.assertCompanyInTenant(claim.companyId);

    if (
      claim.status !== ExpenseClaimStatus.draft &&
      claim.status !== ExpenseClaimStatus.pending_approval
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Receipts can only be added to draft or pending claims',
      });
    }

    const storageKey = this.storageService.buildExpenseReceiptKey(
      claim.tenantId,
      claimId,
      file.originalname,
    );

    await this.storageService.upload(storageKey, file.buffer, {
      contentType: file.mimetype,
      originalName: file.originalname,
      size: file.size,
    });

    const receipt = await this.prisma.unscoped.expenseClaimReceipt.create({
      data: {
        claimId,
        tenantId: claim.tenantId,
        fileKey: storageKey,
        originalName: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
      },
    });

    await this.auditService.log({
      tenantId: claim.tenantId,
      userId: user.id,
      action: 'create',
      module: 'expense',
      recordId: receipt.id,
      newValue: { claimId, fileKey: storageKey },
    });

    return this.toReceiptRecord(receipt);
  }

  async getReceiptFileUrl(claimId: string, receiptId: string) {
    const claim = await this.findOrThrow(claimId);
    await this.companyScope.assertCompanyInTenant(claim.companyId);

    const receipt = await this.prisma.unscoped.expenseClaimReceipt.findFirst({
      where: { id: receiptId, claimId },
    });
    if (!receipt) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Expense receipt not found',
      });
    }

    const url = await this.storageService.getUrl(receipt.fileKey, 900);
    return { url, expiresInSeconds: 900, fileKey: receipt.fileKey };
  }

  private async validateLimits(input: {
    employeeId: string;
    categoryId: string;
    amount: number;
    category: ExpenseCategory;
    expenseDate: Date;
    excludeClaimId?: string;
  }) {
    const monthStart = new Date(
      Date.UTC(input.expenseDate.getUTCFullYear(), input.expenseDate.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(input.expenseDate.getUTCFullYear(), input.expenseDate.getUTCMonth() + 1, 0),
    );

    const monthlyClaims = await this.prisma.unscoped.expenseClaim.findMany({
      where: {
        employeeId: input.employeeId,
        categoryId: input.categoryId,
        expenseDate: { gte: monthStart, lte: monthEnd },
        status: {
          in: [
            ExpenseClaimStatus.pending_approval,
            ExpenseClaimStatus.approved,
            ExpenseClaimStatus.reimbursed,
          ],
        },
        ...(input.excludeClaimId ? { id: { not: input.excludeClaimId } } : {}),
      },
      select: { amount: true },
    });

    const employeeMonthlyTotal = monthlyClaims.reduce(
      (sum, row) => sum + Number(row.amount),
      0,
    );

    try {
      assertCategoryLimits({
        amount: input.amount,
        maxAmountPerClaim: input.category.maxAmountPerClaim
          ? Number(input.category.maxAmountPerClaim)
          : null,
        maxAmountPerMonth: input.category.maxAmountPerMonth
          ? Number(input.category.maxAmountPerMonth)
          : null,
        employeeMonthlyTotal,
      });
    } catch (error) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: error instanceof Error ? error.message : 'Category limit exceeded',
      });
    }
  }

  private async emitApprovalPending(
    claim: ClaimWithRelations,
    instance: WorkflowInstanceRecord,
  ): Promise<void> {
    const currentStep = getCurrentWorkflowStep(instance.steps);
    if (!currentStep) return;

    const employeeName =
      `${claim.employee.firstName} ${claim.employee.lastName}`.trim();
    const approverUserIds = await this.workflowAssignee.resolveApproverUserIds({
      step: currentStep,
      requesterEmployeeId: claim.employeeId,
      tenantId: claim.tenantId,
    });

    if (approverUserIds.length === 0) return;

    await this.notificationEngine.emit({
      tenantId: claim.tenantId,
      companyId: claim.companyId,
      eventType: 'approval.pending',
      subjectEmployeeId: claim.employeeId,
      directUserIds: approverUserIds,
      variables: buildApprovalPendingVariables({
        employeeName,
        entityLabel: 'expense claim',
        stepName: currentStep.roleName,
      }),
      payload: {
        claimId: claim.id,
        workflowInstanceId: instance.id,
        entityType: 'expense_claim',
        eventType: 'approval.pending',
      },
    });
  }

  private async emitOutcome(
    eventType: 'expense.approved' | 'expense.rejected',
    claim: ClaimWithRelations,
  ): Promise<void> {
    const employeeName =
      `${claim.employee.firstName} ${claim.employee.lastName}`.trim();

    await this.notificationEngine.emit({
      tenantId: claim.tenantId,
      companyId: claim.companyId,
      eventType,
      subjectEmployeeId: claim.employeeId,
      variables: buildExpenseOutcomeVariables({
        employeeName,
        claimReference: claim.referenceNumber,
        amount: Number(claim.amount).toFixed(2),
        currency: claim.currency,
        categoryName: claim.category.name,
      }),
      payload: {
        claimId: claim.id,
        eventType,
      },
    });
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

  private async findOrThrow(claimId: string): Promise<ClaimWithRelations> {
    const row = await this.prisma.unscoped.expenseClaim.findUnique({
      where: { id: claimId },
      include: this.defaultInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Expense claim not found',
      });
    }
    return row;
  }

  private defaultInclude() {
    return {
      employee: {
        select: { firstName: true, lastName: true, employeeNumber: true },
      },
      category: true,
      receipts: { orderBy: { uploadedAt: 'desc' as const } },
    };
  }

  private toRecord(
    row: ClaimWithRelations,
    workflow: WorkflowInstanceRecord | null,
  ): ExpenseClaimRecord {
    const status = row.status as ExpenseClaimRecord['status'];
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      employeeId: row.employeeId,
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      employeeNumber: row.employee.employeeNumber,
      categoryId: row.categoryId,
      categoryName: row.category.name,
      referenceNumber: row.referenceNumber,
      expenseDate: formatDateValue(row.expenseDate),
      amount: Number(row.amount),
      currency: row.currency,
      description: row.description,
      status,
      displayStatus: resolveExpenseDisplayStatus({ status, workflow }),
      submittedAt: row.submittedAt?.toISOString() ?? null,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      rejectedAt: row.rejectedAt?.toISOString() ?? null,
      reimbursedAt: row.reimbursedAt?.toISOString() ?? null,
      rejectionReason: row.rejectionReason,
      receipts: row.receipts.map((receipt) => this.toReceiptRecord(receipt)),
      workflow,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toReceiptRecord(row: ExpenseClaimReceipt): ExpenseClaimReceiptRecord {
    return {
      id: row.id,
      claimId: row.claimId,
      fileKey: row.fileKey,
      originalName: row.originalName,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
      uploadedAt: row.uploadedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
