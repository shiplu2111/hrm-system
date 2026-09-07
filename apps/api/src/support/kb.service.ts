import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  KbArticleListItem,
  KbArticleRecord,
  KbCategoryRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { PermissionsService } from '../rbac/permissions.service';
import { uniqueSlug } from './support.utils';

@Injectable()
export class KbService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly auditService: AuditService,
  ) {}

  canManage(user: AuthenticatedUser): boolean {
    return this.permissions.hasPermission(user, 'support', 'edit');
  }

  async listCategories(
    tenantId: string,
    user: AuthenticatedUser,
  ): Promise<KbCategoryRecord[]> {
    const rows = await this.prisma.unscoped.kbCategory.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { articles: true } },
      },
    });

    const manage = this.canManage(user);
    const filtered = manage
      ? rows
      : rows.filter((row) => row._count.articles > 0);

    return filtered.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      slug: row.slug,
      description: row.description,
      sortOrder: row.sortOrder,
      articleCount: row._count.articles,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async listArticles(
    tenantId: string,
    user: AuthenticatedUser,
    query: { search?: string; categoryId?: string },
  ): Promise<KbArticleListItem[]> {
    const manage = this.canManage(user);
    const search = query.search?.trim();

    const rows = await this.prisma.unscoped.kbArticle.findMany({
      where: {
        tenantId,
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(manage ? {} : { published: true }),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { summary: { contains: search, mode: 'insensitive' } },
                { body: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
      include: { category: { select: { name: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      categoryId: row.categoryId,
      categoryName: row.category.name,
      title: row.title,
      slug: row.slug,
      summary: row.summary,
      published: row.published,
      viewCount: row.viewCount,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async getArticle(
    tenantId: string,
    articleId: string,
    user: AuthenticatedUser,
  ): Promise<KbArticleRecord> {
    const row = await this.prisma.unscoped.kbArticle.findFirst({
      where: { id: articleId, tenantId },
      include: { category: { select: { name: true } } },
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Article not found' });
    }
    if (!row.published && !this.canManage(user)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Article not published' });
    }

    await this.prisma.unscoped.kbArticle.update({
      where: { id: row.id },
      data: { viewCount: { increment: 1 } },
    });

    return {
      id: row.id,
      tenantId: row.tenantId,
      categoryId: row.categoryId,
      categoryName: row.category.name,
      title: row.title,
      slug: row.slug,
      summary: row.summary,
      body: row.body,
      published: row.published,
      viewCount: row.viewCount + 1,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createCategory(
    tenantId: string,
    input: {
      name: string;
      slug?: string;
      description?: string;
      sortOrder?: number;
    },
    user: AuthenticatedUser,
  ): Promise<KbCategoryRecord> {
    const slug = await uniqueSlug(input.slug ?? input.name, async (candidate) => {
      const existing = await this.prisma.unscoped.kbCategory.findFirst({
        where: { tenantId, slug: candidate },
      });
      return existing != null;
    });

    const row = await this.prisma.unscoped.kbCategory.create({
      data: {
        tenantId,
        name: input.name.trim(),
        slug,
        description: input.description?.trim() || null,
        sortOrder: input.sortOrder ?? 0,
      },
    });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'create',
      module: 'support',
      recordId: row.id,
      newValue: { name: row.name, slug: row.slug },
    });

    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      slug: row.slug,
      description: row.description,
      sortOrder: row.sortOrder,
      articleCount: 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateCategory(
    tenantId: string,
    categoryId: string,
    input: {
      name?: string;
      slug?: string;
      description?: string;
      sortOrder?: number;
    },
    user: AuthenticatedUser,
  ): Promise<KbCategoryRecord> {
    const existing = await this.prisma.unscoped.kbCategory.findFirst({
      where: { id: categoryId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Category not found' });
    }

    let slug = existing.slug;
    if (input.slug || input.name) {
      slug = await uniqueSlug(input.slug ?? input.name ?? existing.name, async (candidate) => {
        if (candidate === existing.slug) return false;
        const row = await this.prisma.unscoped.kbCategory.findFirst({
          where: { tenantId, slug: candidate },
        });
        return row != null;
      });
    }

    const row = await this.prisma.unscoped.kbCategory.update({
      where: { id: categoryId },
      data: {
        name: input.name?.trim() ?? undefined,
        slug,
        description:
          input.description !== undefined
            ? input.description.trim() || null
            : undefined,
        sortOrder: input.sortOrder,
      },
      include: { _count: { select: { articles: true } } },
    });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'update',
      module: 'support',
      recordId: row.id,
      newValue: { name: row.name, slug: row.slug },
    });

    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      slug: row.slug,
      description: row.description,
      sortOrder: row.sortOrder,
      articleCount: row._count.articles,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createArticle(
    tenantId: string,
    input: {
      categoryId: string;
      title: string;
      slug?: string;
      summary: string;
      body: string;
      published?: boolean;
    },
    user: AuthenticatedUser,
  ): Promise<KbArticleRecord> {
    const category = await this.prisma.unscoped.kbCategory.findFirst({
      where: { id: input.categoryId, tenantId },
    });
    if (!category) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Category not found' });
    }

    const slug = await uniqueSlug(input.slug ?? input.title, async (candidate) => {
      const existing = await this.prisma.unscoped.kbArticle.findFirst({
        where: { tenantId, slug: candidate },
      });
      return existing != null;
    });

    const row = await this.prisma.unscoped.kbArticle.create({
      data: {
        tenantId,
        categoryId: input.categoryId,
        title: input.title.trim(),
        slug,
        summary: input.summary.trim(),
        body: input.body.trim(),
        published: input.published ?? false,
        createdByUserId: user.id,
      },
      include: { category: { select: { name: true } } },
    });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'create',
      module: 'support',
      recordId: row.id,
      newValue: { title: row.title, published: row.published },
    });

    return {
      id: row.id,
      tenantId: row.tenantId,
      categoryId: row.categoryId,
      categoryName: row.category.name,
      title: row.title,
      slug: row.slug,
      summary: row.summary,
      body: row.body,
      published: row.published,
      viewCount: row.viewCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateArticle(
    tenantId: string,
    articleId: string,
    input: {
      categoryId?: string;
      title?: string;
      slug?: string;
      summary?: string;
      body?: string;
      published?: boolean;
    },
    user: AuthenticatedUser,
  ): Promise<KbArticleRecord> {
    const existing = await this.prisma.unscoped.kbArticle.findFirst({
      where: { id: articleId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Article not found' });
    }

    if (input.categoryId) {
      const category = await this.prisma.unscoped.kbCategory.findFirst({
        where: { id: input.categoryId, tenantId },
      });
      if (!category) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Category not found' });
      }
    }

    let slug = existing.slug;
    if (input.slug || input.title) {
      slug = await uniqueSlug(input.slug ?? input.title ?? existing.title, async (candidate) => {
        if (candidate === existing.slug) return false;
        const row = await this.prisma.unscoped.kbArticle.findFirst({
          where: { tenantId, slug: candidate },
        });
        return row != null;
      });
    }

    const row = await this.prisma.unscoped.kbArticle.update({
      where: { id: articleId },
      data: {
        categoryId: input.categoryId,
        title: input.title?.trim(),
        slug,
        summary: input.summary?.trim(),
        body: input.body?.trim(),
        published: input.published,
        updatedByUserId: user.id,
      },
      include: { category: { select: { name: true } } },
    });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'update',
      module: 'support',
      recordId: row.id,
      newValue: { title: row.title, published: row.published },
    });

    return {
      id: row.id,
      tenantId: row.tenantId,
      categoryId: row.categoryId,
      categoryName: row.category.name,
      title: row.title,
      slug: row.slug,
      summary: row.summary,
      body: row.body,
      published: row.published,
      viewCount: row.viewCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async deleteArticle(
    tenantId: string,
    articleId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const existing = await this.prisma.unscoped.kbArticle.findFirst({
      where: { id: articleId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Article not found' });
    }

    await this.prisma.unscoped.kbArticle.delete({ where: { id: articleId } });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'delete',
      module: 'support',
      recordId: articleId,
      oldValue: { title: existing.title },
    });
  }
}
