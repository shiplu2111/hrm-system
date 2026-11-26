import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CMS_SYSTEM_PAGE_DEFS,
  isSafeCmsLinkUrl,
  type CmsActiveEditorDto,
  type CmsApprovalStatus,
  type CmsAuthorDto,
  type CmsBrokenLinkOccurrenceDto,
  type CmsCareerDto,
  type CmsChangelogEntryDto,
  type CmsCustomPageTemplate,
  type CmsDashboardPageSummaryDto,
  type CmsDashboardSummaryDto,
  type CmsDeleteImpactMenuRefDto,
  type CmsDeleteImpactPageRefDto,
  type CmsDeleteImpactRedirectOptionDto,
  type CmsFaqDto,
  type CmsLocale,
  type CmsMediaDto,
  type CmsMediaUsageDto,
  type CmsMediaVariantDto,
  type CmsMediaVariantKey,
  type CmsMenuDto,
  type CmsPageDeletionImpactDto,
  type CmsPageDetailDto,
  type CmsPageDto,
  type CmsPagePresenceResponseDto,
  type CmsPageStatus,
  type CmsPageVersionDto,
  type CmsPostCategoryDto,
  type CmsPostDto,
  type CmsPreviewTokenResponseDto,
  type CmsPublicBlogListResultDto,
  type CmsPublicFaqDto,
  type CmsPublicPostDto,
  type CmsPublicPostSummaryDto,
  type CmsPublicSitemapPageDto,
  type CmsRecentChangeItemDto,
  type CmsRedirectCsvImportResultDto,
  type CmsRedirectRuleDto,
  type CmsRedirectType,
  type CmsResolvedPageDto,
  type CmsSiteSettingDto,
  type CmsSiteSettingsBundleDto,
  type CmsSlugAvailabilityDto,
  type CmsTranslationStatus,
  type CmsUpdateMediaInput,
  type DuplicateCmsPageInput,
  type PermanentDeleteCmsPageInput,
  type ReorderCmsMenuItemsInput,
  type TrashCmsPageInput,
  type UpsertCmsMenuItemInput,
  type UpsertCmsRedirectInput,
} from '@hrm/shared-types';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { getRedisConnection, isRedisConfigured } from '../../queue/redis.connection';
import { PlatformActorContext, PlatformAuditService } from '../audit/platform-audit.service';
import {
  CMS_RESERVED_SLUG_SET,
  CMS_SLUG_REGEX,
} from './cms.constants';
import {
  assertCmsEditAllowed,
  assertCmsLegalApprovalSatisfied,
  assertCmsPublishAllowed,
  assertNoRedirectLoopOrChain,
  assertSystemPageMutationAllowed,
  assertSystemPageStructurePreserved,
  assertValidCmsLocale,
  assertValidCmsSlug,
  buildCmsLinkResolutionContext,
  collectBlockLinks,
  collectMediaReferencesFromBlocks,
  computeCmsReadingTimeMinutes,
  findBrokenCmsLinksInBlocks,
  isLegalCmsPage,
  normalizeInternalCmsPath,
  normalizeRedirectSourcePath,
  parseScheduledDateInTimezone,
  resolveLocalizedPageVersion,
} from './cms.utils';
import { validateAndSanitizeCmsBlocks } from './cms-blocks.validator';
import {
  normalizeCmsMediaTags,
  processCmsMediaUpload,
} from './cms-media.processor';
import { sanitizeCmsRichTextHtml } from './cms-sanitizer';
import { signCmsPreviewToken, verifyCmsPreviewToken } from './cms-preview.token';
import {
  CmsRevalidationService,
  type TriggerCmsRevalidatePayload,
} from './cms-revalidation.service';

const CMS_PRESENCE_TTL_MS = 45_000;

function normalizeCmsMediaFolder(raw?: string | null): string {
  const cleaned = (raw || 'general')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return cleaned || 'general';
}

@Injectable()
export class PlatformCmsService {
  private readonly fallbackPresence = new Map<string, Map<string, CmsActiveEditorDto>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformAudit: PlatformAuditService,
    @Optional() private readonly storageService?: StorageService,
    @Optional() private readonly revalidationService?: CmsRevalidationService,
  ) { }

  private get db() {
    return this.prisma.unscoped;
  }

  private triggerRevalidate(payload: TriggerCmsRevalidatePayload): void {
    if (!this.revalidationService) return;
    void this.revalidationService.trigger(payload).catch(() => false);
  }

  // =========================================================================
  // Pages: Read, Draft, Version, Preview, Approval, Publish, Schedule, Trash
  // =========================================================================

  async listPages(filters?: {
    status?: CmsPageStatus | 'all';
    kind?: 'system' | 'custom' | 'all';
    search?: string;
    includeTrashed?: boolean;
  }): Promise<CmsPageDto[]> {
    const where: Prisma.CmsPageWhereInput = {};

    if (!filters?.includeTrashed && filters?.status !== 'trashed') {
      where.deletedAt = null;
    }

    if (filters?.status && filters.status !== 'all') {
      where.status = filters.status;
    }

    if (filters?.kind && filters.kind !== 'all') {
      where.kind = filters.kind;
    }

    if (filters?.search?.trim()) {
      where.slug = { contains: filters.search.trim().toLowerCase(), mode: 'insensitive' };
    }

    const pages = await this.db.cmsPage.findMany({
      where,
      include: { locales: true },
      orderBy: [{ kind: 'asc' }, { slug: 'asc' }],
    });

    const systemDefBySlug = new Map<string, (typeof CMS_SYSTEM_PAGE_DEFS)[number]>(
      CMS_SYSTEM_PAGE_DEFS.map((d) => [d.slug, d]),
    );

    const activeVersionIds = Array.from(
      new Set(
        pages.flatMap((p) => [
          ...(p.currentPublishedVersionId ? [p.currentPublishedVersionId] : []),
          ...p.locales.flatMap((l) => [
            ...(l.currentDraftVersionId ? [l.currentDraftVersionId] : []),
            ...(l.currentPublishedVersionId ? [l.currentPublishedVersionId] : []),
          ]),
        ]),
      ),
    );

    const activeVersions =
      activeVersionIds.length > 0 && typeof this.db.cmsPageVersion?.findMany === 'function'
        ? await this.db.cmsPageVersion.findMany({
          where: { id: { in: activeVersionIds } },
          select: {
            id: true,
            pageId: true,
            locale: true,
            title: true,
            canonicalPath: true,
            authorId: true,
            authorName: true,
            createdAt: true,
            author: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        })
        : [];

    const versionById = new Map(activeVersions.map((v) => [v.id, v]));

    // Determine latest version edit per page across all locales for "last edited by & when"
    const pageIds = pages.map((p) => p.id);
    const latestVersions =
      pageIds.length > 0 && typeof this.db.cmsPageVersion?.findMany === 'function'
        ? await this.db.cmsPageVersion.findMany({
          where: { pageId: { in: pageIds } },
          orderBy: [{ createdAt: 'desc' }],
          select: {
            pageId: true,
            authorId: true,
            authorName: true,
            createdAt: true,
            author: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        })
        : [];

    const latestEditByPageId = new Map<
      string,
      { authorId: string | null; authorName: string | null; createdAt: Date }
    >();
    for (const ver of latestVersions) {
      if (latestEditByPageId.has(ver.pageId)) continue;
      const authorDisplay = ver.author
        ? `${ver.author.firstName} ${ver.author.lastName}`.trim() || ver.author.email
        : ver.authorName ?? null;
      latestEditByPageId.set(ver.pageId, {
        authorId: ver.authorId ?? null,
        authorName: authorDisplay,
        createdAt: ver.createdAt,
      });
    }

    const retentionDays = await this.getTrashRetentionDays();

    return pages.map((p) => {
      const enLoc = p.locales.find((l) => l.locale === 'en');
      const bnLoc = p.locales.find((l) => l.locale === 'bn');
      const enVer =
        versionById.get(
          enLoc?.currentDraftVersionId ??
          enLoc?.currentPublishedVersionId ??
          p.currentPublishedVersionId ??
          '',
        ) ?? null;
      const bnVer =
        versionById.get(
          bnLoc?.currentDraftVersionId ?? bnLoc?.currentPublishedVersionId ?? '',
        ) ?? null;
      const sysDef = systemDefBySlug.get(p.slug);
      const latestEdit = latestEditByPageId.get(p.id);
      const canonicalPath =
        enVer?.canonicalPath ||
        sysDef?.canonicalPath ||
        (p.kind === 'custom' ? `/p/${p.slug}` : `/${p.slug}`);
      const purgeAt = p.deletedAt
        ? new Date(p.deletedAt.getTime() + retentionDays * 86_400_000).toISOString()
        : null;

      return {
        ...this.mapPageDto(p),
        titleEn: enVer?.title ?? sysDef?.titleEn ?? null,
        titleBn: bnVer?.title ?? sysDef?.titleBn ?? null,
        canonicalPath,
        purgeAt,
        trashRetentionDays: retentionDays,
        lastEditedById: latestEdit?.authorId ?? null,
        lastEditedByName: latestEdit?.authorName ?? 'Platform Seed',
        lastEditedAt: (latestEdit?.createdAt ?? p.updatedAt).toISOString(),
      };
    });
  }

  async getDashboardSummary(): Promise<CmsDashboardSummaryDto> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      pages,
      posts,
      careers,
      redirects,
      mediaRows,
      categories,
      authors,
      auditLogs,
    ] = await Promise.all([
      this.db.cmsPage.findMany({
        where: { deletedAt: null },
        include: { locales: true },
        orderBy: [{ updatedAt: 'desc' }],
      }),
      this.db.cmsPost.findMany({
        where: { deletedAt: null },
        orderBy: [{ updatedAt: 'desc' }],
      }),
      this.db.cmsCareer.findMany({
        select: { slug: true, status: true },
      }),
      this.db.cmsRedirect.findMany({
        where: { isActive: true },
        select: { sourcePath: true },
      }),
      this.db.cmsMedia.findMany({
        select: { id: true },
      }),
      this.db.cmsPostCategory.findMany({
        orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
        select: { id: true, slug: true, nameEn: true },
      }),
      this.db.cmsAuthor.findMany({
        where: { isActive: true },
        orderBy: [{ displayName: 'asc' }],
        select: { id: true, slug: true, displayName: true },
      }),
      this.db.platformAuditLog.findMany({
        where: { module: 'cms' },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    ]);

    // Load active (draft/published) version snapshots for title, canonicalPath, and link scanning
    const activeVersionIds = Array.from(
      new Set(
        pages.flatMap((p) => [
          ...(p.currentPublishedVersionId ? [p.currentPublishedVersionId] : []),
          ...p.locales.flatMap((l) => [
            ...(l.currentDraftVersionId ? [l.currentDraftVersionId] : []),
            ...(l.currentPublishedVersionId ? [l.currentPublishedVersionId] : []),
          ]),
        ]),
      ),
    );

    const activeVersions =
      activeVersionIds.length > 0
        ? await this.db.cmsPageVersion.findMany({
          where: { id: { in: activeVersionIds } },
          select: {
            id: true,
            pageId: true,
            locale: true,
            versionNumber: true,
            title: true,
            canonicalPath: true,
            blocks: true,
          },
        })
        : [];

    const versionById = new Map(activeVersions.map((v) => [v.id, v]));

    const linkContext = buildCmsLinkResolutionContext({
      pageSlugs: pages.map((p) => p.slug),
      canonicalPaths: activeVersions
        .map((v) => v.canonicalPath)
        .filter((c): c is string => Boolean(c)),
      redirectSourcePaths: redirects.map((r) => r.sourcePath),
      postSlugs: posts.map((p) => p.slug),
      careerSlugs: careers.map((c) => c.slug),
      mediaIds: mediaRows.map((m) => m.id),
    });

    const brokenLinkPages: CmsDashboardSummaryDto['brokenLinkPages'] = [];
    const pageSummaries: CmsDashboardPageSummaryDto[] = [];

    for (const page of pages) {
      const enLocale = page.locales.find((l) => l.locale === 'en');
      const bnLocale = page.locales.find((l) => l.locale === 'bn');
      const enVersionId =
        enLocale?.currentDraftVersionId ??
        enLocale?.currentPublishedVersionId ??
        page.currentPublishedVersionId;
      const enVersion = enVersionId ? versionById.get(enVersionId) : undefined;

      // Scan the active draft/published versions of EN and BN (deduplicated by version id)
      const scannedVersionIds = new Set<string>();
      const pageBrokenOccurrences: CmsBrokenLinkOccurrenceDto[] = [];
      for (const vid of [
        enLocale?.currentDraftVersionId,
        enLocale?.currentPublishedVersionId,
        bnLocale?.currentDraftVersionId,
        bnLocale?.currentPublishedVersionId,
        page.currentPublishedVersionId,
      ]) {
        if (!vid || scannedVersionIds.has(vid)) continue;
        scannedVersionIds.add(vid);
        const version = versionById.get(vid);
        if (!version) continue;
        pageBrokenOccurrences.push(
          ...findBrokenCmsLinksInBlocks({
            pageId: page.id,
            slug: page.slug,
            pageStatus: page.status,
            locale: version.locale,
            versionNumber: version.versionNumber,
            blocks: version.blocks,
            context: linkContext,
          }),
        );
      }

      if (pageBrokenOccurrences.length > 0) {
        brokenLinkPages.push({
          pageId: page.id,
          slug: page.slug,
          pageStatus: page.status,
          brokenCount: pageBrokenOccurrences.length,
          occurrences: pageBrokenOccurrences,
        });
      }

      const isBnTranslated = Boolean(
        bnLocale?.isTranslated && bnLocale.translationStatus === 'translated',
      );
      const bnTranslationStatus: CmsTranslationStatus =
        bnLocale?.translationStatus ?? 'untranslated';

      pageSummaries.push({
        id: page.id,
        slug: page.slug,
        kind: page.kind,
        status: page.status,
        locked: page.locked,
        requiresApproval: page.requiresApproval,
        approvalStatus: page.approvalStatus,
        titleEn: enVersion?.title ?? null,
        bnTranslationStatus,
        isBnTranslated,
        brokenLinksCount: pageBrokenOccurrences.length,
        scheduledAt: page.scheduledAt?.toISOString() ?? null,
        scheduledTimezone: page.scheduledTimezone ?? null,
        publishedAt: page.publishedAt?.toISOString() ?? null,
        updatedAt: page.updatedAt.toISOString(),
      });
    }

    const draftPages = pageSummaries.filter((p) => p.status === 'draft');
    const scheduledPages = pageSummaries
      .filter((p) => p.status === 'scheduled')
      .sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''));
    const pendingApprovalPages = pageSummaries.filter(
      (p) => p.approvalStatus === 'pending_approval',
    );
    const recentlyPublishedPages = pageSummaries
      .filter(
        (p) =>
          p.status === 'published' &&
          p.publishedAt &&
          new Date(p.publishedAt).getTime() >= thirtyDaysAgo.getTime(),
      )
      .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
    const missingBnPages = pageSummaries.filter((p) => !p.isBnTranslated);

    const draftPosts = posts.filter((p) => p.status === 'draft');

    const recentChanges: CmsRecentChangeItemDto[] = auditLogs.map((entry) => {
      const fullName = entry.user
        ? `${entry.user.firstName} ${entry.user.lastName}`.trim() || entry.user.email
        : 'System Scheduler';
      return {
        id: entry.id,
        action: entry.action,
        module: entry.module,
        recordId: entry.recordId ?? null,
        summary: entry.reason || entry.action,
        actorId: entry.userId ?? null,
        actorName: fullName,
        actorEmail: entry.user?.email ?? null,
        createdAt: entry.createdAt.toISOString(),
      };
    });

    return {
      counts: {
        totalPages: pageSummaries.length,
        drafts: draftPages.length,
        scheduled: scheduledPages.length,
        pendingApproval: pendingApprovalPages.length,
        recentlyPublished: recentlyPublishedPages.length,
        missingBengaliTranslation: missingBnPages.length,
        pagesWithBrokenLinks: brokenLinkPages.length,
        totalPosts: posts.length,
        draftPosts: draftPosts.length,
      },
      draftPages,
      scheduledPages,
      pendingApprovalPages,
      recentlyPublishedPages,
      missingBnPages,
      brokenLinkPages,
      recentChanges,
      postCategories: categories,
      authors,
      recentPosts: posts.slice(0, 8).map((p) => this.mapPostDto(p)),
      recentPages: pageSummaries.slice(0, 20),
    };
  }

  async getPageDetail(pageId: string): Promise<CmsPageDetailDto> {
    const page = await this.db.cmsPage.findUnique({
      where: { id: pageId },
      include: {
        locales: true,
        versions: {
          orderBy: [{ locale: 'asc' }, { versionNumber: 'desc' }],
        },
      },
    });

    if (!page) {
      throw new NotFoundException(`CMS page "${pageId}" not found.`);
    }

    return {
      page: this.mapPageDto(page),
      versions: page.versions.map((v) => this.mapVersionDto(v)),
    };
  }

  async checkSlugAvailability(rawSlug: string): Promise<CmsSlugAvailabilityDto> {
    const normalized = (rawSlug || '').trim().toLowerCase();
    if (!normalized) {
      return {
        slug: '',
        valid: false,
        available: false,
        reserved: false,
        reason: 'Slug cannot be empty.',
      };
    }

    if (CMS_RESERVED_SLUG_SET.has(normalized)) {
      return {
        slug: normalized,
        valid: false,
        available: false,
        reserved: true,
        reason: `Slug "${normalized}" is reserved by platform routing and cannot be used.`,
      };
    }

    if (rawSlug.trim() !== normalized || !CMS_SLUG_REGEX.test(normalized)) {
      return {
        slug: normalized,
        valid: false,
        available: false,
        reserved: false,
        reason: 'Slug must be lowercase letters (a-z), digits (0-9), and single hyphens only.',
      };
    }

    const existing = await this.db.cmsPage.findUnique({
      where: { slug: normalized },
      select: { id: true, status: true },
    });
    if (existing) {
      return {
        slug: normalized,
        valid: true,
        available: false,
        reserved: false,
        reason: `Slug "/${normalized}" is already in use (${existing.status}).`,
      };
    }

    return {
      slug: normalized,
      valid: true,
      available: true,
      reserved: false,
      reason: null,
    };
  }

  async createCustomPage(
    input: {
      slug: string;
      titleEn: string;
      seoTitleEn?: string;
      seoDescriptionEn?: string;
      ogImageUrlEn?: string;
      blocksEn?: unknown;
      templateKey?: CmsCustomPageTemplate;
      requiresApproval?: boolean;
      menuId?: string;
      menuItemLabelEn?: string;
      menuItemLabelBn?: string;
      changeNote?: string;
    },
    actor: PlatformActorContext,
  ): Promise<CmsPageDto> {
    assertCmsEditAllowed(actor);
    const slug = assertValidCmsSlug(input.slug, { checkReserved: true });
    const sanitizedBlocks = validateAndSanitizeCmsBlocks(input.blocksEn ?? []);

    const existingSlug = await this.db.cmsPage.findUnique({ where: { slug } });
    if (existingSlug) {
      throw new ConflictException({
        code: 'CMS_SLUG_EXISTS',
        message: `CMS page with slug "${slug}" already exists.`,
      });
    }

    const requiresApproval =
      Boolean(input.requiresApproval) ||
      input.templateKey === 'legal' ||
      isLegalCmsPage(slug, false);

    if (input.menuId) {
      const targetMenu = await this.db.cmsMenu.findUnique({
        where: { id: input.menuId },
        select: { id: true },
      });
      if (!targetMenu) {
        throw new NotFoundException(`Selected menu "${input.menuId}" not found.`);
      }
    }

    const created = await this.db.$transaction(async (tx) => {
      const page = await tx.cmsPage.create({
        data: {
          kind: 'custom',
          slug,
          status: 'draft',
          locked: false,
          requiresApproval,
        },
      });

      const v1 = await tx.cmsPageVersion.create({
        data: {
          pageId: page.id,
          versionNumber: 1,
          locale: 'en',
          title: input.titleEn.trim(),
          seoTitle: input.seoTitleEn?.trim() || null,
          seoDescription: input.seoDescriptionEn?.trim() || null,
          canonicalPath: `/${slug}`,
          ogImageUrl: input.ogImageUrlEn?.trim() || null,
          blocks: sanitizedBlocks as unknown as Prisma.InputJsonValue,
          isTranslated: true,
          authorId: actor.id ?? null,
          authorName: actor.email ?? 'Platform Editor',
          changeNote:
            input.changeNote?.trim() ||
            `Initial draft version (${input.templateKey || 'standard'} template)`,
        },
      });

      await tx.cmsPageLocale.createMany({
        data: [
          {
            pageId: page.id,
            locale: 'en',
            isTranslated: true,
            translationStatus: 'translated',
            currentDraftVersionId: v1.id,
          },
          {
            pageId: page.id,
            locale: 'bn',
            isTranslated: false,
            translationStatus: 'untranslated',
          },
        ],
      });

      if (input.menuId) {
        const lastMenuItem = await tx.cmsMenuItem.findFirst({
          where: { menuId: input.menuId, parentId: null },
          orderBy: { sortOrder: 'desc' },
          select: { sortOrder: true },
        });
        await tx.cmsMenuItem.create({
          data: {
            menuId: input.menuId,
            labelEn: input.menuItemLabelEn?.trim() || input.titleEn.trim(),
            labelBn: input.menuItemLabelBn?.trim() || null,
            targetPageId: page.id,
            href: `/${slug}`,
            sortOrder: (lastMenuItem?.sortOrder ?? -1) + 1,
            isVisible: true,
          },
        });
      }

      return tx.cmsPage.findUniqueOrThrow({
        where: { id: page.id },
        include: { locales: true },
      });
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.page_created',
      module: 'cms',
      recordId: created.id,
      reason: `Created custom CMS page "${slug}"`,
      oldValue: null,
      newValue: {
        slug: created.slug,
        kind: created.kind,
        status: created.status,
        requiresApproval: created.requiresApproval,
        templateKey: input.templateKey ?? 'standard',
        menuId: input.menuId ?? null,
      },
    });

    return {
      ...this.mapPageDto(created),
      titleEn: input.titleEn.trim(),
      canonicalPath: `/${slug}`,
      lastEditedById: actor.id ?? null,
      lastEditedByName: actor.email ?? 'Platform Editor',
      lastEditedAt: created.createdAt.toISOString(),
    };
  }

  /**
   * Appends a new immutable snapshot row in `cms_page_versions`. Existing version
   * rows are never mutated once saved (enforced in DB trigger + service API).
   */
  async createPageVersion(
    pageId: string,
    input: {
      locale: CmsLocale;
      title: string;
      seoTitle?: string | null;
      seoDescription?: string | null;
      canonicalPath?: string | null;
      ogImageUrl?: string | null;
      noIndex?: boolean;
      blocks: unknown;
      isTranslated?: boolean;
      translationStatus?: CmsTranslationStatus;
      changeNote?: string | null;
      publishImmediately?: boolean;
      baseVersionId?: string;
      expectedVersionNumber?: number;
      isAutosave?: boolean;
      forceOverwrite?: boolean;
    },
    actor: PlatformActorContext,
  ): Promise<CmsPageVersionDto> {
    assertCmsEditAllowed(actor);
    if (input.publishImmediately) {
      assertCmsPublishAllowed(actor);
    }

    const locale = assertValidCmsLocale(input.locale);
    const sanitizedBlocks = validateAndSanitizeCmsBlocks(input.blocks);
    const page = await this.db.cmsPage.findUnique({
      where: { id: pageId },
      include: { locales: true },
    });
    if (!page || page.deletedAt || page.status === 'trashed') {
      throw new NotFoundException(`CMS page "${pageId}" not found.`);
    }

    if (input.publishImmediately && isLegalCmsPage(page.slug, page.requiresApproval)) {
      throw new ForbiddenException({
        code: 'CMS_LEGAL_APPROVAL_REQUIRED',
        message: `Legal page "${page.slug}" cannot be published immediately on save; submit for Stage F four-eyes approval first.`,
      });
    }

    // Lock system/fixed layouts and dynamic placeholders (`pricing_table`, `country_list`, `plan_comparison`)
    if (page.kind === 'system' || page.locked) {
      const enLoc = page.locales.find((l) => l.locale === 'en');
      const curLoc = page.locales.find((l) => l.locale === locale);
      const baselineVersionId =
        enLoc?.currentPublishedVersionId ||
        enLoc?.currentDraftVersionId ||
        page.currentPublishedVersionId ||
        curLoc?.currentDraftVersionId;
      if (baselineVersionId && typeof this.db.cmsPageVersion?.findUnique === 'function') {
        const baselineVersion = await this.db.cmsPageVersion.findUnique({
          where: { id: baselineVersionId },
          select: { blocks: true },
        });
        if (baselineVersion) {
          assertSystemPageStructurePreserved({
            pageSlug: page.slug,
            kind: page.kind,
            locked: page.locked,
            baselineBlocks: baselineVersion.blocks,
            candidateBlocks: sanitizedBlocks,
          });
        }
      }
    }

    const previousLocale = page.locales.find((l) => l.locale === locale);
    const latest = await this.db.cmsPageVersion.findFirst({
      where: { pageId, locale },
      orderBy: { versionNumber: 'desc' },
    });

    if (!input.forceOverwrite) {
      const latestNum = latest?.versionNumber ?? 0;
      const versionIdMismatch = Boolean(
        input.baseVersionId && latest?.id && latest.id !== input.baseVersionId,
      );
      const versionNumMismatch = Boolean(
        input.expectedVersionNumber !== undefined &&
        latestNum !== input.expectedVersionNumber,
      );

      if (versionIdMismatch || versionNumMismatch) {
        throw new ConflictException({
          code: 'CMS_VERSION_CONFLICT',
          message: `Version conflict on "/${page.slug}" (${locale.toUpperCase()}): ${latest?.authorName || 'another editor'
            } saved v${latestNum} since you opened this draft. Choose how to merge or overwrite before saving.`,
          expectedVersionNumber: input.expectedVersionNumber ?? null,
          currentLatestVersion: latest ? this.mapVersionDto(latest) : null,
        });
      }
    }

    const nextVersionNumber = (latest?.versionNumber ?? 0) + 1;
    const isTranslated = input.isTranslated ?? locale === 'en';
    const translationStatus: CmsTranslationStatus =
      input.translationStatus ?? (isTranslated ? 'translated' : 'untranslated');

    const beforeState = {
      pageStatus: page.status,
      approvalStatus: page.approvalStatus,
      pendingApprovalVersionId: page.pendingApprovalVersionId,
      currentPublishedVersionId: page.currentPublishedVersionId,
      locale,
      currentDraftVersionId: previousLocale?.currentDraftVersionId ?? null,
      localePublishedVersionId: previousLocale?.currentPublishedVersionId ?? null,
    };

    const result = await this.db.$transaction(async (tx) => {
      const createdVersion = await tx.cmsPageVersion.create({
        data: {
          pageId,
          versionNumber: nextVersionNumber,
          locale,
          title: input.title.trim(),
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          canonicalPath: input.canonicalPath ?? null,
          ogImageUrl: input.ogImageUrl ?? null,
          noIndex: Boolean(input.noIndex),
          blocks: sanitizedBlocks as unknown as Prisma.InputJsonValue,
          isTranslated,
          authorId: actor.id ?? null,
          authorName: actor.email ?? 'Platform Editor',
          changeNote: input.changeNote ?? null,
        },
      });

      await tx.cmsPageLocale.upsert({
        where: { pageId_locale: { pageId, locale } },
        create: {
          pageId,
          locale,
          isTranslated,
          translationStatus,
          currentDraftVersionId: createdVersion.id,
          ...(input.publishImmediately ? { currentPublishedVersionId: createdVersion.id } : {}),
        },
        update: {
          isTranslated,
          translationStatus,
          currentDraftVersionId: createdVersion.id,
          ...(input.publishImmediately ? { currentPublishedVersionId: createdVersion.id } : {}),
        },
      });

      const resetLegalApproval =
        isLegalCmsPage(page.slug, page.requiresApproval) && !input.publishImmediately;

      const updatedPage = await tx.cmsPage.update({
        where: { id: pageId },
        data: {
          ...(resetLegalApproval
            ? {
              approvalStatus: 'none',
              pendingApprovalVersionId: null,
            }
            : {}),
          ...(input.publishImmediately
            ? {
              status: 'published',
              publishedAt: page.publishedAt ?? new Date(),
              scheduledAt: null,
              scheduledTimezone: null,
              scheduledById: null,
              ...(locale === 'en' || !page.currentPublishedVersionId
                ? { currentPublishedVersionId: createdVersion.id }
                : {}),
            }
            : {}),
        },
      });

      return { createdVersion, updatedPage };
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: input.publishImmediately
        ? 'cms.page_version_published'
        : input.isAutosave
          ? 'cms.page_version_autosaved'
          : 'cms.page_version_created',
      module: 'cms',
      recordId: pageId,
      reason:
        input.changeNote ??
        `${input.isAutosave ? 'Autosaved' : 'Saved'} immutable ${locale} v${nextVersionNumber} for ${page.slug}`,
      oldValue: beforeState,
      newValue: {
        pageStatus: result.updatedPage.status,
        approvalStatus: result.updatedPage.approvalStatus,
        pendingApprovalVersionId: result.updatedPage.pendingApprovalVersionId,
        currentPublishedVersionId: result.updatedPage.currentPublishedVersionId,
        locale,
        versionId: result.createdVersion.id,
        versionNumber: nextVersionNumber,
        currentDraftVersionId: result.createdVersion.id,
        isTranslated,
        isAutosave: Boolean(input.isAutosave),
      },
    });

    return this.mapVersionDto(result.createdVersion);
  }

  /**
   * Restores an older immutable version into a brand-new draft version (never mutating history).
   */
  async restorePageVersionAsDraft(
    pageId: string,
    sourceVersionId: string,
    actor: PlatformActorContext,
    note?: string,
  ): Promise<CmsPageVersionDto> {
    assertCmsEditAllowed(actor);

    const page = await this.db.cmsPage.findUnique({
      where: { id: pageId },
      include: { locales: true },
    });
    if (!page || page.deletedAt || page.status === 'trashed') {
      throw new NotFoundException(`CMS page "${pageId}" not found.`);
    }

    const source = await this.db.cmsPageVersion.findFirst({
      where: { id: sourceVersionId, pageId },
    });
    if (!source) {
      throw new NotFoundException(
        `Version "${sourceVersionId}" does not belong to CMS page "${page.slug}".`,
      );
    }

    const latest = await this.db.cmsPageVersion.findFirst({
      where: { pageId, locale: source.locale },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const nextVersionNumber = (latest?.versionNumber ?? 0) + 1;

    const restoredVersion = await this.db.$transaction(async (tx) => {
      const created = await tx.cmsPageVersion.create({
        data: {
          pageId,
          versionNumber: nextVersionNumber,
          locale: source.locale,
          title: source.title,
          seoTitle: source.seoTitle,
          seoDescription: source.seoDescription,
          canonicalPath: source.canonicalPath,
          ogImageUrl: source.ogImageUrl,
          noIndex: source.noIndex,
          blocks: source.blocks as Prisma.InputJsonValue,
          isTranslated: source.isTranslated,
          authorId: actor.id ?? null,
          authorName: actor.email ?? 'Platform Editor',
          changeNote:
            note?.trim() || `Restored as draft from v${source.versionNumber}`,
        },
      });

      await tx.cmsPageLocale.upsert({
        where: { pageId_locale: { pageId, locale: source.locale } },
        create: {
          pageId,
          locale: source.locale,
          isTranslated: source.isTranslated,
          translationStatus: source.isTranslated ? 'translated' : 'in_review',
          currentDraftVersionId: created.id,
        },
        update: {
          currentDraftVersionId: created.id,
        },
      });

      if (isLegalCmsPage(page.slug, page.requiresApproval)) {
        await tx.cmsPage.update({
          where: { id: pageId },
          data: {
            approvalStatus: 'none',
            pendingApprovalVersionId: null,
          },
        });
      }

      return created;
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.page_version_restored',
      module: 'cms',
      recordId: pageId,
      reason: `Restored ${source.locale.toUpperCase()} v${source.versionNumber} into new draft v${nextVersionNumber}`,
      oldValue: {
        sourceVersionId: source.id,
        sourceVersionNumber: source.versionNumber,
        locale: source.locale,
      },
      newValue: {
        restoredVersionId: restoredVersion.id,
        restoredVersionNumber: nextVersionNumber,
        locale: source.locale,
      },
    });

    return this.mapVersionDto(restoredVersion);
  }

  // =========================================================================
  // Active Editor Presence & Conflict Telemetry
  // =========================================================================

  private async readPresenceMap(pageId: string): Promise<CmsActiveEditorDto[]> {
    const cutoff = Date.now() - CMS_PRESENCE_TTL_MS;
    if (isRedisConfigured()) {
      try {
        const redis = getRedisConnection();
        const raw = await redis.hgetall(`cms:presence:${pageId}`);
        const active: CmsActiveEditorDto[] = [];
        const expiredKeys: string[] = [];
        for (const [sid, json] of Object.entries(raw || {})) {
          try {
            const parsed = JSON.parse(json) as CmsActiveEditorDto;
            if (new Date(parsed.lastSeenAt).getTime() >= cutoff) {
              active.push(parsed);
            } else {
              expiredKeys.push(sid);
            }
          } catch {
            expiredKeys.push(sid);
          }
        }
        if (expiredKeys.length > 0) {
          await redis.hdel(`cms:presence:${pageId}`, ...expiredKeys).catch(() => undefined);
        }
        return active;
      } catch {
        // Fall through cleanly to process memory store if Redis is unreachable
      }
    }

    const pageMap = this.fallbackPresence.get(pageId);
    if (!pageMap) return [];
    const active: CmsActiveEditorDto[] = [];
    for (const [sid, entry] of pageMap.entries()) {
      if (new Date(entry.lastSeenAt).getTime() >= cutoff) {
        active.push(entry);
      } else {
        pageMap.delete(sid);
      }
    }
    return active;
  }

  private async getLatestVersionSummaryByLocale(
    pageId: string,
  ): Promise<CmsPagePresenceResponseDto['latestVersions']> {
    const [latestEn, latestBn] = await Promise.all([
      typeof this.db.cmsPageVersion?.findFirst === 'function'
        ? this.db.cmsPageVersion.findFirst({
          where: { pageId, locale: 'en' },
          orderBy: { versionNumber: 'desc' },
        })
        : Promise.resolve(null),
      typeof this.db.cmsPageVersion?.findFirst === 'function'
        ? this.db.cmsPageVersion.findFirst({
          where: { pageId, locale: 'bn' },
          orderBy: { versionNumber: 'desc' },
        })
        : Promise.resolve(null),
    ]);

    return {
      en: latestEn
        ? {
          versionId: latestEn.id,
          versionNumber: latestEn.versionNumber,
          authorName: latestEn.authorName ?? null,
          createdAt: latestEn.createdAt?.toISOString?.() ?? new Date().toISOString(),
        }
        : null,
      bn: latestBn
        ? {
          versionId: latestBn.id,
          versionNumber: latestBn.versionNumber,
          authorName: latestBn.authorName ?? null,
          createdAt: latestBn.createdAt?.toISOString?.() ?? new Date().toISOString(),
        }
        : null,
    };
  }

  async recordEditorPresence(
    pageId: string,
    input: { locale: CmsLocale; sessionId: string; baseVersionNumber?: number },
    actor: PlatformActorContext,
  ): Promise<CmsPagePresenceResponseDto> {
    assertCmsEditAllowed(actor);
    const entry: CmsActiveEditorDto = {
      userId: actor.id ?? 'unknown',
      email: actor.email ?? 'editor@cmsnbd.com',
      displayName: actor.email ?? 'Platform Editor',
      locale: assertValidCmsLocale(input.locale),
      sessionId: input.sessionId.trim(),
      lastSeenAt: new Date().toISOString(),
      baseVersionNumber: input.baseVersionNumber ?? null,
    };

    let storedInRedis = false;
    if (isRedisConfigured()) {
      try {
        const redis = getRedisConnection();
        const key = `cms:presence:${pageId}`;
        await redis.hset(key, entry.sessionId, JSON.stringify(entry));
        await redis.pexpire(key, CMS_PRESENCE_TTL_MS * 2);
        storedInRedis = true;
      } catch {
        storedInRedis = false;
      }
    }

    if (!storedInRedis) {
      let pageMap = this.fallbackPresence.get(pageId);
      if (!pageMap) {
        pageMap = new Map();
        this.fallbackPresence.set(pageId, pageMap);
      }
      pageMap.set(entry.sessionId, entry);
    }

    const [activeEditors, latestVersions] = await Promise.all([
      this.readPresenceMap(pageId),
      this.getLatestVersionSummaryByLocale(pageId),
    ]);

    return {
      pageId,
      activeEditors,
      latestVersions,
    };
  }

  async removeEditorPresence(pageId: string, sessionId: string): Promise<{ released: true }> {
    if (isRedisConfigured()) {
      try {
        await getRedisConnection().hdel(`cms:presence:${pageId}`, sessionId.trim());
      } catch {
        // ignore cleanup failure
      }
    }
    this.fallbackPresence.get(pageId)?.delete(sessionId.trim());
    return { released: true };
  }

  async getPagePresence(pageId: string): Promise<CmsPagePresenceResponseDto> {
    const [activeEditors, latestVersions] = await Promise.all([
      this.readPresenceMap(pageId),
      this.getLatestVersionSummaryByLocale(pageId),
    ]);
    return {
      pageId,
      activeEditors,
      latestVersions,
    };
  }

  /** Explicit guard for immutability assertions in application calls. */
  async attemptMutateVersion(): Promise<never> {
    throw new ForbiddenException({
      code: 'CMS_VERSION_IMMUTABLE',
      message: 'cms_page_versions snapshots are immutable once saved.',
    });
  }

  /**
   * Generates a short-lived signed preview token for inspecting draft content.
   */
  async createPagePreviewToken(
    pageId: string,
    input: { locale?: CmsLocale; versionId?: string; ttlMinutes?: number },
    actor: PlatformActorContext,
  ): Promise<CmsPreviewTokenResponseDto> {
    assertCmsEditAllowed(actor);
    const locale = assertValidCmsLocale(input.locale ?? 'en');
    const page = await this.db.cmsPage.findUnique({
      where: { id: pageId },
      include: { locales: true },
    });
    if (!page || page.deletedAt) {
      throw new NotFoundException(`CMS page "${pageId}" not found.`);
    }

    let targetVersionId = input.versionId;
    if (!targetVersionId) {
      const reqLocale = page.locales.find((l) => l.locale === locale);
      const enLocale = page.locales.find((l) => l.locale === 'en');
      targetVersionId =
        reqLocale?.currentDraftVersionId ||
        reqLocale?.currentPublishedVersionId ||
        enLocale?.currentDraftVersionId ||
        enLocale?.currentPublishedVersionId ||
        page.currentPublishedVersionId ||
        undefined;
    }

    if (!targetVersionId) {
      throw new BadRequestException({
        code: 'CMS_NO_VERSION_AVAILABLE',
        message: `CMS page "${page.slug}" has no draft or published version to preview.`,
      });
    }

    const version = await this.db.cmsPageVersion.findFirst({
      where: { id: targetVersionId, pageId },
    });
    if (!version) {
      throw new NotFoundException(
        `Version "${targetVersionId}" does not belong to CMS page "${page.slug}".`,
      );
    }

    const signed = signCmsPreviewToken({
      pageId: page.id,
      slug: page.slug,
      locale,
      versionId: version.id,
      issuedBy: actor.id ?? null,
      ttlSeconds: (input.ttlMinutes ?? 30) * 60,
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.preview_token_issued',
      module: 'cms',
      recordId: page.id,
      reason: `Issued preview token for "${page.slug}" (${locale} v${version.versionNumber})`,
      oldValue: { pageId: page.id, slug: page.slug },
      newValue: {
        pageId: page.id,
        slug: page.slug,
        locale,
        versionId: version.id,
        versionNumber: version.versionNumber,
        previewExpiresAt: signed.expiresAt.toISOString(),
      },
    });

    return {
      token: signed.token,
      expiresAt: signed.expiresAt.toISOString(),
      previewUrl: `/api/v1/public/content/preview?token=${encodeURIComponent(signed.token)}`,
      pageId: page.id,
      slug: page.slug,
      locale,
      versionId: version.id,
      versionNumber: version.versionNumber,
    };
  }

  /**
   * Resolves a DRAFT page snapshot solely from a verified signed, non-expired preview token.
   */
  async resolvePreviewByToken(
    rawToken?: string | null,
  ): Promise<CmsResolvedPageDto & { isPreview: true; previewExpiresAt: string }> {
    const claims = verifyCmsPreviewToken(rawToken);
    const page = await this.db.cmsPage.findUnique({
      where: { id: claims.pageId },
      include: { locales: true },
    });
    if (!page || page.deletedAt) {
      throw new NotFoundException(`CMS page "${claims.slug}" not found.`);
    }

    const version = await this.db.cmsPageVersion.findFirst({
      where: { id: claims.versionId, pageId: page.id },
    });
    if (!version) {
      throw new NotFoundException(`CMS preview version "${claims.versionId}" not found.`);
    }

    const localeRow = page.locales.find((l) => l.locale === claims.locale);
    const enRow = page.locales.find((l) => l.locale === 'en');
    const resolvedLocale = version.locale;
    const fallbackUsed = claims.locale !== resolvedLocale;

    return {
      pageId: page.id,
      kind: page.kind,
      slug: page.slug,
      status: page.status,
      locked: page.locked,
      requiresApproval: isLegalCmsPage(page.slug, page.requiresApproval),
      approvalStatus: page.approvalStatus,
      requestedLocale: claims.locale,
      resolvedLocale,
      fallbackUsed,
      isTranslated: claims.locale === 'en' ? true : Boolean(localeRow?.isTranslated && !fallbackUsed),
      translationStatus:
        claims.locale === 'en'
          ? (enRow?.translationStatus ?? 'translated')
          : (localeRow?.translationStatus ?? 'untranslated'),
      isPreview: true,
      previewExpiresAt: new Date(claims.exp * 1000).toISOString(),
      version: {
        ...this.mapVersionDto(version),
        noIndex: true,
      },
    };
  }

  /**
   * Stage F four-eyes workflow Step 1: submit a draft legal page version for review.
   */
  async submitPageForApproval(
    pageId: string,
    input: { locale?: CmsLocale; versionId?: string; note?: string },
    actor: PlatformActorContext,
  ): Promise<CmsPageDto> {
    assertCmsEditAllowed(actor);
    const locale = assertValidCmsLocale(input.locale ?? 'en');
    const page = await this.db.cmsPage.findUnique({
      where: { id: pageId },
      include: { locales: true },
    });
    if (!page || page.deletedAt || page.status === 'trashed') {
      throw new NotFoundException(`CMS page "${pageId}" not found.`);
    }

    const localeRow = page.locales.find((l) => l.locale === locale);
    const versionId =
      input.versionId || localeRow?.currentDraftVersionId || localeRow?.currentPublishedVersionId;
    if (!versionId) {
      throw new BadRequestException({
        code: 'CMS_NO_VERSION_TO_SUBMIT',
        message: `No draft version available on "${page.slug}" (${locale}) to submit for approval.`,
      });
    }

    const version = await this.db.cmsPageVersion.findFirst({
      where: { id: versionId, pageId },
    });
    if (!version) {
      throw new NotFoundException(`Version "${versionId}" not found on CMS page "${page.slug}".`);
    }

    const beforeState = this.pickPageWorkflowSnapshot(page);
    const now = new Date();
    const updated = await this.db.cmsPage.update({
      where: { id: pageId },
      data: {
        requiresApproval: isLegalCmsPage(page.slug, page.requiresApproval),
        approvalStatus: 'pending_approval',
        pendingApprovalVersionId: version.id,
        submittedForApprovalById: actor.id ?? null,
        submittedForApprovalAt: now,
        submissionNote: input.note?.trim() || null,
        rejectedById: null,
        rejectedAt: null,
        rejectionReason: null,
      },
      include: { locales: true },
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.page_submitted_for_approval',
      module: 'cms',
      recordId: pageId,
      reason: input.note?.trim() || `Submitted "${page.slug}" v${version.versionNumber} for legal approval`,
      oldValue: beforeState,
      newValue: this.pickPageWorkflowSnapshot(updated),
    });

    return this.mapPageDto(updated);
  }

  /**
   * Stage F four-eyes workflow Step 2a: approve a pending legal revision (submitter cannot self-approve).
   */
  async approveLegalPage(
    pageId: string,
    input: { note?: string; publishNow?: boolean },
    actor: PlatformActorContext,
  ): Promise<CmsPageDto> {
    assertCmsPublishAllowed(actor);

    const page = await this.db.cmsPage.findUnique({
      where: { id: pageId },
      include: { locales: true },
    });
    if (!page || page.deletedAt || page.status === 'trashed') {
      throw new NotFoundException(`CMS page "${pageId}" not found.`);
    }

    if (page.approvalStatus !== 'pending_approval' || !page.pendingApprovalVersionId) {
      throw new BadRequestException({
        code: 'CMS_NOT_PENDING_APPROVAL',
        message: `CMS page "${page.slug}" does not have a revision pending approval.`,
      });
    }

    if (page.submittedForApprovalById && actor.id && page.submittedForApprovalById === actor.id) {
      throw new ForbiddenException({
        code: 'SELF_APPROVAL_FORBIDDEN',
        message:
          'Separation of duties violation (Stage F): the staff member who submitted a legal page for approval cannot approve their own submission.',
      });
    }

    const approvedVersion = await this.db.cmsPageVersion.findFirst({
      where: { id: page.pendingApprovalVersionId, pageId },
    });
    if (!approvedVersion) {
      throw new NotFoundException(
        `Pending approval version "${page.pendingApprovalVersionId}" no longer exists.`,
      );
    }

    const beforeState = this.pickPageWorkflowSnapshot(page);
    const now = new Date();

    const updated = await this.db.$transaction(async (tx) => {
      if (input.publishNow) {
        await tx.cmsPageLocale.upsert({
          where: { pageId_locale: { pageId, locale: approvedVersion.locale } },
          create: {
            pageId,
            locale: approvedVersion.locale,
            isTranslated: approvedVersion.isTranslated,
            translationStatus: approvedVersion.isTranslated ? 'translated' : 'untranslated',
            currentDraftVersionId: approvedVersion.id,
            currentPublishedVersionId: approvedVersion.id,
          },
          update: {
            currentPublishedVersionId: approvedVersion.id,
          },
        });
      }

      return tx.cmsPage.update({
        where: { id: pageId },
        data: {
          approvalStatus: 'approved',
          approvedById: actor.id ?? null,
          approvedAt: now,
          approvalNote: input.note?.trim() || null,
          rejectedById: null,
          rejectedAt: null,
          rejectionReason: null,
          ...(input.publishNow
            ? {
              status: 'published',
              publishedAt: page.publishedAt ?? now,
              scheduledAt: null,
              scheduledTimezone: null,
              scheduledById: null,
              ...(approvedVersion.locale === 'en' || !page.currentPublishedVersionId
                ? { currentPublishedVersionId: approvedVersion.id }
                : {}),
            }
            : {}),
        },
        include: { locales: true },
      });
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: input.publishNow ? 'cms.page_legal_approved_and_published' : 'cms.page_legal_approved',
      module: 'cms',
      recordId: pageId,
      reason: input.note?.trim() || `Approved legal page "${page.slug}" v${approvedVersion.versionNumber}`,
      oldValue: beforeState,
      newValue: this.pickPageWorkflowSnapshot(updated),
    });

    return this.mapPageDto(updated);
  }

  /**
   * Stage F four-eyes workflow Step 2b: reject a pending legal revision with a reason.
   */
  async rejectLegalPage(
    pageId: string,
    input: { reason: string },
    actor: PlatformActorContext,
  ): Promise<CmsPageDto> {
    assertCmsPublishAllowed(actor);
    const reason = input.reason?.trim();
    if (!reason || reason.length < 3) {
      throw new BadRequestException({
        code: 'REJECTION_REASON_REQUIRED',
        message: 'A rejection reason (at least 3 characters) is required.',
      });
    }

    const page = await this.db.cmsPage.findUnique({
      where: { id: pageId },
      include: { locales: true },
    });
    if (!page || page.deletedAt) {
      throw new NotFoundException(`CMS page "${pageId}" not found.`);
    }
    if (page.approvalStatus !== 'pending_approval') {
      throw new BadRequestException({
        code: 'CMS_NOT_PENDING_APPROVAL',
        message: `CMS page "${page.slug}" is not currently pending approval.`,
      });
    }
    if (page.submittedForApprovalById && actor.id && page.submittedForApprovalById === actor.id) {
      throw new ForbiddenException({
        code: 'SELF_REVIEW_FORBIDDEN',
        message: 'Separation of duties violation: the submitter cannot review their own legal submission.',
      });
    }

    const beforeState = this.pickPageWorkflowSnapshot(page);
    const updated = await this.db.cmsPage.update({
      where: { id: pageId },
      data: {
        approvalStatus: 'rejected',
        rejectedById: actor.id ?? null,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
      include: { locales: true },
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.page_legal_rejected',
      module: 'cms',
      recordId: pageId,
      reason,
      oldValue: beforeState,
      newValue: this.pickPageWorkflowSnapshot(updated),
    });

    return this.mapPageDto(updated);
  }

  /**
   * Publishes a page immediately (promoting draft locale version(s) to published).
   */
  async publishPageNow(
    pageId: string,
    input: { locale?: CmsLocale; versionId?: string; note?: string },
    actor: PlatformActorContext,
  ): Promise<CmsPageDto> {
    assertCmsPublishAllowed(actor);

    const page = await this.db.cmsPage.findUnique({
      where: { id: pageId },
      include: { locales: true },
    });
    if (!page || page.deletedAt || page.status === 'trashed') {
      throw new BadRequestException({
        code: 'CMS_PAGE_TRASHED',
        message: `CMS page "${pageId}" is not active (missing or trashed). Restore before publishing.`,
      });
    }

    const targetVersions = await this.resolveVersionsToPublish(page, input);
    assertCmsLegalApprovalSatisfied({
      slug: page.slug,
      requiresApproval: page.requiresApproval,
      approvalStatus: page.approvalStatus,
      pendingApprovalVersionId: page.pendingApprovalVersionId,
      targetVersionIds: targetVersions.map((v) => v.id),
    });

    const beforeState = this.pickPageWorkflowSnapshot(page);
    const now = new Date();

    const updated = await this.db.$transaction(async (tx) => {
      for (const ver of targetVersions) {
        await tx.cmsPageLocale.upsert({
          where: { pageId_locale: { pageId, locale: ver.locale } },
          create: {
            pageId,
            locale: ver.locale,
            isTranslated: ver.isTranslated,
            translationStatus: ver.isTranslated ? 'translated' : 'untranslated',
            currentDraftVersionId: ver.id,
            currentPublishedVersionId: ver.id,
          },
          update: {
            currentPublishedVersionId: ver.id,
          },
        });
      }

      const enTarget = targetVersions.find((v) => v.locale === 'en');
      const primaryId =
        enTarget?.id ?? page.currentPublishedVersionId ?? targetVersions[0]?.id ?? null;

      return tx.cmsPage.update({
        where: { id: pageId },
        data: {
          status: 'published',
          publishedAt: page.publishedAt ?? now,
          scheduledAt: null,
          scheduledTimezone: null,
          scheduledById: null,
          ...(primaryId ? { currentPublishedVersionId: primaryId } : {}),
        },
        include: { locales: true },
      });
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.page_published',
      module: 'cms',
      recordId: pageId,
      reason: input.note?.trim() || `Published CMS page "${page.slug}"`,
      oldValue: beforeState,
      newValue: this.pickPageWorkflowSnapshot(updated),
    });

    this.triggerRevalidate({
      scopes: ['cms-pages'],
      slugs: [page.slug],
    });

    return this.mapPageDto(updated);
  }

  /**
   * Schedules a page publication in the staff member's timezone.
   */
  async schedulePagePublish(
    pageId: string,
    input: {
      scheduledAt: string;
      timezone?: string;
      locale?: CmsLocale;
      versionId?: string;
      note?: string;
    },
    actor: PlatformActorContext,
    now = new Date(),
  ): Promise<CmsPageDto> {
    assertCmsPublishAllowed(actor);

    const page = await this.db.cmsPage.findUnique({
      where: { id: pageId },
      include: { locales: true },
    });
    if (!page || page.deletedAt || page.status === 'trashed') {
      throw new BadRequestException({
        code: 'CMS_PAGE_TRASHED',
        message: `CMS page "${pageId}" is not active (missing or trashed). Restore before scheduling.`,
      });
    }

    const staffTimezone = input.timezone?.trim() || actor.timezone || 'UTC';
    const { scheduledAtUtc, timeZone } = parseScheduledDateInTimezone(
      input.scheduledAt,
      staffTimezone,
    );
    if (scheduledAtUtc.getTime() <= now.getTime()) {
      throw new BadRequestException({
        code: 'CMS_SCHEDULE_IN_PAST',
        message: `Scheduled publication time (${scheduledAtUtc.toISOString()}) must be in the future.`,
      });
    }

    const targetVersions = await this.resolveVersionsToPublish(page, {
      locale: input.locale,
      versionId: input.versionId,
    });
    assertCmsLegalApprovalSatisfied({
      slug: page.slug,
      requiresApproval: page.requiresApproval,
      approvalStatus: page.approvalStatus,
      pendingApprovalVersionId: page.pendingApprovalVersionId,
      targetVersionIds: targetVersions.map((v) => v.id),
    });

    const beforeState = this.pickPageWorkflowSnapshot(page);
    // Keep already-published live pages published while queuing the future version swap;
    // draft/unpublished pages transition to explicit `scheduled` status until job executes.
    const nextStatus: CmsPageStatus =
      page.status === 'published' && page.currentPublishedVersionId ? 'published' : 'scheduled';

    const updated = await this.db.cmsPage.update({
      where: { id: pageId },
      data: {
        status: nextStatus,
        scheduledAt: scheduledAtUtc,
        scheduledTimezone: timeZone,
        scheduledById: actor.id ?? null,
      },
      include: { locales: true },
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.page_scheduled',
      module: 'cms',
      recordId: pageId,
      reason:
        input.note?.trim() ||
        `Scheduled "${page.slug}" for ${scheduledAtUtc.toISOString()} (${timeZone})`,
      oldValue: beforeState,
      newValue: this.pickPageWorkflowSnapshot(updated),
    });

    return this.mapPageDto(updated);
  }

  async unpublishPage(
    pageId: string,
    input: { reason?: string },
    actor: PlatformActorContext,
  ): Promise<CmsPageDto> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsPage.findUnique({
      where: { id: pageId },
      include: { locales: true },
    });
    if (!existing) {
      throw new NotFoundException(`CMS page "${pageId}" not found.`);
    }

    assertSystemPageMutationAllowed(
      { kind: existing.kind, slug: existing.slug, locked: existing.locked },
      { status: 'unpublished' },
    );

    if (existing.deletedAt || existing.status === 'trashed') {
      throw new BadRequestException({
        code: 'CMS_PAGE_TRASHED',
        message: `CMS page "${existing.slug}" is trashed; restore it first.`,
      });
    }

    const beforeState = this.pickPageWorkflowSnapshot(existing);
    const updated = await this.db.cmsPage.update({
      where: { id: pageId },
      data: {
        status: 'unpublished',
        scheduledAt: null,
        scheduledTimezone: null,
        scheduledById: null,
      },
      include: { locales: true },
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.page_unpublished',
      module: 'cms',
      recordId: pageId,
      reason: input.reason?.trim() || `Unpublished custom page "${existing.slug}"`,
      oldValue: beforeState,
      newValue: this.pickPageWorkflowSnapshot(updated),
    });

    this.triggerRevalidate({
      scopes: ['cms-pages'],
      slugs: [existing.slug],
    });

    return this.mapPageDto(updated);
  }

  async updatePage(
    pageId: string,
    input: {
      slug?: string;
      status?: CmsPageStatus;
      scheduledAt?: Date | null;
      locked?: boolean;
    },
    actor: PlatformActorContext,
  ): Promise<CmsPageDto> {
    assertCmsEditAllowed(actor);
    if (
      input.status === 'published' ||
      input.status === 'scheduled' ||
      input.status === 'unpublished' ||
      input.status === 'trashed'
    ) {
      assertCmsPublishAllowed(actor);
    }

    const existing = await this.db.cmsPage.findUnique({
      where: { id: pageId },
      include: { locales: true },
    });
    if (!existing) {
      throw new NotFoundException(`CMS page "${pageId}" not found.`);
    }

    const nextSlug =
      input.slug !== undefined
        ? assertValidCmsSlug(input.slug, { checkReserved: true })
        : undefined;

    assertSystemPageMutationAllowed(
      { kind: existing.kind, slug: existing.slug, locked: existing.locked },
      { slug: nextSlug, status: input.status, locked: input.locked },
    );

    if (input.status === 'published' || input.status === 'scheduled') {
      const targetVersions = await this.resolveVersionsToPublish(existing, {});
      assertCmsLegalApprovalSatisfied({
        slug: nextSlug ?? existing.slug,
        requiresApproval: existing.requiresApproval,
        approvalStatus: existing.approvalStatus,
        pendingApprovalVersionId: existing.pendingApprovalVersionId,
        targetVersionIds: targetVersions.map((v) => v.id),
      });
    }

    const beforeState = this.pickPageWorkflowSnapshot(existing);
    const updated = await this.db.cmsPage.update({
      where: { id: pageId },
      data: {
        ...(nextSlug !== undefined ? { slug: nextSlug } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt } : {}),
        ...(input.status === 'published' && !existing.publishedAt ? { publishedAt: new Date() } : {}),
      },
      include: { locales: true },
    });

    if (nextSlug !== undefined && nextSlug !== existing.slug && existing.status === 'published') {
      const oldPath = existing.slug === 'home' ? '/' : `/${existing.slug}`;
      const newPath = nextSlug === 'home' ? '/' : `/${nextSlug}`;
      await this.upsertAutoPermanent301Redirect(
        oldPath,
        newPath,
        actor,
        `Auto-created 301 redirect after published page slug changed from /${existing.slug} to /${nextSlug}`,
      );
    }

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.page_updated',
      module: 'cms',
      recordId: pageId,
      oldValue: beforeState,
      newValue: this.pickPageWorkflowSnapshot(updated),
    });

    if (existing.status === 'published' || updated.status === 'published' || nextSlug !== undefined) {
      this.triggerRevalidate({
        scopes: nextSlug && nextSlug !== existing.slug ? ['cms-pages', 'cms-redirects'] : ['cms-pages'],
        slugs: Array.from(new Set([existing.slug, updated.slug])),
      });
    }

    return this.mapPageDto(updated);
  }

  async getTrashRetentionDays(): Promise<number> {
    const envRaw = Number(process.env.CMS_TRASH_RETENTION_DAYS);
    let days = Number.isFinite(envRaw) && envRaw >= 1 ? Math.round(envRaw) : 30;
    try {
      const setting = this.db.cmsSiteSetting
        ? await this.db.cmsSiteSetting.findUnique({ where: { key: 'trash_retention_days' } })
        : null;
      const rawVal = (setting?.valueJson as { days?: unknown } | undefined)?.days;
      if (typeof rawVal === 'number' && Number.isFinite(rawVal) && rawVal >= 1 && rawVal <= 3650) {
        days = Math.round(rawVal);
      }
    } catch {
      // Ignore missing setting or minimal mock DB
    }
    return days;
  }

  async updateTrashRetentionDays(
    days: number,
    actor: PlatformActorContext,
  ): Promise<{ days: number }> {
    assertCmsPublishAllowed(actor);
    const clamped = Math.min(3650, Math.max(1, Math.round(days)));
    await this.upsertSiteSetting(
      {
        key: 'trash_retention_days',
        valueJson: { days: clamped },
        description: 'Number of days deleted custom CMS pages remain in Trash before automatic permanent deletion.',
        isPublic: false,
      },
      actor,
    );
    return { days: clamped };
  }

  private getCandidatePathsForPage(slug: string, canonicalPath?: string | null): Set<string> {
    const clean = slug.trim().toLowerCase();
    const candidates = new Set<string>([`/${clean}`, `/p/${clean}`]);
    if (canonicalPath && canonicalPath.startsWith('/')) {
      candidates.add(normalizeInternalCmsPath(canonicalPath));
    }
    return candidates;
  }

  private async resolvePageTitleAndPath(page: {
    id: string;
    slug: string;
    currentPublishedVersionId: string | null;
    locales: Array<{
      locale: CmsLocale;
      currentDraftVersionId: string | null;
      currentPublishedVersionId: string | null;
    }>;
  }): Promise<{ titleEn: string; titleBn: string | null; canonicalPath: string }> {
    const enLoc = page.locales.find((l) => l.locale === 'en');
    const bnLoc = page.locales.find((l) => l.locale === 'bn');
    const candidateIds = [
      enLoc?.currentPublishedVersionId,
      enLoc?.currentDraftVersionId,
      page.currentPublishedVersionId,
      bnLoc?.currentDraftVersionId,
    ].filter((id): id is string => Boolean(id));

    const versions =
      candidateIds.length > 0 && this.db.cmsPageVersion
        ? await this.db.cmsPageVersion.findMany({
          where: { id: { in: candidateIds } },
          select: { id: true, locale: true, title: true, canonicalPath: true },
        })
        : [];
    const byId = new Map(versions.map((v) => [v.id, v]));
    const enVer =
      byId.get(enLoc?.currentPublishedVersionId ?? '') ??
      byId.get(enLoc?.currentDraftVersionId ?? '') ??
      byId.get(page.currentPublishedVersionId ?? '');
    const bnVer = byId.get(bnLoc?.currentDraftVersionId ?? '');

    return {
      titleEn: enVer?.title || `/${page.slug}`,
      titleBn: bnVer?.title ?? null,
      canonicalPath: enVer?.canonicalPath || `/${page.slug}`,
    };
  }

  private async findMenuReferencesForPage(
    pageId: string,
    candidatePaths: Set<string>,
  ): Promise<CmsDeleteImpactMenuRefDto[]> {
    if (!this.db.cmsMenuItem) return [];
    const allItems = await this.db.cmsMenuItem.findMany({
      include: { menu: { select: { id: true, name: true, location: true } } },
    });

    const refs: CmsDeleteImpactMenuRefDto[] = [];
    for (const item of allItems) {
      const normalizedHref =
        typeof item.href === 'string' && item.href.startsWith('/')
          ? normalizeInternalCmsPath(item.href)
          : '';
      if (item.targetPageId === pageId || (normalizedHref && candidatePaths.has(normalizedHref))) {
        refs.push({
          menuItemId: item.id,
          menuId: item.menuId,
          menuName: item.menu?.name ?? 'Navigation Menu',
          menuLocation: String(item.menu?.location ?? 'header'),
          labelEn: item.labelEn,
          href: item.href,
        });
      }
    }
    return refs;
  }

  private async findOtherPagesLinkingToPage(
    pageId: string,
    candidatePaths: Set<string>,
  ): Promise<CmsDeleteImpactPageRefDto[]> {
    const otherPages = await this.db.cmsPage.findMany({
      where: {
        id: { not: pageId },
        deletedAt: null,
        status: { not: 'trashed' },
      },
      include: { locales: true },
    });

    const versionIds = Array.from(
      new Set(
        otherPages.flatMap((p) => [
          ...(p.currentPublishedVersionId ? [p.currentPublishedVersionId] : []),
          ...p.locales.flatMap((l) => [
            ...(l.currentDraftVersionId ? [l.currentDraftVersionId] : []),
            ...(l.currentPublishedVersionId ? [l.currentPublishedVersionId] : []),
          ]),
        ]),
      ),
    );

    const versions =
      versionIds.length > 0
        ? await this.db.cmsPageVersion.findMany({
          where: { id: { in: versionIds } },
          select: { id: true, pageId: true, locale: true, title: true, blocks: true },
        })
        : [];
    const verById = new Map(versions.map((v) => [v.id, v]));

    const refs: CmsDeleteImpactPageRefDto[] = [];
    const dedupe = new Set<string>();

    for (const other of otherPages) {
      if (other.id === pageId) continue;
      for (const loc of other.locales) {
        const verId = loc.currentDraftVersionId || loc.currentPublishedVersionId;
        const ver = verId ? verById.get(verId) : undefined;
        if (!ver || !Array.isArray(ver.blocks)) continue;
        const extracted: Array<{ blockId: string; blockType: string; href: string }> = [];
        collectBlockLinks(ver.blocks, extracted);
        for (const link of extracted) {
          if (!link.href.startsWith('/')) continue;
          const norm = normalizeInternalCmsPath(link.href);
          if (!candidatePaths.has(norm)) continue;
          const key = `${other.id}:${ver.locale}:${norm}`;
          if (dedupe.has(key)) continue;
          dedupe.add(key);
          refs.push({
            pageId: other.id,
            slug: other.slug,
            title: ver.title || `/${other.slug}`,
            status: other.status,
            locale: ver.locale,
            href: link.href,
          });
        }
      }
    }

    return refs;
  }

  async getPageDeletionImpact(
    pageId: string,
    actor: PlatformActorContext,
  ): Promise<CmsPageDeletionImpactDto> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsPage.findUnique({
      where: { id: pageId },
      include: { locales: true },
    });
    if (!existing) {
      throw new NotFoundException(`CMS page "${pageId}" not found.`);
    }

    // System pages can never be deleted — refuse even deletion pre-checks if called directly.
    assertSystemPageMutationAllowed(
      { kind: existing.kind, slug: existing.slug, locked: existing.locked },
      { isDelete: true, status: 'trashed', deletedAt: new Date() },
    );

    const { titleEn, canonicalPath } = await this.resolvePageTitleAndPath(existing);
    const livePath = canonicalPath.startsWith('/') ? canonicalPath : `/${existing.slug}`;
    const candidatePaths = this.getCandidatePathsForPage(existing.slug, livePath);

    const [menuReferences, referencingPages, activePages, trashRetentionDays] =
      await Promise.all([
        this.findMenuReferencesForPage(existing.id, candidatePaths),
        this.findOtherPagesLinkingToPage(existing.id, candidatePaths),
        this.db.cmsPage.findMany({
          where: {
            id: { not: existing.id },
            deletedAt: null,
            status: { not: 'trashed' },
          },
          include: { locales: true },
          orderBy: [{ kind: 'asc' }, { slug: 'asc' }],
        }),
        this.getTrashRetentionDays(),
      ]);

    const redirectTargets: CmsDeleteImpactRedirectOptionDto[] = [
      { slug: 'home', title: 'Home (/)', path: '/' },
    ];
    for (const candidate of activePages) {
      if (candidate.id === existing.id || candidate.slug === 'home' || candidate.slug === '404') {
        continue;
      }
      redirectTargets.push({
        slug: candidate.slug,
        title: `/${candidate.slug} (${candidate.status})`,
        path: candidate.slug === 'home' ? '/' : `/${candidate.slug}`,
      });
    }

    return {
      pageId: existing.id,
      slug: existing.slug,
      title: titleEn,
      kind: existing.kind,
      status: existing.status,
      locked: existing.locked,
      liveUrlPath: livePath,
      willStopWorking: existing.status === 'published' || existing.status === 'scheduled',
      requiresTypedTitleConfirmation: existing.status === 'published',
      menuReferences,
      referencingPages,
      redirectTargets,
      trashRetentionDays,
    };
  }

  async trashOrDeletePage(
    pageId: string,
    actor: PlatformActorContext,
    reasonOrOptions?: string | TrashCmsPageInput,
  ): Promise<CmsPageDto> {
    assertCmsPublishAllowed(actor);
    const opts: TrashCmsPageInput =
      typeof reasonOrOptions === 'string'
        ? { reason: reasonOrOptions }
        : reasonOrOptions ?? {};

    const existing = await this.db.cmsPage.findUnique({
      where: { id: pageId },
      include: { locales: true },
    });
    if (!existing) {
      throw new NotFoundException(`CMS page "${pageId}" not found.`);
    }

    assertSystemPageMutationAllowed(
      { kind: existing.kind, slug: existing.slug, locked: existing.locked },
      { isDelete: true, status: 'trashed', deletedAt: new Date() },
    );

    if (existing.status === 'trashed' || existing.deletedAt) {
      throw new BadRequestException({
        code: 'CMS_PAGE_ALREADY_TRASHED',
        message: `CMS page "${existing.slug}" is already in Trash.`,
      });
    }

    const { titleEn, titleBn, canonicalPath } = await this.resolvePageTitleAndPath(existing);
    const livePath = canonicalPath.startsWith('/') ? canonicalPath : `/${existing.slug}`;
    const candidatePaths = this.getCandidatePathsForPage(existing.slug, livePath);

    // 1. Check menus linking to this page (block unless removeMenuReferences is explicitly chosen)
    const menuRefs = await this.findMenuReferencesForPage(existing.id, candidatePaths);
    if (menuRefs.length > 0 && !opts.removeMenuReferences) {
      throw new BadRequestException({
        code: 'CMS_PAGE_REFERENCED_IN_MENU',
        message: `Cannot move "/${existing.slug}" to Trash while ${menuRefs.length} menu link(s) still point to it. Remove/update those menu items or confirm removing them.`,
        details: { menuReferences: menuRefs },
      });
    }

    // 2. Published custom pages must either be unpublished first or confirmed with typed page title
    if (existing.status === 'published' && !opts.unpublishFirst) {
      const typed = (opts.confirmPublishedTitle ?? '').trim().toLowerCase();
      const accepted = new Set(
        [titleEn, titleBn, existing.slug]
          .filter((v): v is string => Boolean(v && v.trim()))
          .map((v) => v.trim().toLowerCase()),
      );
      if (!typed || !accepted.has(typed)) {
        throw new BadRequestException({
          code: 'CMS_PUBLISHED_DELETE_CONFIRMATION_REQUIRED',
          message: `Published custom page "/${existing.slug}" must be unpublished first or confirmed by typing its title ("${titleEn}").`,
        });
      }
    }

    // 3. Remove linked menu items if explicitly approved
    if (menuRefs.length > 0 && opts.removeMenuReferences && this.db.cmsMenuItem) {
      await this.db.cmsMenuItem.deleteMany({
        where: { id: { in: menuRefs.map((m) => m.menuItemId) } },
      });
      await this.platformAudit.log({
        userId: actor.id ?? null,
        action: 'cms.menu_items_removed_on_page_delete',
        module: 'cms',
        recordId: pageId,
        reason: `Removed ${menuRefs.length} menu item(s) linking to deleted page "/${existing.slug}"`,
        oldValue: { menuReferences: menuRefs },
        newValue: { removedCount: menuRefs.length },
      });
    }

    // 4. Optional redirect rule creation (automatic 301 rule)
    let createdRedirect: { sourcePath: string; destinationUrl: string } | null = null;
    if (opts.redirectToPath && opts.redirectToPath.trim()) {
      const savedRedir = await this.upsertAutoPermanent301Redirect(
        `/${existing.slug}`,
        opts.redirectToPath.trim(),
        actor,
        `Auto-created 301 redirect when deleting custom page /${existing.slug}`,
      );
      if (savedRedir) {
        createdRedirect = {
          sourcePath: savedRedir.sourcePath,
          destinationUrl: savedRedir.destinationUrl,
        };
      }
    }

    const beforeState = this.pickPageWorkflowSnapshot(existing);
    const deletedAt = new Date();
    const retentionDays = await this.getTrashRetentionDays();
    const updated = await this.db.cmsPage.update({
      where: { id: pageId },
      data: {
        status: 'trashed',
        deletedAt,
        scheduledAt: null,
        scheduledTimezone: null,
        scheduledById: null,
      },
      include: { locales: true },
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.page_trashed',
      module: 'cms',
      recordId: pageId,
      reason:
        opts.reason?.trim() ||
        `Moved custom page "${existing.slug}" to trash${opts.unpublishFirst && existing.status === 'published' ? ' (unpublished live route)' : ''
        }`,
      oldValue: beforeState,
      newValue: {
        ...this.pickPageWorkflowSnapshot(updated),
        redirectCreated: createdRedirect,
        menuItemsRemoved: opts.removeMenuReferences ? menuRefs.length : 0,
      },
    });

    this.triggerRevalidate({
      scopes: opts.removeMenuReferences || createdRedirect
        ? ['cms-pages', 'cms-menus', 'cms-redirects']
        : ['cms-pages'],
      slugs: [existing.slug],
      paths: livePath ? [livePath] : undefined,
    });

    return {
      ...this.mapPageDto(updated),
      titleEn,
      titleBn,
      canonicalPath: livePath,
      purgeAt: new Date(deletedAt.getTime() + retentionDays * 86_400_000).toISOString(),
      trashRetentionDays: retentionDays,
    };
  }

  private async hardDeletePageRecords(pageId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      if (tx.cmsMenuItem) {
        await tx.cmsMenuItem.updateMany({
          where: { targetPageId: pageId },
          data: { targetPageId: null },
        });
      }

      await tx.cmsPage.update({
        where: { id: pageId },
        data: {
          currentPublishedVersionId: null,
          pendingApprovalVersionId: null,
        },
      });

      if (tx.cmsPageLocale?.updateMany) {
        await tx.cmsPageLocale.updateMany({
          where: { pageId },
          data: {
            currentDraftVersionId: null,
            currentPublishedVersionId: null,
          },
        });
      }

      await tx.cmsPageLocale.deleteMany({ where: { pageId } });
      await tx.cmsPageVersion.deleteMany({ where: { pageId } });
      await tx.cmsPage.delete({ where: { id: pageId } });
    });
  }

  async permanentDeletePage(
    pageId: string,
    input: PermanentDeleteCmsPageInput,
    actor: PlatformActorContext,
  ): Promise<{ id: string; slug: string; deleted: true }> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsPage.findUnique({
      where: { id: pageId },
      include: { locales: true },
    });
    if (!existing) {
      throw new NotFoundException(`CMS page "${pageId}" not found.`);
    }

    // System pages can NEVER be permanently deleted even if called directly.
    assertSystemPageMutationAllowed(
      { kind: existing.kind, slug: existing.slug, locked: existing.locked },
      { isDelete: true, status: 'trashed', deletedAt: new Date() },
    );

    if (existing.status !== 'trashed' && !existing.deletedAt) {
      throw new BadRequestException({
        code: 'CMS_PAGE_MUST_BE_TRASHED_FIRST',
        message: `Move custom page "/${existing.slug}" to Trash before permanently deleting it.`,
      });
    }

    const { titleEn, titleBn } = await this.resolvePageTitleAndPath(existing);
    const typed = (input?.confirmText ?? '').trim().toLowerCase();
    const accepted = new Set(
      [existing.slug, titleEn, titleBn]
        .filter((v): v is string => Boolean(v && v.trim()))
        .map((v) => v.trim().toLowerCase()),
    );
    if (!typed || !accepted.has(typed)) {
      throw new BadRequestException({
        code: 'CMS_PERMANENT_DELETE_CONFIRMATION_INVALID',
        message: `Type "${existing.slug}" or "${titleEn}" to confirm permanent deletion.`,
      });
    }

    const versionCount = this.db.cmsPageVersion
      ? (await this.db.cmsPageVersion.findMany({ where: { pageId }, select: { id: true } })).length
      : 0;
    const beforeState = {
      ...this.pickPageWorkflowSnapshot(existing),
      titleEn,
      titleBn,
      versionCount,
    };

    await this.hardDeletePageRecords(pageId);

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.page_permanently_deleted',
      module: 'cms',
      recordId: pageId,
      reason:
        input.reason?.trim() ||
        `Permanently deleted trashed custom page "/${existing.slug}" and ${versionCount} immutable version(s)`,
      oldValue: beforeState,
      newValue: null,
    });

    this.triggerRevalidate({
      scopes: ['cms-pages', 'cms-redirects'],
      slugs: [existing.slug],
    });

    return { id: pageId, slug: existing.slug, deleted: true };
  }

  async purgeExpiredTrashedPages(
    now = new Date(),
  ): Promise<{ purgedCount: number; purgedIds: string[]; retentionDays: number }> {
    const retentionDays = await this.getTrashRetentionDays();
    const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);

    const candidates = await this.db.cmsPage.findMany({
      where: {
        kind: 'custom',
        locked: false,
        status: 'trashed',
        deletedAt: { lte: cutoff },
      },
      include: { locales: true },
    });

    const purgedIds: string[] = [];
    for (const page of candidates) {
      if (page.kind !== 'custom' || page.locked) continue;
      if (!page.deletedAt || page.deletedAt > cutoff) continue;

      const beforeState = this.pickPageWorkflowSnapshot(page);
      await this.hardDeletePageRecords(page.id);
      purgedIds.push(page.id);

      await this.platformAudit.log({
        userId: null,
        action: 'cms.page_trash_expired_purged',
        module: 'cms',
        recordId: page.id,
        reason: `Automatically purged trashed custom page "/${page.slug}" after ${retentionDays}-day retention`,
        oldValue: beforeState,
        newValue: null,
      });
    }

    if (purgedIds.length > 0) {
      this.triggerRevalidate({ scopes: ['cms-pages', 'cms-redirects'] });
    }

    return { purgedCount: purgedIds.length, purgedIds, retentionDays };
  }

  private async upsertAutoPermanent301Redirect(
    rawSourcePath: string,
    rawDestinationUrl: string,
    actor: PlatformActorContext,
    note: string,
  ): Promise<CmsRedirectRuleDto | null> {
    const sourcePath = normalizeRedirectSourcePath(rawSourcePath);
    const destinationUrl = rawDestinationUrl.trim();
    if (!isSafeCmsLinkUrl(destinationUrl)) {
      throw new BadRequestException({
        code: 'CMS_INVALID_REDIRECT_TARGET',
        message: `Invalid redirect destination "${destinationUrl}".`,
      });
    }
    const destNorm = destinationUrl.startsWith('/')
      ? normalizeInternalCmsPath(destinationUrl).toLowerCase()
      : null;
    if (destNorm && destNorm === sourcePath) {
      throw new BadRequestException({
        code: 'CMS_REDIRECT_LOOP',
        message: 'Redirect target cannot point back to the source page itself.',
      });
    }
    if (!this.db.cmsRedirect) return null;

    // Collapse any existing rules pointing TO sourcePath so chains never form
    const allRules =
      typeof this.db.cmsRedirect.findMany === 'function'
        ? await this.db.cmsRedirect.findMany({
          select: { id: true, sourcePath: true, destinationUrl: true, isActive: true },
        })
        : [];
    for (const existing of allRules) {
      if (!existing.isActive || !existing.destinationUrl.startsWith('/')) continue;
      if (normalizeInternalCmsPath(existing.destinationUrl).toLowerCase() === sourcePath) {
        const existingSrcNorm = normalizeRedirectSourcePath(existing.sourcePath);
        if (destNorm && existingSrcNorm === destNorm) {
          // Removing reverse cycle (e.g., slug renamed back to previously retired slug)
          await this.db.cmsRedirect.update({
            where: { id: existing.id },
            data: { isActive: false, note: `Deactivated automatically because /${destNorm.slice(1)} is live again` },
          });
        } else {
          await this.db.cmsRedirect.update({
            where: { id: existing.id },
            data: {
              destinationUrl,
              note: `Collapsed chain via automatic 301 update -> ${destinationUrl}`,
            },
          });
        }
      }
    }

    // If destination is itself an active redirect source, resolve final hop cleanly
    let finalDest = destinationUrl;
    if (destNorm) {
      const forwardMatch = allRules.find(
        (r) =>
          r.isActive && normalizeRedirectSourcePath(r.sourcePath) === destNorm,
      );
      if (forwardMatch) {
        finalDest = forwardMatch.destinationUrl;
      }
    }

    const saved = await this.db.cmsRedirect.upsert({
      where: { sourcePath },
      create: {
        sourcePath,
        destinationUrl: finalDest,
        redirectType: 'permanent_301',
        isActive: true,
        createdById: actor.id ?? null,
        note,
      },
      update: {
        destinationUrl: finalDest,
        redirectType: 'permanent_301',
        isActive: true,
        note,
      },
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.redirect.auto_created',
      module: 'cms',
      recordId: saved.id,
      reason: note,
      oldValue: null,
      newValue: {
        sourcePath: saved.sourcePath,
        destinationUrl: saved.destinationUrl,
        redirectType: saved.redirectType,
      },
    });

    return this.mapRedirectDto(saved);
  }

  private mapRedirectDto(r: {
    id: string;
    sourcePath: string;
    destinationUrl: string;
    redirectType: CmsRedirectType;
    isActive: boolean;
    hitCount?: number;
    note?: string | null;
    createdById?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  }): CmsRedirectRuleDto {
    return {
      id: r.id,
      sourcePath: r.sourcePath,
      destinationUrl: r.destinationUrl,
      redirectType: r.redirectType,
      isActive: r.isActive,
      hitCount: r.hitCount ?? 0,
      note: r.note ?? null,
      createdById: r.createdById ?? null,
      createdAt: r.createdAt?.toISOString?.() ?? new Date().toISOString(),
      updatedAt: r.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    };
  }

  async listRedirects(filters?: {
    search?: string;
    redirectType?: CmsRedirectType | 'all';
    isActive?: 'all' | 'true' | 'false';
  }): Promise<CmsRedirectRuleDto[]> {
    if (!this.db.cmsRedirect) return [];
    const rows = await this.db.cmsRedirect.findMany({
      orderBy: [{ createdAt: 'desc' }],
    });

    const q = filters?.search?.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (filters?.redirectType && filters.redirectType !== 'all' && r.redirectType !== filters.redirectType) {
          return false;
        }
        if (filters?.isActive === 'true' && !r.isActive) return false;
        if (filters?.isActive === 'false' && r.isActive) return false;
        if (q) {
          return (
            r.sourcePath.toLowerCase().includes(q) ||
            r.destinationUrl.toLowerCase().includes(q) ||
            (r.note || '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .map((r) => this.mapRedirectDto(r));
  }

  async createRedirect(
    input: UpsertCmsRedirectInput,
    actor: PlatformActorContext,
  ): Promise<CmsRedirectRuleDto> {
    assertCmsEditAllowed(actor);
    const sourcePath = normalizeRedirectSourcePath(input.sourcePath);
    const destinationUrl = input.destinationUrl.trim();
    const redirectType: CmsRedirectType = input.redirectType ?? 'permanent_301';
    const isActive = input.isActive !== undefined ? Boolean(input.isActive) : true;

    const existingRules = await this.db.cmsRedirect.findMany({
      select: { id: true, sourcePath: true, destinationUrl: true, isActive: true },
    });
    const dup = existingRules.find((r) => normalizeRedirectSourcePath(r.sourcePath) === sourcePath);
    if (dup) {
      throw new ConflictException({
        code: 'CMS_REDIRECT_EXISTS',
        message: `A redirect rule from "${sourcePath}" already exists. Edit the existing rule instead.`,
      });
    }

    assertNoRedirectLoopOrChain(
      { sourcePath, destinationUrl, isActive },
      existingRules,
    );

    const created = await this.db.cmsRedirect.create({
      data: {
        sourcePath,
        destinationUrl,
        redirectType,
        isActive,
        note: input.note?.trim() || null,
        createdById: actor.id ?? null,
      },
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.redirect.created',
      module: 'cms',
      recordId: created.id,
      reason: `Created ${redirectType} redirect ${sourcePath} -> ${destinationUrl}`,
      oldValue: null,
      newValue: this.mapRedirectDto(created),
    });

    return this.mapRedirectDto(created);
  }

  async updateRedirect(
    id: string,
    input: Partial<UpsertCmsRedirectInput>,
    actor: PlatformActorContext,
  ): Promise<CmsRedirectRuleDto> {
    assertCmsEditAllowed(actor);
    const existing = await this.db.cmsRedirect.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`CMS redirect "${id}" not found.`);
    }

    const nextSource =
      input.sourcePath !== undefined ? normalizeRedirectSourcePath(input.sourcePath) : existing.sourcePath;
    const nextDest =
      input.destinationUrl !== undefined ? input.destinationUrl.trim() : existing.destinationUrl;
    const nextType = input.redirectType ?? existing.redirectType;
    const nextActive = input.isActive !== undefined ? Boolean(input.isActive) : existing.isActive;

    const existingRules = await this.db.cmsRedirect.findMany({
      select: { id: true, sourcePath: true, destinationUrl: true, isActive: true },
    });
    const dup = existingRules.find(
      (r) => r.id !== id && normalizeRedirectSourcePath(r.sourcePath) === nextSource,
    );
    if (dup) {
      throw new ConflictException({
        code: 'CMS_REDIRECT_EXISTS',
        message: `Another redirect rule already uses source path "${nextSource}".`,
      });
    }

    assertNoRedirectLoopOrChain(
      { id, sourcePath: nextSource, destinationUrl: nextDest, isActive: nextActive },
      existingRules,
    );

    const before = this.mapRedirectDto(existing);
    const updated = await this.db.cmsRedirect.update({
      where: { id },
      data: {
        sourcePath: nextSource,
        destinationUrl: nextDest,
        redirectType: nextType,
        isActive: nextActive,
        ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}),
      },
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.redirect.updated',
      module: 'cms',
      recordId: id,
      reason: `Updated redirect rule ${updated.sourcePath} -> ${updated.destinationUrl}`,
      oldValue: before,
      newValue: this.mapRedirectDto(updated),
    });

    return this.mapRedirectDto(updated);
  }

  async deleteRedirect(
    id: string,
    actor: PlatformActorContext,
  ): Promise<{ id: string; deleted: true }> {
    assertCmsEditAllowed(actor);
    const existing = await this.db.cmsRedirect.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`CMS redirect "${id}" not found.`);
    }

    await this.db.cmsRedirect.delete({ where: { id } });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.redirect.deleted',
      module: 'cms',
      recordId: id,
      reason: `Deleted redirect rule ${existing.sourcePath}`,
      oldValue: this.mapRedirectDto(existing),
      newValue: null,
    });

    return { id, deleted: true };
  }

  private parseCsvRows(rawCsv: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    const text = rawCsv.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          currentCell += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (ch === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += ch;
      }
    }
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
    return rows;
  }

  async importRedirectsCsv(
    csvText: string,
    actor: PlatformActorContext,
  ): Promise<CmsRedirectCsvImportResultDto> {
    assertCmsEditAllowed(actor);
    const rows = this.parseCsvRows(csvText);
    if (rows.length === 0) {
      throw new BadRequestException({
        code: 'CMS_REDIRECT_CSV_EMPTY',
        message: 'CSV import payload is empty.',
      });
    }

    const firstLower = rows[0].map((c) => c.toLowerCase().replace(/[^a-z0-9_]/g, ''));
    const hasHeader =
      firstLower.includes('source_path') ||
      firstLower.includes('sourcepath') ||
      firstLower.includes('source');

    const colIdx = {
      source: hasHeader
        ? firstLower.findIndex((h) => h === 'source_path' || h === 'sourcepath' || h === 'source')
        : 0,
      dest: hasHeader
        ? firstLower.findIndex(
          (h) => h === 'destination_url' || h === 'destination' || h === 'target' || h === 'dest',
        )
        : 1,
      type: hasHeader
        ? firstLower.findIndex((h) => h === 'redirect_type' || h === 'type' || h === 'status')
        : 2,
      active: hasHeader
        ? firstLower.findIndex((h) => h === 'is_active' || h === 'active')
        : 3,
      note: hasHeader ? firstLower.findIndex((h) => h === 'note') : 4,
    };

    const dataRows = hasHeader ? rows.slice(1) : rows;
    const allExisting = await this.db.cmsRedirect.findMany();
    const workingSet = allExisting.map((r) => ({ ...r }));

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ row: number; sourcePath: string; error: string }> = [];
    const touchedRules: CmsRedirectRuleDto[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const rowNum = hasHeader ? i + 2 : i + 1;
      const cells = dataRows[i];
      const rawSrc = colIdx.source >= 0 ? (cells[colIdx.source] ?? '') : '';
      const rawDest = colIdx.dest >= 0 ? (cells[colIdx.dest] ?? '') : '';
      const rawType = (colIdx.type >= 0 ? (cells[colIdx.type] ?? '') : '').toLowerCase();
      const rawActive = (colIdx.active >= 0 ? (cells[colIdx.active] ?? '') : '').toLowerCase();
      const rawNote = colIdx.note >= 0 ? (cells[colIdx.note] ?? '') : '';

      if (!rawSrc || !rawDest) {
        errors.push({ row: rowNum, sourcePath: rawSrc, error: 'Missing source_path or destination_url' });
        skipped++;
        continue;
      }

      const redirectType: CmsRedirectType =
        rawType === '302' || rawType === 'temporary_302'
          ? 'temporary_302'
          : rawType === '307' || rawType === 'temporary_307'
            ? 'temporary_307'
            : rawType === '308' || rawType === 'permanent_308'
              ? 'permanent_308'
              : 'permanent_301';

      const isActive = rawActive === 'false' || rawActive === '0' || rawActive === 'no' ? false : true;

      try {
        const sourcePath = normalizeRedirectSourcePath(rawSrc);
        const existingMatch = workingSet.find(
          (r) => normalizeRedirectSourcePath(r.sourcePath) === sourcePath,
        );
        assertNoRedirectLoopOrChain(
          {
            id: existingMatch?.id,
            sourcePath,
            destinationUrl: rawDest,
            isActive,
          },
          workingSet,
        );

        const saved = await this.db.cmsRedirect.upsert({
          where: { sourcePath },
          create: {
            sourcePath,
            destinationUrl: rawDest,
            redirectType,
            isActive,
            note: rawNote || 'Imported via CSV',
            createdById: actor.id ?? null,
          },
          update: {
            destinationUrl: rawDest,
            redirectType,
            isActive,
            ...(rawNote ? { note: rawNote } : {}),
          },
        });

        if (existingMatch) {
          updated++;
          const idx = workingSet.findIndex((w) => w.id === existingMatch.id);
          if (idx >= 0) workingSet[idx] = { ...saved };
        } else {
          created++;
          workingSet.push({ ...saved });
        }
        touchedRules.push(this.mapRedirectDto(saved));
      } catch (err) {
        skipped++;
        errors.push({
          row: rowNum,
          sourcePath: rawSrc,
          error: err instanceof Error ? err.message : 'Invalid redirect rule',
        });
      }
    }

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.redirects.csv_imported',
      module: 'cms',
      recordId: 'bulk-csv',
      reason: `Imported CMS redirects CSV (${created} created, ${updated} updated, ${skipped} skipped)`,
      oldValue: null,
      newValue: { created, updated, skipped, errorCount: errors.length },
    });

    return { created, updated, skipped, errors, rules: touchedRules };
  }

  async exportRedirectsCsv(): Promise<string> {
    const rules = await this.listRedirects();
    const escapeCell = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };
    const lines = [
      'source_path,destination_url,redirect_type,is_active,hit_count,note',
      ...rules.map((r) =>
        [
          escapeCell(r.sourcePath),
          escapeCell(r.destinationUrl),
          escapeCell(r.redirectType),
          String(r.isActive),
          String(r.hitCount ?? 0),
          escapeCell(r.note ?? ''),
        ].join(','),
      ),
    ];
    return `${lines.join('\n')}\n`;
  }

  async resolvePublicRedirect(rawPath: string): Promise<CmsRedirectRuleDto | null> {
    if (!this.db.cmsRedirect) return null;
    const norm = normalizeInternalCmsPath(rawPath).toLowerCase();
    const rule = await this.db.cmsRedirect.findFirst({
      where: {
        sourcePath: norm,
        isActive: true,
      },
    });
    if (!rule) return null;

    let updatedHitCount = (rule.hitCount ?? 0) + 1;
    try {
      if (typeof this.db.cmsRedirect.update === 'function') {
        const updated = await this.db.cmsRedirect.update({
          where: { id: rule.id },
          data: { hitCount: { increment: 1 } },
        });
        if (typeof updated?.hitCount === 'number') {
          updatedHitCount = updated.hitCount;
        }
      }
    } catch {
      // Hit counter update is best-effort
    }

    return {
      ...this.mapRedirectDto(rule),
      hitCount: updatedHitCount,
    };
  }

  async restorePage(
    pageId: string,
    actor: PlatformActorContext,
    reason?: string,
  ): Promise<CmsPageDto> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsPage.findUnique({
      where: { id: pageId },
      include: { locales: true },
    });
    if (!existing) {
      throw new NotFoundException(`CMS page "${pageId}" not found.`);
    }
    if (existing.status !== 'trashed' && !existing.deletedAt) {
      throw new BadRequestException({
        code: 'CMS_PAGE_NOT_TRASHED',
        message: `CMS page "${existing.slug}" is not in trash.`,
      });
    }

    const beforeState = this.pickPageWorkflowSnapshot(existing);
    const updated = await this.db.cmsPage.update({
      where: { id: pageId },
      data: {
        status: 'draft',
        deletedAt: null,
        scheduledAt: null,
        scheduledTimezone: null,
        scheduledById: null,
      },
      include: { locales: true },
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.page_restored',
      module: 'cms',
      recordId: pageId,
      reason: reason?.trim() || `Restored CMS page "${existing.slug}" from trash to draft`,
      oldValue: beforeState,
      newValue: this.pickPageWorkflowSnapshot(updated),
    });

    this.triggerRevalidate({
      scopes: ['cms-pages'],
      slugs: [existing.slug],
    });

    return this.mapPageDto(updated);
  }

  /**
   * Duplicates a custom CMS page into a fresh draft with cloned active EN/BN versions.
   * System/locked pages cannot be duplicated.
   */
  async duplicateCustomPage(
    pageId: string,
    input: DuplicateCmsPageInput,
    actor: PlatformActorContext,
  ): Promise<CmsPageDto> {
    assertCmsEditAllowed(actor);

    const source = await this.db.cmsPage.findUnique({
      where: { id: pageId },
      include: {
        locales: true,
        versions: {
          orderBy: [{ locale: 'asc' }, { versionNumber: 'desc' }],
        },
      },
    });
    if (!source || source.deletedAt) {
      throw new NotFoundException(`CMS page "${pageId}" not found.`);
    }

    if (source.kind === 'system' || source.locked) {
      throw new ForbiddenException({
        code: 'SYSTEM_PAGE_DUPLICATE_FORBIDDEN',
        message: `System page "${source.slug}" is locked and cannot be duplicated. Only custom pages can be duplicated.`,
      });
    }

    let nextSlug: string;
    if (input?.slug?.trim()) {
      nextSlug = assertValidCmsSlug(input.slug, { checkReserved: true });
      const exists = await this.db.cmsPage.findUnique({ where: { slug: nextSlug } });
      if (exists) {
        throw new ConflictException({
          code: 'CMS_SLUG_EXISTS',
          message: `CMS page with slug "${nextSlug}" already exists.`,
        });
      }
    } else {
      const baseCopySlug = `${source.slug}-copy`.slice(0, 110).replace(/-+$/g, '');
      nextSlug = assertValidCmsSlug(baseCopySlug, { checkReserved: true });
      let suffix = 2;
      while (await this.db.cmsPage.findUnique({ where: { slug: nextSlug } })) {
        nextSlug = `${baseCopySlug}-${suffix}`;
        suffix++;
      }
    }

    const pickActiveLocaleVersion = (loc: CmsLocale) => {
      const row = source.locales.find((l) => l.locale === loc);
      const targetId = row?.currentDraftVersionId || row?.currentPublishedVersionId;
      if (targetId) {
        const match = source.versions.find((v) => v.id === targetId);
        if (match) return match;
      }
      return source.versions.find((v) => v.locale === loc) ?? null;
    };

    const enSource = pickActiveLocaleVersion('en');
    const bnSource = pickActiveLocaleVersion('bn');
    const authorDisplay = actor.email || 'Platform Staff';

    const duplicated = await this.db.$transaction(async (tx) => {
      const createdPage = await tx.cmsPage.create({
        data: {
          kind: 'custom',
          slug: nextSlug,
          status: 'draft',
          locked: false,
          requiresApproval: isLegalCmsPage(nextSlug, false),
          approvalStatus: 'none',
        },
      });

      const baseEnTitle = input?.titleEn?.trim() || (enSource ? `${enSource.title} (Copy)` : nextSlug);
      const enVersion = await tx.cmsPageVersion.create({
        data: {
          pageId: createdPage.id,
          versionNumber: 1,
          locale: 'en',
          title: baseEnTitle,
          seoTitle: enSource?.seoTitle ? `${enSource.seoTitle} (Copy)` : baseEnTitle,
          seoDescription: enSource?.seoDescription ?? null,
          canonicalPath: `/p/${nextSlug}`,
          ogImageUrl: enSource?.ogImageUrl ?? null,
          noIndex: false,
          blocks: (enSource?.blocks ?? []) as Prisma.InputJsonValue,
          isTranslated: true,
          authorId: actor.id ?? null,
          authorName: authorDisplay,
          changeNote: input?.note?.trim() || `Duplicated from custom page "${source.slug}"`,
        },
      });

      await tx.cmsPageLocale.create({
        data: {
          pageId: createdPage.id,
          locale: 'en',
          isTranslated: true,
          translationStatus: 'translated',
          currentDraftVersionId: enVersion.id,
          currentPublishedVersionId: null,
        },
      });

      if (bnSource && bnSource.isTranslated) {
        const bnVersion = await tx.cmsPageVersion.create({
          data: {
            pageId: createdPage.id,
            versionNumber: 1,
            locale: 'bn',
            title: `${bnSource.title} (কপি)`,
            seoTitle: bnSource.seoTitle ?? null,
            seoDescription: bnSource.seoDescription ?? null,
            canonicalPath: `/bn/p/${nextSlug}`,
            ogImageUrl: bnSource.ogImageUrl ?? null,
            noIndex: false,
            blocks: (bnSource.blocks ?? []) as Prisma.InputJsonValue,
            isTranslated: true,
            authorId: actor.id ?? null,
            authorName: authorDisplay,
            changeNote: input?.note?.trim() || `Duplicated Bengali draft from "${source.slug}"`,
          },
        });

        await tx.cmsPageLocale.create({
          data: {
            pageId: createdPage.id,
            locale: 'bn',
            isTranslated: true,
            translationStatus: 'translated',
            currentDraftVersionId: bnVersion.id,
            currentPublishedVersionId: null,
          },
        });
      } else {
        await tx.cmsPageLocale.create({
          data: {
            pageId: createdPage.id,
            locale: 'bn',
            isTranslated: false,
            translationStatus: 'untranslated',
          },
        });
      }

      return tx.cmsPage.findUniqueOrThrow({
        where: { id: createdPage.id },
        include: { locales: true },
      });
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.page_duplicated',
      module: 'cms',
      recordId: duplicated.id,
      reason: input?.note?.trim() || `Duplicated custom page "${source.slug}" -> "${nextSlug}"`,
      oldValue: { sourcePageId: source.id, sourceSlug: source.slug },
      newValue: this.pickPageWorkflowSnapshot(duplicated),
    });

    return {
      ...this.mapPageDto(duplicated),
      titleEn: input?.titleEn?.trim() || (enSource ? `${enSource.title} (Copy)` : nextSlug),
      canonicalPath: `/p/${nextSlug}`,
      lastEditedById: actor.id ?? null,
      lastEditedByName: authorDisplay,
      lastEditedAt: duplicated.createdAt.toISOString(),
    };
  }

  // =========================================================================
  // Posts Workflow (Draft, Schedule in Timezone, Publish, Unpublish, Trash, Restore)
  // & Categories / Authors Management
  // =========================================================================

  async listPosts(
    filters?:
      | boolean
      | {
        status?: CmsPostDto['status'] | 'all';
        categoryId?: string;
        authorId?: string;
        localeStatus?: 'all' | 'bn_translated' | 'bn_missing';
        tag?: string;
        search?: string;
        includeTrashed?: boolean;
      },
  ): Promise<CmsPostDto[]> {
    const opts =
      typeof filters === 'boolean' ? { includeTrashed: filters } : filters ?? {};
    const where: Prisma.CmsPostWhereInput = {};

    if (opts.status && opts.status !== 'all') {
      where.status = opts.status;
      if (opts.status !== 'trashed') {
        where.deletedAt = null;
      }
    } else if (!opts.includeTrashed) {
      where.deletedAt = null;
    }

    if (opts.categoryId && opts.categoryId !== 'all') {
      where.categoryId = opts.categoryId;
    }
    if (opts.authorId && opts.authorId !== 'all') {
      where.authorId = opts.authorId;
    }
    if (opts.localeStatus === 'bn_translated') {
      where.isBnTranslated = true;
    } else if (opts.localeStatus === 'bn_missing') {
      where.isBnTranslated = false;
    }
    if (opts.tag?.trim()) {
      where.tags = { has: opts.tag.trim() };
    }
    if (opts.search?.trim()) {
      const q = opts.search.trim();
      where.OR = [
        { slug: { contains: q, mode: 'insensitive' } },
        { titleEn: { contains: q, mode: 'insensitive' } },
        { titleBn: { contains: q, mode: 'insensitive' } },
        { excerptEn: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await this.db.cmsPost.findMany({
      where,
      include: {
        category: true,
        author: true,
        coverMedia: { select: { id: true, altEn: true, altBn: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
    return rows.map((r) => this.mapPostDto(r));
  }

  async getPostById(postId: string): Promise<CmsPostDto> {
    const post = await this.db.cmsPost.findUnique({
      where: { id: postId },
      include: {
        category: true,
        author: true,
        coverMedia: { select: { id: true, altEn: true, altBn: true } },
      },
    });
    if (!post) {
      throw new NotFoundException(`CMS post "${postId}" not found.`);
    }
    return this.mapPostDto(post);
  }

  async createPostDraft(
    input: {
      slug: string;
      categoryId: string;
      authorId: string;
      coverMediaId?: string | null;
      coverAltEn?: string | null;
      coverAltBn?: string | null;
      titleEn: string;
      titleBn?: string | null;
      excerptEn: string;
      excerptBn?: string | null;
      bodyJsonEn?: Record<string, unknown>;
      bodyHtmlEn: string;
      bodyJsonBn?: Record<string, unknown> | null;
      bodyHtmlBn?: string | null;
      isBnTranslated?: boolean;
      seoTitleEn?: string | null;
      seoDescriptionEn?: string | null;
      seoTitleBn?: string | null;
      seoDescriptionBn?: string | null;
      publishedAt?: string | null;
      relatedPostIds?: string[];
      tags?: string[];
      readingTimeMinutes?: number;
    },
    actor: PlatformActorContext,
  ): Promise<CmsPostDto> {
    assertCmsEditAllowed(actor);
    const slug = assertValidCmsSlug(input.slug, { checkReserved: false });
    const existingSlug = await this.db.cmsPost.findUnique({ where: { slug } });
    if (existingSlug) {
      throw new ConflictException({
        code: 'CMS_POST_SLUG_TAKEN',
        message: `A blog post with slug "${slug}" already exists.`,
      });
    }

    const cleanHtmlEn = sanitizeCmsRichTextHtml(input.bodyHtmlEn);
    const cleanHtmlBn = input.bodyHtmlBn ? sanitizeCmsRichTextHtml(input.bodyHtmlBn) : null;
    const isBn = Boolean(input.isBnTranslated && input.titleBn && cleanHtmlBn);
    const tags = Array.from(
      new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean)),
    ).slice(0, 20);
    const relatedPostIds = Array.from(
      new Set((input.relatedPostIds ?? []).map((id) => id.trim()).filter(Boolean)),
    ).slice(0, 6);
    const readingTimeMinutes =
      input.readingTimeMinutes !== undefined
        ? Math.max(1, Math.min(120, Math.round(input.readingTimeMinutes)))
        : computeCmsReadingTimeMinutes(cleanHtmlEn, cleanHtmlBn);
    const customPublishedAt = input.publishedAt ? new Date(input.publishedAt) : null;
    if (customPublishedAt && Number.isNaN(customPublishedAt.getTime())) {
      throw new BadRequestException({
        code: 'CMS_INVALID_PUBLISH_DATE',
        message: 'Publish date must be a valid ISO timestamp.',
      });
    }

    const created = await this.db.cmsPost.create({
      data: {
        slug,
        status: 'draft',
        categoryId: input.categoryId,
        authorId: input.authorId,
        coverMediaId: input.coverMediaId ?? null,
        coverAltEn: input.coverAltEn?.trim() || null,
        coverAltBn: input.coverAltBn?.trim() || null,
        titleEn: input.titleEn.trim(),
        titleBn: input.titleBn?.trim() || null,
        excerptEn: input.excerptEn.trim(),
        excerptBn: input.excerptBn?.trim() || null,
        bodyJsonEn: (input.bodyJsonEn ?? {}) as Prisma.InputJsonValue,
        bodyHtmlEn: cleanHtmlEn,
        bodyJsonBn: input.bodyJsonBn ? (input.bodyJsonBn as Prisma.InputJsonValue) : undefined,
        bodyHtmlBn: cleanHtmlBn,
        isBnTranslated: isBn,
        bnTranslationStatus: isBn ? 'translated' : 'untranslated',
        seoTitleEn: input.seoTitleEn?.trim() || null,
        seoDescriptionEn: input.seoDescriptionEn?.trim() || null,
        seoTitleBn: input.seoTitleBn?.trim() || null,
        seoDescriptionBn: input.seoDescriptionBn?.trim() || null,
        publishedAt: customPublishedAt,
        relatedPostIds,
        tags,
        readingTimeMinutes,
      },
      include: {
        category: true,
        author: true,
        coverMedia: { select: { id: true, altEn: true, altBn: true } },
      },
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.post_created',
      module: 'cms',
      recordId: created.id,
      reason: `Created blog post draft "${slug}"`,
      oldValue: null,
      newValue: this.pickPostAuditSnapshot(created),
    });

    return this.mapPostDto(created);
  }

  async updatePostDraft(
    postId: string,
    input: Partial<{
      slug: string;
      categoryId: string;
      authorId: string;
      coverMediaId: string | null;
      coverAltEn: string | null;
      coverAltBn: string | null;
      titleEn: string;
      titleBn: string | null;
      excerptEn: string;
      excerptBn: string | null;
      bodyJsonEn: Record<string, unknown>;
      bodyHtmlEn: string;
      bodyJsonBn: Record<string, unknown> | null;
      bodyHtmlBn: string | null;
      isBnTranslated: boolean;
      seoTitleEn: string | null;
      seoDescriptionEn: string | null;
      seoTitleBn: string | null;
      seoDescriptionBn: string | null;
      publishedAt: string | null;
      relatedPostIds: string[];
      tags: string[];
      readingTimeMinutes: number;
    }>,
    actor: PlatformActorContext,
  ): Promise<CmsPostDto> {
    assertCmsEditAllowed(actor);
    const existing = await this.db.cmsPost.findUnique({ where: { id: postId } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`CMS post "${postId}" not found.`);
    }

    const beforeState = this.pickPostAuditSnapshot(existing);
    const slug =
      input.slug !== undefined ? assertValidCmsSlug(input.slug, { checkReserved: false }) : undefined;
    if (slug && slug !== existing.slug) {
      const collision = await this.db.cmsPost.findUnique({ where: { slug } });
      if (collision && collision.id !== postId) {
        throw new ConflictException({
          code: 'CMS_POST_SLUG_TAKEN',
          message: `A blog post with slug "${slug}" already exists.`,
        });
      }
    }

    const cleanHtmlEn =
      input.bodyHtmlEn !== undefined ? sanitizeCmsRichTextHtml(input.bodyHtmlEn) : undefined;
    const cleanHtmlBn =
      input.bodyHtmlBn !== undefined
        ? input.bodyHtmlBn
          ? sanitizeCmsRichTextHtml(input.bodyHtmlBn)
          : null
        : undefined;

    const tags =
      input.tags !== undefined
        ? Array.from(new Set(input.tags.map((t) => t.trim()).filter(Boolean))).slice(0, 20)
        : undefined;
    const relatedPostIds =
      input.relatedPostIds !== undefined
        ? Array.from(
          new Set(input.relatedPostIds.map((id) => id.trim()).filter((id) => id && id !== postId)),
        ).slice(0, 6)
        : undefined;

    let parsedPublishedAt: Date | null | undefined = undefined;
    if (input.publishedAt !== undefined) {
      if (input.publishedAt === null || input.publishedAt === '') {
        parsedPublishedAt = null;
      } else {
        const dt = new Date(input.publishedAt);
        if (Number.isNaN(dt.getTime())) {
          throw new BadRequestException({
            code: 'CMS_INVALID_PUBLISH_DATE',
            message: 'Publish date must be a valid ISO timestamp.',
          });
        }
        parsedPublishedAt = dt;
      }
    }

    const effectiveHtmlEn = cleanHtmlEn !== undefined ? cleanHtmlEn : existing.bodyHtmlEn;
    const effectiveHtmlBn = cleanHtmlBn !== undefined ? cleanHtmlBn : existing.bodyHtmlBn;
    const readingTimeMinutes =
      input.readingTimeMinutes !== undefined
        ? Math.max(1, Math.min(120, Math.round(input.readingTimeMinutes)))
        : cleanHtmlEn !== undefined || cleanHtmlBn !== undefined
          ? computeCmsReadingTimeMinutes(effectiveHtmlEn, effectiveHtmlBn)
          : undefined;

    const updated = await this.db.cmsPost.update({
      where: { id: postId },
      data: {
        ...(slug !== undefined ? { slug } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.authorId !== undefined ? { authorId: input.authorId } : {}),
        ...(input.coverMediaId !== undefined ? { coverMediaId: input.coverMediaId } : {}),
        ...(input.coverAltEn !== undefined ? { coverAltEn: input.coverAltEn?.trim() || null } : {}),
        ...(input.coverAltBn !== undefined ? { coverAltBn: input.coverAltBn?.trim() || null } : {}),
        ...(input.titleEn !== undefined ? { titleEn: input.titleEn.trim() } : {}),
        ...(input.titleBn !== undefined ? { titleBn: input.titleBn?.trim() || null } : {}),
        ...(input.excerptEn !== undefined ? { excerptEn: input.excerptEn.trim() } : {}),
        ...(input.excerptBn !== undefined ? { excerptBn: input.excerptBn?.trim() || null } : {}),
        ...(input.bodyJsonEn !== undefined
          ? { bodyJsonEn: input.bodyJsonEn as Prisma.InputJsonValue }
          : {}),
        ...(cleanHtmlEn !== undefined ? { bodyHtmlEn: cleanHtmlEn } : {}),
        ...(input.bodyJsonBn !== undefined
          ? {
            bodyJsonBn: input.bodyJsonBn
              ? (input.bodyJsonBn as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          }
          : {}),
        ...(cleanHtmlBn !== undefined ? { bodyHtmlBn: cleanHtmlBn } : {}),
        ...(input.isBnTranslated !== undefined
          ? {
            isBnTranslated: input.isBnTranslated,
            bnTranslationStatus: input.isBnTranslated ? 'translated' : 'untranslated',
          }
          : {}),
        ...(input.seoTitleEn !== undefined ? { seoTitleEn: input.seoTitleEn?.trim() || null } : {}),
        ...(input.seoDescriptionEn !== undefined
          ? { seoDescriptionEn: input.seoDescriptionEn?.trim() || null }
          : {}),
        ...(input.seoTitleBn !== undefined ? { seoTitleBn: input.seoTitleBn?.trim() || null } : {}),
        ...(input.seoDescriptionBn !== undefined
          ? { seoDescriptionBn: input.seoDescriptionBn?.trim() || null }
          : {}),
        ...(parsedPublishedAt !== undefined ? { publishedAt: parsedPublishedAt } : {}),
        ...(relatedPostIds !== undefined ? { relatedPostIds } : {}),
        ...(tags !== undefined ? { tags } : {}),
        ...(readingTimeMinutes !== undefined ? { readingTimeMinutes } : {}),
      },
      include: {
        category: true,
        author: true,
        coverMedia: { select: { id: true, altEn: true, altBn: true } },
      },
    });

    if (existing.status === 'published' && slug && slug !== existing.slug) {
      await this.upsertAutoPermanent301Redirect(
        `/blog/${existing.slug}`,
        `/blog/${slug}`,
        actor,
        `Automatic 301 created when published post slug changed from /blog/${existing.slug} to /blog/${slug}`,
      );
    }

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.post_updated',
      module: 'cms',
      recordId: postId,
      oldValue: beforeState,
      newValue: this.pickPostAuditSnapshot(updated),
    });

    return this.mapPostDto(updated);
  }

  async publishPostNow(postId: string, actor: PlatformActorContext): Promise<CmsPostDto> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsPost.findUnique({ where: { id: postId } });
    if (!existing || existing.deletedAt || existing.status === 'trashed') {
      throw new NotFoundException(`CMS post "${postId}" not found or trashed.`);
    }
    const beforeState = this.pickPostAuditSnapshot(existing);
    const updated = await this.db.cmsPost.update({
      where: { id: postId },
      data: {
        status: 'published',
        publishedAt: existing.publishedAt ?? new Date(),
        scheduledAt: null,
        scheduledTimezone: null,
        scheduledById: null,
      },
      include: {
        category: true,
        author: true,
        coverMedia: { select: { id: true, altEn: true, altBn: true } },
      },
    });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.post_published',
      module: 'cms',
      recordId: postId,
      oldValue: beforeState,
      newValue: this.pickPostAuditSnapshot(updated),
    });
    this.triggerRevalidate({ scopes: ['cms-posts'], slugs: [updated.slug] });
    return this.mapPostDto(updated);
  }

  async schedulePostPublish(
    postId: string,
    input: { scheduledAt: string; timezone?: string },
    actor: PlatformActorContext,
    now = new Date(),
  ): Promise<CmsPostDto> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsPost.findUnique({ where: { id: postId } });
    if (!existing || existing.deletedAt || existing.status === 'trashed') {
      throw new NotFoundException(`CMS post "${postId}" not found or trashed.`);
    }
    const staffTimezone = input.timezone?.trim() || actor.timezone || 'UTC';
    const { scheduledAtUtc, timeZone } = parseScheduledDateInTimezone(
      input.scheduledAt,
      staffTimezone,
    );
    if (scheduledAtUtc.getTime() <= now.getTime()) {
      throw new BadRequestException({
        code: 'CMS_SCHEDULE_IN_PAST',
        message: `Scheduled publication time (${scheduledAtUtc.toISOString()}) must be in the future.`,
      });
    }

    const beforeState = this.pickPostAuditSnapshot(existing);
    const updated = await this.db.cmsPost.update({
      where: { id: postId },
      data: {
        status: 'scheduled',
        scheduledAt: scheduledAtUtc,
        scheduledTimezone: timeZone,
        scheduledById: actor.id ?? null,
      },
      include: {
        category: true,
        author: true,
        coverMedia: { select: { id: true, altEn: true, altBn: true } },
      },
    });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.post_scheduled',
      module: 'cms',
      recordId: postId,
      oldValue: beforeState,
      newValue: this.pickPostAuditSnapshot(updated),
    });
    return this.mapPostDto(updated);
  }

  async unpublishPost(postId: string, actor: PlatformActorContext): Promise<CmsPostDto> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsPost.findUnique({ where: { id: postId } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`CMS post "${postId}" not found.`);
    }
    const beforeState = this.pickPostAuditSnapshot(existing);
    const updated = await this.db.cmsPost.update({
      where: { id: postId },
      data: {
        status: 'unpublished',
        scheduledAt: null,
        scheduledTimezone: null,
        scheduledById: null,
      },
      include: {
        category: true,
        author: true,
        coverMedia: { select: { id: true, altEn: true, altBn: true } },
      },
    });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.post_unpublished',
      module: 'cms',
      recordId: postId,
      oldValue: beforeState,
      newValue: this.pickPostAuditSnapshot(updated),
    });
    this.triggerRevalidate({ scopes: ['cms-posts'], slugs: [updated.slug] });
    return this.mapPostDto(updated);
  }

  async trashPost(postId: string, actor: PlatformActorContext): Promise<CmsPostDto> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsPost.findUnique({ where: { id: postId } });
    if (!existing) {
      throw new NotFoundException(`CMS post "${postId}" not found.`);
    }
    const beforeState = this.pickPostAuditSnapshot(existing);
    const updated = await this.db.cmsPost.update({
      where: { id: postId },
      data: {
        status: 'trashed',
        deletedAt: new Date(),
        scheduledAt: null,
        scheduledTimezone: null,
        scheduledById: null,
      },
      include: {
        category: true,
        author: true,
        coverMedia: { select: { id: true, altEn: true, altBn: true } },
      },
    });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.post_trashed',
      module: 'cms',
      recordId: postId,
      oldValue: beforeState,
      newValue: this.pickPostAuditSnapshot(updated),
    });
    this.triggerRevalidate({ scopes: ['cms-posts'], slugs: [updated.slug] });
    return this.mapPostDto(updated);
  }

  async restorePost(postId: string, actor: PlatformActorContext): Promise<CmsPostDto> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsPost.findUnique({ where: { id: postId } });
    if (!existing) {
      throw new NotFoundException(`CMS post "${postId}" not found.`);
    }
    if (existing.status !== 'trashed' && !existing.deletedAt) {
      throw new BadRequestException({
        code: 'CMS_POST_NOT_TRASHED',
        message: `CMS post "${existing.slug}" is not trashed.`,
      });
    }
    const beforeState = this.pickPostAuditSnapshot(existing);
    const updated = await this.db.cmsPost.update({
      where: { id: postId },
      data: {
        status: 'draft',
        deletedAt: null,
        scheduledAt: null,
        scheduledTimezone: null,
        scheduledById: null,
      },
      include: {
        category: true,
        author: true,
        coverMedia: { select: { id: true, altEn: true, altBn: true } },
      },
    });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.post_restored',
      module: 'cms',
      recordId: postId,
      oldValue: beforeState,
      newValue: this.pickPostAuditSnapshot(updated),
    });
    return this.mapPostDto(updated);
  }

  async permanentlyDeletePost(
    postId: string,
    confirmText: string,
    actor: PlatformActorContext,
  ): Promise<{ id: string; slug: string; deleted: true }> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsPost.findUnique({ where: { id: postId } });
    if (!existing) {
      throw new NotFoundException(`CMS post "${postId}" not found.`);
    }
    if (existing.status !== 'trashed' && !existing.deletedAt) {
      throw new BadRequestException({
        code: 'CMS_POST_MUST_BE_TRASHED',
        message: 'Only trashed blog posts can be permanently deleted. Move the post to Trash first.',
      });
    }
    const normalizedConfirm = (confirmText || '').trim().toLowerCase();
    if (
      normalizedConfirm !== existing.slug.toLowerCase() &&
      normalizedConfirm !== existing.titleEn.trim().toLowerCase()
    ) {
      throw new BadRequestException({
        code: 'CMS_DELETE_CONFIRMATION_MISMATCH',
        message: `Confirmation text must match the post slug "${existing.slug}" or English title.`,
      });
    }

    const beforeState = this.pickPostAuditSnapshot(existing);
    await this.db.cmsPost.delete({ where: { id: postId } });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.post_permanently_deleted',
      module: 'cms',
      recordId: postId,
      reason: `Permanently deleted blog post "/blog/${existing.slug}"`,
      oldValue: beforeState,
      newValue: null,
    });
    return { id: postId, slug: existing.slug, deleted: true };
  }

  async listPostCategories(): Promise<CmsPostCategoryDto[]> {
    const categories = await this.db.cmsPostCategory.findMany({
      include: {
        _count: {
          select: {
            posts: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    });
    return categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      nameEn: c.nameEn,
      nameBn: c.nameBn ?? null,
      descriptionEn: c.descriptionEn ?? null,
      descriptionBn: c.descriptionBn ?? null,
      sortOrder: c.sortOrder,
      postCount: c._count?.posts ?? 0,
    }));
  }

  async createPostCategory(
    input: {
      slug: string;
      nameEn: string;
      nameBn?: string | null;
      descriptionEn?: string | null;
      descriptionBn?: string | null;
      sortOrder?: number;
    },
    actor: PlatformActorContext,
  ): Promise<CmsPostCategoryDto> {
    assertCmsPublishAllowed(actor);
    const slug = assertValidCmsSlug(input.slug, { checkReserved: false });
    const existing = await this.db.cmsPostCategory.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException({
        code: 'CMS_CATEGORY_SLUG_TAKEN',
        message: `Blog category slug "${slug}" already exists.`,
      });
    }
    const created = await this.db.cmsPostCategory.create({
      data: {
        slug,
        nameEn: input.nameEn.trim(),
        nameBn: input.nameBn?.trim() || null,
        descriptionEn: input.descriptionEn?.trim() || null,
        descriptionBn: input.descriptionBn?.trim() || null,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.post_category_created',
      module: 'cms',
      recordId: created.id,
      reason: `Created blog category "${created.nameEn}" (${created.slug})`,
      oldValue: null,
      newValue: created,
    });
    return {
      id: created.id,
      slug: created.slug,
      nameEn: created.nameEn,
      nameBn: created.nameBn ?? null,
      descriptionEn: created.descriptionEn ?? null,
      descriptionBn: created.descriptionBn ?? null,
      sortOrder: created.sortOrder,
      postCount: 0,
    };
  }

  async updatePostCategory(
    id: string,
    input: Partial<{
      slug: string;
      nameEn: string;
      nameBn: string | null;
      descriptionEn: string | null;
      descriptionBn: string | null;
      sortOrder: number;
    }>,
    actor: PlatformActorContext,
  ): Promise<CmsPostCategoryDto> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsPostCategory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Blog category "${id}" not found.`);
    }
    const slug =
      input.slug !== undefined ? assertValidCmsSlug(input.slug, { checkReserved: false }) : undefined;
    if (slug && slug !== existing.slug) {
      const collision = await this.db.cmsPostCategory.findUnique({ where: { slug } });
      if (collision && collision.id !== id) {
        throw new ConflictException({
          code: 'CMS_CATEGORY_SLUG_TAKEN',
          message: `Blog category slug "${slug}" already exists.`,
        });
      }
    }
    const updated = await this.db.cmsPostCategory.update({
      where: { id },
      data: {
        ...(slug !== undefined ? { slug } : {}),
        ...(input.nameEn !== undefined ? { nameEn: input.nameEn.trim() } : {}),
        ...(input.nameBn !== undefined ? { nameBn: input.nameBn?.trim() || null } : {}),
        ...(input.descriptionEn !== undefined
          ? { descriptionEn: input.descriptionEn?.trim() || null }
          : {}),
        ...(input.descriptionBn !== undefined
          ? { descriptionBn: input.descriptionBn?.trim() || null }
          : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
      include: {
        _count: { select: { posts: { where: { deletedAt: null } } } },
      },
    });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.post_category_updated',
      module: 'cms',
      recordId: id,
      oldValue: existing,
      newValue: updated,
    });
    return {
      id: updated.id,
      slug: updated.slug,
      nameEn: updated.nameEn,
      nameBn: updated.nameBn ?? null,
      descriptionEn: updated.descriptionEn ?? null,
      descriptionBn: updated.descriptionBn ?? null,
      sortOrder: updated.sortOrder,
      postCount: updated._count?.posts ?? 0,
    };
  }

  async deletePostCategory(id: string, actor: PlatformActorContext): Promise<{ id: string; deleted: true }> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsPostCategory.findUnique({
      where: { id },
      include: { _count: { select: { posts: true } } },
    });
    if (!existing) {
      throw new NotFoundException(`Blog category "${id}" not found.`);
    }
    if ((existing._count?.posts ?? 0) > 0) {
      throw new BadRequestException({
        code: 'CMS_CATEGORY_IN_USE',
        message: `Cannot delete category "${existing.nameEn}" because ${existing._count.posts} post(s) reference it. Reassign those posts first.`,
      });
    }
    await this.db.cmsPostCategory.delete({ where: { id } });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.post_category_deleted',
      module: 'cms',
      recordId: id,
      reason: `Deleted blog category "${existing.nameEn}"`,
      oldValue: existing,
      newValue: null,
    });
    return { id, deleted: true };
  }

  async listAuthors(): Promise<CmsAuthorDto[]> {
    const authors = await this.db.cmsAuthor.findMany({
      include: {
        _count: {
          select: {
            posts: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }],
    });
    return authors.map((a) => ({
      id: a.id,
      slug: a.slug,
      displayName: a.displayName,
      displayNameBn: a.displayNameBn ?? null,
      roleTitle: a.roleTitle ?? null,
      roleTitleBn: a.roleTitleBn ?? null,
      bioEn: a.bioEn ?? null,
      bioBn: a.bioBn ?? null,
      avatarMediaId: a.avatarMediaId ?? null,
      avatarUrl: a.avatarMediaId ? `/api/v1/public/content/media/${a.avatarMediaId}/file` : null,
      isActive: a.isActive,
      postCount: a._count?.posts ?? 0,
    }));
  }

  async createAuthor(
    input: {
      slug: string;
      displayName: string;
      displayNameBn?: string | null;
      roleTitle?: string | null;
      roleTitleBn?: string | null;
      bioEn?: string | null;
      bioBn?: string | null;
      avatarMediaId?: string | null;
      isActive?: boolean;
    },
    actor: PlatformActorContext,
  ): Promise<CmsAuthorDto> {
    assertCmsPublishAllowed(actor);
    const slug = assertValidCmsSlug(input.slug, { checkReserved: false });
    const existing = await this.db.cmsAuthor.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException({
        code: 'CMS_AUTHOR_SLUG_TAKEN',
        message: `Blog author slug "${slug}" already exists.`,
      });
    }
    const created = await this.db.cmsAuthor.create({
      data: {
        slug,
        displayName: input.displayName.trim(),
        displayNameBn: input.displayNameBn?.trim() || null,
        roleTitle: input.roleTitle?.trim() || null,
        roleTitleBn: input.roleTitleBn?.trim() || null,
        bioEn: input.bioEn?.trim() || null,
        bioBn: input.bioBn?.trim() || null,
        avatarMediaId: input.avatarMediaId ?? null,
        isActive: input.isActive ?? true,
      },
    });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.author_created',
      module: 'cms',
      recordId: created.id,
      reason: `Created blog author "${created.displayName}" (${created.slug})`,
      oldValue: null,
      newValue: created,
    });
    return {
      id: created.id,
      slug: created.slug,
      displayName: created.displayName,
      displayNameBn: created.displayNameBn ?? null,
      roleTitle: created.roleTitle ?? null,
      roleTitleBn: created.roleTitleBn ?? null,
      bioEn: created.bioEn ?? null,
      bioBn: created.bioBn ?? null,
      avatarMediaId: created.avatarMediaId ?? null,
      avatarUrl: created.avatarMediaId
        ? `/api/v1/public/content/media/${created.avatarMediaId}/file`
        : null,
      isActive: created.isActive,
      postCount: 0,
    };
  }

  async updateAuthor(
    id: string,
    input: Partial<{
      slug: string;
      displayName: string;
      displayNameBn: string | null;
      roleTitle: string | null;
      roleTitleBn: string | null;
      bioEn: string | null;
      bioBn: string | null;
      avatarMediaId: string | null;
      isActive: boolean;
    }>,
    actor: PlatformActorContext,
  ): Promise<CmsAuthorDto> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsAuthor.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Blog author "${id}" not found.`);
    }
    const slug =
      input.slug !== undefined ? assertValidCmsSlug(input.slug, { checkReserved: false }) : undefined;
    if (slug && slug !== existing.slug) {
      const collision = await this.db.cmsAuthor.findUnique({ where: { slug } });
      if (collision && collision.id !== id) {
        throw new ConflictException({
          code: 'CMS_AUTHOR_SLUG_TAKEN',
          message: `Blog author slug "${slug}" already exists.`,
        });
      }
    }
    const updated = await this.db.cmsAuthor.update({
      where: { id },
      data: {
        ...(slug !== undefined ? { slug } : {}),
        ...(input.displayName !== undefined ? { displayName: input.displayName.trim() } : {}),
        ...(input.displayNameBn !== undefined
          ? { displayNameBn: input.displayNameBn?.trim() || null }
          : {}),
        ...(input.roleTitle !== undefined ? { roleTitle: input.roleTitle?.trim() || null } : {}),
        ...(input.roleTitleBn !== undefined ? { roleTitleBn: input.roleTitleBn?.trim() || null } : {}),
        ...(input.bioEn !== undefined ? { bioEn: input.bioEn?.trim() || null } : {}),
        ...(input.bioBn !== undefined ? { bioBn: input.bioBn?.trim() || null } : {}),
        ...(input.avatarMediaId !== undefined ? { avatarMediaId: input.avatarMediaId } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: {
        _count: { select: { posts: { where: { deletedAt: null } } } },
      },
    });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.author_updated',
      module: 'cms',
      recordId: id,
      oldValue: existing,
      newValue: updated,
    });
    return {
      id: updated.id,
      slug: updated.slug,
      displayName: updated.displayName,
      displayNameBn: updated.displayNameBn ?? null,
      roleTitle: updated.roleTitle ?? null,
      roleTitleBn: updated.roleTitleBn ?? null,
      bioEn: updated.bioEn ?? null,
      bioBn: updated.bioBn ?? null,
      avatarMediaId: updated.avatarMediaId ?? null,
      avatarUrl: updated.avatarMediaId
        ? `/api/v1/public/content/media/${updated.avatarMediaId}/file`
        : null,
      isActive: updated.isActive,
      postCount: updated._count?.posts ?? 0,
    };
  }

  async deleteAuthor(id: string, actor: PlatformActorContext): Promise<{ id: string; deleted: true }> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsAuthor.findUnique({
      where: { id },
      include: { _count: { select: { posts: true } } },
    });
    if (!existing) {
      throw new NotFoundException(`Blog author "${id}" not found.`);
    }
    if ((existing._count?.posts ?? 0) > 0) {
      throw new BadRequestException({
        code: 'CMS_AUTHOR_IN_USE',
        message: `Cannot delete author "${existing.displayName}" because ${existing._count.posts} post(s) reference this author.`,
      });
    }
    await this.db.cmsAuthor.delete({ where: { id } });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.author_deleted',
      module: 'cms',
      recordId: id,
      reason: `Deleted blog author "${existing.displayName}"`,
      oldValue: existing,
      newValue: null,
    });
    return { id, deleted: true };
  }

  // =========================================================================
  // Changelog, Careers, Menus & Site Settings (Workflow + Audit)
  // =========================================================================

  async listChangelog(filters?: {
    tag?: CmsChangelogEntryDto['tag'] | 'all';
    visibility?: 'all' | 'published' | 'hidden' | 'trashed';
    search?: string;
    includeTrashed?: boolean;
  }): Promise<CmsChangelogEntryDto[]> {
    const where: Prisma.CmsChangelogEntryWhereInput = {};
    if (filters?.visibility === 'trashed') {
      where.deletedAt = { not: null };
    } else if (!filters?.includeTrashed) {
      where.deletedAt = null;
    }
    if (filters?.visibility === 'published') {
      where.isPublished = true;
      where.deletedAt = null;
    } else if (filters?.visibility === 'hidden') {
      where.isPublished = false;
      where.deletedAt = null;
    }
    if (filters?.tag && filters.tag !== 'all') {
      where.tag = filters.tag;
    }
    if (filters?.search?.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { slug: { contains: q, mode: 'insensitive' } },
        { versionLabel: { contains: q, mode: 'insensitive' } },
        { titleEn: { contains: q, mode: 'insensitive' } },
        { titleBn: { contains: q, mode: 'insensitive' } },
        { summaryEn: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await this.db.cmsChangelogEntry.findMany({
      where,
      orderBy: [{ releaseDate: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((c) => this.mapChangelogDto(c));
  }

  async getChangelogEntry(entryId: string): Promise<CmsChangelogEntryDto> {
    const existing = await this.db.cmsChangelogEntry.findUnique({ where: { id: entryId } });
    if (!existing) {
      throw new NotFoundException(`Changelog entry "${entryId}" not found.`);
    }
    return this.mapChangelogDto(existing);
  }

  private deriveChangelogSummary(summary?: string | null, html?: string | null): string {
    const cleaned = (summary ?? '').trim();
    if (cleaned) return cleaned;
    if (!html) return '';
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 400);
  }

  async createChangelogDraft(
    input: {
      slug: string;
      versionLabel?: string;
      releaseDate: string;
      tag: 'new' | 'improved' | 'fixed' | 'security';
      moduleRefs?: string | null;
      titleEn: string;
      summaryEn?: string;
      bodyHtmlEn?: string;
      bodyJsonEn?: Record<string, unknown>;
      highlightsEn?: string[];
      titleBn?: string | null;
      summaryBn?: string | null;
      bodyHtmlBn?: string | null;
      bodyJsonBn?: Record<string, unknown> | null;
      highlightsBn?: string[];
      isBnTranslated?: boolean;
      isPublished?: boolean;
    },
    actor: PlatformActorContext,
  ): Promise<CmsChangelogEntryDto> {
    assertCmsEditAllowed(actor);
    const slug = assertValidCmsSlug(input.slug, { checkReserved: false });
    const existingSlug = await this.db.cmsChangelogEntry.findUnique({ where: { slug } });
    if (existingSlug) {
      throw new ConflictException({
        code: 'CMS_CHANGELOG_SLUG_TAKEN',
        message: `A changelog entry with slug "${slug}" already exists.`,
      });
    }
    if (input.isPublished) {
      assertCmsPublishAllowed(actor);
    }

    const cleanHtmlEn = input.bodyHtmlEn ? sanitizeCmsRichTextHtml(input.bodyHtmlEn) : '';
    const cleanHtmlBn = input.bodyHtmlBn ? sanitizeCmsRichTextHtml(input.bodyHtmlBn) : null;
    const summaryEn = this.deriveChangelogSummary(input.summaryEn, cleanHtmlEn);
    const summaryBn = input.summaryBn?.trim()
      ? input.summaryBn.trim()
      : cleanHtmlBn
        ? this.deriveChangelogSummary(null, cleanHtmlBn)
        : null;
    const publishNow = Boolean(input.isPublished);

    const created = await this.db.cmsChangelogEntry.create({
      data: {
        slug,
        versionLabel: (input.versionLabel ?? '').trim(),
        releaseDate: new Date(input.releaseDate),
        tag: input.tag,
        moduleRefs: input.moduleRefs?.trim() || null,
        titleEn: input.titleEn.trim(),
        summaryEn,
        bodyHtmlEn: cleanHtmlEn,
        bodyJsonEn: (input.bodyJsonEn ?? {}) as Prisma.InputJsonValue,
        highlightsEn: input.highlightsEn ?? [],
        titleBn: input.titleBn?.trim() || null,
        summaryBn,
        bodyHtmlBn: cleanHtmlBn,
        bodyJsonBn: input.bodyJsonBn ? (input.bodyJsonBn as Prisma.InputJsonValue) : undefined,
        highlightsBn: input.highlightsBn ?? [],
        isBnTranslated: Boolean(input.isBnTranslated && input.titleBn?.trim()),
        isPublished: publishNow,
        publishedAt: publishNow ? new Date() : null,
        authorId: actor.id ?? null,
      },
    });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.changelog_created',
      module: 'cms',
      recordId: created.id,
      oldValue: null,
      newValue: {
        slug: created.slug,
        versionLabel: created.versionLabel,
        tag: created.tag,
        isPublished: created.isPublished,
      },
    });
    return this.mapChangelogDto(created);
  }

  async updateChangelogDraft(
    entryId: string,
    input: Partial<{
      slug: string;
      versionLabel: string;
      releaseDate: string;
      tag: 'new' | 'improved' | 'fixed' | 'security';
      moduleRefs: string | null;
      titleEn: string;
      summaryEn: string;
      bodyHtmlEn: string;
      bodyJsonEn: Record<string, unknown>;
      highlightsEn: string[];
      titleBn: string | null;
      summaryBn: string | null;
      bodyHtmlBn: string | null;
      bodyJsonBn: Record<string, unknown> | null;
      highlightsBn: string[];
      isBnTranslated: boolean;
      isPublished: boolean;
    }>,
    actor: PlatformActorContext,
  ): Promise<CmsChangelogEntryDto> {
    assertCmsEditAllowed(actor);
    const existing = await this.db.cmsChangelogEntry.findUnique({ where: { id: entryId } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Changelog entry "${entryId}" not found.`);
    }
    if (input.isPublished !== undefined && input.isPublished !== existing.isPublished) {
      assertCmsPublishAllowed(actor);
    }

    const slug =
      input.slug !== undefined ? assertValidCmsSlug(input.slug, { checkReserved: false }) : undefined;
    if (slug && slug !== existing.slug) {
      const collision = await this.db.cmsChangelogEntry.findUnique({ where: { slug } });
      if (collision && collision.id !== entryId) {
        throw new ConflictException({
          code: 'CMS_CHANGELOG_SLUG_TAKEN',
          message: `A changelog entry with slug "${slug}" already exists.`,
        });
      }
    }

    const cleanHtmlEn =
      input.bodyHtmlEn !== undefined ? sanitizeCmsRichTextHtml(input.bodyHtmlEn) : undefined;
    const cleanHtmlBn =
      input.bodyHtmlBn !== undefined
        ? input.bodyHtmlBn
          ? sanitizeCmsRichTextHtml(input.bodyHtmlBn)
          : null
        : undefined;
    const summaryEn =
      input.summaryEn !== undefined
        ? this.deriveChangelogSummary(input.summaryEn, cleanHtmlEn ?? existing.bodyHtmlEn)
        : cleanHtmlEn !== undefined && !existing.summaryEn
          ? this.deriveChangelogSummary(null, cleanHtmlEn)
          : undefined;

    const beforeState = {
      slug: existing.slug,
      tag: existing.tag,
      titleEn: existing.titleEn,
      releaseDate: existing.releaseDate.toISOString().slice(0, 10),
      isPublished: existing.isPublished,
    };

    const updated = await this.db.cmsChangelogEntry.update({
      where: { id: entryId },
      data: {
        ...(slug !== undefined ? { slug } : {}),
        ...(input.versionLabel !== undefined ? { versionLabel: input.versionLabel.trim() } : {}),
        ...(input.releaseDate !== undefined ? { releaseDate: new Date(input.releaseDate) } : {}),
        ...(input.tag !== undefined ? { tag: input.tag } : {}),
        ...(input.moduleRefs !== undefined ? { moduleRefs: input.moduleRefs?.trim() || null } : {}),
        ...(input.titleEn !== undefined ? { titleEn: input.titleEn.trim() } : {}),
        ...(summaryEn !== undefined ? { summaryEn } : {}),
        ...(cleanHtmlEn !== undefined ? { bodyHtmlEn: cleanHtmlEn } : {}),
        ...(input.bodyJsonEn !== undefined
          ? { bodyJsonEn: input.bodyJsonEn as Prisma.InputJsonValue }
          : {}),
        ...(input.highlightsEn !== undefined ? { highlightsEn: input.highlightsEn } : {}),
        ...(input.titleBn !== undefined ? { titleBn: input.titleBn?.trim() || null } : {}),
        ...(input.summaryBn !== undefined ? { summaryBn: input.summaryBn?.trim() || null } : {}),
        ...(cleanHtmlBn !== undefined ? { bodyHtmlBn: cleanHtmlBn } : {}),
        ...(input.bodyJsonBn !== undefined
          ? {
            bodyJsonBn: input.bodyJsonBn
              ? (input.bodyJsonBn as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          }
          : {}),
        ...(input.highlightsBn !== undefined ? { highlightsBn: input.highlightsBn } : {}),
        ...(input.isBnTranslated !== undefined ? { isBnTranslated: input.isBnTranslated } : {}),
        ...(input.isPublished !== undefined
          ? {
            isPublished: input.isPublished,
            publishedAt: input.isPublished ? existing.publishedAt ?? new Date() : existing.publishedAt,
            scheduledAt: null,
            scheduledTimezone: null,
            scheduledById: null,
          }
          : {}),
      },
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.changelog_updated',
      module: 'cms',
      recordId: entryId,
      oldValue: beforeState,
      newValue: {
        slug: updated.slug,
        tag: updated.tag,
        titleEn: updated.titleEn,
        releaseDate: updated.releaseDate.toISOString().slice(0, 10),
        isPublished: updated.isPublished,
      },
    });
    return this.mapChangelogDto(updated);
  }

  async setChangelogPublishState(
    entryId: string,
    publish: boolean,
    actor: PlatformActorContext,
  ): Promise<CmsChangelogEntryDto> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsChangelogEntry.findUnique({ where: { id: entryId } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Changelog entry "${entryId}" not found.`);
    }
    const beforeState = {
      isPublished: existing.isPublished,
      scheduledAt: existing.scheduledAt?.toISOString() ?? null,
      publishedAt: existing.publishedAt?.toISOString() ?? null,
    };
    const updated = await this.db.cmsChangelogEntry.update({
      where: { id: entryId },
      data: {
        isPublished: publish,
        publishedAt: publish ? existing.publishedAt ?? new Date() : existing.publishedAt,
        scheduledAt: null,
        scheduledTimezone: null,
        scheduledById: null,
      },
    });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: publish ? 'cms.changelog_published' : 'cms.changelog_unpublished',
      module: 'cms',
      recordId: entryId,
      oldValue: beforeState,
      newValue: {
        isPublished: updated.isPublished,
        scheduledAt: updated.scheduledAt?.toISOString() ?? null,
        publishedAt: updated.publishedAt?.toISOString() ?? null,
      },
    });
    this.triggerRevalidate({ scopes: ['cms-changelog'] });
    return this.mapChangelogDto(updated);
  }

  async scheduleChangelogPublish(
    entryId: string,
    input: { scheduledAt: string; timezone?: string },
    actor: PlatformActorContext,
    now = new Date(),
  ): Promise<CmsChangelogEntryDto> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsChangelogEntry.findUnique({ where: { id: entryId } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Changelog entry "${entryId}" not found.`);
    }
    const { scheduledAtUtc, timeZone } = parseScheduledDateInTimezone(
      input.scheduledAt,
      input.timezone?.trim() || actor.timezone || 'UTC',
    );
    if (scheduledAtUtc.getTime() <= now.getTime()) {
      throw new BadRequestException({
        code: 'CMS_SCHEDULE_IN_PAST',
        message: 'Scheduled publication time must be in the future.',
      });
    }
    const beforeState = {
      isPublished: existing.isPublished,
      scheduledAt: existing.scheduledAt?.toISOString() ?? null,
      scheduledTimezone: existing.scheduledTimezone,
    };
    const updated = await this.db.cmsChangelogEntry.update({
      where: { id: entryId },
      data: {
        isPublished: false,
        scheduledAt: scheduledAtUtc,
        scheduledTimezone: timeZone,
        scheduledById: actor.id ?? null,
      },
    });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.changelog_scheduled',
      module: 'cms',
      recordId: entryId,
      oldValue: beforeState,
      newValue: {
        isPublished: updated.isPublished,
        scheduledAt: updated.scheduledAt?.toISOString() ?? null,
        scheduledTimezone: updated.scheduledTimezone,
      },
    });
    return this.mapChangelogDto(updated);
  }

  async trashChangelog(entryId: string, actor: PlatformActorContext): Promise<CmsChangelogEntryDto> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsChangelogEntry.findUnique({ where: { id: entryId } });
    if (!existing) {
      throw new NotFoundException(`Changelog entry "${entryId}" not found.`);
    }
    const beforeState = { isPublished: existing.isPublished, deletedAt: existing.deletedAt };
    const updated = await this.db.cmsChangelogEntry.update({
      where: { id: entryId },
      data: { isPublished: false, deletedAt: new Date(), scheduledAt: null },
    });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.changelog_trashed',
      module: 'cms',
      recordId: entryId,
      oldValue: beforeState,
      newValue: { isPublished: updated.isPublished, deletedAt: updated.deletedAt?.toISOString() ?? null },
    });
    return this.mapChangelogDto(updated);
  }

  async restoreChangelog(entryId: string, actor: PlatformActorContext): Promise<CmsChangelogEntryDto> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsChangelogEntry.findUnique({ where: { id: entryId } });
    if (!existing || !existing.deletedAt) {
      throw new BadRequestException('Changelog entry not found in trash.');
    }
    const beforeState = { isPublished: existing.isPublished, deletedAt: existing.deletedAt };
    const updated = await this.db.cmsChangelogEntry.update({
      where: { id: entryId },
      data: { isPublished: false, deletedAt: null },
    });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.changelog_restored',
      module: 'cms',
      recordId: entryId,
      oldValue: beforeState,
      newValue: { isPublished: updated.isPublished, deletedAt: null },
    });
    return this.mapChangelogDto(updated);
  }

  async permanentlyDeleteChangelog(
    entryId: string,
    actor: PlatformActorContext,
  ): Promise<{ id: string; slug: string; deleted: true }> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsChangelogEntry.findUnique({ where: { id: entryId } });
    if (!existing) {
      throw new NotFoundException(`Changelog entry "${entryId}" not found.`);
    }
    if (!existing.deletedAt) {
      throw new BadRequestException('Move changelog entry to Trash before permanent deletion.');
    }
    await this.db.cmsChangelogEntry.delete({ where: { id: entryId } });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.changelog_permanently_deleted',
      module: 'cms',
      recordId: entryId,
      reason: `Permanently deleted changelog entry "${existing.titleEn}" (${existing.slug})`,
      oldValue: { slug: existing.slug, titleEn: existing.titleEn },
      newValue: null,
    });
    return { id: entryId, slug: existing.slug, deleted: true };
  }

  async listCareers(filters?: {
    status?: CmsCareerDto['status'] | 'all';
    department?: string;
    search?: string;
    includeTrashed?: boolean;
  }): Promise<CmsCareerDto[]> {
    const where: Prisma.CmsCareerWhereInput = {};
    if (filters?.status && filters.status !== 'all') {
      where.status = filters.status;
      where.deletedAt = null;
    } else if (!filters?.includeTrashed) {
      where.deletedAt = null;
    }
    if (filters?.department && filters.department !== 'all') {
      where.department = { equals: filters.department.trim(), mode: 'insensitive' };
    }
    if (filters?.search?.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { slug: { contains: q, mode: 'insensitive' } },
        { titleEn: { contains: q, mode: 'insensitive' } },
        { titleBn: { contains: q, mode: 'insensitive' } },
        { locationText: { contains: q, mode: 'insensitive' } },
        { department: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await this.db.cmsCareer.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
    });
    return rows.map((c) => this.mapCareerDto(c));
  }

  async getCareerById(careerId: string): Promise<CmsCareerDto> {
    const existing = await this.db.cmsCareer.findUnique({ where: { id: careerId } });
    if (!existing) {
      throw new NotFoundException(`Career "${careerId}" not found.`);
    }
    return this.mapCareerDto(existing);
  }

  private normalizeCareerApplyTarget(
    applyEmail?: string | null,
    applyUrl?: string | null,
  ): { applyEmail: string | null; applyUrl: string | null } {
    const email = applyEmail?.trim() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException({
        code: 'CMS_INVALID_APPLY_EMAIL',
        message: `Invalid application email "${email}".`,
      });
    }
    const url = applyUrl?.trim() || null;
    if (url && !isSafeCmsLinkUrl(url)) {
      throw new BadRequestException({
        code: 'CMS_INVALID_APPLY_URL',
        message: `Unsafe application URL "${url}".`,
      });
    }
    return { applyEmail: email, applyUrl: url };
  }

  async createCareerDraft(
    input: {
      slug: string;
      department?: string;
      locationType: string;
      locationText: string;
      employmentType: string;
      titleEn: string;
      summaryEn?: string;
      descriptionHtmlEn: string;
      descriptionJsonEn?: Record<string, unknown>;
      titleBn?: string | null;
      summaryBn?: string | null;
      descriptionHtmlBn?: string | null;
      descriptionJsonBn?: Record<string, unknown> | null;
      isBnTranslated?: boolean;
      status?: 'draft' | 'open' | 'paused' | 'closed';
      applyEmail?: string | null;
      applyUrl?: string | null;
      closesAt?: string | null;
    },
    actor: PlatformActorContext,
  ): Promise<CmsCareerDto> {
    assertCmsEditAllowed(actor);
    const slug = assertValidCmsSlug(input.slug, { checkReserved: false });
    const existingSlug = await this.db.cmsCareer.findUnique({ where: { slug } });
    if (existingSlug) {
      throw new ConflictException({
        code: 'CMS_CAREER_SLUG_TAKEN',
        message: `A job listing with slug "${slug}" already exists.`,
      });
    }

    const desiredStatus = input.status ?? 'draft';
    if (desiredStatus !== 'draft') {
      assertCmsPublishAllowed(actor);
    }

    const { applyEmail, applyUrl } = this.normalizeCareerApplyTarget(
      input.applyEmail,
      input.applyUrl,
    );
    const cleanEn = sanitizeCmsRichTextHtml(input.descriptionHtmlEn);
    const cleanBn = input.descriptionHtmlBn ? sanitizeCmsRichTextHtml(input.descriptionHtmlBn) : null;
    const summaryEn = this.deriveChangelogSummary(input.summaryEn, cleanEn);
    const summaryBn = input.summaryBn?.trim()
      ? input.summaryBn.trim()
      : cleanBn
        ? this.deriveChangelogSummary(null, cleanBn)
        : null;

    const created = await this.db.cmsCareer.create({
      data: {
        slug,
        status: desiredStatus,
        department: input.department?.trim() || 'General',
        locationType: input.locationType.trim(),
        locationText: input.locationText.trim(),
        employmentType: input.employmentType.trim(),
        titleEn: input.titleEn.trim(),
        summaryEn,
        descriptionHtmlEn: cleanEn,
        descriptionJsonEn: (input.descriptionJsonEn ?? {}) as Prisma.InputJsonValue,
        titleBn: input.titleBn?.trim() || null,
        summaryBn,
        descriptionHtmlBn: cleanBn,
        descriptionJsonBn: input.descriptionJsonBn
          ? (input.descriptionJsonBn as Prisma.InputJsonValue)
          : undefined,
        isBnTranslated: Boolean(input.isBnTranslated && input.titleBn && cleanBn),
        applyEmail,
        applyUrl,
        publishedAt: desiredStatus === 'open' ? new Date() : null,
        closesAt: input.closesAt ? new Date(input.closesAt) : null,
      },
    });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.career_created',
      module: 'cms',
      recordId: created.id,
      oldValue: null,
      newValue: { slug: created.slug, status: created.status, titleEn: created.titleEn },
    });
    return this.mapCareerDto(created);
  }

  async updateCareerDraft(
    careerId: string,
    input: Partial<{
      slug: string;
      department: string;
      locationType: string;
      locationText: string;
      employmentType: string;
      titleEn: string;
      summaryEn: string;
      descriptionHtmlEn: string;
      descriptionJsonEn: Record<string, unknown>;
      titleBn: string | null;
      summaryBn: string | null;
      descriptionHtmlBn: string | null;
      descriptionJsonBn: Record<string, unknown> | null;
      isBnTranslated: boolean;
      status: 'draft' | 'open' | 'paused' | 'closed';
      applyEmail: string | null;
      applyUrl: string | null;
      closesAt: string | null;
    }>,
    actor: PlatformActorContext,
  ): Promise<CmsCareerDto> {
    assertCmsEditAllowed(actor);
    const existing = await this.db.cmsCareer.findUnique({ where: { id: careerId } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Career "${careerId}" not found.`);
    }
    if (input.status !== undefined && input.status !== existing.status && input.status !== 'draft') {
      assertCmsPublishAllowed(actor);
    }

    const slug =
      input.slug !== undefined ? assertValidCmsSlug(input.slug, { checkReserved: false }) : undefined;
    if (slug && slug !== existing.slug) {
      const collision = await this.db.cmsCareer.findUnique({ where: { slug } });
      if (collision && collision.id !== careerId) {
        throw new ConflictException({
          code: 'CMS_CAREER_SLUG_TAKEN',
          message: `A job listing with slug "${slug}" already exists.`,
        });
      }
    }

    const { applyEmail, applyUrl } = this.normalizeCareerApplyTarget(
      input.applyEmail !== undefined ? input.applyEmail : existing.applyEmail,
      input.applyUrl !== undefined ? input.applyUrl : existing.applyUrl,
    );

    const cleanEn =
      input.descriptionHtmlEn !== undefined
        ? sanitizeCmsRichTextHtml(input.descriptionHtmlEn)
        : undefined;
    const cleanBn =
      input.descriptionHtmlBn !== undefined
        ? input.descriptionHtmlBn
          ? sanitizeCmsRichTextHtml(input.descriptionHtmlBn)
          : null
        : undefined;
    const summaryEn =
      input.summaryEn !== undefined
        ? this.deriveChangelogSummary(input.summaryEn, cleanEn ?? existing.descriptionHtmlEn)
        : cleanEn !== undefined && !existing.summaryEn
          ? this.deriveChangelogSummary(null, cleanEn)
          : undefined;

    const beforeState = {
      slug: existing.slug,
      status: existing.status,
      titleEn: existing.titleEn,
    };

    const updated = await this.db.cmsCareer.update({
      where: { id: careerId },
      data: {
        ...(slug !== undefined ? { slug } : {}),
        ...(input.department !== undefined
          ? { department: input.department.trim() || 'General' }
          : {}),
        ...(input.locationType !== undefined ? { locationType: input.locationType.trim() } : {}),
        ...(input.locationText !== undefined ? { locationText: input.locationText.trim() } : {}),
        ...(input.employmentType !== undefined
          ? { employmentType: input.employmentType.trim() }
          : {}),
        ...(input.titleEn !== undefined ? { titleEn: input.titleEn.trim() } : {}),
        ...(summaryEn !== undefined ? { summaryEn } : {}),
        ...(cleanEn !== undefined ? { descriptionHtmlEn: cleanEn } : {}),
        ...(input.descriptionJsonEn !== undefined
          ? { descriptionJsonEn: input.descriptionJsonEn as Prisma.InputJsonValue }
          : {}),
        ...(input.titleBn !== undefined ? { titleBn: input.titleBn?.trim() || null } : {}),
        ...(input.summaryBn !== undefined ? { summaryBn: input.summaryBn?.trim() || null } : {}),
        ...(cleanBn !== undefined ? { descriptionHtmlBn: cleanBn } : {}),
        ...(input.descriptionJsonBn !== undefined
          ? {
            descriptionJsonBn: input.descriptionJsonBn
              ? (input.descriptionJsonBn as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          }
          : {}),
        ...(input.isBnTranslated !== undefined ? { isBnTranslated: input.isBnTranslated } : {}),
        ...(input.status !== undefined
          ? {
            status: input.status,
            publishedAt:
              input.status === 'open'
                ? existing.publishedAt ?? new Date()
                : existing.publishedAt,
          }
          : {}),
        ...(input.applyEmail !== undefined ? { applyEmail } : {}),
        ...(input.applyUrl !== undefined ? { applyUrl } : {}),
        ...(input.closesAt !== undefined
          ? { closesAt: input.closesAt ? new Date(input.closesAt) : null }
          : {}),
      },
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.career_updated',
      module: 'cms',
      recordId: careerId,
      oldValue: beforeState,
      newValue: {
        slug: updated.slug,
        status: updated.status,
        titleEn: updated.titleEn,
      },
    });
    return this.mapCareerDto(updated);
  }

  async trashCareer(careerId: string, actor: PlatformActorContext): Promise<CmsCareerDto> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsCareer.findUnique({ where: { id: careerId } });
    if (!existing) {
      throw new NotFoundException(`Career "${careerId}" not found.`);
    }
    const updated = await this.db.cmsCareer.update({
      where: { id: careerId },
      data: { deletedAt: new Date() },
    });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.career_trashed',
      module: 'cms',
      recordId: careerId,
      oldValue: { slug: existing.slug, status: existing.status },
      newValue: { deletedAt: updated.deletedAt?.toISOString() ?? null },
    });
    return this.mapCareerDto(updated);
  }

  async restoreCareer(careerId: string, actor: PlatformActorContext): Promise<CmsCareerDto> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsCareer.findUnique({ where: { id: careerId } });
    if (!existing || !existing.deletedAt) {
      throw new BadRequestException('Career listing not found in trash.');
    }
    const updated = await this.db.cmsCareer.update({
      where: { id: careerId },
      data: { deletedAt: null, status: 'draft' },
    });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.career_restored',
      module: 'cms',
      recordId: careerId,
      oldValue: { deletedAt: existing.deletedAt.toISOString() },
      newValue: { deletedAt: null, status: updated.status },
    });
    return this.mapCareerDto(updated);
  }

  async permanentlyDeleteCareer(
    careerId: string,
    actor: PlatformActorContext,
  ): Promise<{ id: string; slug: string; deleted: true }> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsCareer.findUnique({ where: { id: careerId } });
    if (!existing) {
      throw new NotFoundException(`Career "${careerId}" not found.`);
    }
    if (!existing.deletedAt) {
      throw new BadRequestException('Move career listing to Trash before permanent deletion.');
    }
    await this.db.cmsCareer.delete({ where: { id: careerId } });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.career_permanently_deleted',
      module: 'cms',
      recordId: careerId,
      reason: `Permanently deleted career listing "${existing.titleEn}" (${existing.slug})`,
      oldValue: { slug: existing.slug, titleEn: existing.titleEn },
      newValue: null,
    });
    return { id: careerId, slug: existing.slug, deleted: true };
  }

  async setCareerStatus(
    careerId: string,
    status: 'draft' | 'open' | 'paused' | 'closed',
    actor: PlatformActorContext,
  ): Promise<CmsCareerDto> {
    if (status !== 'draft') {
      assertCmsPublishAllowed(actor);
    } else {
      assertCmsEditAllowed(actor);
    }
    const existing = await this.db.cmsCareer.findUnique({ where: { id: careerId } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Career "${careerId}" not found.`);
    }
    const beforeState = { status: existing.status, publishedAt: existing.publishedAt };
    const updated = await this.db.cmsCareer.update({
      where: { id: careerId },
      data: {
        status,
        publishedAt: status === 'open' ? existing.publishedAt ?? new Date() : existing.publishedAt,
      },
    });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: `cms.career_status_${status}`,
      module: 'cms',
      recordId: careerId,
      oldValue: beforeState,
      newValue: { status: updated.status, publishedAt: updated.publishedAt },
    });
    this.triggerRevalidate({ scopes: ['cms-careers'], slugs: [updated.slug] });
    return this.mapCareerDto(updated);
  }

  async upsertSiteSetting(
    input: {
      key: string;
      valueJson: Record<string, unknown>;
      description?: string | null;
      isPublic?: boolean;
    },
    actor: PlatformActorContext,
  ): Promise<CmsSiteSettingDto> {
    assertCmsPublishAllowed(actor);
    const key = input.key.trim();
    const existing = await this.db.cmsSiteSetting.findUnique({ where: { key } });
    const beforeState = existing
      ? { valueJson: existing.valueJson, isPublic: existing.isPublic, description: existing.description }
      : null;

    const saved = await this.db.cmsSiteSetting.upsert({
      where: { key },
      create: {
        key,
        valueJson: input.valueJson as Prisma.InputJsonValue,
        description: input.description ?? null,
        isPublic: input.isPublic ?? true,
        updatedById: actor.id ?? null,
        updatedByName: actor.email ?? 'Platform Staff',
      },
      update: {
        valueJson: input.valueJson as Prisma.InputJsonValue,
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
        updatedById: actor.id ?? null,
        updatedByName: actor.email ?? 'Platform Staff',
      },
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.site_setting_updated',
      module: 'cms',
      recordId: saved.id,
      oldValue: beforeState,
      newValue: { key: saved.key, valueJson: saved.valueJson, isPublic: saved.isPublic },
    });

    return {
      id: saved.id,
      key: saved.key,
      valueJson: saved.valueJson as Record<string, unknown>,
      description: saved.description,
      isPublic: saved.isPublic,
      updatedAt: saved.updatedAt.toISOString(),
    };
  }

  private getDefaultSiteSettingsBundle(): CmsSiteSettingsBundleDto {
    return {
      contact: {
        companyName: { en: 'CMSN-HR Platform', bn: 'সিএমএসএন-এইচআর প্ল্যাটফর্ম' },
        address: {
          en: 'House 24, Road 11, Banani, Dhaka 1213, Bangladesh',
          bn: 'বাড়ি ২৪, রোড ১১, বনানী, ঢাকা ১২১৩, বাংলাদেশ',
        },
        phone: '+880 1700-000000',
        salesEmail: 'sales@cmsnbd.com',
        supportEmail: 'support@cmsnbd.com',
      },
      socialLinks: {
        linkedin: 'https://www.linkedin.com',
        x: 'https://x.com',
        facebook: 'https://www.facebook.com',
        youtube: '',
        github: '',
      },
      announcementBar: {
        enabled: false,
        text: {
          en: 'Multi-country payroll packs updated for FY 2026–27 compliance.',
          bn: '২০২৬–২৭ অর্থবছরের কমপ্লায়েন্সের জন্য মাল্টি-কান্ট্রি পেরোল প্যাক আপডেট করা হয়েছে।',
        },
        linkLabel: { en: 'Read Release Notes', bn: 'আপডেট দেখুন' },
        linkUrl: '/changelog',
        startsAt: null,
        endsAt: null,
        dismissible: true,
      },
      footer: {
        tagline: {
          en: 'Multi-country HR, deterministic payroll, and workforce attendance built for growing employers.',
          bn: 'ক্রমবর্ধমান প্রতিষ্ঠানের জন্য মাল্টি-কান্ট্রি এইচআর, নির্ভুল পেরোল এবং উপস্থিতি ব্যবস্থাপনা।',
        },
        copyrightText: {
          en: 'All rights reserved.',
          bn: 'সর্বস্বত্ব সংরক্ষিত।',
        },
      },
      cookieBanner: {
        title: {
          en: 'Your privacy & cookie preferences',
          bn: 'আপনার গোপনীয়তা ও কুকি পছন্দসমূহ',
        },
        body: {
          en: 'We use necessary cookies and storage to operate currency preferences and remember your privacy choice. Optional analytics and marketing scripts remain blocked unless you consent.',
          bn: 'কারেন্সি পছন্দ সংরক্ষণ ও আপনার গোপনীয়তা সিদ্ধান্ত মনে রাখতে আমরা প্রয়োজনীয় কুকি ব্যবহার করি। আপনার সম্মতি ছাড়া ঐচ্ছিক বিশ্লেষণ স্ক্রিপ্ট বন্ধ থাকে।',
        },
        policyLinkText: { en: 'Read Cookie Policy', bn: 'কুকি নীতি পড়ুন' },
        acceptAllLabel: { en: 'Accept all', bn: 'সব গ্রহণ করুন' },
        declineAllLabel: { en: 'Decline non-essential', bn: 'অপ্রয়োজনীয় প্রত্যাখ্যান করুন' },
        customizeLabel: { en: 'Cookie settings', bn: 'কুকি সেটিংস' },
      },
      seo: {
        defaultOgImageUrl: '',
        titleTemplate: '%s | CMSN-HR',
        defaultDescription: {
          en: 'Enterprise HR, deterministic multi-country payroll engine, biometric & GPS attendance, and compliance automation.',
          bn: 'এন্টারপ্রাইজ এইচআর, নির্ভুল মাল্টি-কান্ট্রি পেরোল ইঞ্জিন, এবং উপস্থিতি ব্যবস্থাপনা।',
        },
      },
      locale: {
        defaultLanguage: 'en',
        supportedLocales: ['en', 'bn'],
        fallbackLocale: 'en',
      },
    };
  }

  private mergeLocalizedString(
    raw: unknown,
    fallback: { en: string; bn: string },
  ): { en: string; bn: string } {
    if (!raw || typeof raw !== 'object') return { ...fallback };
    const rec = raw as { en?: unknown; bn?: unknown };
    return {
      en: typeof rec.en === 'string' ? rec.en : fallback.en,
      bn: typeof rec.bn === 'string' ? rec.bn : fallback.bn,
    };
  }

  async getStructuredSiteSettings(): Promise<CmsSiteSettingsBundleDto> {
    const defaults = this.getDefaultSiteSettingsBundle();
    const rows = this.db.cmsSiteSetting?.findMany
      ? await this.db.cmsSiteSetting.findMany()
      : [];
    const byKey = new Map<string, Record<string, unknown>>(
      rows.map((r) => [r.key, (r.valueJson ?? {}) as Record<string, unknown>]),
    );

    const contactRaw = byKey.get('site.contact') ?? {};
    const socialRaw = byKey.get('site.social') ?? {};
    const annRaw = byKey.get('site.announcement') ?? {};
    const footerRaw = byKey.get('site.footer') ?? {};
    const cookieRaw = byKey.get('site.cookie_banner') ?? {};
    const seoRaw = byKey.get('seo.defaults') ?? {};
    const localeRaw = byKey.get('locale.config') ?? {};

    const defaultLang =
      localeRaw.defaultLanguage === 'bn' || localeRaw.defaultLocale === 'bn'
        ? 'bn'
        : defaults.locale.defaultLanguage;

    return {
      contact: {
        companyName: this.mergeLocalizedString(contactRaw.companyName, defaults.contact.companyName),
        address: this.mergeLocalizedString(contactRaw.address, defaults.contact.address),
        phone: typeof contactRaw.phone === 'string' ? contactRaw.phone : defaults.contact.phone,
        salesEmail:
          typeof contactRaw.salesEmail === 'string'
            ? contactRaw.salesEmail
            : defaults.contact.salesEmail,
        supportEmail:
          typeof contactRaw.supportEmail === 'string'
            ? contactRaw.supportEmail
            : defaults.contact.supportEmail,
      },
      socialLinks: {
        linkedin:
          typeof socialRaw.linkedin === 'string' ? socialRaw.linkedin : defaults.socialLinks.linkedin,
        x: typeof socialRaw.x === 'string' ? socialRaw.x : defaults.socialLinks.x,
        facebook:
          typeof socialRaw.facebook === 'string' ? socialRaw.facebook : defaults.socialLinks.facebook,
        youtube:
          typeof socialRaw.youtube === 'string' ? socialRaw.youtube : defaults.socialLinks.youtube,
        github:
          typeof socialRaw.github === 'string' ? socialRaw.github : defaults.socialLinks.github,
      },
      announcementBar: {
        enabled:
          typeof annRaw.enabled === 'boolean' ? annRaw.enabled : defaults.announcementBar.enabled,
        text: this.mergeLocalizedString(annRaw.text, defaults.announcementBar.text),
        linkLabel: this.mergeLocalizedString(annRaw.linkLabel, defaults.announcementBar.linkLabel),
        linkUrl:
          typeof annRaw.linkUrl === 'string' ? annRaw.linkUrl : defaults.announcementBar.linkUrl,
        startsAt:
          typeof annRaw.startsAt === 'string' || annRaw.startsAt === null
            ? (annRaw.startsAt as string | null)
            : defaults.announcementBar.startsAt,
        endsAt:
          typeof annRaw.endsAt === 'string' || annRaw.endsAt === null
            ? (annRaw.endsAt as string | null)
            : defaults.announcementBar.endsAt,
        dismissible:
          typeof annRaw.dismissible === 'boolean'
            ? annRaw.dismissible
            : defaults.announcementBar.dismissible,
      },
      footer: {
        tagline: this.mergeLocalizedString(footerRaw.tagline, defaults.footer.tagline),
        copyrightText: this.mergeLocalizedString(
          footerRaw.copyrightText,
          defaults.footer.copyrightText,
        ),
      },
      cookieBanner: {
        title: this.mergeLocalizedString(cookieRaw.title, defaults.cookieBanner.title),
        body: this.mergeLocalizedString(cookieRaw.body, defaults.cookieBanner.body),
        policyLinkText: this.mergeLocalizedString(
          cookieRaw.policyLinkText,
          defaults.cookieBanner.policyLinkText,
        ),
        acceptAllLabel: this.mergeLocalizedString(
          cookieRaw.acceptAllLabel,
          defaults.cookieBanner.acceptAllLabel,
        ),
        declineAllLabel: this.mergeLocalizedString(
          cookieRaw.declineAllLabel,
          defaults.cookieBanner.declineAllLabel,
        ),
        customizeLabel: this.mergeLocalizedString(
          cookieRaw.customizeLabel,
          defaults.cookieBanner.customizeLabel,
        ),
      },
      seo: {
        defaultOgImageUrl:
          typeof seoRaw.defaultOgImageUrl === 'string'
            ? seoRaw.defaultOgImageUrl
            : defaults.seo.defaultOgImageUrl,
        titleTemplate:
          typeof seoRaw.titleTemplate === 'string'
            ? seoRaw.titleTemplate
            : defaults.seo.titleTemplate,
        defaultDescription: this.mergeLocalizedString(
          seoRaw.defaultDescription,
          defaults.seo.defaultDescription,
        ),
      },
      locale: {
        defaultLanguage: defaultLang,
        supportedLocales: ['en', 'bn'],
        fallbackLocale:
          localeRaw.fallbackLocale === 'bn' ? 'bn' : defaults.locale.fallbackLocale,
      },
    };
  }

  async updateStructuredSiteSettings(
    input: Partial<Record<keyof CmsSiteSettingsBundleDto, Record<string, unknown>>>,
    actor: PlatformActorContext,
  ): Promise<CmsSiteSettingsBundleDto> {
    assertCmsPublishAllowed(actor);
    const current = await this.getStructuredSiteSettings();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (input.contact) {
      const mergedContact = {
        companyName: this.mergeLocalizedString(input.contact.companyName, current.contact.companyName),
        address: this.mergeLocalizedString(input.contact.address, current.contact.address),
        phone:
          typeof input.contact.phone === 'string'
            ? input.contact.phone.trim()
            : current.contact.phone,
        salesEmail:
          typeof input.contact.salesEmail === 'string'
            ? input.contact.salesEmail.trim()
            : current.contact.salesEmail,
        supportEmail:
          typeof input.contact.supportEmail === 'string'
            ? input.contact.supportEmail.trim()
            : current.contact.supportEmail,
      };
      if (mergedContact.salesEmail && !emailRegex.test(mergedContact.salesEmail)) {
        throw new BadRequestException({
          code: 'CMS_INVALID_EMAIL',
          message: `Invalid sales email "${mergedContact.salesEmail}".`,
        });
      }
      if (mergedContact.supportEmail && !emailRegex.test(mergedContact.supportEmail)) {
        throw new BadRequestException({
          code: 'CMS_INVALID_EMAIL',
          message: `Invalid support email "${mergedContact.supportEmail}".`,
        });
      }
      await this.upsertSiteSetting(
        {
          key: 'site.contact',
          valueJson: mergedContact,
          description: 'Company contact details, sales email, and support email',
          isPublic: true,
        },
        actor,
      );
    }

    if (input.socialLinks) {
      const nextSocial: Record<string, string> = {};
      for (const k of ['linkedin', 'x', 'facebook', 'youtube', 'github'] as const) {
        const val =
          typeof input.socialLinks[k] === 'string'
            ? (input.socialLinks[k] as string).trim()
            : current.socialLinks[k] || '';
        if (val && !isSafeCmsLinkUrl(val)) {
          throw new BadRequestException({
            code: 'CMS_INVALID_URL',
            message: `Invalid ${k} URL "${val}".`,
          });
        }
        nextSocial[k] = val;
      }
      await this.upsertSiteSetting(
        {
          key: 'site.social',
          valueJson: nextSocial,
          description: 'Company social media profile URLs',
          isPublic: true,
        },
        actor,
      );
    }

    if (input.announcementBar) {
      const linkUrl =
        typeof input.announcementBar.linkUrl === 'string'
          ? input.announcementBar.linkUrl.trim()
          : current.announcementBar.linkUrl;
      if (linkUrl && !isSafeCmsLinkUrl(linkUrl)) {
        throw new BadRequestException({
          code: 'CMS_INVALID_URL',
          message: `Invalid announcement link URL "${linkUrl}".`,
        });
      }

      const rawStarts =
        input.announcementBar.startsAt !== undefined
          ? (input.announcementBar.startsAt as string | null)
          : current.announcementBar.startsAt;
      const rawEnds =
        input.announcementBar.endsAt !== undefined
          ? (input.announcementBar.endsAt as string | null)
          : current.announcementBar.endsAt;

      const startsIso = rawStarts && String(rawStarts).trim() ? new Date(String(rawStarts)).toISOString() : null;
      const endsIso = rawEnds && String(rawEnds).trim() ? new Date(String(rawEnds)).toISOString() : null;
      if (startsIso && endsIso && new Date(endsIso).getTime() <= new Date(startsIso).getTime()) {
        throw new BadRequestException({
          code: 'CMS_INVALID_ANNOUNCEMENT_WINDOW',
          message: 'Announcement bar end time must be after start time.',
        });
      }

      await this.upsertSiteSetting(
        {
          key: 'site.announcement',
          valueJson: {
            enabled:
              typeof input.announcementBar.enabled === 'boolean'
                ? input.announcementBar.enabled
                : current.announcementBar.enabled,
            text: this.mergeLocalizedString(input.announcementBar.text, current.announcementBar.text),
            linkLabel: this.mergeLocalizedString(
              input.announcementBar.linkLabel,
              current.announcementBar.linkLabel,
            ),
            linkUrl,
            startsAt: startsIso,
            endsAt: endsIso,
            dismissible:
              typeof input.announcementBar.dismissible === 'boolean'
                ? input.announcementBar.dismissible
                : current.announcementBar.dismissible,
          },
          description: 'Top website announcement bar with schedule window and dismissible option',
          isPublic: true,
        },
        actor,
      );
    }

    if (input.footer) {
      await this.upsertSiteSetting(
        {
          key: 'site.footer',
          valueJson: {
            tagline: this.mergeLocalizedString(input.footer.tagline, current.footer.tagline),
            copyrightText: this.mergeLocalizedString(
              input.footer.copyrightText,
              current.footer.copyrightText,
            ),
          },
          description: 'Footer brand tagline and localized copyright text',
          isPublic: true,
        },
        actor,
      );
    }

    if (input.cookieBanner) {
      await this.upsertSiteSetting(
        {
          key: 'site.cookie_banner',
          valueJson: {
            title: this.mergeLocalizedString(input.cookieBanner.title, current.cookieBanner.title),
            body: this.mergeLocalizedString(input.cookieBanner.body, current.cookieBanner.body),
            policyLinkText: this.mergeLocalizedString(
              input.cookieBanner.policyLinkText,
              current.cookieBanner.policyLinkText,
            ),
            acceptAllLabel: this.mergeLocalizedString(
              input.cookieBanner.acceptAllLabel,
              current.cookieBanner.acceptAllLabel,
            ),
            declineAllLabel: this.mergeLocalizedString(
              input.cookieBanner.declineAllLabel,
              current.cookieBanner.declineAllLabel,
            ),
            customizeLabel: this.mergeLocalizedString(
              input.cookieBanner.customizeLabel,
              current.cookieBanner.customizeLabel,
            ),
          },
          description: 'Cookie banner display wording per locale (consent logic remains in code)',
          isPublic: true,
        },
        actor,
      );
    }

    if (input.seo) {
      const ogImg =
        typeof input.seo.defaultOgImageUrl === 'string'
          ? input.seo.defaultOgImageUrl.trim()
          : current.seo.defaultOgImageUrl;
      if (ogImg && !isSafeCmsLinkUrl(ogImg)) {
        throw new BadRequestException({
          code: 'CMS_INVALID_URL',
          message: `Invalid default SEO image URL "${ogImg}".`,
        });
      }
      await this.upsertSiteSetting(
        {
          key: 'seo.defaults',
          valueJson: {
            defaultOgImageUrl: ogImg,
            titleTemplate:
              typeof input.seo.titleTemplate === 'string' && input.seo.titleTemplate.trim()
                ? input.seo.titleTemplate.trim()
                : current.seo.titleTemplate,
            defaultDescription: this.mergeLocalizedString(
              input.seo.defaultDescription,
              current.seo.defaultDescription,
            ),
          },
          description: 'Default website SEO image, title template, and description',
          isPublic: true,
        },
        actor,
      );
    }

    if (input.locale) {
      const nextDefault = assertValidCmsLocale(
        String(input.locale.defaultLanguage ?? input.locale.defaultLocale ?? current.locale.defaultLanguage),
      );
      await this.upsertSiteSetting(
        {
          key: 'locale.config',
          valueJson: {
            defaultLanguage: nextDefault,
            defaultLocale: nextDefault,
            supportedLocales: ['en', 'bn'],
            fallbackLocale: 'en',
          },
          description: 'Default website language and supported locales',
          isPublic: true,
        },
        actor,
      );
    }

    this.triggerRevalidate({ scopes: ['cms-settings'] });
    return this.getStructuredSiteSettings();
  }

  // =========================================================================
  // Scheduled Publisher Job Executor
  // =========================================================================

  /**
   * Executes due scheduled publications whose UTC `scheduled_at <= now`.
   * Intended to run via cron job and via admin trigger/tests.
   */
  async processDueScheduledPublications(now = new Date()): Promise<{
    pagesPublished: number;
    postsPublished: number;
    changelogPublished: number;
    skippedLegalPageIds: string[];
  }> {
    let pagesPublished = 0;
    let postsPublished = 0;
    let changelogPublished = 0;
    const skippedLegalPageIds: string[] = [];

    const duePages = await this.db.cmsPage.findMany({
      where: {
        deletedAt: null,
        scheduledAt: { lte: now },
        status: { in: ['scheduled', 'published'] },
      },
      include: { locales: true },
    });

    const publishedSlugs: string[] = [];
    const postSlugs: string[] = [];

    for (const page of duePages) {
      const targetVersions = await this.resolveVersionsToPublish(page, {});
      if (isLegalCmsPage(page.slug, page.requiresApproval)) {
        try {
          assertCmsLegalApprovalSatisfied({
            slug: page.slug,
            requiresApproval: page.requiresApproval,
            approvalStatus: page.approvalStatus,
            pendingApprovalVersionId: page.pendingApprovalVersionId,
            targetVersionIds: targetVersions.map((v) => v.id),
          });
        } catch {
          skippedLegalPageIds.push(page.id);
          continue;
        }
      }

      const beforeState = this.pickPageWorkflowSnapshot(page);
      const updated = await this.db.$transaction(async (tx) => {
        for (const ver of targetVersions) {
          await tx.cmsPageLocale.upsert({
            where: { pageId_locale: { pageId: page.id, locale: ver.locale } },
            create: {
              pageId: page.id,
              locale: ver.locale,
              isTranslated: ver.isTranslated,
              translationStatus: ver.isTranslated ? 'translated' : 'untranslated',
              currentDraftVersionId: ver.id,
              currentPublishedVersionId: ver.id,
            },
            update: {
              currentPublishedVersionId: ver.id,
            },
          });
        }

        const enTarget = targetVersions.find((v) => v.locale === 'en');
        const primaryId =
          enTarget?.id ?? page.currentPublishedVersionId ?? targetVersions[0]?.id ?? null;

        return tx.cmsPage.update({
          where: { id: page.id },
          data: {
            status: 'published',
            publishedAt: page.publishedAt ?? now,
            scheduledAt: null,
            scheduledTimezone: null,
            scheduledById: null,
            ...(primaryId ? { currentPublishedVersionId: primaryId } : {}),
          },
          include: { locales: true },
        });
      });

      await this.platformAudit.log({
        userId: page.scheduledById ?? null,
        action: 'cms.page_scheduled_published',
        module: 'cms',
        recordId: page.id,
        reason: `Scheduled publish executed at ${now.toISOString()} (staff tz: ${page.scheduledTimezone ?? 'UTC'})`,
        oldValue: beforeState,
        newValue: this.pickPageWorkflowSnapshot(updated),
      });
      pagesPublished++;
      publishedSlugs.push(page.slug);
    }

    const duePosts = await this.db.cmsPost.findMany({
      where: {
        deletedAt: null,
        status: 'scheduled',
        scheduledAt: { lte: now },
      },
    });

    for (const post of duePosts) {
      const beforeState = this.pickPostAuditSnapshot(post);
      const updated = await this.db.cmsPost.update({
        where: { id: post.id },
        data: {
          status: 'published',
          publishedAt: post.publishedAt ?? now,
          scheduledAt: null,
          scheduledTimezone: null,
          scheduledById: null,
        },
      });
      await this.platformAudit.log({
        userId: post.scheduledById ?? null,
        action: 'cms.post_scheduled_published',
        module: 'cms',
        recordId: post.id,
        reason: `Scheduled post publish executed at ${now.toISOString()} (staff tz: ${post.scheduledTimezone ?? 'UTC'})`,
        oldValue: beforeState,
        newValue: this.pickPostAuditSnapshot(updated),
      });
      postsPublished++;
      postSlugs.push(post.slug);
    }

    const dueChangelog = await this.db.cmsChangelogEntry.findMany({
      where: {
        deletedAt: null,
        isPublished: false,
        scheduledAt: { lte: now },
      },
    });

    for (const entry of dueChangelog) {
      const beforeState = {
        isPublished: entry.isPublished,
        scheduledAt: entry.scheduledAt?.toISOString() ?? null,
        scheduledTimezone: entry.scheduledTimezone,
      };
      const updated = await this.db.cmsChangelogEntry.update({
        where: { id: entry.id },
        data: {
          isPublished: true,
          publishedAt: entry.publishedAt ?? now,
          scheduledAt: null,
          scheduledTimezone: null,
          scheduledById: null,
        },
      });
      await this.platformAudit.log({
        userId: entry.scheduledById ?? null,
        action: 'cms.changelog_scheduled_published',
        module: 'cms',
        recordId: entry.id,
        reason: `Scheduled changelog publish executed at ${now.toISOString()}`,
        oldValue: beforeState,
        newValue: {
          isPublished: updated.isPublished,
          publishedAt: updated.publishedAt?.toISOString() ?? null,
          scheduledAt: null,
        },
      });
      changelogPublished++;
    }

    if (pagesPublished > 0 || postsPublished > 0 || changelogPublished > 0) {
      const scopes: TriggerCmsRevalidatePayload['scopes'] = [];
      if (pagesPublished > 0) scopes.push('cms-pages');
      if (postsPublished > 0) scopes.push('cms-posts');
      if (changelogPublished > 0) scopes.push('cms-changelog');
      this.triggerRevalidate({
        scopes,
        slugs: Array.from(new Set([...publishedSlugs, ...postSlugs])),
      });
    }

    return { pagesPublished, postsPublished, changelogPublished, skippedLegalPageIds };
  }

  // =========================================================================
  // Public Read API Queries (STRICTLY PUBLISHED CONTENT ONLY)
  // =========================================================================

  async resolvePublishedPage(slug: string, rawLocale = 'en'): Promise<CmsResolvedPageDto | null> {
    const locale = assertValidCmsLocale(rawLocale);
    const page = await this.db.cmsPage.findFirst({
      where: {
        slug: slug.trim().toLowerCase(),
        status: 'published',
        deletedAt: null,
      },
      include: {
        locales: true,
      },
    });

    if (!page) return null;

    const candidateVersionIds = Array.from(
      new Set(
        [
          page.currentPublishedVersionId,
          ...page.locales.map((l) => l.currentPublishedVersionId),
        ].filter((id): id is string => Boolean(id)),
      ),
    );

    if (candidateVersionIds.length === 0) {
      return null;
    }

    const versions = await this.db.cmsPageVersion.findMany({
      where: { id: { in: candidateVersionIds } },
    });

    const versionsById = new Map(versions.map((v) => [v.id, v]));
    return resolveLocalizedPageVersion({
      page,
      locales: page.locales,
      versionsById,
      requestedLocale: locale,
      mode: 'published',
    });
  }

  async listPublicPublishedPages(kind?: 'system' | 'custom'): Promise<CmsPublicSitemapPageDto[]> {
    const pages = await this.db.cmsPage.findMany({
      where: {
        status: 'published',
        deletedAt: null,
        ...(kind ? { kind } : {}),
      },
      include: {
        currentPublishedVersion: {
          select: { canonicalPath: true, noIndex: true },
        },
      },
      orderBy: [{ kind: 'asc' }, { slug: 'asc' }],
    });

    const systemDefBySlug = new Map<string, (typeof CMS_SYSTEM_PAGE_DEFS)[number]>(
      CMS_SYSTEM_PAGE_DEFS.map((d) => [d.slug, d]),
    );

    return pages
      .filter(
        (p) =>
          p.status === 'published' &&
          !p.deletedAt &&
          !p.currentPublishedVersion?.noIndex,
      )
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        kind: p.kind,
        canonicalPath:
          p.currentPublishedVersion?.canonicalPath ||
          systemDefBySlug.get(p.slug)?.canonicalPath ||
          `/${p.slug}`,
        publishedAt: p.publishedAt?.toISOString() ?? null,
        updatedAt: p.updatedAt.toISOString(),
      }));
  }

  async listPlatformMenus(): Promise<CmsMenuDto[]> {
    const menus = await this.db.cmsMenu.findMany({
      include: {
        items: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: [{ location: 'asc' }, { slug: 'asc' }],
    });

    const pages = this.db.cmsPage
      ? await this.db.cmsPage.findMany({
        select: { id: true, slug: true, status: true, deletedAt: true },
      })
      : [];

    const pageById = new Map(pages.map((p) => [p.id, p]));
    const pageByPath = new Map<string, (typeof pages)[number]>();
    for (const p of pages) {
      pageByPath.set(`/${p.slug.toLowerCase()}`, p);
      pageByPath.set(`/p/${p.slug.toLowerCase()}`, p);
    }

    const evaluateTargetWarning = (item: {
      targetPageId: string | null;
      href: string;
    }): {
      targetPageSlug: string | null;
      targetPageStatus: CmsPageStatus | 'missing' | null;
      targetWarning: string | null;
    } => {
      if (item.targetPageId) {
        const linked = pageById.get(item.targetPageId);
        if (!linked) {
          return {
            targetPageSlug: null,
            targetPageStatus: 'missing',
            targetWarning: 'Points to a permanently deleted page that no longer exists.',
          };
        }
        if (linked.deletedAt || linked.status === 'trashed') {
          return {
            targetPageSlug: linked.slug,
            targetPageStatus: 'trashed',
            targetWarning: `Linked page "/${linked.slug}" is deleted (in Trash).`,
          };
        }
        if (linked.status !== 'published') {
          return {
            targetPageSlug: linked.slug,
            targetPageStatus: linked.status,
            targetWarning: `Linked page "/${linked.slug}" is currently ${linked.status} (not published live).`,
          };
        }
        return {
          targetPageSlug: linked.slug,
          targetPageStatus: linked.status,
          targetWarning: null,
        };
      }

      const trimmedHref = (item.href || '').trim();
      if (trimmedHref && trimmedHref !== '#' && trimmedHref.startsWith('/')) {
        const norm = normalizeInternalCmsPath(trimmedHref);
        const matched = pageByPath.get(norm);
        if (matched) {
          if (matched.deletedAt || matched.status === 'trashed') {
            return {
              targetPageSlug: matched.slug,
              targetPageStatus: 'trashed',
              targetWarning: `URL "${trimmedHref}" points to a trashed page "/${matched.slug}".`,
            };
          }
          if (matched.status !== 'published') {
            return {
              targetPageSlug: matched.slug,
              targetPageStatus: matched.status,
              targetWarning: `URL "${trimmedHref}" points to unpublished (${matched.status}) page "/${matched.slug}".`,
            };
          }
          return {
            targetPageSlug: matched.slug,
            targetPageStatus: matched.status,
            targetWarning: null,
          };
        }
      }

      return { targetPageSlug: null, targetPageStatus: null, targetWarning: null };
    };

    return menus.map((m) => ({
      id: m.id,
      slug: m.slug,
      name: m.name,
      location: m.location,
      isActive: m.isActive,
      items: (m.items ?? []).map((item) => {
        const flag = evaluateTargetWarning(item);
        return {
          id: item.id,
          menuId: item.menuId,
          parentId: item.parentId,
          labelEn: item.labelEn,
          labelBn: item.labelBn,
          descriptionEn: item.descriptionEn,
          descriptionBn: item.descriptionBn,
          targetPageId: item.targetPageId,
          href: item.href,
          badgeEn: item.badgeEn,
          badgeBn: item.badgeBn,
          sortOrder: item.sortOrder,
          openInNewTab: item.openInNewTab,
          isVisible: item.isVisible,
          ...flag,
        };
      }),
    }));
  }

  async ensureDefaultNavigationMenus(actor: PlatformActorContext): Promise<CmsMenuDto[]> {
    assertCmsEditAllowed(actor);
    const pages = this.db.cmsPage
      ? await this.db.cmsPage.findMany({ select: { id: true, slug: true } })
      : [];
    const pageBySlug = new Map(pages.map((p) => [p.slug, p.id]));

    const headerMenu = await this.db.cmsMenu.upsert({
      where: { slug: 'main-header' },
      create: {
        slug: 'main-header',
        name: 'Primary Header Navigation',
        location: 'header',
        isActive: true,
      },
      update: {},
    });

    const footerMenu = await this.db.cmsMenu.upsert({
      where: { slug: 'main-footer' },
      create: {
        slug: 'main-footer',
        name: 'Footer Link Columns',
        location: 'footer',
        isActive: true,
      },
      update: {},
    });

    const existingFooterItems = await this.db.cmsMenuItem.findMany({
      where: { menuId: footerMenu.id },
      select: { id: true },
    });
    if (existingFooterItems.length === 0) {
      const cols = [
        {
          labelEn: 'Product',
          labelBn: 'প্রোডাক্ট',
          links: [
            { labelEn: 'Features Overview', labelBn: 'ফিচার সমূহ', slug: 'features', href: '/features' },
            { labelEn: 'Pricing', labelBn: 'মূল্য তালিকা', slug: 'pricing', href: '/pricing' },
            { labelEn: 'Security', labelBn: 'নিরাপত্তা', slug: 'security', href: '/security' },
          ],
        },
        {
          labelEn: 'Solutions',
          labelBn: 'সমাধান',
          links: [
            { labelEn: 'Solutions Overview', labelBn: 'সব সমাধান', slug: 'solutions', href: '/solutions' },
            { labelEn: 'Supported Countries', labelBn: 'সমর্থিত দেশ', slug: 'solutions', href: '/solutions/countries' },
          ],
        },
        {
          labelEn: 'Resources',
          labelBn: 'রিসোর্স',
          links: [
            { labelEn: 'Help Center', labelBn: 'সহায়তা কেন্দ্র', slug: 'help', href: '/help' },
            { labelEn: 'Contact Sales', labelBn: 'যোগাযোগ', slug: 'contact', href: '/contact' },
            { labelEn: 'Book a Demo', labelBn: 'ডেমো বুক করুন', slug: 'demo', href: '/demo' },
          ],
        },
        {
          labelEn: 'Company & Legal',
          labelBn: 'প্রতিষ্ঠান ও আইনি',
          links: [
            { labelEn: 'About Us', labelBn: 'আমাদের সম্পর্কে', slug: 'about', href: '/about' },
            { labelEn: 'Careers', labelBn: 'ক্যারিয়ার', slug: 'careers', href: '/careers' },
            { labelEn: 'Privacy Policy', labelBn: 'গোপনীয়তা নীতি', slug: 'privacy', href: '/privacy' },
            { labelEn: 'Terms of Service', labelBn: 'সেবার শর্তাবলী', slug: 'terms', href: '/terms' },
          ],
        },
      ];

      let colOrder = 1;
      for (const col of cols) {
        const colItem = await this.db.cmsMenuItem.create({
          data: {
            menuId: footerMenu.id,
            parentId: null,
            labelEn: col.labelEn,
            labelBn: col.labelBn,
            href: '#',
            sortOrder: colOrder++,
            openInNewTab: false,
            isVisible: true,
          },
        });
        let linkOrder = 1;
        for (const link of col.links) {
          await this.db.cmsMenuItem.create({
            data: {
              menuId: footerMenu.id,
              parentId: colItem.id,
              labelEn: link.labelEn,
              labelBn: link.labelBn,
              targetPageId: pageBySlug.get(link.slug) ?? null,
              href: link.href,
              sortOrder: linkOrder++,
              openInNewTab: false,
              isVisible: true,
            },
          });
        }
      }
    }

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.menus.ensured_defaults',
      module: 'cms',
      recordId: headerMenu.id,
      reason: 'Ensured default header and footer navigation menus exist',
      oldValue: null,
      newValue: { headerMenuId: headerMenu.id, footerMenuId: footerMenu.id },
    });

    return this.listPlatformMenus();
  }

  async createMenuItem(
    menuId: string,
    input: UpsertCmsMenuItemInput,
    actor: PlatformActorContext,
  ): Promise<CmsMenuDto> {
    assertCmsEditAllowed(actor);
    const menu = await this.db.cmsMenu.findUnique({ where: { id: menuId } });
    if (!menu) {
      throw new NotFoundException(`CMS menu "${menuId}" not found.`);
    }

    const labelEn = input.labelEn?.trim();
    if (!labelEn) {
      throw new BadRequestException({
        code: 'CMS_MENU_LABEL_REQUIRED',
        message: 'English menu item label (labelEn) is required.',
      });
    }

    const rawHref = input.href?.trim() || '#';
    if (rawHref !== '#' && !isSafeCmsLinkUrl(rawHref)) {
      throw new BadRequestException({
        code: 'CMS_INVALID_MENU_HREF',
        message: `Unsafe or invalid menu URL "${rawHref}".`,
      });
    }

    let targetPageId = input.targetPageId ?? null;
    let resolvedHref = rawHref;
    if (targetPageId && this.db.cmsPage) {
      const targetPage = await this.db.cmsPage.findUnique({
        where: { id: targetPageId },
        select: { id: true, slug: true },
      });
      if (!targetPage) {
        throw new NotFoundException(`Target CMS page "${targetPageId}" not found.`);
      }
      if (!input.href?.trim() || input.href === '#') {
        resolvedHref = targetPage.slug === 'home' ? '/' : `/${targetPage.slug}`;
      }
    }

    if (input.parentId) {
      const parentItem = await this.db.cmsMenuItem.findFirst({
        where: { id: input.parentId, menuId },
      });
      if (!parentItem) {
        throw new BadRequestException({
          code: 'CMS_INVALID_MENU_PARENT',
          message: `Parent menu item "${input.parentId}" does not belong to this menu.`,
        });
      }
    }

    const siblings = await this.db.cmsMenuItem.findMany({
      where: { menuId, parentId: input.parentId ?? null },
      orderBy: { sortOrder: 'desc' },
      take: 1,
    });
    const nextSort =
      input.sortOrder !== undefined ? input.sortOrder : (siblings[0]?.sortOrder ?? 0) + 1;

    const created = await this.db.cmsMenuItem.create({
      data: {
        menuId,
        parentId: input.parentId ?? null,
        labelEn: labelEn.slice(0, 160),
        labelBn: input.labelBn?.trim() ? input.labelBn.trim().slice(0, 160) : null,
        descriptionEn: input.descriptionEn?.trim() ? input.descriptionEn.trim().slice(0, 300) : null,
        descriptionBn: input.descriptionBn?.trim() ? input.descriptionBn.trim().slice(0, 300) : null,
        targetPageId,
        href: resolvedHref,
        badgeEn: input.badgeEn?.trim() ? input.badgeEn.trim().slice(0, 60) : null,
        badgeBn: input.badgeBn?.trim() ? input.badgeBn.trim().slice(0, 60) : null,
        sortOrder: nextSort,
        openInNewTab: Boolean(input.openInNewTab),
        isVisible: input.isVisible !== undefined ? Boolean(input.isVisible) : true,
      },
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.menu_item.created',
      module: 'cms',
      recordId: created.id,
      reason: `Added menu item "${created.labelEn}" to "${menu.name}"`,
      oldValue: null,
      newValue: {
        menuId,
        id: created.id,
        parentId: created.parentId,
        labelEn: created.labelEn,
        labelBn: created.labelBn,
        href: created.href,
        targetPageId: created.targetPageId,
        openInNewTab: created.openInNewTab,
        isVisible: created.isVisible,
      },
    });

    this.triggerRevalidate({ scopes: ['cms-menus'] });
    const updatedMenus = await this.listPlatformMenus();
    return updatedMenus.find((m) => m.id === menuId)!;
  }

  async updateMenuItem(
    menuId: string,
    itemId: string,
    input: Partial<UpsertCmsMenuItemInput>,
    actor: PlatformActorContext,
  ): Promise<CmsMenuDto> {
    assertCmsEditAllowed(actor);
    const existing = await this.db.cmsMenuItem.findFirst({
      where: { id: itemId, menuId },
    });
    if (!existing) {
      throw new NotFoundException(`Menu item "${itemId}" not found in menu "${menuId}".`);
    }

    if (input.href !== undefined) {
      const trimmed = input.href.trim();
      if (!trimmed || (trimmed !== '#' && !isSafeCmsLinkUrl(trimmed))) {
        throw new BadRequestException({
          code: 'CMS_INVALID_MENU_HREF',
          message: `Unsafe or invalid menu URL "${trimmed}".`,
        });
      }
    }

    if (input.parentId !== undefined && input.parentId !== null) {
      if (input.parentId === itemId) {
        throw new BadRequestException({
          code: 'CMS_INVALID_MENU_PARENT',
          message: 'A menu item cannot be its own parent.',
        });
      }
      const parentItem = await this.db.cmsMenuItem.findFirst({
        where: { id: input.parentId, menuId },
      });
      if (!parentItem) {
        throw new BadRequestException({
          code: 'CMS_INVALID_MENU_PARENT',
          message: 'Target parent group/column does not belong to this menu.',
        });
      }
    }

    const oldState = {
      parentId: existing.parentId,
      labelEn: existing.labelEn,
      labelBn: existing.labelBn,
      href: existing.href,
      targetPageId: existing.targetPageId,
      openInNewTab: existing.openInNewTab,
      isVisible: existing.isVisible,
    };

    const updated = await this.db.cmsMenuItem.update({
      where: { id: itemId },
      data: {
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        ...(input.labelEn !== undefined ? { labelEn: input.labelEn.trim().slice(0, 160) } : {}),
        ...(input.labelBn !== undefined
          ? { labelBn: input.labelBn?.trim() ? input.labelBn.trim().slice(0, 160) : null }
          : {}),
        ...(input.descriptionEn !== undefined
          ? { descriptionEn: input.descriptionEn?.trim() ? input.descriptionEn.trim().slice(0, 300) : null }
          : {}),
        ...(input.descriptionBn !== undefined
          ? { descriptionBn: input.descriptionBn?.trim() ? input.descriptionBn.trim().slice(0, 300) : null }
          : {}),
        ...(input.targetPageId !== undefined ? { targetPageId: input.targetPageId } : {}),
        ...(input.href !== undefined ? { href: input.href.trim() } : {}),
        ...(input.badgeEn !== undefined
          ? { badgeEn: input.badgeEn?.trim() ? input.badgeEn.trim().slice(0, 60) : null }
          : {}),
        ...(input.badgeBn !== undefined
          ? { badgeBn: input.badgeBn?.trim() ? input.badgeBn.trim().slice(0, 60) : null }
          : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.openInNewTab !== undefined ? { openInNewTab: Boolean(input.openInNewTab) } : {}),
        ...(input.isVisible !== undefined ? { isVisible: Boolean(input.isVisible) } : {}),
      },
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.menu_item.updated',
      module: 'cms',
      recordId: itemId,
      reason: `Updated menu item "${updated.labelEn}"`,
      oldValue: oldState,
      newValue: {
        parentId: updated.parentId,
        labelEn: updated.labelEn,
        labelBn: updated.labelBn,
        href: updated.href,
        targetPageId: updated.targetPageId,
        openInNewTab: updated.openInNewTab,
        isVisible: updated.isVisible,
      },
    });

    this.triggerRevalidate({ scopes: ['cms-menus'] });
    const updatedMenus = await this.listPlatformMenus();
    return updatedMenus.find((m) => m.id === menuId)!;
  }

  async deleteMenuItem(
    menuId: string,
    itemId: string,
    actor: PlatformActorContext,
  ): Promise<CmsMenuDto> {
    assertCmsEditAllowed(actor);
    const existing = await this.db.cmsMenuItem.findFirst({
      where: { id: itemId, menuId },
    });
    if (!existing) {
      throw new NotFoundException(`Menu item "${itemId}" not found in menu "${menuId}".`);
    }

    await this.db.cmsMenuItem.delete({ where: { id: itemId } });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.menu_item.deleted',
      module: 'cms',
      recordId: itemId,
      reason: `Removed menu item "${existing.labelEn}" from menu "${menuId}"`,
      oldValue: {
        id: existing.id,
        labelEn: existing.labelEn,
        href: existing.href,
      },
      newValue: null,
    });

    this.triggerRevalidate({ scopes: ['cms-menus'] });
    const updatedMenus = await this.listPlatformMenus();
    return updatedMenus.find((m) => m.id === menuId)!;
  }

  async reorderMenuItems(
    menuId: string,
    input: ReorderCmsMenuItemsInput,
    actor: PlatformActorContext,
  ): Promise<CmsMenuDto> {
    assertCmsEditAllowed(actor);
    const menu = await this.db.cmsMenu.findUnique({ where: { id: menuId } });
    if (!menu) {
      throw new NotFoundException(`CMS menu "${menuId}" not found.`);
    }

    const existingItems = await this.db.cmsMenuItem.findMany({
      where: { menuId },
      select: { id: true, parentId: true, sortOrder: true },
    });
    const validIds = new Set(existingItems.map((it) => it.id));

    for (const entry of input.items) {
      if (!validIds.has(entry.id)) {
        throw new BadRequestException({
          code: 'CMS_INVALID_MENU_ITEM',
          message: `Menu item "${entry.id}" does not belong to menu "${menuId}".`,
        });
      }
      if (entry.parentId && !validIds.has(entry.parentId)) {
        throw new BadRequestException({
          code: 'CMS_INVALID_MENU_PARENT',
          message: `Parent item "${entry.parentId}" does not belong to menu "${menuId}".`,
        });
      }
      if (entry.parentId === entry.id) {
        throw new BadRequestException({
          code: 'CMS_INVALID_MENU_PARENT',
          message: 'A menu item cannot reference itself as parent.',
        });
      }
    }

    await this.db.$transaction(async (tx) => {
      for (const entry of input.items) {
        await tx.cmsMenuItem.update({
          where: { id: entry.id },
          data: {
            ...(entry.parentId !== undefined ? { parentId: entry.parentId } : {}),
            sortOrder: entry.sortOrder,
          },
        });
      }
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.menu.reordered',
      module: 'cms',
      recordId: menuId,
      reason: `Reordered ${input.items.length} item(s) in menu "${menu.name}"`,
      oldValue: existingItems,
      newValue: input.items,
    });

    this.triggerRevalidate({ scopes: ['cms-menus'] });
    const updatedMenus = await this.listPlatformMenus();
    return updatedMenus.find((m) => m.id === menuId)!;
  }

  async listPublicMenus(filters?: { location?: string; slug?: string }): Promise<CmsMenuDto[]> {
    const menus = await this.db.cmsMenu.findMany({
      where: {
        isActive: true,
        ...(filters?.location ? { location: filters.location as any } : {}),
        ...(filters?.slug ? { slug: filters.slug.trim().toLowerCase() } : {}),
      },
      include: {
        items: {
          where: { isVisible: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { slug: 'asc' },
    });

    return menus.map((m) => ({
      id: m.id,
      slug: m.slug,
      name: m.name,
      location: m.location,
      isActive: m.isActive,
      items: m.items.map((item) => ({
        id: item.id,
        menuId: item.menuId,
        parentId: item.parentId,
        labelEn: item.labelEn,
        labelBn: item.labelBn,
        descriptionEn: item.descriptionEn,
        descriptionBn: item.descriptionBn,
        targetPageId: item.targetPageId,
        href: item.href,
        badgeEn: item.badgeEn,
        badgeBn: item.badgeBn,
        sortOrder: item.sortOrder,
        openInNewTab: item.openInNewTab,
        isVisible: item.isVisible,
      })),
    }));
  }

  async listPublicPosts(filters?: {
    locale?: string;
    categorySlug?: string;
    authorSlug?: string;
    tag?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: CmsPublicPostDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasPublishedPosts: boolean;
    categories: Array<{
      id: string;
      slug: string;
      nameEn: string;
      nameBn: string | null;
      postCount: number;
    }>;
  }> {
    const locale = assertValidCmsLocale(filters?.locale ?? 'en');
    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 20));
    const where: Prisma.CmsPostWhereInput = {
      status: 'published',
      deletedAt: null,
      ...(filters?.categorySlug && filters.categorySlug !== 'all'
        ? { category: { slug: filters.categorySlug.trim().toLowerCase() } }
        : {}),
      ...(filters?.authorSlug
        ? { author: { slug: filters.authorSlug.trim().toLowerCase() } }
        : {}),
      ...(filters?.tag ? { tags: { has: filters.tag.trim() } } : {}),
      ...(filters?.search?.trim()
        ? {
          OR: [
            { titleEn: { contains: filters.search.trim(), mode: 'insensitive' } },
            { titleBn: { contains: filters.search.trim(), mode: 'insensitive' } },
            { excerptEn: { contains: filters.search.trim(), mode: 'insensitive' } },
          ],
        }
        : {}),
    };

    const [rows, total, allPublishedCount, rawCategories] = await Promise.all([
      this.db.cmsPost.findMany({
        where,
        include: {
          category: true,
          author: true,
          coverMedia: { select: { id: true, altEn: true, altBn: true } },
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.cmsPost.count({ where }),
      this.db.cmsPost.count({ where: { status: 'published', deletedAt: null } }),
      this.db.cmsPostCategory && typeof this.db.cmsPostCategory.findMany === 'function'
        ? this.db.cmsPostCategory.findMany({
          include: {
            _count: {
              select: {
                posts: { where: { status: 'published', deletedAt: null } },
              },
            },
          },
          orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
        })
        : Promise.resolve([]),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const categories = rawCategories
      .map((c: any) => ({
        id: c.id,
        slug: c.slug,
        nameEn: c.nameEn,
        nameBn: c.nameBn ?? null,
        postCount: c._count?.posts ?? 0,
      }))
      .filter((c) => c.postCount > 0);

    return {
      items: rows.map((r) => this.mapPublicPostDto(r, locale)),
      total,
      page,
      pageSize,
      totalPages,
      hasPublishedPosts: allPublishedCount > 0,
      categories,
    };
  }

  async getPublicPostBySlug(
    slug: string,
    rawLocale = 'en',
  ): Promise<CmsPublicPostDto | null> {
    const locale = assertValidCmsLocale(rawLocale);
    const r = await this.db.cmsPost.findFirst({
      where: {
        slug: slug.trim().toLowerCase(),
        status: 'published',
        deletedAt: null,
      },
      include: {
        category: true,
        author: true,
        coverMedia: { select: { id: true, altEn: true, altBn: true } },
      },
    });

    if (!r) return null;

    // Resolve up to 3 related posts (manual relatedPostIds first, then category & tag similarity)
    const manualIds = Array.isArray((r as any).relatedPostIds)
      ? ((r as any).relatedPostIds as string[]).filter((id) => id && id !== r.id)
      : [];
    const candidates = await this.db.cmsPost.findMany({
      where: {
        id: { not: r.id },
        status: 'published',
        deletedAt: null,
      },
      include: {
        category: true,
        author: true,
        coverMedia: { select: { id: true, altEn: true, altBn: true } },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 30,
    });

    const selectedRelated: typeof candidates = [];
    const seenIds = new Set<string>();
    for (const manualId of manualIds) {
      const match = candidates.find((c) => c.id === manualId);
      if (match && !seenIds.has(match.id)) {
        seenIds.add(match.id);
        selectedRelated.push(match);
      }
      if (selectedRelated.length >= 3) break;
    }

    if (selectedRelated.length < 3) {
      const postTags = new Set((r.tags ?? []).map((t) => t.toLowerCase()));
      const scored = candidates
        .filter((c) => !seenIds.has(c.id))
        .map((c) => {
          const sameCategory = c.categoryId === r.categoryId ? 100 : 0;
          const tagMatches = (c.tags ?? []).filter((t) =>
            postTags.has(t.toLowerCase()),
          ).length;
          return { candidate: c, score: sameCategory + tagMatches * 25 };
        })
        .sort((a, b) => b.score - a.score);

      for (const entry of scored) {
        if (selectedRelated.length >= 3) break;
        selectedRelated.push(entry.candidate);
      }
    }

    const relatedPosts: CmsPublicPostSummaryDto[] = selectedRelated.map((rel) => {
      const mapped = this.mapPublicPostDto(rel, locale);
      return {
        id: mapped.id,
        slug: mapped.slug,
        titleEn: mapped.titleEn,
        titleBn: mapped.titleBn,
        excerptEn: mapped.excerptEn,
        excerptBn: mapped.excerptBn,
        resolvedLocale: mapped.resolvedLocale,
        fallbackUsed: mapped.fallbackUsed,
        coverMediaId: mapped.coverMediaId,
        coverImageUrl: mapped.coverImageUrl,
        coverAltEn: mapped.coverAltEn,
        coverAltBn: mapped.coverAltBn,
        tags: mapped.tags,
        readingTimeMinutes: mapped.readingTimeMinutes,
        publishedAt: mapped.publishedAt,
        updatedAt: mapped.updatedAt,
        category: mapped.category,
        author: mapped.author,
      };
    });

    return {
      ...this.mapPublicPostDto(r, locale),
      relatedPosts,
    };
  }

  async listPublicChangelog(filters?: {
    locale?: string;
    tag?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: Array<CmsChangelogEntryDto & { resolvedLocale: CmsLocale; fallbackUsed: boolean }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const locale = assertValidCmsLocale(filters?.locale ?? 'en');
    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, filters?.pageSize ?? 20));
    const where: Prisma.CmsChangelogEntryWhereInput = {
      isPublished: true,
      deletedAt: null,
      ...(filters?.tag ? { tag: filters.tag as any } : {}),
    };

    const [rows, total] = await Promise.all([
      this.db.cmsChangelogEntry.findMany({
        where,
        orderBy: [{ releaseDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.cmsChangelogEntry.count({ where }),
    ]);

    return {
      items: rows.map((entry) => {
        const canServeBn = locale === 'bn' && entry.isBnTranslated && Boolean(entry.titleBn);
        return {
          ...this.mapChangelogDto(entry),
          resolvedLocale: canServeBn ? 'bn' : 'en',
          fallbackUsed: locale === 'bn' && !canServeBn,
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  async listPublicCareers(filters?: {
    locale?: string;
    department?: string;
  }): Promise<{ items: Array<CmsCareerDto & { resolvedLocale: CmsLocale; fallbackUsed: boolean }> }> {
    const locale = assertValidCmsLocale(filters?.locale ?? 'en');
    const rows = await this.db.cmsCareer.findMany({
      where: {
        deletedAt: null,
        status: 'open',
        ...(filters?.department
          ? { department: { equals: filters.department.trim(), mode: 'insensitive' } }
          : {}),
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      items: rows.map((row) => {
        const canServeBn = locale === 'bn' && row.isBnTranslated && Boolean(row.titleBn);
        return {
          ...this.mapCareerDto(row),
          resolvedLocale: canServeBn ? 'bn' : 'en',
          fallbackUsed: locale === 'bn' && !canServeBn,
        };
      }),
    };
  }

  async getPublicCareerBySlug(slug: string, rawLocale = 'en') {
    const locale = assertValidCmsLocale(rawLocale);
    const row = await this.db.cmsCareer.findFirst({
      where: {
        slug: slug.trim().toLowerCase(),
        deletedAt: null,
        status: { in: ['open', 'paused', 'closed'] },
      },
    });
    if (!row) return null;
    const canServeBn = locale === 'bn' && row.isBnTranslated && Boolean(row.titleBn);
    return {
      ...this.mapCareerDto(row),
      resolvedLocale: canServeBn ? ('bn' as const) : ('en' as const),
      fallbackUsed: locale === 'bn' && !canServeBn,
    };
  }

  async listPublicSiteSettings(): Promise<Record<string, Record<string, unknown>>> {
    const rows = await this.db.cmsSiteSetting.findMany({
      where: { isPublic: true },
      orderBy: { key: 'asc' },
    });
    const out: Record<string, Record<string, unknown>> = {};
    for (const row of rows) {
      out[row.key] = (row.valueJson ?? {}) as Record<string, unknown>;
    }
    return out;
  }

  // =========================================================================
  // Internal Helpers
  // =========================================================================

  private async resolveVersionsToPublish(
    page: {
      id: string;
      slug: string;
      currentPublishedVersionId: string | null;
      locales: Array<{
        locale: CmsLocale;
        isTranslated: boolean;
        currentDraftVersionId: string | null;
        currentPublishedVersionId: string | null;
      }>;
    },
    input: { locale?: CmsLocale; versionId?: string },
  ) {
    if (input.versionId) {
      const explicit = await this.db.cmsPageVersion.findFirst({
        where: { id: input.versionId, pageId: page.id },
      });
      if (!explicit) {
        throw new NotFoundException(
          `Version "${input.versionId}" does not belong to CMS page "${page.slug}".`,
        );
      }
      return [explicit];
    }

    const candidateIds: string[] = [];
    if (input.locale) {
      const locale = assertValidCmsLocale(input.locale);
      const row = page.locales.find((l) => l.locale === locale);
      const id = row?.currentDraftVersionId || row?.currentPublishedVersionId;
      if (!id) {
        throw new BadRequestException({
          code: 'CMS_NO_VERSION_AVAILABLE',
          message: `CMS page "${page.slug}" has no draft or published version for locale "${locale}".`,
        });
      }
      candidateIds.push(id);
    } else {
      for (const row of page.locales) {
        const id = row.currentDraftVersionId || row.currentPublishedVersionId;
        if (id) candidateIds.push(id);
      }
      if (candidateIds.length === 0 && page.currentPublishedVersionId) {
        candidateIds.push(page.currentPublishedVersionId);
      }
    }

    const uniqueIds = Array.from(new Set(candidateIds));
    if (uniqueIds.length === 0) {
      throw new BadRequestException({
        code: 'CMS_NO_VERSION_AVAILABLE',
        message: `CMS page "${page.slug}" has no saved version to publish.`,
      });
    }

    return this.db.cmsPageVersion.findMany({
      where: { id: { in: uniqueIds }, pageId: page.id },
    });
  }

  private pickPageWorkflowSnapshot(page: {
    id: string;
    slug: string;
    kind: CmsPageDto['kind'];
    status: CmsPageStatus;
    locked: boolean;
    requiresApproval: boolean;
    approvalStatus: CmsApprovalStatus;
    pendingApprovalVersionId: string | null;
    submittedForApprovalById: string | null;
    approvedById: string | null;
    rejectedById: string | null;
    scheduledAt: Date | null;
    scheduledTimezone: string | null;
    publishedAt: Date | null;
    currentPublishedVersionId: string | null;
    deletedAt: Date | null;
    locales?: Array<{
      locale: CmsLocale;
      currentDraftVersionId: string | null;
      currentPublishedVersionId: string | null;
    }>;
  }) {
    return {
      id: page.id,
      slug: page.slug,
      kind: page.kind,
      status: page.status,
      locked: page.locked,
      requiresApproval: page.requiresApproval,
      approvalStatus: page.approvalStatus,
      pendingApprovalVersionId: page.pendingApprovalVersionId,
      submittedForApprovalById: page.submittedForApprovalById,
      approvedById: page.approvedById,
      rejectedById: page.rejectedById,
      scheduledAt: page.scheduledAt?.toISOString() ?? null,
      scheduledTimezone: page.scheduledTimezone,
      publishedAt: page.publishedAt?.toISOString() ?? null,
      currentPublishedVersionId: page.currentPublishedVersionId,
      deletedAt: page.deletedAt?.toISOString() ?? null,
      locales: page.locales?.map((l) => ({
        locale: l.locale,
        currentDraftVersionId: l.currentDraftVersionId,
        currentPublishedVersionId: l.currentPublishedVersionId,
      })),
    };
  }

  private pickPostAuditSnapshot(post: {
    id: string;
    slug: string;
    status: string;
    titleEn: string;
    titleBn: string | null;
    scheduledAt: Date | null;
    scheduledTimezone: string | null;
    publishedAt: Date | null;
    deletedAt: Date | null;
  }) {
    return {
      id: post.id,
      slug: post.slug,
      status: post.status,
      titleEn: post.titleEn,
      titleBn: post.titleBn,
      scheduledAt: post.scheduledAt?.toISOString() ?? null,
      scheduledTimezone: post.scheduledTimezone,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      deletedAt: post.deletedAt?.toISOString() ?? null,
    };
  }

  private mapVersionDto(v: {
    id: string;
    pageId: string;
    versionNumber: number;
    locale: CmsLocale;
    title: string;
    seoTitle: string | null;
    seoDescription: string | null;
    canonicalPath: string | null;
    ogImageUrl: string | null;
    noIndex: boolean;
    blocks: unknown;
    isTranslated: boolean;
    authorId: string | null;
    authorName: string | null;
    changeNote: string | null;
    createdAt: Date;
  }): CmsPageVersionDto {
    return {
      id: v.id,
      pageId: v.pageId,
      versionNumber: v.versionNumber,
      locale: v.locale,
      title: v.title,
      seoTitle: v.seoTitle,
      seoDescription: v.seoDescription,
      canonicalPath: v.canonicalPath,
      ogImageUrl: v.ogImageUrl,
      noIndex: v.noIndex,
      blocks: Array.isArray(v.blocks) ? (v.blocks as CmsPageVersionDto['blocks']) : [],
      isTranslated: v.isTranslated,
      authorId: v.authorId,
      authorName: v.authorName,
      changeNote: v.changeNote,
      createdAt: v.createdAt.toISOString(),
    };
  }

  private mapPostDto(p: {
    id: string;
    slug: string;
    status: CmsPostDto['status'];
    categoryId: string;
    authorId: string;
    coverMediaId: string | null;
    coverAltEn?: string | null;
    coverAltBn?: string | null;
    coverMedia?: { id: string; altEn: string | null; altBn: string | null } | null;
    titleEn: string;
    titleBn: string | null;
    excerptEn: string;
    excerptBn: string | null;
    bodyJsonEn: unknown;
    bodyHtmlEn: string;
    bodyJsonBn: unknown;
    bodyHtmlBn: string | null;
    isBnTranslated: boolean;
    bnTranslationStatus: CmsTranslationStatus;
    seoTitleEn: string | null;
    seoDescriptionEn: string | null;
    seoTitleBn: string | null;
    seoDescriptionBn: string | null;
    tags: string[];
    relatedPostIds?: string[];
    readingTimeMinutes: number;
    scheduledAt: Date | null;
    scheduledTimezone?: string | null;
    publishedAt: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
    category?: {
      id: string;
      slug: string;
      nameEn: string;
      nameBn: string | null;
    } | null;
    author?: {
      id: string;
      slug: string;
      displayName: string;
      displayNameBn: string | null;
      roleTitle: string | null;
      roleTitleBn?: string | null;
      avatarMediaId?: string | null;
    } | null;
  }): CmsPostDto {
    const coverImageUrl = p.coverMediaId
      ? `/api/v1/public/content/media/${p.coverMediaId}/file`
      : null;
    return {
      id: p.id,
      slug: p.slug,
      status: p.status,
      categoryId: p.categoryId,
      authorId: p.authorId,
      coverMediaId: p.coverMediaId,
      coverImageUrl,
      coverAltEn: p.coverAltEn ?? p.coverMedia?.altEn ?? null,
      coverAltBn: p.coverAltBn ?? p.coverMedia?.altBn ?? null,
      titleEn: p.titleEn,
      titleBn: p.titleBn,
      excerptEn: p.excerptEn,
      excerptBn: p.excerptBn,
      bodyJsonEn: (p.bodyJsonEn ?? {}) as Record<string, unknown>,
      bodyHtmlEn: p.bodyHtmlEn,
      bodyJsonBn: (p.bodyJsonBn as Record<string, unknown> | null) ?? null,
      bodyHtmlBn: p.bodyHtmlBn,
      isBnTranslated: p.isBnTranslated,
      bnTranslationStatus: p.bnTranslationStatus,
      seoTitleEn: p.seoTitleEn,
      seoDescriptionEn: p.seoDescriptionEn,
      seoTitleBn: p.seoTitleBn,
      seoDescriptionBn: p.seoDescriptionBn,
      tags: p.tags ?? [],
      relatedPostIds: p.relatedPostIds ?? [],
      readingTimeMinutes: p.readingTimeMinutes,
      scheduledAt: p.scheduledAt?.toISOString() ?? null,
      scheduledTimezone: p.scheduledTimezone ?? null,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      updatedAt: p.updatedAt?.toISOString(),
      createdAt: p.createdAt?.toISOString(),
      ...(p.category
        ? {
          category: {
            id: p.category.id,
            slug: p.category.slug,
            nameEn: p.category.nameEn,
            nameBn: p.category.nameBn,
          },
        }
        : {}),
      ...(p.author
        ? {
          author: {
            id: p.author.id,
            slug: p.author.slug,
            displayName: p.author.displayName,
            displayNameBn: p.author.displayNameBn,
            roleTitle: p.author.roleTitle,
            roleTitleBn: p.author.roleTitleBn ?? null,
            avatarUrl: p.author.avatarMediaId
              ? `/api/v1/public/content/media/${p.author.avatarMediaId}/file`
              : null,
          },
        }
        : {}),
    };
  }

  private mapPublicPostDto(
    r: {
      id: string;
      slug: string;
      status: CmsPostDto['status'];
      categoryId: string;
      authorId: string;
      coverMediaId: string | null;
      coverAltEn?: string | null;
      coverAltBn?: string | null;
      coverMedia?: { id: string; altEn: string | null; altBn: string | null } | null;
      titleEn: string;
      titleBn: string | null;
      excerptEn: string;
      excerptBn: string | null;
      bodyJsonEn: unknown;
      bodyHtmlEn: string;
      bodyJsonBn: unknown;
      bodyHtmlBn: string | null;
      isBnTranslated: boolean;
      bnTranslationStatus: CmsTranslationStatus;
      seoTitleEn: string | null;
      seoDescriptionEn: string | null;
      seoTitleBn: string | null;
      seoDescriptionBn: string | null;
      tags: string[];
      relatedPostIds?: string[];
      readingTimeMinutes: number;
      scheduledAt: Date | null;
      scheduledTimezone?: string | null;
      publishedAt: Date | null;
      createdAt?: Date;
      updatedAt?: Date;
      category: { id: string; slug: string; nameEn: string; nameBn: string | null };
      author: {
        id: string;
        slug: string;
        displayName: string;
        displayNameBn: string | null;
        roleTitle: string | null;
        roleTitleBn?: string | null;
        avatarMediaId?: string | null;
      };
    },
    locale: CmsLocale,
  ): CmsPublicPostDto {
    const canServeBn = locale === 'bn' && r.isBnTranslated && Boolean(r.bodyHtmlBn);
    return {
      ...this.mapPostDto(r),
      resolvedLocale: canServeBn ? 'bn' : 'en',
      fallbackUsed: locale === 'bn' && !canServeBn,
      category: {
        id: r.category.id,
        slug: r.category.slug,
        nameEn: r.category.nameEn,
        nameBn: r.category.nameBn,
      },
      author: {
        id: r.author.id,
        slug: r.author.slug,
        displayName: r.author.displayName,
        displayNameBn: r.author.displayNameBn,
        roleTitle: r.author.roleTitle,
        roleTitleBn: r.author.roleTitleBn ?? null,
        avatarUrl: r.author.avatarMediaId
          ? `/api/v1/public/content/media/${r.author.avatarMediaId}/file`
          : null,
      },
    };
  }

  private mapChangelogDto(c: {
    id: string;
    slug: string;
    versionLabel: string;
    releaseDate: Date;
    tag: CmsChangelogEntryDto['tag'];
    moduleRefs: string | null;
    titleEn: string;
    summaryEn: string;
    bodyHtmlEn?: string;
    bodyJsonEn?: unknown;
    highlightsEn: string[];
    titleBn: string | null;
    summaryBn: string | null;
    bodyHtmlBn?: string | null;
    bodyJsonBn?: unknown;
    highlightsBn: string[];
    isBnTranslated: boolean;
    isPublished: boolean;
    scheduledAt?: Date | null;
    scheduledTimezone?: string | null;
    publishedAt?: Date | null;
    deletedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }): CmsChangelogEntryDto {
    return {
      id: c.id,
      slug: c.slug,
      versionLabel: c.versionLabel,
      releaseDate: c.releaseDate.toISOString().slice(0, 10),
      tag: c.tag,
      moduleRefs: c.moduleRefs,
      titleEn: c.titleEn,
      summaryEn: c.summaryEn,
      bodyHtmlEn: c.bodyHtmlEn ?? '',
      bodyJsonEn: (c.bodyJsonEn ?? {}) as Record<string, unknown>,
      highlightsEn: c.highlightsEn ?? [],
      titleBn: c.titleBn,
      summaryBn: c.summaryBn,
      bodyHtmlBn: c.bodyHtmlBn ?? null,
      bodyJsonBn: (c.bodyJsonBn as Record<string, unknown> | null) ?? null,
      highlightsBn: c.highlightsBn ?? [],
      isBnTranslated: c.isBnTranslated,
      isPublished: c.isPublished,
      scheduledAt: c.scheduledAt?.toISOString() ?? null,
      scheduledTimezone: c.scheduledTimezone ?? null,
      publishedAt: c.publishedAt?.toISOString() ?? null,
      deletedAt: c.deletedAt?.toISOString() ?? null,
      createdAt: c.createdAt?.toISOString(),
      updatedAt: c.updatedAt?.toISOString(),
    };
  }

  private mapCareerDto(c: {
    id: string;
    slug: string;
    status: CmsCareerDto['status'];
    department: string;
    locationType: string;
    locationText: string;
    employmentType: string;
    titleEn: string;
    summaryEn: string;
    descriptionHtmlEn: string;
    descriptionJsonEn?: unknown;
    titleBn: string | null;
    summaryBn: string | null;
    descriptionHtmlBn: string | null;
    descriptionJsonBn?: unknown;
    isBnTranslated: boolean;
    applyEmail: string | null;
    applyUrl?: string | null;
    publishedAt: Date | null;
    closesAt: Date | null;
    deletedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }): CmsCareerDto {
    return {
      id: c.id,
      slug: c.slug,
      status: c.status,
      department: c.department,
      locationType: c.locationType,
      locationText: c.locationText,
      employmentType: c.employmentType,
      titleEn: c.titleEn,
      summaryEn: c.summaryEn,
      descriptionHtmlEn: c.descriptionHtmlEn,
      descriptionJsonEn: (c.descriptionJsonEn ?? {}) as Record<string, unknown>,
      titleBn: c.titleBn,
      summaryBn: c.summaryBn,
      descriptionHtmlBn: c.descriptionHtmlBn,
      descriptionJsonBn: (c.descriptionJsonBn as Record<string, unknown> | null) ?? null,
      isBnTranslated: c.isBnTranslated,
      applyEmail: c.applyEmail,
      applyUrl: c.applyUrl ?? null,
      publishedAt: c.publishedAt?.toISOString() ?? null,
      closesAt: c.closesAt?.toISOString() ?? null,
      deletedAt: c.deletedAt?.toISOString() ?? null,
      createdAt: c.createdAt?.toISOString(),
      updatedAt: c.updatedAt?.toISOString(),
    };
  }

  private mapPageDto(page: {
    id: string;
    kind: CmsPageDto['kind'];
    slug: string;
    status: CmsPageDto['status'];
    locked: boolean;
    requiresApproval: boolean;
    approvalStatus: CmsApprovalStatus;
    pendingApprovalVersionId: string | null;
    submittedForApprovalById: string | null;
    submittedForApprovalAt: Date | null;
    submissionNote: string | null;
    approvedById: string | null;
    approvedAt: Date | null;
    approvalNote: string | null;
    rejectedById: string | null;
    rejectedAt: Date | null;
    rejectionReason: string | null;
    scheduledAt: Date | null;
    scheduledTimezone: string | null;
    scheduledById: string | null;
    publishedAt: Date | null;
    currentPublishedVersionId: string | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    locales: Array<{
      locale: CmsLocale;
      isTranslated: boolean;
      translationStatus: CmsTranslationStatus;
      currentDraftVersionId: string | null;
      currentPublishedVersionId: string | null;
      updatedAt: Date;
    }>;
  }): CmsPageDto {
    return {
      id: page.id,
      kind: page.kind,
      slug: page.slug,
      status: page.status,
      locked: page.locked,
      requiresApproval: page.requiresApproval,
      approvalStatus: page.approvalStatus,
      pendingApprovalVersionId: page.pendingApprovalVersionId ?? null,
      submittedForApprovalById: page.submittedForApprovalById ?? null,
      submittedForApprovalAt: page.submittedForApprovalAt?.toISOString() ?? null,
      submissionNote: page.submissionNote ?? null,
      approvedById: page.approvedById ?? null,
      approvedAt: page.approvedAt?.toISOString() ?? null,
      approvalNote: page.approvalNote ?? null,
      rejectedById: page.rejectedById ?? null,
      rejectedAt: page.rejectedAt?.toISOString() ?? null,
      rejectionReason: page.rejectionReason ?? null,
      scheduledAt: page.scheduledAt?.toISOString() ?? null,
      scheduledTimezone: page.scheduledTimezone ?? null,
      scheduledById: page.scheduledById ?? null,
      publishedAt: page.publishedAt?.toISOString() ?? null,
      currentPublishedVersionId: page.currentPublishedVersionId ?? null,
      deletedAt: page.deletedAt?.toISOString() ?? null,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
      locales: page.locales.map((l) => ({
        locale: l.locale,
        isTranslated: l.isTranslated,
        translationStatus: l.translationStatus,
        currentDraftVersionId: l.currentDraftVersionId ?? null,
        currentPublishedVersionId: l.currentPublishedVersionId ?? null,
        updatedAt: l.updatedAt.toISOString(),
      })),
    };
  }

  // =========================================================================
  // Media Library (Stage C.1)
  // =========================================================================

  async listMedia(filters?: {
    folder?: string;
    tag?: string;
    mimeGroup?: 'all' | 'images' | 'pdfs';
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: CmsMediaDto[]; total: number }> {
    const folder = filters?.folder?.trim();
    const tag = filters?.tag?.trim().toLowerCase();
    const mimeGroup = filters?.mimeGroup ?? 'all';
    const search = filters?.search?.trim();
    const take = Math.min(Math.max(filters?.limit ?? 48, 1), 100);
    const skip = Math.max(filters?.offset ?? 0, 0);

    const where: Prisma.CmsMediaWhereInput = { deletedAt: null };
    if (folder && folder !== 'all') {
      where.folder = normalizeCmsMediaFolder(folder);
    }
    if (tag && tag !== 'all') {
      where.tags = { has: tag };
    }
    if (mimeGroup === 'images') {
      where.mimeType = { startsWith: 'image/' };
    } else if (mimeGroup === 'pdfs') {
      where.mimeType = 'application/pdf';
    }
    if (search) {
      where.OR = [
        { originalName: { contains: search, mode: 'insensitive' } },
        { filename: { contains: search, mode: 'insensitive' } },
        { altEn: { contains: search, mode: 'insensitive' } },
        { altBn: { contains: search, mode: 'insensitive' } },
        { captionEn: { contains: search, mode: 'insensitive' } },
        { tags: { has: search.toLowerCase() } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.db.cmsMedia.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.db.cmsMedia.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.mapMediaDto(row)),
      total,
    };
  }

  async uploadMedia(
    params: {
      buffer: Buffer;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      folder?: string;
      tags?: string[] | string;
      altEn?: string | null;
      altBn?: string | null;
      captionEn?: string | null;
      captionBn?: string | null;
      width?: number | null;
      height?: number | null;
    },
    actor: PlatformActorContext,
  ): Promise<CmsMediaDto> {
    assertCmsEditAllowed(actor);
    if (!this.storageService) {
      throw new ServiceUnavailableException('Storage service is not available for CMS media upload.');
    }

    const processed = await processCmsMediaUpload({
      buffer: params.buffer,
      originalName: params.originalName,
      claimedMimeType: params.mimeType,
      width: params.width,
      height: params.height,
    });

    const isImage = processed.verifiedMime.startsWith('image/');
    const altEn = params.altEn?.trim() ? params.altEn.trim().slice(0, 300) : null;
    const altBn = params.altBn?.trim() ? params.altBn.trim().slice(0, 300) : null;
    if (isImage && !altEn && !altBn) {
      throw new BadRequestException({
        code: 'CMS_MEDIA_ALT_REQUIRED',
        message: 'Alt text (English or Bengali) is required when uploading CMS images for accessibility.',
      });
    }

    const mediaId = randomUUID();
    const folder = normalizeCmsMediaFolder(params.folder);
    const normalizedTags = normalizeCmsMediaTags(params.tags);
    const baseName = (params.originalName || `asset.${processed.ext}`)
      .replace(/[/\\]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .slice(0, 100);
    const filename = `${mediaId}.${processed.ext}`;
    const storageKey = `cms-media/${folder}/${filename}`;
    const publicUrl = `/api/v1/public/content/media/${mediaId}/file`;

    await this.storageService.uploadPlatformAsset(storageKey, processed.primaryBuffer, {
      contentType: processed.verifiedMime,
      originalName: baseName || filename,
      size: processed.primaryBuffer.length,
    });

    const variantsMap: Partial<Record<CmsMediaVariantKey, CmsMediaVariantDto>> = {};
    for (const v of processed.variants) {
      const variantKey = `cms-media/${folder}/${mediaId}-${v.key}.${v.ext}`;
      await this.storageService.uploadPlatformAsset(variantKey, v.buffer, {
        contentType: v.mimeType,
        originalName: `${mediaId}-${v.key}.${v.ext}`,
        size: v.buffer.length,
      });
      variantsMap[v.key] = {
        key: v.key,
        storageKey: variantKey,
        publicUrl: `${publicUrl}?variant=${v.key}`,
        mimeType: v.mimeType,
        sizeBytes: v.buffer.length,
        width: v.width ?? null,
        height: v.height ?? null,
      };
    }

    const created = await this.db.cmsMedia.create({
      data: {
        id: mediaId,
        filename,
        originalName: baseName || filename,
        mimeType: processed.verifiedMime,
        sizeBytes: processed.primaryBuffer.length,
        storageKey,
        publicUrl,
        width: processed.width,
        height: processed.height,
        altEn,
        altBn,
        captionEn: params.captionEn?.trim() ? params.captionEn.trim().slice(0, 500) : null,
        captionBn: params.captionBn?.trim() ? params.captionBn.trim().slice(0, 500) : null,
        folder,
        tags: normalizedTags,
        variantsJson: Object.keys(variantsMap).length > 0 ? (variantsMap as Prisma.InputJsonValue) : Prisma.JsonNull,
        exifStripped: processed.exifStripped,
        uploadedById: actor.id ?? null,
      },
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.media.uploaded',
      module: 'cms',
      recordId: created.id,
      reason: `Uploaded CMS media "${created.originalName}" to folder "${created.folder}"`,
      oldValue: null,
      newValue: {
        id: created.id,
        originalName: created.originalName,
        mimeType: created.mimeType,
        sizeBytes: created.sizeBytes,
        folder: created.folder,
        tags: normalizedTags,
        exifStripped: processed.exifStripped,
        variantKeys: Object.keys(variantsMap),
      },
    });

    return this.mapMediaDto(created);
  }

  async updateMediaMetadata(
    id: string,
    input: CmsUpdateMediaInput,
    actor: PlatformActorContext,
  ): Promise<CmsMediaDto> {
    assertCmsEditAllowed(actor);
    const existing = await this.db.cmsMedia.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`CMS media "${id}" not found.`);
    }

    const nextAltEn =
      input.altEn !== undefined ? (input.altEn?.trim() ? input.altEn.trim().slice(0, 300) : null) : existing.altEn;
    const nextAltBn =
      input.altBn !== undefined ? (input.altBn?.trim() ? input.altBn.trim().slice(0, 300) : null) : existing.altBn;
    if (existing.mimeType.startsWith('image/') && !nextAltEn && !nextAltBn) {
      throw new BadRequestException({
        code: 'CMS_MEDIA_ALT_REQUIRED',
        message: 'Alt text (English or Bengali) cannot be cleared on CMS image assets.',
      });
    }

    const nextTags = input.tags !== undefined ? normalizeCmsMediaTags(input.tags) : existing.tags;

    const updated = await this.db.cmsMedia.update({
      where: { id },
      data: {
        altEn: nextAltEn,
        altBn: nextAltBn,
        captionEn:
          input.captionEn !== undefined
            ? (input.captionEn?.trim() ? input.captionEn.trim().slice(0, 500) : null)
            : existing.captionEn,
        captionBn:
          input.captionBn !== undefined
            ? (input.captionBn?.trim() ? input.captionBn.trim().slice(0, 500) : null)
            : existing.captionBn,
        folder: input.folder !== undefined ? normalizeCmsMediaFolder(input.folder) : existing.folder,
        ...(input.tags !== undefined ? { tags: nextTags } : {}),
      },
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.media.updated',
      module: 'cms',
      recordId: id,
      reason: `Updated CMS media metadata for "${existing.originalName}"`,
      oldValue: {
        altEn: existing.altEn,
        altBn: existing.altBn,
        captionEn: existing.captionEn,
        captionBn: existing.captionBn,
        folder: existing.folder,
        tags: existing.tags ?? [],
      },
      newValue: {
        altEn: updated.altEn,
        altBn: updated.altBn,
        captionEn: updated.captionEn,
        captionBn: updated.captionBn,
        folder: updated.folder,
        tags: updated.tags ?? [],
      },
    });

    return this.mapMediaDto(updated);
  }

  async getMediaUsage(mediaId: string): Promise<CmsMediaUsageDto> {
    const existing = await this.db.cmsMedia.findUnique({ where: { id: mediaId } });
    if (!existing) {
      throw new NotFoundException(`CMS media "${mediaId}" not found.`);
    }

    const mediaPathNeedle = `/media/${mediaId}/file`;
    const pageUsages: CmsMediaUsageDto['pages'] = [];
    const postUsages: CmsMediaUsageDto['posts'] = [];
    const authorUsages: CmsMediaUsageDto['authors'] = [];
    const settingUsages: CmsMediaUsageDto['settings'] = [];

    // 1. Scan active CMS pages (both published versions and latest drafts)
    if (this.db.cmsPage && this.db.cmsPageVersion) {
      const pages = await this.db.cmsPage.findMany({
        where: { deletedAt: null, status: { not: 'trashed' } },
        include: { locales: true },
      });
      const versionIds = Array.from(
        new Set(
          pages.flatMap((p) => [
            ...(p.currentPublishedVersionId ? [p.currentPublishedVersionId] : []),
            ...p.locales.flatMap((l) => [
              ...(l.currentPublishedVersionId ? [l.currentPublishedVersionId] : []),
              ...(l.currentDraftVersionId ? [l.currentDraftVersionId] : []),
            ]),
          ]),
        ),
      );
      const versions =
        versionIds.length > 0
          ? await this.db.cmsPageVersion.findMany({
            where: { id: { in: versionIds } },
          })
          : [];
      const verById = new Map(versions.map((v) => [v.id, v]));

      const seenPageEntries = new Set<string>();
      for (const page of pages) {
        const inspectVersion = (
          verId: string | null | undefined,
          isPublishedVersion: boolean,
        ) => {
          if (!verId) return;
          const ver = verById.get(verId);
          if (!ver) return;

          const locations: string[] = [];
          if (ver.ogImageUrl && (ver.ogImageUrl.includes(mediaPathNeedle) || ver.ogImageUrl.includes(mediaId))) {
            locations.push('SEO Social Image');
          }
          const blockRefs: Array<{ blockId: string; blockType: string; field: string }> = [];
          collectMediaReferencesFromBlocks(
            Array.isArray(ver.blocks) ? ver.blocks : [],
            mediaId,
            blockRefs,
          );
          for (const br of blockRefs) {
            locations.push(`Block (${br.blockType})`);
          }

          if (locations.length === 0) return;
          const dedupKey = `${page.id}:${ver.locale}:${isPublishedVersion ? 'pub' : 'draft'}`;
          if (seenPageEntries.has(dedupKey)) return;
          seenPageEntries.add(dedupKey);

          const isLivePublished = page.status === 'published' && isPublishedVersion;
          pageUsages.push({
            pageId: page.id,
            slug: page.slug,
            title: ver.title || `/${page.slug}`,
            status: page.status,
            locale: ver.locale,
            location: Array.from(new Set(locations)).join(', '),
            isPublished: isLivePublished,
          });
        };

        inspectVersion(page.currentPublishedVersionId, true);
        for (const loc of page.locales) {
          inspectVersion(loc.currentPublishedVersionId, true);
          inspectVersion(loc.currentDraftVersionId, false);
        }
      }
    }

    // 2. Scan active Blog Posts
    if (this.db.cmsPost) {
      const posts = await this.db.cmsPost.findMany({
        where: { deletedAt: null, status: { not: 'trashed' } },
      });
      for (const post of posts) {
        const locs: string[] = [];
        if (post.coverMediaId === mediaId) locs.push('Cover Image');
        if (post.bodyHtmlEn?.includes(mediaPathNeedle)) locs.push('Body (EN)');
        if (post.bodyHtmlBn?.includes(mediaPathNeedle)) locs.push('Body (BN)');
        if (locs.length === 0) continue;

        postUsages.push({
          postId: post.id,
          slug: post.slug,
          title: post.titleEn,
          status: post.status,
          location: locs.join(', '),
          isPublished: post.status === 'published',
        });
      }
    }

    // 3. Scan Author Avatars
    if (this.db.cmsAuthor) {
      const authors = await this.db.cmsAuthor.findMany({
        where: { avatarMediaId: mediaId },
        select: { id: true, slug: true, displayName: true },
      });
      for (const a of authors) {
        authorUsages.push({
          authorId: a.id,
          slug: a.slug,
          displayName: a.displayName,
        });
      }
    }

    // 4. Scan Site Settings
    if (this.db.cmsSiteSetting?.findMany) {
      const settings = await this.db.cmsSiteSetting.findMany();
      for (const s of settings) {
        const serialized = JSON.stringify(s.valueJson ?? {});
        if (serialized.includes(mediaPathNeedle) || serialized.includes(mediaId)) {
          settingUsages.push({ key: s.key });
        }
      }
    }

    const totalReferences =
      pageUsages.length + postUsages.length + authorUsages.length + settingUsages.length;
    const publishedReferencesCount =
      pageUsages.filter((p) => p.isPublished).length +
      postUsages.filter((p) => p.isPublished).length;
    const deletionBlocked = publishedReferencesCount > 0;

    let warningMessage: string | null = null;
    if (deletionBlocked) {
      warningMessage = `Deletion blocked: this file is currently used on ${publishedReferencesCount} published page(s)/post(s). Unpublish or remove it from live content first.`;
    } else if (totalReferences > 0) {
      warningMessage = `Used in ${totalReferences} draft/unpublished item(s). Deleting it will leave broken media references there.`;
    }

    return {
      mediaId,
      totalReferences,
      publishedReferencesCount,
      deletionBlocked,
      warningMessage,
      pages: pageUsages,
      posts: postUsages,
      authors: authorUsages,
      settings: settingUsages,
    };
  }

  async deleteMedia(
    id: string,
    actor: PlatformActorContext,
    options?: { forceDraftUnlink?: boolean },
  ): Promise<{ id: string; deleted: true }> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsMedia.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`CMS media "${id}" not found.`);
    }

    const usage = await this.getMediaUsage(id);
    if (usage.deletionBlocked) {
      throw new ConflictException({
        code: 'CMS_MEDIA_IN_USE_BY_PUBLISHED',
        message:
          usage.warningMessage ||
          `Cannot delete "${existing.originalName}" because it is used on a published page.`,
        details: usage,
      });
    }
    if (usage.totalReferences > 0 && !options?.forceDraftUnlink) {
      throw new BadRequestException({
        code: 'CMS_MEDIA_IN_USE_WARNING',
        message:
          usage.warningMessage ||
          `"${existing.originalName}" is referenced in ${usage.totalReferences} draft item(s). Confirm force delete to remove anyway.`,
        details: usage,
      });
    }

    await this.db.cmsMedia.delete({ where: { id } });
    if (this.storageService) {
      const keysToDelete = [existing.storageKey];
      const variants = existing.variantsJson as
        | Partial<Record<CmsMediaVariantKey, CmsMediaVariantDto>>
        | null
        | undefined;
      if (variants && typeof variants === 'object') {
        for (const variant of Object.values(variants)) {
          if (variant?.storageKey) {
            keysToDelete.push(variant.storageKey);
          }
        }
      }
      for (const key of keysToDelete) {
        try {
          await this.storageService.delete(key);
        } catch {
          // Storage object cleanup is best-effort after DB metadata removal
        }
      }
    }

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.media.deleted',
      module: 'cms',
      recordId: id,
      reason: `Deleted CMS media "${existing.originalName}"`,
      oldValue: {
        id: existing.id,
        originalName: existing.originalName,
        storageKey: existing.storageKey,
      },
      newValue: null,
    });

    return { id, deleted: true };
  }

  async getPublicMediaFile(
    id: string,
    variantKey?: CmsMediaVariantKey,
  ): Promise<{
    media: CmsMediaDto;
    buffer: Buffer;
    mimeType: string;
  }> {
    if (!this.storageService) {
      throw new ServiceUnavailableException('Storage service unavailable.');
    }

    const media = await this.db.cmsMedia.findUnique({ where: { id } });
    if (!media || media.deletedAt) {
      throw new NotFoundException(`CMS media "${id}" not found.`);
    }

    const variants = media.variantsJson as
      | Partial<Record<CmsMediaVariantKey, CmsMediaVariantDto>>
      | null
      | undefined;
    const requestedVariant =
      variantKey && variants && variants[variantKey] ? variants[variantKey] : undefined;

    const targetKey = requestedVariant?.storageKey || media.storageKey;
    const targetMime = requestedVariant?.mimeType || media.mimeType;

    const exists = await this.storageService.exists(targetKey);
    if (!exists) {
      throw new NotFoundException(`CMS media file "${id}" not found in storage.`);
    }

    const { buffer } = await this.storageService.read(targetKey);
    return {
      media: this.mapMediaDto(media),
      buffer,
      mimeType: targetMime,
    };
  }

  private mapMediaDto(m: {
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    publicUrl: string;
    width: number | null;
    height: number | null;
    altEn: string | null;
    altBn: string | null;
    captionEn: string | null;
    captionBn: string | null;
    folder: string;
    tags?: string[] | null;
    variantsJson?: unknown;
    exifStripped?: boolean | null;
    uploadedById: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): CmsMediaDto {
    const rawVariants =
      m.variantsJson && typeof m.variantsJson === 'object'
        ? (m.variantsJson as Partial<Record<CmsMediaVariantKey, CmsMediaVariantDto>>)
        : null;
    return {
      id: m.id,
      filename: m.filename,
      originalName: m.originalName,
      mimeType: m.mimeType,
      sizeBytes: m.sizeBytes,
      storageKey: m.storageKey,
      publicUrl: m.publicUrl,
      width: m.width ?? null,
      height: m.height ?? null,
      altEn: m.altEn ?? null,
      altBn: m.altBn ?? null,
      captionEn: m.captionEn ?? null,
      captionBn: m.captionBn ?? null,
      folder: m.folder,
      tags: Array.isArray(m.tags) ? m.tags : [],
      exifStripped: m.exifStripped ?? false,
      variants: rawVariants,
      uploadedById: m.uploadedById ?? null,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }

  // =========================================================================
  // FAQ Library CRUD & Public API (Stage J.1 Structured Data Feed)
  // =========================================================================

  private normalizeFaqCategory(raw?: string | null): string {
    const cleaned = (raw || 'general')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return cleaned || 'general';
  }

  private mapFaqDto(f: {
    id: string;
    category: string;
    pageSlug: string | null;
    questionEn: string;
    answerEn: string;
    answerJsonEn?: unknown;
    questionBn: string | null;
    answerBn: string | null;
    answerJsonBn?: unknown;
    isBnTranslated: boolean;
    sortOrder: number;
    isPublished: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }): CmsFaqDto {
    return {
      id: f.id,
      category: f.category,
      pageSlug: f.pageSlug ?? null,
      questionEn: f.questionEn,
      answerEn: f.answerEn,
      answerJsonEn: (f.answerJsonEn ?? {}) as Record<string, unknown>,
      questionBn: f.questionBn ?? null,
      answerBn: f.answerBn ?? null,
      answerJsonBn: (f.answerJsonBn as Record<string, unknown> | null) ?? null,
      isBnTranslated: f.isBnTranslated,
      sortOrder: f.sortOrder,
      isPublished: f.isPublished,
      createdAt: f.createdAt?.toISOString(),
      updatedAt: f.updatedAt?.toISOString(),
    };
  }

  async listFaqs(filters?: {
    category?: string;
    pageSlug?: string;
    search?: string;
    isPublished?: boolean;
  }): Promise<CmsFaqDto[]> {
    const where: Prisma.CmsFaqWhereInput = {};
    if (filters?.category && filters.category !== 'all') {
      where.category = filters.category.trim().toLowerCase();
    }
    if (filters?.pageSlug && filters.pageSlug !== 'all') {
      where.pageSlug = filters.pageSlug.trim().toLowerCase();
    }
    if (filters?.isPublished !== undefined) {
      where.isPublished = filters.isPublished;
    }
    if (filters?.search?.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { questionEn: { contains: q, mode: 'insensitive' } },
        { questionBn: { contains: q, mode: 'insensitive' } },
        { answerEn: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await this.db.cmsFaq.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return rows.map((f) => this.mapFaqDto(f));
  }

  async createFaq(
    input: {
      category: string;
      pageSlug?: string | null;
      questionEn: string;
      answerEn: string;
      answerJsonEn?: Record<string, unknown>;
      questionBn?: string | null;
      answerBn?: string | null;
      answerJsonBn?: Record<string, unknown> | null;
      isBnTranslated?: boolean;
      sortOrder?: number;
      isPublished?: boolean;
    },
    actor: PlatformActorContext,
  ): Promise<CmsFaqDto> {
    assertCmsEditAllowed(actor);
    if (input.isPublished) {
      assertCmsPublishAllowed(actor);
    }

    const cleanAnswerEn = sanitizeCmsRichTextHtml(input.answerEn);
    const cleanAnswerBn = input.answerBn ? sanitizeCmsRichTextHtml(input.answerBn) : null;
    const isBn = Boolean(input.isBnTranslated && input.questionBn?.trim() && cleanAnswerBn);

    const created = await this.db.cmsFaq.create({
      data: {
        category: this.normalizeFaqCategory(input.category),
        pageSlug: input.pageSlug?.trim() ? input.pageSlug.trim().toLowerCase() : null,
        questionEn: input.questionEn.trim(),
        answerEn: cleanAnswerEn,
        answerJsonEn: (input.answerJsonEn ?? {}) as Prisma.InputJsonValue,
        questionBn: input.questionBn?.trim() || null,
        answerBn: cleanAnswerBn,
        answerJsonBn: input.answerJsonBn ? (input.answerJsonBn as Prisma.InputJsonValue) : undefined,
        isBnTranslated: isBn,
        sortOrder: input.sortOrder ?? 0,
        isPublished: Boolean(input.isPublished),
      },
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.faq_created',
      module: 'cms',
      recordId: created.id,
      oldValue: null,
      newValue: {
        category: created.category,
        questionEn: created.questionEn,
        isPublished: created.isPublished,
      },
    });
    return this.mapFaqDto(created);
  }

  async updateFaq(
    faqId: string,
    input: Partial<{
      category: string;
      pageSlug: string | null;
      questionEn: string;
      answerEn: string;
      answerJsonEn: Record<string, unknown>;
      questionBn: string | null;
      answerBn: string | null;
      answerJsonBn: Record<string, unknown> | null;
      isBnTranslated: boolean;
      sortOrder: number;
      isPublished: boolean;
    }>,
    actor: PlatformActorContext,
  ): Promise<CmsFaqDto> {
    assertCmsEditAllowed(actor);
    const existing = await this.db.cmsFaq.findUnique({ where: { id: faqId } });
    if (!existing) {
      throw new NotFoundException(`FAQ item "${faqId}" not found.`);
    }
    if (input.isPublished !== undefined && input.isPublished !== existing.isPublished) {
      assertCmsPublishAllowed(actor);
    }

    const cleanAnswerEn =
      input.answerEn !== undefined ? sanitizeCmsRichTextHtml(input.answerEn) : undefined;
    const cleanAnswerBn =
      input.answerBn !== undefined
        ? input.answerBn
          ? sanitizeCmsRichTextHtml(input.answerBn)
          : null
        : undefined;

    const beforeState = {
      category: existing.category,
      questionEn: existing.questionEn,
      isPublished: existing.isPublished,
    };

    const updated = await this.db.cmsFaq.update({
      where: { id: faqId },
      data: {
        ...(input.category !== undefined
          ? { category: this.normalizeFaqCategory(input.category) }
          : {}),
        ...(input.pageSlug !== undefined
          ? { pageSlug: input.pageSlug?.trim() ? input.pageSlug.trim().toLowerCase() : null }
          : {}),
        ...(input.questionEn !== undefined ? { questionEn: input.questionEn.trim() } : {}),
        ...(cleanAnswerEn !== undefined ? { answerEn: cleanAnswerEn } : {}),
        ...(input.answerJsonEn !== undefined
          ? { answerJsonEn: input.answerJsonEn as Prisma.InputJsonValue }
          : {}),
        ...(input.questionBn !== undefined ? { questionBn: input.questionBn?.trim() || null } : {}),
        ...(cleanAnswerBn !== undefined ? { answerBn: cleanAnswerBn } : {}),
        ...(input.answerJsonBn !== undefined
          ? {
              answerJsonBn: input.answerJsonBn
                ? (input.answerJsonBn as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            }
          : {}),
        ...(input.isBnTranslated !== undefined ? { isBnTranslated: input.isBnTranslated } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
      },
    });

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.faq_updated',
      module: 'cms',
      recordId: faqId,
      oldValue: beforeState,
      newValue: {
        category: updated.category,
        questionEn: updated.questionEn,
        isPublished: updated.isPublished,
      },
    });
    return this.mapFaqDto(updated);
  }

  async deleteFaq(
    faqId: string,
    actor: PlatformActorContext,
  ): Promise<{ id: string; deleted: true }> {
    assertCmsPublishAllowed(actor);
    const existing = await this.db.cmsFaq.findUnique({ where: { id: faqId } });
    if (!existing) {
      throw new NotFoundException(`FAQ item "${faqId}" not found.`);
    }
    await this.db.cmsFaq.delete({ where: { id: faqId } });
    await this.platformAudit.log({
      userId: actor.id ?? null,
      action: 'cms.faq_deleted',
      module: 'cms',
      recordId: faqId,
      reason: `Deleted FAQ item "${existing.questionEn}" (${existing.category})`,
      oldValue: { category: existing.category, questionEn: existing.questionEn },
      newValue: null,
    });
    this.triggerRevalidate({ scopes: ['cms-faqs'] });
    return { id: faqId, deleted: true };
  }

  async listPublicFaqs(filters?: {
    locale?: string;
    category?: string;
    pageSlug?: string;
    ids?: string[];
    limit?: number;
  }): Promise<CmsPublicFaqDto[]> {
    const locale = assertValidCmsLocale(filters?.locale ?? 'en');
    const cleanIds = Array.from(
      new Set((filters?.ids ?? []).map((id) => id.trim()).filter(Boolean)),
    );
    const limit = Math.min(50, Math.max(1, filters?.limit ?? 50));

    const where: Prisma.CmsFaqWhereInput = {
      isPublished: true,
      ...(cleanIds.length > 0
        ? { id: { in: cleanIds } }
        : {
            ...(filters?.category && filters.category !== 'all'
              ? { category: filters.category.trim().toLowerCase() }
              : {}),
            ...(filters?.pageSlug
              ? { pageSlug: filters.pageSlug.trim().toLowerCase() }
              : {}),
          }),
    };

    const rows = await this.db.cmsFaq.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      ...(cleanIds.length === 0 ? { take: limit } : {}),
    });

    const ordered =
      cleanIds.length > 0
        ? cleanIds
            .map((id) => rows.find((r) => r.id === id))
            .filter((r): r is NonNullable<typeof r> => Boolean(r))
            .slice(0, limit)
        : rows;

    return ordered.map((f) => {
      const canServeBn = locale === 'bn' && f.isBnTranslated && Boolean(f.questionBn && f.answerBn);
      return {
        id: f.id,
        category: f.category,
        pageSlug: f.pageSlug ?? null,
        questionEn: f.questionEn,
        answerEn: f.answerEn,
        questionBn: f.questionBn ?? null,
        answerBn: f.answerBn ?? null,
        isBnTranslated: f.isBnTranslated,
        resolvedLocale: canServeBn ? 'bn' : 'en',
        fallbackUsed: locale === 'bn' && !canServeBn,
        sortOrder: f.sortOrder,
      };
    });
  }
}
