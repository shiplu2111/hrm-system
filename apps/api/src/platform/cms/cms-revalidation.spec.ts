import { CmsRevalidationService } from './cms-revalidation.service';
import { PlatformCmsService } from './platform-cms.service';

describe('CmsRevalidationService', () => {
  const originalFetch = global.fetch;
  const originalSecret = process.env.REVALIDATE_SECRET;
  const originalWebsiteUrl = process.env.WEBSITE_INTERNAL_URL;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.REVALIDATE_SECRET;
    else process.env.REVALIDATE_SECRET = originalSecret;

    if (originalWebsiteUrl === undefined) delete process.env.WEBSITE_INTERNAL_URL;
    else process.env.WEBSITE_INTERNAL_URL = originalWebsiteUrl;
  });

  it('skips cleanly and returns false when REVALIDATE_SECRET is unset', async () => {
    delete process.env.REVALIDATE_SECRET;
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const svc = new CmsRevalidationService();
    const ok = await svc.trigger({ scopes: ['cms-pages'], slugs: ['promo'] });

    expect(ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts scoped slug invalidation to website /api/revalidate with secret header', async () => {
    process.env.REVALIDATE_SECRET = 'top-secret-token';
    process.env.WEBSITE_INTERNAL_URL = 'http://website.internal:3000/';

    const fetchSpy = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const svc = new CmsRevalidationService();
    const ok = await svc.trigger({ scopes: ['cms-pages'], slugs: ['promo'] });

    expect(ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://website.internal:3000/api/revalidate');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-revalidate-secret']).toBe('top-secret-token');
    expect(JSON.parse(String(init.body))).toEqual({
      scopes: ['cms-pages'],
      slugs: ['promo'],
    });
  });

  it('swallows network failures so CMS mutations never crash if website is down', async () => {
    process.env.REVALIDATE_SECRET = 'top-secret-token';
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const svc = new CmsRevalidationService();
    const ok = await svc.trigger({ scopes: ['cms-pages'], slugs: ['promo'] });

    expect(ok).toBe(false);
  });

  it('triggers website revalidation on unpublishPage and trashOrDeletePage', async () => {
    const mockRevalidate = {
      trigger: jest.fn().mockResolvedValue(true),
    } as unknown as CmsRevalidationService;

    const pageRow = {
      id: 'page-1',
      slug: 'spring-launch',
      kind: 'custom',
      status: 'published',
      locked: false,
      requiresApproval: false,
      approvalStatus: 'none',
      currentDraftVersionId: 'v1',
      currentPublishedVersionId: 'v1',
      pendingApprovalVersionId: null,
      deletedAt: null,
      publishedAt: new Date('2026-10-01T00:00:00Z'),
      createdAt: new Date('2026-10-01T00:00:00Z'),
      updatedAt: new Date('2026-10-01T00:00:00Z'),
      locales: [],
    };

    const mockDb = {
      cmsPage: {
        findUnique: jest.fn().mockResolvedValue(pageRow),
        update: jest.fn().mockResolvedValue({ ...pageRow, status: 'unpublished' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      cmsPageVersion: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      cmsMenuItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      cmsSiteSetting: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const mockPrisma = { unscoped: mockDb } as any;
    const mockAudit = { log: jest.fn().mockResolvedValue(undefined) } as any;

    const service = new PlatformCmsService(mockPrisma, mockAudit, undefined, mockRevalidate);
    const publisher = {
      id: 'user-1',
      email: 'publisher@cmsnbd.com',
      roleName: 'Content Publisher',
      timezone: 'UTC',
    } as any;

    await service.unpublishPage('page-1', { reason: 'Season ended' }, publisher);

    expect(mockRevalidate.trigger).toHaveBeenCalledWith({
      scopes: ['cms-pages'],
      slugs: ['spring-launch'],
    });

    await service.trashOrDeletePage(
      'page-1',
      publisher,
      { unpublishFirst: true, reason: 'Done' },
    );

    expect(mockRevalidate.trigger).toHaveBeenCalledWith({
      scopes: ['cms-pages'],
      slugs: ['spring-launch'],
      paths: ['/spring-launch'],
    });
  });
});
