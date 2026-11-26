import type { CmsBlock } from './cms-blocks';

export const CMS_LOCALES = ['en', 'bn'] as const;
export type CmsLocale = (typeof CMS_LOCALES)[number];

export const CMS_RESERVED_SLUGS = [
  'admin',
  'api',
  'app',
  'platform',
  'login',
  'signup',
  'public',
  '_next',
] as const;

export const CMS_SYSTEM_PAGE_DEFS = [
  { slug: 'home', titleEn: 'CMSN-HR — Multi-Tenant HR, Payroll & Attendance Platform', titleBn: 'CMSN-HR — দেশভিত্তিক এইচআর, পেরোল ও উপস্থিতি প্ল্যাটফর্ম', canonicalPath: '/', bnTranslated: true },
  { slug: 'features', titleEn: 'Product Features Overview — HR, Attendance & Payroll', titleBn: 'প্রোডাক্ট ফিচারসমূহ — এইচআর, উপস্থিতি ও পেরোল', canonicalPath: '/features', bnTranslated: true },
  { slug: 'features-payroll', titleEn: 'Payroll & Statutory Tax', titleBn: 'পেরোল ও বিধিবদ্ধ কর', canonicalPath: '/features/payroll', bnTranslated: true },
  { slug: 'features-attendance', titleEn: 'Attendance & Roster', titleBn: 'উপস্থিতি ও শিফট রোস্টার', canonicalPath: '/features/attendance', bnTranslated: true },
  { slug: 'features-leave', titleEn: 'Leave & Holidays', titleBn: 'ছুটি ও সরকারি ছুটির ক্যালেন্ডার', canonicalPath: '/features/leave', bnTranslated: true },
  { slug: 'features-recruitment', titleEn: 'Recruitment & Onboarding', titleBn: 'নিয়োগ ও অনবোর্ডিং', canonicalPath: '/features/recruitment', bnTranslated: true },
  { slug: 'features-self-service', titleEn: 'Employee Self-Service & Mobile App', titleBn: 'কর্মচারী স্ব-সেবা ও মোবাইল অ্যাপ', canonicalPath: '/features/self-service', bnTranslated: true },
  { slug: 'features-reports', titleEn: 'Reports & Dashboards', titleBn: 'রিপোর্ট, এক্সপোর্ট ও ড্যাশবোর্ড', canonicalPath: '/features/reports', bnTranslated: true },
  { slug: 'features-workflows', titleEn: 'Workflows & Approvals', titleBn: 'ওয়ার্কফ্লো ও অনুমোদন অটোমেশন', canonicalPath: '/features/workflows', bnTranslated: true },
  { slug: 'solutions', titleEn: 'Workforce & Industry Solutions', titleBn: 'ব্যবসায়িক ও দেশভিত্তিক সমাধান', canonicalPath: '/solutions', bnTranslated: true },
  { slug: 'solutions-countries', titleEn: 'Solutions by Country — Multi-Country Payroll & Compliance', titleBn: 'দেশভিত্তিক সমাধান — বহু-দেশীয় পেরোল ও কমপ্লায়েন্স', canonicalPath: '/solutions/countries', bnTranslated: true },
  { slug: 'solutions-small-business', titleEn: 'Small Business HR & Payroll Solution', titleBn: 'ক্ষুদ্র ব্যবসা সমাধান', canonicalPath: '/solutions/small-business', bnTranslated: true },
  { slug: 'solutions-growing-teams', titleEn: 'Growing Teams HR Solution', titleBn: 'ক্রমবর্ধমান দল সমাধান', canonicalPath: '/solutions/growing-teams', bnTranslated: true },
  { slug: 'solutions-multi-branch', titleEn: 'Multi-Branch Organizations Solution', titleBn: 'বহু-শাখা প্রতিষ্ঠান সমাধান', canonicalPath: '/solutions/multi-branch', bnTranslated: true },
  { slug: 'solutions-shift-based', titleEn: 'Shift-Based Operations Solution', titleBn: 'শিফট-ভিত্তিক কার্যক্রম সমাধান', canonicalPath: '/solutions/shift-based', bnTranslated: true },
  { slug: 'solutions-field-workforce', titleEn: 'Field & Distributed Workforces Solution', titleBn: 'মাঠকর্মী দল সমাধান', canonicalPath: '/solutions/field-workforce', bnTranslated: true },
  { slug: 'pricing', titleEn: 'Pricing Plans & Seat Estimator', titleBn: 'মূল্য তালিকা ও কর্মীসংখ্যা হিসাব', canonicalPath: '/pricing', bnTranslated: true },
  { slug: 'security', titleEn: 'Security, Privacy & Tenant Isolation', titleBn: 'নিরাপত্তা, গোপনীয়তা ও টেন্যান্ট সুরক্ষা', canonicalPath: '/security', bnTranslated: true },
  { slug: 'integrations', titleEn: 'Platform Integrations & API Directory', titleBn: 'ইন্টিগ্রেশন ও API ডিরেক্টরি', canonicalPath: '/integrations', bnTranslated: true },
  { slug: 'about', titleEn: 'About CMSN-HR', titleBn: 'CMSN-HR সম্পর্কে', canonicalPath: '/about', bnTranslated: true },
  { slug: 'careers', titleEn: 'Careers at CMSN-HR', titleBn: 'CMSN-HR-এ ক্যারিয়ার', canonicalPath: '/careers', bnTranslated: true },
  { slug: 'changelog', titleEn: 'Product Updates & Changelog', titleBn: 'প্রোডাক্ট আপডেট ও চেঞ্জলগ', canonicalPath: '/changelog', bnTranslated: true },
  { slug: 'status', titleEn: 'Platform System Status', titleBn: 'সিস্টেম স্ট্যাটাস', canonicalPath: '/status', bnTranslated: true },
  { slug: 'help', titleEn: 'Help Center', titleBn: 'সহায়তা কেন্দ্র', canonicalPath: '/help', bnTranslated: true },
  { slug: 'contact', titleEn: 'Contact Us & Sales', titleBn: 'সেলস ও সাপোর্ট যোগাযোগ', canonicalPath: '/contact', bnTranslated: true },
  { slug: 'demo', titleEn: 'Book a Demo', titleBn: 'ডেমো বুক করুন', canonicalPath: '/demo', bnTranslated: true },
  { slug: 'terms', titleEn: 'Terms of Service', titleBn: 'সেবার শর্তাবলি', canonicalPath: '/terms', bnTranslated: false },
  { slug: 'privacy', titleEn: 'Privacy Policy', titleBn: 'গোপনীয়তা নীতি', canonicalPath: '/privacy', bnTranslated: false },
  { slug: 'cookies', titleEn: 'Cookie Policy', titleBn: 'কুকি নীতি', canonicalPath: '/cookies', bnTranslated: false },
  { slug: 'dpa', titleEn: 'Data Processing Agreement (DPA)', titleBn: 'তথ্য প্রক্রিয়াকরণ চুক্তি (DPA)', canonicalPath: '/dpa', bnTranslated: false },
  { slug: 'subprocessors', titleEn: 'Authorized Subprocessors', titleBn: 'অনুমোদিত সাবপ্রসেসর তালিকা', canonicalPath: '/subprocessors', bnTranslated: false },
  { slug: 'blog', titleEn: 'Engineering & Compliance Blog', titleBn: 'ব্লগ ও প্রবন্ধ', canonicalPath: '/blog', bnTranslated: true },
  { slug: 'customers', titleEn: 'Customer Stories', titleBn: 'কাস্টমার কেস স্টাডি', canonicalPath: '/customers', bnTranslated: true },
  { slug: 'not-found', titleEn: 'Page Not Found (404)', titleBn: 'পৃষ্ঠাটি পাওয়া যায়নি (৪০৪)', canonicalPath: '/404', bnTranslated: true },
] as const;

export const CMS_SYSTEM_PAGE_SLUGS = CMS_SYSTEM_PAGE_DEFS.map((p) => p.slug);
export const CMS_LEGAL_PAGE_SLUGS = ['terms', 'privacy', 'cookies', 'dpa', 'subprocessors'] as const;
export type CmsLegalPageSlug = (typeof CMS_LEGAL_PAGE_SLUGS)[number];

export type CmsPageKind = 'system' | 'custom';
export type CmsCustomPageTemplate = 'standard' | 'landing' | 'legal';
export type CmsPageStatus = 'draft' | 'scheduled' | 'published' | 'unpublished' | 'trashed';
export type CmsApprovalStatus = 'none' | 'pending_approval' | 'approved' | 'rejected';
export type CmsTranslationStatus = 'untranslated' | 'in_review' | 'translated';
export type CmsPostStatus = 'draft' | 'scheduled' | 'published' | 'unpublished' | 'trashed';
export type CmsChangelogTag = 'new' | 'improved' | 'fixed' | 'security';
export type CmsCareerStatus = 'draft' | 'open' | 'paused' | 'closed';
export type CmsMenuLocation = 'header' | 'footer' | 'mobile' | 'legal' | 'custom';
export type CmsRedirectType = 'permanent_308' | 'permanent_301' | 'temporary_302' | 'temporary_307';

export type CmsBlockNode = CmsBlock;

export interface CmsPageVersionDto {
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
  blocks: CmsBlockNode[];
  isTranslated: boolean;
  authorId?: string | null;
  authorName?: string | null;
  changeNote?: string | null;
  createdAt: string;
}

export interface CmsPageLocaleStatusDto {
  locale: CmsLocale;
  isTranslated: boolean;
  translationStatus: CmsTranslationStatus;
  currentDraftVersionId?: string | null;
  currentPublishedVersionId?: string | null;
  updatedAt: string;
}

export interface CmsPageDto {
  id: string;
  kind: CmsPageKind;
  slug: string;
  status: CmsPageStatus;
  locked: boolean;
  requiresApproval: boolean;
  approvalStatus: CmsApprovalStatus;
  pendingApprovalVersionId?: string | null;
  submittedForApprovalById?: string | null;
  submittedForApprovalAt?: string | null;
  submissionNote?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  approvalNote?: string | null;
  rejectedById?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  scheduledAt?: string | null;
  scheduledTimezone?: string | null;
  scheduledById?: string | null;
  publishedAt?: string | null;
  currentPublishedVersionId?: string | null;
  titleEn?: string | null;
  titleBn?: string | null;
  canonicalPath?: string | null;
  lastEditedById?: string | null;
  lastEditedByName?: string | null;
  lastEditedAt?: string | null;
  locales: CmsPageLocaleStatusDto[];
  deletedAt?: string | null;
  purgeAt?: string | null;
  trashRetentionDays?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsDeleteImpactMenuRefDto {
  menuItemId: string;
  menuId: string;
  menuName: string;
  menuLocation: string;
  labelEn: string;
  href: string;
}

export interface CmsDeleteImpactPageRefDto {
  pageId: string;
  slug: string;
  title: string;
  status: CmsPageStatus;
  locale: CmsLocale;
  href: string;
}

export interface CmsDeleteImpactRedirectOptionDto {
  slug: string;
  title: string;
  path: string;
}

export interface CmsPageDeletionImpactDto {
  pageId: string;
  slug: string;
  title: string;
  kind: CmsPageKind;
  status: CmsPageStatus;
  locked: boolean;
  liveUrlPath: string;
  willStopWorking: boolean;
  requiresTypedTitleConfirmation: boolean;
  menuReferences: CmsDeleteImpactMenuRefDto[];
  referencingPages: CmsDeleteImpactPageRefDto[];
  redirectTargets: CmsDeleteImpactRedirectOptionDto[];
  trashRetentionDays: number;
}

export interface TrashCmsPageInput {
  removeMenuReferences?: boolean;
  unpublishFirst?: boolean;
  confirmPublishedTitle?: string;
  redirectToPath?: string;
  reason?: string;
}

export interface PermanentDeleteCmsPageInput {
  confirmText: string;
  reason?: string;
}

export interface CmsRedirectRuleDto {
  id: string;
  sourcePath: string;
  destinationUrl: string;
  redirectType: CmsRedirectType;
  isActive: boolean;
  hitCount: number;
  note?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertCmsRedirectInput {
  sourcePath: string;
  destinationUrl: string;
  redirectType?: CmsRedirectType;
  isActive?: boolean;
  note?: string | null;
}

export interface CmsRedirectCsvImportResultDto {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; sourcePath: string; error: string }>;
  rules: CmsRedirectRuleDto[];
}

export interface DuplicateCmsPageInput {
  slug?: string;
  titleEn?: string;
  note?: string;
}

export interface CmsSlugAvailabilityDto {
  slug: string;
  valid: boolean;
  available: boolean;
  reserved: boolean;
  reason?: string | null;
}

export interface CmsPublicSitemapPageDto {
  id: string;
  slug: string;
  kind: CmsPageKind;
  canonicalPath?: string | null;
  publishedAt?: string | null;
  updatedAt: string;
}

export interface CreateCmsCustomPageInput {
  slug: string;
  titleEn: string;
  seoTitleEn?: string;
  seoDescriptionEn?: string;
  ogImageUrlEn?: string;
  blocksEn?: unknown[];
  templateKey?: CmsCustomPageTemplate;
  requiresApproval?: boolean;
  menuId?: string;
  menuItemLabelEn?: string;
  menuItemLabelBn?: string;
  changeNote?: string;
}

export interface CmsActiveEditorDto {
  userId: string;
  email: string;
  displayName: string;
  locale: CmsLocale;
  sessionId: string;
  lastSeenAt: string;
  baseVersionNumber?: number | null;
}

export interface CmsPagePresenceResponseDto {
  pageId: string;
  activeEditors: CmsActiveEditorDto[];
  latestVersions: Record<
    CmsLocale,
    {
      versionId: string;
      versionNumber: number;
      authorName?: string | null;
      createdAt: string;
    } | null
  >;
}

export interface CmsVersionConflictDetailsDto {
  code: 'CMS_VERSION_CONFLICT';
  message: string;
  expectedVersionNumber?: number | null;
  currentLatestVersion: CmsPageVersionDto;
}

export interface CmsResolvedPageDto {
  pageId: string;
  kind: CmsPageKind;
  slug: string;
  status: CmsPageStatus;
  locked: boolean;
  requiresApproval?: boolean;
  approvalStatus?: CmsApprovalStatus;
  requestedLocale: CmsLocale;
  resolvedLocale: CmsLocale;
  fallbackUsed: boolean;
  isTranslated: boolean;
  translationStatus: CmsTranslationStatus;
  isPreview?: boolean;
  previewExpiresAt?: string | null;
  version: CmsPageVersionDto;
}

export interface CmsPageDetailDto {
  page: CmsPageDto;
  versions: CmsPageVersionDto[];
}

export interface CmsPreviewTokenResponseDto {
  token: string;
  expiresAt: string;
  previewUrl: string;
  pageId: string;
  slug: string;
  locale: CmsLocale;
  versionId: string;
  versionNumber: number;
}

export type CmsMediaVariantKey = 'thumb' | 'medium' | 'webp' | 'avif';

export interface CmsMediaVariantDto {
  key: CmsMediaVariantKey;
  storageKey: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
}

export interface CmsMediaDto {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  publicUrl: string;
  width?: number | null;
  height?: number | null;
  altEn?: string | null;
  altBn?: string | null;
  captionEn?: string | null;
  captionBn?: string | null;
  folder: string;
  tags?: string[];
  exifStripped?: boolean;
  variants?: Partial<Record<CmsMediaVariantKey, CmsMediaVariantDto>> | null;
  usageCount?: number;
  uploadedById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsUpdateMediaInput {
  altEn?: string | null;
  altBn?: string | null;
  captionEn?: string | null;
  captionBn?: string | null;
  folder?: string;
  tags?: string[];
}

export interface CmsMediaPageUsageDto {
  pageId: string;
  slug: string;
  title: string;
  status: CmsPageStatus;
  locale: CmsLocale;
  location: string;
  isPublished: boolean;
}

export interface CmsMediaPostUsageDto {
  postId: string;
  slug: string;
  title: string;
  status: CmsPostStatus;
  location: string;
  isPublished: boolean;
}

export interface CmsMediaUsageDto {
  mediaId: string;
  totalReferences: number;
  publishedReferencesCount: number;
  deletionBlocked: boolean;
  warningMessage: string | null;
  pages: CmsMediaPageUsageDto[];
  posts: CmsMediaPostUsageDto[];
  authors: Array<{ authorId: string; slug: string; displayName: string }>;
  settings: Array<{ key: string }>;
}

export interface CmsMenuItemDto {
  id: string;
  menuId: string;
  parentId?: string | null;
  labelEn: string;
  labelBn?: string | null;
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  targetPageId?: string | null;
  href: string;
  badgeEn?: string | null;
  badgeBn?: string | null;
  sortOrder: number;
  openInNewTab: boolean;
  isVisible: boolean;
  targetPageSlug?: string | null;
  targetPageStatus?: CmsPageStatus | 'missing' | null;
  targetWarning?: string | null;
}

export interface UpsertCmsMenuItemInput {
  parentId?: string | null;
  labelEn: string;
  labelBn?: string | null;
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  targetPageId?: string | null;
  href: string;
  badgeEn?: string | null;
  badgeBn?: string | null;
  sortOrder?: number;
  openInNewTab?: boolean;
  isVisible?: boolean;
}

export interface ReorderCmsMenuItemsInput {
  items: Array<{
    id: string;
    parentId?: string | null;
    sortOrder: number;
  }>;
}

export interface CmsMenuDto {
  id: string;
  slug: string;
  name: string;
  location: CmsMenuLocation;
  isActive: boolean;
  items: CmsMenuItemDto[];
}

export interface CmsRedirectDto {
  id: string;
  sourcePath: string;
  destinationUrl: string;
  redirectType: CmsRedirectType;
  isActive: boolean;
  hitCount: number;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsPostCategoryDto {
  id: string;
  slug: string;
  nameEn: string;
  nameBn?: string | null;
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  sortOrder: number;
  postCount?: number;
}

export interface CmsAuthorDto {
  id: string;
  slug: string;
  displayName: string;
  displayNameBn?: string | null;
  roleTitle?: string | null;
  roleTitleBn?: string | null;
  bioEn?: string | null;
  bioBn?: string | null;
  avatarMediaId?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  postCount?: number;
}

export interface CmsPostDto {
  id: string;
  slug: string;
  status: CmsPostStatus;
  categoryId: string;
  authorId: string;
  coverMediaId?: string | null;
  coverImageUrl?: string | null;
  coverAltEn?: string | null;
  coverAltBn?: string | null;
  titleEn: string;
  titleBn?: string | null;
  excerptEn: string;
  excerptBn?: string | null;
  bodyJsonEn: Record<string, unknown>;
  bodyHtmlEn: string;
  bodyJsonBn?: Record<string, unknown> | null;
  bodyHtmlBn?: string | null;
  isBnTranslated: boolean;
  bnTranslationStatus: CmsTranslationStatus;
  seoTitleEn?: string | null;
  seoDescriptionEn?: string | null;
  seoTitleBn?: string | null;
  seoDescriptionBn?: string | null;
  tags: string[];
  relatedPostIds?: string[];
  readingTimeMinutes: number;
  scheduledAt?: string | null;
  scheduledTimezone?: string | null;
  publishedAt?: string | null;
  updatedAt?: string;
  createdAt?: string;
  category?: {
    id: string;
    slug: string;
    nameEn: string;
    nameBn?: string | null;
  };
  author?: {
    id: string;
    slug: string;
    displayName: string;
    displayNameBn?: string | null;
    roleTitle?: string | null;
    roleTitleBn?: string | null;
    avatarUrl?: string | null;
  };
}

export interface CmsPublicPostSummaryDto {
  id: string;
  slug: string;
  titleEn: string;
  titleBn?: string | null;
  excerptEn: string;
  excerptBn?: string | null;
  resolvedLocale: CmsLocale;
  fallbackUsed: boolean;
  coverMediaId?: string | null;
  coverImageUrl?: string | null;
  coverAltEn?: string | null;
  coverAltBn?: string | null;
  tags: string[];
  readingTimeMinutes: number;
  publishedAt?: string | null;
  updatedAt?: string | null;
  category: {
    id: string;
    slug: string;
    nameEn: string;
    nameBn?: string | null;
  };
  author: {
    id: string;
    slug: string;
    displayName: string;
    displayNameBn?: string | null;
    roleTitle?: string | null;
    roleTitleBn?: string | null;
    avatarUrl?: string | null;
  };
}

export interface CmsPublicPostDto extends CmsPostDto {
  resolvedLocale: CmsLocale;
  fallbackUsed: boolean;
  category: {
    id: string;
    slug: string;
    nameEn: string;
    nameBn?: string | null;
  };
  author: {
    id: string;
    slug: string;
    displayName: string;
    displayNameBn?: string | null;
    roleTitle?: string | null;
    roleTitleBn?: string | null;
    avatarUrl?: string | null;
  };
  relatedPosts?: CmsPublicPostSummaryDto[];
}

export interface CmsPublicBlogListResultDto {
  data: CmsPublicPostDto[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasPublishedPosts?: boolean;
    categories?: Array<{
      id: string;
      slug: string;
      nameEn: string;
      nameBn?: string | null;
      postCount: number;
    }>;
  };
}

export interface CmsChangelogEntryDto {
  id: string;
  slug: string;
  versionLabel: string;
  releaseDate: string;
  tag: CmsChangelogTag;
  moduleRefs?: string | null;
  titleEn: string;
  summaryEn: string;
  bodyHtmlEn: string;
  bodyJsonEn: Record<string, unknown>;
  highlightsEn: string[];
  titleBn?: string | null;
  summaryBn?: string | null;
  bodyHtmlBn?: string | null;
  bodyJsonBn?: Record<string, unknown> | null;
  highlightsBn: string[];
  isBnTranslated: boolean;
  isPublished: boolean;
  scheduledAt?: string | null;
  scheduledTimezone?: string | null;
  publishedAt?: string | null;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CmsCareerDto {
  id: string;
  slug: string;
  status: CmsCareerStatus;
  department: string;
  locationType: string;
  locationText: string;
  employmentType: string;
  titleEn: string;
  summaryEn: string;
  descriptionHtmlEn: string;
  descriptionJsonEn?: Record<string, unknown>;
  titleBn?: string | null;
  summaryBn?: string | null;
  descriptionHtmlBn?: string | null;
  descriptionJsonBn?: Record<string, unknown> | null;
  isBnTranslated: boolean;
  applyEmail?: string | null;
  applyUrl?: string | null;
  publishedAt?: string | null;
  closesAt?: string | null;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CmsFaqDto {
  id: string;
  category: string;
  pageSlug?: string | null;
  questionEn: string;
  answerEn: string;
  answerJsonEn?: Record<string, unknown>;
  questionBn?: string | null;
  answerBn?: string | null;
  answerJsonBn?: Record<string, unknown> | null;
  isBnTranslated: boolean;
  sortOrder: number;
  isPublished: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CmsPublicFaqDto {
  id: string;
  category: string;
  pageSlug?: string | null;
  questionEn: string;
  answerEn: string;
  questionBn?: string | null;
  answerBn?: string | null;
  isBnTranslated: boolean;
  resolvedLocale: CmsLocale;
  fallbackUsed: boolean;
  sortOrder: number;
}

export interface CmsSiteSettingDto {
  id: string;
  key: string;
  valueJson: Record<string, unknown>;
  description?: string | null;
  isPublic: boolean;
  updatedAt: string;
}

export interface CmsLocalizedString {
  en: string;
  bn: string;
}

export interface CmsSiteSettingsBundleDto {
  contact: {
    companyName: CmsLocalizedString;
    address: CmsLocalizedString;
    phone: string;
    salesEmail: string;
    supportEmail: string;
  };
  socialLinks: {
    linkedin?: string;
    x?: string;
    facebook?: string;
    youtube?: string;
    github?: string;
  };
  announcementBar: {
    enabled: boolean;
    text: CmsLocalizedString;
    linkLabel: CmsLocalizedString;
    linkUrl: string;
    startsAt?: string | null;
    endsAt?: string | null;
    dismissible: boolean;
  };
  footer: {
    tagline: CmsLocalizedString;
    copyrightText: CmsLocalizedString;
  };
  cookieBanner: {
    title: CmsLocalizedString;
    body: CmsLocalizedString;
    policyLinkText: CmsLocalizedString;
    acceptAllLabel: CmsLocalizedString;
    declineAllLabel: CmsLocalizedString;
    customizeLabel: CmsLocalizedString;
  };
  seo: {
    defaultOgImageUrl: string;
    titleTemplate: string;
    defaultDescription: CmsLocalizedString;
  };
  locale: {
    defaultLanguage: CmsLocale;
    supportedLocales: CmsLocale[];
    fallbackLocale: CmsLocale;
  };
}

export interface CmsBrokenLinkOccurrenceDto {
  pageId: string;
  slug: string;
  pageStatus: CmsPageStatus;
  locale: CmsLocale;
  versionNumber: number;
  blockId: string;
  blockType: string;
  href: string;
  reason: string;
}

export interface CmsDashboardPageSummaryDto {
  id: string;
  slug: string;
  kind: CmsPageKind;
  status: CmsPageStatus;
  locked: boolean;
  requiresApproval: boolean;
  approvalStatus: CmsApprovalStatus;
  titleEn?: string | null;
  bnTranslationStatus: CmsTranslationStatus;
  isBnTranslated: boolean;
  brokenLinksCount: number;
  scheduledAt?: string | null;
  scheduledTimezone?: string | null;
  publishedAt?: string | null;
  updatedAt: string;
}

export interface CmsRecentChangeItemDto {
  id: string;
  action: string;
  module: string;
  recordId?: string | null;
  summary: string;
  actorId?: string | null;
  actorName: string;
  actorEmail?: string | null;
  createdAt: string;
}

export interface CmsDashboardSummaryDto {
  counts: {
    totalPages: number;
    drafts: number;
    scheduled: number;
    pendingApproval: number;
    recentlyPublished: number;
    missingBengaliTranslation: number;
    pagesWithBrokenLinks: number;
    totalPosts: number;
    draftPosts: number;
  };
  draftPages: CmsDashboardPageSummaryDto[];
  scheduledPages: CmsDashboardPageSummaryDto[];
  pendingApprovalPages: CmsDashboardPageSummaryDto[];
  recentlyPublishedPages: CmsDashboardPageSummaryDto[];
  missingBnPages: CmsDashboardPageSummaryDto[];
  brokenLinkPages: Array<{
    pageId: string;
    slug: string;
    pageStatus: CmsPageStatus;
    brokenCount: number;
    occurrences: CmsBrokenLinkOccurrenceDto[];
  }>;
  recentChanges: CmsRecentChangeItemDto[];
  postCategories: Array<{ id: string; slug: string; nameEn: string }>;
  authors: Array<{ id: string; slug: string; displayName: string }>;
  recentPosts: CmsPostDto[];
  recentPages: CmsDashboardPageSummaryDto[];
}
