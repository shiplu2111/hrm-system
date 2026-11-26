import { useEffect, useState } from 'react';
import type { CmsCareerDto, CmsCareerStatus, CmsLocale } from '@hrm/shared-types';
import {
  AlertTriangle,
  Copy,
  Languages,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import { createCmsCareer, updateCmsCareer } from '@/lib/platform-cms-api';
import { hasPlatformPermission, type PermissionUser } from '@/lib/permissions';
import { RichTextEditor } from './RichTextEditor';
import { generateSlugFromTitle } from './custom-page-utils';

interface CareerEditorModalProps {
  isOpen: boolean;
  career: CmsCareerDto | null;
  currentUser: PermissionUser;
  onClose: () => void;
  onSaved: (saved: CmsCareerDto) => void;
}

export function CareerEditorModal({
  isOpen,
  career,
  currentUser,
  onClose,
  onSaved,
}: CareerEditorModalProps) {
  const canManage = hasPlatformPermission(currentUser, 'cms', 'manage');
  const [activeLocale, setActiveLocale] = useState<CmsLocale>('en');

  const [titleEn, setTitleEn] = useState('');
  const [titleBn, setTitleBn] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);

  const [department, setDepartment] = useState('Engineering');
  const [locationText, setLocationText] = useState('');
  const [locationType, setLocationType] = useState('hybrid');
  const [employmentType, setEmploymentType] = useState('full-time');
  const [status, setStatus] = useState<CmsCareerStatus>('draft');

  const [applyEmail, setApplyEmail] = useState('');
  const [applyUrl, setApplyUrl] = useState('');

  const [descriptionHtmlEn, setDescriptionHtmlEn] = useState('<p></p>');
  const [descriptionJsonEn, setDescriptionJsonEn] = useState<Record<string, unknown>>({});
  const [descriptionHtmlBn, setDescriptionHtmlBn] = useState('');
  const [descriptionJsonBn, setDescriptionJsonBn] = useState<Record<string, unknown> | null>(null);
  const [isBnTranslated, setIsBnTranslated] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setActiveLocale('en');
    if (career) {
      setTitleEn(career.titleEn);
      setTitleBn(career.titleBn ?? '');
      setSlug(career.slug);
      setSlugEdited(true);
      setDepartment(career.department);
      setLocationText(career.locationText);
      setLocationType(career.locationType);
      setEmploymentType(career.employmentType);
      setStatus(career.status);
      setApplyEmail(career.applyEmail ?? '');
      setApplyUrl(career.applyUrl ?? '');
      setDescriptionHtmlEn(career.descriptionHtmlEn || '<p></p>');
      setDescriptionJsonEn(career.descriptionJsonEn ?? {});
      setDescriptionHtmlBn(career.descriptionHtmlBn ?? '');
      setDescriptionJsonBn(career.descriptionJsonBn ?? null);
      setIsBnTranslated(career.isBnTranslated);
    } else {
      setTitleEn('');
      setTitleBn('');
      setSlug('');
      setSlugEdited(false);
      setDepartment('Engineering');
      setLocationText('Dhaka / Remote');
      setLocationType('hybrid');
      setEmploymentType('full-time');
      setStatus('draft');
      setApplyEmail('');
      setApplyUrl('');
      setDescriptionHtmlEn('<p></p>');
      setDescriptionJsonEn({});
      setDescriptionHtmlBn('');
      setDescriptionJsonBn(null);
      setIsBnTranslated(false);
    }
  }, [isOpen, career]);

  if (!isOpen) return null;

  const handleTitleChange = (val: string) => {
    setTitleEn(val);
    if (!slugEdited) {
      setSlug(generateSlugFromTitle(val));
    }
  };

  const handleCopyEnglishToBn = () => {
    setTitleBn((prev) => prev || titleEn);
    setDescriptionHtmlBn((prev) =>
      prev && prev.replace(/<[^>]+>/g, '').trim() ? prev : descriptionHtmlEn,
    );
    setDescriptionJsonBn((prev) => prev ?? descriptionJsonEn);
    setIsBnTranslated(true);
    setActiveLocale('bn');
  };

  const handleSave = async () => {
    setError(null);
    const bodyText = descriptionHtmlEn.replace(/<[^>]+>/g, '').trim();
    if (!titleEn.trim() || !slug.trim() || !locationText.trim() || !bodyText) {
      setError('Job title, slug, location, and rich-text description are required.');
      return;
    }
    if (!applyEmail.trim() && !applyUrl.trim()) {
      setError('Provide at least an Apply Email or Apply Link URL so candidates can apply.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        titleEn: titleEn.trim(),
        titleBn: titleBn.trim() || null,
        slug: slug.trim().toLowerCase(),
        department: department.trim() || 'General',
        locationText: locationText.trim(),
        locationType,
        employmentType,
        descriptionHtmlEn,
        descriptionJsonEn,
        descriptionHtmlBn: descriptionHtmlBn.trim() || null,
        descriptionJsonBn,
        isBnTranslated,
        applyEmail: applyEmail.trim() || null,
        applyUrl: applyUrl.trim() || null,
        ...(canManage ? { status } : {}),
      };
      const saved = career
        ? await updateCmsCareer(career.id, payload)
        : await createCmsCareer(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save career listing.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={career ? `Edit role: ${career.titleEn}` : 'New job listing'}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
    >
      <div className="bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border-base))] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[rgb(var(--border-base))] flex items-center justify-between gap-3 bg-[rgb(var(--bg-muted))]/40">
          <div>
            <h2 className="text-base font-bold">
              {career ? `Edit Role: ${career.titleEn}` : 'New Career Job Listing'}
            </h2>
            <p className="text-xs text-[rgb(var(--text-muted))]">
              Closed listings show a friendly “no longer open” page on <code className="font-mono">/careers/:slug</code> instead of 404.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close career editor"
            className="h-9 w-9 rounded-lg inline-flex items-center justify-center hover:bg-[rgb(var(--bg-hover))]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Structured Role Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Location *</label>
              <input
                type="text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="e.g., Dhaka, Bangladesh"
                className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Work Mode</label>
              <select
                value={locationType}
                onChange={(e) => setLocationType(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
              >
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Employment Type *</label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
              >
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Status</label>
              <select
                value={status}
                disabled={!canManage}
                onChange={(e) => setStatus(e.target.value as CmsCareerStatus)}
                className="w-full h-9 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs disabled:opacity-55"
              >
                <option value="draft">Draft (hidden)</option>
                <option value="open">Open (live)</option>
                <option value="closed">Closed (no longer open)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Engineering, Payroll Compliance..."
                className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Apply Link URL</label>
              <input
                type="url"
                value={applyUrl}
                onChange={(e) => setApplyUrl(e.target.value)}
                placeholder="https://jobs.cmsnbd.com/apply/..."
                className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Apply Email</label>
              <input
                type="email"
                value={applyEmail}
                onChange={(e) => setApplyEmail(e.target.value)}
                placeholder="careers@cmsnbd.com"
                className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold">URL Slug *</label>
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
            <div className="flex items-center">
              <span className="h-9 px-3 rounded-l-lg border border-r-0 border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] text-xs text-[rgb(var(--text-muted))] inline-flex items-center font-mono">
                /careers/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                }}
                placeholder="senior-payroll-engineer"
                className="flex-1 h-9 px-3 rounded-r-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs font-mono"
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

          {/* Job Title + Rich Text Description */}
          <div>
            <label className="block text-xs font-semibold mb-1">
              {activeLocale === 'en' ? 'Job Title (English) *' : 'Job Title (Bengali)'}
            </label>
            <input
              type="text"
              value={activeLocale === 'en' ? titleEn : titleBn}
              onChange={(e) =>
                activeLocale === 'en' ? handleTitleChange(e.target.value) : setTitleBn(e.target.value)
              }
              placeholder="e.g., Senior Backend Engineer (Deterministic Payroll)"
              className="w-full h-10 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">
              {activeLocale === 'en'
                ? 'Rich Text Job Description (English) *'
                : 'Rich Text Job Description (Bengali)'}
            </label>
            {activeLocale === 'en' ? (
              <RichTextEditor
                key={`career-en-${career?.id || 'new'}`}
                value={descriptionHtmlEn}
                onChange={(html, json) => {
                  setDescriptionHtmlEn(html);
                  if (json) setDescriptionJsonEn(json);
                }}
                locale="en"
                mediaFolder="careers"
                currentUser={currentUser}
                minHeightClassName="min-h-[260px]"
                placeholder="Role overview, responsibilities, requirements, compensation & benefits..."
              />
            ) : (
              <RichTextEditor
                key={`career-bn-${career?.id || 'new'}`}
                value={descriptionHtmlBn}
                onChange={(html, json) => {
                  setDescriptionHtmlBn(html);
                  if (json) setDescriptionJsonBn(json);
                }}
                locale="bn"
                mediaFolder="careers"
                currentUser={currentUser}
                minHeightClassName="min-h-[260px]"
                placeholder="পদের বিবরণ ও যোগ্যতা বাংলায় লিখুন..."
              />
            )}
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-[rgb(var(--border-base))] flex items-center justify-end gap-2 bg-[rgb(var(--bg-muted))]/30">
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
            onClick={handleSave}
            className="h-9 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving…' : 'Save Listing'}
          </button>
        </div>
      </div>
    </div>
  );
}
