import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  AccountingConnectionStatus,
  AccountingProvider,
  AccountingSyncJobStatus,
  PayrollJournalExportStatus,
} from '@prisma/client';
import type { PayrollJournalPreview } from '@hrm/shared-types';
import { Queue, Worker, type Job } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { getRedisConnection, isRedisConfigured } from '../queue/redis.connection';
import { AccountingConnectionService } from './accounting-connection.service';
import { AccountingService } from './accounting.service';
import { AccountingGlProviderFactory } from './providers/accounting-gl-provider.factory';

export const ACCOUNTING_SYNC_QUEUE = 'accounting-sync';

export interface AccountingSyncJobPayload {
  syncJobId: string;
  companyId: string;
  tenantId: string;
  payrollPeriodId: string;
  provider: AccountingProvider;
  triggeredByUserId?: string;
}

@Injectable()
export class AccountingSyncQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountingSyncQueueService.name);
  private queue: Queue<AccountingSyncJobPayload> | null = null;
  private worker: Worker<AccountingSyncJobPayload> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService,
    private readonly connectionService: AccountingConnectionService,
    private readonly providerFactory: AccountingGlProviderFactory,
  ) {}

  onModuleInit(): void {
    if (!isRedisConfigured()) {
      this.logger.warn(
        'REDIS_URL not set — accounting sync queue disabled (CSV export still works)',
      );
      return;
    }

    const connection = getRedisConnection();
    this.queue = new Queue<AccountingSyncJobPayload>(ACCOUNTING_SYNC_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });

    this.worker = new Worker<AccountingSyncJobPayload>(
      ACCOUNTING_SYNC_QUEUE,
      async (job) => this.processJob(job),
      { connection, concurrency: 2 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Accounting sync job ${job?.id} failed: ${err.message}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  /** Fire-and-forget enqueue after payroll finalization — never throws to caller. */
  async enqueuePeriodSync(input: {
    companyId: string;
    tenantId: string;
    payrollPeriodId: string;
    triggeredByUserId?: string;
  }): Promise<void> {
    try {
      if (!this.queue) {
        return;
      }

      const connection = await this.prisma.unscoped.accountingConnection.findFirst({
        where: {
          companyId: input.companyId,
          provider: AccountingProvider.xero,
          status: AccountingConnectionStatus.connected,
        },
      });

      if (!connection) {
        return;
      }

      const syncJob = await this.prisma.unscoped.accountingSyncJob.create({
        data: {
          tenantId: input.tenantId,
          companyId: input.companyId,
          payrollPeriodId: input.payrollPeriodId,
          provider: AccountingProvider.xero,
          accountingConnectionId: connection.id,
          status: AccountingSyncJobStatus.queued,
        },
      });

      const bullJobId = `accounting-sync:${input.companyId}:${input.payrollPeriodId}:xero`;
      const job = await this.queue.add(
        'sync-period-journal',
        {
          syncJobId: syncJob.id,
          companyId: input.companyId,
          tenantId: input.tenantId,
          payrollPeriodId: input.payrollPeriodId,
          provider: AccountingProvider.xero,
          triggeredByUserId: input.triggeredByUserId,
        },
        { jobId: bullJobId },
      );

      await this.prisma.unscoped.accountingSyncJob.update({
        where: { id: syncJob.id },
        data: { bullJobId: job.id ?? bullJobId },
      });
    } catch (error) {
      this.logger.error(
        `Failed to enqueue accounting sync for period ${input.payrollPeriodId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async retrySyncJob(syncJobId: string): Promise<void> {
    if (!this.queue) {
      throw new Error('Accounting sync queue is not available');
    }

    const syncJob = await this.prisma.unscoped.accountingSyncJob.findUniqueOrThrow({
      where: { id: syncJobId },
    });

    await this.queue.add(
      'sync-period-journal',
      {
        syncJobId: syncJob.id,
        companyId: syncJob.companyId,
        tenantId: syncJob.tenantId,
        payrollPeriodId: syncJob.payrollPeriodId,
        provider: syncJob.provider,
      },
      {
        jobId: `accounting-sync-retry:${syncJobId}:${Date.now()}`,
      },
    );

    await this.prisma.unscoped.accountingSyncJob.update({
      where: { id: syncJobId },
      data: {
        status: AccountingSyncJobStatus.queued,
        errorMessage: null,
        failedAt: null,
        queuedAt: new Date(),
      },
    });
  }

  private async processJob(job: Job<AccountingSyncJobPayload>): Promise<void> {
    const { syncJobId, companyId, payrollPeriodId, provider, triggeredByUserId } =
      job.data;

    await this.prisma.unscoped.accountingSyncJob.update({
      where: { id: syncJobId },
      data: {
        status: AccountingSyncJobStatus.processing,
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    const connection = await this.prisma.unscoped.accountingConnection.findFirst({
      where: {
        companyId,
        provider,
        status: AccountingConnectionStatus.connected,
      },
    });

    if (!connection?.externalTenantId) {
      await this.failJob(syncJobId, connection?.id ?? null, 'Xero is not connected');
      return;
    }

    try {
      let exportId: string | undefined;

      const exportResult = await this.accountingService.exportJournalForPeriod(
        companyId,
        payrollPeriodId,
        undefined,
        provider,
        triggeredByUserId,
      );
      exportId = exportResult.id;

      await this.prisma.unscoped.accountingSyncJob.update({
        where: { id: syncJobId },
        data: { payrollJournalExportId: exportId },
      });

      const journal = exportResult.journal;
      const validationError = this.validateJournal(journal);
      if (validationError) {
        await this.failJob(syncJobId, connection.id, validationError, exportId);
        return;
      }

      const accessToken = await this.connectionService.resolveAccessToken(connection);
      const glProvider = this.providerFactory.resolve(provider);
      const pushResult = await glProvider.pushManualJournal({
        accessToken,
        externalTenantId: connection.externalTenantId,
        journal,
        referenceNumber: exportResult.referenceNumber,
      });

      await this.prisma.unscoped.$transaction(async (tx) => {
        await tx.payrollJournalExport.update({
          where: { id: exportResult.id },
          data: {
            status: PayrollJournalExportStatus.completed,
            externalReferenceId: pushResult.externalJournalId,
            exportedAt: new Date(),
            errorMessage: null,
          },
        });

        await tx.accountingSyncJob.update({
          where: { id: syncJobId },
          data: {
            status: AccountingSyncJobStatus.completed,
            payrollJournalExportId: exportResult.id,
            externalJournalId: pushResult.externalJournalId,
            completedAt: new Date(),
            errorMessage: null,
            failedAt: null,
          },
        });

        await tx.accountingConnection.update({
          where: { id: connection.id },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: AccountingSyncJobStatus.completed,
            lastSyncError: null,
            status: AccountingConnectionStatus.connected,
          },
        });
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Accounting sync failed unexpectedly';

      const syncJob = await this.prisma.unscoped.accountingSyncJob.findUnique({
        where: { id: syncJobId },
        select: { payrollJournalExportId: true },
      });
      const exportId = syncJob?.payrollJournalExportId;
      if (exportId) {
        await this.prisma.unscoped.payrollJournalExport.update({
          where: { id: exportId },
          data: {
            status: PayrollJournalExportStatus.failed,
            errorMessage: message,
          },
        });
      }

      await this.failJob(syncJobId, connection.id, message);
      throw error;
    }
  }

  private validateJournal(journal: PayrollJournalPreview): string | null {
    if (journal.runCount === 0) {
      return 'No finalized or paid payroll runs found for this period';
    }
    if (journal.unmapped.length > 0) {
      return `${journal.unmapped.length} payroll component(s) are not mapped to GL accounts`;
    }
    if (!journal.balanced) {
      return 'Journal debits and credits do not balance';
    }
    return null;
  }

  private async failJob(
    syncJobId: string,
    connectionId: string | null,
    message: string,
    exportId?: string,
  ): Promise<void> {
    await this.prisma.unscoped.$transaction(async (tx) => {
      await tx.accountingSyncJob.update({
        where: { id: syncJobId },
        data: {
          status: AccountingSyncJobStatus.failed,
          errorMessage: message,
          failedAt: new Date(),
          ...(exportId ? { payrollJournalExportId: exportId } : {}),
        },
      });

      if (connectionId) {
        await tx.accountingConnection.update({
          where: { id: connectionId },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: AccountingSyncJobStatus.failed,
            lastSyncError: message,
            status: AccountingConnectionStatus.error,
          },
        });
      }
    });
  }
}
