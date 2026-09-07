import { Injectable, Logger } from '@nestjs/common';
import { OnboardingTaskStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class OnboardingTaskSyncService {
  private readonly logger = new Logger(OnboardingTaskSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

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
