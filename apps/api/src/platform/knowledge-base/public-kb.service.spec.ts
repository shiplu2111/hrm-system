import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { isPublicHelpCenterArticle, PublicKbService } from './public-kb.service';

describe('PublicKbService', () => {
  let service: PublicKbService;
  let mockPrisma: any;

  const publicPublished = {
    id: 'art-public',
    categoryId: 'cat-1',
    category: { id: 'cat-1', name: 'Payroll & Compliance', slug: 'payroll-compliance' },
    title: 'Running Deterministic Payroll & Adjustments',
    slug: 'deterministic-payroll-and-adjustments',
    summary: 'Walk through previewing pay runs and creating linked adjustment records.',
    body: '1. Preview draft payslips.\n2. Finalize payroll runs.',
    status: 'published',
    published: true,
    isPublic: true,
    targetCountries: ['ALL'],
    targetPlans: ['ALL'],
    tags: ['payroll', 'adjustments'],
    authorName: 'Platform Docs',
    viewCount: 55,
    helpfulYesCount: 4,
    helpfulNoCount: 0,
    publishedAt: new Date('2026-11-20T00:00:00.000Z'),
    updatedAt: new Date('2026-11-22T00:00:00.000Z'),
  };

  const draftArticle = {
    ...publicPublished,
    id: 'art-draft',
    title: 'Upcoming Superannuation Draft',
    slug: 'draft-superannuation',
    status: 'draft',
    published: false,
  };

  const planRestrictedArticle = {
    ...publicPublished,
    id: 'art-plan',
    title: 'Enterprise SAML Setup',
    slug: 'enterprise-saml-only',
    targetPlans: ['enterprise'],
  };

  const countryRestrictedArticle = {
    ...publicPublished,
    id: 'art-country',
    title: 'UK PAYE Configuration',
    slug: 'uk-paye-only',
    targetCountries: ['GB'],
  };

  const internalOnlyArticle = {
    ...publicPublished,
    id: 'art-internal',
    title: 'Tenant Admin Private Guide',
    slug: 'internal-only-guide',
    isPublic: false,
  };

  beforeEach(async () => {
    mockPrisma = {
      unscoped: {
        globalKbCategory: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'cat-1',
              name: 'Payroll & Compliance',
              slug: 'payroll-compliance',
              description: 'Payroll guides',
              icon: 'DollarSign',
              sortOrder: 1,
              articles: [publicPublished, draftArticle, planRestrictedArticle],
            },
            {
              id: 'cat-restricted',
              name: 'Enterprise Only',
              slug: 'enterprise-only',
              description: 'Hidden category',
              icon: 'Shield',
              sortOrder: 2,
              articles: [planRestrictedArticle, draftArticle],
            },
          ]),
          findUnique: jest.fn(),
        },
        globalKbArticle: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              publicPublished,
              draftArticle,
              planRestrictedArticle,
              countryRestrictedArticle,
              internalOnlyArticle,
            ]),
          findUnique: jest.fn(),
          update: jest.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PublicKbService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(PublicKbService);
  });

  it('filters out draft, private, per-country, and per-plan articles strictly', async () => {
    expect(isPublicHelpCenterArticle(publicPublished)).toBe(true);
    expect(isPublicHelpCenterArticle(draftArticle)).toBe(false);
    expect(isPublicHelpCenterArticle(planRestrictedArticle)).toBe(false);
    expect(isPublicHelpCenterArticle(countryRestrictedArticle)).toBe(false);
    expect(isPublicHelpCenterArticle(internalOnlyArticle)).toBe(false);

    const list = await service.listPublicArticles();
    expect(list.map((a) => a.slug)).toEqual(['deterministic-payroll-and-adjustments']);

    const categories = await service.listPublicCategories();
    expect(categories).toHaveLength(1);
    expect(categories[0].slug).toBe('payroll-compliance');
    expect(categories[0].articleCount).toBe(1);
  });

  it('returns 404 when requesting a draft or plan-restricted article by slug', async () => {
    mockPrisma.unscoped.globalKbArticle.findUnique.mockResolvedValue(draftArticle);
    await expect(service.getPublicArticleBySlug('draft-superannuation')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    mockPrisma.unscoped.globalKbArticle.findUnique.mockResolvedValue(planRestrictedArticle);
    await expect(service.getPublicArticleBySlug('enterprise-saml-only')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('supports typo-tolerant server-side search for misspelled terms', async () => {
    const misspelled = await service.listPublicArticles({ search: 'payrol adjustmnt' });
    expect(misspelled).toHaveLength(1);
    expect(misspelled[0].slug).toBe('deterministic-payroll-and-adjustments');
  });

  it('records helpful feedback only on publicly visible articles', async () => {
    mockPrisma.unscoped.globalKbArticle.findUnique.mockResolvedValue(publicPublished);
    mockPrisma.unscoped.globalKbArticle.update.mockResolvedValue({
      id: 'art-public',
      slug: 'deterministic-payroll-and-adjustments',
      helpfulYesCount: 5,
      helpfulNoCount: 0,
    });

    const fb = await service.recordFeedback('deterministic-payroll-and-adjustments', true);
    expect(fb.helpfulYesCount).toBe(5);
  });
});
