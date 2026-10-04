import { Injectable } from '@nestjs/common';
import {
  AssetAssignmentStatus,
  AssetCategory,
  OffboardingStatus,
  OffboardingTaskStatus,
  OffboardingTaskType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';

/**
 * Keeps offboarding checklists in step with the asset register. Lives in AssetsModule so the
 * register can call it without a circular dependency on OffboardingModule.
 */
@Injectable()
export class OffboardingTaskSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /** The pending asset-return task an assignment may be linked to, when it belongs to this employee. */
  async findLinkableReturnTask(employeeId: string, taskId: string) {
    return this.prisma.unscoped.employeeOffboardingTask.findFirst({
      where: {
        id: taskId,
        taskType: OffboardingTaskType.asset_return,
        offboarding: { employeeId, status: { not: OffboardingStatus.cancelled } },
      },
      select: { id: true, assetCategory: true },
    });
  }

  /**
   * After an asset comes back: links the assignment to the in-progress offboarding's asset-return
   * step for its category (when not linked already) and completes every covering step that has
   * nothing left outstanding. Returns human-readable notes for the caller.
   */
  async syncAfterAssetReturn(input: {
    assignmentId: string;
    employeeId: string;
    assetCategory: AssetCategory;
    linkedTaskId: string | null;
    userId: string;
    tenantId: string;
  }): Promise<string[]> {
    const offboarding = await this.prisma.unscoped.employeeOffboarding.findFirst({
      where: { employeeId: input.employeeId, status: OffboardingStatus.in_progress },
      include: {
        tasks: {
          where: {
            taskType: OffboardingTaskType.asset_return,
            status: OffboardingTaskStatus.pending,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!offboarding) return [];

    const covering = offboarding.tasks.filter(
      (task) => task.assetCategory == null || task.assetCategory === input.assetCategory,
    );
    if (covering.length === 0) return [];

    if (!input.linkedTaskId) {
      const best =
        covering.find((task) => task.assetCategory === input.assetCategory) ?? covering[0];
      await this.prisma.unscoped.employeeAssetAssignment.update({
        where: { id: input.assignmentId },
        data: { offboardingTaskId: best.id },
      });
    }

    const notes: string[] = [];
    for (const task of covering) {
      const remaining = await this.prisma.unscoped.employeeAssetAssignment.count({
        where: {
          employeeId: input.employeeId,
          status: AssetAssignmentStatus.active,
          ...(task.assetCategory ? { asset: { category: task.assetCategory } } : {}),
        },
      });
      if (remaining > 0) continue;

      await this.prisma.unscoped.employeeOffboardingTask.update({
        where: { id: task.id },
        data: {
          status: OffboardingTaskStatus.completed,
          completedAt: new Date(),
          completedByUserId: input.userId,
        },
      });
      await this.auditService.log({
        tenantId: input.tenantId,
        userId: input.userId,
        action: 'update',
        module: 'employee',
        recordId: offboarding.id,
        newValue: { taskId: task.id, change: 'completed', returnedAssignmentId: input.assignmentId },
      });
      notes.push(`Offboarding step "${task.title}" completed`);
    }

    if (notes.length > 0) {
      await this.refreshOffboardingCompletion(offboarding.id);
    }
    return notes;
  }

  /** Completes an in-progress offboarding once every required step (or every step, when none are required) is done or skipped. */
  async refreshOffboardingCompletion(offboardingId: string): Promise<void> {
    const offboarding = await this.prisma.unscoped.employeeOffboarding.findUnique({
      where: { id: offboardingId },
      include: { tasks: { select: { status: true, isRequired: true } } },
    });
    if (!offboarding || offboarding.status !== OffboardingStatus.in_progress) {
      return;
    }

    const required = offboarding.tasks.filter((task) => task.isRequired);
    const basis = required.length > 0 ? required : offboarding.tasks;
    const allComplete =
      basis.length > 0 &&
      basis.every(
        (task) =>
          task.status === OffboardingTaskStatus.completed ||
          task.status === OffboardingTaskStatus.skipped,
      );
    if (!allComplete) {
      return;
    }

    await this.prisma.unscoped.employeeOffboarding.update({
      where: { id: offboardingId },
      data: { status: OffboardingStatus.completed, completedAt: new Date() },
    });
  }

  /** A completed offboarding with a pending required step goes back to in progress. */
  async reopenOffboardingIfIncomplete(offboardingId: string): Promise<void> {
    const offboarding = await this.prisma.unscoped.employeeOffboarding.findUnique({
      where: { id: offboardingId },
      include: { tasks: { select: { status: true, isRequired: true } } },
    });
    if (!offboarding || offboarding.status !== OffboardingStatus.completed) {
      return;
    }
    const required = offboarding.tasks.filter((task) => task.isRequired);
    const basis = required.length > 0 ? required : offboarding.tasks;
    if (basis.some((task) => task.status === OffboardingTaskStatus.pending)) {
      await this.prisma.unscoped.employeeOffboarding.update({
        where: { id: offboardingId },
        data: { status: OffboardingStatus.in_progress, completedAt: null },
      });
    }
  }
}
