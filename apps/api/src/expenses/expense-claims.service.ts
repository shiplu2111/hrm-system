import {
  BadRequestException,
  ForbiddenException,
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
  ExpenseClaimDetailRecord,
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
import { PermissionsService } from '../rbac/permissions.service';
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
  buildLimitCheck,
  formatDateValue,
  isFutureExpenseDate,
  monthBounds,
  parseDateString,
  resolveExpenseDisplayStatus,
} from './expense.utils';

type ClaimWithRelations = ExpenseClaim & {
  employee: { firstName: string; lastName: string; employeeNumber: string };
  category: ExpenseCategory;
  receipts: ExpenseClaimReceipt[];
};

const COUNTED_STATUSES = [
  ExpenseClaimStatus.pending_approval,
  ExpenseClaimStatus.approved,
  ExpenseClaimStatus.reimbursed,
];

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
    private readonly permissions: PermissionsService,
  ) {}

  async list(
    companyId: string,
    query: ListExpenseClaimsQueryDto,
    user: AuthenticatedUser,
  ): Promise<ExpenseClaimRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.expenseClaim.findMany({
      where: {
        companyId,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: this.defaultInclude(),
      orderBy: [{ createdAt: 'desc' }],
    });

    return this.presentMany(rows, user);
  }

  async get(claimId: string, user: AuthenticatedUser): Promise<ExpenseClaimDetailRecord> {
    const row = await this.findOrThrow(claimId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    const [record] = await this.presentMany([row], user);

    const { start, end } = monthBounds(row.expenseDate);
    const others = await this.prisma.unscoped.expenseClaim.aggregate({
      where: {
        employeeId: row.employeeId,
        categoryId: row.categoryId,
        expenseDate: { gte: start, lte: end },
        status: { in: COUNTED_STATUSES },
        id: { not: row.id },
      },
      _sum: { amount: true },
    });

    return {
      ...record,
      approvalRoute:
        record.approvalRoute ??
        (row.status === ExpenseClaimStatus.draft
          ? await this.expenseWorkflow.previewRoute(row.companyId, Number(row.amount))
          : null),
      categoryReceiptRequired: row.category.receiptRequired,
      categoryIsActive: row.category.isActive,
      limitCheck: buildLimitCheck({
        amount: Number(row.amount),
        expenseDate: row.expenseDate,
        maxAmountPerClaim: this.decimalOrNull(row.category.maxAmountPerClaim),
        maxAmountPerMonth: this.decimalOrNull(row.category.maxAmountPerMonth),
        otherClaimsThisMonth: Number(others._sum.amount ?? 0),
      }),
      stepActors: await this.loadStepActors(record.workflow),
    };
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

    const expenseDate = parseDateString(dto.expenseDate);
    if (isFutureExpenseDate(expenseDate)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'The expense date cannot be in the future',
      });
    }

    await this.validateLimits({
      employeeId: dto.employeeId,
      categoryId: dto.categoryId,
      amount: dto.amount,
      category,
      expenseDate,
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
        expenseDate,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency?.trim().toUpperCase() ?? 'AUD',
        description: dto.description || null,
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

    return this.present(row, user);
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

    if (!row.category.isActive) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `The ${row.category.name} category has been deactivated; move the claim to another category`,
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

    return this.present(updated, user);
  }

  async approve(
    claimId: string,
    user: AuthenticatedUser,
    dto: ExpenseClaimActionDto,
  ): Promise<ExpenseClaimRecord> {
    const row = await this.findOrThrow(claimId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    this.assertNotOwnClaim(row, user, 'approve or reject');

    if (row.status !== ExpenseClaimStatus.pending_approval) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Claim is not pending approval',
      });
    }

    const transition = await this.expenseWorkflow.approve({
      claimId: row.id,
      user,
      comment: dto.comment || null,
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

    return this.present(updated, user);
  }

  async reject(
    claimId: string,
    user: AuthenticatedUser,
    dto: RejectExpenseClaimDto,
  ): Promise<ExpenseClaimRecord> {
    const row = await this.findOrThrow(claimId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    this.assertNotOwnClaim(row, user, 'approve or reject');

    if (row.status !== ExpenseClaimStatus.pending_approval) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Claim is not pending approval',
      });
    }

    await this.expenseWorkflow.reject({
      claimId: row.id,
      user,
      comment: dto.reason,
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
        rejectionReason: dto.reason,
      },
      include: this.defaultInclude(),
    });

    await this.emitOutcome('expense.rejected', updated);

    return this.present(updated, user);
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

    await this.expenseWorkflow.cancelForClaim(claimId);

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
      oldValue: { status: row.status },
      newValue: { status: ExpenseClaimStatus.cancelled },
    });

    return this.present(updated, user);
  }

  async markReimbursed(
    claimId: string,
    user: AuthenticatedUser,
  ): Promise<ExpenseClaimRecord> {
    const row = await this.findOrThrow(claimId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    this.assertNotOwnClaim(row, user, 'mark as reimbursed');

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
      newValue: { status: ExpenseClaimStatus.reimbursed },
    });

    return this.present(updated, user);
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
    const receipt = await this.findReceiptOrThrow(claimId, receiptId);
    const url = await this.storageService.getUrl(receipt.fileKey, 900);
    return { url, expiresInSeconds: 900, fileKey: receipt.fileKey };
  }

  /** Receipt bytes, checked against the claim rather than the generic storage route. */
  async readReceiptFile(claimId: string, receiptId: string) {
    const receipt = await this.findReceiptOrThrow(claimId, receiptId);
    const exists = await this.storageService.exists(receipt.fileKey);
    if (!exists) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'The receipt file is missing from storage',
      });
    }
    const { buffer } = await this.storageService.read(receipt.fileKey);
    return {
      buffer,
      contentType: receipt.contentType,
      filename: receipt.originalName,
    };
  }

  private async findReceiptOrThrow(claimId: string, receiptId: string) {
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
    return receipt;
  }

  private assertNotOwnClaim(
    row: ClaimWithRelations,
    user: AuthenticatedUser,
    action: string,
  ): void {
    if (user.employeeId && user.employeeId === row.employeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `You cannot ${action} your own expense claim`,
      });
    }
  }

  private async validateLimits(input: {
    employeeId: string;
    categoryId: string;
    amount: number;
    category: ExpenseCategory;
    expenseDate: Date;
    excludeClaimId?: string;
  }) {
    const { start, end } = monthBounds(input.expenseDate);

    const monthly = await this.prisma.unscoped.expenseClaim.aggregate({
      where: {
        employeeId: input.employeeId,
        categoryId: input.categoryId,
        expenseDate: { gte: start, lte: end },
        status: { in: COUNTED_STATUSES },
        ...(input.excludeClaimId ? { id: { not: input.excludeClaimId } } : {}),
      },
      _sum: { amount: true },
    });

    try {
      assertCategoryLimits({
        amount: input.amount,
        maxAmountPerClaim: this.decimalOrNull(input.category.maxAmountPerClaim),
        maxAmountPerMonth: this.decimalOrNull(input.category.maxAmountPerMonth),
        employeeMonthlyTotal: Number(monthly._sum.amount ?? 0),
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

  private async present(
    row: ClaimWithRelations,
    user: AuthenticatedUser,
  ): Promise<ExpenseClaimRecord> {
    const [record] = await this.presentMany([row], user);
    return record;
  }

  /** Adds each claim's workflow, approval route and whether `user` can act on its current step. */
  private async presentMany(
    rows: ClaimWithRelations[],
    user: AuthenticatedUser,
  ): Promise<ExpenseClaimRecord[]> {
    const workflows = await this.expenseWorkflow.findForClaims(rows.map((row) => row.id));
    const routes = await this.expenseWorkflow.resolveRoutes([...workflows.values()]);

    const reviewable = this.permissions.hasPermission(user, 'payroll', 'approve')
      ? rows.flatMap((row) => {
          const workflow = workflows.get(row.id);
          const step = workflow ? getCurrentWorkflowStep(workflow.steps) : null;
          return row.status === ExpenseClaimStatus.pending_approval &&
            workflow?.status === 'pending' &&
            step &&
            row.employeeId !== user.employeeId
            ? [{ claimId: row.id, requesterEmployeeId: row.employeeId, step }]
            : [];
        })
      : [];
    const flags = await this.workflowAssignee.canActOnSteps(user, reviewable);
    const canAct = new Set(reviewable.filter((_, i) => flags[i]).map((item) => item.claimId));

    return rows.map((row) => {
      const workflow = workflows.get(row.id) ?? null;
      return {
        ...this.toRecord(row, workflow),
        approvalRoute: workflow ? (routes.get(workflow.id) ?? null) : null,
        canAct: canAct.has(row.id),
      };
    });
  }

  private async loadStepActors(
    workflow: WorkflowInstanceRecord | null,
  ): Promise<Record<number, string>> {
    if (!workflow) return {};
    const acted = workflow.steps.filter((s) => s.actedByEmployeeId || s.actedByUserId);
    if (acted.length === 0) return {};

    const employeeIds = [
      ...new Set(acted.map((s) => s.actedByEmployeeId).filter((id): id is string => !!id)),
    ];
    const userIds = [
      ...new Set(
        acted
          .filter((s) => !s.actedByEmployeeId && s.actedByUserId)
          .map((s) => s.actedByUserId!),
      ),
    ];
    const [employees, users] = await Promise.all([
      employeeIds.length
        ? this.prisma.unscoped.employee.findMany({
            where: { id: { in: employeeIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [],
      userIds.length
        ? this.prisma.unscoped.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true },
          })
        : [],
    ]);
    const employeeName = new Map(
      employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`.trim()]),
    );
    const userEmail = new Map(users.map((u) => [u.id, u.email]));

    const actors: Record<number, string> = {};
    for (const step of acted) {
      const name =
        (step.actedByEmployeeId && employeeName.get(step.actedByEmployeeId)) ||
        (step.actedByUserId && userEmail.get(step.actedByUserId));
      if (name) actors[step.order] = name;
    }
    return actors;
  }

  private decimalOrNull(value: Prisma.Decimal | null): number | null {
    return value == null ? null : Number(value);
  }

  private toRecord(
    row: ClaimWithRelations,
    workflow: WorkflowInstanceRecord | null,
  ): Omit<ExpenseClaimRecord, 'approvalRoute' | 'canAct'> {
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
