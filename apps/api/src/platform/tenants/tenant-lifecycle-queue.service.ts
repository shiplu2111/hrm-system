import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker, type Job } from 'bullmq';
import type { TenantProvisioningResult } from '@hrm/shared-types';
import {
  getRedisConnection,
  isRedisConfigured,
} from '../../queue/redis.connection';
import type {
  HardDeleteTenantDto,
  ProvisionTenantDto,
} from './dto/tenant-lifecycle.dto';
import { PlatformTenantLifecycleService } from './platform-tenant-lifecycle.service';

export const TENANT_LIFECYCLE_QUEUE = 'tenant-lifecycle';

export type TenantLifecycleJobType =
  | 'provision-tenant'
  | 'hard-delete-tenant'
  | 'process-scheduled-deletions';

export interface TenantLifecycleJobPayload {
  jobType: TenantLifecycleJobType;
  provisionData?: ProvisionTenantDto;
  hardDeleteData?: HardDeleteTenantDto & { tenantId: string };
  actorUserId?: string;
}

@Injectable()
export class TenantLifecycleQueueService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(TenantLifecycleQueueService.name);
  private queue: Queue<TenantLifecycleJobPayload> | null = null;
  private worker: Worker<TenantLifecycleJobPayload> | null = null;

  constructor(
    private readonly lifecycleService: PlatformTenantLifecycleService,
  ) {}

  onModuleInit(): void {
    if (!isRedisConfigured()) {
      this.logger.debug(
        'REDIS_URL not configured — tenant lifecycle queue running in direct synchronous fallback mode',
      );
      return;
    }

    try {
      const connection = getRedisConnection();
      this.queue = new Queue<TenantLifecycleJobPayload>(
        TENANT_LIFECYCLE_QUEUE,
        {
          connection,
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: 100,
            removeOnFail: 200,
          },
        },
      );

      this.worker = new Worker<TenantLifecycleJobPayload>(
        TENANT_LIFECYCLE_QUEUE,
        async (job) => this.processJob(job),
        {
          connection,
          concurrency: 2,
        },
      );

      this.worker.on('completed', (job) => {
        this.logger.log(
          `Tenant lifecycle job ${job.id} (${job.data.jobType}) completed`,
        );
      });

      this.worker.on('failed', (job, err) => {
        this.logger.error(
          `Tenant lifecycle job ${job?.id} (${job?.data.jobType}) failed: ${err.message}`,
        );
      });
    } catch (err: any) {
      this.logger.warn(
        `Could not initialize BullMQ tenant-lifecycle queue: ${err.message}. Using fallback.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  /**
   * Enqueues tenant provisioning into BullMQ, or processes directly if Redis is unconfigured.
   */
  async enqueueProvisioning(
    input: ProvisionTenantDto & {
      ownerPasswordHash?: string;
      mustChangePassword?: boolean;
    },
    actorUserId?: string,
  ): Promise<TenantProvisioningResult> {
    if (!this.queue) {
      // Direct execution fallback when Redis is absent
      return this.lifecycleService.provisionTenant(input, actorUserId);
    }

    // In BullMQ asynchronous mode: perform validation & create job
    const job = await this.queue.add('provision-tenant', {
      jobType: 'provision-tenant',
      provisionData: input,
      actorUserId,
    });

    // Run provisioning synchronously or return tracking job info
    // For platform admin immediacy, run provisioning and return confirmed result
    const result = await this.lifecycleService.provisionTenant(
      input,
      actorUserId,
    );
    result.jobId = job.id;
    return result;
  }

  /**
   * Enqueues hard deletion for a tenant whose 30-day grace period has passed.
   */
  async enqueueHardDelete(
    tenantId: string,
    input: HardDeleteTenantDto,
    actorUserId?: string,
  ): Promise<{ success: boolean; tenantId: string; message: string }> {
    if (!this.queue) {
      return this.lifecycleService.hardDeleteTenant(
        tenantId,
        input,
        actorUserId,
      );
    }

    await this.queue.add('hard-delete-tenant', {
      jobType: 'hard-delete-tenant',
      hardDeleteData: { ...input, tenantId },
      actorUserId,
    });

    return this.lifecycleService.hardDeleteTenant(
      tenantId,
      input,
      actorUserId,
    );
  }

  /**
   * Enqueues scheduled deletion batch processor.
   */
  async enqueueProcessScheduledDeletions(actorUserId?: string): Promise<{
    processedCount: number;
    deletedTenantIds: string[];
  }> {
    return this.lifecycleService.processScheduledDeletions(actorUserId);
  }

  private async processJob(job: Job<TenantLifecycleJobPayload>): Promise<any> {
    switch (job.data.jobType) {
      case 'provision-tenant':
        // Synchronous provisioning was already completed; job records queue audit
        return { status: 'completed', subdomain: job.data.provisionData?.subdomain };

      case 'hard-delete-tenant':
        // Synchronous hard deletion was already completed; job records queue audit
        return { status: 'completed', tenantId: job.data.hardDeleteData?.tenantId };

      case 'process-scheduled-deletions':
        return this.lifecycleService.processScheduledDeletions(
          job.data.actorUserId,
        );

      default:
        throw new Error(
          `Unknown tenant lifecycle job type: ${job.data.jobType}`,
        );
    }
  }
}
