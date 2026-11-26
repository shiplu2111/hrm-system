import { useEffect, useState } from 'react';
import type { CmsFaqDto, CmsLocale } from '@hrm/shared-types';
import {
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  Languages,
  Save,
  X,
} from 'lucide-react';
import { createCmsFaq, updateCmsFaq } from '@/lib/platform-cms-api';
import { hasPlatformPermission, type PermissionUser } from '@/lib/permissions';
import { RichTextEditor } from './RichTextEditor';

interface FaqEditorModalProps {
  isOpen: boolean;
  faq: CmsFaqDto | null;
  existingTopics: string[];
  currentUser: PermissionUser;
  onClose: () => void;
  onSaved: (saved: CmsFaqDto) => void;
}

const DEFAULT_TOPICS = [
  'general',
  'pricing',
  'billing',
  'payroll',
  'attendance',
  'leave',
  'compliance',
  'security',
];

export function FaqEditorModal({
  isOpen,
  faq,
  existingTopics,
  currentUser,
  onClose,
  onSaved,
}: FaqEditorModalProps) {
  const canPublish = hasPlatformPermission(currentUser, 'cms', 'manage');
  const [activeLocale, setActiveLocale] = useState<CmsLocale>('en');

  const [category, setCategory] = useState('general');
  const [pageSlug, setPageSlug] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [isPublished, setIsPublished] = useState(false);

  const [questionEn, setQuestionEn] = useState('');
  const [answerEn, setAnswerEn] = useState('<p></p>');
  const [answerJsonEn, setAnswerJsonEn] = useState<Record<string, unknown>>({});
  const [questionBn, setQuestionBn] = useState('');
  const [answerBn, setAnswerBn] = useState('');
  const [answerJsonBn, setAnswerJsonBn] = useState<Record<string, unknown> | null>(null);
  const [isBnTranslated, setIsBnTranslated] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setActiveLocale('en');
    if (faq) {
      setCategory(faq.category);
      setPageSlug(faq.pageSlug ?? '');
      setSortOrder(faq.sortOrder);
      setIsPublished(faq.isPublished);
      setQuestionEn(faq.questionEn);
      setAnswerEn(
        faq.answerEn && faq.answerEn.includes('<')
          ? faq.answerEn
          : faq.answerEn
            ? `<p>${faq.answerEn}</p>`
            : '<p></p>',
      );
      setAnswerJsonEn(faq.answerJsonEn ?? {});
      setQuestionBn(faq.questionBn ?? '');
      setAnswerBn(
        faq.answerBn && faq.answerBn.includes('<')
          ? faq.answerBn
          : faq.answerBn
            ? `<p>${faq.answerBn}</p>`
            : '',
      );
      setAnswerJsonBn(faq.answerJsonBn ?? null);
      setIsBnTranslated(faq.isBnTranslated);
    } else {
      setCategory(existingTopics[0] || 'general');
      setPageSlug('');
      setSortOrder(0);
      setIsPublished(canPublish);
      setQuestionEn('');
      setAnswerEn('<p></p>');
      setAnswerJsonEn({});
      setQuestionBn('');
      setAnswerBn('');
      setAnswerJsonBn(null);
      setIsBnTranslated(false);
    }
  }, [isOpen, faq, existingTopics, canPublish]);

  if (!isOpen) return null;

  const topicSuggestions = Array.from(new Set([...DEFAULT_TOPICS, ...existingTopics])).sort();

  const handleCopyEnglishToBn = () => {
    setQuestionBn((prev) => prev || questionEn);
    setAnswerBn((prev) => (prev && prev.replace(/<[^>]+>/g, '').trim() ? prev : answerEn));
    setAnswerJsonBn((prev) => prev ?? answerJsonEn);
    setIsBnTranslated(true);
    setActiveLocale('bn');
  };

  const handleSave = async () => {
    setError(null);
    const cleanTextEn = answerEn.replace(/<[^>]+>/g, '').trim();
    if (!category.trim() || !questionEn.trim() || !cleanTextEn) {
      setError('Topic, English question, and English rich-text answer are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        category: category.trim().toLowerCase(),
        pageSlug: pageSlug.trim().toLowerCase() || null,
        sortOrder: Number(sortOrder) || 0,
        questionEn: questionEn.trim(),
        answerEn,
        answerJsonEn,
        questionBn: questionBn.trim() || null,
        answerBn: answerBn.trim() || null,
        answerJsonBn,
        isBnTranslated,
        ...(canPublish ? { isPublished } : {}),
      };
      const saved = faq
        ? await updateCmsFaq(faq.id, payload)
        : await createCmsFaq(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save FAQ entry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={faq ? `Edit FAQ: ${faq.questionEn}` : 'New FAQ Item'}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
    >
      <div className="bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border-base))] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[rgb(var(--border-base))] flex items-center justify-between gap-3 bg-[rgb(var(--bg-muted))]/40">
          <div>
            <h2 className="text-base font-bold">
              {faq ? 'Edit FAQ Item' : 'New Reusable FAQ Item'}
            </h2>
            <p className="text-xs text-[rgb(var(--text-muted))]">
              Grouped by topic and pickable into any page&apos;s FAQ block per locale.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close FAQ editor"
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

          {/* Topic, Default Page, Order, Publish */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Topic Group *</label>
              <input
                type="text"
                list="cms-faq-topics"
                value={category}
                onChange={(e) => setCategory(e.target.value.toLowerCase())}
                placeholder="pricing, payroll..."
                className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
              />
              <datalist id="cms-faq-topics">
                {topicSuggestions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Page Hint (optional)</label>
              <input
                type="text"
                value={pageSlug}
                onChange={(e) => setPageSlug(e.target.value.toLowerCase())}
                placeholder="e.g., pricing"
                className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Sort Order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Visibility</label>
              <button
                type="button"
                disabled={!canPublish}
                onClick={() => setIsPublished((v) => !v)}
                className={`w-full h-9 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-55 ${
                  isPublished
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-[rgb(var(--text-secondary))]'
                }`}
              >
                {isPublished ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {isPublished ? 'Published' : 'Draft'}
              </button>
            </div>
          </div>

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

          <div>
            <label className="block text-xs font-semibold mb-1">
              {activeLocale === 'en' ? 'Question (English) *' : 'Question (Bengali)'}
            </label>
            <input
              type="text"
              value={activeLocale === 'en' ? questionEn : questionBn}
              onChange={(e) =>
                activeLocale === 'en' ? setQuestionEn(e.target.value) : setQuestionBn(e.target.value)
              }
              placeholder="e.g., How does deterministic payroll versioning work?"
              className="w-full h-10 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">
              {activeLocale === 'en'
                ? 'Rich Text Answer (English) *'
                : 'Rich Text Answer (Bengali)'}
            </label>
            {activeLocale === 'en' ? (
              <RichTextEditor
                key={`faq-en-${faq?.id || 'new'}`}
                value={answerEn}
                onChange={(html, json) => {
                  setAnswerEn(html);
                  if (json) setAnswerJsonEn(json);
                }}
                locale="en"
                mediaFolder="pages"
                currentUser={currentUser}
                minHeightClassName="min-h-[200px]"
                placeholder="Write a clear answer with links, bold highlights, or bullet lists..."
              />
            ) : (
              <RichTextEditor
                key={`faq-bn-${faq?.id || 'new'}`}
                value={answerBn}
                onChange={(html, json) => {
                  setAnswerBn(html);
                  if (json) setAnswerJsonBn(json);
                }}
                locale="bn"
                mediaFolder="pages"
                currentUser={currentUser}
                minHeightClassName="min-h-[200px]"
                placeholder="বাংলায় উত্তর লিখুন..."
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
            {saving ? 'Saving…' : 'Save FAQ'}
          </button>
        </div>
      </div>
    </div>
  );
}
