import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  KbArticleListItem,
  KbArticleRecord,
  KbArticleStatusFilter,
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
    const manage = this.canManage(user);
    const rows = await this.prisma.unscoped.kbCategory.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { articles: manage ? true : { where: { published: true } } },
        },
      },
    });

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
    query: { search?: string; categoryId?: string; status?: KbArticleStatusFilter },
  ): Promise<KbArticleListItem[]> {
    const manage = this.canManage(user);
    const search = query.search?.trim();
    const published = !manage
      ? true
      : query.status === 'published'
        ? true
        : query.status === 'draft'
          ? false
          : undefined;

    const rows = await this.prisma.unscoped.kbArticle.findMany({
      where: {
        tenantId,
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(published !== undefined ? { published } : {}),
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

    const names = manage
      ? await this.userNames(rows.map((row) => row.updatedByUserId ?? row.createdByUserId))
      : new Map<string, string>();

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
      ...(manage
        ? { updatedByName: names.get(row.updatedByUserId ?? row.createdByUserId) ?? null }
        : {}),
    }));
  }

  /** Editors opening an article with `preview` do not count as a view. */
  async getArticle(
    tenantId: string,
    articleId: string,
    user: AuthenticatedUser,
    options: { preview?: boolean } = {},
  ): Promise<KbArticleRecord> {
    const row = await this.prisma.unscoped.kbArticle.findFirst({
      where: { id: articleId, tenantId },
      include: { category: { select: { name: true } } },
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Article not found' });
    }
    const manage = this.canManage(user);
    if (!row.published && !manage) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Article not published' });
    }

    const countView = !(options.preview && manage);
    if (countView) {
      await this.prisma.unscoped.kbArticle.update({
        where: { id: row.id },
        data: { viewCount: { increment: 1 } },
      });
    }

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
      viewCount: row.viewCount + (countView ? 1 : 0),
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

    const row = await this.prisma.unscoped.kbCategory.update({
      where: { id: categoryId },
      data: {
        name: input.name?.trim() ?? undefined,
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
      oldValue: { name: existing.name, sortOrder: existing.sortOrder },
      newValue: { name: row.name, sortOrder: row.sortOrder },
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

    // Slugs stay stable on title edits so shared links keep working.
    let slug = existing.slug;
    if (input.slug?.trim()) {
      slug = await uniqueSlug(input.slug, async (candidate) => {
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
      oldValue: { title: existing.title, published: existing.published },
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

  async deleteCategory(
    tenantId: string,
    categoryId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const existing = await this.prisma.unscoped.kbCategory.findFirst({
      where: { id: categoryId, tenantId },
      include: { _count: { select: { articles: true } } },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Category not found' });
    }
    if (existing._count.articles > 0) {
      throw new ConflictException({
        code: 'CATEGORY_NOT_EMPTY',
        message: `Move or delete the ${existing._count.articles} article(s) in "${existing.name}" first`,
      });
    }

    await this.prisma.unscoped.kbCategory.delete({ where: { id: categoryId } });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'delete',
      module: 'support',
      recordId: categoryId,
      oldValue: { name: existing.name },
    });
  }

  private async userNames(userIds: Array<string | null>): Promise<Map<string, string>> {
    const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
    if (ids.length === 0) return new Map();
    const users = await this.prisma.unscoped.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        email: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    });
    return new Map(
      users.map((user) => [
        user.id,
        user.employee
          ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
          : user.email,
      ]),
    );
  }
}
