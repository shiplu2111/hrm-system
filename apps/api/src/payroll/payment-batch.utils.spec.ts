import { BadRequestException } from '@nestjs/common';
import {
  assertPaymentBatchTransition,
  PAYMENT_BATCH_TRANSITIONS,
} from './payment-batch.utils';

describe('Payment batch status flow (MODULES.md §19)', () => {
  it('defines Draft → Pending → Paid/Failed', () => {
    expect(PAYMENT_BATCH_TRANSITIONS.draft).toEqual(['pending']);
    expect(PAYMENT_BATCH_TRANSITIONS.pending).toEqual(['paid', 'failed']);
    expect(PAYMENT_BATCH_TRANSITIONS.paid).toEqual([]);
    expect(PAYMENT_BATCH_TRANSITIONS.failed).toEqual([]);
  });

  it('allows the happy-path flow', () => {
    expect(() => assertPaymentBatchTransition('draft', 'pending')).not.toThrow();
    expect(() => assertPaymentBatchTransition('pending', 'paid')).not.toThrow();
  });

  it('rejects invalid transitions', () => {
    expect(() => assertPaymentBatchTransition('draft', 'paid')).toThrow(
      BadRequestException,
    );
    expect(() => assertPaymentBatchTransition('paid', 'pending')).toThrow(
      BadRequestException,
    );
  });
});
