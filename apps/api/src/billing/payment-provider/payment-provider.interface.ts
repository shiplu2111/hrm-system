/**
 * Payment Provider Interface
 * Conforms to /docs/THIRD_PARTY_INTEGRATIONS.md §2 (Driver Pattern).
 * Shields application business logic from specific payment gateway SDKs/APIs.
 */

export interface CreateCustomerInput {
  tenantId: string;
  name: string;
  email: string;
  paymentMethodId?: string;
  metadata?: Record<string, string>;
}

export interface CustomerResult {
  customerId: string;
  defaultPaymentMethodId?: string;
}

export interface ChargeInput {
  tenantId: string;
  customerId?: string | null;
  paymentMethodId?: string | null;
  amount: number; // in primary currency units (e.g. 49.00)
  currency: string; // ISO 4217, e.g. 'USD', 'AUD', 'EUR', 'GBP', 'BDT'
  description: string;
  idempotencyKey?: string;
  metadata?: Record<string, string>;
}

export interface ChargeResult {
  success: boolean;
  providerPaymentId?: string;
  status: 'succeeded' | 'failed' | 'pending';
  amount: number;
  currency: string;
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: Record<string, unknown>;
}

export interface WebhookEventPayload {
  id: string;
  type: string;
  data: {
    object: Record<string, any>;
  };
  created: number;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

export interface PaymentProvider {
  /**
   * Create or update a customer record in the payment gateway.
   */
  createCustomer(input: CreateCustomerInput): Promise<CustomerResult>;

  /**
   * Execute a charge against a customer / payment method with an idempotency key.
   */
  charge(input: ChargeInput): Promise<ChargeResult>;

  /**
   * Verify cryptographic webhook signature and construct typed event payload.
   */
  constructWebhookEvent(
    rawPayload: string | Buffer,
    signature: string,
    secret: string,
  ): WebhookEventPayload;
}
