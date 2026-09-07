import { signWebhookBody } from './webhook-signing.util';

describe('signWebhookBody', () => {
  it('produces deterministic HMAC signature for a payload', () => {
    const body = JSON.stringify({ type: 'employee.created' });
    const sig = signWebhookBody('whsec_test', 1_700_000_000, body);
    expect(sig).toMatch(/^t=1700000000,v1=[a-f0-9]{64}$/);
    expect(signWebhookBody('whsec_test', 1_700_000_000, body)).toBe(sig);
  });
});
