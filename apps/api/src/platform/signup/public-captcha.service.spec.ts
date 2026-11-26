import { PublicCaptchaService } from './public-captcha.service';

describe('PublicCaptchaService (with provider-down fallback)', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('issues and verifies signed HMAC fallback challenge once without external provider', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const svc = new PublicCaptchaService();

    const challenge = svc.issueChallenge();
    expect(challenge.provider).toBe('local_fallback');
    expect(challenge.fallbackActive).toBe(true);

    const match = challenge.prompt.match(/(\d+)\s*\+\s*(\d+)/);
    expect(match).toBeTruthy();
    const answer = Number(match![1]) + Number(match![2]);

    await expect(svc.verifyToken(`${challenge.challengeId}:${answer}`)).resolves.toBeUndefined();
    // Replay rejected
    await expect(svc.verifyToken(`${challenge.challengeId}:${answer}`)).rejects.toThrow(/already been used/i);
  });

  it('activates local fallback automatically when external Turnstile provider is down (network error or 503)', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'turnstile-secret-for-test';
    process.env.TURNSTILE_SITE_KEY = 'turnstile-site-key-test';

    const svc = new PublicCaptchaService();
    const initial = svc.issueChallenge();
    expect(initial.provider).toBe('turnstile');
    expect(initial.fallbackActive).toBe(false);
    expect(initial.siteKey).toBe('turnstile-site-key-test');

    // Simulate Turnstile outage
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(svc.verifyToken('external-turnstile-token')).rejects.toThrow(/temporarily unavailable/i);

    // Subsequent challenges enter fallbackActive immediately and validate signed challenge seamlessly
    const fallbackChallenge = svc.issueChallenge();
    expect(fallbackChallenge.provider).toBe('local_fallback');
    expect(fallbackChallenge.fallbackActive).toBe(true);

    const match = fallbackChallenge.prompt.match(/(\d+)\s*\+\s*(\d+)/);
    const answer = Number(match![1]) + Number(match![2]);
    await expect(
      svc.verifyToken(`${fallbackChallenge.challengeId}:${answer}`),
    ).resolves.toBeUndefined();
  });

  it('verifies valid external Turnstile token when provider is healthy', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'turnstile-secret-for-test';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as any);

    const svc = new PublicCaptchaService();
    await expect(svc.verifyToken('valid-turnstile-response-token', '1.2.3.4')).resolves.toBeUndefined();
    expect(svc.isProviderFallbackActive()).toBe(false);
  });
});
