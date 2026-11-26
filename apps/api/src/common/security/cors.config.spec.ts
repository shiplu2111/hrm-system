import { createCorsDelegate, isOriginAllowedForRequest, isPublicApiPath } from './cors.config';

describe('CORS Security Policy', () => {
  it('identifies /public/* routes regardless of global prefix', () => {
    expect(isPublicApiPath('/api/v1/public/signup')).toBe(true);
    expect(isPublicApiPath('/api/v1/public/plans?currency=USD')).toBe(true);
    expect(isPublicApiPath('/public/kb/articles')).toBe(true);
    expect(isPublicApiPath('/api/v1/auth/login')).toBe(false);
    expect(isPublicApiPath('/api/v1/platform/tenants')).toBe(false);
  });

  it('restricts /api/v1/public/* strictly to website origins', () => {
    const prodEnv = {
      NODE_ENV: 'production',
      WEBSITE_URL: 'https://cmsn-hr.example',
      APP_PORTAL_URL: 'https://app.cmsn-hr.example',
      PLATFORM_URL: 'https://platform.cmsn-hr.example',
    } as NodeJS.ProcessEnv;

    expect(isOriginAllowedForRequest('https://cmsn-hr.example', '/api/v1/public/signup', prodEnv)).toBe(true);
    expect(isOriginAllowedForRequest('https://evil.example', '/api/v1/public/signup', prodEnv)).toBe(false);
    expect(isOriginAllowedForRequest('https://app.cmsn-hr.example', '/api/v1/public/signup', prodEnv)).toBe(false);
    expect(isOriginAllowedForRequest('http://localhost:5180', '/api/v1/public/signup', prodEnv)).toBe(false);
    expect(isOriginAllowedForRequest('https://app.cmsn-hr.example', '/api/v1/auth/login', prodEnv)).toBe(true);
  });

  it('produces strict delegate options blocking unapproved origins and credentials on /public/*', (done) => {
    const devEnv = {
      NODE_ENV: 'development',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:5180',
    } as NodeJS.ProcessEnv;
    const delegate = createCorsDelegate(devEnv);

    delegate(
      { headers: { origin: 'http://localhost:5180' }, originalUrl: '/api/v1/public/leads/demo' },
      (_err, opts) => {
        expect(opts?.origin).toBe('http://localhost:5180');
        expect(opts?.credentials).toBe(false);

        delegate(
          { headers: { origin: 'https://attacker.evil' }, originalUrl: '/api/v1/public/leads/demo' },
          (_err2, opts2) => {
            expect(opts2?.origin).toBe(false);
            expect(opts2?.credentials).toBe(false);
            done();
          },
        );
      },
    );
  });
});
