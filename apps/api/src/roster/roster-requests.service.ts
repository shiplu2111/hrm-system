import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  OvertimeRateType,
  OvertimeRequestStatus,
  Prisma,
  ShiftSwapRequestStatus,
  WorkflowEntityType,
} from '@prisma/client';
import type {
  OvertimeRequestRecord,
  ShiftSwapRequestRecord,
  WorkflowApprovalRoute,
  WorkflowInstanceRecord,
} from '@hrm/shared-types';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { DataScopeService } from '../rbac/data-scope.service';
import { getTenantIdFromSession } from '../tenant/tenant.context';
import { WorkflowDefinitionsService } from '../workflow/workflow-definitions.service';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { policyStepsToDefinitionSteps } from '../workflow/workflow.utils';
import type {
  CreateOvertimeRequestDto,
  CreateShiftSwapRequestDto,
  DecideEssRequestDto,
  ListEssRequestsQueryDto,
} from './dto/ess-requests.dto';

const DEFAULT_ROUTE_STEPS = [{ roleName: 'Manager' }];

const shiftSwapInclude = {
  requesterEmployee: {
    select: { id: true, firstName: true, lastName: true, employeeNumber: true },
  },
  targetEmployee: {
    select: { id: true, firstName: true, lastName: true, employeeNumber: true },
  },
} satisfies Prisma.ShiftSwapRequestInclude;

const overtimeInclude = {
  employee: {
    select: { id: true, firstName: true, lastName: true, employeeNumber: true },
  },
} satisfies Prisma.OvertimeRequestInclude;

type ShiftSwapWithEmployees = Prisma.ShiftSwapRequestGetPayload<{
  include: typeof shiftSwapInclude;
}>;
type OvertimeWithEmployee = Prisma.OvertimeRequestGetPayload<{
  include: typeof overtimeInclude;
}>;

@Injectable()
export class RosterRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly dataScope: DataScopeService,
    private readonly auditService: AuditService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly definitionsService: WorkflowDefinitionsService,
  ) {}

  async resolveDefaultRoute(
    companyId: string,
    entityType: 'shift_swap_request' | 'overtime_request',
  ): Promise<WorkflowApprovalRoute> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const definition = await this.definitionsService.findEffectiveDefault(
      companyId,
      entityType,
    );
    if (definition) {
      return {
        definitionId: definition.id,
        name: definition.name,
        source: 'workflow_builder',
        steps: definition.steps,
      };
    }
    return {
      definitionId: null,
      name:
        entityType === 'shift_swap_request'
          ? 'Default manager approval'
          : 'Default manager approval',
      source: 'system_default',
      steps: policyStepsToDefinitionSteps(DEFAULT_ROUTE_STEPS),
    };
  }

  // -------------------------------------------------------------------------
  // Shift Swap Requests (MODULES.md §12, §24, §35)
  // -------------------------------------------------------------------------

  async listShiftSwaps(
    companyId: string,
    query: ListEssRequestsQueryDto,
    employeeFilter?: { in: string[] },
  ): Promise<ShiftSwapRequestRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const scopedFilter = query.employeeId
      ? {
          OR: [
            { requesterEmployeeId: query.employeeId },
            { targetEmployeeId: query.employeeId },
          ],
        }
      : employeeFilter
        ? {
            OR: [
              { requesterEmployeeId: employeeFilter },
              { targetEmployeeId: employeeFilter },
            ],
          }
        : {};

    const rows = await this.prisma.scoped.shiftSwapRequest.findMany({
      where: {
        companyId,
        ...scopedFilter,
        ...(query.status ? { status: query.status as ShiftSwapRequestStatus } : {}),
      },
      include: shiftSwapInclude,
      orderBy: { createdAt: 'desc' },
    });

    const workflows = await this.loadWorkflows(
      WorkflowEntityType.shift_swap_request,
      rows.map((r) => r.id),
    );
    return rows.map((row) => this.toShiftSwapRecord(row, workflows.get(row.id) ?? null));
  }

  async createShiftSwap(
    employeeId: string,
    dto: CreateShiftSwapRequestDto,
    user: AuthenticatedUser,
  ): Promise<ShiftSwapRequestRecord> {
    const requester = await this.assertEmployee(employeeId);
    if (dto.targetEmployeeId === employeeId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Choose a colleague to swap shifts with',
      });
    }

    const target = await this.assertEmployee(dto.targetEmployeeId);
    if (target.companyId !== requester.companyId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Colleague must belong to the same company',
      });
    }

    const swapDateObj = this.parseDate(dto.swapDate);
    const targetDateIso = dto.targetDate || dto.swapDate;
    const targetDateObj = this.parseDate(targetDateIso);

    const requesterRoster = dto.requesterRosterId
      ? await this.prisma.unscoped.roster.findFirst({
          where: { id: dto.requesterRosterId, employeeId },
          include: { shift: { select: { name: true, startTime: true, endTime: true } } },
        })
      : await this.prisma.unscoped.roster.findFirst({
          where: { employeeId, date: swapDateObj },
          include: { shift: { select: { name: true, startTime: true, endTime: true } } },
        });

    if (dto.requesterRosterId && !requesterRoster) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Selected roster shift not found',
      });
    }

    const targetRoster = await this.prisma.unscoped.roster.findFirst({
      where: { employeeId: dto.targetEmployeeId, date: targetDateObj },
      include: { shift: { select: { name: true, startTime: true, endTime: true } } },
    });

    const created = await this.prisma.scoped.shiftSwapRequest.create({
      data: {
        tenantId: requester.tenantId,
        companyId: requester.companyId,
        requesterEmployeeId: employeeId,
        targetEmployeeId: dto.targetEmployeeId,
        requesterRosterId: requesterRoster?.id ?? null,
        requesterShiftName: requesterRoster?.shift?.name ?? null,
        requesterShiftWindow: requesterRoster?.shift
          ? this.shiftWindow(requesterRoster.shift.startTime, requesterRoster.shift.endTime)
          : null,
        targetRosterId: targetRoster?.id ?? null,
        targetShiftName: targetRoster?.shift?.name ?? null,
        targetShiftWindow: targetRoster?.shift
          ? this.shiftWindow(targetRoster.shift.startTime, targetRoster.shift.endTime)
          : null,
        swapDate: requesterRoster ? requesterRoster.date : swapDateObj,
        targetDate: targetDateObj,
        reason: dto.reason.trim(),
        requestedByUserId: user.id,
      },
      include: shiftSwapInclude,
    });

    const workflow = await this.startWorkflow(
      requester.companyId,
      requester.tenantId,
      WorkflowEntityType.shift_swap_request,
      created.id,
      employeeId,
      user.id,
    );

    await this.auditService.log({
      tenantId: requester.tenantId,
      userId: user.id,
      action: AuditAction.create,
      module: 'attendance',
      recordId: created.id,
      newValue: {
        kind: 'shift_swap_request',
        requesterEmployeeId: employeeId,
        targetEmployeeId: dto.targetEmployeeId,
        swapDate: created.swapDate.toISOString().slice(0, 10),
        targetDate: created.targetDate.toISOString().slice(0, 10),
      },
    });

    await this.notifyColleague(
      requester.tenantId,
      requester.companyId,
      dto.targetEmployeeId,
      'shift_swap.proposed',
      'Shift swap proposal',
      `${requester.firstName} ${requester.lastName} proposed a shift swap with you for ${created.swapDate.toISOString().slice(0, 10)}.`,
    );

    return this.toShiftSwapRecord(created, workflow);
  }

  async cancelShiftSwap(
    requestId: string,
    user: AuthenticatedUser,
  ): Promise<ShiftSwapRequestRecord> {
    const existing = await this.getShiftSwapOrThrow(requestId);
    if (user.employeeId !== existing.requesterEmployeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only the requester can cancel this shift swap request',
      });
    }
    if (existing.status !== ShiftSwapRequestStatus.pending) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Only pending requests can be cancelled',
      });
    }

    const updated = await this.prisma.scoped.shiftSwapRequest.update({
      where: { id: requestId },
      data: { status: ShiftSwapRequestStatus.cancelled },
      include: shiftSwapInclude,
    });
    const wf = await this.workflowEngine.findByEntity(WorkflowEntityType.shift_swap_request, requestId);
    if (wf && wf.status === 'pending') {
      await this.workflowEngine.cancelInstance(wf.id);
    }

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: AuditAction.update,
      module: 'attendance',
      recordId: requestId,
      oldValue: { status: existing.status },
      newValue: { status: updated.status },
    });

    const latestWf = await this.loadSingleWorkflow(WorkflowEntityType.shift_swap_request, requestId);
    return this.toShiftSwapRecord(updated, latestWf);
  }

  async approveShiftSwap(
    requestId: string,
    dto: DecideEssRequestDto,
    user: AuthenticatedUser,
  ): Promise<ShiftSwapRequestRecord> {
    const existing = await this.getShiftSwapOrThrow(requestId);
    await this.dataScope.assertEmployeeInScope(user, existing.requesterEmployeeId, {
      includeSelf: false,
    });
    if (existing.status !== ShiftSwapRequestStatus.pending) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Only pending requests can be approved',
      });
    }

    const instance = await this.ensureWorkflowInstance(
      existing.companyId,
      existing.tenantId,
      WorkflowEntityType.shift_swap_request,
      existing.id,
      existing.requesterEmployeeId,
      existing.requestedByUserId,
    );

    const result = await this.workflowEngine.approve({
      instanceId: instance.id,
      user,
      comment: dto.comment,
      audit: {
        tenantId: existing.tenantId,
        module: 'attendance',
        recordId: requestId,
      },
    });

    if (!result.fullyApproved) {
      return this.toShiftSwapRecord(existing, result.instance);
    }

    const updated = await this.prisma.unscoped.$transaction(async (tx) => {
      if (existing.requesterRosterId && existing.targetRosterId) {
        const [reqRoster, tgtRoster] = await Promise.all([
          tx.roster.findUnique({ where: { id: existing.requesterRosterId } }),
          tx.roster.findUnique({ where: { id: existing.targetRosterId } }),
        ]);
        if (reqRoster && tgtRoster) {
          await tx.roster.update({
            where: { id: reqRoster.id },
            data: { shiftId: tgtRoster.shiftId, locationId: tgtRoster.locationId },
          });
          await tx.roster.update({
            where: { id: tgtRoster.id },
            data: { shiftId: reqRoster.shiftId, locationId: reqRoster.locationId },
          });
        }
      }

      return tx.shiftSwapRequest.update({
        where: { id: requestId },
        data: {
          status: ShiftSwapRequestStatus.approved,
          reviewedByUserId: user.id,
          reviewedAt: new Date(),
          reviewComment: dto.comment?.trim() || null,
        },
        include: shiftSwapInclude,
      });
    });

    await this.notifyRequester(
      existing.tenantId,
      existing.companyId,
      existing.requestedByUserId,
      'attendance.shift_swap_approved',
      'Shift swap approved',
      `Your shift swap request with ${existing.targetEmployee.firstName} ${existing.targetEmployee.lastName} was approved.`,
    );

    return this.toShiftSwapRecord(updated, result.instance);
  }

  async rejectShiftSwap(
    requestId: string,
    dto: DecideEssRequestDto,
    user: AuthenticatedUser,
  ): Promise<ShiftSwapRequestRecord> {
    const existing = await this.getShiftSwapOrThrow(requestId);
    await this.dataScope.assertEmployeeInScope(user, existing.requesterEmployeeId, {
      includeSelf: false,
    });
    if (existing.status !== ShiftSwapRequestStatus.pending) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Only pending requests can be rejected',
      });
    }

    const instance = await this.ensureWorkflowInstance(
      existing.companyId,
      existing.tenantId,
      WorkflowEntityType.shift_swap_request,
      existing.id,
      existing.requesterEmployeeId,
      existing.requestedByUserId,
    );

    const result = await this.workflowEngine.reject({
      instanceId: instance.id,
      user,
      comment: dto.comment,
      audit: {
        tenantId: existing.tenantId,
        module: 'attendance',
        recordId: requestId,
      },
    });

    const updated = await this.prisma.scoped.shiftSwapRequest.update({
      where: { id: requestId },
      data: {
        status: ShiftSwapRequestStatus.rejected,
        reviewedByUserId: user.id,
        reviewedAt: new Date(),
        reviewComment: dto.comment?.trim() || null,
      },
      include: shiftSwapInclude,
    });

    await this.notifyRequester(
      existing.tenantId,
      existing.companyId,
      existing.requestedByUserId,
      'attendance.shift_swap_rejected',
      'Shift swap rejected',
      `Your shift swap request was rejected.${dto.comment ? ` Reason: ${dto.comment}` : ''}`,
    );

    return this.toShiftSwapRecord(updated, result.instance);
  }

  // -------------------------------------------------------------------------
  // Overtime Requests (MODULES.md §15, §24, §35)
  // -------------------------------------------------------------------------

  async listOvertimeRequests(
    companyId: string,
    query: ListEssRequestsQueryDto,
    employeeFilter?: { in: string[] },
  ): Promise<OvertimeRequestRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const rows = await this.prisma.scoped.overtimeRequest.findMany({
      where: {
        companyId,
        employeeId: query.employeeId ?? employeeFilter,
        ...(query.status ? { status: query.status as OvertimeRequestStatus } : {}),
      },
      include: overtimeInclude,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const workflows = await this.loadWorkflows(
      WorkflowEntityType.overtime_request,
      rows.map((r) => r.id),
    );
    return rows.map((row) => this.toOvertimeRecord(row, workflows.get(row.id) ?? null));
  }

  async createOvertimeRequest(
    employeeId: string,
    dto: CreateOvertimeRequestDto,
    user: AuthenticatedUser,
  ): Promise<OvertimeRequestRecord> {
    const employee = await this.assertEmployee(employeeId);
    const created = await this.prisma.scoped.overtimeRequest.create({
      data: {
        tenantId: employee.tenantId,
        companyId: employee.companyId,
        employeeId,
        date: this.parseDate(dto.date),
        startTime: dto.startTime?.trim() || null,
        endTime: dto.endTime?.trim() || null,
        hours: new Prisma.Decimal(dto.hours.toFixed(2)),
        rateType: dto.rateType as OvertimeRateType,
        reason: dto.reason.trim(),
        requestedByUserId: user.id,
      },
      include: overtimeInclude,
    });

    const workflow = await this.startWorkflow(
      employee.companyId,
      employee.tenantId,
      WorkflowEntityType.overtime_request,
      created.id,
      employeeId,
      user.id,
    );

    await this.auditService.log({
      tenantId: employee.tenantId,
      userId: user.id,
      action: AuditAction.create,
      module: 'attendance',
      recordId: created.id,
      newValue: {
        kind: 'overtime_request',
        employeeId,
        date: created.date.toISOString().slice(0, 10),
        hours: Number(created.hours),
        rateType: created.rateType,
      },
    });

    return this.toOvertimeRecord(created, workflow);
  }

  async cancelOvertimeRequest(
    requestId: string,
    user: AuthenticatedUser,
  ): Promise<OvertimeRequestRecord> {
    const existing = await this.getOvertimeOrThrow(requestId);
    if (user.employeeId !== existing.employeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only the requester can cancel this overtime request',
      });
    }
    if (existing.status !== OvertimeRequestStatus.pending) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Only pending requests can be cancelled',
      });
    }

    const updated = await this.prisma.scoped.overtimeRequest.update({
      where: { id: requestId },
      data: { status: OvertimeRequestStatus.cancelled },
      include: overtimeInclude,
    });
    const wf = await this.workflowEngine.findByEntity(WorkflowEntityType.overtime_request, requestId);
    if (wf && wf.status === 'pending') {
      await this.workflowEngine.cancelInstance(wf.id);
    }

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: AuditAction.update,
      module: 'attendance',
      recordId: requestId,
      oldValue: { status: existing.status },
      newValue: { status: updated.status },
    });

    const latestWf = await this.loadSingleWorkflow(WorkflowEntityType.overtime_request, requestId);
    return this.toOvertimeRecord(updated, latestWf);
  }

  async approveOvertimeRequest(
    requestId: string,
    dto: DecideEssRequestDto,
    user: AuthenticatedUser,
  ): Promise<OvertimeRequestRecord> {
    const existing = await this.getOvertimeOrThrow(requestId);
    await this.dataScope.assertEmployeeInScope(user, existing.employeeId, {
      includeSelf: false,
    });
    if (existing.status !== OvertimeRequestStatus.pending) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Only pending requests can be approved',
      });
    }

    const instance = await this.ensureWorkflowInstance(
      existing.companyId,
      existing.tenantId,
      WorkflowEntityType.overtime_request,
      existing.id,
      existing.employeeId,
      existing.requestedByUserId,
    );

    const result = await this.workflowEngine.approve({
      instanceId: instance.id,
      user,
      comment: dto.comment,
      audit: {
        tenantId: existing.tenantId,
        module: 'attendance',
        recordId: requestId,
      },
    });

    if (!result.fullyApproved) {
      return this.toOvertimeRecord(existing, result.instance);
    }

    const updated = await this.prisma.scoped.overtimeRequest.update({
      where: { id: requestId },
      data: {
        status: OvertimeRequestStatus.approved,
        reviewedByUserId: user.id,
        reviewedAt: new Date(),
        reviewComment: dto.comment?.trim() || null,
      },
      include: overtimeInclude,
    });

    await this.notifyRequester(
      existing.tenantId,
      existing.companyId,
      existing.requestedByUserId,
      'attendance.overtime_approved',
      'Overtime request approved',
      `Your overtime request for ${existing.date.toISOString().slice(0, 10)} (${Number(existing.hours)}h) was approved.`,
    );

    return this.toOvertimeRecord(updated, result.instance);
  }

  async rejectOvertimeRequest(
    requestId: string,
    dto: DecideEssRequestDto,
    user: AuthenticatedUser,
  ): Promise<OvertimeRequestRecord> {
    const existing = await this.getOvertimeOrThrow(requestId);
    await this.dataScope.assertEmployeeInScope(user, existing.employeeId, {
      includeSelf: false,
    });
    if (existing.status !== OvertimeRequestStatus.pending) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Only pending requests can be rejected',
      });
    }

    const instance = await this.ensureWorkflowInstance(
      existing.companyId,
      existing.tenantId,
      WorkflowEntityType.overtime_request,
      existing.id,
      existing.employeeId,
      existing.requestedByUserId,
    );

    const result = await this.workflowEngine.reject({
      instanceId: instance.id,
      user,
      comment: dto.comment,
      audit: {
        tenantId: existing.tenantId,
        module: 'attendance',
        recordId: requestId,
      },
    });

    const updated = await this.prisma.scoped.overtimeRequest.update({
      where: { id: requestId },
      data: {
        status: OvertimeRequestStatus.rejected,
        reviewedByUserId: user.id,
        reviewedAt: new Date(),
        reviewComment: dto.comment?.trim() || null,
      },
      include: overtimeInclude,
    });

    await this.notifyRequester(
      existing.tenantId,
      existing.companyId,
      existing.requestedByUserId,
      'attendance.overtime_rejected',
      'Overtime request rejected',
      `Your overtime request for ${existing.date.toISOString().slice(0, 10)} was rejected.${dto.comment ? ` Reason: ${dto.comment}` : ''}`,
    );

    return this.toOvertimeRecord(updated, result.instance);
  }

  // -------------------------------------------------------------------------
  // Shared Helpers
  // -------------------------------------------------------------------------

  private async startWorkflow(
    companyId: string,
    tenantId: string,
    entityType: 'shift_swap_request' | 'overtime_request',
    entityId: string,
    requesterEmployeeId: string,
    requesterUserId: string,
  ): Promise<WorkflowInstanceRecord> {
    const definition = await this.definitionsService.findEffectiveDefault(companyId, entityType);
    return this.workflowEngine.startInstance({
      companyId,
      tenantId,
      entityType,
      entityId,
      requesterEmployeeId,
      requesterUserId,
      definitionId: definition?.id ?? null,
      steps: definition ? undefined : policyStepsToDefinitionSteps(DEFAULT_ROUTE_STEPS),
    });
  }

  private async ensureWorkflowInstance(
    companyId: string,
    tenantId: string,
    entityType: 'shift_swap_request' | 'overtime_request',
    entityId: string,
    requesterEmployeeId: string,
    requesterUserId: string,
  ): Promise<WorkflowInstanceRecord> {
    const existing = await this.workflowEngine.findByEntity(entityType, entityId);
    if (existing) return this.workflowEngine.toRecord(existing);
    return this.startWorkflow(
      companyId,
      tenantId,
      entityType,
      entityId,
      requesterEmployeeId,
      requesterUserId,
    );
  }

  private async loadWorkflows(
    entityType: WorkflowEntityType,
    entityIds: string[],
  ): Promise<Map<string, WorkflowInstanceRecord>> {
    if (entityIds.length === 0) return new Map();
    const rows = await this.prisma.unscoped.workflowInstance.findMany({
      where: { entityType, entityId: { in: entityIds } },
    });
    return new Map(rows.map((r) => [r.entityId, this.workflowEngine.toRecord(r)]));
  }

  private async loadSingleWorkflow(
    entityType: WorkflowEntityType,
    entityId: string,
  ): Promise<WorkflowInstanceRecord | null> {
    const row = await this.workflowEngine.findByEntity(entityType, entityId);
    return row ? this.workflowEngine.toRecord(row) : null;
  }

  private async assertEmployee(employeeId: string) {
    const tenantId = getTenantIdFromSession();
    const row = await this.prisma.scoped.employee.findFirst({
      where: {
        id: employeeId,
        deletedAt: null,
        ...(tenantId ? { tenantId } : {}),
      },
      select: {
        id: true,
        tenantId: true,
        companyId: true,
        firstName: true,
        lastName: true,
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }
    return row;
  }

  private async getShiftSwapOrThrow(id: string): Promise<ShiftSwapWithEmployees> {
    const tenantId = getTenantIdFromSession();
    const row = await this.prisma.scoped.shiftSwapRequest.findFirst({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      include: shiftSwapInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Shift swap request not found',
      });
    }
    return row;
  }

  private async getOvertimeOrThrow(id: string): Promise<OvertimeWithEmployee> {
    const tenantId = getTenantIdFromSession();
    const row = await this.prisma.scoped.overtimeRequest.findFirst({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      include: overtimeInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Overtime request not found',
      });
    }
    return row;
  }

  private toShiftSwapRecord(
    row: ShiftSwapWithEmployees,
    workflowInstance: WorkflowInstanceRecord | null,
  ): ShiftSwapRequestRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      requesterEmployeeId: row.requesterEmployeeId,
      requesterName: `${row.requesterEmployee.firstName} ${row.requesterEmployee.lastName}`.trim(),
      requesterEmployeeNumber: row.requesterEmployee.employeeNumber,
      targetEmployeeId: row.targetEmployeeId,
      targetName: `${row.targetEmployee.firstName} ${row.targetEmployee.lastName}`.trim(),
      targetEmployeeNumber: row.targetEmployee.employeeNumber,
      requesterRosterId: row.requesterRosterId,
      requesterShiftName: row.requesterShiftName,
      requesterShiftWindow: row.requesterShiftWindow,
      targetRosterId: row.targetRosterId,
      targetShiftName: row.targetShiftName,
      targetShiftWindow: row.targetShiftWindow,
      swapDate: row.swapDate.toISOString().slice(0, 10),
      targetDate: row.targetDate.toISOString().slice(0, 10),
      reason: row.reason,
      status: row.status,
      reviewedByUserId: row.reviewedByUserId,
      reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
      reviewComment: row.reviewComment,
      workflowInstance,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toOvertimeRecord(
    row: OvertimeWithEmployee,
    workflowInstance: WorkflowInstanceRecord | null,
  ): OvertimeRequestRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      employeeId: row.employeeId,
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      employeeNumber: row.employee.employeeNumber,
      date: row.date.toISOString().slice(0, 10),
      startTime: row.startTime,
      endTime: row.endTime,
      hours: Number(row.hours),
      rateType: row.rateType,
      reason: row.reason,
      status: row.status,
      reviewedByUserId: row.reviewedByUserId,
      reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
      reviewComment: row.reviewComment,
      workflowInstance,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private shiftWindow(start: Date, end: Date): string {
    return `${start.toISOString().slice(11, 16)} – ${end.toISOString().slice(11, 16)}`;
  }

  private parseDate(value: string): Date {
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  private async notifyColleague(
    tenantId: string,
    companyId: string,
    employeeId: string,
    eventType: string,
    title: string,
    body: string,
  ): Promise<void> {
    try {
      const user = await this.prisma.unscoped.user.findFirst({
        where: { tenantId, employeeId, isActive: true },
        select: { id: true },
      });
      if (!user) return;
      await this.prisma.unscoped.inAppNotification.create({
        data: { tenantId, companyId, userId: user.id, eventType, title, body, payload: {} },
      });
    } catch {
      // Non-blocking notification
    }
  }

  private async notifyRequester(
    tenantId: string,
    companyId: string,
    userId: string,
    eventType: string,
    title: string,
    body: string,
  ): Promise<void> {
    try {
      await this.prisma.unscoped.inAppNotification.create({
        data: { tenantId, companyId, userId, eventType, title, body, payload: {} },
      });
    } catch {
      // Non-blocking notification
    }
  }
}
