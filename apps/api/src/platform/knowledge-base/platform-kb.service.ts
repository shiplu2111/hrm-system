// apps/api/src/platform/knowledge-base/platform-kb.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  CreateGlobalKbArticleInput,
  CreateGlobalKbCategoryInput,
  GlobalKbArticleDetail,
  GlobalKbArticleListItem,
  GlobalKbArticlesQuery,
  GlobalKbArticlesResponse,
  GlobalKbCategory,
  GlobalKbStatus,
  IncrementArticleViewResult,
  UpdateGlobalKbArticleInput,
  UpdateGlobalKbCategoryInput,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';

export interface PlatformActorContext {
  id?: string;
  email?: string;
  roleName?: string;
  permissions?: Array<{ module: string; action: string }>;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class PlatformKbService implements OnModuleInit {
  private readonly logger = new Logger(PlatformKbService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return (this.prisma as any).unscoped || this.prisma;
  }

  async onModuleInit() {
    await this.seedInitialGlobalArticlesIfEmpty();
  }

  /**
   * Role enforcement: platform staff with support, platform, or admin permissions can view/manage.
   */
  canAccess(actor: PlatformActorContext): boolean {
    if (!actor) return false;
    const role = (actor.roleName || '').toLowerCase();
    if (
      role.includes('owner') ||
      role.includes('admin') ||
      role.includes('support') ||
      role.includes('editor') ||
      role.includes('auditor')
    ) {
      return true;
    }
    const perms = actor.permissions || [];
    return perms.some(
      (p) =>
        (p.module === 'support' || p.module === 'platform' || p.module === 'content') &&
        (p.action === 'view' || p.action === 'manage' || p.action === 'edit'),
    );
  }

  canEdit(actor: PlatformActorContext): boolean {
    if (!actor) return false;
    const role = (actor.roleName || '').toLowerCase();
    if (
      role.includes('owner') ||
      role.includes('admin') ||
      role.includes('support') ||
      role.includes('editor')
    ) {
      return true;
    }
    const perms = actor.permissions || [];
    return perms.some(
      (p) =>
        (p.module === 'support' || p.module === 'platform' || p.module === 'content') &&
        (p.action === 'manage' || p.action === 'edit'),
    );
  }

  private assertAccess(actor: PlatformActorContext) {
    if (!this.canAccess(actor)) {
      throw new ForbiddenException('Insufficient permissions to access Global Knowledge Base');
    }
  }

  private assertEdit(actor: PlatformActorContext) {
    if (!this.canEdit(actor)) {
      throw new ForbiddenException('Insufficient permissions to modify Global Knowledge Base');
    }
  }

  // ==========================================
  // Categories Management
  // ==========================================

  async listCategories(actor?: PlatformActorContext): Promise<GlobalKbCategory[]> {
    if (actor) this.assertAccess(actor);

    const categories = await this.db.globalKbCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        articles: {
          select: {
            id: true,
            published: true,
            status: true,
          },
        },
      },
    });

    return categories.map((c: any) => {
      const articles = c.articles || [];
      const publishedCount = articles.filter((a: any) => a.published || a.status === 'published').length;
      const draftCount = articles.filter((a: any) => !a.published || a.status === 'draft').length;

      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        icon: c.icon,
        sortOrder: c.sortOrder,
        articleCount: articles.length,
        publishedCount,
        draftCount,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      };
    });
  }

  async createCategory(
    input: CreateGlobalKbCategoryInput,
    actor: PlatformActorContext,
  ): Promise<GlobalKbCategory> {
    this.assertEdit(actor);

    if (!input.name || input.name.trim().length < 2) {
      throw new BadRequestException('Category name must be at least 2 characters');
    }

    const baseSlug = input.slug?.trim() ? slugify(input.slug) : slugify(input.name);
    let finalSlug = baseSlug;
    let counter = 1;

    while (await this.db.globalKbCategory.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${baseSlug}-${counter++}`;
    }

    const created = await this.db.globalKbCategory.create({
      data: {
        name: input.name.trim(),
        slug: finalSlug,
        description: input.description?.trim() || null,
        icon: input.icon?.trim() || 'BookOpen',
        sortOrder: input.sortOrder ?? 0,
      },
    });

    return {
      id: created.id,
      name: created.name,
      slug: created.slug,
      description: created.description,
      icon: created.icon,
      sortOrder: created.sortOrder,
      articleCount: 0,
      publishedCount: 0,
      draftCount: 0,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async updateCategory(
    id: string,
    input: UpdateGlobalKbCategoryInput,
    actor: PlatformActorContext,
  ): Promise<GlobalKbCategory> {
    this.assertEdit(actor);

    const existing = await this.db.globalKbCategory.findUnique({
      where: { id },
      include: {
        articles: { select: { id: true, published: true, status: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Global KB category with ID ${id} not found`);
    }

    let finalSlug = existing.slug;
    if (input.slug && input.slug.trim() !== existing.slug) {
      const candidateSlug = slugify(input.slug);
      const duplicate = await this.db.globalKbCategory.findUnique({
        where: { slug: candidateSlug },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(`Category slug "${candidateSlug}" is already in use`);
      }
      finalSlug = candidateSlug;
    }

    const updated = await this.db.globalKbCategory.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.slug !== undefined ? { slug: finalSlug } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.icon !== undefined ? { icon: input.icon?.trim() || null } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });

    const articles = existing.articles || [];
    const publishedCount = articles.filter((a: any) => a.published || a.status === 'published').length;
    const draftCount = articles.filter((a: any) => !a.published || a.status === 'draft').length;

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      icon: updated.icon,
      sortOrder: updated.sortOrder,
      articleCount: articles.length,
      publishedCount,
      draftCount,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteCategory(id: string, actor: PlatformActorContext): Promise<{ success: boolean; id: string }> {
    this.assertEdit(actor);

    const category = await this.db.globalKbCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { articles: true } },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Per MODULES.md §45: categories can be deleted only when empty
    if (category._count.articles > 0) {
      throw new ConflictException(
        `Category "${category.name}" contains ${category._count.articles} article(s). Reassign or delete articles before deleting the category.`,
      );
    }

    await this.db.globalKbCategory.delete({ where: { id } });
    return { success: true, id };
  }

  // ==========================================
  // Articles Management
  // ==========================================

  async listArticles(
    query: GlobalKbArticlesQuery = {},
    actor?: PlatformActorContext,
  ): Promise<GlobalKbArticlesResponse> {
    if (actor) this.assertAccess(actor);

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.categoryId && query.categoryId !== 'all') {
      where.categoryId = query.categoryId;
    }

    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { summary: { contains: term, mode: 'insensitive' } },
        { body: { contains: term, mode: 'insensitive' } },
        { slug: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (query.country && query.country !== 'all') {
      const upper = query.country.toUpperCase();
      where.targetCountries = {
        hasSome: [upper, 'ALL'],
      };
    }

    if (query.plan && query.plan !== 'all') {
      const lower = query.plan.toLowerCase();
      where.targetPlans = {
        hasSome: [lower, 'ALL', 'all'],
      };
    }

    if (query.tag && query.tag !== 'all') {
      where.tags = {
        has: query.tag.toLowerCase(),
      };
    }

    const [articles, total, allArticles, categoriesCount] = await Promise.all([
      this.db.globalKbArticle.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take: pageSize,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      this.db.globalKbArticle.count({ where }),
      this.db.globalKbArticle.findMany({
        select: { status: true, published: true, viewCount: true },
      }),
      this.db.globalKbCategory.count(),
    ]);

    const counts = {
      all: allArticles.length,
      published: allArticles.filter((a: any) => a.status === 'published' || a.published).length,
      draft: allArticles.filter((a: any) => a.status === 'draft' || !a.published).length,
    };

    const totalViews = allArticles.reduce((acc: number, cur: any) => acc + (cur.viewCount || 0), 0);

    const items: GlobalKbArticleListItem[] = articles.map((a: any) => ({
      id: a.id,
      categoryId: a.categoryId,
      categoryName: a.category?.name || 'Uncategorized',
      categorySlug: a.category?.slug,
      title: a.title,
      slug: a.slug,
      summary: a.summary,
      status: (a.status as GlobalKbStatus) || (a.published ? 'published' : 'draft'),
      published: a.published ?? (a.status === 'published'),
      viewCount: a.viewCount || 0,
      targetCountries: a.targetCountries || [],
      targetPlans: a.targetPlans || [],
      tags: a.tags || [],
      authorUserId: a.authorUserId,
      authorName: a.authorName,
      lastUpdatedByUserId: a.lastUpdatedByUserId,
      lastUpdatedByName: a.lastUpdatedByName,
      publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
      counts,
      categoriesCount,
      totalViews,
    };
  }

  async getArticle(
    id: string,
    options: { preview?: boolean } = {},
    actor?: PlatformActorContext,
  ): Promise<GlobalKbArticleDetail> {
    if (actor) this.assertAccess(actor);

    const article = await this.db.globalKbArticle.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!article) {
      throw new NotFoundException(`Global KB article with ID ${id} not found`);
    }

    // Per MODULES.md §45: opening in editor (?preview=true) does NOT count as a view
    let currentViewCount = article.viewCount || 0;
    if (!options.preview) {
      const updated = await this.db.globalKbArticle.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
        select: { viewCount: true },
      });
      currentViewCount = updated.viewCount;
    }

    return {
      id: article.id,
      categoryId: article.categoryId,
      categoryName: article.category?.name || 'Uncategorized',
      categorySlug: article.category?.slug,
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      body: article.body,
      status: (article.status as GlobalKbStatus) || (article.published ? 'published' : 'draft'),
      published: article.published ?? (article.status === 'published'),
      viewCount: currentViewCount,
      targetCountries: article.targetCountries || [],
      targetPlans: article.targetPlans || [],
      tags: article.tags || [],
      authorUserId: article.authorUserId,
      authorName: article.authorName,
      lastUpdatedByUserId: article.lastUpdatedByUserId,
      lastUpdatedByName: article.lastUpdatedByName,
      publishedAt: article.publishedAt ? article.publishedAt.toISOString() : null,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    };
  }

  async createArticle(
    input: CreateGlobalKbArticleInput,
    actor: PlatformActorContext,
  ): Promise<GlobalKbArticleDetail> {
    this.assertEdit(actor);

    if (!input.title || input.title.trim().length < 3) {
      throw new BadRequestException('Article title must be at least 3 characters');
    }
    if (!input.summary || input.summary.trim().length < 10) {
      throw new BadRequestException('Article summary must be at least 10 characters');
    }
    if (!input.body || input.body.trim().length < 10) {
      throw new BadRequestException('Article markdown body must be at least 10 characters');
    }

    const category = await this.db.globalKbCategory.findUnique({
      where: { id: input.categoryId },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${input.categoryId} not found`);
    }

    const baseSlug = input.slug?.trim() ? slugify(input.slug) : slugify(input.title);
    let finalSlug = baseSlug;
    let counter = 1;

    while (await this.db.globalKbArticle.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${baseSlug}-${counter++}`;
    }

    const isPublished = input.status === 'published';
    const countries =
      input.targetCountries && input.targetCountries.length > 0
        ? input.targetCountries.map((c) => c.toUpperCase())
        : ['ALL'];
    const plans =
      input.targetPlans && input.targetPlans.length > 0
        ? input.targetPlans.map((p) => p.toLowerCase())
        : ['ALL'];
    const tags = input.tags ? input.tags.map((t) => t.trim().toLowerCase()) : [];

    const authorName = actor.email ? actor.email.split('@')[0] : 'Platform Staff';

    const created = await this.db.globalKbArticle.create({
      data: {
        categoryId: input.categoryId,
        title: input.title.trim(),
        slug: finalSlug,
        summary: input.summary.trim(),
        body: input.body.trim(),
        status: input.status || 'draft',
        published: isPublished,
        viewCount: 0,
        targetCountries: countries,
        targetPlans: plans,
        tags,
        authorUserId: actor.id || null,
        authorName,
        lastUpdatedByUserId: actor.id || null,
        lastUpdatedByName: authorName,
        publishedAt: isPublished ? new Date() : null,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    return {
      id: created.id,
      categoryId: created.categoryId,
      categoryName: created.category?.name || 'Uncategorized',
      categorySlug: created.category?.slug,
      title: created.title,
      slug: created.slug,
      summary: created.summary,
      body: created.body,
      status: (created.status as GlobalKbStatus) || (created.published ? 'published' : 'draft'),
      published: created.published,
      viewCount: created.viewCount || 0,
      targetCountries: created.targetCountries,
      targetPlans: created.targetPlans,
      tags: created.tags,
      authorUserId: created.authorUserId,
      authorName: created.authorName,
      lastUpdatedByUserId: created.lastUpdatedByUserId,
      lastUpdatedByName: created.lastUpdatedByName,
      publishedAt: created.publishedAt ? created.publishedAt.toISOString() : null,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async updateArticle(
    id: string,
    input: UpdateGlobalKbArticleInput,
    actor: PlatformActorContext,
  ): Promise<GlobalKbArticleDetail> {
    this.assertEdit(actor);

    const existing = await this.db.globalKbArticle.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }

    if (input.categoryId && input.categoryId !== existing.categoryId) {
      const cat = await this.db.globalKbCategory.findUnique({
        where: { id: input.categoryId },
      });
      if (!cat) throw new NotFoundException(`Category ${input.categoryId} not found`);
    }

    let finalSlug = existing.slug;
    if (input.slug && input.slug.trim() !== existing.slug) {
      const candidate = slugify(input.slug);
      const duplicate = await this.db.globalKbArticle.findUnique({
        where: { slug: candidate },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(`Article slug "${candidate}" is already in use`);
      }
      finalSlug = candidate;
    }

    const updaterName = actor.email ? actor.email.split('@')[0] : 'Platform Staff';
    const isNowPublished =
      input.status === 'published' || (input.status === undefined && existing.published);

    const updated = await this.db.globalKbArticle.update({
      where: { id },
      data: {
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.slug !== undefined ? { slug: finalSlug } : {}),
        ...(input.summary !== undefined ? { summary: input.summary.trim() } : {}),
        ...(input.body !== undefined ? { body: input.body.trim() } : {}),
        ...(input.status !== undefined
          ? {
              status: input.status,
              published: input.status === 'published',
              publishedAt:
                input.status === 'published'
                  ? existing.publishedAt || new Date()
                  : existing.publishedAt,
            }
          : {}),
        ...(input.targetCountries !== undefined
          ? { targetCountries: input.targetCountries.map((c) => c.toUpperCase()) }
          : {}),
        ...(input.targetPlans !== undefined
          ? { targetPlans: input.targetPlans.map((p) => p.toLowerCase()) }
          : {}),
        ...(input.tags !== undefined
          ? { tags: input.tags.map((t) => t.trim().toLowerCase()) }
          : {}),
        lastUpdatedByUserId: actor.id || null,
        lastUpdatedByName: updaterName,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    return {
      id: updated.id,
      categoryId: updated.categoryId,
      categoryName: updated.category?.name || 'Uncategorized',
      categorySlug: updated.category?.slug,
      title: updated.title,
      slug: updated.slug,
      summary: updated.summary,
      body: updated.body,
      status: (updated.status as GlobalKbStatus) || (updated.published ? 'published' : 'draft'),
      published: updated.published,
      viewCount: updated.viewCount || 0,
      targetCountries: updated.targetCountries,
      targetPlans: updated.targetPlans,
      tags: updated.tags,
      authorUserId: updated.authorUserId,
      authorName: updated.authorName,
      lastUpdatedByUserId: updated.lastUpdatedByUserId,
      lastUpdatedByName: updated.lastUpdatedByName,
      publishedAt: updated.publishedAt ? updated.publishedAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteArticle(id: string, actor: PlatformActorContext): Promise<{ success: boolean; id: string }> {
    this.assertEdit(actor);

    const existing = await this.db.globalKbArticle.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }

    await this.db.globalKbArticle.delete({ where: { id } });
    return { success: true, id };
  }

  async incrementViewCount(id: string): Promise<IncrementArticleViewResult> {
    const existing = await this.db.globalKbArticle.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Article ${id} not found`);

    const updated = await this.db.globalKbArticle.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
    });

    return {
      articleId: id,
      viewCount: updated.viewCount,
    };
  }

  // ==========================================
  // Seeding Default Global Articles & Categories
  // ==========================================

  async seedInitialGlobalArticlesIfEmpty(): Promise<void> {
    try {
      const categoryCount = await this.db.globalKbCategory.count();
      if (categoryCount > 0) return;

      this.logger.log('Seeding initial Global Knowledge Base categories and articles...');

      const defaultCategories = [
        {
          name: 'Getting Started & Onboarding',
          slug: 'getting-started',
          description: 'Essential platform setup, role delegations, and tenant workspace activation guides.',
          icon: 'Sparkles',
          sortOrder: 1,
        },
        {
          name: 'Payroll & Statutory Compliance',
          slug: 'payroll-compliance',
          description: 'Country-specific tax brackets, social security deductions, and statutory filing workflows.',
          icon: 'DollarSign',
          sortOrder: 2,
        },
        {
          name: 'Attendance & Workforce Scheduling',
          slug: 'attendance-scheduling',
          description: 'Biometric device synchronization, offline punch buffering, and shift roster management.',
          icon: 'Clock',
          sortOrder: 3,
        },
        {
          name: 'Security, SSO & Auditing',
          slug: 'security-sso-audit',
          description: 'Enterprise SAML/OIDC configuration, field encryption keys, and immutable audit inspection.',
          icon: 'Shield',
          sortOrder: 4,
        },
        {
          name: 'API, Integrations & Webhooks',
          slug: 'api-webhooks',
          description: 'REST API token generation, webhook signature verification, and BullMQ queue monitoring.',
          icon: 'Terminal',
          sortOrder: 5,
        },
      ];

      const createdCats: Record<string, string> = {};
      for (const cat of defaultCategories) {
        const row = await this.db.globalKbCategory.create({
          data: cat,
        });
        createdCats[cat.slug] = row.id;
      }

      const seedArticles = [
        {
          categoryId: createdCats['getting-started'],
          title: 'Tenant Workspace Provisioning & Domain Setup',
          slug: 'tenant-workspace-provisioning',
          summary: 'Complete guide to initial tenant creation, subdomain routing, and custom domain SSL verification.',
          body: `## Overview\nEvery customer organization provisioned on the platform operates inside an isolated tenant context identified by a tenant UUID and subdomain.\n\n### Step-by-Step Provisioning\n1. Navigate to **Tenants Directory** in the platform console.\n2. Click **Provision Tenant** and input legal company name and subdomain prefix.\n3. Configure primary payroll currency and operating jurisdiction.\n4. DNS verification for custom domains requires a CNAME record pointing to \`domains.hrm.local\`.\n\n### Security & Isolation\nAs defined in **RULES.md §1**, all tenant database queries are scoped by \`tenant_id\` derived from authenticated JWT sessions.`,
          status: 'published',
          published: true,
          viewCount: 428,
          targetCountries: ['ALL'],
          targetPlans: ['ALL'],
          tags: ['setup', 'provisioning', 'domains'],
          authorName: 'Platform Engineering',
          publishedAt: new Date(Date.now() - 30 * 86400000),
        },
        {
          categoryId: createdCats['payroll-compliance'],
          title: 'UK PAYE & National Insurance Statutory Configuration',
          slug: 'uk-paye-statutory-configuration',
          summary: 'Detailed explanation of HMRC progressive tax bands, student loan deductions, and RTI export.',
          body: `## UK Payroll Architecture\nWhen calculating payroll for United Kingdom entities, the Rule Resolver evaluates:\n\n- Global Defaults → Country Rules (GB) → Contract Tiers\n\n### Tax Brackets\n- Standard Personal Allowance: £12,570 (0%)\n- Basic Rate (20%): £12,571 to £50,270\n- Higher Rate (40%): £50,271 to £125,140\n- Additional Rate (45%): Over £125,140\n\n### Audit Immutability\nFinalized UK payroll runs cannot be modified. Corrections generate linked \`payroll_adjustments\` records.`,
          status: 'published',
          published: true,
          viewCount: 312,
          targetCountries: ['GB'],
          targetPlans: ['business', 'enterprise'],
          tags: ['uk', 'paye', 'tax', 'hmrc'],
          authorName: 'Compliance Team',
          publishedAt: new Date(Date.now() - 25 * 86400000),
        },
        {
          categoryId: createdCats['payroll-compliance'],
          title: 'US Federal W-4 & State Withholding Engine',
          slug: 'us-w4-state-withholding-engine',
          summary: 'Overview of IRS Form W-4 calculations, state income tax variation, and FICA deduction logic.',
          body: `## US Tax Calculation Overview\nThe US payroll engine models federal income tax brackets and state-level payroll rules across all 50 states.\n\n### Parameters Handled\n- Single, Married Filing Jointly, Head of Household\n- Form W-4 Step 2 multiple jobs checkbox\n- Claim dependent credits & other adjustments\n- Social Security (6.2% up to annual cap) & Medicare (1.45%)`,
          status: 'published',
          published: true,
          viewCount: 295,
          targetCountries: ['US'],
          targetPlans: ['business', 'enterprise'],
          tags: ['us', 'w4', 'irs', 'tax'],
          authorName: 'Compliance Team',
          publishedAt: new Date(Date.now() - 20 * 86400000),
        },
        {
          categoryId: createdCats['attendance-scheduling'],
          title: 'Offline Attendance Punch Sync & Skew Resolution',
          slug: 'offline-attendance-punch-sync',
          summary: 'How mobile biometric punches are queued locally, signed with UUID local_id, and resolved server-side.',
          body: `## Offline Punch Protocol\nMobile clients buffering attendance punches without internet access follow **OFFLINE_SYNC.md** §4:\n\n1. Punch entity generates a client UUID \`local_id\`.\n2. Payload submitted with idempotency protection: \`UNIQUE(employee_id, local_id)\`.\n3. Server clock provides authoritative payroll timestamp.\n4. Clock skew > 120 seconds triggers an automatic \`time_anomaly\` review flag.`,
          status: 'published',
          published: true,
          viewCount: 518,
          targetCountries: ['ALL'],
          targetPlans: ['business', 'enterprise'],
          tags: ['attendance', 'offline-sync', 'mobile'],
          authorName: 'Workforce Operations',
          publishedAt: new Date(Date.now() - 15 * 86400000),
        },
        {
          categoryId: createdCats['security-sso-audit'],
          title: 'Configuring Enterprise SAML 2.0 & Okta / Azure AD',
          slug: 'enterprise-saml-okta-azure-setup',
          summary: 'Prerequisites, entity IDs, assertion endpoints, and role claim mappings for enterprise single sign-on.',
          body: `## SAML 2.0 Single Sign-On\nAvailable exclusively on **Enterprise plans**, SAML allows federated authentication.\n\n### Identity Provider Parameters\n- ACS Endpoint: \`https://app.hrm.local/api/v1/auth/saml/callback\`\n- Entity ID / Audience: \`urn:hrm:saml:sp\`\n- NameID Format: \`urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress\`\n\n### Just-In-Time (JIT) Provisioning\nNew staff members authenticating through SAML are assigned default employee roles automatically.`,
          status: 'published',
          published: true,
          viewCount: 642,
          targetCountries: ['ALL'],
          targetPlans: ['enterprise'],
          tags: ['sso', 'saml', 'okta', 'security'],
          authorName: 'Security Lead',
          publishedAt: new Date(Date.now() - 12 * 86400000),
        },
        {
          categoryId: createdCats['api-webhooks'],
          title: 'Webhook Event Delivery, Retries & HMAC Signatures',
          slug: 'webhook-delivery-hmac-signatures',
          summary: 'Verifying X-HRM-Signature HMAC-SHA256 headers, exponential backoff retries, and delivery dead-letter handling.',
          body: `## Webhook Security\nAll outgoing webhook payloads dispatched via BullMQ queue include the signature header \`X-HRM-Signature\`.\n\n### Verification Example\nCompute \`crypto.createHmac('sha256', secret).update(rawPayload).digest('hex')\` and verify with timing-safe comparison.\n\n### Retries\nFailed webhook calls retry with exponential backoff: 1m, 5m, 15m, 1h, then park into dead-letter state.`,
          status: 'published',
          published: true,
          viewCount: 184,
          targetCountries: ['ALL'],
          targetPlans: ['business', 'enterprise'],
          tags: ['webhooks', 'api', 'integrations'],
          authorName: 'Platform Engineering',
          publishedAt: new Date(Date.now() - 8 * 86400000),
        },
        {
          categoryId: createdCats['getting-started'],
          title: 'Configuring Australian Superannuation Funds (Draft)',
          slug: 'australian-superannuation-draft',
          summary: 'Draft guidelines for SuperStream electronic reporting, default APRA fund selection, and 11.5% SG rate.',
          body: `## Australian Superannuation SG Overview\nDraft documentation for statutory superannuation guarantee compliance in Australia.\n\n### Key Regulations\n- SG Rate: 11.5% for current fiscal year\n- Choice of Fund form submission within 28 days of hire\n- Quarterly payment deadlines (28th day of month following quarter end).`,
          status: 'draft',
          published: false,
          viewCount: 12,
          targetCountries: ['AU'],
          targetPlans: ['ALL'],
          tags: ['australia', 'superannuation', 'draft'],
          authorName: 'Compliance Team',
          publishedAt: null,
        },
      ];

      for (const art of seedArticles) {
        await this.db.globalKbArticle.create({
          data: art,
        });
      }

      this.logger.log(`Successfully seeded ${defaultCategories.length} categories and ${seedArticles.length} global articles.`);
    } catch (err: any) {
      this.logger.warn(`Could not seed global KB articles (might already exist): ${err.message}`);
    }
  }
}
