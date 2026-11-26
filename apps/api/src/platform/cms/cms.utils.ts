import { createHash } from 'crypto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  CMS_SYSTEM_PAGE_DEFS,
  isSafeCmsLinkUrl,
  type CmsApprovalStatus,
  type CmsBlockNode,
  type CmsBrokenLinkOccurrenceDto,
  type CmsLocale,
  type CmsPageKind,
  type CmsPageStatus,
  type CmsResolvedPageDto,
  type CmsTranslationStatus,
} from '@hrm/shared-types';
import type { PlatformActorContext } from '../audit/platform-audit.service';
import {
  CMS_LEGAL_PAGE_SLUG_SET,
  CMS_LOCALES,
  CMS_RESERVED_SLUG_SET,
  CMS_SLUG_REGEX,
} from './cms.constants';

export interface ValidateSlugOptions {
  /** Reject platform/system reserved paths such as admin, api, _next. Default: true. */
  checkReserved?: boolean;
}

/**
 * Validates that a CMS slug is non-empty, strictly lowercase, URL-safe kebab-case,
 * and not on the platform reserved-path blocklist.
 */
export function assertValidCmsSlug(rawSlug: string, options: ValidateSlugOptions = {}): string {
  const { checkReserved = true } = options;
  if (typeof rawSlug !== 'string') {
    throw new BadRequestException({
      code: 'INVALID_CMS_SLUG',
      message: 'CMS slug must be a string.',
    });
  }

  const trimmed = rawSlug.trim();
  if (!trimmed) {
    throw new BadRequestException({
      code: 'INVALID_CMS_SLUG',
      message: 'CMS slug cannot be empty.',
    });
  }

  const lower = trimmed.toLowerCase();
  if (checkReserved && CMS_RESERVED_SLUG_SET.has(lower)) {
    throw new BadRequestException({
      code: 'RESERVED_CMS_SLUG',
      message: `Slug "${lower}" is reserved and cannot be used in CMS.`,
    });
  }

  if (trimmed !== lower || !CMS_SLUG_REGEX.test(trimmed)) {
    throw new BadRequestException({
      code: 'INVALID_CMS_SLUG',
      message:
        `Slug "${trimmed}" must be lowercase and URL-safe (letters a-z, digits 0-9, single hyphens only).`,
    });
  }

  return trimmed;
}

export interface SystemPageGuardInput {
  kind: CmsPageKind;
  slug: string;
  locked: boolean;
}

export interface SystemPageMutationAttempt {
  isDelete?: boolean;
  slug?: string;
  kind?: CmsPageKind;
  locked?: boolean;
  status?: CmsPageStatus;
  deletedAt?: Date | null;
}

/**
 * Enforces immutability of system page identity & availability:
 * system/locked pages cannot be deleted, trashed, renamed, unlocked, or unpublished.
 */
export function assertSystemPageMutationAllowed(
  page: SystemPageGuardInput,
  mutation: SystemPageMutationAttempt,
): void {
  const isSystem = page.kind === 'system' || page.locked === true;
  if (!isSystem) return;

  if (mutation.isDelete) {
    throw new ForbiddenException({
      code: 'SYSTEM_PAGE_LOCKED',
      message: `System page "${page.slug}" is locked and cannot be deleted.`,
    });
  }

  if (mutation.slug !== undefined && mutation.slug !== page.slug) {
    throw new ForbiddenException({
      code: 'SYSTEM_PAGE_LOCKED',
      message: `System page "${page.slug}" cannot be renamed to "${mutation.slug}".`,
    });
  }

  if (mutation.kind !== undefined && mutation.kind !== 'system') {
    throw new ForbiddenException({
      code: 'SYSTEM_PAGE_LOCKED',
      message: `System page "${page.slug}" cannot change kind away from system.`,
    });
  }

  if (mutation.locked === false) {
    throw new ForbiddenException({
      code: 'SYSTEM_PAGE_LOCKED',
      message: `System page "${page.slug}" cannot be unlocked.`,
    });
  }

  if (mutation.deletedAt !== undefined && mutation.deletedAt !== null) {
    throw new ForbiddenException({
      code: 'SYSTEM_PAGE_LOCKED',
      message: `System page "${page.slug}" cannot be soft-deleted.`,
    });
  }

  if (mutation.status === 'unpublished' || mutation.status === 'trashed') {
    throw new ForbiddenException({
      code: 'SYSTEM_PAGE_LOCKED',
      message: `System page "${page.slug}" cannot be unpublished or trashed.`,
    });
  }
}

export function assertValidCmsLocale(locale: string): CmsLocale {
  if (!CMS_LOCALES.includes(locale as CmsLocale)) {
    throw new BadRequestException({
      code: 'INVALID_CMS_LOCALE',
      message: `Unsupported CMS locale "${locale}". Supported locales: en, bn.`,
    });
  }
  return locale as CmsLocale;
}

export function isLegalCmsPage(slug: string, requiresApproval?: boolean): boolean {
  return Boolean(requiresApproval) || CMS_LEGAL_PAGE_SLUG_SET.has(slug.trim().toLowerCase());
}

/**
 * Checks whether an actor can author/edit drafts and generate previews.
 */
export function canEditCmsContent(actor?: PlatformActorContext | null): boolean {
  if (!actor) return false;
  const role = (actor.roleName || '').trim();
  if (
    role === 'Platform Owner' ||
    role === 'Platform Admin' ||
    role === 'Content Editor' ||
    role === 'Content Publisher'
  ) {
    return true;
  }
  return (actor.permissions || []).some(
    (p) =>
      (p.module === 'cms' &&
        (p.action === 'create' || p.action === 'edit' || p.action === 'manage')) ||
      (p.module === 'platform' && p.action === 'manage'),
  );
}

/**
 * Checks whether an actor can publish, schedule, unpublish, trash, restore,
 * or approve legal pages. Content Editors are explicitly excluded even if misconfigured.
 */
export function canPublishCmsContent(actor?: PlatformActorContext | null): boolean {
  if (!actor) return false;
  const role = (actor.roleName || '').trim();
  if (role === 'Content Editor') {
    return false;
  }
  if (role === 'Platform Owner' || role === 'Platform Admin' || role === 'Content Publisher') {
    return true;
  }
  return (actor.permissions || []).some(
    (p) =>
      (p.module === 'cms' && p.action === 'manage') ||
      (p.module === 'platform' && p.action === 'manage'),
  );
}

export function canUseCmsRawHtml(actor?: PlatformActorContext | null): boolean {
  if (!actor) return false;
  return (actor.permissions || []).some(
    (p) => p.module === 'cms' && p.action === 'raw_html',
  );
}

export function assertCmsEditAllowed(actor?: PlatformActorContext | null): void {
  if (!canEditCmsContent(actor)) {
    throw new ForbiddenException({
      code: 'CMS_EDIT_FORBIDDEN',
      message: 'CMS editing requires Content Editor, Content Publisher, Platform Admin, or Platform Owner privileges.',
    });
  }
}

export function assertCmsPublishAllowed(actor?: PlatformActorContext | null): void {
  if (!canPublishCmsContent(actor)) {
    throw new ForbiddenException({
      code: 'CMS_PUBLISH_FORBIDDEN',
      message:
        'Publishing, scheduling, unpublishing, trashing, and legal approvals require Content Publisher, Platform Admin, or Platform Owner privileges. Content Editors can only edit drafts.',
    });
  }
}

export function assertCmsLegalApprovalSatisfied(params: {
  slug: string;
  requiresApproval: boolean;
  approvalStatus: CmsApprovalStatus;
  pendingApprovalVersionId?: string | null;
  targetVersionIds: string[];
}): void {
  if (!isLegalCmsPage(params.slug, params.requiresApproval)) {
    return;
  }

  if (params.approvalStatus !== 'approved') {
    throw new ForbiddenException({
      code: 'CMS_LEGAL_APPROVAL_REQUIRED',
      message: `Legal page "${params.slug}" requires Stage F four-eyes approval before publishing or scheduling (current status: ${params.approvalStatus}).`,
    });
  }

  if (
    params.pendingApprovalVersionId &&
    params.targetVersionIds.length > 0 &&
    !params.targetVersionIds.includes(params.pendingApprovalVersionId)
  ) {
    throw new ForbiddenException({
      code: 'CMS_LEGAL_VERSION_MISMATCH',
      message: `Legal page "${params.slug}" approved version (${params.pendingApprovalVersionId}) does not match the version queued for publication.`,
    });
  }
}

/**
 * Validates an IANA timezone name (e.g., "Asia/Dhaka", "America/New_York", "UTC").
 */
export function assertValidIanaTimezone(rawTimezone?: string | null): string {
  const tz = (rawTimezone || 'UTC').trim() || 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    throw new BadRequestException({
      code: 'INVALID_TIMEZONE',
      message: `Invalid IANA timezone "${tz}".`,
    });
  }
}

function getTimeZoneDateParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const map = new Map<string, number>();
  for (const part of parts) {
    if (part.type !== 'literal') {
      map.set(part.type, Number(part.value));
    }
  }
  return {
    year: map.get('year') ?? 0,
    month: map.get('month') ?? 0,
    day: map.get('day') ?? 0,
    hour: (map.get('hour') ?? 0) % 24,
    minute: map.get('minute') ?? 0,
    second: map.get('second') ?? 0,
  };
}

/**
 * Parses a staff member's scheduled datetime into an authoritative UTC Date.
 * - If `rawDateTime` carries an explicit offset (`Z` or `+/-HH:mm`), parses directly.
 * - If `rawDateTime` is a local wall-clock string (`YYYY-MM-DDTHH:mm[:ss]`), interprets
 *   it strictly inside the staff member's IANA `timeZone` using DST-aware two-pass resolution.
 */
export function parseScheduledDateInTimezone(
  rawDateTime: string,
  rawTimezone?: string | null,
): { scheduledAtUtc: Date; timeZone: string } {
  const timeZone = assertValidIanaTimezone(rawTimezone);
  const input = (rawDateTime || '').trim();
  if (!input) {
    throw new BadRequestException({
      code: 'INVALID_SCHEDULED_AT',
      message: 'scheduledAt timestamp is required.',
    });
  }

  // Explicit offset or UTC Z present -> direct ISO parse
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(input)) {
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_SCHEDULED_AT',
        message: `Invalid ISO datetime "${input}".`,
      });
    }
    return { scheduledAtUtc: parsed, timeZone };
  }

  // Wall-clock date/time interpreted in staff member's IANA timezone
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    throw new BadRequestException({
      code: 'INVALID_SCHEDULED_AT',
      message:
        `Invalid scheduledAt "${input}". Expected "YYYY-MM-DDTHH:mm" (interpreted in ${timeZone}) or ISO-8601 with offset.`,
    });
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] ? Number(match[6]) : 0;

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    throw new BadRequestException({
      code: 'INVALID_SCHEDULED_AT',
      message: `Out-of-range calendar date/time "${input}".`,
    });
  }

  const desiredWallMs = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  // Ensure calendar day did not overflow (e.g. Feb 30)
  const checkCal = new Date(desiredWallMs);
  if (
    checkCal.getUTCFullYear() !== year ||
    checkCal.getUTCMonth() + 1 !== month ||
    checkCal.getUTCDate() !== day
  ) {
    throw new BadRequestException({
      code: 'INVALID_SCHEDULED_AT',
      message: `Invalid calendar date "${input}".`,
    });
  }

  // Two-pass fixed-point offset resolution for DST safety
  const p1 = getTimeZoneDateParts(new Date(desiredWallMs), timeZone);
  const tz1Ms = Date.UTC(p1.year, p1.month - 1, p1.day, p1.hour, p1.minute, p1.second, 0);
  const offset1 = tz1Ms - desiredWallMs;
  const candidate1 = desiredWallMs - offset1;

  const p2 = getTimeZoneDateParts(new Date(candidate1), timeZone);
  const tz2Ms = Date.UTC(p2.year, p2.month - 1, p2.day, p2.hour, p2.minute, p2.second, 0);
  const offset2 = tz2Ms - candidate1;
  const finalUtcMs = desiredWallMs - offset2;
  const scheduledAtUtc = new Date(finalUtcMs);

  const verify = getTimeZoneDateParts(scheduledAtUtc, timeZone);
  if (
    verify.year !== year ||
    verify.month !== month ||
    verify.day !== day ||
    verify.hour !== hour ||
    verify.minute !== minute
  ) {
    throw new BadRequestException({
      code: 'INVALID_DST_TIME',
      message: `Local time "${input}" does not exist cleanly in timezone "${timeZone}" (DST transition gap).`,
    });
  }

  return { scheduledAtUtc, timeZone };
}

/**
 * Generates deterministic ETag header values for public CMS responses.
 */
export function buildCmsETag(payload: unknown): string {
  const serialized = JSON.stringify(payload);
  const digest = createHash('sha256').update(serialized).digest('hex').slice(0, 24);
  return `"cms-${digest}"`;
}

export function isIfNoneMatchHit(
  ifNoneMatchHeader: string | string[] | undefined,
  currentEtag: string,
): boolean {
  if (!ifNoneMatchHeader) return false;
  const raw = Array.isArray(ifNoneMatchHeader) ? ifNoneMatchHeader.join(',') : ifNoneMatchHeader;
  const normalizedTarget = currentEtag.replace(/^W\//i, '').trim();

  return raw
    .split(',')
    .map((part) => part.trim())
    .some((candidate) => {
      if (!candidate) return false;
      if (candidate === '*') return true;
      return candidate.replace(/^W\//i, '') === normalizedTarget;
    });
}

export interface PageVersionSnapshotRecord {
  id: string;
  pageId: string;
  versionNumber: number;
  locale: CmsLocale;
  title: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalPath?: string | null;
  ogImageUrl?: string | null;
  noIndex: boolean;
  blocks: unknown;
  isTranslated: boolean;
  authorId?: string | null;
  authorName?: string | null;
  changeNote?: string | null;
  createdAt: Date | string;
}

export interface PageLocalePointerRecord {
  locale: CmsLocale;
  isTranslated: boolean;
  translationStatus: CmsTranslationStatus;
  currentDraftVersionId?: string | null;
  currentPublishedVersionId?: string | null;
}

/**
 * Resolves a published CMS page for the requested locale (`en` or `bn`) with
 * deterministic fallback to `en` when `bn` is untranslated or unpublished.
 */
export function resolveLocalizedPageVersion(params: {
  page: {
    id: string;
    kind: CmsPageKind;
    slug: string;
    status: CmsPageStatus;
    locked: boolean;
    requiresApproval?: boolean;
    approvalStatus?: CmsApprovalStatus;
    currentPublishedVersionId?: string | null;
  };
  locales: PageLocalePointerRecord[];
  versionsById: ReadonlyMap<string, PageVersionSnapshotRecord>;
  requestedLocale: CmsLocale;
  mode?: 'published' | 'draft';
}): CmsResolvedPageDto | null {
  const { page, locales, versionsById, requestedLocale, mode = 'published' } = params;
  const reqRow = locales.find((l) => l.locale === requestedLocale);
  const enRow = locales.find((l) => l.locale === 'en');

  const pickVersionId = (row?: PageLocalePointerRecord): string | null | undefined =>
    mode === 'draft' ? row?.currentDraftVersionId || row?.currentPublishedVersionId : row?.currentPublishedVersionId;

  let chosenLocale: CmsLocale = requestedLocale;
  const reqVersionId = pickVersionId(reqRow);
  let chosenVersion =
    (mode === 'draft' || reqRow?.isTranslated) && reqVersionId
      ? versionsById.get(reqVersionId)
      : undefined;

  let fallbackUsed = false;
  if (!chosenVersion && requestedLocale !== 'en') {
    fallbackUsed = true;
    chosenLocale = 'en';
    const fallbackVersionId = pickVersionId(enRow) || page.currentPublishedVersionId;
    if (fallbackVersionId) {
      chosenVersion = versionsById.get(fallbackVersionId);
    }
  } else if (!chosenVersion && requestedLocale === 'en') {
    const enVersionId = pickVersionId(enRow) || page.currentPublishedVersionId;
    if (enVersionId) {
      chosenVersion = versionsById.get(enVersionId);
    }
  }

  if (!chosenVersion) {
    return null;
  }

  const createdAt =
    chosenVersion.createdAt instanceof Date
      ? chosenVersion.createdAt.toISOString()
      : String(chosenVersion.createdAt);

  return {
    pageId: page.id,
    kind: page.kind,
    slug: page.slug,
    status: page.status,
    locked: page.locked,
    requiresApproval: page.requiresApproval,
    approvalStatus: page.approvalStatus,
    requestedLocale,
    resolvedLocale: chosenLocale,
    fallbackUsed,
    isTranslated:
      requestedLocale === 'en'
        ? true
        : Boolean((mode === 'draft' || reqRow?.isTranslated) && !fallbackUsed),
    translationStatus:
      requestedLocale === 'en'
        ? (enRow?.translationStatus ?? 'translated')
        : (reqRow?.translationStatus ?? 'untranslated'),
    version: {
      id: chosenVersion.id,
      pageId: chosenVersion.pageId,
      versionNumber: chosenVersion.versionNumber,
      locale: chosenVersion.locale,
      title: chosenVersion.title,
      seoTitle: chosenVersion.seoTitle ?? null,
      seoDescription: chosenVersion.seoDescription ?? null,
      canonicalPath: chosenVersion.canonicalPath ?? null,
      ogImageUrl: chosenVersion.ogImageUrl ?? null,
      noIndex: Boolean(chosenVersion.noIndex),
      blocks: Array.isArray(chosenVersion.blocks)
        ? (chosenVersion.blocks as CmsBlockNode[])
        : [],
      isTranslated: Boolean(chosenVersion.isTranslated),
      authorId: chosenVersion.authorId ?? null,
      authorName: chosenVersion.authorName ?? null,
      changeNote: chosenVersion.changeNote ?? null,
      createdAt,
    },
  };
}

const KNOWN_WEBSITE_STATIC_PATHS = new Set<string>([
  '/',
  '/login',
  '/signup',
  '/404',
  ...CMS_SYSTEM_PAGE_DEFS.map((d) => d.canonicalPath),
]);

export function normalizeInternalCmsPath(rawHref: string): string {
  const withoutHash = rawHref.split('#')[0] ?? '';
  const withoutQuery = withoutHash.split('?')[0] ?? '';
  let trimmed = withoutQuery.trim();
  if (!trimmed || trimmed === '/') return '/';
  if (!trimmed.startsWith('/')) return trimmed;
  if (trimmed.length > 1 && trimmed.endsWith('/')) {
    trimmed = trimmed.slice(0, -1);
  }
  // Strip optional /bn or /en locale prefix to match canonical website paths
  if (trimmed === '/bn' || trimmed === '/en') return '/';
  if (trimmed.startsWith('/bn/') || trimmed.startsWith('/en/')) {
    trimmed = trimmed.slice(3);
  }
  return trimmed || '/';
}

export function collectBlockLinks(
  blocks: unknown[],
  out: Array<{ blockId: string; blockType: string; href: string }>,
): void {
  for (const raw of blocks) {
    if (!raw || typeof raw !== 'object') continue;
    const block = raw as { id?: unknown; type?: unknown; props?: unknown };
    const blockId = typeof block.id === 'string' ? block.id : 'unknown';
    const blockType = typeof block.type === 'string' ? block.type : 'unknown';
    const props = (block.props && typeof block.props === 'object'
      ? block.props
      : {}) as Record<string, unknown>;

    if (blockType === 'button' && typeof props.href === 'string') {
      out.push({ blockId, blockType, href: props.href });
    } else if (blockType === 'feature_cards' && Array.isArray(props.cards)) {
      for (const card of props.cards) {
        if (card && typeof card === 'object') {
          const href = (card as { linkHref?: unknown }).linkHref;
          if (typeof href === 'string' && href.trim()) {
            out.push({ blockId, blockType, href });
          }
        }
      }
    } else if (blockType === 'cta_band') {
      const primary = props.primaryButton as { href?: unknown } | undefined;
      const secondary = props.secondaryButton as { href?: unknown } | undefined;
      if (typeof primary?.href === 'string') {
        out.push({ blockId, blockType, href: primary.href });
      }
      if (typeof secondary?.href === 'string') {
        out.push({ blockId, blockType, href: secondary.href });
      }
    } else if (blockType === 'rich_text' && typeof props.html === 'string') {
      const anchorRegex = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/gi;
      let m: RegExpExecArray | null;
      while ((m = anchorRegex.exec(props.html)) !== null) {
        const href = (m[1] ?? m[2] ?? m[3] ?? '').trim();
        if (href) {
          out.push({ blockId, blockType, href });
        }
      }
    } else if (blockType === 'columns' && Array.isArray(props.columns)) {
      for (const col of props.columns) {
        if (col && typeof col === 'object' && Array.isArray((col as { blocks?: unknown[] }).blocks)) {
          collectBlockLinks((col as { blocks: unknown[] }).blocks, out);
        }
      }
    }
  }
}

export function collectMediaReferencesFromBlocks(
  blocks: unknown[],
  mediaId: string,
  out: Array<{ blockId: string; blockType: string; field: string }>,
): void {
  if (!Array.isArray(blocks)) return;
  const mediaPathNeedle = `/media/${mediaId}/file`;

  for (const raw of blocks) {
    if (!raw || typeof raw !== 'object') continue;
    const block = raw as { id?: unknown; type?: unknown; props?: unknown };
    const blockId = typeof block.id === 'string' ? block.id : 'unknown';
    const blockType = typeof block.type === 'string' ? block.type : 'unknown';
    const props = (block.props && typeof block.props === 'object'
      ? block.props
      : {}) as Record<string, unknown>;

    if (blockType === 'image' && props.mediaId === mediaId) {
      out.push({ blockId, blockType, field: 'mediaId' });
    } else if (blockType === 'rich_text' && typeof props.html === 'string') {
      if (props.html.includes(mediaPathNeedle) || props.html.includes(mediaId)) {
        out.push({ blockId, blockType, field: 'html' });
      }
    } else if (blockType === 'button' && typeof props.href === 'string') {
      if (props.href.includes(mediaPathNeedle)) {
        out.push({ blockId, blockType, field: 'href' });
      }
    } else if (blockType === 'feature_cards' && Array.isArray(props.cards)) {
      for (const card of props.cards) {
        if (
          card &&
          typeof card === 'object' &&
          typeof (card as { linkHref?: unknown }).linkHref === 'string' &&
          ((card as { linkHref: string }).linkHref.includes(mediaPathNeedle))
        ) {
          out.push({ blockId, blockType, field: 'card.linkHref' });
        }
      }
    } else if (blockType === 'cta_band') {
      const pHref = (props.primaryButton as { href?: unknown } | undefined)?.href;
      const sHref = (props.secondaryButton as { href?: unknown } | undefined)?.href;
      if (
        (typeof pHref === 'string' && pHref.includes(mediaPathNeedle)) ||
        (typeof sHref === 'string' && sHref.includes(mediaPathNeedle))
      ) {
        out.push({ blockId, blockType, field: 'cta_band.button' });
      }
    } else if (blockType === 'columns' && Array.isArray(props.columns)) {
      for (const col of props.columns) {
        if (col && typeof col === 'object' && Array.isArray((col as { blocks?: unknown[] }).blocks)) {
          collectMediaReferencesFromBlocks((col as { blocks: unknown[] }).blocks, mediaId, out);
        }
      }
    }
  }
}

export interface RedirectTopologyCandidate {
  id?: string;
  sourcePath: string;
  destinationUrl: string;
  isActive?: boolean;
}

/**
 * Normalizes a redirect source path (must start with "/", lowercased without trailing slash or hash/query).
 */
export function normalizeRedirectSourcePath(rawSource: string): string {
  const cleaned = normalizeInternalCmsPath(rawSource);
  if (!cleaned.startsWith('/')) {
    throw new BadRequestException({
      code: 'CMS_INVALID_REDIRECT_SOURCE',
      message: `Redirect source path "${rawSource}" must be a relative path starting with "/".`,
    });
  }
  return cleaned.toLowerCase();
}

/**
 * Validates that a new/updated redirect rule will NOT create a redirect loop (A->A, A->B->A)
 * or redirect chain (A->B when B->C already exists, or C->A when A->B is being added).
 */
export function assertNoRedirectLoopOrChain(
  candidate: RedirectTopologyCandidate,
  existingRules: Array<{
    id: string;
    sourcePath: string;
    destinationUrl: string;
    isActive: boolean;
  }>,
): void {
  const src = normalizeRedirectSourcePath(candidate.sourcePath);
  const destTrimmed = (candidate.destinationUrl || '').trim();
  if (!isSafeCmsLinkUrl(destTrimmed)) {
    throw new BadRequestException({
      code: 'CMS_INVALID_REDIRECT_TARGET',
      message: `Unsafe or invalid redirect destination "${destTrimmed}".`,
    });
  }

  const destNorm = destTrimmed.startsWith('/')
    ? normalizeInternalCmsPath(destTrimmed).toLowerCase()
    : null;

  if (destNorm && destNorm === src) {
    throw new BadRequestException({
      code: 'CMS_REDIRECT_LOOP',
      message: `Redirect loop detected: "${src}" cannot redirect to itself.`,
    });
  }

  const activeBySource = new Map<string, { id: string; sourcePath: string; destinationUrl: string }>();
  for (const r of existingRules) {
    if (candidate.id && r.id === candidate.id) continue;
    if (!r.isActive) continue;
    activeBySource.set(normalizeRedirectSourcePath(r.sourcePath), {
      id: r.id,
      sourcePath: normalizeRedirectSourcePath(r.sourcePath),
      destinationUrl: r.destinationUrl,
    });
  }

  // If candidate itself is inactive, no runtime loop/chain is introduced
  if (candidate.isActive === false || !destNorm) {
    return;
  }

  // 1. Outgoing chain / cycle check: destNorm is already a source of another redirect
  const firstHop = activeBySource.get(destNorm);
  if (firstHop) {
    // Walk to distinguish indirect cycle (loop) from chain
    const visited = new Set<string>([src, destNorm]);
    let cursorDest = firstHop.destinationUrl;
    for (let step = 0; step < 20; step++) {
      if (!cursorDest.startsWith('/')) break;
      const nextNorm = normalizeInternalCmsPath(cursorDest).toLowerCase();
      if (nextNorm === src) {
        throw new BadRequestException({
          code: 'CMS_REDIRECT_LOOP',
          message: `Redirect loop detected: "${src}" -> "${destNorm}" -> ... -> "${src}".`,
        });
      }
      if (visited.has(nextNorm)) {
        throw new BadRequestException({
          code: 'CMS_REDIRECT_LOOP',
          message: `Redirect loop detected involving "${nextNorm}".`,
        });
      }
      visited.add(nextNorm);
      const nextHop = activeBySource.get(nextNorm);
      if (!nextHop) break;
      cursorDest = nextHop.destinationUrl;
    }

    throw new BadRequestException({
      code: 'CMS_REDIRECT_CHAIN',
      message: `Redirect chain detected: "${destNorm}" already redirects to "${firstHop.destinationUrl}". Point "${src}" directly to "${cursorDest}" instead.`,
    });
  }

  // 2. Incoming chain check: another active rule already points TO src
  for (const r of activeBySource.values()) {
    if (!r.destinationUrl.startsWith('/')) continue;
    const existingDest = normalizeInternalCmsPath(r.destinationUrl).toLowerCase();
    if (existingDest === src) {
      throw new BadRequestException({
        code: 'CMS_REDIRECT_CHAIN',
        message: `Redirect chain detected: existing rule "${r.sourcePath}" redirects to "${src}". Update "${r.sourcePath}" to point directly to "${destTrimmed}" instead.`,
      });
    }
  }
}

export interface CmsLinkResolutionContext {
  validPaths: ReadonlySet<string>;
  validPostSlugs: ReadonlySet<string>;
  validCareerSlugs: ReadonlySet<string>;
  validMediaIds: ReadonlySet<string>;
}

/**
 * Builds an in-memory set of known valid internal routes for CMS link integrity checks.
 */
export function buildCmsLinkResolutionContext(params: {
  pageSlugs: string[];
  canonicalPaths?: string[];
  redirectSourcePaths?: string[];
  postSlugs?: string[];
  careerSlugs?: string[];
  mediaIds?: string[];
}): CmsLinkResolutionContext {
  const validPaths = new Set<string>(KNOWN_WEBSITE_STATIC_PATHS);

  for (const slug of params.pageSlugs) {
    const clean = slug.trim().toLowerCase();
    if (!clean) continue;
    validPaths.add(`/${clean}`);
    validPaths.add(`/p/${clean}`);
  }
  for (const canonical of params.canonicalPaths ?? []) {
    if (canonical && canonical.startsWith('/')) {
      validPaths.add(normalizeInternalCmsPath(canonical));
    }
  }
  for (const redir of params.redirectSourcePaths ?? []) {
    if (redir && redir.startsWith('/')) {
      validPaths.add(normalizeInternalCmsPath(redir));
    }
  }

  return {
    validPaths,
    validPostSlugs: new Set((params.postSlugs ?? []).map((s) => s.trim().toLowerCase())),
    validCareerSlugs: new Set((params.careerSlugs ?? []).map((s) => s.trim().toLowerCase())),
    validMediaIds: new Set(params.mediaIds ?? []),
  };
}

/**
 * Scans CMS blocks for malformed URLs, missing Media Library assets, or unresolved internal routes.
 */
export function findBrokenCmsLinksInBlocks(params: {
  pageId: string;
  slug: string;
  pageStatus: CmsPageStatus;
  locale: CmsLocale;
  versionNumber: number;
  blocks: unknown;
  context: CmsLinkResolutionContext;
}): CmsBrokenLinkOccurrenceDto[] {
  if (!Array.isArray(params.blocks)) return [];
  const extracted: Array<{ blockId: string; blockType: string; href: string }> = [];
  collectBlockLinks(params.blocks, extracted);

  const occurrences: CmsBrokenLinkOccurrenceDto[] = [];
  for (const link of extracted) {
    const trimmed = link.href.trim();
    if (!trimmed) continue;

    if (!isSafeCmsLinkUrl(trimmed)) {
      occurrences.push({
        pageId: params.pageId,
        slug: params.slug,
        pageStatus: params.pageStatus,
        locale: params.locale,
        versionNumber: params.versionNumber,
        blockId: link.blockId,
        blockType: link.blockType,
        href: trimmed,
        reason: 'Unsafe or malformed link scheme',
      });
      continue;
    }

    // Fragment links (#section) and external http/https/mailto URLs are structurally valid
    if (!trimmed.startsWith('/')) {
      continue;
    }

    const mediaMatch = trimmed.match(
      /^\/api\/v1\/public\/content\/media\/([0-9a-f-]{36})\/file(?:\?.*)?$/i,
    );
    if (mediaMatch) {
      if (!params.context.validMediaIds.has(mediaMatch[1])) {
        occurrences.push({
          pageId: params.pageId,
          slug: params.slug,
          pageStatus: params.pageStatus,
          locale: params.locale,
          versionNumber: params.versionNumber,
          blockId: link.blockId,
          blockType: link.blockType,
          href: trimmed,
          reason: 'Referenced CMS Media asset no longer exists',
        });
      }
      continue;
    }

    // Allow API endpoints & static asset prefixes
    if (trimmed.startsWith('/api/') || trimmed.startsWith('/_next/')) {
      continue;
    }

    const normalized = normalizeInternalCmsPath(trimmed);
    if (params.context.validPaths.has(normalized)) {
      continue;
    }

    if (normalized.startsWith('/blog/')) {
      const postSlug = normalized.slice('/blog/'.length).toLowerCase();
      if (params.context.validPostSlugs.has(postSlug)) {
        continue;
      }
    }

    if (normalized.startsWith('/careers/')) {
      const careerSlug = normalized.slice('/careers/'.length).toLowerCase();
      if (params.context.validCareerSlugs.has(careerSlug)) {
        continue;
      }
    }

    occurrences.push({
      pageId: params.pageId,
      slug: params.slug,
      pageStatus: params.pageStatus,
      locale: link.blockType === 'rich_text' ? params.locale : params.locale,
      versionNumber: params.versionNumber,
      blockId: link.blockId,
      blockType: link.blockType,
      href: trimmed,
      reason: `Internal route "${normalized}" does not match any active page, post, career, or redirect`,
    });
  }

  return occurrences;
}

function assertLeafBlockStructureMatch(
  pageSlug: string,
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
  pathLabel: string,
): void {
  if (expected.id !== actual.id || expected.type !== actual.type) {
    throw new ForbiddenException({
      code: 'SYSTEM_PAGE_STRUCTURE_LOCKED',
      message: `System page "${pageSlug}" structure is locked at ${pathLabel}: expected ${String(expected.type)}("${String(expected.id)}") but received ${String(actual.type)}("${String(actual.id)}").`,
    });
  }

  if (expected.type === 'dynamic_block') {
    const expWidget = (expected.props as { widget?: unknown } | undefined)?.widget;
    const actWidget = (actual.props as { widget?: unknown } | undefined)?.widget;
    if (expWidget !== actWidget) {
      throw new ForbiddenException({
        code: 'SYSTEM_PAGE_DYNAMIC_BLOCK_LOCKED',
        message: `Dynamic block "${String(expected.id)}" on system page "${pageSlug}" is locked to widget "${String(expWidget)}" and cannot be changed or removed.`,
      });
    }
  }
}

/**
 * Enforces that locked/system pages preserve their fixed block skeleton, column ratios/slots,
 * and dynamic widget placeholders (`pricing_table`, `country_list`, `plan_comparison`).
 * Text, buttons, images, FAQ picks, and surrounding copy remain editable.
 */
export function assertSystemPageStructurePreserved(params: {
  pageSlug: string;
  kind: CmsPageKind;
  locked: boolean;
  baselineBlocks: unknown;
  candidateBlocks: unknown;
}): void {
  const isSystem = params.kind === 'system' || params.locked === true;
  if (!isSystem) return;
  if (!Array.isArray(params.baselineBlocks) || params.baselineBlocks.length === 0) {
    return;
  }
  if (!Array.isArray(params.candidateBlocks)) {
    throw new ForbiddenException({
      code: 'SYSTEM_PAGE_STRUCTURE_LOCKED',
      message: `System page "${params.pageSlug}" requires a valid block list matching its locked layout.`,
    });
  }

  const base = params.baselineBlocks as Array<Record<string, unknown>>;
  const cand = params.candidateBlocks as Array<Record<string, unknown>>;

  if (base.length !== cand.length) {
    throw new ForbiddenException({
      code: 'SYSTEM_PAGE_STRUCTURE_LOCKED',
      message: `System page "${params.pageSlug}" layout is locked (${base.length} fixed blocks required, received ${cand.length}). Blocks cannot be added or removed.`,
    });
  }

  for (let i = 0; i < base.length; i++) {
    const exp = base[i];
    const act = cand[i];
    assertLeafBlockStructureMatch(params.pageSlug, exp, act, `block[${i}]`);

    if (exp.type === 'columns') {
      const expProps = (exp.props ?? {}) as {
        ratio?: unknown;
        columns?: Array<{ blocks?: Array<Record<string, unknown>> }>;
      };
      const actProps = (act.props ?? {}) as {
        ratio?: unknown;
        columns?: Array<{ blocks?: Array<Record<string, unknown>> }>;
      };

      const expCols = Array.isArray(expProps.columns) ? expProps.columns : [];
      const actCols = Array.isArray(actProps.columns) ? actProps.columns : [];
      if (expProps.ratio !== actProps.ratio || expCols.length !== actCols.length) {
        throw new ForbiddenException({
          code: 'SYSTEM_PAGE_STRUCTURE_LOCKED',
          message: `Columns block "${String(exp.id)}" layout on system page "${params.pageSlug}" is locked.`,
        });
      }

      for (let c = 0; c < expCols.length; c++) {
        const expColBlocks = Array.isArray(expCols[c]?.blocks) ? expCols[c].blocks! : [];
        const actColBlocks = Array.isArray(actCols[c]?.blocks) ? actCols[c].blocks! : [];
        if (expColBlocks.length !== actColBlocks.length) {
          throw new ForbiddenException({
            code: 'SYSTEM_PAGE_STRUCTURE_LOCKED',
            message: `Column ${c + 1} inside "${String(exp.id)}" on system page "${params.pageSlug}" is locked and cannot add/remove blocks.`,
          });
        }
        for (let j = 0; j < expColBlocks.length; j++) {
          assertLeafBlockStructureMatch(
            params.pageSlug,
            expColBlocks[j],
            actColBlocks[j],
            `columns[${c}].block[${j}]`,
          );
        }
      }
    }
  }
}

/**
 * Estimates reading time in whole minutes (minimum 1, 200 words/minute)
 * across English and optional Bengali HTML bodies.
 */
export function computeCmsReadingTimeMinutes(
  htmlEn?: string | null,
  htmlBn?: string | null,
): number {
  const countWords = (html?: string | null): number => {
    if (!html || !html.trim()) return 0;
    const text = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  };
  const words = Math.max(countWords(htmlEn), countWords(htmlBn));
  return Math.max(1, Math.min(120, Math.round(words / 200)));
}
