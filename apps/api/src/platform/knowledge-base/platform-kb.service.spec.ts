// apps/api/src/platform/knowledge-base/platform-kb.service.spec.ts
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PlatformActorContext, PlatformKbService } from './platform-kb.service';

describe('PlatformKbService', () => {
  let service: PlatformKbService;
  let mockPrisma: any;

  const adminActor: PlatformActorContext = {
    id: 'user-admin-1',
    email: 'platform.admin@cmsnbd.com',
    roleName: 'Platform Admin',
  };

  const unauthorizedActor: PlatformActorContext = {
    id: 'user-guest-1',
    email: 'guest@example.com',
    roleName: 'Guest',
    permissions: [],
  };

  beforeEach(() => {
    mockPrisma = {
      globalKbCategory: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      globalKbArticle: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };

    service = new PlatformKbService(mockPrisma);
  });

  describe('Access Control', () => {
    it('allows Platform Admin / Staff access', () => {
      expect(service.canAccess(adminActor)).toBe(true);
      expect(service.canEdit(adminActor)).toBe(true);
    });

    it('rejects unauthorized roles from modifying categories or articles', async () => {
      await expect(
        service.createCategory({ name: 'Test' }, unauthorizedActor),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.createArticle(
          { categoryId: 'c1', title: 'Test', summary: 'Summary 12345', body: 'Body 12345' },
          unauthorizedActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Categories Management', () => {
    it('lists categories with article count breakdown', async () => {
      mockPrisma.globalKbCategory.findMany.mockResolvedValue([
        {
          id: 'cat-1',
          name: 'Payroll Compliance',
          slug: 'payroll-compliance',
          description: 'Tax and social security rules',
          icon: 'DollarSign',
          sortOrder: 1,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-02'),
          articles: [
            { id: 'a1', published: true, status: 'published' },
            { id: 'a2', published: false, status: 'draft' },
          ],
        },
      ]);

      const result = await service.listCategories(adminActor);
      expect(result).toHaveLength(1);
      expect(result[0].articleCount).toBe(2);
      expect(result[0].publishedCount).toBe(1);
      expect(result[0].draftCount).toBe(1);
    });

    it('prevents deleting a category containing articles per MODULES.md §45', async () => {
      mockPrisma.globalKbCategory.findUnique.mockResolvedValue({
        id: 'cat-1',
        name: 'Payroll Compliance',
        _count: { articles: 3 },
      });

      await expect(service.deleteCategory('cat-1', adminActor)).rejects.toThrow(
        ConflictException,
      );
    });

    it('deletes an empty category successfully', async () => {
      mockPrisma.globalKbCategory.findUnique.mockResolvedValue({
        id: 'cat-empty',
        name: 'Empty Category',
        _count: { articles: 0 },
      });
      mockPrisma.globalKbCategory.delete.mockResolvedValue({ id: 'cat-empty' });

      const res = await service.deleteCategory('cat-empty', adminActor);
      expect(res.success).toBe(true);
      expect(mockPrisma.globalKbCategory.delete).toHaveBeenCalledWith({ where: { id: 'cat-empty' } });
    });
  });

  describe('Articles Lifecycle & Visibility', () => {
    it('creates an article with default ALL country and plan visibility', async () => {
      mockPrisma.globalKbCategory.findUnique.mockResolvedValue({ id: 'cat-1', name: 'General' });
      mockPrisma.globalKbArticle.findUnique.mockResolvedValue(null);
      mockPrisma.globalKbArticle.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'art-1',
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
          category: { id: 'cat-1', name: 'General', slug: 'general' },
        }),
      );

      const created = await service.createArticle(
        {
          categoryId: 'cat-1',
          title: 'Setting Up Bank Accounts',
          summary: 'Guide to adding tenant corporate accounts and payment clearing rails',
          body: '## Bank Setup\nEnter IBAN / BSB / Routing numbers.',
          status: 'published',
        },
        adminActor,
      );

      expect(created.title).toBe('Setting Up Bank Accounts');
      expect(created.slug).toBe('setting-up-bank-accounts');
      expect(created.targetCountries).toEqual(['ALL']);
      expect(created.targetPlans).toEqual(['ALL']);
      expect(created.published).toBe(true);
      expect(created.publishedAt).toBeDefined();
    });

    it('filters articles by country, plan, and status', async () => {
      mockPrisma.globalKbArticle.findMany.mockResolvedValueOnce([
        {
          id: 'art-uk',
          categoryId: 'cat-1',
          title: 'UK Tax Rates',
          slug: 'uk-tax-rates',
          summary: 'Summary of progressive bands for UK employees',
          status: 'published',
          published: true,
          viewCount: 150,
          targetCountries: ['GB'],
          targetPlans: ['business', 'enterprise'],
          tags: ['tax'],
          createdAt: new Date(),
          updatedAt: new Date(),
          category: { id: 'cat-1', name: 'Compliance', slug: 'compliance' },
        },
      ]);
      mockPrisma.globalKbArticle.count.mockResolvedValue(1);
      mockPrisma.globalKbArticle.findMany.mockResolvedValueOnce([
        { status: 'published', published: true, viewCount: 150 },
      ]);
      mockPrisma.globalKbCategory.count.mockResolvedValue(1);

      const res = await service.listArticles(
        { country: 'GB', plan: 'enterprise', status: 'published' },
        adminActor,
      );

      expect(res.items).toHaveLength(1);
      expect(res.items[0].targetCountries).toEqual(['GB']);
      expect(res.counts.published).toBe(1);
      expect(res.totalViews).toBe(150);
    });

    it('does not increment view count when opened with preview=true per MODULES.md §45', async () => {
      mockPrisma.globalKbArticle.findUnique.mockResolvedValue({
        id: 'art-preview',
        title: 'Draft Article',
        slug: 'draft-article',
        summary: 'A short summary of draft article',
        body: 'Detailed body text...',
        viewCount: 42,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat-1', name: 'General', slug: 'general' },
      });

      const detail = await service.getArticle('art-preview', { preview: true }, adminActor);
      expect(detail.viewCount).toBe(42);
      expect(mockPrisma.globalKbArticle.update).not.toHaveBeenCalled();
    });

    it('increments view count when opened without preview flag', async () => {
      mockPrisma.globalKbArticle.findUnique.mockResolvedValue({
        id: 'art-normal',
        title: 'Normal Article',
        slug: 'normal-article',
        summary: 'Normal summary here for testing',
        body: 'Normal body text...',
        viewCount: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat-1', name: 'General', slug: 'general' },
      });
      mockPrisma.globalKbArticle.update.mockResolvedValue({ viewCount: 11 });

      const detail = await service.getArticle('art-normal', { preview: false }, adminActor);
      expect(detail.viewCount).toBe(11);
      expect(mockPrisma.globalKbArticle.update).toHaveBeenCalledWith({
        where: { id: 'art-normal' },
        data: { viewCount: { increment: 1 } },
        select: { viewCount: true },
      });
    });
  });
});
