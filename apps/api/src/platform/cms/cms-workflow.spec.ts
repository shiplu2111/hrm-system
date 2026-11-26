import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PLATFORM_PERMISSION_DEFINITIONS } from '@hrm/shared-types';
import { DEFAULT_PLATFORM_ROLES } from '../staff/platform-staff.service';
import {
  assertCmsLegalApprovalSatisfied,
  assertCmsPublishAllowed,
  buildCmsETag,
  isIfNoneMatchHit,
  parseScheduledDateInTimezone,
} from './cms.utils';
import { signCmsPreviewToken, verifyCmsPreviewToken } from './cms-preview.token';
import { PlatformCmsService } from './platform-cms.service';
import { PublicContentController } from './public-content.controller';

describe('CMS Roles, Workflow, Legal Approval, Scheduling, Preview & Public APIs', () => {
  const editorActor = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'editor@cmsnbd.com',
    roleName: 'Content Editor',
    timezone: 'Asia/Dhaka',
  };
  const publisherActor = {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'publisher@cmsnbd.com',
    roleName: 'Content Publisher',
    timezone: 'Asia/Dhaka',
  };
  const secondPublisherActor = {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'chief.publisher@cmsnbd.com',
    roleName: 'Content Publisher',
    timezone: 'America/New_York',
  };

  function createInMemoryCmsHarness() {
    const pages = new Map<string, any>();
    const pageLocales: any[] = [];
    const pageVersions = new Map<string, any>();
    const posts = new Map<string, any>();
    const changelogEntries = new Map<string, any>();
    const careers = new Map<string, any>();
    const faqs = new Map<string, any>();
    const postCategories = new Map<string, any>();
    const authors = new Map<string, any>();
    const menuItems = new Map<string, any>();
    const redirects = new Map<string, any>();
    const siteSettings = new Map<string, any>();
    const auditLogs: any[] = [];
    let seq = 1;
    const nextUuid = () => {
      const n = String(seq++).padStart(12, '0');
      return `00000000-0000-4000-8000-${n}`;
    };

    const txClient: any = {
      cmsPage: {
        findUnique: jest.fn(async ({ where, include }: any) => {
          const row = where.id
            ? pages.get(where.id)
            : Array.from(pages.values()).find((p) => p.slug === where.slug);
          if (!row) return null;
          return {
            ...row,
            ...(include?.locales
              ? { locales: pageLocales.filter((l) => l.pageId === row.id) }
              : {}),
            ...(include?.versions
              ? {
                versions: Array.from(pageVersions.values()).filter(
                  (v) => v.pageId === row.id,
                ),
              }
              : {}),
          };
        }),
        findUniqueOrThrow: jest.fn(async (args: any) => {
          const res = await txClient.cmsPage.findUnique(args);
          if (!res) throw new Error('Not found');
          return res;
        }),
        findFirst: jest.fn(async ({ where, include }: any) => {
          const match = Array.from(pages.values()).find((p) => {
            if (where.slug && p.slug !== where.slug) return false;
            if (where.status && p.status !== where.status) return false;
            if (where.deletedAt === null && p.deletedAt !== null) return false;
            return true;
          });
          if (!match) return null;
          return {
            ...match,
            ...(include?.locales
              ? { locales: pageLocales.filter((l) => l.pageId === match.id) }
              : {}),
          };
        }),
        findMany: jest.fn(async ({ where, include }: any) => {
          return Array.from(pages.values())
            .filter((p) => {
              if (where?.id?.not && p.id === where.id.not) return false;
              if (where?.kind && p.kind !== where.kind) return false;
              if (where?.deletedAt === null && p.deletedAt !== null) return false;
              if (where?.deletedAt?.lte && (!p.deletedAt || p.deletedAt > where.deletedAt.lte))
                return false;
              if (where?.scheduledAt?.lte && (!p.scheduledAt || p.scheduledAt > where.scheduledAt.lte))
                return false;
              if (where?.status?.in && !where.status.in.includes(p.status)) return false;
              if (where?.status?.not && p.status === where.status.not) return false;
              if (typeof where?.status === 'string' && p.status !== where.status) return false;
              if (where?.locked !== undefined && p.locked !== where.locked) return false;
              return true;
            })
            .map((p) => ({
              ...p,
              ...(include?.locales
                ? { locales: pageLocales.filter((l) => l.pageId === p.id) }
                : {}),
            }));
        }),
        create: jest.fn(async ({ data }: any) => {
          const now = new Date();
          const row = {
            id: nextUuid(),
            kind: data.kind ?? 'custom',
            slug: data.slug,
            status: data.status ?? 'draft',
            locked: data.locked ?? false,
            requiresApproval: data.requiresApproval ?? false,
            approvalStatus: data.approvalStatus ?? 'none',
            pendingApprovalVersionId: null,
            submittedForApprovalById: null,
            submittedForApprovalAt: null,
            submissionNote: null,
            approvedById: null,
            approvedAt: null,
            approvalNote: null,
            rejectedById: null,
            rejectedAt: null,
            rejectionReason: null,
            scheduledAt: data.scheduledAt ?? null,
            scheduledTimezone: data.scheduledTimezone ?? null,
            scheduledById: data.scheduledById ?? null,
            publishedAt: data.publishedAt ?? null,
            currentPublishedVersionId: data.currentPublishedVersionId ?? null,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
          };
          pages.set(row.id, row);
          return row;
        }),
        update: jest.fn(async ({ where, data, include }: any) => {
          const existing = pages.get(where.id);
          if (!existing) throw new Error(`Page ${where.id} not found`);
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          pages.set(where.id, updated);
          return {
            ...updated,
            ...(include?.locales
              ? { locales: pageLocales.filter((l) => l.pageId === updated.id) }
              : {}),
          };
        }),
        delete: jest.fn(async ({ where }: any) => {
          const existing = pages.get(where.id);
          pages.delete(where.id);
          return existing;
        }),
      },
      cmsPageLocale: {
        createMany: jest.fn(async ({ data }: any) => {
          const now = new Date();
          for (const d of data) {
            pageLocales.push({
              id: nextUuid(),
              isTranslated: false,
              translationStatus: 'untranslated',
              currentDraftVersionId: null,
              currentPublishedVersionId: null,
              createdAt: now,
              updatedAt: now,
              ...d,
            });
          }
        }),
        upsert: jest.fn(async ({ where, create, update }: any) => {
          const existingIdx = pageLocales.findIndex(
            (l) =>
              l.pageId === where.pageId_locale.pageId &&
              l.locale === where.pageId_locale.locale,
          );
          const now = new Date();
          if (existingIdx >= 0) {
            pageLocales[existingIdx] = {
              ...pageLocales[existingIdx],
              ...update,
              updatedAt: now,
            };
            return pageLocales[existingIdx];
          }
          const created = {
            id: nextUuid(),
            currentDraftVersionId: null,
            currentPublishedVersionId: null,
            createdAt: now,
            updatedAt: now,
            ...create,
          };
          pageLocales.push(created);
          return created;
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          let count = 0;
          for (let i = 0; i < pageLocales.length; i++) {
            if (!where?.pageId || pageLocales[i].pageId === where.pageId) {
              pageLocales[i] = { ...pageLocales[i], ...data };
              count++;
            }
          }
          return { count };
        }),
        deleteMany: jest.fn(async ({ where }: any) => {
          let count = 0;
          for (let i = pageLocales.length - 1; i >= 0; i--) {
            if (!where?.pageId || pageLocales[i].pageId === where.pageId) {
              pageLocales.splice(i, 1);
              count++;
            }
          }
          return { count };
        }),
      },
      cmsPageVersion: {
        findFirst: jest.fn(async ({ where, orderBy }: any) => {
          const matches = Array.from(pageVersions.values()).filter((v) => {
            if (where.id && v.id !== where.id) return false;
            if (where.pageId && v.pageId !== where.pageId) return false;
            if (where.locale && v.locale !== where.locale) return false;
            return true;
          });
          if (orderBy?.versionNumber === 'desc') {
            matches.sort((a, b) => b.versionNumber - a.versionNumber);
          }
          return matches[0] ?? null;
        }),
        findMany: jest.fn(async ({ where }: any) => {
          return Array.from(pageVersions.values()).filter((v) => {
            if (where?.id?.in && !where.id.in.includes(v.id)) return false;
            if (where?.pageId && v.pageId !== where.pageId) return false;
            return true;
          });
        }),
        create: jest.fn(async ({ data }: any) => {
          const row = {
            id: nextUuid(),
            createdAt: new Date(),
            ...data,
          };
          pageVersions.set(row.id, row);
          return row;
        }),
        deleteMany: jest.fn(async ({ where }: any) => {
          let count = 0;
          for (const [id, v] of pageVersions.entries()) {
            if (!where?.pageId || v.pageId === where.pageId) {
              pageVersions.delete(id);
              count++;
            }
          }
          return { count };
        }),
      },
      cmsMenuItem: {
        findMany: jest.fn(async () => Array.from(menuItems.values())),
        updateMany: jest.fn(async ({ where, data }: any) => {
          let count = 0;
          for (const [id, item] of menuItems.entries()) {
            if (where?.targetPageId && item.targetPageId === where.targetPageId) {
              menuItems.set(id, { ...item, ...data });
              count++;
            }
          }
          return { count };
        }),
        deleteMany: jest.fn(async ({ where }: any) => {
          let count = 0;
          if (where?.id?.in) {
            for (const id of where.id.in) {
              if (menuItems.delete(id)) count++;
            }
          }
          return { count };
        }),
      },
      cmsRedirect: {
        findFirst: jest.fn(async ({ where }: any) => {
          return (
            Array.from(redirects.values()).find(
              (r) =>
                (!where?.sourcePath || r.sourcePath === where.sourcePath) &&
                (where?.isActive === undefined || r.isActive === where.isActive),
            ) ?? null
          );
        }),
        upsert: jest.fn(async ({ where, create, update }: any) => {
          const existing = redirects.get(where.sourcePath);
          if (existing) {
            const next = { ...existing, ...update, updatedAt: new Date() };
            redirects.set(where.sourcePath, next);
            return next;
          }
          const created = { id: nextUuid(), createdAt: new Date(), updatedAt: new Date(), ...create };
          redirects.set(where.sourcePath, created);
          return created;
        }),
      },
      cmsSiteSetting: {
        findUnique: jest.fn(async ({ where }: any) => siteSettings.get(where.key) ?? null),
        upsert: jest.fn(async ({ where, create, update }: any) => {
          const existing = siteSettings.get(where.key);
          const now = new Date();
          if (existing) {
            const next = { ...existing, ...update, updatedAt: now };
            siteSettings.set(where.key, next);
            return next;
          }
          const created = { id: nextUuid(), createdAt: now, updatedAt: now, ...create };
          siteSettings.set(where.key, created);
          return created;
        }),
      },
      cmsPostCategory: {
        findUnique: jest.fn(async ({ where }: any) => {
          const row = where.id
            ? postCategories.get(where.id)
            : Array.from(postCategories.values()).find((c) => c.slug === where.slug);
          if (!row) return null;
          const postCount = Array.from(posts.values()).filter((p) => p.categoryId === row.id).length;
          return { ...row, _count: { posts: postCount } };
        }),
        findMany: jest.fn(async ({ where }: any = {}) =>
          Array.from(postCategories.values())
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((c) => {
              const matchingPosts = Array.from(posts.values()).filter((p) => {
                if (p.categoryId !== c.id) return false;
                if (where?._count?.posts?.status && p.status !== where._count.posts.status) return false;
                return p.deletedAt === null;
              });
              return { ...c, _count: { posts: matchingPosts.length } };
            }),
        ),
        create: jest.fn(async ({ data }: any) => {
          const now = new Date();
          const row = { id: nextUuid(), createdAt: now, updatedAt: now, sortOrder: 0, ...data };
          postCategories.set(row.id, row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const existing = postCategories.get(where.id);
          const updated = { ...existing, ...data, updatedAt: new Date() };
          postCategories.set(where.id, updated);
          const postCount = Array.from(posts.values()).filter(
            (p) => p.categoryId === updated.id && !p.deletedAt,
          ).length;
          return { ...updated, _count: { posts: postCount } };
        }),
        delete: jest.fn(async ({ where }: any) => {
          const existing = postCategories.get(where.id);
          postCategories.delete(where.id);
          return existing;
        }),
      },
      cmsAuthor: {
        findUnique: jest.fn(async ({ where }: any) => {
          const row = where.id
            ? authors.get(where.id)
            : Array.from(authors.values()).find((a) => a.slug === where.slug);
          if (!row) return null;
          const postCount = Array.from(posts.values()).filter((p) => p.authorId === row.id).length;
          return { ...row, _count: { posts: postCount } };
        }),
        findMany: jest.fn(async () =>
          Array.from(authors.values()).map((a) => ({
            ...a,
            _count: {
              posts: Array.from(posts.values()).filter(
                (p) => p.authorId === a.id && !p.deletedAt,
              ).length,
            },
          })),
        ),
        create: jest.fn(async ({ data }: any) => {
          const now = new Date();
          const row = { id: nextUuid(), createdAt: now, updatedAt: now, isActive: true, ...data };
          authors.set(row.id, row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const existing = authors.get(where.id);
          const updated = { ...existing, ...data, updatedAt: new Date() };
          authors.set(where.id, updated);
          const postCount = Array.from(posts.values()).filter(
            (p) => p.authorId === updated.id && !p.deletedAt,
          ).length;
          return { ...updated, _count: { posts: postCount } };
        }),
        delete: jest.fn(async ({ where }: any) => {
          const existing = authors.get(where.id);
          authors.delete(where.id);
          return existing;
        }),
      },
      cmsPost: {
        findUnique: jest.fn(async ({ where, include }: any) => {
          const row = where.id
            ? posts.get(where.id)
            : Array.from(posts.values()).find((p) => p.slug === where.slug);
          if (!row) return null;
          return {
            ...row,
            ...(include?.category ? { category: postCategories.get(row.categoryId) ?? null } : {}),
            ...(include?.author ? { author: authors.get(row.authorId) ?? null } : {}),
            ...(include?.coverMedia ? { coverMedia: null } : {}),
          };
        }),
        findFirst: jest.fn(async ({ where, include }: any) => {
          const match = Array.from(posts.values()).find((p) => {
            if (where?.slug && p.slug !== where.slug) return false;
            if (where?.status && p.status !== where.status) return false;
            if (where?.deletedAt === null && p.deletedAt !== null) return false;
            return true;
          });
          if (!match) return null;
          return {
            ...match,
            ...(include?.category ? { category: postCategories.get(match.categoryId) ?? null } : {}),
            ...(include?.author ? { author: authors.get(match.authorId) ?? null } : {}),
            ...(include?.coverMedia ? { coverMedia: null } : {}),
          };
        }),
        findMany: jest.fn(async ({ where, include }: any = {}) => {
          return Array.from(posts.values())
            .filter((p) => {
              if (where?.id?.not && p.id === where.id.not) return false;
              if (where?.status && typeof where.status === 'string' && p.status !== where.status)
                return false;
              if (where?.deletedAt === null && p.deletedAt !== null) return false;
              if (where?.scheduledAt?.lte && (!p.scheduledAt || p.scheduledAt > where.scheduledAt.lte))
                return false;
              if (where?.categoryId && p.categoryId !== where.categoryId) return false;
              if (where?.authorId && p.authorId !== where.authorId) return false;
              if (where?.isBnTranslated !== undefined && p.isBnTranslated !== where.isBnTranslated)
                return false;
              if (where?.tags?.has && !(p.tags || []).includes(where.tags.has)) return false;
              if (where?.category?.slug) {
                const cat = postCategories.get(p.categoryId);
                if (!cat || cat.slug !== where.category.slug) return false;
              }
              return true;
            })
            .map((p) => ({
              ...p,
              ...(include?.category ? { category: postCategories.get(p.categoryId) ?? null } : {}),
              ...(include?.author ? { author: authors.get(p.authorId) ?? null } : {}),
              ...(include?.coverMedia ? { coverMedia: null } : {}),
            }));
        }),
        count: jest.fn(async ({ where }: any = {}) => {
          return Array.from(posts.values()).filter((p) => {
            if (where?.status && typeof where.status === 'string' && p.status !== where.status)
              return false;
            if (where?.deletedAt === null && p.deletedAt !== null) return false;
            if (where?.category?.slug) {
              const cat = postCategories.get(p.categoryId);
              if (!cat || cat.slug !== where.category.slug) return false;
            }
            return true;
          }).length;
        }),
        create: jest.fn(async ({ data, include }: any) => {
          const now = new Date();
          const row = {
            id: nextUuid(),
            status: 'draft',
            coverMediaId: null,
            coverAltEn: null,
            coverAltBn: null,
            titleBn: null,
            excerptBn: null,
            bodyJsonBn: null,
            bodyHtmlBn: null,
            seoTitleEn: null,
            seoDescriptionEn: null,
            seoTitleBn: null,
            seoDescriptionBn: null,
            tags: [],
            relatedPostIds: [],
            scheduledAt: null,
            scheduledTimezone: null,
            scheduledById: null,
            publishedAt: null,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
            ...data,
          };
          posts.set(row.id, row);
          return {
            ...row,
            ...(include?.category ? { category: postCategories.get(row.categoryId) ?? null } : {}),
            ...(include?.author ? { author: authors.get(row.authorId) ?? null } : {}),
            ...(include?.coverMedia ? { coverMedia: null } : {}),
          };
        }),
        update: jest.fn(async ({ where, data, include }: any) => {
          const existing = posts.get(where.id);
          const updated = { ...existing, ...data, updatedAt: new Date() };
          posts.set(where.id, updated);
          return {
            ...updated,
            ...(include?.category ? { category: postCategories.get(updated.categoryId) ?? null } : {}),
            ...(include?.author ? { author: authors.get(updated.authorId) ?? null } : {}),
            ...(include?.coverMedia ? { coverMedia: null } : {}),
          };
        }),
        delete: jest.fn(async ({ where }: any) => {
          const existing = posts.get(where.id);
          posts.delete(where.id);
          return existing;
        }),
      },
      cmsChangelogEntry: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.id) return changelogEntries.get(where.id) ?? null;
          return Array.from(changelogEntries.values()).find((c) => c.slug === where.slug) ?? null;
        }),
        findMany: jest.fn(async ({ where }: any = {}) =>
          Array.from(changelogEntries.values())
            .filter((c) => {
              if (where?.deletedAt === null && c.deletedAt !== null) return false;
              if (where?.deletedAt?.not === null && c.deletedAt === null) return false;
              if (where?.isPublished !== undefined && c.isPublished !== where.isPublished)
                return false;
              if (where?.tag && c.tag !== where.tag) return false;
              if (where?.scheduledAt?.lte && (!c.scheduledAt || c.scheduledAt > where.scheduledAt.lte))
                return false;
              return true;
            })
            .sort((a, b) => b.releaseDate.getTime() - a.releaseDate.getTime()),
        ),
        count: jest.fn(async ({ where }: any = {}) =>
          Array.from(changelogEntries.values()).filter((c) => {
            if (where?.deletedAt === null && c.deletedAt !== null) return false;
            if (where?.isPublished !== undefined && c.isPublished !== where.isPublished)
              return false;
            if (where?.tag && c.tag !== where.tag) return false;
            return true;
          }).length,
        ),
        create: jest.fn(async ({ data }: any) => {
          const now = new Date();
          const row = {
            id: nextUuid(),
            versionLabel: '',
            moduleRefs: null,
            summaryEn: '',
            bodyHtmlEn: '',
            bodyJsonEn: {},
            highlightsEn: [],
            titleBn: null,
            summaryBn: null,
            bodyHtmlBn: null,
            bodyJsonBn: null,
            highlightsBn: [],
            isBnTranslated: false,
            isPublished: false,
            scheduledAt: null,
            scheduledTimezone: null,
            scheduledById: null,
            publishedAt: null,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
            ...data,
          };
          changelogEntries.set(row.id, row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const existing = changelogEntries.get(where.id);
          const updated = { ...existing, ...data, updatedAt: new Date() };
          changelogEntries.set(where.id, updated);
          return updated;
        }),
        delete: jest.fn(async ({ where }: any) => {
          const existing = changelogEntries.get(where.id);
          changelogEntries.delete(where.id);
          return existing;
        }),
      },
      cmsCareer: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.id) return careers.get(where.id) ?? null;
          return Array.from(careers.values()).find((c) => c.slug === where.slug) ?? null;
        }),
        findFirst: jest.fn(async ({ where }: any) => {
          return (
            Array.from(careers.values()).find((c) => {
              if (where?.slug && c.slug !== where.slug) return false;
              if (where?.deletedAt === null && c.deletedAt !== null) return false;
              if (where?.status?.in && !where.status.in.includes(c.status)) return false;
              if (typeof where?.status === 'string' && c.status !== where.status) return false;
              return true;
            }) ?? null
          );
        }),
        findMany: jest.fn(async ({ where }: any = {}) =>
          Array.from(careers.values()).filter((c) => {
            if (where?.deletedAt === null && c.deletedAt !== null) return false;
            if (where?.status?.in && !where.status.in.includes(c.status)) return false;
            if (typeof where?.status === 'string' && c.status !== where.status) return false;
            return true;
          }),
        ),
        create: jest.fn(async ({ data }: any) => {
          const now = new Date();
          const row = {
            id: nextUuid(),
            status: 'draft',
            department: 'General',
            summaryEn: '',
            descriptionJsonEn: {},
            titleBn: null,
            summaryBn: null,
            descriptionHtmlBn: null,
            descriptionJsonBn: null,
            isBnTranslated: false,
            applyEmail: null,
            applyUrl: null,
            publishedAt: null,
            closesAt: null,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
            ...data,
          };
          careers.set(row.id, row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const existing = careers.get(where.id);
          const updated = { ...existing, ...data, updatedAt: new Date() };
          careers.set(where.id, updated);
          return updated;
        }),
        delete: jest.fn(async ({ where }: any) => {
          const existing = careers.get(where.id);
          careers.delete(where.id);
          return existing;
        }),
      },
      cmsFaq: {
        findUnique: jest.fn(async ({ where }: any) => faqs.get(where.id) ?? null),
        findMany: jest.fn(async ({ where }: any = {}) =>
          Array.from(faqs.values())
            .filter((f) => {
              if (where?.isPublished !== undefined && f.isPublished !== where.isPublished)
                return false;
              if (where?.category && f.category !== where.category) return false;
              if (where?.pageSlug && f.pageSlug !== where.pageSlug) return false;
              if (where?.id?.in && !where.id.in.includes(f.id)) return false;
              return true;
            })
            .sort((a, b) => a.category.localeCompare(b.category) || a.sortOrder - b.sortOrder),
        ),
        create: jest.fn(async ({ data }: any) => {
          const now = new Date();
          const row = {
            id: nextUuid(),
            pageSlug: null,
            answerJsonEn: {},
            questionBn: null,
            answerBn: null,
            answerJsonBn: null,
            isBnTranslated: false,
            sortOrder: 0,
            isPublished: false,
            createdAt: now,
            updatedAt: now,
            ...data,
          };
          faqs.set(row.id, row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const existing = faqs.get(where.id);
          const updated = { ...existing, ...data, updatedAt: new Date() };
          faqs.set(where.id, updated);
          return updated;
        }),
        delete: jest.fn(async ({ where }: any) => {
          const existing = faqs.get(where.id);
          faqs.delete(where.id);
          return existing;
        }),
      },
      $transaction: async (fn: (tx: any) => Promise<any>) => fn(txClient),
    };

    const prismaMock: any = { unscoped: txClient };
    const auditMock: any = {
      log: jest.fn(async (entry: any) => {
        auditLogs.push(entry);
      }),
    };

    const service = new PlatformCmsService(prismaMock, auditMock);
    return { service, auditLogs, pages, pageVersions, pageLocales, menuItems, redirects, siteSettings };
  }

  describe('Stage P.2 Platform Roles & Permissions', () => {
    it('registers cms permission definition andContent Editor / Content Publisher roles', () => {
      const cmsPermDef = PLATFORM_PERMISSION_DEFINITIONS.find((d) => d.key === 'cms');
      expect(cmsPermDef).toBeDefined();
      expect(cmsPermDef?.actions).toEqual(['view', 'create', 'edit', 'delete', 'manage', 'raw_html']);

      const editorRole = DEFAULT_PLATFORM_ROLES.find((r) => r.name === 'Content Editor');
      const publisherRole = DEFAULT_PLATFORM_ROLES.find((r) => r.name === 'Content Publisher');
      expect(editorRole).toBeDefined();
      expect(publisherRole).toBeDefined();

      expect(editorRole?.permissions).toEqual(
        expect.arrayContaining([
          { module: 'cms', action: 'view' },
          { module: 'cms', action: 'create' },
          { module: 'cms', action: 'edit' },
        ]),
      );
      expect(editorRole?.permissions.some((p) => p.action === 'manage' || p.action === 'delete')).toBe(
        false,
      );
      expect(publisherRole?.permissions).toEqual(
        expect.arrayContaining([
          { module: 'cms', action: 'manage' },
          { module: 'cms', action: 'delete' },
        ]),
      );
    });

    it('blocks Content Editor from publishing, scheduling, unpublishing, trashing, restoring, or approving', async () => {
      const { service } = createInMemoryCmsHarness();
      const page = await service.createCustomPage(
        { slug: 'product-tour', titleEn: 'Product Tour', blocksEn: [] },
        editorActor,
      );

      // Content Editor CAN save draft versions
      await expect(
        service.createPageVersion(
          page.id,
          { locale: 'en', title: 'Tour v2', blocks: [], publishImmediately: false },
          editorActor,
        ),
      ).resolves.toMatchObject({ versionNumber: 2 });

      // Content Editor CANNOT publishImmediately on version save
      await expect(
        service.createPageVersion(
          page.id,
          { locale: 'en', title: 'Tour v3', blocks: [], publishImmediately: true },
          editorActor,
        ),
      ).rejects.toThrow(ForbiddenException);

      // Content Editor CANNOT publish, schedule, unpublish, trash, restore, or approve
      await expect(service.publishPageNow(page.id, {}, editorActor)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        service.schedulePagePublish(page.id, { scheduledAt: '2099-05-01T10:00' }, editorActor),
      ).rejects.toThrow(ForbiddenException);
      await expect(service.unpublishPage(page.id, {}, editorActor)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.trashOrDeletePage(page.id, editorActor)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.restorePage(page.id, editorActor)).rejects.toThrow(ForbiddenException);
      await expect(service.approveLegalPage(page.id, {}, editorActor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(() =>
        assertCmsPublishAllowed({
          id: editorActor.id,
          roleName: 'Content Editor',
          permissions: [{ module: 'cms', action: 'manage' }],
        }),
      ).toThrow(ForbiddenException);
    });
  });

  describe('Full Page Lifecycle (Draft -> Version -> Preview -> Publish -> Unpublish -> Trash -> Restore) & Audit Logs', () => {
    it('tracks before and after state across every lifecycle transition', async () => {
      const { service, auditLogs } = createInMemoryCmsHarness();

      // 1. Draft creation
      const created = await service.createCustomPage(
        {
          slug: 'bangladesh-payroll',
          titleEn: 'Bangladesh Payroll Compliance',
          blocksEn: [{ id: 'h1', type: 'heading', props: { level: 1, text: 'BD Payroll', align: 'left' } }],
        },
        editorActor,
      );
      expect(created.status).toBe('draft');
      expect(await service.resolvePublishedPage('bangladesh-payroll', 'en')).toBeNull();

      // 2. Save new immutable draft version v2
      const v2 = await service.createPageVersion(
        created.id,
        {
          locale: 'en',
          title: 'Bangladesh Payroll Compliance v2',
          blocks: [{ id: 'h1', type: 'heading', props: { level: 1, text: 'BD Payroll v2', align: 'left' } }],
          changeNote: 'Updated headline',
        },
        editorActor,
      );
      expect(v2.versionNumber).toBe(2);

      // Still NOT reachable publicly without preview token
      expect(await service.resolvePublishedPage('bangladesh-payroll', 'en')).toBeNull();

      // 3. Preview token resolves v2 draft
      const previewToken = await service.createPagePreviewToken(
        created.id,
        { locale: 'en' },
        editorActor,
      );
      const preview = await service.resolvePreviewByToken(previewToken.token);
      expect(preview.isPreview).toBe(true);
      expect(preview.version.id).toBe(v2.id);
      expect(preview.version.title).toBe('Bangladesh Payroll Compliance v2');
      expect(preview.version.noIndex).toBe(true);

      // 4. Content Publisher publishes v2 now
      const published = await service.publishPageNow(
        created.id,
        { locale: 'en', note: 'Launch BD page' },
        publisherActor,
      );
      expect(published.status).toBe('published');
      expect(published.currentPublishedVersionId).toBe(v2.id);
      const live = await service.resolvePublishedPage('bangladesh-payroll', 'en');
      expect(live?.version.title).toBe('Bangladesh Payroll Compliance v2');

      // 5. Unpublish hides from public
      const unpublished = await service.unpublishPage(
        created.id,
        { reason: 'Campaign ended' },
        publisherActor,
      );
      expect(unpublished.status).toBe('unpublished');
      expect(await service.resolvePublishedPage('bangladesh-payroll', 'en')).toBeNull();

      // 6. Trash & Restore
      const trashed = await service.trashOrDeletePage(created.id, publisherActor, 'Archive campaign');
      expect(trashed.status).toBe('trashed');
      expect(trashed.deletedAt).not.toBeNull();

      const restored = await service.restorePage(created.id, publisherActor, 'Reopen campaign');
      expect(restored.status).toBe('draft');
      expect(restored.deletedAt).toBeNull();

      // Every audit entry records module='cms' with explicit before (oldValue) and after (newValue)
      const actions = auditLogs.map((l) => l.action);
      expect(actions).toEqual([
        'cms.page_created',
        'cms.page_version_created',
        'cms.preview_token_issued',
        'cms.page_published',
        'cms.page_unpublished',
        'cms.page_trashed',
        'cms.page_restored',
      ]);
      for (const entry of auditLogs) {
        expect(entry.module).toBe('cms');
        expect('oldValue' in entry).toBe(true);
        expect('newValue' in entry).toBe(true);
        expect(entry.newValue).toBeTruthy();
      }
      const unpubLog = auditLogs.find((l) => l.action === 'cms.page_unpublished');
      expect(unpubLog.oldValue.status).toBe('published');
      expect(unpubLog.newValue.status).toBe('unpublished');
    });
  });

  describe('Timezone-Aware Scheduling & Automated Publisher Job', () => {
    it('converts staff wall-clock datetime in IANA timezone to UTC and rejects DST gaps', () => {
      // Asia/Dhaka is UTC+06:00
      const dhaka = parseScheduledDateInTimezone('2026-12-01T15:00', 'Asia/Dhaka');
      expect(dhaka.timeZone).toBe('Asia/Dhaka');
      expect(dhaka.scheduledAtUtc.toISOString()).toBe('2026-12-01T09:00:00.000Z');

      // America/New_York EDT is UTC-04:00 in July
      const nySummer = parseScheduledDateInTimezone('2026-07-15T10:00', 'America/New_York');
      expect(nySummer.scheduledAtUtc.toISOString()).toBe('2026-07-15T14:00:00.000Z');

      // Spring-forward nonexistent hour 02:30 in America/New_York on 2026-03-08
      expect(() =>
        parseScheduledDateInTimezone('2026-03-08T02:30', 'America/New_York'),
      ).toThrow(BadRequestException);
    });

    it('schedules in staff timezone and publishes only once scheduled time is reached', async () => {
      const { service, auditLogs } = createInMemoryCmsHarness();
      const draft = await service.createCustomPage(
        { slug: 'q1-announcement', titleEn: 'Q1 Launch' },
        editorActor,
      );

      const nowBefore = new Date('2026-12-01T08:00:00.000Z');
      // 15:00 Asia/Dhaka == 09:00 UTC (1 hour in the future relative to nowBefore)
      const scheduled = await service.schedulePagePublish(
        draft.id,
        { scheduledAt: '2026-12-01T15:00', locale: 'en' },
        publisherActor, // publisherActor.timezone = 'Asia/Dhaka'
        nowBefore,
      );

      expect(scheduled.status).toBe('scheduled');
      expect(scheduled.scheduledAt).toBe('2026-12-01T09:00:00.000Z');
      expect(scheduled.scheduledTimezone).toBe('Asia/Dhaka');

      // Running job before 09:00 UTC does not publish
      const earlyRun = await service.processDueScheduledPublications(
        new Date('2026-12-01T08:59:59.000Z'),
      );
      expect(earlyRun.pagesPublished).toBe(0);
      expect(await service.resolvePublishedPage('q1-announcement', 'en')).toBeNull();

      // Running job at 09:00:00 UTC publishes atomically
      const dueRun = await service.processDueScheduledPublications(
        new Date('2026-12-01T09:00:00.000Z'),
      );
      expect(dueRun.pagesPublished).toBe(1);

      const live = await service.resolvePublishedPage('q1-announcement', 'en');
      expect(live?.status).toBe('published');
      expect(live?.version.title).toBe('Q1 Launch');

      const jobAudit = auditLogs.find((l) => l.action === 'cms.page_scheduled_published');
      expect(jobAudit?.oldValue.status).toBe('scheduled');
      expect(jobAudit?.newValue.status).toBe('published');
    });
  });

  describe('Legal Pages Stage F Four-Eyes Approval Flow', () => {
    it('blocks publishing/scheduling legal pages until approved by a distinct reviewer', async () => {
      const { service, pages, pageLocales, pageVersions } = createInMemoryCmsHarness();

      // Seed a legal page ('privacy') with v1 published and v2 draft
      const legalId = '44444444-4444-4444-8444-444444444444';
      const v1Id = '55555555-5555-4555-8555-555555555551';
      pages.set(legalId, {
        id: legalId,
        kind: 'system',
        slug: 'privacy',
        status: 'published',
        locked: true,
        requiresApproval: true,
        approvalStatus: 'none',
        pendingApprovalVersionId: null,
        submittedForApprovalById: null,
        submittedForApprovalAt: null,
        submissionNote: null,
        approvedById: null,
        approvedAt: null,
        approvalNote: null,
        rejectedById: null,
        rejectedAt: null,
        rejectionReason: null,
        scheduledAt: null,
        scheduledTimezone: null,
        scheduledById: null,
        publishedAt: new Date('2026-11-01T00:00:00Z'),
        currentPublishedVersionId: v1Id,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      pageVersions.set(v1Id, {
        id: v1Id,
        pageId: legalId,
        versionNumber: 1,
        locale: 'en',
        title: 'Privacy Policy v1',
        seoTitle: null,
        seoDescription: null,
        canonicalPath: '/privacy',
        ogImageUrl: null,
        noIndex: false,
        blocks: [],
        isTranslated: true,
        authorId: editorActor.id,
        authorName: editorActor.email,
        changeNote: 'Initial',
        createdAt: new Date(),
      });
      pageLocales.push({
        id: '66666666-6666-4666-8666-666666666661',
        pageId: legalId,
        locale: 'en',
        isTranslated: true,
        translationStatus: 'translated',
        currentDraftVersionId: v1Id,
        currentPublishedVersionId: v1Id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const v2 = await service.createPageVersion(
        legalId,
        { locale: 'en', title: 'Privacy Policy v2 (GDPR Update)', blocks: [] },
        publisherActor,
      );

      // Direct publish fails without Stage F approval
      await expect(
        service.publishPageNow(legalId, { locale: 'en', versionId: v2.id }, publisherActor),
      ).rejects.toThrow(ForbiddenException);

      // Publisher submits v2 for approval
      const pending = await service.submitPageForApproval(
        legalId,
        { locale: 'en', versionId: v2.id, note: 'Legal counsel reviewed Nov 2026' },
        publisherActor,
      );
      expect(pending.approvalStatus).toBe('pending_approval');

      // Four-eyes rule: submitter CANNOT approve their own legal submission
      await expect(
        service.approveLegalPage(legalId, { note: 'Self stamp' }, publisherActor),
      ).rejects.toThrow(ForbiddenException);

      // Distinct second publisher approves & publishes
      const approved = await service.approveLegalPage(
        legalId,
        { note: 'Approved by secondary legal reviewer', publishNow: true },
        secondPublisherActor,
      );
      expect(approved.approvalStatus).toBe('approved');
      expect(approved.currentPublishedVersionId).toBe(v2.id);

      // Saving a new draft v3 invalidates prior approval
      await service.createPageVersion(
        legalId,
        { locale: 'en', title: 'Privacy Policy v3 (Unreviewed edit)', blocks: [] },
        editorActor,
      );
      await expect(
        service.publishPageNow(legalId, { locale: 'en' }, secondPublisherActor),
      ).rejects.toThrow(ForbiddenException);

      expect(() =>
        assertCmsLegalApprovalSatisfied({
          slug: 'terms',
          requiresApproval: true,
          approvalStatus: 'none',
          targetVersionIds: [v2.id],
        }),
      ).toThrow(ForbiddenException);
    });
  });

  describe('Preview Token Security & PublicContentController Headers / ETag / 304', () => {
    function createMockRes() {
      const headers: Record<string, string> = {};
      const state: { statusCode: number; body: any; ended: boolean } = {
        statusCode: 200,
        body: undefined,
        ended: false,
      };
      const res: any = {
        setHeader: (k: string, v: string) => {
          headers[k.toLowerCase()] = v;
        },
        status: (code: number) => {
          state.statusCode = code;
          return res;
        },
        json: (payload: any) => {
          state.body = payload;
          state.ended = true;
          return res;
        },
        end: () => {
          state.ended = true;
          return res;
        },
      };
      return { res, headers, state };
    }

    it('rejects missing, tampered, and expired preview tokens', () => {
      expect(() => verifyCmsPreviewToken(undefined)).toThrow(UnauthorizedException);
      expect(() => verifyCmsPreviewToken('')).toThrow(UnauthorizedException);

      const signed = signCmsPreviewToken({
        pageId: 'p1',
        slug: 'about',
        locale: 'en',
        versionId: 'v1',
        ttlSeconds: 60,
        nowMs: 1_000_000,
      });

      // Tamper payload
      const parts = signed.token.split('.');
      parts[1] = `${parts[1]}x`;
      expect(() => verifyCmsPreviewToken(parts.join('.'), 1_010_000)).toThrow(
        UnauthorizedException,
      );

      // Expired
      expect(() => verifyCmsPreviewToken(signed.token, 1_000_000 + 61_000)).toThrow(
        UnauthorizedException,
      );
    });

    it('sends noindex + no-store on preview responses and Cache-Control + ETag + 304 on public reads', async () => {
      const { service } = createInMemoryCmsHarness();
      const created = await service.createCustomPage(
        { slug: 'security-whitepaper', titleEn: 'Security Whitepaper Draft' },
        editorActor,
      );

      const controller = new PublicContentController(service);

      // Draft MUST return 404 on public page endpoint
      const publicMissRes = createMockRes();
      await expect(
        controller.getPublishedPage(
          'security-whitepaper',
          'en',
          { headers: {} } as any,
          publicMissRes.res,
        ),
      ).rejects.toThrow(NotFoundException);

      // Preview endpoint WITHOUT token throws Unauthorized AND sets noindex header
      const previewFailRes = createMockRes();
      await expect(
        controller.getDraftPreview(undefined, { headers: {} } as any, previewFailRes.res),
      ).rejects.toThrow(UnauthorizedException);
      expect(previewFailRes.headers['x-robots-tag']).toContain('noindex');
      expect(previewFailRes.headers['cache-control']).toContain('no-store');

      // Preview endpoint WITH valid token returns draft + noindex headers
      const tokenDto = await service.createPagePreviewToken(created.id, { locale: 'en' }, editorActor);
      const previewOkRes = createMockRes();
      await controller.getDraftPreview(tokenDto.token, { headers: {} } as any, previewOkRes.res);
      expect(previewOkRes.state.statusCode).toBe(200);
      expect(previewOkRes.state.body.data.isPreview).toBe(true);
      expect(previewOkRes.state.body.data.version.title).toBe('Security Whitepaper Draft');
      expect(previewOkRes.headers['x-robots-tag']).toBe('noindex, nofollow, noarchive');
      expect(previewOkRes.headers['cache-control']).toContain('no-store');

      // Publish page -> GET /public/content/pages/:slug returns ETag & Cache-Control, and 304 on If-None-Match
      await service.publishPageNow(created.id, { locale: 'en' }, publisherActor);
      const pubRes1 = createMockRes();
      await controller.getPublishedPage(
        'security-whitepaper',
        'en',
        { headers: {} } as any,
        pubRes1.res,
      );
      expect(pubRes1.state.statusCode).toBe(200);
      expect(pubRes1.headers['cache-control']).toContain('public');
      expect(pubRes1.headers['etag']).toMatch(/^"cms-[a-f0-9]+"$/);

      const pubRes304 = createMockRes();
      await controller.getPublishedPage(
        'security-whitepaper',
        'en',
        { headers: { 'if-none-match': pubRes1.headers['etag'] } } as any,
        pubRes304.res,
      );
      expect(pubRes304.state.statusCode).toBe(304);
      expect(pubRes304.state.body).toBeUndefined();

      expect(isIfNoneMatchHit(`W/${pubRes1.headers['etag']}`, pubRes1.headers['etag'])).toBe(true);
      expect(buildCmsETag({ ok: 1 })).toBe(buildCmsETag({ ok: 1 }));
    });

    it('serves menus, posts, changelog, careers, and public settings with Cache-Control, ETag, and 304', async () => {
      const dbMock: any = {
        unscoped: {
          cmsMenu: {
            findMany: jest.fn(async () => [
              {
                id: 'm1',
                slug: 'main-header',
                name: 'Header',
                location: 'header',
                isActive: true,
                items: [
                  {
                    id: 'mi1',
                    menuId: 'm1',
                    parentId: null,
                    labelEn: 'Pricing',
                    labelBn: 'মূল্য',
                    descriptionEn: null,
                    descriptionBn: null,
                    targetPageId: null,
                    href: '/pricing',
                    badgeEn: null,
                    badgeBn: null,
                    sortOrder: 1,
                    openInNewTab: false,
                    isVisible: true,
                  },
                ],
              },
            ]),
          },
          cmsPost: {
            findMany: jest.fn(async ({ where }: any) => {
              expect(where.status).toBe('published');
              expect(where.deletedAt).toBeNull();
              return [];
            }),
            count: jest.fn(async () => 0),
            findFirst: jest.fn(async () => null),
          },
          cmsChangelogEntry: {
            findMany: jest.fn(async ({ where }: any) => {
              expect(where.isPublished).toBe(true);
              expect(where.deletedAt).toBeNull();
              return [];
            }),
            count: jest.fn(async () => 0),
          },
          cmsCareer: {
            findMany: jest.fn(async ({ where }: any) => {
              expect(where.deletedAt).toBeNull();
              expect(where.status).toBe('open');
              return [];
            }),
            findFirst: jest.fn(async () => null),
          },
          cmsSiteSetting: {
            findMany: jest.fn(async ({ where }: any) => {
              expect(where.isPublic).toBe(true);
              return [{ key: 'locale.config', valueJson: { defaultLocale: 'en' } }];
            }),
          },
        },
      };
      const controller = new PublicContentController(
        new PlatformCmsService(dbMock, { log: jest.fn() } as any),
      );

      const endpoints: Array<(res: any, req: any) => Promise<void>> = [
        (res, req) => controller.getPublicMenus(undefined, undefined, req, res),
        (res, req) =>
          controller.listPublishedPosts('en', undefined, undefined, undefined, undefined, undefined, undefined, req, res),
        (res, req) =>
          controller.listPublishedChangelog('en', undefined, undefined, undefined, req, res),
        (res, req) => controller.listPublicCareers('en', undefined, req, res),
        (res, req) => controller.getPublicSettings(req, res),
      ];

      for (const invoke of endpoints) {
        const r1 = createMockRes();
        await invoke(r1.res, { headers: {} });
        expect(r1.state.statusCode).toBe(200);
        expect(r1.headers['cache-control']).toContain('public');
        expect(r1.headers['etag']).toMatch(/^"cms-[a-f0-9]+"$/);

        const r304 = createMockRes();
        await invoke(r304.res, { headers: { 'if-none-match': r1.headers['etag'] } });
        expect(r304.state.statusCode).toBe(304);
      }

      // Draft/unpublished post or career returns 404
      await expect(
        controller.getPublishedPostBySlug('draft-post', 'en', { headers: {} } as any, createMockRes().res),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.getPublicCareerBySlug('draft-role', 'en', { headers: {} } as any, createMockRes().res),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Media Library (Stage C.1) & Explicit Raw HTML Permission', () => {
    it('uploads validated PNG image into StorageService, rejects spoofed headers, and streams public asset', async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      ]);
      const storageMock = {
        uploadPlatformAsset: jest.fn(async (key: string) => key),
        exists: jest.fn(async () => true),
        read: jest.fn(async () => ({ buffer: pngBuffer, meta: { contentType: 'image/png' } })),
        delete: jest.fn(async () => undefined),
      };
      const mediaStore = new Map<string, any>();
      const dbMock: any = {
        unscoped: {
          cmsMedia: {
            create: jest.fn(async ({ data }: any) => {
              const row = { ...data, createdAt: new Date(), updatedAt: new Date() };
              mediaStore.set(row.id, row);
              return row;
            }),
            findUnique: jest.fn(async ({ where }: any) => mediaStore.get(where.id) ?? null),
            findMany: jest.fn(async () => Array.from(mediaStore.values())),
            count: jest.fn(async () => mediaStore.size),
          },
        },
      };
      const auditMock: any = { log: jest.fn(async () => undefined) };
      const service = new PlatformCmsService(dbMock, auditMock, storageMock as any);

      // Spoofed executable pretending to be PNG must fail magic-byte validation
      await expect(
        service.uploadMedia(
          {
            buffer: Buffer.from('<script>alert(1)</script>'),
            originalName: 'evil.png',
            mimeType: 'image/png',
            sizeBytes: 25,
          },
          editorActor,
        ),
      ).rejects.toThrow(BadRequestException);

      const created = await service.uploadMedia(
        {
          buffer: pngBuffer,
          originalName: 'Hero Chart.png',
          mimeType: 'image/png',
          sizeBytes: pngBuffer.length,
          folder: 'Pages',
          altEn: 'Payroll analytics screenshot',
          altBn: 'পেরোল বিশ্লেষণ স্ক্রিনশট',
          width: 1200,
          height: 630,
        },
        editorActor,
      );

      expect(created.folder).toBe('pages');
      expect(created.publicUrl).toBe(`/api/v1/public/content/media/${created.id}/file`);
      expect(storageMock.uploadPlatformAsset).toHaveBeenCalledTimes(1);
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'cms.media.uploaded', module: 'cms', recordId: created.id }),
      );

      const streamed = await service.getPublicMediaFile(created.id);
      expect(streamed.mimeType).toBe('image/png');
      expect(streamed.buffer.equals(pngBuffer)).toBe(true);
    });

    it('requires explicit cms:raw_html permission even for Content Publisher / Platform Owner', () => {
      const { canUseCmsRawHtml } = require('./cms.utils');
      const { PlatformPermissionsGuard } = require('../auth/guards/platform-permissions.guard');
      expect(canUseCmsRawHtml(editorActor)).toBe(false);
      expect(canUseCmsRawHtml(publisherActor)).toBe(false);
      expect(
        canUseCmsRawHtml({
          id: 'u-1',
          roleName: 'Platform Owner',
          permissions: [{ module: 'platform', action: 'manage' }],
        }),
      ).toBe(false);
      expect(
        canUseCmsRawHtml({
          id: 'u-2',
          roleName: 'Content Publisher',
          permissions: [{ module: 'cms', action: 'raw_html' }],
        }),
      ).toBe(true);

      const guard = new PlatformPermissionsGuard({
        getAllAndOverride: jest.fn((key: string) =>
          key === 'isPublic' ? false : { module: 'cms', action: 'raw_html' },
        ),
      } as any);
      const makeCtx = (user: any): any => ({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => ({ platformUser: user }) }),
      });

      expect(() =>
        guard.canActivate(makeCtx({ roleName: 'Platform Owner', permissions: [{ module: 'platform', action: 'manage' }] })),
      ).toThrow(ForbiddenException);
      expect(
        guard.canActivate(makeCtx({ roleName: 'Content Editor', permissions: [{ module: 'cms', action: 'raw_html' }] })),
      ).toBe(true);
    });

    it('computes Content Dashboard counts, broken links, missing bn translations, and recent changes (who & when)', async () => {
      const now = new Date();
      const recentPubDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const validMediaId = '550e8400-e29b-41d4-a716-446655440099';
      const missingMediaId = '550e8400-e29b-41d4-a716-446655440000';

      const pages = [
        {
          id: 'p-draft',
          kind: 'custom',
          slug: 'spring-launch',
          status: 'draft',
          locked: false,
          requiresApproval: false,
          approvalStatus: 'none',
          scheduledAt: null,
          scheduledTimezone: null,
          publishedAt: null,
          currentPublishedVersionId: null,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
          locales: [
            {
              locale: 'en',
              isTranslated: true,
              translationStatus: 'translated',
              currentDraftVersionId: 'v-draft-en',
              currentPublishedVersionId: null,
            },
            {
              locale: 'bn',
              isTranslated: false,
              translationStatus: 'untranslated',
              currentDraftVersionId: null,
              currentPublishedVersionId: null,
            },
          ],
        },
        {
          id: 'p-sched',
          kind: 'custom',
          slug: 'dhaka-summit',
          status: 'scheduled',
          locked: false,
          requiresApproval: false,
          approvalStatus: 'none',
          scheduledAt: new Date(now.getTime() + 86400000),
          scheduledTimezone: 'Asia/Dhaka',
          publishedAt: null,
          currentPublishedVersionId: null,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
          locales: [
            {
              locale: 'en',
              isTranslated: true,
              translationStatus: 'translated',
              currentDraftVersionId: 'v-sched-en',
              currentPublishedVersionId: null,
            },
            {
              locale: 'bn',
              isTranslated: true,
              translationStatus: 'translated',
              currentDraftVersionId: 'v-sched-bn',
              currentPublishedVersionId: null,
            },
          ],
        },
        {
          id: 'p-legal',
          kind: 'system',
          slug: 'privacy',
          status: 'published',
          locked: true,
          requiresApproval: true,
          approvalStatus: 'pending_approval',
          scheduledAt: null,
          scheduledTimezone: null,
          publishedAt: recentPubDate,
          currentPublishedVersionId: 'v-legal-en',
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
          locales: [
            {
              locale: 'en',
              isTranslated: true,
              translationStatus: 'translated',
              currentDraftVersionId: 'v-legal-en',
              currentPublishedVersionId: 'v-legal-en',
            },
            {
              locale: 'bn',
              isTranslated: false,
              translationStatus: 'in_review',
              currentDraftVersionId: null,
              currentPublishedVersionId: null,
            },
          ],
        },
      ];

      const versions = [
        {
          id: 'v-draft-en',
          pageId: 'p-draft',
          locale: 'en',
          versionNumber: 1,
          title: 'Spring Launch',
          canonicalPath: null,
          blocks: [
            {
              id: 'b1',
              type: 'button',
              props: { label: 'Bad Route', href: '/nonexistent-feature-xyz' },
            },
            {
              id: 'b2',
              type: 'rich_text',
              props: {
                html: `<p>See <a href="/api/v1/public/content/media/${missingMediaId}/file">asset</a> and <a href="/features/payroll">payroll</a>.</p>`,
              },
            },
          ],
        },
        {
          id: 'v-sched-en',
          pageId: 'p-sched',
          locale: 'en',
          versionNumber: 1,
          title: 'Dhaka Summit',
          canonicalPath: null,
          blocks: [
            {
              id: 'b3',
              type: 'button',
              props: { label: 'Pricing', href: '/bn/pricing' },
            },
          ],
        },
        {
          id: 'v-sched-bn',
          pageId: 'p-sched',
          locale: 'bn',
          versionNumber: 1,
          title: 'ঢাকা সামিট',
          canonicalPath: null,
          blocks: [
            {
              id: 'b4',
              type: 'rich_text',
              props: {
                html: `<p><a href="/api/v1/public/content/media/${validMediaId}/file">Brochure</a></p>`,
              },
            },
          ],
        },
        {
          id: 'v-legal-en',
          pageId: 'p-legal',
          locale: 'en',
          versionNumber: 1,
          title: 'Privacy Policy',
          canonicalPath: '/privacy',
          blocks: [],
        },
      ];

      const dbMock: any = {
        unscoped: {
          cmsPage: { findMany: jest.fn(async () => pages) },
          cmsPost: {
            findMany: jest.fn(async () => [
              {
                id: 'post-1',
                slug: 'hello-cmsn',
                status: 'draft',
                categoryId: 'cat-1',
                authorId: 'auth-1',
                coverMediaId: null,
                titleEn: 'Hello CMSN',
                titleBn: null,
                excerptEn: 'Intro',
                excerptBn: null,
                bodyHtmlEn: '<p>Hi</p>',
                bodyHtmlBn: null,
                isBnTranslated: false,
                bnTranslationStatus: 'untranslated',
                tags: [],
                readingTimeMinutes: 3,
                scheduledAt: null,
                scheduledTimezone: null,
                publishedAt: null,
                deletedAt: null,
                createdAt: now,
                updatedAt: now,
              },
            ]),
          },
          cmsCareer: { findMany: jest.fn(async () => [{ slug: 'backend-engineer', status: 'open' }]) },
          cmsRedirect: { findMany: jest.fn(async () => [{ sourcePath: '/legacy-home' }]) },
          cmsMedia: { findMany: jest.fn(async () => [{ id: validMediaId }]) },
          cmsPostCategory: {
            findMany: jest.fn(async () => [{ id: 'cat-1', slug: 'payroll', nameEn: 'Payroll' }]),
          },
          cmsAuthor: {
            findMany: jest.fn(async () => [
              { id: 'auth-1', slug: 'editorial', displayName: 'Editorial Team' },
            ]),
          },
          cmsPageVersion: { findMany: jest.fn(async () => versions) },
          platformAuditLog: {
            findMany: jest.fn(async () => [
              {
                id: 'log-1',
                userId: editorActor.id,
                action: 'cms.page_created',
                module: 'cms',
                recordId: 'p-draft',
                reason: 'Created custom CMS page "spring-launch"',
                createdAt: now,
                user: {
                  id: editorActor.id,
                  firstName: 'Nadia',
                  lastName: 'Karim',
                  email: editorActor.email,
                },
              },
            ]),
          },
        },
      };

      const service = new PlatformCmsService(dbMock, { log: jest.fn() } as any);
      const summary = await service.getDashboardSummary();

      expect(summary.counts).toEqual({
        totalPages: 3,
        drafts: 1,
        scheduled: 1,
        pendingApproval: 1,
        recentlyPublished: 1,
        missingBengaliTranslation: 2,
        pagesWithBrokenLinks: 1,
        totalPosts: 1,
        draftPosts: 1,
      });

      expect(summary.brokenLinkPages).toHaveLength(1);
      expect(summary.brokenLinkPages[0].slug).toBe('spring-launch');
      expect(summary.brokenLinkPages[0].occurrences.map((o) => o.href)).toEqual([
        '/nonexistent-feature-xyz',
        `/api/v1/public/content/media/${missingMediaId}/file`,
      ]);

      expect(summary.recentChanges).toHaveLength(1);
      expect(summary.recentChanges[0]).toMatchObject({
        action: 'cms.page_created',
        actorName: 'Nadia Karim',
        actorEmail: editorActor.email,
        summary: 'Created custom CMS page "spring-launch"',
      });
      expect(summary.postCategories).toHaveLength(1);
      expect(summary.authors).toHaveLength(1);
    });

    it('enriches listPages with titles and lastEdited metadata and restricts duplicateCustomPage to custom pages', async () => {
      const now = new Date();
      const customId = 'page-custom-1';
      const systemId = 'page-system-1';

      const sourceCustom = {
        id: customId,
        kind: 'custom',
        slug: 'promo-spring',
        status: 'published',
        locked: false,
        requiresApproval: false,
        approvalStatus: 'none',
        pendingApprovalVersionId: null,
        submittedForApprovalById: null,
        submittedForApprovalAt: null,
        submissionNote: null,
        approvedById: null,
        approvedAt: null,
        approvalNote: null,
        rejectedById: null,
        rejectedAt: null,
        rejectionReason: null,
        scheduledAt: null,
        scheduledTimezone: null,
        scheduledById: null,
        publishedAt: now,
        currentPublishedVersionId: 'v-c-1',
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        locales: [
          {
            locale: 'en',
            isTranslated: true,
            translationStatus: 'translated',
            currentDraftVersionId: 'v-c-1',
            currentPublishedVersionId: 'v-c-1',
            updatedAt: now,
          },
        ],
        versions: [
          {
            id: 'v-c-1',
            pageId: customId,
            versionNumber: 1,
            locale: 'en',
            title: 'Spring Promotion',
            seoTitle: 'Spring Promo',
            seoDescription: 'Promo desc',
            canonicalPath: '/p/promo-spring',
            ogImageUrl: null,
            noIndex: false,
            blocks: [],
            isTranslated: true,
            authorId: editorActor.id,
            authorName: 'Nadia Karim',
            changeNote: 'Initial',
            createdAt: now,
            author: { id: editorActor.id, firstName: 'Nadia', lastName: 'Karim', email: editorActor.email },
          },
        ],
      };

      const systemPage = {
        ...sourceCustom,
        id: systemId,
        kind: 'system',
        slug: 'pricing',
        locked: true,
        versions: [],
      };

      let duplicatedSlug = '';
      const dbMock: any = {
        unscoped: {
          $transaction: jest.fn(async (cb: any) => cb(dbMock.unscoped)),
          cmsPage: {
            findMany: jest.fn(async () => [systemPage, sourceCustom]),
            findUnique: jest.fn(async ({ where }: any) => {
              if (where.id === systemId) return systemPage;
              if (where.id === customId) return sourceCustom;
              return null;
            }),
            create: jest.fn(async ({ data }: any) => {
              duplicatedSlug = data.slug;
              return {
                ...sourceCustom,
                id: 'page-copy-1',
                slug: data.slug,
                status: 'draft',
                publishedAt: null,
                currentPublishedVersionId: null,
                locales: [],
              };
            }),
            findUniqueOrThrow: jest.fn(async () => ({
              ...sourceCustom,
              id: 'page-copy-1',
              slug: duplicatedSlug,
              status: 'draft',
              publishedAt: null,
              currentPublishedVersionId: null,
            })),
          },
          cmsPageVersion: {
            findMany: jest.fn(async () => sourceCustom.versions),
            create: jest.fn(async ({ data }: any) => ({ id: 'ver-copy-1', ...data, createdAt: now })),
          },
          cmsPageLocale: {
            create: jest.fn(async ({ data }: any) => ({ ...data, updatedAt: now })),
          },
        },
      };

      const auditMock: any = { log: jest.fn(async () => undefined) };
      const service = new PlatformCmsService(dbMock, auditMock);

      const listed = await service.listPages();
      expect(listed).toHaveLength(2);
      const customListed = listed.find((p) => p.id === customId);
      expect(customListed?.titleEn).toBe('Spring Promotion');
      expect(customListed?.lastEditedByName).toBe('Nadia Karim');
      expect(customListed?.canonicalPath).toBe('/p/promo-spring');

      // System/locked page duplication is rejected
      await expect(service.duplicateCustomPage(systemId, {}, editorActor)).rejects.toThrow(
        ForbiddenException,
      );

      // Custom page duplicates cleanly as a draft
      const duplicated = await service.duplicateCustomPage(customId, {}, editorActor);
      expect(duplicated.kind).toBe('custom');
      expect(duplicated.status).toBe('draft');
      expect(duplicated.slug).toBe('promo-spring-copy');
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'cms.page_duplicated', module: 'cms' }),
      );
    });

    it('locks system page layout and dynamic pricing/country widgets while permitting surrounding text updates', async () => {
      const { assertSystemPageStructurePreserved } = require('./cms.utils');
      const baselineBlocks = [
        { id: 'hero', type: 'heading', props: { level: 1, text: 'Pricing', align: 'center' } },
        {
          id: 'pricing-widget',
          type: 'dynamic_block',
          props: { widget: 'pricing_table', heading: 'Plans', subtitle: 'Old sub' },
        },
        {
          id: 'countries-widget',
          type: 'dynamic_block',
          props: { widget: 'country_list', heading: 'Global Coverage' },
        },
      ];

      // Updating heading & surrounding dynamic widget text passes
      expect(() =>
        assertSystemPageStructurePreserved({
          pageSlug: 'pricing',
          kind: 'system',
          locked: true,
          baselineBlocks,
          candidateBlocks: [
            { id: 'hero', type: 'heading', props: { level: 1, text: 'New Pricing Headline', align: 'center' } },
            {
              id: 'pricing-widget',
              type: 'dynamic_block',
              props: { widget: 'pricing_table', heading: 'Flexible Tiers', subtitle: 'Updated copy' },
            },
            {
              id: 'countries-widget',
              type: 'dynamic_block',
              props: { widget: 'country_list', heading: '10+ Supported Jurisdictions' },
            },
          ],
        }),
      ).not.toThrow();

      // Removing a dynamic block from a system page throws ForbiddenException
      expect(() =>
        assertSystemPageStructurePreserved({
          pageSlug: 'pricing',
          kind: 'system',
          locked: true,
          baselineBlocks,
          candidateBlocks: baselineBlocks.slice(0, 2),
        }),
      ).toThrow(ForbiddenException);

      // Swapping a locked dynamic widget type throws ForbiddenException
      expect(() =>
        assertSystemPageStructurePreserved({
          pageSlug: 'pricing',
          kind: 'system',
          locked: true,
          baselineBlocks,
          candidateBlocks: [
            baselineBlocks[0],
            {
              id: 'pricing-widget',
              type: 'dynamic_block',
              props: { widget: 'country_list', heading: 'Plans' },
            },
            baselineBlocks[2],
          ],
        }),
      ).toThrow(ForbiddenException);
    });

    it('validates live slug availability, creates draft custom page with menu assignment & template, and publishes to sitemap feed', async () => {
      const now = new Date();
      const createdPages: any[] = [];
      const createdMenuItems: any[] = [];
      const dbMock: any = {
        unscoped: {
          $transaction: jest.fn(async (cb: any) => cb(dbMock.unscoped)),
          cmsMenu: {
            findUnique: jest.fn(async ({ where }: any) =>
              where.id === 'menu-header-1' ? { id: 'menu-header-1', slug: 'header' } : null,
            ),
          },
          cmsMenuItem: {
            findFirst: jest.fn(async () => ({ sortOrder: 2 })),
            create: jest.fn(async ({ data }: any) => {
              const row = { id: 'mi-1', ...data };
              createdMenuItems.push(row);
              return row;
            }),
          },
          cmsPage: {
            findUnique: jest.fn(async ({ where }: any) =>
              createdPages.find((p) => p.slug === where.slug || p.id === where.id) ?? null,
            ),
            create: jest.fn(async ({ data }: any) => {
              const pg = {
                id: 'custom-created-1',
                ...data,
                approvalStatus: 'none',
                deletedAt: null,
                createdAt: now,
                updatedAt: now,
              };
              createdPages.push(pg);
              return pg;
            }),
            findUniqueOrThrow: jest.fn(async ({ where }: any) => ({
              ...createdPages.find((p) => p.id === where.id),
              locales: [],
            })),
            findMany: jest.fn(async ({ where }: any = {}) =>
              [
                {
                  id: 'p-draft',
                  slug: 'unpublished-promo',
                  kind: 'custom',
                  status: 'draft',
                  deletedAt: null,
                  publishedAt: null,
                  updatedAt: now,
                  currentPublishedVersion: null,
                },
                {
                  id: 'p-pub',
                  slug: 'eid-campaign',
                  kind: 'custom',
                  status: 'published',
                  deletedAt: null,
                  publishedAt: now,
                  updatedAt: now,
                  currentPublishedVersion: { canonicalPath: '/eid-campaign', noIndex: false },
                },
                {
                  id: 'p-noindex',
                  slug: 'secret-thank-you',
                  kind: 'custom',
                  status: 'published',
                  deletedAt: null,
                  publishedAt: now,
                  updatedAt: now,
                  currentPublishedVersion: { canonicalPath: '/secret-thank-you', noIndex: true },
                },
              ].filter(
                (r) =>
                  (!where?.status || r.status === where.status) &&
                  (!where?.kind || r.kind === where.kind) &&
                  (where?.deletedAt !== null || r.deletedAt === null),
              ),
            ),
          },
          cmsPageVersion: {
            create: jest.fn(async ({ data }: any) => ({ id: 'ver-1', ...data, createdAt: now })),
          },
          cmsPageLocale: {
            createMany: jest.fn(async () => ({ count: 2 })),
          },
        },
      };

      const auditMock: any = { log: jest.fn(async () => undefined) };
      const service = new PlatformCmsService(dbMock, auditMock);

      // Reserved word rejected live
      const reservedCheck = await service.checkSlugAvailability('admin');
      expect(reservedCheck.valid).toBe(false);
      expect(reservedCheck.reserved).toBe(true);

      // Valid unused slug available
      const availCheck = await service.checkSlugAvailability('eid-campaign');
      expect(availCheck.valid).toBe(true);
      expect(availCheck.available).toBe(true);

      // Creating Legal-style template starts as draft with requiresApproval=true and adds menu item
      const created = await service.createCustomPage(
        {
          slug: 'eid-campaign',
          titleEn: 'Eid Compliance Guide',
          templateKey: 'legal',
          menuId: 'menu-header-1',
          menuItemLabelEn: 'Eid Guide',
          blocksEn: [{ id: 'h1', type: 'heading', props: { level: 1, text: 'Eid Guide', align: 'left' } }],
        },
        editorActor,
      );
      expect(created.status).toBe('draft');
      expect(created.requiresApproval).toBe(true);
      expect(createdMenuItems).toHaveLength(1);
      expect(createdMenuItems[0].href).toBe('/eid-campaign');

      // Duplicate slug check now returns available=false
      const dupCheck = await service.checkSlugAvailability('eid-campaign');
      expect(dupCheck.available).toBe(false);

      // Public sitemap feed returns ONLY published non-noindex custom pages
      const sitemapPages = await service.listPublicPublishedPages('custom');
      expect(sitemapPages).toHaveLength(1);
      expect(sitemapPages[0].slug).toBe('eid-campaign');
      expect(sitemapPages[0].canonicalPath).toBe('/eid-campaign');
    });
  });

  describe('Immutable Versions, Conflict Detection, Restore & Multi-Editor Presence', () => {
    it('blocks silent overwrites with ConflictException unless forceOverwrite is true and restores history without mutating old versions', async () => {
      const { service, pageVersions, auditLogs } = createInMemoryCmsHarness();

      const page = await service.createCustomPage(
        {
          slug: 'collab-guide',
          titleEn: 'Collaboration Guide v1',
          blocksEn: [{ id: 'b1', type: 'heading', props: { level: 1, text: 'V1 Heading', align: 'left' } }],
        },
        editorActor,
      );

      const v1 = Array.from(pageVersions.values()).find((v) => v.pageId === page.id && v.versionNumber === 1);
      expect(v1).toBeDefined();

      // Editor A saves v2 against v1
      const v2 = await service.createPageVersion(
        page.id,
        {
          locale: 'en',
          title: 'Collaboration Guide v2',
          blocks: [{ id: 'b1', type: 'heading', props: { level: 1, text: 'V2 Heading', align: 'left' } }],
          baseVersionId: v1.id,
          expectedVersionNumber: 1,
          changeNote: 'Editor A update',
        },
        editorActor,
      );
      expect(v2.versionNumber).toBe(2);

      // Editor B attempts save with stale v1 baseVersionId -> ConflictException (CMS_VERSION_CONFLICT)
      await expect(
        service.createPageVersion(
          page.id,
          {
            locale: 'en',
            title: 'Editor B Conflicting Title',
            blocks: [],
            baseVersionId: v1.id,
            expectedVersionNumber: 1,
          },
          publisherActor,
        ),
      ).rejects.toThrow(ConflictException);

      // Force overwrite creates v3 without mutating v1 or v2
      const v3 = await service.createPageVersion(
        page.id,
        {
          locale: 'en',
          title: 'Merged Collaboration Guide v3',
          blocks: [{ id: 'b1', type: 'heading', props: { level: 1, text: 'Merged Heading', align: 'left' } }],
          baseVersionId: v1.id,
          forceOverwrite: true,
          changeNote: 'Merged changes',
        },
        publisherActor,
      );
      expect(v3.versionNumber).toBe(3);

      // Non-destructive Restore from v1 creates brand-new draft v4 and keeps v1, v2, v3 immutable
      const v4 = await service.restorePageVersionAsDraft(page.id, v1.id, editorActor, 'Revert to v1');
      expect(v4.versionNumber).toBe(4);
      expect(v4.title).toBe('Collaboration Guide v1');
      expect(pageVersions.get(v1.id).title).toBe('Collaboration Guide v1');
      expect(pageVersions.get(v2.id).title).toBe('Collaboration Guide v2');
      expect(auditLogs.some((a) => a.action === 'cms.page_version_restored')).toBe(true);

      // Multi-editor presence tracks concurrent sessions and releases cleanly
      await service.recordEditorPresence(
        page.id,
        { locale: 'en', sessionId: 'sess-a', baseVersionNumber: 4 },
        editorActor,
      );
      const presenceB = await service.recordEditorPresence(
        page.id,
        { locale: 'en', sessionId: 'sess-b', baseVersionNumber: 4 },
        publisherActor,
      );
      expect(presenceB.activeEditors).toHaveLength(2);
      await service.removeEditorPresence(page.id, 'sess-a');
      const afterLeave = await service.getPagePresence(page.id);
      expect(afterLeave.activeEditors).toHaveLength(1);
      expect(afterLeave.activeEditors[0].sessionId).toBe('sess-b');
    });
  });

  describe('Custom Page Deletion, Pre-Delete Impact Checks, Redirects, Trash Retention & Permanent Delete', () => {
    it('refuses deletion and impact checks for system pages even if called directly', async () => {
      const { service, pages } = createInMemoryCmsHarness();
      const sysId = '99999999-9999-4999-8999-999999999999';
      pages.set(sysId, {
        id: sysId,
        kind: 'system',
        slug: 'pricing',
        status: 'published',
        locked: true,
        requiresApproval: false,
        approvalStatus: 'none',
        currentPublishedVersionId: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.getPageDeletionImpact(sysId, publisherActor)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.trashOrDeletePage(sysId, publisherActor)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        service.permanentDeletePage(sysId, { confirmText: 'pricing' }, publisherActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('enforces menu link blockers, backlink warnings, published confirmation, redirects, permanent delete & 30-day purge', async () => {
      const { service, pages, pageVersions, menuItems, redirects, auditLogs } =
        createInMemoryCmsHarness();

      // Create & publish target custom page
      const target = await service.createCustomPage(
        {
          slug: 'promo-2026',
          titleEn: 'Promo Campaign 2026',
          blocksEn: [{ id: 'h1', type: 'heading', props: { level: 1, text: 'Promo', align: 'left' } }],
        },
        editorActor,
      );
      await service.publishPageNow(target.id, { locale: 'en' }, publisherActor);

      // Another custom page linking to /promo-2026
      await service.createCustomPage(
        {
          slug: 'referrer-page',
          titleEn: 'Referrer Page',
          blocksEn: [
            {
              id: 'btn-1',
              type: 'button',
              props: { label: 'View Promo', href: '/promo-2026', variant: 'primary' },
            },
          ],
        },
        editorActor,
      );

      // Menu item pointing to /promo-2026
      menuItems.set('mi-1', {
        id: 'mi-1',
        menuId: 'menu-header',
        labelEn: '2026 Promo',
        targetPageId: target.id,
        href: '/promo-2026',
        menu: { id: 'menu-header', name: 'Header Navigation', location: 'header' },
      });

      const impact = await service.getPageDeletionImpact(target.id, publisherActor);
      expect(impact.willStopWorking).toBe(true);
      expect(impact.requiresTypedTitleConfirmation).toBe(true);
      expect(impact.menuReferences).toHaveLength(1);
      expect(impact.referencingPages).toHaveLength(1);
      expect(impact.referencingPages[0].slug).toBe('referrer-page');
      expect(impact.trashRetentionDays).toBe(30);

      // 1. Blocked while menu links exist without removeMenuReferences
      await expect(
        service.trashOrDeletePage(target.id, publisherActor, {
          confirmPublishedTitle: 'Promo Campaign 2026',
        }),
      ).rejects.toThrow(BadRequestException);

      // 2. Blocked when published and neither unpublishFirst nor confirmPublishedTitle supplied
      await expect(
        service.trashOrDeletePage(target.id, publisherActor, {
          removeMenuReferences: true,
        }),
      ).rejects.toThrow(BadRequestException);

      // 3. Succeeds when removing menu references, confirming title, and setting redirect to '/'
      const trashed = await service.trashOrDeletePage(target.id, publisherActor, {
        removeMenuReferences: true,
        confirmPublishedTitle: 'Promo Campaign 2026',
        redirectToPath: '/',
        reason: 'Ended Q4 promo',
      });
      expect(trashed.status).toBe('trashed');
      expect(menuItems.size).toBe(0);
      expect(redirects.get('/promo-2026')?.destinationUrl).toBe('/');
      const resolvedRedirect = await service.resolvePublicRedirect('/promo-2026');
      expect(resolvedRedirect?.destinationUrl).toBe('/');

      // 4. Content Editor cannot permanently delete even in trash
      await expect(
        service.permanentDeletePage(target.id, { confirmText: 'promo-2026' }, editorActor),
      ).rejects.toThrow(ForbiddenException);

      // 5. Wrong typed confirmation fails
      await expect(
        service.permanentDeletePage(target.id, { confirmText: 'wrong-slug' }, publisherActor),
      ).rejects.toThrow(BadRequestException);

      // 6. Publisher permanent delete with exact confirmation erases page & versions and writes audit log
      const perm = await service.permanentDeletePage(
        target.id,
        { confirmText: 'promo-2026', reason: 'Cleanup slug' },
        publisherActor,
      );
      expect(perm.deleted).toBe(true);
      expect(pages.has(target.id)).toBe(false);
      expect(Array.from(pageVersions.values()).filter((v) => v.pageId === target.id)).toHaveLength(0);
      expect(auditLogs.some((a) => a.action === 'cms.page_permanently_deleted')).toBe(true);

      // 7. Configurable 30-day retention auto-purge cleans expired trashed pages only
      const expired = await service.createCustomPage(
        { slug: 'old-draft', titleEn: 'Old Trashed Draft', blocksEn: [] },
        editorActor,
      );
      await service.trashOrDeletePage(expired.id, publisherActor, 'Expire test');
      const row = pages.get(expired.id);
      row.deletedAt = new Date(Date.now() - 31 * 86_400_000);

      await service.updateTrashRetentionDays(30, publisherActor);
      const purgeRes = await service.purgeExpiredTrashedPages(new Date());
      expect(purgeRes.purgedIds).toContain(expired.id);
      expect(pages.has(expired.id)).toBe(false);
      expect(auditLogs.some((a) => a.action === 'cms.page_trash_expired_purged')).toBe(true);
    });
  });

  describe('Media Library: FileStorage Driver, Signature Validation, EXIF Strip, Resized Variants, SVG/PDF & Usage Protection', () => {
    it('strips EXIF, generates WebP/AVIF & resized variants via sharp, validates signatures & alt text, supports sanitized SVG + PDF, and blocks delete while published page uses asset', async () => {
      const sharp = require('sharp');
      const { sanitizeAndValidateCmsSvg, processCmsMediaUpload } = require('./cms-media.processor');

      // Generate a real 1200x800 JPEG buffer with injected EXIF Software tag
      const rawJpegWithExif = await sharp({
        create: {
          width: 1200,
          height: 800,
          channels: 3,
          background: { r: 16, g: 85, b: 140 },
        },
      })
        .withExif({ IFD0: { Software: 'SecretCameraApp', Artist: 'PrivateAuthor' } })
        .jpeg({ quality: 85 })
        .toBuffer();

      const storedObjects = new Map<string, { buffer: Buffer; meta: any }>();
      const storageMock = {
        uploadPlatformAsset: jest.fn(async (key: string, buffer: Buffer, meta: any) => {
          storedObjects.set(key, { buffer, meta });
          return key;
        }),
        exists: jest.fn(async (key: string) => storedObjects.has(key)),
        read: jest.fn(async (key: string) => {
          const item = storedObjects.get(key);
          if (!item) throw new Error('Not found');
          return item;
        }),
        delete: jest.fn(async (key: string) => {
          storedObjects.delete(key);
        }),
      };

      const harness = createInMemoryCmsHarness();
      const mediaStore = new Map<string, any>();
      const tx = (harness.service as any).db;
      tx.cmsMedia = {
        create: jest.fn(async ({ data }: any) => {
          const row = { ...data, deletedAt: null, createdAt: new Date(), updatedAt: new Date() };
          mediaStore.set(row.id, row);
          return row;
        }),
        findUnique: jest.fn(async ({ where }: any) => mediaStore.get(where.id) ?? null),
        findMany: jest.fn(async () => Array.from(mediaStore.values())),
        count: jest.fn(async () => mediaStore.size),
        delete: jest.fn(async ({ where }: any) => {
          const row = mediaStore.get(where.id);
          mediaStore.delete(where.id);
          return row;
        }),
      };
      const serviceWithStorage = new PlatformCmsService(
        { unscoped: tx } as any,
        { log: jest.fn(async (entry: any) => harness.auditLogs.push(entry)) } as any,
        storageMock as any,
      );

      // 1. Missing alt text rejected for image
      await expect(
        serviceWithStorage.uploadMedia(
          {
            buffer: rawJpegWithExif,
            originalName: 'banner.jpg',
            mimeType: 'image/jpeg',
            sizeBytes: rawJpegWithExif.length,
          },
          editorActor,
        ),
      ).rejects.toThrow(BadRequestException);

      // 2. Spoofed extension / executable signature rejected
      await expect(
        processCmsMediaUpload({
          buffer: Buffer.from('MZ\x90\x00fake-exe-payload'),
          originalName: 'avatar.jpg',
          claimedMimeType: 'image/jpeg',
        }),
      ).rejects.toThrow(BadRequestException);

      // 3. Unsafe SVG with <script> or onload rejected; safe SVG sanitized cleanly
      expect(() =>
        sanitizeAndValidateCmsSvg(Buffer.from('<svg onload="alert(1)"><script>alert(1)</script><circle r="5"/></svg>')),
      ).toThrow(BadRequestException);
      const cleanSvg = sanitizeAndValidateCmsSvg(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#0c2239"/></svg>'),
      );
      expect(cleanSvg.toString('utf8')).toContain('<circle');

      // 4. Unsafe PDF with /JavaScript rejected; valid PDF accepted
      await expect(
        processCmsMediaUpload({
          buffer: Buffer.from('%PDF-1.4\n1 0 obj << /JavaScript (app.alert(1)) >> endobj\n%%EOF'),
          originalName: 'evil.pdf',
          claimedMimeType: 'application/pdf',
        }),
      ).rejects.toThrow(BadRequestException);

      const validPdf = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF');
      const uploadedPdf = await serviceWithStorage.uploadMedia(
        {
          buffer: validPdf,
          originalName: 'Payroll Compliance Guide.pdf',
          mimeType: 'application/pdf',
          sizeBytes: validPdf.length,
          folder: 'downloads',
          tags: ['compliance', 'bd-2026'],
          captionEn: 'BD 2026 Guide',
        },
        editorActor,
      );
      expect(uploadedPdf.mimeType).toBe('application/pdf');
      expect(uploadedPdf.folder).toBe('downloads');
      expect(uploadedPdf.tags).toEqual(['compliance', 'bd-2026']);

      // 5. Upload JPEG -> EXIF stripped + 4 variants generated & stored
      const uploadedImg = await serviceWithStorage.uploadMedia(
        {
          buffer: rawJpegWithExif,
          originalName: 'Hero Photo.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: rawJpegWithExif.length,
          folder: 'pages',
          tags: ['hero', 'launch'],
          altEn: 'Blue hero banner photo',
        },
        editorActor,
      );
      expect(uploadedImg.exifStripped).toBe(true);
      expect(uploadedImg.width).toBe(1200);
      expect(uploadedImg.height).toBe(800);
      expect(uploadedImg.tags).toEqual(['hero', 'launch']);
      expect(Object.keys(uploadedImg.variants ?? {}).sort()).toEqual([
        'avif',
        'medium',
        'thumb',
        'webp',
      ]);

      // Verify EXIF was stripped from stored primary buffer
      const primaryMeta = await sharp(storedObjects.get(uploadedImg.storageKey)!.buffer).metadata();
      expect(primaryMeta.exif).toBeUndefined();

      // Verify WebP variant is downloadable via getPublicMediaFile
      const servedWebp = await serviceWithStorage.getPublicMediaFile(uploadedImg.id, 'webp');
      expect(servedWebp.mimeType).toBe('image/webp');
      const servedThumb = await serviceWithStorage.getPublicMediaFile(uploadedImg.id, 'thumb');
      const thumbMeta = await sharp(servedThumb.buffer).metadata();
      expect(thumbMeta.width).toBe(400);

      // 6. Wire image into a page, publish it -> deletion MUST be blocked
      const landing = await serviceWithStorage.createCustomPage(
        {
          slug: 'media-used-page',
          titleEn: 'Media Usage Page',
          blocksEn: [
            {
              id: 'img-1',
              type: 'image',
              props: { mediaId: uploadedImg.id, alt: 'Blue hero banner photo' },
            },
          ],
        },
        editorActor,
      );
      await serviceWithStorage.publishPageNow(landing.id, { locale: 'en' }, publisherActor);

      const usagePublished = await serviceWithStorage.getMediaUsage(uploadedImg.id);
      expect(usagePublished.deletionBlocked).toBe(true);
      expect(usagePublished.publishedReferencesCount).toBeGreaterThanOrEqual(1);
      expect(usagePublished.pages[0].slug).toBe('media-used-page');

      await expect(
        serviceWithStorage.deleteMedia(uploadedImg.id, publisherActor),
      ).rejects.toThrow(ConflictException);

      // Unpublish page -> draft warning requires explicit confirmation, then force delete cleans primary + all 4 variants
      await serviceWithStorage.unpublishPage(landing.id, { reason: 'Retiring banner' }, publisherActor);
      await expect(
        serviceWithStorage.deleteMedia(uploadedImg.id, publisherActor),
      ).rejects.toThrow(BadRequestException);

      const keysBeforeDelete = [
        uploadedImg.storageKey,
        ...Object.values(uploadedImg.variants ?? {}).map((v: any) => v.storageKey),
      ];
      for (const k of keysBeforeDelete) {
        expect(storedObjects.has(k)).toBe(true);
      }

      const deletedRes = await serviceWithStorage.deleteMedia(uploadedImg.id, publisherActor, {
        forceDraftUnlink: true,
      });
      expect(deletedRes.deleted).toBe(true);
      for (const k of keysBeforeDelete) {
        expect(storedObjects.has(k)).toBe(false);
      }
      expect(harness.auditLogs.some((a) => a.action === 'cms.media.deleted')).toBe(true);
    });
  });

  describe('Navigation Menus: Header Mega-Menus, Footer Columns, Drag Reorder, Hide & Broken/Unpublished Flags', () => {
    it('supports mega-menu hierarchy, footer columns, drag reorder, openInNewTab, hiding without delete, and flagging unpublished/trashed target pages', async () => {
      const harness = createInMemoryCmsHarness();
      const menusStore = new Map<string, any>();
      const tx = (harness.service as any).db;
      let seq = 1;
      const nextMenuUuid = () => `10000000-0000-4000-8000-${String(seq++).padStart(12, '0')}`;

      tx.cmsMenu = {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.id) return menusStore.get(where.id) ?? null;
          return Array.from(menusStore.values()).find((m) => m.slug === where.slug) ?? null;
        }),
        findMany: jest.fn(async ({ where, include }: any) => {
          return Array.from(menusStore.values())
            .filter((m) => (where?.isActive !== undefined ? m.isActive === where.isActive : true))
            .map((m) => ({
              ...m,
              items: Array.from(harness.menuItems.values())
                .filter((it: any) => {
                  if (it.menuId !== m.id) return false;
                  if (include?.items?.where?.isVisible !== undefined) {
                    return it.isVisible === include.items.where.isVisible;
                  }
                  return true;
                })
                .sort((a: any, b: any) => a.sortOrder - b.sortOrder),
            }));
        }),
        upsert: jest.fn(async ({ where, create }: any) => {
          const existing = Array.from(menusStore.values()).find((m) => m.slug === where.slug);
          if (existing) return existing;
          const row = { id: nextMenuUuid(), ...create };
          menusStore.set(row.id, row);
          return row;
        }),
      };

      const origMenuItem = tx.cmsMenuItem;
      tx.cmsMenuItem = {
        ...origMenuItem,
        findFirst: jest.fn(async ({ where }: any) => {
          return (
            Array.from(harness.menuItems.values()).find(
              (it: any) =>
                (!where.id || it.id === where.id) &&
                (!where.menuId || it.menuId === where.menuId),
            ) ?? null
          );
        }),
        findMany: jest.fn(async ({ where, orderBy, take }: any) => {
          let list = Array.from(harness.menuItems.values()).filter((it: any) => {
            if (where?.menuId && it.menuId !== where.menuId) return false;
            if (where?.parentId !== undefined && (it.parentId ?? null) !== where.parentId)
              return false;
            return true;
          });
          if (orderBy?.sortOrder === 'desc') {
            list.sort((a: any, b: any) => b.sortOrder - a.sortOrder);
          } else {
            list.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
          }
          if (take) list = list.slice(0, take);
          return list;
        }),
        create: jest.fn(async ({ data }: any) => {
          const row = { id: nextMenuUuid(), createdAt: new Date(), updatedAt: new Date(), ...data };
          harness.menuItems.set(row.id, row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const existing = harness.menuItems.get(where.id);
          const next = { ...existing, ...data, updatedAt: new Date() };
          harness.menuItems.set(where.id, next);
          return next;
        }),
        delete: jest.fn(async ({ where }: any) => {
          const existing = harness.menuItems.get(where.id);
          harness.menuItems.delete(where.id);
          return existing;
        }),
      };

      const allMenus = await harness.service.ensureDefaultNavigationMenus(editorActor);
      const header = allMenus.find((m) => m.slug === 'main-header')!;
      const footer = allMenus.find((m) => m.slug === 'main-footer')!;
      expect(header).toBeDefined();
      expect(footer.items.length).toBeGreaterThanOrEqual(4); // columns + links

      // Create draft custom page and link it in Header Mega-Menu
      const draftPage = await harness.service.createCustomPage(
        { slug: 'beta-payroll', titleEn: 'Beta Payroll' },
        editorActor,
      );

      const withTrigger = await harness.service.createMenuItem(
        header.id,
        { labelEn: 'Product', labelBn: 'প্রোডাক্ট', href: '#' },
        editorActor,
      );
      const triggerId = withTrigger.items[0].id;

      const withGroup = await harness.service.createMenuItem(
        header.id,
        { parentId: triggerId, labelEn: 'Core Suite', labelBn: 'মূল স্যুইট', href: '#' },
        editorActor,
      );
      const groupId = withGroup.items.find((i) => i.parentId === triggerId)!.id;

      const withLinks = await harness.service.createMenuItem(
        header.id,
        {
          parentId: groupId,
          labelEn: 'Beta Payroll',
          labelBn: 'বেটা পেরোল',
          targetPageId: draftPage.id,
          href: '/beta-payroll',
          openInNewTab: false,
        },
        editorActor,
      );
      await harness.service.createMenuItem(
        header.id,
        {
          parentId: groupId,
          labelEn: 'API Docs',
          labelBn: 'এপিআই ডক্স',
          href: 'https://docs.cmsnbd.com',
          openInNewTab: true,
        },
        editorActor,
      );

      const refreshed = await harness.service.listPlatformMenus();
      const headerState = refreshed.find((m) => m.id === header.id)!;
      const draftLink = headerState.items.find((i) => i.targetPageId === draftPage.id)!;
      const extLink = headerState.items.find((i) => i.href === 'https://docs.cmsnbd.com')!;

      // Target warning MUST flag unpublished draft target page
      expect(draftLink.targetPageStatus).toBe('draft');
      expect(draftLink.targetWarning).toContain('draft');
      expect(extLink.openInNewTab).toBe(true);

      // Reorder links inside mega-menu group via drag/drop endpoint
      const reordered = await harness.service.reorderMenuItems(
        header.id,
        {
          items: [
            { id: extLink.id, parentId: groupId, sortOrder: 1 },
            { id: draftLink.id, parentId: groupId, sortOrder: 2 },
          ],
        },
        editorActor,
      );
      const groupChildren = reordered.items.filter((i) => i.parentId === groupId);
      expect(groupChildren[0].id).toBe(extLink.id);
      expect(groupChildren[1].id).toBe(draftLink.id);

      // Hide draftLink without deleting -> public endpoint hides it, platform list still includes it
      await harness.service.updateMenuItem(header.id, draftLink.id, { isVisible: false }, editorActor);
      const pubMenus = await harness.service.listPublicMenus({ slug: 'main-header' });
      expect(pubMenus[0].items.some((i) => i.id === draftLink.id)).toBe(false);
      const platMenusAfterHide = await harness.service.listPlatformMenus();
      expect(
        platMenusAfterHide.find((m) => m.id === header.id)!.items.some((i) => i.id === draftLink.id),
      ).toBe(true);

      // Trash the target page -> warning updates to trashed
      await harness.service.trashOrDeletePage(draftPage.id, publisherActor, {
        removeMenuReferences: false,
      }).catch(() => undefined); // menu ref blocks default delete without removeMenuReferences
      harness.pages.get(draftPage.id).status = 'trashed';
      const afterTrashFlags = await harness.service.listPlatformMenus();
      const trashedFlagItem = afterTrashFlags
        .find((m) => m.id === header.id)!
        .items.find((i) => i.id === draftLink.id)!;
      expect(trashedFlagItem.targetPageStatus).toBe('trashed');
      expect(trashedFlagItem.targetWarning).toContain('Trash');
    });
  });

  describe('Redirects: 301/302 Rules, Auto-301 on Slug Change & Delete, Loop/Chain Detection, Hit Count & CSV Import/Export', () => {
    it('blocks loops and chains, auto-creates 301 on published slug rename & delete, increments hitCount on public resolution, and imports/exports CSV', async () => {
      const harness = createInMemoryCmsHarness();
      const tx = (harness.service as any).db;
      let rSeq = 1;
      const nextRedirId = () => `20000000-0000-4000-8000-${String(rSeq++).padStart(12, '0')}`;

      tx.cmsRedirect = {
        findUnique: jest.fn(async ({ where }: any) => {
          for (const r of harness.redirects.values()) {
            if (r.id === where.id || r.sourcePath === where.sourcePath) return r;
          }
          return null;
        }),
        findFirst: jest.fn(async ({ where }: any) => {
          return (
            Array.from(harness.redirects.values()).find(
              (r) =>
                (!where?.sourcePath || r.sourcePath === where.sourcePath) &&
                (where?.isActive === undefined || r.isActive === where.isActive),
            ) ?? null
          );
        }),
        findMany: jest.fn(async () => Array.from(harness.redirects.values())),
        create: jest.fn(async ({ data }: any) => {
          const row = {
            id: nextRedirId(),
            hitCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          };
          harness.redirects.set(row.sourcePath, row);
          return row;
        }),
        upsert: jest.fn(async ({ where, create, update }: any) => {
          const existing = harness.redirects.get(where.sourcePath);
          if (existing) {
            const next = { ...existing, ...update, updatedAt: new Date() };
            harness.redirects.set(where.sourcePath, next);
            return next;
          }
          const created = {
            id: nextRedirId(),
            hitCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...create,
          };
          harness.redirects.set(where.sourcePath, created);
          return created;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          let target: any = null;
          for (const r of harness.redirects.values()) {
            if (r.id === where.id || r.sourcePath === where.sourcePath) {
              target = r;
              break;
            }
          }
          if (!target) throw new Error('Redirect not found');
          const next = { ...target, ...data, updatedAt: new Date() };
          if (data?.hitCount?.increment) {
            next.hitCount = (target.hitCount ?? 0) + data.hitCount.increment;
          }
          if (next.sourcePath !== target.sourcePath) {
            harness.redirects.delete(target.sourcePath);
          }
          harness.redirects.set(next.sourcePath, next);
          return next;
        }),
        delete: jest.fn(async ({ where }: any) => {
          for (const [k, r] of harness.redirects.entries()) {
            if (r.id === where.id) {
              harness.redirects.delete(k);
              return r;
            }
          }
          return null;
        }),
      };

      // 1. Manual 301 & 302 creation
      const r301 = await harness.service.createRedirect(
        { sourcePath: '/legacy-hr', destinationUrl: '/pricing', redirectType: 'permanent_301' },
        editorActor,
      );
      const r302 = await harness.service.createRedirect(
        { sourcePath: '/flash-sale', destinationUrl: '/contact', redirectType: 'temporary_302' },
        editorActor,
      );
      expect(r301.redirectType).toBe('permanent_301');
      expect(r302.redirectType).toBe('temporary_302');

      // 2. Self-loop and indirect loop/chain MUST be rejected
      await expect(
        harness.service.createRedirect(
          { sourcePath: '/loop-self', destinationUrl: '/loop-self' },
          editorActor,
        ),
      ).rejects.toThrow(BadRequestException);

      // Outgoing chain: /chain-start -> /legacy-hr (which already goes to /pricing)
      await expect(
        harness.service.createRedirect(
          { sourcePath: '/chain-start', destinationUrl: '/legacy-hr' },
          editorActor,
        ),
      ).rejects.toThrow(BadRequestException);

      // Incoming chain: /pricing -> /plans (when /legacy-hr already targets /pricing)
      await expect(
        harness.service.createRedirect(
          { sourcePath: '/pricing', destinationUrl: '/plans' },
          editorActor,
        ),
      ).rejects.toThrow(BadRequestException);

      // 3. Auto-301 on published page slug change (/old-campaign -> /new-campaign)
      const pubPage = await harness.service.createCustomPage(
        { slug: 'old-campaign', titleEn: 'Campaign' },
        editorActor,
      );
      await harness.service.publishPageNow(pubPage.id, { locale: 'en' }, publisherActor);
      await harness.service.updatePage(pubPage.id, { slug: 'new-campaign' }, editorActor);

      const autoSlugRedir = harness.redirects.get('/old-campaign');
      expect(autoSlugRedir).toBeDefined();
      expect(autoSlugRedir.destinationUrl).toBe('/new-campaign');
      expect(autoSlugRedir.redirectType).toBe('permanent_301');

      // 4. Deleting a page with redirectTarget creates 301 AND collapses /old-campaign -> /new-campaign -> /pricing into /pricing!
      await harness.service.trashOrDeletePage(pubPage.id, publisherActor, {
        confirmPublishedTitle: 'Campaign',
        redirectToPath: '/pricing',
      });
      expect(harness.redirects.get('/new-campaign')?.redirectType).toBe('permanent_301');
      expect(harness.redirects.get('/new-campaign')?.destinationUrl).toBe('/pricing');
      expect(harness.redirects.get('/old-campaign')?.destinationUrl).toBe('/pricing');

      // 5. Public redirect lookup increments hitCount accurately
      const hit1 = await harness.service.resolvePublicRedirect('/new-campaign');
      const hit2 = await harness.service.resolvePublicRedirect('/new-campaign');
      expect(hit1?.hitCount).toBe(1);
      expect(hit2?.hitCount).toBe(2);

      // 6. CSV Import & Export
      const csvInput = [
        'source_path,destination_url,redirect_type,is_active,note',
        '/csv-good,/features,301,true,Good CSV row',
        '/csv-temp,/demo,302,true,Temp promo',
        '/csv-chain,/legacy-hr,301,true,Should fail chain check',
      ].join('\n');
      const importSummary = await harness.service.importRedirectsCsv(csvInput, editorActor);
      expect(importSummary.created).toBe(2);
      expect(importSummary.skipped).toBe(1);
      expect(importSummary.errors).toHaveLength(1);
      expect(importSummary.errors[0].sourcePath).toBe('/csv-chain');

      const exported = await harness.service.exportRedirectsCsv();
      expect(exported).toContain('/csv-good,/features,permanent_301,true,0,Good CSV row');
      expect(exported).toContain('/new-campaign,/pricing,permanent_301,true,2,');
    });
  });

  describe('Site Settings: Contact, Emails, Social Links, Announcement Window, Footer/Cookie Wording, SEO & Default Language', () => {
    it('hydrates structured defaults, validates emails/URLs/announcement window, enforces Publisher+ write, and exposes public bundle', async () => {
      const harness = createInMemoryCmsHarness();
      const tx = (harness.service as any).db;
      tx.cmsSiteSetting = {
        ...tx.cmsSiteSetting,
        findMany: jest.fn(async ({ where }: any = {}) =>
          Array.from(harness.siteSettings.values()).filter((r: any) =>
            where?.isPublic !== undefined ? r.isPublic === where.isPublic : true,
          ),
        ),
      };

      // Content Editor cannot mutate site settings (Publisher+ only)
      await expect(
        harness.service.updateStructuredSiteSettings(
          { contact: { salesEmail: 'sales@acme.com' } },
          editorActor,
        ),
      ).rejects.toThrow(ForbiddenException);

      // Invalid email and invalid announcement schedule window rejected
      await expect(
        harness.service.updateStructuredSiteSettings(
          { contact: { salesEmail: 'not-an-email' } },
          publisherActor,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        harness.service.updateStructuredSiteSettings(
          {
            announcementBar: {
              enabled: true,
              startsAt: '2026-12-10T00:00:00.000Z',
              endsAt: '2026-12-01T00:00:00.000Z',
            },
          },
          publisherActor,
        ),
      ).rejects.toThrow(BadRequestException);

      // Publisher saves full multilingual Site Settings bundle
      const saved = await harness.service.updateStructuredSiteSettings(
        {
          contact: {
            companyName: { en: 'CMSN HR Technologies', bn: 'সিএমএসএন এইচআর টেকনোলজিস' },
            salesEmail: 'sales@cmsnbd.com',
            supportEmail: 'help@cmsnbd.com',
            phone: '+880 1800-111222',
          },
          socialLinks: {
            linkedin: 'https://linkedin.com/company/cmsn-hr',
            github: 'https://github.com/cmsn-hr',
          },
          announcementBar: {
            enabled: true,
            text: { en: 'Bangla Payroll 2026 Live', bn: 'বাংলা পেরোল ২০২৬ চালু হয়েছে' },
            linkLabel: { en: 'Learn more', bn: 'আরও জানুন' },
            linkUrl: '/changelog',
            startsAt: '2026-11-01T00:00:00.000Z',
            endsAt: '2026-12-31T23:59:59.000Z',
            dismissible: true,
          },
          cookieBanner: {
            title: { en: 'Privacy First Cookies', bn: 'প্রাইভেসি কুকিজ' },
          },
          seo: {
            defaultOgImageUrl: '/api/v1/public/content/media/hero-og/file',
          },
          locale: {
            defaultLanguage: 'bn',
          },
        },
        publisherActor,
      );

      expect(saved.contact.salesEmail).toBe('sales@cmsnbd.com');
      expect(saved.contact.supportEmail).toBe('help@cmsnbd.com');
      expect(saved.announcementBar.enabled).toBe(true);
      expect(saved.announcementBar.dismissible).toBe(true);
      expect(saved.cookieBanner.title.bn).toBe('প্রাইভেসি কুকিজ');
      expect(saved.seo.defaultOgImageUrl).toBe('/api/v1/public/content/media/hero-og/file');
      expect(saved.locale.defaultLanguage).toBe('bn');

      // Public content settings map exposes all updated sections
      const publicMap = await harness.service.listPublicSiteSettings();
      expect((publicMap['site.contact'] as any).supportEmail).toBe('help@cmsnbd.com');
      expect((publicMap['site.announcement'] as any).enabled).toBe(true);
      expect((publicMap['locale.config'] as any).defaultLanguage).toBe('bn');
      expect(harness.auditLogs.some((a) => a.action === 'cms.site_setting_updated')).toBe(true);
    });
  });

  describe('Blog CMS Workflow, Taxonomy, Reading Time, Scheduling & Related Posts', () => {
    it('manages categories & authors, computes reading time, filters posts, schedules publish, resolves related posts, and auto-redirects on published slug change', async () => {
      const harness = createInMemoryCmsHarness();

      // Editor cannot create category/author
      await expect(
        harness.service.createPostCategory(
          { slug: 'payroll', nameEn: 'Payroll' },
          editorActor,
        ),
      ).rejects.toThrow(ForbiddenException);

      const catPayroll = await harness.service.createPostCategory(
        { slug: 'payroll', nameEn: 'Payroll', nameBn: 'পেরোল', sortOrder: 1 },
        publisherActor,
      );
      const catEng = await harness.service.createPostCategory(
        { slug: 'engineering', nameEn: 'Engineering', nameBn: 'ইঞ্জিনিয়ারিং', sortOrder: 2 },
        publisherActor,
      );
      const authorOne = await harness.service.createAuthor(
        {
          slug: 'ariful-islam',
          displayName: 'Ariful Islam',
          roleTitle: 'Staff Payroll Architect',
        },
        publisherActor,
      );

      // Initially 0 published posts -> hasPublishedPosts is false
      const emptyPublic = await harness.service.listPublicPosts({ locale: 'en' });
      expect(emptyPublic.hasPublishedPosts).toBe(false);
      expect(emptyPublic.total).toBe(0);

      // Editor creates a 420-word draft post -> readingTimeMinutes automatically ~2 mins
      const words = Array.from({ length: 420 }, (_, i) => `word${i}`).join(' ');
      const post1 = await harness.service.createPostDraft(
        {
          slug: 'deterministic-payroll-engine',
          categoryId: catPayroll.id,
          authorId: authorOne.id,
          coverAltEn: 'Payroll diagram cover',
          titleEn: 'Deterministic Payroll Engine',
          titleBn: 'নির্ধারিত পেরোল ইঞ্জিন',
          excerptEn: 'How rule resolvers guarantee identical payroll runs.',
          bodyHtmlEn: `<p>${words}</p>`,
          bodyHtmlBn: '<p>বাংলা পেরোল বিস্তারিত</p>',
          isBnTranslated: true,
          seoTitleEn: 'Deterministic Payroll Engine | Blog',
          seoDescriptionEn: 'Deep dive into deterministic payroll.',
          tags: ['payroll', 'architecture'],
        },
        editorActor,
      );
      expect(post1.readingTimeMinutes).toBe(2);
      expect(post1.coverAltEn).toBe('Payroll diagram cover');
      expect(post1.status).toBe('draft');

      // Deleting category or author referenced by a post is rejected
      await expect(
        harness.service.deletePostCategory(catPayroll.id, publisherActor),
      ).rejects.toThrow(BadRequestException);
      await expect(
        harness.service.deleteAuthor(authorOne.id, publisherActor),
      ).rejects.toThrow(BadRequestException);

      // Schedule post1 for tomorrow -> still hidden from public until due
      const futureIso = new Date(Date.now() + 86_400_000).toISOString();
      const scheduled = await harness.service.schedulePostPublish(
        post1.id,
        { scheduledAt: futureIso, timezone: 'Asia/Dhaka' },
        publisherActor,
      );
      expect(scheduled.status).toBe('scheduled');
      expect((await harness.service.listPublicPosts()).hasPublishedPosts).toBe(false);

      // Run due scheduler with simulated future date -> promotes to published
      const jobRes = await harness.service.processDueScheduledPublications(
        new Date(Date.now() + 172_800_000),
      );
      expect(jobRes.postsPublished).toBe(1);

      // Create & publish post2 in same category & tag for related posts
      const post2 = await harness.service.createPostDraft(
        {
          slug: 'tax-slab-versioning',
          categoryId: catPayroll.id,
          authorId: authorOne.id,
          titleEn: 'Tax Slab Versioning',
          excerptEn: 'Effective dating for statutory tax tables.',
          bodyHtmlEn: '<p>Short guide to effective dated statutory brackets.</p>',
          tags: ['payroll'],
        },
        editorActor,
      );
      await harness.service.publishPostNow(post2.id, publisherActor);

      // Create draft post3 in engineering
      await harness.service.createPostDraft(
        {
          slug: 'offline-sync-queue',
          categoryId: catEng.id,
          authorId: authorOne.id,
          titleEn: 'Offline Sync Queue',
          excerptEn: 'Idempotent mobile punches.',
          bodyHtmlEn: '<p>Local UUID sync.</p>',
          tags: ['mobile'],
        },
        editorActor,
      );

      // Admin list filters cleanly
      const publishedOnly = await harness.service.listPosts({ status: 'published' });
      expect(publishedOnly.length).toBe(2);
      const draftOnly = await harness.service.listPosts({ status: 'draft' });
      expect(draftOnly.length).toBe(1);

      // Public query returns hasPublishedPosts = true & resolved relatedPosts
      const pubBn = await harness.service.getPublicPostBySlug('deterministic-payroll-engine', 'bn');
      expect(pubBn).not.toBeNull();
      expect(pubBn!.resolvedLocale).toBe('bn');
      expect(pubBn!.fallbackUsed).toBe(false);
      expect(pubBn!.relatedPosts?.some((r) => r.slug === 'tax-slab-versioning')).toBe(true);

      // Changing slug of published post creates automatic 301 redirect
      await harness.service.updatePostDraft(
        post1.id,
        { slug: 'deterministic-payroll-v2' },
        publisherActor,
      );
      const redir = await harness.service.resolvePublicRedirect('/blog/deterministic-payroll-engine');
      expect(redir?.destinationUrl).toBe('/blog/deterministic-payroll-v2');

      // Trash and permanently delete draft post3
      const trashed = await harness.service.trashPost(draftOnly[0].id, publisherActor);
      expect(trashed.status).toBe('trashed');
      await expect(
        harness.service.permanentlyDeletePost(trashed.id, 'wrong', publisherActor),
      ).rejects.toThrow(BadRequestException);
      const deleted = await harness.service.permanentlyDeletePost(
        trashed.id,
        'offline-sync-queue',
        publisherActor,
      );
      expect(deleted.deleted).toBe(true);
    });
  });

  describe('Changelog CMS Rich Text, Tags & Published-Only Visibility', () => {
    it('sanitizes rich text body, enforces publish permission for visibility, and exposes only published entries publicly', async () => {
      const harness = createInMemoryCmsHarness();

      // Editor creates a hidden draft entry with rich text body (XSS script stripped)
      const draft = await harness.service.createChangelogDraft(
        {
          slug: 'payroll-tax-engine-v2',
          releaseDate: '2026-11-26',
          tag: 'new',
          titleEn: 'Deterministic Payroll Engine v2',
          bodyHtmlEn: '<p>Launched effective-dated tax rules.</p><script>alert(1)</script>',
        },
        editorActor,
      );
      expect(draft.isPublished).toBe(false);
      expect(draft.bodyHtmlEn).toContain('Launched effective-dated tax rules.');
      expect(draft.bodyHtmlEn).not.toContain('<script>');
      expect(draft.summaryEn).toContain('Launched effective-dated tax rules.');

      // Hidden draft must NOT appear on public changelog API
      const publicBefore = await harness.service.listPublicChangelog({ locale: 'en' });
      expect(publicBefore.total).toBe(0);

      // Editor CANNOT publish / set visibility directly
      await expect(
        harness.service.updateChangelogDraft(draft.id, { isPublished: true }, editorActor),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        harness.service.setChangelogPublishState(draft.id, true, editorActor),
      ).rejects.toThrow(ForbiddenException);

      // Publisher marks visible + creates an improved entry and hidden entry
      const published = await harness.service.setChangelogPublishState(
        draft.id,
        true,
        publisherActor,
      );
      expect(published.isPublished).toBe(true);

      const improvedPublished = await harness.service.createChangelogDraft(
        {
          slug: 'attendance-sync-speedup',
          releaseDate: '2026-11-27',
          tag: 'improved',
          titleEn: 'Faster Offline Punch Reconciliation',
          titleBn: 'দ্রুত অফলাইন পাঞ্চ সমন্বয়',
          bodyHtmlEn: '<p>Reduced batch reconciliation latency by 40%.</p>',
          bodyHtmlBn: '<p>ব্যাচ সমন্বয়ের সময় ৪০% কমেছে।</p>',
          isBnTranslated: true,
          isPublished: true,
        },
        publisherActor,
      );
      expect(improvedPublished.isPublished).toBe(true);

      // Hidden fixed entry remains invisible publicly
      await harness.service.createChangelogDraft(
        {
          slug: 'internal-tax-rounding-fix',
          releaseDate: '2026-11-25',
          tag: 'fixed',
          titleEn: 'Tax Rounding Edge Case',
          bodyHtmlEn: '<p>Draft awaiting release verification.</p>',
        },
        editorActor,
      );

      // Public feed returns ONLY the 2 published entries in reverse releaseDate order
      const publicEn = await harness.service.listPublicChangelog({ locale: 'en' });
      expect(publicEn.total).toBe(2);
      expect(publicEn.items.map((e) => e.slug)).toEqual([
        'attendance-sync-speedup',
        'payroll-tax-engine-v2',
      ]);

      // Public tag filter
      const onlyNew = await harness.service.listPublicChangelog({ locale: 'en', tag: 'new' });
      expect(onlyNew.total).toBe(1);
      expect(onlyNew.items[0].slug).toBe('payroll-tax-engine-v2');

      // Admin visibility filter & unpublish removes from public feed
      const hiddenAdmin = await harness.service.listChangelog({ visibility: 'hidden' });
      expect(hiddenAdmin.length).toBe(1);

      await harness.service.updateChangelogDraft(
        published.id,
        { isPublished: false },
        publisherActor,
      );
      const publicAfterUnpublish = await harness.service.listPublicChangelog({ locale: 'en' });
      expect(publicAfterUnpublish.total).toBe(1);
      expect(publicAfterUnpublish.items[0].slug).toBe('attendance-sync-speedup');
    });
  });

  describe('Careers CMS Workflow, Apply Validation & Closed Friendly Status', () => {
    it('creates jobs with rich text, blocks invalid apply email/url, hides closed roles from index, and returns closed roles cleanly by slug instead of 404', async () => {
      const harness = createInMemoryCmsHarness();

      // Reject invalid email or unsafe apply URL
      await expect(
        harness.service.createCareerDraft(
          {
            slug: 'payroll-architect',
            locationType: 'remote',
            locationText: 'Dhaka / Remote',
            employmentType: 'full-time',
            titleEn: 'Staff Payroll Architect',
            descriptionHtmlEn: '<p>Build deterministic multi-country payroll rules.</p>',
            applyEmail: 'not-valid-email',
          },
          editorActor,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        harness.service.createCareerDraft(
          {
            slug: 'payroll-architect',
            locationType: 'remote',
            locationText: 'Dhaka / Remote',
            employmentType: 'full-time',
            titleEn: 'Staff Payroll Architect',
            descriptionHtmlEn: '<p>Build deterministic multi-country payroll rules.</p>',
            applyUrl: 'javascript:alert(1)',
          },
          editorActor,
        ),
      ).rejects.toThrow(BadRequestException);

      // Editor creates draft listing with XSS script stripped + valid email
      const role = await harness.service.createCareerDraft(
        {
          slug: 'staff-payroll-architect',
          department: 'Payroll Engineering',
          locationType: 'hybrid',
          locationText: 'Dhaka, Bangladesh',
          employmentType: 'full-time',
          titleEn: 'Staff Payroll Architect',
          descriptionHtmlEn: '<p>Design rule resolvers.</p><script>evil()</script>',
          applyEmail: 'talent@cmsnbd.com',
          applyUrl: 'https://jobs.cmsnbd.com/payroll-architect',
        },
        editorActor,
      );
      expect(role.status).toBe('draft');
      expect(role.descriptionHtmlEn).not.toContain('<script>');

      // Draft role is hidden on both index and detail lookup (null -> 404)
      expect((await harness.service.listPublicCareers({ locale: 'en' })).items.length).toBe(0);
      expect(await harness.service.getPublicCareerBySlug('staff-payroll-architect', 'en')).toBeNull();

      // Open role -> appears on open list AND detail lookup
      const opened = await harness.service.setCareerStatus(role.id, 'open', publisherActor);
      expect(opened.status).toBe('open');
      expect((await harness.service.listPublicCareers({ locale: 'en' })).items.length).toBe(1);
      const liveDetail = await harness.service.getPublicCareerBySlug('staff-payroll-architect', 'en');
      expect(liveDetail?.status).toBe('open');
      expect(liveDetail?.applyUrl).toBe('https://jobs.cmsnbd.com/payroll-architect');

      // Close role -> excluded from open list (empty state triggers!), YET getPublicCareerBySlug returns closed status (no 404!)
      const closed = await harness.service.setCareerStatus(role.id, 'closed', publisherActor);
      expect(closed.status).toBe('closed');
      expect((await harness.service.listPublicCareers({ locale: 'en' })).items.length).toBe(0);

      const closedDetail = await harness.service.getPublicCareerBySlug(
        'staff-payroll-architect',
        'en',
      );
      expect(closedDetail).not.toBeNull();
      expect(closedDetail?.status).toBe('closed');
      expect(closedDetail?.titleEn).toBe('Staff Payroll Architect');
    });
  });

  describe('FAQ Library CRUD, Topic Grouping & Per-Locale Public Query', () => {
    it('stores sanitized rich-text FAQ answers by topic, enforces publish permission, and resolves picked IDs in exact order per locale', async () => {
      const harness = createInMemoryCmsHarness();

      // Editor creates unpublished FAQ item -> sanitized & hidden publicly
      const f1 = await harness.service.createFaq(
        {
          category: 'Payroll Compliance',
          pageSlug: 'pricing',
          questionEn: 'How are statutory tax slabs versioned?',
          answerEn: '<p>Via effective-dated rule tables.</p><script>xss()</script>',
          questionBn: 'ট্যাক্স স্ল্যাব কীভাবে সংরক্ষিত হয়?',
          answerBn: '<p>কার্যকর তারিখের নিয়ম অনুযায়ী।</p>',
          isBnTranslated: true,
          sortOrder: 1,
        },
        editorActor,
      );
      expect(f1.category).toBe('payroll-compliance');
      expect(f1.isPublished).toBe(false);
      expect(f1.answerEn).not.toContain('<script>');

      // Editor cannot publish FAQ directly
      await expect(
        harness.service.updateFaq(f1.id, { isPublished: true }, editorActor),
      ).rejects.toThrow(ForbiddenException);

      // Unpublished FAQ is excluded from public query
      expect((await harness.service.listPublicFaqs({ locale: 'en' })).length).toBe(0);

      // Publisher publishes f1 and creates published f2 under billing
      await harness.service.updateFaq(f1.id, { isPublished: true }, publisherActor);
      const f2 = await harness.service.createFaq(
        {
          category: 'billing',
          questionEn: 'Do you support annual invoicing?',
          answerEn: '<p>Yes, annual agreements include GST/VAT invoicing.</p>',
          sortOrder: 2,
          isPublished: true,
        },
        publisherActor,
      );

      // Public query returns picked IDs in requested order + BN localization fallback status
      const pickedBn = await harness.service.listPublicFaqs({
        locale: 'bn',
        ids: [f2.id, f1.id],
      });
      expect(pickedBn.map((f) => f.id)).toEqual([f2.id, f1.id]);
      expect(pickedBn[0].resolvedLocale).toBe('en');
      expect(pickedBn[0].fallbackUsed).toBe(true);
      expect(pickedBn[1].resolvedLocale).toBe('bn');
      expect(pickedBn[1].fallbackUsed).toBe(false);
    });
  });
});
