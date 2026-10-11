import { signWebhookBody, verifyWebhookSignature } from './webhook-signing.util';

describe('signWebhookBody', () => {
  it('produces deterministic HMAC signature for a payload', () => {
    const body = JSON.stringify({ type: 'employee.created' });
    const sig = signWebhookBody('whsec_test', 1_700_000_000, body);
    expect(sig).toMatch(/^t=1700000000,v1=[a-f0-9]{64}$/);
    expect(signWebhookBody('whsec_test', 1_700_000_000, body)).toBe(sig);
  });

  it('matches the test vector published in the admin verification examples', () => {
    expect(signWebhookBody('whsec_test', 1_700_000_000, '{"type":"webhook.test"}')).toBe(
      't=1700000000,v1=cf7d053522b08300fae293c3bcbf4e183d4a9538620c18dc9a46d063337936fa',
    );
  });

  it('verifies a fresh signature and rejects a tampered body', () => {
    const now = Math.floor(Date.now() / 1000);
    const header = signWebhookBody('whsec_test', now, '{"a":1}');
    expect(verifyWebhookSignature('whsec_test', header, '{"a":1}')).toBe(true);
    expect(verifyWebhookSignature('whsec_test', header, '{"a":2}')).toBe(false);
  });
});
