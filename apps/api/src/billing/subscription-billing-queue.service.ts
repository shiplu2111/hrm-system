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
import { BillingInvoicingService } from './billing-invoicing.service';
import { DunningService } from './dunning.service';

export const SUBSCRIPTION_BILLING_QUEUE = 'subscription-billing';

export type SubscriptionBillingJobType =
  | 'process-cycle-billing'
  | 'process-dunning-retries'
  | 'bill-single-subscription';

export interface SubscriptionBillingJobPayload {
  jobType: SubscriptionBillingJobType;
  subscriptionId?: string;
  triggerSource?: string;
}

@Injectable()
export class SubscriptionBillingQueueService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SubscriptionBillingQueueService.name);
  private queue: Queue<SubscriptionBillingJobPayload> | null = null;
  private worker: Worker<SubscriptionBillingJobPayload> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicingService: BillingInvoicingService,
    private readonly dunningService: DunningService,
  ) {}

  onModuleInit(): void {
    if (!isRedisConfigured()) {
      this.logger.debug(
        'REDIS_URL not configured — subscription billing queue running in synchronous fallback mode',
      );
      return;
    }

    try {
      const connection = getRedisConnection();
      this.queue = new Queue<SubscriptionBillingJobPayload>(
        SUBSCRIPTION_BILLING_QUEUE,
        {
          connection,
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 3000 },
            removeOnComplete: 100,
            removeOnFail: 200,
          },
        },
      );

      this.worker = new Worker<SubscriptionBillingJobPayload>(
        SUBSCRIPTION_BILLING_QUEUE,
        async (job) => this.processJob(job),
        {
          connection,
          concurrency: 2,
        },
      );

      this.worker.on('completed', (job) => {
        this.logger.log(
          `Subscription billing job ${job.id} (${job.data.jobType}) completed`,
        );
      });

      this.worker.on('failed', (job, err) => {
        this.logger.error(
          `Subscription billing job ${job?.id} (${job?.data.jobType}) failed: ${err.message}`,
        );
      });
    } catch (err: any) {
      this.logger.warn(
        `Could not initialize BullMQ subscription-billing queue: ${err.message}. Using fallback.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  /**
   * Queue a billing job or execute synchronously if queue is unavailable.
   */
  async dispatchJob(payload: SubscriptionBillingJobPayload) {
    if (this.queue) {
      const job = await this.queue.add(payload.jobType, payload);
      return { queued: true, jobId: job.id };
    }

    // Direct synchronous fallback
    this.logger.log(`Running billing job '${payload.jobType}' synchronously (queue offline)`);
    await this.executeJobLogic(payload);
    return { queued: false, executed: true };
  }

  private async processJob(job: Job<SubscriptionBillingJobPayload>): Promise<void> {
    this.logger.log(`Processing subscription billing job ${job.id}: ${job.data.jobType}`);
    await this.executeJobLogic(job.data);
  }

  private async executeJobLogic(payload: SubscriptionBillingJobPayload): Promise<void> {
    switch (payload.jobType) {
      case 'process-cycle-billing':
        await this.processCycleBilling();
        break;
      case 'process-dunning-retries':
        await this.processDunningRetries();
        break;
      case 'bill-single-subscription':
        if (payload.subscriptionId) {
          await this.billSingleSubscription(payload.subscriptionId);
        }
        break;
      default:
        this.logger.warn(`Unknown billing job type: ${payload.jobType}`);
    }
  }

  /**
   * Scans all subscriptions due for monthly/annual billing cycle:
   * (status in ['active', 'trialing'], dunningStep == 0, and nextBillingAt <= now)
   */
  async processCycleBilling(): Promise<{ processed: number; succeeded: number; failed: number }> {
    const now = new Date();
    const dueSubscriptions = await this.prisma.unscoped.subscription.findMany({
      where: {
        status: { in: ['active', 'trialing'] },
        dunningStep: 0,
        nextBillingAt: { lte: now },
      },
      include: {
        tenant: true,
        plan: true,
      },
    });

    this.logger.log(`Found ${dueSubscriptions.length} subscriptions due for billing cycle processing.`);

    let succeeded = 0;
    let failed = 0;

    for (const sub of dueSubscriptions) {
      try {
        const res = await this.billSingleSubscription(sub.id);
        if (res.success) succeeded++;
        else failed++;
      } catch (err: any) {
        failed++;
        this.logger.error(`Failed cycle billing for subscription ${sub.id}: ${err.message}`);
      }
    }

    return { processed: dueSubscriptions.length, succeeded, failed };
  }

  /**
   * Bills a single subscription for its cycle:
   * 1. Counts active employees on the billing date.
   * 2. Calculates invoice amounts based on plan pricing model.
   * 3. Creates invoice & invoice lines.
   * 4. Attempts payment provider charge.
   * 5. Advances cycle if successful, or initiates dunning if failed.
   */
  async billSingleSubscription(subscriptionId: string) {
    const subscription = await this.prisma.unscoped.subscription.findUnique({
      where: { id: subscriptionId },
      include: { tenant: true, plan: true },
    });

    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    // 1. Generate Cycle Invoice
    const invoice = await this.invoicingService.generateCycleInvoice(subscription.id);

    // 2. Charge Payment Provider
    const chargeRes = await this.invoicingService.chargeInvoice(invoice.id);

    const now = new Date();
    const isMonthly = subscription.billingCycle === 'monthly';
    const nextCycleEnd = new Date(subscription.currentPeriodEnd);
    if (isMonthly) {
      nextCycleEnd.setMonth(nextCycleEnd.getMonth() + 1);
    } else {
      nextCycleEnd.setFullYear(nextCycleEnd.getFullYear() + 1);
    }

    if (chargeRes.success) {
      // Advance subscription cycle
      await this.prisma.unscoped.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'active',
          currentPeriodStart: subscription.currentPeriodEnd,
          currentPeriodEnd: nextCycleEnd,
          nextBillingAt: nextCycleEnd,
          dunningStep: 0,
          lastDunningAt: null,
        },
      });

      await this.dunningService.handlePaymentSuccess(subscription.id);
      return { success: true, invoiceId: invoice.id };
    } else {
      // Initiate dunning sequence
      await this.dunningService.handlePaymentFailure(
        invoice.id,
        chargeRes.chargeResult?.errorMessage ?? 'Card charge failed',
      );
      return { success: false, invoiceId: invoice.id, error: chargeRes.chargeResult?.errorMessage };
    }
  }

  /**
   * Scans all subscriptions in dunning with pending retries due:
   * (dunningStep between 1 and 4, and nextBillingAt <= now)
   */
  async processDunningRetries(): Promise<{ retried: number; resolved: number; failed: number }> {
    const now = new Date();
    const dunningSubs = await this.prisma.unscoped.subscription.findMany({
      where: {
        dunningStep: { in: [1, 2, 3, 4] },
        nextBillingAt: { lte: now },
      },
      include: {
        tenant: true,
        invoices: {
          where: { status: 'open' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    this.logger.log(`Found ${dunningSubs.length} subscriptions ready for automated dunning retry.`);

    let resolved = 0;
    let failed = 0;

    for (const sub of dunningSubs) {
      const openInvoice = sub.invoices[0];
      if (!openInvoice) {
        this.logger.warn(`Subscription ${sub.id} in dunning step ${sub.dunningStep} has no open invoice.`);
        continue;
      }

      try {
        const chargeRes = await this.invoicingService.chargeInvoice(
          openInvoice.id,
          `dunning_${sub.dunningStep}`,
        );

        if (chargeRes.success) {
          resolved++;
          await this.dunningService.handlePaymentSuccess(sub.id);
        } else {
          failed++;
          await this.dunningService.handlePaymentFailure(
            openInvoice.id,
            chargeRes.chargeResult?.errorMessage ?? 'Retry charge declined',
          );
        }
      } catch (err: any) {
        failed++;
        this.logger.error(`Error retrying payment for subscription ${sub.id}: ${err.message}`);
      }
    }

    return { retried: dunningSubs.length, resolved, failed };
  }
}
