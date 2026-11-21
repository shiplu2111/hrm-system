import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import crypto from 'node:crypto';
import Stripe from 'stripe';
import type {
  ChargeInput,
  ChargeResult,
  CreateCustomerInput,
  CustomerResult,
  PaymentProvider,
  WebhookEventPayload,
} from './payment-provider.interface';

@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(StripePaymentProvider.name);
  private stripe: Stripe | null = null;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (secretKey) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-02-24.acacia' as any,
      });
      this.logger.log('Stripe client initialized with configured STRIPE_SECRET_KEY');
    } else {
      this.logger.warn(
        'STRIPE_SECRET_KEY not set. Running in deterministic mock/sandbox payment mode.',
      );
    }
  }

  async createCustomer(input: CreateCustomerInput): Promise<CustomerResult> {
    if (!this.stripe) {
      const mockCustomerId = `cus_mock_${input.tenantId.replace(/-/g, '').slice(0, 16)}`;
      this.logger.debug(
        `[Mock Payment] Created customer ${mockCustomerId} for tenant ${input.tenantId}`,
      );
      return {
        customerId: mockCustomerId,
        defaultPaymentMethodId: input.paymentMethodId ?? 'pm_mock_card_visa',
      };
    }

    try {
      const customer = await this.stripe.customers.create({
        email: input.email,
        name: input.name,
        payment_method: input.paymentMethodId,
        invoice_settings: input.paymentMethodId
          ? { default_payment_method: input.paymentMethodId }
          : undefined,
        metadata: {
          tenantId: input.tenantId,
          ...(input.metadata ?? {}),
        },
      });

      return {
        customerId: customer.id,
        defaultPaymentMethodId:
          typeof customer.invoice_settings?.default_payment_method === 'string'
            ? customer.invoice_settings.default_payment_method
            : undefined,
      };
    } catch (err: any) {
      this.logger.error(`Stripe customer creation error: ${err.message}`, err.stack);
      throw new BadRequestException({
        code: 'PAYMENT_CUSTOMER_FAILED',
        message: `Failed to register customer in payment gateway: ${err.message}`,
      });
    }
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    // Money as integer minor units for gateway transmission (e.g. 49.00 USD -> 4900 cents)
    const amountMinor = Math.round(input.amount * 100);

    if (!this.stripe) {
      // Deterministic mock behavior: if customerId starts with 'cus_fail_', simulate failure
      if (input.customerId?.includes('fail') || input.paymentMethodId?.includes('fail')) {
        return {
          success: false,
          status: 'failed',
          amount: input.amount,
          currency: input.currency.toUpperCase(),
          errorCode: 'card_declined',
          errorMessage: 'The card was declined by the issuer (simulated test decline).',
        };
      }

      const mockPaymentId = `pi_mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      this.logger.debug(
        `[Mock Payment] Charged ${input.amount} ${input.currency} (Idempotency: ${input.idempotencyKey}) -> ${mockPaymentId}`,
      );
      return {
        success: true,
        status: 'succeeded',
        providerPaymentId: mockPaymentId,
        amount: input.amount,
        currency: input.currency.toUpperCase(),
      };
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create(
        {
          amount: amountMinor,
          currency: input.currency.toLowerCase(),
          customer: input.customerId ?? undefined,
          payment_method: input.paymentMethodId ?? undefined,
          off_session: true,
          confirm: true,
          description: input.description,
          metadata: {
            tenantId: input.tenantId,
            ...(input.metadata ?? {}),
          },
        },
        input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
      );

      if (paymentIntent.status === 'succeeded') {
        return {
          success: true,
          status: 'succeeded',
          providerPaymentId: paymentIntent.id,
          amount: input.amount,
          currency: input.currency.toUpperCase(),
        };
      }

      return {
        success: false,
        status: 'pending',
        providerPaymentId: paymentIntent.id,
        amount: input.amount,
        currency: input.currency.toUpperCase(),
      };
    } catch (err: any) {
      this.logger.warn(`Stripe charge failed: ${err.message}`);
      return {
        success: false,
        status: 'failed',
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        errorCode: err.code || 'payment_failed',
        errorMessage: err.message || 'Payment processing failed',
      };
    }
  }

  constructWebhookEvent(
    rawPayload: string | Buffer,
    signature: string,
    secret: string,
  ): WebhookEventPayload {
    if (this.stripe) {
      try {
        const event = this.stripe.webhooks.constructEvent(rawPayload, signature, secret);
        return {
          id: event.id,
          type: event.type,
          data: event.data,
          created: event.created,
        };
      } catch (err: any) {
        throw new BadRequestException({
          code: 'WEBHOOK_SIGNATURE_INVALID',
          message: `Stripe webhook signature verification failed: ${err.message}`,
        });
      }
    }

    // Fallback signature verification using HMAC-SHA256 when running without Stripe library secret verification
    const payloadString =
      typeof rawPayload === 'string' ? rawPayload : rawPayload.toString('utf8');

    // Parse stripe-style signature header: t=timestamp,v1=signature
    const parts = signature.split(',').reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.split('=');
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});

    const timestamp = parts.t;
    const expectedSig = parts.v1;

    if (timestamp && expectedSig && secret) {
      const signedPayload = `${timestamp}.${payloadString}`;
      const computedSig = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

      const computedBuf = Buffer.from(computedSig, 'utf8');
      const expectedBuf = Buffer.from(expectedSig, 'utf8');

      if (
        computedBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(computedBuf, expectedBuf)
      ) {
        throw new BadRequestException({
          code: 'WEBHOOK_SIGNATURE_INVALID',
          message: 'HMAC-SHA256 signature mismatch for incoming webhook',
        });
      }
    }

    try {
      const parsed = JSON.parse(payloadString);
      return {
        id: parsed.id ?? `evt_mock_${Date.now()}`,
        type: parsed.type ?? 'unknown',
        data: parsed.data ?? { object: parsed },
        created: parsed.created ?? Math.floor(Date.now() / 1000),
      };
    } catch {
      throw new BadRequestException({
        code: 'WEBHOOK_PAYLOAD_INVALID',
        message: 'Invalid JSON webhook payload body',
      });
    }
  }
}
