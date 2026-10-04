import { Injectable, Logger } from '@nestjs/common';
import { AssetStatus, OnboardingTaskStatus, OnboardingTaskType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class OnboardingTaskSyncService {
  private readonly logger = new Logger(OnboardingTaskSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** The pending provisioning task an assignment may be linked to, when it belongs to this employee's in-progress onboarding. */
  async findLinkableProvisioningTask(employeeId: string, taskId: string) {
    return this.prisma.unscoped.employeeOnboardingTask.findFirst({
      where: {
        id: taskId,
        status: OnboardingTaskStatus.pending,
        taskType: OnboardingTaskType.provisioning,
        onboarding: { employeeId, status: 'in_progress' },
      },
      select: { id: true, assetCategory: true },
    });
  }

  /** Completes the matching provisioning step; returns notes describing what changed. */
  async syncAfterAssetAssignment(input: {
    employeeId: string;
    assetId: string;
    assetCategory: string;
    assignmentId?: string;
    onboardingTaskId?: string | null;
  }): Promise<string[]> {
    if (input.onboardingTaskId) {
      const task = await this.prisma.unscoped.employeeOnboardingTask.findFirst({
        where: {
          id: input.onboardingTaskId,
          status: OnboardingTaskStatus.pending,
          taskType: OnboardingTaskType.provisioning,
          onboarding: {
            employeeId: input.employeeId,
            status: 'in_progress',
          },
        },
        select: { id: true, onboardingId: true, assetCategory: true, title: true },
      });

      if (!task) {
        return [];
      }

      if (task.assetCategory && task.assetCategory !== input.assetCategory) {
        return [];
      }

      await this.completeProvisioningTask(task.id, task.onboardingId, input.assetId);
      return [`Onboarding step "${task.title}" completed`];
    }

    const tasks = await this.prisma.unscoped.employeeOnboardingTask.findMany({
      where: {
        status: OnboardingTaskStatus.pending,
        taskType: OnboardingTaskType.provisioning,
        onboarding: {
          employeeId: input.employeeId,
          status: 'in_progress',
        },
        OR: [
          { assetCategory: input.assetCategory as never },
          { assetCategory: null },
        ],
      },
      select: { id: true, onboardingId: true, assetCategory: true, title: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const task =
      tasks.find((row) => row.assetCategory === input.assetCategory) ?? tasks[0];
    if (!task) return [];
    if (input.assignmentId) {
      await this.prisma.unscoped.employeeAssetAssignment.updateMany({
        where: { id: input.assignmentId, onboardingTaskId: null },
        data: { onboardingTaskId: task.id },
      });
    }
    await this.completeProvisioningTask(task.id, task.onboardingId, input.assetId);
    return [`Onboarding step "${task.title}" completed`];
  }

  /**
   * A returned asset no longer satisfies the provisioning step it completed: in-progress
   * onboardings put that step back to pending.
   */
  async syncAfterAssetReturn(input: { employeeId: string; assetId: string }): Promise<string[]> {
    const tasks = await this.prisma.unscoped.employeeOnboardingTask.findMany({
      where: {
        companyAssetId: input.assetId,
        status: OnboardingTaskStatus.completed,
        taskType: OnboardingTaskType.provisioning,
        onboarding: { employeeId: input.employeeId, status: 'in_progress' },
      },
      select: { id: true, title: true },
    });
    if (tasks.length === 0) return [];

    await this.prisma.unscoped.employeeOnboardingTask.updateMany({
      where: { id: { in: tasks.map((task) => task.id) } },
      data: {
        status: OnboardingTaskStatus.pending,
        completedAt: null,
        completedByUserId: null,
        companyAssetId: null,
      },
    });
    return tasks.map((task) => `Onboarding step "${task.title}" reopened`);
  }

  private async completeProvisioningTask(
    taskId: string,
    onboardingId: string,
    assetId: string,
  ): Promise<void> {
    await this.prisma.unscoped.employeeOnboardingTask.update({
      where: { id: taskId },
      data: {
        status: OnboardingTaskStatus.completed,
        completedAt: new Date(),
        companyAssetId: assetId,
      },
    });

    await this.refreshOnboardingCompletion(onboardingId);
  }

  async countAvailableAssetsForTask(
    companyId: string,
    assetCategory: string | null,
  ): Promise<number> {
    if (!assetCategory) {
      return 0;
    }

    return this.prisma.unscoped.companyAsset.count({
      where: {
        companyId,
        status: AssetStatus.available,
        category: assetCategory as never,
      },
    });
  }

  async syncAfterDocumentChange(
    employeeId: string,
    documentId: string,
  ): Promise<void> {
    const document = await this.prisma.unscoped.employeeDocument.findUnique({
      where: { id: documentId },
      include: {
        documentType: {
          select: { id: true, requiresVerification: true },
        },
      },
    });

    if (!document || document.employeeId !== employeeId) {
      return;
    }

    const tasks = await this.prisma.unscoped.employeeOnboardingTask.findMany({
      where: {
        status: OnboardingTaskStatus.pending,
        documentTypeId: document.documentTypeId,
        onboarding: {
          employeeId,
          status: 'in_progress',
        },
        taskType: { in: ['document_collection', 'policy_acceptance'] },
      },
      select: { id: true, onboardingId: true, taskType: true },
    });

    if (tasks.length === 0) {
      return;
    }

    const isVerified = document.verifiedAt != null;
    const hasFile = document.fileKey != null;
    const requiresVerification = document.documentType.requiresVerification;

    for (const task of tasks) {
      const shouldComplete =
        task.taskType === 'document_collection'
          ? requiresVerification
            ? isVerified
            : hasFile
          : isVerified || (hasFile && !requiresVerification);

      await this.prisma.unscoped.employeeOnboardingTask.update({
        where: { id: task.id },
        data: {
          employeeDocumentId: document.id,
          ...(shouldComplete
            ? {
                status: OnboardingTaskStatus.completed,
                completedAt: new Date(),
              }
            : {}),
        },
      });

      if (shouldComplete) {
        await this.refreshOnboardingCompletion(task.onboardingId);
      }
    }
  }

  /**
   * Links documents the employee already has (e.g. uploaded before onboarding started)
   * to the new checklist, completing tasks they already satisfy.
   */
  async linkExistingDocuments(onboardingId: string): Promise<void> {
    const onboarding = await this.prisma.unscoped.employeeOnboarding.findUnique({
      where: { id: onboardingId },
      select: {
        employeeId: true,
        tasks: {
          where: { status: OnboardingTaskStatus.pending, documentTypeId: { not: null } },
          select: { documentTypeId: true },
        },
      },
    });
    if (!onboarding) return;

    const typeIds = [
      ...new Set(onboarding.tasks.map((task) => task.documentTypeId as string)),
    ];
    if (typeIds.length === 0) return;

    const documents = await this.prisma.unscoped.employeeDocument.findMany({
      where: { employeeId: onboarding.employeeId, documentTypeId: { in: typeIds } },
      select: { id: true, documentTypeId: true, verifiedAt: true, fileKey: true, createdAt: true },
    });

    for (const typeId of typeIds) {
      const best = documents
        .filter((doc) => doc.documentTypeId === typeId)
        .sort(
          (a, b) =>
            Number(b.verifiedAt != null) - Number(a.verifiedAt != null) ||
            Number(b.fileKey != null) - Number(a.fileKey != null) ||
            b.createdAt.getTime() - a.createdAt.getTime(),
        )[0];
      if (best) {
        await this.syncAfterDocumentChange(onboarding.employeeId, best.id);
      }
    }
  }

  /**
   * Called before an employee document is deleted: tasks of in-progress onboardings that
   * were satisfied by it go back to pending, since the evidence is gone.
   */
  async syncBeforeDocumentDelete(documentId: string): Promise<void> {
    const tasks = await this.prisma.unscoped.employeeOnboardingTask.findMany({
      where: {
        employeeDocumentId: documentId,
        status: OnboardingTaskStatus.completed,
        policyAcceptedAt: null,
        onboarding: { status: 'in_progress' },
      },
      select: { id: true },
    });
    if (tasks.length === 0) return;

    await this.prisma.unscoped.employeeOnboardingTask.updateMany({
      where: { id: { in: tasks.map((task) => task.id) } },
      data: {
        status: OnboardingTaskStatus.pending,
        completedAt: null,
        completedByUserId: null,
      },
    });
  }

  /** A completed onboarding whose required tasks are no longer all done goes back to in progress. */
  async reopenOnboardingIfIncomplete(onboardingId: string): Promise<void> {
    const onboarding = await this.prisma.unscoped.employeeOnboarding.findUnique({
      where: { id: onboardingId },
      include: {
        tasks: { where: { isRequired: true }, select: { status: true } },
      },
    });
    if (!onboarding || onboarding.status !== 'completed') return;

    const allDone = onboarding.tasks.every(
      (task) =>
        task.status === OnboardingTaskStatus.completed ||
        task.status === OnboardingTaskStatus.skipped,
    );
    if (allDone) return;

    await this.prisma.unscoped.employeeOnboarding.update({
      where: { id: onboardingId },
      data: { status: 'in_progress', completedAt: null },
    });
  }

  async refreshOnboardingCompletion(onboardingId: string): Promise<void> {
    const onboarding = await this.prisma.unscoped.employeeOnboarding.findUnique({
      where: { id: onboardingId },
      include: {
        tasks: {
          where: { isRequired: true },
          select: { status: true },
        },
      },
    });

    if (!onboarding || onboarding.status !== 'in_progress') {
      return;
    }

    const allComplete = onboarding.tasks.every(
      (task) =>
        task.status === OnboardingTaskStatus.completed ||
        task.status === OnboardingTaskStatus.skipped,
    );

    if (!allComplete) {
      return;
    }

    await this.prisma.unscoped.employeeOnboarding.update({
      where: { id: onboardingId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });
  }
}
