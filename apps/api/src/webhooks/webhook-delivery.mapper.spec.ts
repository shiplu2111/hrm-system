import {
  WEBHOOK_MAX_ATTEMPTS,
  webhookDeliveryState,
  webhookRetryDelayMs,
} from '@hrm/shared-types';
import { deliveryStateWhere } from './webhook-delivery.mapper';

describe('webhook retry schedule', () => {
  it('backs off 1m, 5m, 30m, 2h, 6h across six attempts', () => {
    expect(WEBHOOK_MAX_ATTEMPTS).toBe(6);
    expect([1, 2, 3, 4, 5].map(webhookRetryDelayMs)).toEqual([
      60_000,
      300_000,
      1_800_000,
      7_200_000,
      21_600_000,
    ]);
  });

  it('clamps out-of-range attempt numbers', () => {
    expect(webhookRetryDelayMs(0)).toBe(60_000);
    expect(webhookRetryDelayMs(99)).toBe(21_600_000);
  });
});

describe('webhookDeliveryState', () => {
  it('treats a queued delivery with earlier attempts as retrying', () => {
    expect(webhookDeliveryState({ status: 'queued', attempts: 0 })).toBe('pending');
    expect(webhookDeliveryState({ status: 'queued', attempts: 2 })).toBe('retrying');
    expect(webhookDeliveryState({ status: 'processing', attempts: 1 })).toBe('sending');
    expect(webhookDeliveryState({ status: 'delivered', attempts: 1 })).toBe('delivered');
    expect(webhookDeliveryState({ status: 'failed', attempts: 6 })).toBe('failed');
  });

  it('filters the same way the state is derived', () => {
    expect(deliveryStateWhere('retrying')).toEqual({
      status: 'queued',
      attempts: { gt: 0 },
    });
    expect(deliveryStateWhere('pending')).toEqual({ status: 'queued', attempts: 0 });
  });
});
