import { useEffect, useMemo, useState } from 'react';
import type {
  CmsAuthorDto,
  CmsLocale,
  CmsPostCategoryDto,
  CmsPostDto,
} from '@hrm/shared-types';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock,
  Copy,
  Eye,
  Image as ImageIcon,
  Languages,
  Save,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  createCmsPostDraft,
  publishCmsPost,
  scheduleCmsPost,
  unpublishCmsPost,
  updateCmsPostDraft,
} from '@/lib/platform-cms-api';
import { hasPlatformPermission, type PermissionUser } from '@/lib/permissions';
import { MediaLibraryPickerModal } from './MediaLibraryPickerModal';
import { RichTextEditor } from './RichTextEditor';
import {
  collectBlogPostWarnings,
  estimateBlogReadingTimeMinutes,
  generateBlogSlugFromTitle,
  getBlogSeoLengthHint,
  parseBlogTagsInput,
} from './blog-editor-utils';

interface BlogPostEditorModalProps {
  isOpen: boolean;
  post: CmsPostDto | null;
  categories: CmsPostCategoryDto[];
  authors: CmsAuthorDto[];
  allPosts: CmsPostDto[];
  currentUser: PermissionUser;
  onClose: () => void;
  onSaved: (saved: CmsPostDto) => void;
}

const TIMEZONES = [
  'Asia/Dhaka',
  'UTC',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
];

function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function BlogPostEditorModal({
  isOpen,
  post,
  categories,
  authors,
  allPosts,
  currentUser,
  onClose,
  onSaved,
}: BlogPostEditorModalProps) {
  const canPublish = hasPlatformPermission(currentUser, 'cms', 'manage');
  const [activeLocale, setActiveLocale] = useState<CmsLocale>('en');
  const [showPreview, setShowPreview] = useState(false);

  const [titleEn, setTitleEn] = useState('');
  const [titleBn, setTitleBn] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEditedManually, setSlugEditedManually] = useState(false);

  const [excerptEn, setExcerptEn] = useState('');
  const [excerptBn, setExcerptBn] = useState('');
  const [bodyHtmlEn, setBodyHtmlEn] = useState('<p></p>');
  const [bodyJsonEn, setBodyJsonEn] = useState<Record<string, unknown>>({});
  const [bodyHtmlBn, setBodyHtmlBn] = useState('');
  const [bodyJsonBn, setBodyJsonBn] = useState<Record<string, unknown> | null>(null);
  const [isBnTranslated, setIsBnTranslated] = useState(false);

  const [categoryId, setCategoryId] = useState('');
  const [authorId, setAuthorId] = useState('');
  const [coverMediaId, setCoverMediaId] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverAltEn, setCoverAltEn] = useState('');
  const [coverAltBn, setCoverAltBn] = useState('');

  const [tagsText, setTagsText] = useState('');
  const [publishedAtLocal, setPublishedAtLocal] = useState('');
  const [readingTimeOverride, setReadingTimeOverride] = useState<string>('');
  const [relatedPostIds, setRelatedPostIds] = useState<string[]>([]);

  const [seoTitleEn, setSeoTitleEn] = useState('');
  const [seoDescriptionEn, setSeoDescriptionEn] = useState('');
  const [seoTitleBn, setSeoTitleBn] = useState('');
  const [seoDescriptionBn, setSeoDescriptionBn] = useState('');

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAtLocal, setScheduleAtLocal] = useState('');
  const [scheduleTimezone, setScheduleTimezone] = useState('Asia/Dhaka');

  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setActiveLocale('en');
    setShowPreview(false);
    setScheduleOpen(false);
    if (post) {
      setTitleEn(post.titleEn);
      setTitleBn(post.titleBn ?? '');
      setSlug(post.slug);
      setSlugEditedManually(true);
      setExcerptEn(post.excerptEn);
      setExcerptBn(post.excerptBn ?? '');
      setBodyHtmlEn(post.bodyHtmlEn || '<p></p>');
      setBodyJsonEn(post.bodyJsonEn ?? {});
      setBodyHtmlBn(post.bodyHtmlBn ?? '');
      setBodyJsonBn(post.bodyJsonBn ?? null);
      setIsBnTranslated(post.isBnTranslated);
      setCategoryId(post.categoryId);
      setAuthorId(post.authorId);
      setCoverMediaId(post.coverMediaId ?? null);
      setCoverImageUrl(
        post.coverImageUrl ??
          (post.coverMediaId ? `/api/v1/public/content/media/${post.coverMediaId}/file` : null),
      );
      setCoverAltEn(post.coverAltEn ?? '');
      setCoverAltBn(post.coverAltBn ?? '');
      setTagsText((post.tags ?? []).join(', '));
      setPublishedAtLocal(toDatetimeLocalValue(post.publishedAt));
      setReadingTimeOverride(post.readingTimeMinutes ? String(post.readingTimeMinutes) : '');
      setRelatedPostIds(post.relatedPostIds ?? []);
      setSeoTitleEn(post.seoTitleEn ?? '');
      setSeoDescriptionEn(post.seoDescriptionEn ?? '');
      setSeoTitleBn(post.seoTitleBn ?? '');
      setSeoDescriptionBn(post.seoDescriptionBn ?? '');
      setScheduleAtLocal(toDatetimeLocalValue(post.scheduledAt));
      setScheduleTimezone(post.scheduledTimezone || 'Asia/Dhaka');
    } else {
      setTitleEn('');
      setTitleBn('');
      setSlug('');
      setSlugEditedManually(false);
      setExcerptEn('');
      setExcerptBn('');
      setBodyHtmlEn('<p></p>');
      setBodyJsonEn({});
      setBodyHtmlBn('');
      setBodyJsonBn(null);
      setIsBnTranslated(false);
      setCategoryId(categories[0]?.id ?? '');
      setAuthorId(authors.find((a) => a.isActive)?.id ?? authors[0]?.id ?? '');
      setCoverMediaId(null);
      setCoverImageUrl(null);
      setCoverAltEn('');
      setCoverAltBn('');
      setTagsText('');
      setPublishedAtLocal('');
      setReadingTimeOverride('');
      setRelatedPostIds([]);
      setSeoTitleEn('');
      setSeoDescriptionEn('');
      setSeoTitleBn('');
      setSeoDescriptionBn('');
      const tomorrow = new Date(Date.now() + 86_400_000);
      setScheduleAtLocal(toDatetimeLocalValue(tomorrow.toISOString()));
      setScheduleTimezone('Asia/Dhaka');
    }
  }, [isOpen, post, categories, authors]);

  const autoReadingMinutes = useMemo(
    () => estimateBlogReadingTimeMinutes(bodyHtmlEn, bodyHtmlBn),
    [bodyHtmlEn, bodyHtmlBn],
  );

  const warnings = useMemo(
    () =>
      collectBlogPostWarnings({
        titleEn,
        slug,
        excerptEn,
        bodyHtmlEn,
        categoryId,
        authorId,
        coverMediaId,
        coverAltEn,
        isBnTranslated,
        titleBn,
        excerptBn,
        bodyHtmlBn,
      }),
    [
      titleEn,
      slug,
      excerptEn,
      bodyHtmlEn,
      categoryId,
      authorId,
      coverMediaId,
      coverAltEn,
      isBnTranslated,
      titleBn,
      excerptBn,
      bodyHtmlBn,
    ],
  );

  if (!isOpen) return null;

  const activeSeoTitle = activeLocale === 'bn' ? seoTitleBn : seoTitleEn;
  const activeSeoDescription = activeLocale === 'bn' ? seoDescriptionBn : seoDescriptionEn;
  const seoTitleHint = getBlogSeoLengthHint(activeSeoTitle, 'title');
  const seoDescHint = getBlogSeoLengthHint(activeSeoDescription, 'description');

  const candidateRelatedPosts = allPosts.filter((p) => p.id !== post?.id && p.status !== 'trashed');

  const handleTitleEnChange = (nextTitle: string) => {
    setTitleEn(nextTitle);
    if (!slugEditedManually) {
      setSlug(generateBlogSlugFromTitle(nextTitle));
    }
  };

  const handleCopyEnglishToBengali = () => {
    setTitleBn((prev) => prev || titleEn);
    setExcerptBn((prev) => prev || excerptEn);
    setBodyHtmlBn((prev) => (prev && prev.replace(/<[^>]+>/g, '').trim() ? prev : bodyHtmlEn));
    setBodyJsonBn((prev) => prev ?? bodyJsonEn);
    setCoverAltBn((prev) => prev || coverAltEn);
    setSeoTitleBn((prev) => prev || seoTitleEn || titleEn);
    setSeoDescriptionBn((prev) => prev || seoDescriptionEn || excerptEn);
    setIsBnTranslated(true);
    setActiveLocale('bn');
  };

  const buildPayload = () => {
    const manualMin = parseInt(readingTimeOverride, 10);
    const readingTimeMinutes =
      Number.isFinite(manualMin) && manualMin >= 1 && manualMin <= 120
        ? manualMin
        : autoReadingMinutes;
    return {
      slug: slug.trim().toLowerCase(),
      categoryId,
      authorId,
      coverMediaId,
      coverAltEn: coverAltEn.trim() || null,
      coverAltBn: coverAltBn.trim() || null,
      titleEn: titleEn.trim(),
      titleBn: titleBn.trim() || null,
      excerptEn: excerptEn.trim(),
      excerptBn: excerptBn.trim() || null,
      bodyJsonEn,
      bodyHtmlEn,
      bodyJsonBn,
      bodyHtmlBn: bodyHtmlBn.trim() || null,
      isBnTranslated,
      seoTitleEn: seoTitleEn.trim() || null,
      seoDescriptionEn: seoDescriptionEn.trim() || null,
      seoTitleBn: seoTitleBn.trim() || null,
      seoDescriptionBn: seoDescriptionBn.trim() || null,
      publishedAt: publishedAtLocal ? new Date(publishedAtLocal).toISOString() : null,
      relatedPostIds,
      tags: parseBlogTagsInput(tagsText),
      readingTimeMinutes,
    };
  };

  const saveDraftInternal = async (): Promise<CmsPostDto> => {
    if (!titleEn.trim() || !slug.trim() || !excerptEn.trim() || !categoryId || !authorId) {
      throw new Error('Title, slug, excerpt, category, and author are required before saving.');
    }
    const payload = buildPayload();
    if (post) {
      return await updateCmsPostDraft(post.id, payload);
    }
    return await createCmsPostDraft(payload);
  };

  const handleSaveDraft = async () => {
    setError(null);
    setSaving(true);
    try {
      const saved = await saveDraftInternal();
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save blog post.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishNow = async () => {
    if (!canPublish) return;
    setError(null);
    setSaving(true);
    try {
      const saved = await saveDraftInternal();
      const published = await publishCmsPost(saved.id);
      onSaved(published);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish blog post.');
    } finally {
      setSaving(false);
    }
  };

  const handleSchedulePublish = async () => {
    if (!canPublish || !scheduleAtLocal) return;
    setError(null);
    setSaving(true);
    try {
      const saved = await saveDraftInternal();
      const scheduled = await scheduleCmsPost(saved.id, {
        scheduledAt: scheduleAtLocal,
        timezone: scheduleTimezone,
      });
      onSaved(scheduled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule blog post.');
    } finally {
      setSaving(false);
    }
  };

  const handleUnpublish = async () => {
    if (!post || !canPublish) return;
    setError(null);
    setSaving(true);
    try {
      const unpublished = await unpublishCmsPost(post.id);
      onSaved(unpublished);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unpublish post.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={post ? `Edit blog post: ${post.titleEn}` : 'Create blog post'}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
    >
      <div className="bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border-base))] rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="px-5 py-3.5 border-b border-[rgb(var(--border-base))] flex flex-wrap items-center justify-between gap-3 bg-[rgb(var(--bg-muted))]/40">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold truncate">
                {post ? `Edit Post: ${post.titleEn}` : 'New Blog Post'}
              </h2>
              {post && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] uppercase">
                  {post.status}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-[rgb(var(--text-muted))]">
                <Clock className="h-3.5 w-3.5" />
                {readingTimeOverride || autoReadingMinutes} min read
              </span>
            </div>
            <p className="text-xs text-[rgb(var(--text-muted))] font-mono truncate">
              /blog/{slug || 'post-slug'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview((p) => !p)}
              className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[rgb(var(--bg-hover))]"
            >
              <Eye className="h-3.5 w-3.5" />
              {showPreview ? 'Back to Editor' : 'Preview'}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={handleSaveDraft}
              className="h-9 px-3.5 rounded-lg border border-[rgb(var(--border-strong))] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[rgb(var(--bg-hover))] disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving…' : 'Save Draft'}
            </button>

            {canPublish && (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setScheduleOpen((v) => !v)}
                  className="h-9 px-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-indigo-500/20 disabled:opacity-50"
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  Schedule
                </button>
                {post?.status === 'published' && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleUnpublish}
                    className="h-9 px-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-semibold hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    Unpublish
                  </button>
                )}
                <button
                  type="button"
                  disabled={saving}
                  onClick={handlePublishNow}
                  className="h-9 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  Publish Now
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close blog post editor"
              className="h-9 w-9 rounded-lg inline-flex items-center justify-center hover:bg-[rgb(var(--bg-hover))]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Schedule Drawer */}
        {scheduleOpen && canPublish && (
          <div className="px-5 py-3 border-b border-indigo-500/20 bg-indigo-500/5 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] font-semibold mb-1">
                Scheduled Date & Time
              </label>
              <input
                type="datetime-local"
                value={scheduleAtLocal}
                onChange={(e) => setScheduleAtLocal(e.target.value)}
                className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Timezone</label>
              <select
                value={scheduleTimezone}
                onChange={(e) => setScheduleTimezone(e.target.value)}
                className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={saving || !scheduleAtLocal}
              onClick={handleSchedulePublish}
              className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-50"
            >
              Confirm Schedule
            </button>
          </div>
        )}

        {/* Warnings / Errors */}
        {(error || warnings.length > 0) && (
          <div className="px-5 pt-3 space-y-2">
            {error && (
              <div className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Checklist before publishing: </span>
                  {warnings.join(' ')}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {showPreview ? (
            <div className="max-w-3xl mx-auto space-y-6 py-4">
              <div className="space-y-2 border-b border-[rgb(var(--border-base))] pb-4">
                <div className="text-xs font-semibold text-primary-600 uppercase">
                  {categories.find((c) => c.id === categoryId)?.nameEn || 'Blog'} ·{' '}
                  {readingTimeOverride || autoReadingMinutes} min read
                </div>
                <h1 className="text-3xl font-bold">
                  {activeLocale === 'bn' && titleBn ? titleBn : titleEn || 'Untitled Post'}
                </h1>
                <p className="text-sm text-[rgb(var(--text-secondary))]">
                  {activeLocale === 'bn' && excerptBn ? excerptBn : excerptEn}
                </p>
              </div>
              {coverImageUrl && (
                <figure className="overflow-hidden rounded-xl border border-[rgb(var(--border-base))]">
                  <img
                    src={coverImageUrl}
                    alt={(activeLocale === 'bn' ? coverAltBn || coverAltEn : coverAltEn) || titleEn}
                    className="w-full max-h-80 object-cover"
                  />
                </figure>
              )}
              <div
                className="prose prose-slate dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{
                  __html:
                    activeLocale === 'bn' && bodyHtmlBn
                      ? bodyHtmlBn
                      : bodyHtmlEn || '<p>No content written yet.</p>',
                }}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Columns: Locale Content & Rich Text Editor */}
              <div className="lg:col-span-2 space-y-5">
                {/* Locale Switcher */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/30">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveLocale('en')}
                      className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
                        activeLocale === 'en'
                          ? 'bg-primary-600 text-white'
                          : 'hover:bg-[rgb(var(--bg-hover))] text-[rgb(var(--text-secondary))]'
                      }`}
                    >
                      <Languages className="h-3.5 w-3.5" />
                      English (EN)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveLocale('bn')}
                      className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
                        activeLocale === 'bn'
                          ? 'bg-primary-600 text-white'
                          : 'hover:bg-[rgb(var(--bg-hover))] text-[rgb(var(--text-secondary))]'
                      }`}
                    >
                      <Languages className="h-3.5 w-3.5" />
                      বাংলা (BN)
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    {activeLocale === 'bn' && (
                      <>
                        <button
                          type="button"
                          onClick={handleCopyEnglishToBengali}
                          className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[rgb(var(--bg-hover))]"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy from English
                        </button>
                        <label className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isBnTranslated}
                            onChange={(e) => setIsBnTranslated(e.target.checked)}
                            className="rounded border-[rgb(var(--border-base))]"
                          />
                          Mark BN live
                        </label>
                      </>
                    )}
                  </div>
                </div>

                {/* Title & Slug */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {activeLocale === 'en' ? 'Post Title (English) *' : 'Post Title (Bengali)'}
                    </label>
                    <input
                      type="text"
                      value={activeLocale === 'en' ? titleEn : titleBn}
                      onChange={(e) =>
                        activeLocale === 'en'
                          ? handleTitleEnChange(e.target.value)
                          : setTitleBn(e.target.value)
                      }
                      placeholder={
                        activeLocale === 'en'
                          ? 'e.g., How Rule Resolvers Guarantee Deterministic Payroll'
                          : 'বাংলা শিরোনাম লিখুন...'
                      }
                      className="w-full h-10 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-sm"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold">URL Slug *</label>
                      <button
                        type="button"
                        onClick={() => {
                          setSlug(generateBlogSlugFromTitle(titleEn || titleBn));
                          setSlugEditedManually(true);
                        }}
                        className="text-[11px] text-primary-600 hover:underline inline-flex items-center gap-1"
                      >
                        <Sparkles className="h-3 w-3" />
                        Auto-generate from title
                      </button>
                    </div>
                    <div className="flex items-center">
                      <span className="h-9 px-3 rounded-l-lg border border-r-0 border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] text-xs text-[rgb(var(--text-muted))] inline-flex items-center font-mono">
                        /blog/
                      </span>
                      <input
                        type="text"
                        value={slug}
                        onChange={(e) => {
                          setSlugEditedManually(true);
                          setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                        }}
                        placeholder="deterministic-payroll-engine"
                        className="flex-1 h-9 px-3 rounded-r-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {activeLocale === 'en' ? 'Excerpt / Summary (English) *' : 'Excerpt (Bengali)'}
                    </label>
                    <textarea
                      rows={2}
                      value={activeLocale === 'en' ? excerptEn : excerptBn}
                      onChange={(e) =>
                        activeLocale === 'en'
                          ? setExcerptEn(e.target.value)
                          : setExcerptBn(e.target.value)
                      }
                      placeholder="Short summary for blog index cards, RSS description, and social previews..."
                      className="w-full px-3 py-2 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
                    />
                  </div>
                </div>

                {/* Rich Text Editor */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold">
                      {activeLocale === 'en' ? 'Article Body (English) *' : 'Article Body (Bengali)'}
                    </label>
                    <span className="text-[11px] text-[rgb(var(--text-muted))]">
                      Estimated reading time: <strong>{autoReadingMinutes} min read</strong>
                    </span>
                  </div>
                  {activeLocale === 'en' ? (
                    <RichTextEditor
                      key={`post-editor-en-${post?.id || 'new'}`}
                      value={bodyHtmlEn}
                      onChange={(html, json) => {
                        setBodyHtmlEn(html);
                        if (json) setBodyJsonEn(json);
                      }}
                      locale="en"
                      mediaFolder="blog"
                      currentUser={currentUser}
                      minHeightClassName="min-h-[320px]"
                      placeholder="Write your article in English..."
                    />
                  ) : (
                    <RichTextEditor
                      key={`post-editor-bn-${post?.id || 'new'}`}
                      value={bodyHtmlBn}
                      onChange={(html, json) => {
                        setBodyHtmlBn(html);
                        if (json) setBodyJsonBn(json);
                      }}
                      locale="bn"
                      mediaFolder="blog"
                      currentUser={currentUser}
                      minHeightClassName="min-h-[320px]"
                      placeholder="বাংলায় প্রবন্ধ লিখুন..."
                    />
                  )}
                </div>

                {/* SEO Settings */}
                <div className="rounded-xl border border-[rgb(var(--border-base))] p-4 space-y-3 bg-[rgb(var(--bg-muted))]/20">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--text-muted))]">
                    SEO & Search Preview ({activeLocale.toUpperCase()})
                  </h3>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium">SEO Title</label>
                      <span
                        className={`text-[11px] ${
                          seoTitleHint.status === 'long' ? 'text-amber-600' : 'text-[rgb(var(--text-muted))]'
                        }`}
                      >
                        {seoTitleHint.hint}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={activeLocale === 'en' ? seoTitleEn : seoTitleBn}
                      onChange={(e) =>
                        activeLocale === 'en'
                          ? setSeoTitleEn(e.target.value)
                          : setSeoTitleBn(e.target.value)
                      }
                      placeholder={
                        activeLocale === 'en'
                          ? titleEn || 'Custom SEO title (defaults to post title)'
                          : titleBn || 'Custom Bengali SEO title'
                      }
                      className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium">Meta Description</label>
                      <span
                        className={`text-[11px] ${
                          seoDescHint.status === 'long' ? 'text-amber-600' : 'text-[rgb(var(--text-muted))]'
                        }`}
                      >
                        {seoDescHint.hint}
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={activeLocale === 'en' ? seoDescriptionEn : seoDescriptionBn}
                      onChange={(e) =>
                        activeLocale === 'en'
                          ? setSeoDescriptionEn(e.target.value)
                          : setSeoDescriptionBn(e.target.value)
                      }
                      placeholder={
                        activeLocale === 'en'
                          ? excerptEn || 'Search snippet description (defaults to excerpt)'
                          : excerptBn || 'Bengali meta description'
                      }
                      className="w-full px-3 py-2 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Metadata, Cover, Taxonomy, Publish Date, Related Posts */}
              <div className="space-y-4">
                {/* Cover Image */}
                <div className="rounded-xl border border-[rgb(var(--border-base))] p-4 space-y-3 bg-[rgb(var(--bg-surface))]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--text-muted))]">
                      Cover Image
                    </h3>
                    {coverMediaId && (
                      <button
                        type="button"
                        onClick={() => {
                          setCoverMediaId(null);
                          setCoverImageUrl(null);
                        }}
                        className="text-[11px] text-red-600 hover:underline inline-flex items-center gap-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </button>
                    )}
                  </div>
                  {coverImageUrl ? (
                    <div className="overflow-hidden rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]">
                      <img
                        src={coverImageUrl}
                        alt={coverAltEn || titleEn || 'Cover preview'}
                        className="w-full h-36 object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-28 rounded-lg border border-dashed border-[rgb(var(--border-base))] flex flex-col items-center justify-center text-xs text-[rgb(var(--text-muted))]">
                      <ImageIcon className="h-5 w-5 mb-1 opacity-60" />
                      No cover image selected
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setMediaPickerOpen(true)}
                    className="w-full h-8 px-3 rounded-lg border border-[rgb(var(--border-base))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center justify-center gap-1.5"
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-primary-600" />
                    {coverMediaId ? 'Change Cover Image' : 'Pick Cover Image'}
                  </button>
                  <div>
                    <label className="block text-[11px] font-medium mb-1">
                      Cover Alt Text ({activeLocale.toUpperCase()})
                    </label>
                    <input
                      type="text"
                      value={activeLocale === 'en' ? coverAltEn : coverAltBn}
                      onChange={(e) =>
                        activeLocale === 'en'
                          ? setCoverAltEn(e.target.value)
                          : setCoverAltBn(e.target.value)
                      }
                      placeholder="Describe the cover image for accessibility"
                      className="w-full h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
                    />
                  </div>
                </div>

                {/* Category, Author & Tags */}
                <div className="rounded-xl border border-[rgb(var(--border-base))] p-4 space-y-3 bg-[rgb(var(--bg-surface))]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--text-muted))]">
                    Taxonomy & Author
                  </h3>
                  <div>
                    <label className="block text-[11px] font-medium mb-1">Category *</label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
                    >
                      <option value="">Select category…</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium mb-1">Author *</label>
                    <select
                      value={authorId}
                      onChange={(e) => setAuthorId(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
                    >
                      <option value="">Select author…</option>
                      {authors.map((auth) => (
                        <option key={auth.id} value={auth.id}>
                          {auth.displayName}
                          {auth.roleTitle ? ` (${auth.roleTitle})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium mb-1">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={tagsText}
                      onChange={(e) => setTagsText(e.target.value)}
                      placeholder="payroll, compliance, engineering"
                      className="w-full h-9 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
                    />
                  </div>
                </div>

                {/* Publish Date & Reading Time */}
                <div className="rounded-xl border border-[rgb(var(--border-base))] p-4 space-y-3 bg-[rgb(var(--bg-surface))]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--text-muted))]">
                    Publishing & Reading Time
                  </h3>
                  <div>
                    <label className="block text-[11px] font-medium mb-1">
                      Publish Date Override (optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={publishedAtLocal}
                      onChange={(e) => setPublishedAtLocal(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
                    />
                    <p className="text-[11px] text-[rgb(var(--text-muted))] mt-1">
                      Leave blank to stamp automatically when published.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1">
                      Reading Time (minutes)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={readingTimeOverride}
                      onChange={(e) => setReadingTimeOverride(e.target.value)}
                      placeholder={`Auto (${autoReadingMinutes} min)`}
                      className="w-full h-9 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
                    />
                  </div>
                </div>

                {/* Related Posts */}
                <div className="rounded-xl border border-[rgb(var(--border-base))] p-4 space-y-2.5 bg-[rgb(var(--bg-surface))]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--text-muted))]">
                    Related Posts ({relatedPostIds.length}/3)
                  </h3>
                  <p className="text-[11px] text-[rgb(var(--text-muted))]">
                    Pin up to 3 related posts. Remaining slots auto-fill by category & shared tags.
                  </p>
                  {candidateRelatedPosts.length === 0 ? (
                    <p className="text-xs text-[rgb(var(--text-muted))] italic">
                      No other posts created yet.
                    </p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {candidateRelatedPosts.map((cand) => {
                        const checked = relatedPostIds.includes(cand.id);
                        return (
                          <label
                            key={cand.id}
                            className="flex items-start gap-2 text-xs cursor-pointer p-1.5 rounded-md hover:bg-[rgb(var(--bg-muted))]/50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  if (relatedPostIds.length < 3) {
                                    setRelatedPostIds([...relatedPostIds, cand.id]);
                                  }
                                } else {
                                  setRelatedPostIds(relatedPostIds.filter((id) => id !== cand.id));
                                }
                              }}
                              className="mt-0.5 rounded border-[rgb(var(--border-base))]"
                            />
                            <span className="leading-snug flex-1">
                              {cand.titleEn}
                              <span className="ml-1 text-[10px] text-[rgb(var(--text-muted))]">
                                ({cand.status})
                              </span>
                            </span>
                            {checked && <Check className="h-3.5 w-3.5 text-primary-600 shrink-0" />}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <MediaLibraryPickerModal
        isOpen={mediaPickerOpen}
        locale={activeLocale}
        defaultFolder="blog"
        onClose={() => setMediaPickerOpen(false)}
        onSelect={(selection) => {
          setCoverMediaId(selection.media.id);
          setCoverImageUrl(selection.src);
          if (!coverAltEn.trim()) setCoverAltEn(selection.media.altEn || selection.alt || '');
          if (!coverAltBn.trim()) setCoverAltBn(selection.media.altBn || '');
          setMediaPickerOpen(false);
        }}
      />
    </div>
  );
}
