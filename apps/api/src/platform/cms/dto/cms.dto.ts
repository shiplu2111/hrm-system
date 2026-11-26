import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type {
  CmsCustomPageTemplate,
  CmsLocale,
  CmsRedirectType,
  CmsTranslationStatus,
} from '@hrm/shared-types';

export class CreateCmsCustomPageDto {
  @ApiProperty({ example: 'winter-launch' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug!: string;

  @ApiProperty({ example: 'Winter Product Launch' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  titleEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  seoTitleEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescriptionEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  ogImageUrlEn?: string;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  @IsOptional()
  @IsArray()
  blocksEn?: unknown[];

  @ApiPropertyOptional({ enum: ['standard', 'landing', 'legal'] })
  @IsOptional()
  @IsIn(['standard', 'landing', 'legal'])
  templateKey?: CmsCustomPageTemplate;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  menuId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  menuItemLabelEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  menuItemLabelBn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeNote?: string;
}

export class CreateCmsPageVersionDto {
  @ApiProperty({ enum: ['en', 'bn'] })
  @IsIn(['en', 'bn'])
  locale!: CmsLocale;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  seoTitle?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  canonicalPath?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  ogImageUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  noIndex?: boolean;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  @IsArray()
  blocks!: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isTranslated?: boolean;

  @ApiPropertyOptional({ enum: ['untranslated', 'in_review', 'translated'] })
  @IsOptional()
  @IsIn(['untranslated', 'in_review', 'translated'])
  translationStatus?: CmsTranslationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeNote?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  publishImmediately?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  baseVersionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedVersionNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAutosave?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  forceOverwrite?: boolean;
}

export class RestoreCmsPageVersionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CmsPresenceHeartbeatDto {
  @ApiProperty({ enum: ['en', 'bn'] })
  @IsIn(['en', 'bn'])
  locale!: CmsLocale;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  sessionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  baseVersionNumber?: number;
}

export class DuplicateCmsPageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titleEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CreateCmsPreviewTokenDto {
  @ApiPropertyOptional({ enum: ['en', 'bn'], default: 'en' })
  @IsOptional()
  @IsIn(['en', 'bn'])
  locale?: CmsLocale;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  versionId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 1440, default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  ttlMinutes?: number;
}

export class PublishCmsPageDto {
  @ApiPropertyOptional({ enum: ['en', 'bn'] })
  @IsOptional()
  @IsIn(['en', 'bn'])
  locale?: CmsLocale;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  versionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ScheduleCmsPublishDto {
  @ApiProperty({
    description: 'Wall-clock YYYY-MM-DDTHH:mm in staff timezone or ISO-8601 datetime with offset',
    example: '2026-12-01T09:00',
  })
  @IsString()
  @MinLength(1)
  scheduledAt!: string;

  @ApiPropertyOptional({
    description: 'IANA timezone override; defaults to staff user timezone',
    example: 'Asia/Dhaka',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @ApiPropertyOptional({ enum: ['en', 'bn'] })
  @IsOptional()
  @IsIn(['en', 'bn'])
  locale?: CmsLocale;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  versionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UnpublishCmsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SubmitLegalApprovalDto {
  @ApiPropertyOptional({ enum: ['en', 'bn'], default: 'en' })
  @IsOptional()
  @IsIn(['en', 'bn'])
  locale?: CmsLocale;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  versionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ApproveLegalCmsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  publishNow?: boolean;
}

export class RejectLegalCmsDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class UpdateCmsPageSlugDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug?: string;
}

export class UpsertCmsPostDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  slug!: string;

  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiProperty()
  @IsUUID()
  authorId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  coverMediaId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  coverAltEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  coverAltBn?: string | null;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  titleEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  titleBn?: string | null;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  excerptEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  excerptBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  bodyJsonEn?: Record<string, unknown>;

  @ApiProperty()
  @IsString()
  bodyHtmlEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  bodyJsonBn?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bodyHtmlBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBnTranslated?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoTitleEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(320)
  seoDescriptionEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoTitleBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(320)
  seoDescriptionBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  publishedAt?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  relatedPostIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  readingTimeMinutes?: number;
}

export class UpsertCmsPostCategoryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nameEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descriptionEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descriptionBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;
}

export class UpsertCmsAuthorDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  displayName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayNameBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  roleTitle?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  roleTitleBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1500)
  bioEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1500)
  bioBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  avatarMediaId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PermanentDeleteCmsPostDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  confirmText!: string;
}

export class UpsertCmsChangelogDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  versionLabel?: string;

  @ApiProperty({ example: '2026-11-26' })
  @IsString()
  releaseDate!: string;

  @ApiProperty({ enum: ['new', 'improved', 'fixed', 'security'] })
  @IsIn(['new', 'improved', 'fixed', 'security'])
  tag!: 'new' | 'improved' | 'fixed' | 'security';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  moduleRefs?: string | null;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  titleEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summaryEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bodyHtmlEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  bodyJsonEn?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  highlightsEn?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  titleBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summaryBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bodyHtmlBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  bodyJsonBn?: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  highlightsBn?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBnTranslated?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpsertCmsCareerDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(60)
  locationType!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  locationText!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(60)
  employmentType!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titleEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  summaryEn?: string;

  @ApiProperty()
  @IsString()
  descriptionHtmlEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  descriptionJsonEn?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  summaryBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descriptionHtmlBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  descriptionJsonBn?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBnTranslated?: boolean;

  @ApiPropertyOptional({ enum: ['draft', 'open', 'paused', 'closed'] })
  @IsOptional()
  @IsIn(['draft', 'open', 'paused', 'closed'])
  status?: 'draft' | 'open' | 'paused' | 'closed';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  applyEmail?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  applyUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  closesAt?: string | null;
}

export class UpsertCmsFaqDto {
  @ApiProperty({ example: 'pricing' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  category!: string;

  @ApiPropertyOptional({ example: 'pricing' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  pageSlug?: string | null;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(400)
  questionEn!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  answerEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  answerJsonEn?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  questionBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  answerBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  answerJsonBn?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBnTranslated?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpsertCmsSiteSettingDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  key!: string;

  @ApiProperty()
  @IsObject()
  valueJson!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateCmsMediaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  altEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  altBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  captionEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  captionBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  folder?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class DeleteCmsPageDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  removeMenuReferences?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  unpublishFirst?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  confirmPublishedTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  redirectToPath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class PermanentDeleteCmsPageDto {
  @ApiProperty({ description: 'Must match the exact page title or slug to permanently delete' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  confirmText!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpdateTrashRetentionDto {
  @ApiProperty({ minimum: 1, maximum: 3650, default: 30 })
  @IsInt()
  @Min(1)
  @Max(3650)
  days!: number;
}

export class UpsertCmsMenuItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  labelEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  labelBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descriptionEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descriptionBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetPageId?: string | null;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  href!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  badgeEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  badgeBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  openInNewTab?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}

export class UpdateCmsMenuItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  labelEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  labelBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descriptionEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descriptionBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetPageId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  href?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  badgeEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  badgeBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  openInNewTab?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}

export class ReorderCmsMenuItemsDto {
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  @IsArray()
  items!: Array<{ id: string; parentId?: string | null; sortOrder: number }>;
}

export class UpsertCmsRedirectDto {
  @ApiProperty({ example: '/legacy-payroll' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  sourcePath!: string;

  @ApiProperty({ example: '/features/payroll' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  destinationUrl!: string;

  @ApiPropertyOptional({ enum: ['permanent_301', 'temporary_302', 'permanent_308', 'temporary_307'], default: 'permanent_301' })
  @IsOptional()
  @IsIn(['permanent_301', 'temporary_302', 'permanent_308', 'temporary_307'])
  redirectType?: CmsRedirectType;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class UpdateCmsRedirectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  sourcePath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  destinationUrl?: string;

  @ApiPropertyOptional({ enum: ['permanent_301', 'temporary_302', 'permanent_308', 'temporary_307'] })
  @IsOptional()
  @IsIn(['permanent_301', 'temporary_302', 'permanent_308', 'temporary_307'])
  redirectType?: CmsRedirectType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class ImportCmsRedirectsCsvDto {
  @ApiProperty({ description: 'CSV payload with header source_path,destination_url,redirect_type,is_active,note' })
  @IsString()
  @MinLength(1)
  csv!: string;
}

export class UpdateStructuredSiteSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  contact?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  announcementBar?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  footer?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  cookieBanner?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  seo?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  locale?: Record<string, unknown>;
}
