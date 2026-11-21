import { StripePaymentProvider } from './stripe-payment.provider';
import { BadRequestException } from '@nestjs/common';
import crypto from 'node:crypto';

describe('StripePaymentProvider', () => {
  let provider: StripePaymentProvider;

  beforeEach(() => {
    provider = new StripePaymentProvider();
  });

  describe('createCustomer', () => {
    it('creates customer in mock/sandbox mode when STRIPE_SECRET_KEY is unset', async () => {
      const res = await provider.createCustomer({
        tenantId: '12345678-1234-1234-1234-123456789abc',
        name: 'Acme Corp',
        email: 'billing@acme.com',
      });

      expect(res.customerId).toMatch(/^cus_mock_/);
      expect(res.defaultPaymentMethodId).toBe('pm_mock_card_visa');
    });
  });

  describe('charge', () => {
    it('successfully processes charges with idempotency key in mock mode', async () => {
      const res = await provider.charge({
        tenantId: 'tenant-1',
        customerId: 'cus_mock_123',
        amount: 99.0,
        currency: 'USD',
        description: 'Test monthly subscription',
        idempotencyKey: 'inv_123_0',
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('succeeded');
      expect(res.amount).toBe(99.0);
      expect(res.currency).toBe('USD');
      expect(res.providerPaymentId).toMatch(/^pi_mock_/);
    });

    it('simulates card decline when customer or payment method has fail indicator', async () => {
      const res = await provider.charge({
        tenantId: 'tenant-1',
        customerId: 'cus_fail_123',
        amount: 99.0,
        currency: 'USD',
        description: 'Failed charge test',
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('failed');
      expect(res.errorCode).toBe('card_declined');
    });
  });

  describe('constructWebhookEvent', () => {
    it('verifies HMAC-SHA256 signature and returns typed event', () => {
      const secret = 'whsec_test_secret_123';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const rawPayload = JSON.stringify({
        id: 'evt_test_webhook_1',
        type: 'invoice.payment_succeeded',
        data: { object: { id: 'in_123', amount_paid: 9900 } },
      });

      const signedPayload = `${timestamp}.${rawPayload}`;
      const signatureHash = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

      const header = `t=${timestamp},v1=${signatureHash}`;

      const event = provider.constructWebhookEvent(rawPayload, header, secret);
      expect(event.id).toBe('evt_test_webhook_1');
      expect(event.type).toBe('invoice.payment_succeeded');
    });

    it('throws BadRequestException if signature hash does not match', () => {
      const secret = 'whsec_test_secret_123';
      const timestamp = '1700000000';
      const rawPayload = '{"id":"evt_1"}';
      const invalidHeader = `t=${timestamp},v1=invalid_hash_abc`;

      expect(() =>
        provider.constructWebhookEvent(rawPayload, invalidHeader, secret),
      ).toThrow(BadRequestException);
    });
  });
});
