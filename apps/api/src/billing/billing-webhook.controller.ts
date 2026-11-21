import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SkipTenantScope } from '../common/decorators/skip-tenant-scope.decorator';
import { PrismaService } from '../database/prisma.service';
import { DunningService } from './dunning.service';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from './payment-provider/payment-provider.interface';

@ApiTags('billing-webhooks')
@SkipTenantScope()
@Controller('billing/webhooks')
export class BillingWebhookController {
  private readonly logger = new Logger(BillingWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dunningService: DunningService,
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: PaymentProvider,
  ) {}

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stripe webhook receiver with signature verification and idempotent handling',
  })
  async handleStripeWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!signature) {
      throw new BadRequestException({
        code: 'MISSING_SIGNATURE',
        message: 'Missing required stripe-signature header',
      });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';

    // Extract raw body
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    // Verify signature & parse event
    const event = this.paymentProvider.constructWebhookEvent(
      rawBody,
      signature,
      webhookSecret,
    );

    this.logger.log(`Received Stripe webhook event: ${event.id} (${event.type})`);

    // IDEMPOTENCY CHECK:
    // Check if event has already been recorded and processed
    const existingEvent = await this.prisma.unscoped.paymentEvent.findUnique({
      where: { eventId: event.id },
    });

    if (existingEvent && existingEvent.processed) {
      this.logger.log(`Event ${event.id} has already been processed idempotently. Skipping.`);
      return { received: true, idempotent: true };
    }

    // Record incoming event
    const recordedEvent = existingEvent
      ? existingEvent
      : await this.prisma.unscoped.paymentEvent.create({
          data: {
            provider: 'stripe',
            eventId: event.id,
            eventType: event.type,
            payload: event.data as any,
            processed: false,
          },
        });

    try {
      await this.processWebhookEvent(event);

      // Mark event as processed
      await this.prisma.unscoped.paymentEvent.update({
        where: { id: recordedEvent.id },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });

      return { received: true, status: 'processed' };
    } catch (err: any) {
      this.logger.error(`Error processing webhook event ${event.id}: ${err.message}`, err.stack);
      // Return 200 to gateway so it doesn't storm retries if application error is non-retryable
      return { received: true, status: 'error', error: err.message };
    }
  }

  private async processWebhookEvent(event: { id: string; type: string; data: any }): Promise<void> {
    const object = event.data?.object;
    if (!object) return;

    switch (event.type) {
      case 'invoice.payment_succeeded':
      case 'payment_intent.succeeded': {
        const metadata = object.metadata ?? {};
        const tenantId = metadata.tenantId;
        const customerId = object.customer;

        // Find invoice or subscription
        const subscription = await this.prisma.unscoped.subscription.findFirst({
          where: {
            OR: [
              ...(customerId ? [{ customerId }] : []),
              ...(tenantId ? [{ tenantId }] : []),
            ],
          },
        });

        if (subscription) {
          await this.dunningService.handlePaymentSuccess(subscription.id);
        }
        break;
      }

      case 'invoice.payment_failed':
      case 'payment_intent.payment_failed': {
        const metadata = object.metadata ?? {};
        const tenantId = metadata.tenantId;
        const customerId = object.customer;

        const subscription = await this.prisma.unscoped.subscription.findFirst({
          where: {
            OR: [
              ...(customerId ? [{ customerId }] : []),
              ...(tenantId ? [{ tenantId }] : []),
            ],
          },
          include: {
            invoices: {
              where: { status: 'open' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });

        if (subscription && subscription.invoices[0]) {
          await this.dunningService.handlePaymentFailure(
            subscription.invoices[0].id,
            object.last_payment_error?.message ?? 'Payment intent failed via webhook notification',
          );
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const customerId = object.customer;
        if (customerId) {
          await this.prisma.unscoped.subscription.updateMany({
            where: { customerId },
            data: {
              status: 'cancelled',
              canceledAt: new Date(),
            },
          });
        }
        break;
      }

      default:
        this.logger.debug(`Unhandled event type: ${event.type}`);
    }
  }
}
