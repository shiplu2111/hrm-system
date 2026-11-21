import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker, type Job } from 'bullmq';
import {
  getRedisConnection,
  isRedisConfigured,
} from '../queue/redis.connection';
import { PrismaService } from '../database/prisma.service';
import { CustomDomainService } from './custom-domain.service';

export const CUSTOM_DOMAIN_QUEUE = 'custom-domain-verification';

export type CustomDomainJobType =
  | 'verify-domain'
  | 'batch-verify-pending'
  | 'check-certificate-renewal';

export interface CustomDomainJobPayload {
  jobType: CustomDomainJobType;
  tenantId?: string;
  domainId?: string;
}

@Injectable()
export class CustomDomainQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CustomDomainQueueService.name);
  private queue: Queue<CustomDomainJobPayload> | null = null;
  private worker: Worker<CustomDomainJobPayload> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly domainService: CustomDomainService,
  ) {}

  onModuleInit(): void {
    if (!isRedisConfigured()) {
      this.logger.debug(
        'REDIS_URL not configured — custom domain queue running in synchronous fallback mode',
      );
      return;
    }

    try {
      const connection = getRedisConnection();
      this.queue = new Queue<CustomDomainJobPayload>(CUSTOM_DOMAIN_QUEUE, {
        connection,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      });

      this.worker = new Worker<CustomDomainJobPayload>(
        CUSTOM_DOMAIN_QUEUE,
        async (job: Job<CustomDomainJobPayload>) => {
          await this.processJob(job.data);
        },
        { connection, concurrency: 3 },
      );

      this.worker.on('failed', (job, err) => {
        this.logger.warn(
          `Custom domain job '${job?.name}' (ID: ${job?.id}) failed: ${err.message}`,
        );
      });

      this.logger.log('Custom domain verification queue initialized with Redis');
    } catch (err: any) {
      this.logger.error(
        `Failed to initialize custom domain verification queue: ${err.message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
  }

  /**
   * Enqueues or immediately processes a domain verification job.
   */
  async enqueueDomainVerification(tenantId: string, domainId: string): Promise<void> {
    if (this.queue) {
      await this.queue.add('verify-domain', {
        jobType: 'verify-domain',
        tenantId,
        domainId,
      });
    } else {
      // Synchronous fallback
      await this.processJob({
        jobType: 'verify-domain',
        tenantId,
        domainId,
      }).catch((err) =>
        this.logger.warn(`Synchronous domain verification failed: ${err.message}`),
      );
    }
  }

  /**
   * Processes a job payload.
   */
  async processJob(payload: CustomDomainJobPayload): Promise<void> {
    switch (payload.jobType) {
      case 'verify-domain': {
        if (payload.tenantId && payload.domainId) {
          await this.domainService.verifyCustomDomain(
            payload.tenantId,
            payload.domainId,
          );
        }
        break;
      }
      case 'batch-verify-pending': {
        const pending = await (this.prisma.unscoped as any).tenantCustomDomain.findMany({
          where: {
            status: { in: ['pending_verification', 'provisioning_tls'] },
          },
          take: 20,
        });
        for (const dom of pending) {
          try {
            await this.domainService.verifyCustomDomain(dom.tenantId, dom.id);
          } catch (err: any) {
            this.logger.debug(
              `Batch verification for domain '${dom.domain}' error: ${err.message}`,
            );
          }
        }
        break;
      }
      case 'check-certificate-renewal': {
        const fifteenDaysFuture = new Date(Date.now() + 15 * 86400000);
        const expiring = await (this.prisma.unscoped as any).tenantCustomDomain.findMany({
          where: {
            status: 'active',
            sslStatus: 'active',
            sslExpiresAt: { lte: fifteenDaysFuture },
          },
          take: 10,
        });
        for (const dom of expiring) {
          try {
            await this.domainService.verifyCustomDomain(dom.tenantId, dom.id);
          } catch (err: any) {
            this.logger.warn(
              `Automated renewal for domain '${dom.domain}' failed: ${err.message}`,
            );
          }
        }
        break;
      }
    }
  }
}
