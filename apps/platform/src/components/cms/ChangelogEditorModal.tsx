import { useEffect, useState } from 'react';
import type { CmsChangelogEntryDto, CmsChangelogTag, CmsLocale } from '@hrm/shared-types';
import {
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  Languages,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import {
  createCmsChangelogEntry,
  updateCmsChangelogEntry,
} from '@/lib/platform-cms-api';
import { hasPlatformPermission, type PermissionUser } from '@/lib/permissions';
import { RichTextEditor } from './RichTextEditor';
import { generateSlugFromTitle } from './custom-page-utils';

interface ChangelogEditorModalProps {
  isOpen: boolean;
  entry: CmsChangelogEntryDto | null;
  currentUser: PermissionUser;
  onClose: () => void;
  onSaved: (saved: CmsChangelogEntryDto) => void;
}

export function ChangelogEditorModal({
  isOpen,
  entry,
  currentUser,
  onClose,
  onSaved,
}: ChangelogEditorModalProps) {
  const canPublish = hasPlatformPermission(currentUser, 'cms', 'manage');
  const [activeLocale, setActiveLocale] = useState<CmsLocale>('en');

  const [releaseDate, setReleaseDate] = useState('');
  const [tag, setTag] = useState<CmsChangelogTag>('new');
  const [titleEn, setTitleEn] = useState('');
  const [titleBn, setTitleBn] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [versionLabel, setVersionLabel] = useState('');
  const [moduleRefs, setModuleRefs] = useState('');

  const [bodyHtmlEn, setBodyHtmlEn] = useState('<p></p>');
  const [bodyJsonEn, setBodyJsonEn] = useState<Record<string, unknown>>({});
  const [bodyHtmlBn, setBodyHtmlBn] = useState('');
  const [bodyJsonBn, setBodyJsonBn] = useState<Record<string, unknown> | null>(null);
  const [isBnTranslated, setIsBnTranslated] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setActiveLocale('en');
    if (entry) {
      setReleaseDate(entry.releaseDate);
      setTag(entry.tag);
      setTitleEn(entry.titleEn);
      setTitleBn(entry.titleBn ?? '');
      setSlug(entry.slug);
      setSlugEdited(true);
      setVersionLabel(entry.versionLabel ?? '');
      setModuleRefs(entry.moduleRefs ?? '');
      setBodyHtmlEn(
        entry.bodyHtmlEn ||
          (entry.summaryEn ? `<p>${entry.summaryEn}</p>` : '<p></p>'),
      );
      setBodyJsonEn(entry.bodyJsonEn ?? {});
      setBodyHtmlBn(entry.bodyHtmlBn ?? (entry.summaryBn ? `<p>${entry.summaryBn}</p>` : ''));
      setBodyJsonBn(entry.bodyJsonBn ?? null);
      setIsBnTranslated(entry.isBnTranslated);
      setIsPublished(entry.isPublished);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setReleaseDate(today);
      setTag('new');
      setTitleEn('');
      setTitleBn('');
      setSlug('');
      setSlugEdited(false);
      setVersionLabel('');
      setModuleRefs('');
      setBodyHtmlEn('<p></p>');
      setBodyJsonEn({});
      setBodyHtmlBn('');
      setBodyJsonBn(null);
      setIsBnTranslated(false);
      setIsPublished(false);
    }
  }, [isOpen, entry]);

  if (!isOpen) return null;

  const handleTitleChange = (val: string) => {
    setTitleEn(val);
    if (!slugEdited) {
      setSlug(generateSlugFromTitle(val));
    }
  };

  const handleCopyEnglishToBn = () => {
    setTitleBn((prev) => prev || titleEn);
    setBodyHtmlBn((prev) => (prev && prev.replace(/<[^>]+>/g, '').trim() ? prev : bodyHtmlEn));
    setBodyJsonBn((prev) => prev ?? bodyJsonEn);
    setIsBnTranslated(true);
    setActiveLocale('bn');
  };

  const handleSave = async (overridePublished?: boolean) => {
    setError(null);
    const bodyTextEn = bodyHtmlEn.replace(/<[^>]+>/g, '').trim();
    if (!releaseDate || !titleEn.trim() || !slug.trim() || !bodyTextEn) {
      setError('Date, title, slug, and rich-text body are required.');
      return;
    }

    const nextPublished =
      overridePublished !== undefined ? overridePublished : isPublished;

    setSaving(true);
    try {
      const payload = {
        releaseDate,
        tag,
        slug: slug.trim().toLowerCase(),
        versionLabel: versionLabel.trim(),
        moduleRefs: moduleRefs.trim() || null,
        titleEn: titleEn.trim(),
        bodyHtmlEn,
        bodyJsonEn,
        titleBn: titleBn.trim() || null,
        bodyHtmlBn: bodyHtmlBn.trim() || null,
        bodyJsonBn,
        isBnTranslated,
        ...(canPublish ? { isPublished: nextPublished } : {}),
      };
      const saved = entry
        ? await updateCmsChangelogEntry(entry.id, payload)
        : await createCmsChangelogEntry(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changelog entry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={entry ? `Edit changelog: ${entry.titleEn}` : 'New changelog entry'}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
    >
      <div className="bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border-base))] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="px-5 py-3.5 border-b border-[rgb(var(--border-base))] flex flex-wrap items-center justify-between gap-3 bg-[rgb(var(--bg-muted))]/40">
          <div>
            <h2 className="text-base font-bold">
              {entry ? `Edit Changelog: ${entry.titleEn}` : 'New Changelog Entry'}
            </h2>
            <p className="text-xs text-[rgb(var(--text-muted))]">
              Only entries marked <strong>Published</strong> appear on <code className="font-mono">/changelog</code> and <code className="font-mono">/changelog/rss.xml</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close changelog editor"
            className="h-9 w-9 rounded-lg inline-flex items-center justify-center hover:bg-[rgb(var(--bg-hover))]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Core Metadata Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Release Date *</label>
              <input
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Tag *</label>
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value as CmsChangelogTag)}
                className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
              >
                <option value="new">New</option>
                <option value="improved">Improved</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Visibility</label>
              <button
                type="button"
                disabled={!canPublish}
                onClick={() => setIsPublished((v) => !v)}
                className={`w-full h-9 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-55 ${
                  isPublished
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-[rgb(var(--text-secondary))]'
                }`}
              >
                {isPublished ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {isPublished ? 'Published (Visible)' : 'Draft / Hidden'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold">Slug (anchor URL) *</label>
                <button
                  type="button"
                  onClick={() => {
                    setSlug(generateSlugFromTitle(titleEn));
                    setSlugEdited(true);
                  }}
                  className="text-[11px] text-primary-600 hover:underline inline-flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  From title
                </button>
              </div>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                }}
                placeholder="payroll-tax-engine-v2"
                className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Area / Version (optional)</label>
              <input
                type="text"
                value={moduleRefs}
                onChange={(e) => setModuleRefs(e.target.value)}
                placeholder="e.g., Payroll & Compliance"
                className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
              />
            </div>
          </div>

          {/* Locale Tabs */}
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

            {activeLocale === 'bn' && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopyEnglishToBn}
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
                  />
                  Mark BN live
                </label>
              </div>
            )}
          </div>

          {/* Title & Rich Text Body */}
          <div>
            <label className="block text-xs font-semibold mb-1">
              {activeLocale === 'en' ? 'Title (English) *' : 'Title (Bengali)'}
            </label>
            <input
              type="text"
              value={activeLocale === 'en' ? titleEn : titleBn}
              onChange={(e) =>
                activeLocale === 'en'
                  ? handleTitleChange(e.target.value)
                  : setTitleBn(e.target.value)
              }
              placeholder="e.g., Deterministic Tax Slab Versioning & Attendance Exports"
              className="w-full h-10 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">
              {activeLocale === 'en' ? 'Rich Text Body (English) *' : 'Rich Text Body (Bengali)'}
            </label>
            {activeLocale === 'en' ? (
              <RichTextEditor
                key={`changelog-en-${entry?.id || 'new'}`}
                value={bodyHtmlEn}
                onChange={(html, json) => {
                  setBodyHtmlEn(html);
                  if (json) setBodyJsonEn(json);
                }}
                locale="en"
                mediaFolder="changelog"
                currentUser={currentUser}
                minHeightClassName="min-h-[240px]"
                placeholder="Describe what shipped, key improvements, and fixes..."
              />
            ) : (
              <RichTextEditor
                key={`changelog-bn-${entry?.id || 'new'}`}
                value={bodyHtmlBn}
                onChange={(html, json) => {
                  setBodyHtmlBn(html);
                  if (json) setBodyJsonBn(json);
                }}
                locale="bn"
                mediaFolder="changelog"
                currentUser={currentUser}
                minHeightClassName="min-h-[240px]"
                placeholder="বাংলায় পরিবর্তনের বিস্তারিত লিখুন..."
              />
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-[rgb(var(--border-base))] flex flex-wrap items-center justify-end gap-2 bg-[rgb(var(--bg-muted))]/30">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3.5 rounded-lg border border-[rgb(var(--border-base))] text-xs font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave()}
            className="h-9 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving…' : 'Save Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}
