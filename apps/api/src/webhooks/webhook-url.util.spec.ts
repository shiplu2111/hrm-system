import {
  assertValidWebhookUrl,
  isPrivateAddress,
  WebhookUrlError,
} from './webhook-url.util';

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.10',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '[::1]',
  ])('treats %s as private', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '172.32.0.1', '52.10.20.30', '2606:4700::1111'])(
    'treats %s as public',
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    },
  );
});

describe('assertValidWebhookUrl', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('accepts a public https URL', () => {
    expect(assertValidWebhookUrl(' https://hooks.example.com/hrm ')).toBe(
      'https://hooks.example.com/hrm',
    );
  });

  it.each([
    'https://localhost:3000/hook',
    'https://127.0.0.1/hook',
    'http://169.254.169.254/latest/meta-data',
    'https://[::1]/hook',
    'https://intranet/hook',
    'https://erp.internal/hook',
    'https://printer.local/hook',
  ])('rejects private target %s', (url) => {
    expect(() => assertValidWebhookUrl(url)).toThrow(WebhookUrlError);
  });

  it('rejects other schemes, credentials and fragments', () => {
    expect(() => assertValidWebhookUrl('ftp://example.com/x')).toThrow(WebhookUrlError);
    expect(() => assertValidWebhookUrl('https://user:pw@example.com/x')).toThrow(
      WebhookUrlError,
    );
    expect(() => assertValidWebhookUrl('https://example.com/x#frag')).toThrow(
      WebhookUrlError,
    );
    expect(() => assertValidWebhookUrl('not a url')).toThrow(WebhookUrlError);
  });

  it('requires https in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS;
    expect(() => assertValidWebhookUrl('http://hooks.example.com/hrm')).toThrow(
      'must use https://',
    );
  });

  it('allows private targets only when explicitly enabled', () => {
    process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS = 'true';
    expect(assertValidWebhookUrl('http://localhost:4000/hook')).toBe(
      'http://localhost:4000/hook',
    );
  });
});
