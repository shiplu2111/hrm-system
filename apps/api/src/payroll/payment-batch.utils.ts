import { BadRequestException } from '@nestjs/common';
import type { PaymentBatchStatus } from '@hrm/shared-types';

export const PAYMENT_BATCH_TRANSITIONS: Record<
  PaymentBatchStatus,
  readonly PaymentBatchStatus[]
> = {
  draft: ['pending'],
  pending: ['paid', 'failed'],
  paid: [],
  failed: [],
};

export function assertPaymentBatchTransition(
  from: PaymentBatchStatus,
  to: PaymentBatchStatus,
): void {
  const allowed = PAYMENT_BATCH_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new BadRequestException({
      code: 'INVALID_TRANSITION',
      message: `Cannot transition payment batch from "${from}" to "${to}"`,
    });
  }
}

export function generatePaymentBatchReference(periodEnd: Date): string {
  const y = periodEnd.getUTCFullYear();
  const m = String(periodEnd.getUTCMonth() + 1).padStart(2, '0');
  const suffix = Date.now().toString(36).slice(-6).toUpperCase();
  return `PB-${y}${m}-${suffix}`;
}
