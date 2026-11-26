import { useEffect, useMemo, useState } from 'react';
import type {
  CmsBlockNode,
  CmsFaqDto,
  CmsLeafBlock,
  CmsLocale,
  CmsPageDetailDto,
  CmsPageDto,
  CmsTranslationStatus,
} from '@hrm/shared-types';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Columns,
  Copy,
  ExternalLink,
  HelpCircle,
  History,
  Image as ImageIcon,
  Languages,
  Lock,
  Monitor,
  Save,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermission';
import { useCmsEditorCollaboration } from '@/hooks/useCmsEditorCollaboration';
import {
  approveCmsLegalPage,
  createCmsPagePreviewToken,
  fetchCmsPageDetail,
  listCmsFaqs,
  publishCmsPage,
  saveCmsPageVersion,
  submitCmsLegalApproval,
} from '@/lib/platform-cms-api';
import { RichTextEditor } from '@/components/cms/RichTextEditor';
import { CmsFaqPicker } from '@/components/cms/CmsFaqPicker';
import { MediaLibraryPickerModal } from '@/components/cms/MediaLibraryPickerModal';
import { VersionHistoryPanel } from '@/components/cms/VersionHistoryPanel';
import { VersionConflictModal } from '@/components/cms/VersionConflictModal';
import { mergeDraftWithServerVersion } from '@/components/cms/cms-diff-utils';
import { validateCmsLinkInput } from '@/components/cms/rich-text-utils';
import {
  buildLocaleDraftFromDetail,
  copyEnglishDraftToBengali,
  getSeoLengthHint,
  isLegalSystemPage,
  validateSystemPageRequiredFields,
  type SystemPageLocaleDraft,
} from '@/components/cms/system-page-editor-utils';

const WEBSITE_BASE_URL =
  import.meta.env.VITE_WEBSITE_URL || 'http://localhost:3000';

interface SystemPageEditorProps {
  detail: CmsPageDetailDto;
  onClose: () => void;
  onUpdated: (updatedPage: CmsPageDto) => void;
}

const DYNAMIC_WIDGET_LABELS: Record<string, { title: string; summary: string }> = {
  pricing_table: {
    title: 'Locked Pricing Table Widget',
    summary:
      'Live subscription tiers, monthly/annual prices, and billing currencies are read directly from Platform Billing config. Prices cannot be altered in CMS.',
  },
  country_list: {
    title: 'Locked Country Compliance List Widget',
    summary:
      'Supported countries, statutory tax packs, and payroll rules sync directly from Country Config. Countries and statutory rates cannot be edited in CMS.',
  },
  plan_comparison: {
    title: 'Locked Plan Comparison Matrix Widget',
    summary:
      'Feature entitlements and seat caps sync automatically with billing tiers and cannot be removed or modified here.',
  },
};

export function SystemPageEditor({
  detail: initialDetail,
  onClose,
  onUpdated,
}: SystemPageEditorProps) {
  const { can, user } = usePermissions();
  const canEditCms = can('cms', 'edit');
  const canPublishCms = can('cms', 'manage');

  const [detail, setDetail] = useState<CmsPageDetailDto>(initialDetail);
  const [activeLocale, setActiveLocale] = useState<CmsLocale>('en');
  const [drafts, setDrafts] = useState<Record<CmsLocale, SystemPageLocaleDraft>>(() => ({
    en: buildLocaleDraftFromDetail(initialDetail, 'en'),
    bn: buildLocaleDraftFromDetail(initialDetail, 'bn'),
  }));

  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'phone'>('desktop');
  const [showPreviewPane, setShowPreviewPane] = useState(true);

  const [faqs, setFaqs] = useState<CmsFaqDto[]>([]);
  const [faqSearch, setFaqSearch] = useState('');

  // Media Picker target: either social ogImage or a specific image block path
  const [mediaTarget, setMediaTarget] = useState<
    | { kind: 'og' }
    | { kind: 'block'; topIndex: number; colIndex?: number; childIndex?: number }
    | null
  >(null);

  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [signedPreviewLink, setSignedPreviewLink] = useState<string | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const currentDraft = drafts[activeLocale];

  const {
    hasUnsavedChanges,
    autosaving,
    lastAutosavedAt,
    otherEditors,
    conflict,
    setConflict,
    activeBaseVersion,
    baselineDraft,
    markLocaleSaved,
    confirmLeaveIfDirty,
    handleSaveErrorConflict,
  } = useCmsEditorCollaboration({
    pageId: detail.page.id,
    activeLocale,
    detail,
    currentDraft,
    canEdit: canEditCms,
    onDraftSyncedFromServer: (refreshed, loc) => {
      const nextDraft = buildLocaleDraftFromDetail(refreshed, loc);
      setDetail(refreshed);
      setDrafts((prev) => ({ ...prev, [loc]: nextDraft }));
      onUpdated(refreshed.page);
    },
    onAutosaved: (ver) => {
      setNotice(
        `Autosaved ${ver.locale.toUpperCase()} draft v${ver.versionNumber}.`,
      );
    },
  });

  useEffect(() => {
    const enDraft = buildLocaleDraftFromDetail(initialDetail, 'en');
    const bnDraft = buildLocaleDraftFromDetail(initialDetail, 'bn');
    setDetail(initialDetail);
    setDrafts({ en: enDraft, bn: bnDraft });
    markLocaleSaved('en', enDraft);
    markLocaleSaved('bn', bnDraft);
  }, [initialDetail, markLocaleSaved]);

  useEffect(() => {
    void listCmsFaqs()
      .then((rows) => setFaqs(rows))
      .catch(() => setFaqs([]));
  }, []);

  const isLegal = isLegalSystemPage(detail.page.slug, detail.page.requiresApproval);
  const requiredWarnings = useMemo(
    () => validateSystemPageRequiredFields(currentDraft),
    [currentDraft],
  );
  const warningPathSet = useMemo(
    () => new Set(requiredWarnings.map((w) => w.path)),
    [requiredWarnings],
  );

  const seoTitleHint = useMemo(
    () => getSeoLengthHint('title', currentDraft.seoTitle),
    [currentDraft.seoTitle],
  );
  const seoDescHint = useMemo(
    () => getSeoLengthHint('description', currentDraft.seoDescription),
    [currentDraft.seoDescription],
  );

  const updateCurrentDraft = (
    updater: (prev: SystemPageLocaleDraft) => SystemPageLocaleDraft,
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [activeLocale]: updater(prev[activeLocale]),
    }));
  };

  const updateBlockAt = (
    topIndex: number,
    updater: (block: CmsBlockNode) => CmsBlockNode,
    colIndex?: number,
    childIndex?: number,
  ) => {
    updateCurrentDraft((prev) => {
      const nextBlocks = [...prev.blocks];
      const top = nextBlocks[topIndex];
      if (!top) return prev;

      if (
        colIndex !== undefined &&
        childIndex !== undefined &&
        top.type === 'columns'
      ) {
        const nextCols = top.props.columns.map((col, cIdx) => {
          if (cIdx !== colIndex) return col;
          const nextChildren = col.blocks.map((child, chIdx) =>
            chIdx === childIndex ? (updater(child) as CmsLeafBlock) : child,
          );
          return { ...col, blocks: nextChildren };
        });
        nextBlocks[topIndex] = {
          ...top,
          props: { ...top.props, columns: nextCols },
        };
      } else {
        nextBlocks[topIndex] = updater(top);
      }

      return { ...prev, blocks: nextBlocks };
    });
  };

  const handleCopyFromEnglish = () => {
    setDrafts((prev) => ({
      ...prev,
      bn: copyEnglishDraftToBengali(prev.en, prev.bn),
    }));
    setNotice(
      'Copied English copy, SEO fields, and fixed block layout into Bengali draft. Translate each field before marking Bengali as Translated.',
    );
  };

  const handleSaveDraft = async (forceOverwrite = false): Promise<boolean> => {
    if (!canEditCms) return false;
    if (!currentDraft.title.trim()) {
      setError('Page Title is required before saving a draft version.');
      return false;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveCmsPageVersion(detail.page.id, {
        locale: activeLocale,
        title: currentDraft.title.trim(),
        seoTitle: currentDraft.seoTitle.trim() || null,
        seoDescription: currentDraft.seoDescription.trim() || null,
        canonicalPath: currentDraft.canonicalPath.trim() || null,
        ogImageUrl: currentDraft.ogImageUrl.trim() || null,
        noIndex: currentDraft.noIndex,
        blocks: currentDraft.blocks,
        isTranslated:
          activeLocale === 'en'
            ? true
            : currentDraft.translationStatus === 'translated',
        translationStatus:
          activeLocale === 'en' ? 'translated' : currentDraft.translationStatus,
        changeNote:
          currentDraft.changeNote.trim() ||
          `Updated ${activeLocale.toUpperCase()} content via System Page Editor`,
        publishImmediately: false,
        baseVersionId: activeBaseVersion?.id,
        expectedVersionNumber: activeBaseVersion?.versionNumber,
        forceOverwrite,
      });

      const refreshed = await fetchCmsPageDetail(detail.page.id);
      const nextDraft = buildLocaleDraftFromDetail(refreshed, activeLocale);
      setDetail(refreshed);
      setDrafts((prev) => ({
        ...prev,
        [activeLocale]: nextDraft,
      }));
      markLocaleSaved(activeLocale, nextDraft);
      onUpdated(refreshed.page);
      setNotice(
        `Saved draft ${saved.locale.toUpperCase()} v${saved.versionNumber} for "/${detail.page.slug}".`,
      );
      return true;
    } catch (err) {
      if (handleSaveErrorConflict(err)) {
        return false;
      }
      setError(err instanceof Error ? err.message : 'Failed to save draft version.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleRequestClose = () => {
    if (!confirmLeaveIfDirty()) return;
    onClose();
  };

  const handleUseServerVersion = async () => {
    setBusyAction('resolve');
    try {
      const refreshed = await fetchCmsPageDetail(detail.page.id);
      const nextDraft = buildLocaleDraftFromDetail(refreshed, activeLocale);
      setDetail(refreshed);
      setDrafts((prev) => ({ ...prev, [activeLocale]: nextDraft }));
      markLocaleSaved(activeLocale, nextDraft);
      onUpdated(refreshed.page);
      setConflict(null);
      setNotice(
        `Loaded latest server version (${activeLocale.toUpperCase()} v${conflict?.latestVersion.versionNumber ?? ''}).`,
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleMergeWithServer = async () => {
    if (!conflict) return;
    setBusyAction('resolve');
    try {
      const refreshed = await fetchCmsPageDetail(detail.page.id);
      const { mergedDraft, conflictedFields } = mergeDraftWithServerVersion({
        localDraft: currentDraft,
        baseDraft: baselineDraft,
        serverVersion: conflict.latestVersion,
      });
      setDetail(refreshed);
      setDrafts((prev) => ({ ...prev, [activeLocale]: mergedDraft }));
      setConflict(null);
      setNotice(
        conflictedFields.length > 0
          ? `Merged with server v${conflict.latestVersion.versionNumber}. Dual-edited fields kept yours: ${conflictedFields.join(', ')}. Review and save.`
          : `Merged non-conflicting changes with server v${conflict.latestVersion.versionNumber}. Review and save.`,
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handlePreviewNewTab = async () => {
    setBusyAction('preview');
    setError(null);
    try {
      const tokenBundle = await createCmsPagePreviewToken(detail.page.id, activeLocale);
      const base = WEBSITE_BASE_URL.replace(/\/+$/, '');
      const fullPreviewUrl = `${base}/${activeLocale}/preview?token=${encodeURIComponent(tokenBundle.token)}`;
      setSignedPreviewLink(fullPreviewUrl);
      window.open(fullPreviewUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create signed preview token.');
    } finally {
      setBusyAction(null);
    }
  };

  const handlePublishOrSubmit = async () => {
    if (requiredWarnings.length > 0) {
      setError(
        `Complete all ${requiredWarnings.length} required field(s) before ${isLegal ? 'submitting for approval' : 'publishing'}.`,
      );
      return;
    }

    setBusyAction('publish');
    setError(null);
    setNotice(null);
    try {
      // Save latest draft first so submitted/published snapshot includes current edits
      const ok = await handleSaveDraft();
      if (!ok) {
        setBusyAction(null);
        return;
      }

      if (isLegal) {
        const updated = await submitCmsLegalApproval(detail.page.id, {
          locale: activeLocale,
          note: currentDraft.changeNote.trim() || 'Submitted legal update for four-eyes review',
        });
        const refreshed = await fetchCmsPageDetail(detail.page.id);
        setDetail(refreshed);
        onUpdated(updated);
        setNotice(
          `Submitted legal page "/${detail.page.slug}" for Stage F four-eyes approval.`,
        );
      } else {
        const updated = await publishCmsPage(detail.page.id, {
          locale: activeLocale,
          note: currentDraft.changeNote.trim() || undefined,
        });
        const refreshed = await fetchCmsPageDetail(detail.page.id);
        setDetail(refreshed);
        onUpdated(updated);
        setNotice(`Published "/${detail.page.slug}" (${activeLocale.toUpperCase()}) live.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleApproveLegalNow = async () => {
    if (!isLegal || !canPublishCms) return;
    setBusyAction('approve');
    setError(null);
    try {
      const updated = await approveCmsLegalPage(detail.page.id, {
        publishNow: true,
        note: 'Approved & published from System Page Editor',
      });
      const refreshed = await fetchCmsPageDetail(detail.page.id);
      setDetail(refreshed);
      onUpdated(updated);
      setNotice(`Legal revision approved and published for "/${detail.page.slug}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Legal approval failed.');
    } finally {
      setBusyAction(null);
    }
  };

  const renderBlockEditor = (
    block: CmsBlockNode,
    topIndex: number,
    colIndex?: number,
    childIndex?: number,
    pathPrefix = '',
  ) => {
    const path = `${pathPrefix}${block.id}`;

    const setBlock = (updater: (b: CmsBlockNode) => CmsBlockNode) =>
      updateBlockAt(topIndex, updater, colIndex, childIndex);

    return (
      <div
        key={`${path}-${topIndex}-${colIndex ?? 'x'}-${childIndex ?? 'x'}`}
        className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-4 space-y-3"
      >
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[rgb(var(--border-base))]">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span className="text-xs font-semibold capitalize">
              {block.type.replace(/_/g, ' ')} Slot
            </span>
            <code className="text-[10px] px-1.5 py-0.5 rounded bg-[rgb(var(--bg-muted))] text-[rgb(var(--text-muted))]">
              {block.id}
            </code>
          </div>
          <span className="text-[10px] text-[rgb(var(--text-muted))]">Fixed Slot</span>
        </div>

        {block.type === 'heading' && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-[11px] text-[rgb(var(--text-muted))]">
              <span className="px-2 py-0.5 rounded bg-[rgb(var(--bg-muted))] font-mono font-semibold">
                H{block.props.level}
              </span>
              <span>Heading level is locked to preserve page hierarchy.</span>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Heading Text <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                lang={activeLocale}
                value={block.props.text}
                onChange={(e) =>
                  setBlock((b) =>
                    b.type === 'heading'
                      ? { ...b, props: { ...b.props, text: e.target.value } }
                      : b,
                  )
                }
                className={`w-full h-9 px-3 rounded-lg border text-xs bg-[rgb(var(--bg-surface))] ${
                  warningPathSet.has(`${path}.text`)
                    ? 'border-rose-500 ring-1 ring-rose-500/30'
                    : 'border-[rgb(var(--border-base))]'
                }`}
              />
              {warningPathSet.has(`${path}.text`) && (
                <p className="text-[11px] text-rose-600 mt-1">Heading text is required.</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Subtitle (optional)</label>
              <input
                type="text"
                lang={activeLocale}
                value={block.props.subtitle || ''}
                onChange={(e) =>
                  setBlock((b) =>
                    b.type === 'heading'
                      ? { ...b, props: { ...b.props, subtitle: e.target.value || undefined } }
                      : b,
                  )
                }
                className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              />
            </div>
          </div>
        )}

        {block.type === 'rich_text' && (
          <div>
            <label className="block text-xs font-medium mb-1.5">
              Rich Text Content <span className="text-rose-500">*</span>
            </label>
            <RichTextEditor
              value={block.props.html}
              onChange={(html) =>
                setBlock((b) =>
                  b.type === 'rich_text' ? { ...b, props: { html } } : b,
                )
              }
              locale={activeLocale}
              mediaFolder="pages"
              currentUser={user}
              allowRawHtml
              readOnly={!canEditCms}
              minHeightClassName="min-h-[180px]"
            />
            {warningPathSet.has(`${path}.html`) && (
              <p className="text-[11px] text-rose-600 mt-1">
                Rich text block requires non-empty content.
              </p>
            )}
          </div>
        )}

        {block.type === 'image' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-20 w-32 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] overflow-hidden flex items-center justify-center shrink-0">
                {block.props.mediaId ? (
                  <img
                    src={`/api/v1/public/content/media/${block.props.mediaId}/file`}
                    alt={block.props.alt || 'Selected media'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-6 w-6 text-[rgb(var(--text-muted))]" />
                )}
              </div>
              <div className="flex-1 min-w-[200px] space-y-2">
                <button
                  type="button"
                  onClick={() =>
                    setMediaTarget({ kind: 'block', topIndex, colIndex, childIndex })
                  }
                  className="h-8 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
                >
                  <ImageIcon className="h-3.5 w-3.5 text-primary-600" />
                  Choose Image from Media Library
                </button>
                <div className="text-[11px] font-mono text-[rgb(var(--text-muted))]">
                  mediaId: {block.props.mediaId || 'Not selected'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Alt Text <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  lang={activeLocale}
                  value={block.props.alt}
                  onChange={(e) =>
                    setBlock((b) =>
                      b.type === 'image'
                        ? { ...b, props: { ...b.props, alt: e.target.value } }
                        : b,
                    )
                  }
                  className={`w-full h-9 px-3 rounded-lg border text-xs bg-[rgb(var(--bg-surface))] ${
                    warningPathSet.has(`${path}.alt`)
                      ? 'border-rose-500'
                      : 'border-[rgb(var(--border-base))]'
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Caption (optional)</label>
                <input
                  type="text"
                  lang={activeLocale}
                  value={block.props.caption || ''}
                  onChange={(e) =>
                    setBlock((b) =>
                      b.type === 'image'
                        ? {
                            ...b,
                            props: { ...b.props, caption: e.target.value || undefined },
                          }
                        : b,
                    )
                  }
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {block.type === 'button' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">
                Button Label <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                lang={activeLocale}
                value={block.props.label}
                onChange={(e) =>
                  setBlock((b) =>
                    b.type === 'button'
                      ? { ...b, props: { ...b.props, label: e.target.value } }
                      : b,
                  )
                }
                className={`w-full h-9 px-3 rounded-lg border text-xs bg-[rgb(var(--bg-surface))] ${
                  warningPathSet.has(`${path}.label`)
                    ? 'border-rose-500'
                    : 'border-[rgb(var(--border-base))]'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Link URL <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={block.props.href}
                onChange={(e) =>
                  setBlock((b) =>
                    b.type === 'button'
                      ? { ...b, props: { ...b.props, href: e.target.value } }
                      : b,
                  )
                }
                className={`w-full h-9 px-3 rounded-lg border text-xs font-mono bg-[rgb(var(--bg-surface))] ${
                  warningPathSet.has(`${path}.href`)
                    ? 'border-rose-500'
                    : 'border-[rgb(var(--border-base))]'
                }`}
              />
              {warningPathSet.has(`${path}.href`) && (
                <p className="text-[11px] text-rose-600 mt-1">
                  {validateCmsLinkInput(block.props.href).error}
                </p>
              )}
            </div>
          </div>
        )}

        {block.type === 'feature_cards' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Section Heading</label>
                <input
                  type="text"
                  lang={activeLocale}
                  value={block.props.heading || ''}
                  onChange={(e) =>
                    setBlock((b) =>
                      b.type === 'feature_cards'
                        ? {
                            ...b,
                            props: { ...b.props, heading: e.target.value || undefined },
                          }
                        : b,
                    )
                  }
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Section Subtitle</label>
                <input
                  type="text"
                  lang={activeLocale}
                  value={block.props.subtitle || ''}
                  onChange={(e) =>
                    setBlock((b) =>
                      b.type === 'feature_cards'
                        ? {
                            ...b,
                            props: { ...b.props, subtitle: e.target.value || undefined },
                          }
                        : b,
                    )
                  }
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              {block.props.cards.map((card, cIdx) => (
                <div
                  key={card.id || cIdx}
                  className="rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/35 p-3 space-y-2"
                >
                  <div className="text-[11px] font-semibold text-[rgb(var(--text-secondary))]">
                    Card #{cIdx + 1}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      lang={activeLocale}
                      placeholder="Card title *"
                      value={card.title}
                      onChange={(e) =>
                        setBlock((b) =>
                          b.type === 'feature_cards'
                            ? {
                                ...b,
                                props: {
                                  ...b.props,
                                  cards: b.props.cards.map((c, idx) =>
                                    idx === cIdx ? { ...c, title: e.target.value } : c,
                                  ),
                                },
                              }
                            : b,
                        )
                      }
                      className={`h-8 px-2.5 rounded-md border text-xs bg-[rgb(var(--bg-surface))] ${
                        warningPathSet.has(`${path}.cards[${cIdx}].title`)
                          ? 'border-rose-500'
                          : 'border-[rgb(var(--border-base))]'
                      }`}
                    />
                    <input
                      type="text"
                      lang={activeLocale}
                      placeholder="Optional badge"
                      value={card.badge || ''}
                      onChange={(e) =>
                        setBlock((b) =>
                          b.type === 'feature_cards'
                            ? {
                                ...b,
                                props: {
                                  ...b.props,
                                  cards: b.props.cards.map((c, idx) =>
                                    idx === cIdx
                                      ? { ...c, badge: e.target.value || undefined }
                                      : c,
                                  ),
                                },
                              }
                            : b,
                        )
                      }
                      className="h-8 px-2.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                    />
                  </div>
                  <textarea
                    rows={2}
                    lang={activeLocale}
                    placeholder="Card description *"
                    value={card.description}
                    onChange={(e) =>
                      setBlock((b) =>
                        b.type === 'feature_cards'
                          ? {
                              ...b,
                              props: {
                                ...b.props,
                                cards: b.props.cards.map((c, idx) =>
                                  idx === cIdx ? { ...c, description: e.target.value } : c,
                                ),
                              },
                            }
                          : b,
                      )
                    }
                    className={`w-full p-2 rounded-md border text-xs bg-[rgb(var(--bg-surface))] ${
                      warningPathSet.has(`${path}.cards[${cIdx}].description`)
                        ? 'border-rose-500'
                        : 'border-[rgb(var(--border-base))]'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {block.type === 'faq_list' && (
          <CmsFaqPicker
            faqs={faqs}
            activeLocale={activeLocale}
            selectedIds={block.props.faqIds ?? []}
            selectedTopic={block.props.category}
            limit={block.props.limit ?? 10}
            heading={block.props.heading}
            onChangeHeading={(nextHeading) =>
              setBlock((b) =>
                b.type === 'faq_list'
                  ? { ...b, props: { ...b.props, heading: nextHeading } }
                  : b,
              )
            }
            onChangeTopic={(nextTopic) =>
              setBlock((b) =>
                b.type === 'faq_list'
                  ? { ...b, props: { ...b.props, category: nextTopic } }
                  : b,
              )
            }
            onChangeLimit={(nextLimit) =>
              setBlock((b) =>
                b.type === 'faq_list'
                  ? { ...b, props: { ...b.props, limit: nextLimit } }
                  : b,
              )
            }
            onClearPickedIds={() =>
              setBlock((b) =>
                b.type === 'faq_list'
                  ? { ...b, props: { ...b.props, faqIds: undefined } }
                  : b,
              )
            }
            onToggleFaqId={(faqId) =>
              setBlock((b) => {
                if (b.type !== 'faq_list') return b;
                const current = new Set(b.props.faqIds ?? []);
                if (current.has(faqId)) current.delete(faqId);
                else current.add(faqId);
                const nextIds = Array.from(current);
                return {
                  ...b,
                  props: {
                    ...b.props,
                    faqIds: nextIds.length > 0 ? nextIds : undefined,
                  },
                };
              })
            }
          />
        )}

        {block.type === 'cta_band' && (
          <div className="space-y-2.5">
            <div>
              <label className="block text-xs font-medium mb-1">
                CTA Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                lang={activeLocale}
                value={block.props.title}
                onChange={(e) =>
                  setBlock((b) =>
                    b.type === 'cta_band'
                      ? { ...b, props: { ...b.props, title: e.target.value } }
                      : b,
                  )
                }
                className={`w-full h-9 px-3 rounded-lg border text-xs bg-[rgb(var(--bg-surface))] ${
                  warningPathSet.has(`${path}.title`)
                    ? 'border-rose-500'
                    : 'border-[rgb(var(--border-base))]'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Description</label>
              <input
                type="text"
                lang={activeLocale}
                value={block.props.description || ''}
                onChange={(e) =>
                  setBlock((b) =>
                    b.type === 'cta_band'
                      ? {
                          ...b,
                          props: {
                            ...b.props,
                            description: e.target.value || undefined,
                          },
                        }
                      : b,
                  )
                }
                className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                lang={activeLocale}
                placeholder="Primary Button Label *"
                value={block.props.primaryButton.label}
                onChange={(e) =>
                  setBlock((b) =>
                    b.type === 'cta_band'
                      ? {
                          ...b,
                          props: {
                            ...b.props,
                            primaryButton: {
                              ...b.props.primaryButton,
                              label: e.target.value,
                            },
                          },
                        }
                      : b,
                  )
                }
                className={`h-8 px-2.5 rounded-md border text-xs bg-[rgb(var(--bg-surface))] ${
                  warningPathSet.has(`${path}.primaryButton.label`)
                    ? 'border-rose-500'
                    : 'border-[rgb(var(--border-base))]'
                }`}
              />
              <input
                type="text"
                placeholder="Primary Button URL *"
                value={block.props.primaryButton.href}
                onChange={(e) =>
                  setBlock((b) =>
                    b.type === 'cta_band'
                      ? {
                          ...b,
                          props: {
                            ...b.props,
                            primaryButton: {
                              ...b.props.primaryButton,
                              href: e.target.value,
                            },
                          },
                        }
                      : b,
                  )
                }
                className={`h-8 px-2.5 rounded-md border text-xs font-mono bg-[rgb(var(--bg-surface))] ${
                  warningPathSet.has(`${path}.primaryButton.href`)
                    ? 'border-rose-500'
                    : 'border-[rgb(var(--border-base))]'
                }`}
              />
            </div>
          </div>
        )}

        {block.type === 'video_embed' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Video Title *</label>
              <input
                type="text"
                lang={activeLocale}
                value={block.props.title}
                onChange={(e) =>
                  setBlock((b) =>
                    b.type === 'video_embed'
                      ? { ...b, props: { ...b.props, title: e.target.value } }
                      : b,
                  )
                }
                className="w-full h-8 px-2.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                {block.props.provider} URL *
              </label>
              <input
                type="text"
                value={block.props.url}
                onChange={(e) =>
                  setBlock((b) =>
                    b.type === 'video_embed'
                      ? { ...b, props: { ...b.props, url: e.target.value } }
                      : b,
                  )
                }
                className="w-full h-8 px-2.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-mono"
              />
            </div>
          </div>
        )}

        {block.type === 'columns' && (
          <div className="space-y-3">
            <div className="text-[11px] text-[rgb(var(--text-muted))] flex items-center gap-1.5">
              <Columns className="h-3.5 w-3.5" />
              Fixed {block.props.columns.length}-column layout (ratio{' '}
              <code>{block.props.ratio}</code>) — columns cannot be reordered or removed.
            </div>
            <div className="space-y-3 pl-2 border-l-2 border-[rgb(var(--border-base))]">
              {block.props.columns.map((col, cIdx) => (
                <div key={col.id || cIdx} className="space-y-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--text-muted))]">
                    Column {cIdx + 1}
                  </div>
                  {col.blocks.map((child, chIdx) =>
                    renderBlockEditor(
                      child,
                      topIndex,
                      cIdx,
                      chIdx,
                      `${path}.col${cIdx}.`,
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {block.type === 'divider' && (
          <div>
            <label className="block text-xs font-medium mb-1">Optional Divider Label</label>
            <input
              type="text"
              lang={activeLocale}
              value={block.props.label || ''}
              onChange={(e) =>
                setBlock((b) =>
                  b.type === 'divider'
                    ? { ...b, props: { ...b.props, label: e.target.value || undefined } }
                    : b,
                )
              }
              className="w-full h-8 px-2.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
            />
          </div>
        )}

        {block.type === 'dynamic_block' && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-3">
            <div className="flex items-start gap-2.5">
              <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  {DYNAMIC_WIDGET_LABELS[block.props.widget]?.title ??
                    `Locked Widget (${block.props.widget})`}
                </div>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                  {DYNAMIC_WIDGET_LABELS[block.props.widget]?.summary ??
                    'Dynamic data widget cannot be deleted or edited for prices/rates.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Intro Heading Around Widget (optional)
                </label>
                <input
                  type="text"
                  lang={activeLocale}
                  value={block.props.heading || ''}
                  onChange={(e) =>
                    setBlock((b) =>
                      b.type === 'dynamic_block'
                        ? {
                            ...b,
                            props: {
                              ...b.props,
                              heading: e.target.value || undefined,
                            },
                          }
                        : b,
                    )
                  }
                  className="w-full h-8 px-2.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Supporting Subtitle (optional)
                </label>
                <input
                  type="text"
                  lang={activeLocale}
                  value={block.props.subtitle || ''}
                  onChange={(e) =>
                    setBlock((b) =>
                      b.type === 'dynamic_block'
                        ? {
                            ...b,
                            props: {
                              ...b.props,
                              subtitle: e.target.value || undefined,
                            },
                          }
                        : b,
                    )
                  }
                  className="w-full h-8 px-2.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderLivePreviewBlock = (block: CmsBlockNode): React.ReactNode => {
    switch (block.type) {
      case 'heading': {
        const sizeClass =
          block.props.level === 1
            ? 'text-2xl font-extrabold'
            : block.props.level === 2
            ? 'text-xl font-bold'
            : 'text-lg font-semibold';
        return (
          <div key={block.id} className="space-y-1">
            <div className={`${sizeClass} text-[rgb(var(--text-primary))]`}>
              {block.props.text || <span className="text-rose-500 italic">Empty heading</span>}
            </div>
            {block.props.subtitle && (
              <p className="text-xs text-[rgb(var(--text-secondary))]">
                {block.props.subtitle}
              </p>
            )}
          </div>
        );
      }
      case 'rich_text':
        return (
          <div
            key={block.id}
            lang={activeLocale}
            className="cms-rte-prosemirror text-xs"
            dangerouslySetInnerHTML={{ __html: block.props.html }}
          />
        );
      case 'image':
        return (
          <figure key={block.id} className="space-y-1">
            {block.props.mediaId ? (
              <img
                src={`/api/v1/public/content/media/${block.props.mediaId}/file`}
                alt={block.props.alt}
                className="w-full rounded-lg border border-[rgb(var(--border-base))] object-cover max-h-52"
              />
            ) : (
              <div className="h-28 rounded-lg border border-dashed border-rose-400 flex items-center justify-center text-xs text-rose-500">
                Missing image
              </div>
            )}
            {block.props.caption && (
              <figcaption className="text-[11px] text-[rgb(var(--text-muted))]">
                {block.props.caption}
              </figcaption>
            )}
          </figure>
        );
      case 'button':
        return (
          <div key={block.id}>
            <span className="inline-flex items-center px-3.5 py-2 rounded-lg bg-primary-600 text-white text-xs font-semibold">
              {block.props.label || 'Button'}
            </span>
          </div>
        );
      case 'feature_cards':
        return (
          <div key={block.id} className="space-y-2">
            {block.props.heading && (
              <div className="text-sm font-bold">{block.props.heading}</div>
            )}
            <div
              className={`grid gap-2 ${
                previewDevice === 'phone' ? 'grid-cols-1' : 'grid-cols-2'
              }`}
            >
              {block.props.cards.map((c, idx) => (
                <div
                  key={c.id || idx}
                  className="p-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/35 text-xs"
                >
                  <div className="font-semibold">{c.title || 'Untitled card'}</div>
                  <div className="text-[11px] text-[rgb(var(--text-secondary))] mt-0.5">
                    {c.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'faq_list': {
        const picked =
          block.props.faqIds && block.props.faqIds.length > 0
            ? faqs.filter((f) => block.props.faqIds!.includes(f.id))
            : faqs.slice(0, block.props.limit ?? 5);
        return (
          <div key={block.id} className="space-y-2">
            <div className="text-sm font-bold">
              {block.props.heading || 'Frequently Asked Questions'}
            </div>
            {picked.length === 0 ? (
              <div className="text-[11px] text-[rgb(var(--text-muted))] border border-dashed border-[rgb(var(--border-base))] rounded-lg p-2.5">
                Live FAQ items will appear here ({block.props.limit ?? 10} max)
              </div>
            ) : (
              <div className="space-y-1.5">
                {picked.map((f) => (
                  <div
                    key={f.id}
                    className="p-2 rounded-lg border border-[rgb(var(--border-base))] text-xs"
                  >
                    <div className="font-semibold">
                      {activeLocale === 'bn' && f.questionBn ? f.questionBn : f.questionEn}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }
      case 'cta_band':
        return (
          <div
            key={block.id}
            className="rounded-xl bg-[#0c2239] text-white p-4 space-y-2"
          >
            <div className="text-sm font-bold">{block.props.title || 'CTA Title'}</div>
            {block.props.description && (
              <div className="text-xs text-slate-300">{block.props.description}</div>
            )}
            <span className="inline-block px-3 py-1.5 rounded-md bg-white text-[#0c2239] text-[11px] font-semibold">
              {block.props.primaryButton.label || 'Action'}
            </span>
          </div>
        );
      case 'dynamic_block':
        return (
          <div
            key={block.id}
            className="rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 p-3 space-y-1"
          >
            <div className="text-[10px] font-mono uppercase text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Locked Live Data · {block.props.widget}
            </div>
            {block.props.heading && (
              <div className="text-sm font-bold">{block.props.heading}</div>
            )}
            {block.props.subtitle && (
              <div className="text-xs text-[rgb(var(--text-secondary))]">
                {block.props.subtitle}
              </div>
            )}
          </div>
        );
      case 'columns':
        return (
          <div
            key={block.id}
            className={`grid gap-3 ${
              previewDevice === 'phone' ? 'grid-cols-1' : 'grid-cols-2'
            }`}
          >
            {block.props.columns.map((col, idx) => (
              <div key={col.id || idx} className="space-y-2">
                {col.blocks.map((child) => renderLivePreviewBlock(child))}
              </div>
            ))}
          </div>
        );
      case 'divider':
        return <hr key={block.id} className="border-[rgb(var(--border-base))]" />;
      case 'video_embed':
        return (
          <div
            key={block.id}
            className="rounded-lg border border-[rgb(var(--border-base))] p-3 bg-[rgb(var(--bg-muted))] text-xs"
          >
            <div className="font-semibold">{block.props.title}</div>
            <div className="text-[10px] font-mono text-[rgb(var(--text-muted))]">
              {block.props.provider}: {block.props.url}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="system-page-editor-title"
    >
      <div className="w-full max-w-[1440px] h-[93vh] flex flex-col rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] shadow-2xl overflow-hidden">
        {/* Top Bar */}
        <div className="px-5 py-3 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-8 w-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Lock className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="system-page-editor-title" className="text-sm font-bold truncate">
                  System Page Editor · /{detail.page.slug}
                </h2>
                <span className="px-2 py-0.5 rounded bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border-base))] text-[10px] font-semibold">
                  Fixed Structure Locked
                </span>
                {isLegal && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[10px] font-semibold">
                    Legal Four-Eyes ({detail.page.approvalStatus.replace(/_/g, ' ')})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[rgb(var(--text-muted))] truncate flex flex-wrap items-center gap-2">
                <span>
                  Canonical path: <code>{currentDraft.canonicalPath}</code> · Status:{' '}
                  <strong className="capitalize">{detail.page.status}</strong>
                  {activeBaseVersion ? ` · Editing v${activeBaseVersion.versionNumber}` : ''}
                </span>
                {autosaving ? (
                  <span className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-300 font-medium">
                    <Clock className="h-3 w-3 animate-spin" />
                    Autosaving draft...
                  </span>
                ) : hasUnsavedChanges ? (
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-medium">
                    <Clock className="h-3 w-3" />
                    Unsaved changes (autosaves every 30s)
                  </span>
                ) : lastAutosavedAt ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    Autosaved {new Date(lastAutosavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowVersionHistory(true)}
              className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
            >
              <History className="h-3.5 w-3.5 text-primary-600" />
              History ({detail.versions.length})
            </button>

            {/* Locale Tabs */}
            <div
              role="tablist"
              aria-label="Content locale"
              className="inline-flex rounded-lg p-0.5 bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border-base))]"
            >
              {(['en', 'bn'] as const).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  role="tab"
                  aria-selected={activeLocale === loc}
                  onClick={() => setActiveLocale(loc)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                    activeLocale === loc
                      ? 'bg-primary-600 text-white'
                      : 'text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
                  }`}
                >
                  <Languages className="h-3.5 w-3.5" />
                  {loc === 'en' ? 'English' : 'Bengali (বাংলা)'}
                </button>
              ))}
            </div>

            {activeLocale === 'bn' && canEditCms && (
              <button
                type="button"
                onClick={handleCopyFromEnglish}
                className="h-8 px-3 rounded-lg border border-primary-600/30 bg-primary-600/10 text-primary-700 dark:text-primary-300 hover:bg-primary-600/20 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy from English
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowPreviewPane((p) => !p)}
              className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-medium hidden lg:inline-flex items-center gap-1.5"
            >
              {showPreviewPane ? 'Hide Preview' : 'Show Live Preview'}
            </button>

            <button
              type="button"
              onClick={handleRequestClose}
              aria-label="Close System Page Editor"
              className="h-8 w-8 rounded-lg inline-flex items-center justify-center hover:bg-[rgb(var(--bg-hover))]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Notices & Required Field Warnings */}
        <div className="px-5 pt-3 space-y-2 shrink-0">
          {otherEditors.length > 0 && (
            <div className="px-3.5 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                <strong>Concurrent editing active:</strong>{' '}
                {otherEditors
                  .map((ed) => `${ed.displayName} (${ed.locale.toUpperCase()})`)
                  .join(', ')}{' '}
                currently has this page open. Silent overwrites are blocked—saving after another editor will offer a side-by-side merge choice.
              </span>
            </div>
          )}
          {error && (
            <div className="px-3.5 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {notice && (
            <div className="px-3.5 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{notice}</span>
              </div>
              <button type="button" onClick={() => setNotice(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {signedPreviewLink && (
            <div className="px-3.5 py-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-800 dark:text-indigo-200 text-xs flex items-center justify-between gap-2">
              <span className="truncate">
                Signed preview link opened:{' '}
                <a
                  href={signedPreviewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-mono"
                >
                  {signedPreviewLink}
                </a>
              </span>
              <button type="button" onClick={() => setSignedPreviewLink(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {requiredWarnings.length > 0 && (
            <div
              role="alert"
              className="px-3.5 py-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5"
            >
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">
                  {requiredWarnings.length} required field
                  {requiredWarnings.length > 1 ? 's' : ''} missing or invalid in{' '}
                  {activeLocale.toUpperCase()}:
                </div>
                <div className="text-[11px] mt-0.5">
                  {requiredWarnings
                    .slice(0, 4)
                    .map((w) => `${w.label}: ${w.message}`)
                    .join(' · ')}
                  {requiredWarnings.length > 4
                    ? ` (+${requiredWarnings.length - 4} more)`
                    : ''}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Two-Pane Body */}
        <div className="flex-1 min-h-0 flex overflow-hidden mt-3 border-t border-[rgb(var(--border-base))]">
          {/* Left Form Pane */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[rgb(var(--bg-base))]">
            {/* Page Identity & Translation Card */}
            <section className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--text-secondary))]">
                  Page Header &amp; Localization
                </h3>
                {activeLocale === 'bn' && (
                  <select
                    aria-label="Bengali translation status"
                    value={currentDraft.translationStatus}
                    onChange={(e) =>
                      updateCurrentDraft((prev) => ({
                        ...prev,
                        translationStatus: e.target.value as CmsTranslationStatus,
                        isTranslated: e.target.value === 'translated',
                      }))
                    }
                    className="h-7 px-2 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-medium"
                  >
                    <option value="untranslated">BN: Untranslated</option>
                    <option value="in_review">BN: In Review</option>
                    <option value="translated">BN: Translated</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Page Title ({activeLocale.toUpperCase()}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  lang={activeLocale}
                  value={currentDraft.title}
                  onChange={(e) =>
                    updateCurrentDraft((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className={`w-full h-9 px-3 rounded-lg border text-sm font-medium bg-[rgb(var(--bg-surface))] ${
                    warningPathSet.has('title')
                      ? 'border-rose-500 ring-1 ring-rose-500/30'
                      : 'border-[rgb(var(--border-base))]'
                  }`}
                />
                {warningPathSet.has('title') && (
                  <p className="text-[11px] text-rose-600 mt-1">Page Title is required.</p>
                )}
              </div>
            </section>

            {/* SEO Fields with Length Hints */}
            <section className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--text-secondary))]">
                  SEO &amp; Social Metadata
                </h3>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium">SEO Title</label>
                  <span
                    className={`text-[11px] ${
                      seoTitleHint.tone === 'optimal'
                        ? 'text-emerald-600'
                        : seoTitleHint.tone === 'warning'
                        ? 'text-amber-600'
                        : 'text-[rgb(var(--text-muted))]'
                    }`}
                  >
                    {seoTitleHint.text}
                  </span>
                </div>
                <input
                  type="text"
                  lang={activeLocale}
                  value={currentDraft.seoTitle}
                  onChange={(e) =>
                    updateCurrentDraft((prev) => ({ ...prev, seoTitle: e.target.value }))
                  }
                  placeholder="Recommended 30–60 characters"
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium">SEO Meta Description</label>
                  <span
                    className={`text-[11px] ${
                      seoDescHint.tone === 'optimal'
                        ? 'text-emerald-600'
                        : seoDescHint.tone === 'warning'
                        ? 'text-amber-600'
                        : 'text-[rgb(var(--text-muted))]'
                    }`}
                  >
                    {seoDescHint.text}
                  </span>
                </div>
                <textarea
                  rows={2}
                  lang={activeLocale}
                  value={currentDraft.seoDescription}
                  onChange={(e) =>
                    updateCurrentDraft((prev) => ({
                      ...prev,
                      seoDescription: e.target.value,
                    }))
                  }
                  placeholder="Recommended 120–160 characters"
                  className="w-full p-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Social Share Image (OG Image)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={currentDraft.ogImageUrl}
                    onChange={(e) =>
                      updateCurrentDraft((prev) => ({
                        ...prev,
                        ogImageUrl: e.target.value,
                      }))
                    }
                    placeholder="/api/v1/public/content/media/.../file or https://..."
                    className="flex-1 h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setMediaTarget({ kind: 'og' })}
                    className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-primary-600" />
                    Media Library
                  </button>
                </div>
              </div>
            </section>

            {/* Fixed Content Blocks */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--text-secondary))]">
                  Fixed Page Blocks ({currentDraft.blocks.length})
                </h3>
                <span className="text-[11px] text-[rgb(var(--text-muted))]">
                  Layout order &amp; dynamic widgets locked
                </span>
              </div>

              {currentDraft.blocks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[rgb(var(--border-strong))] p-6 text-center text-xs text-[rgb(var(--text-muted))]">
                  This system page currently has no structured blocks.
                </div>
              ) : (
                currentDraft.blocks.map((block, idx) =>
                  renderBlockEditor(block, idx),
                )
              )}
            </section>
          </div>

          {/* Right Live Preview Pane */}
          {showPreviewPane && (
            <div className="hidden lg:flex w-[44%] min-w-[420px] border-l border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/50 flex-col overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] flex items-center justify-between">
                <span className="text-xs font-semibold">Live Draft Preview</span>
                <div className="inline-flex rounded-lg p-0.5 bg-[rgb(var(--bg-muted))] border border-[rgb(var(--border-base))]">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('desktop')}
                    aria-label="Desktop preview width"
                    className={`px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1 ${
                      previewDevice === 'desktop'
                        ? 'bg-[rgb(var(--bg-surface))] shadow-sm text-[rgb(var(--text-primary))]'
                        : 'text-[rgb(var(--text-muted))]'
                    }`}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('phone')}
                    aria-label="Phone preview width"
                    className={`px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1 ${
                      previewDevice === 'phone'
                        ? 'bg-[rgb(var(--bg-surface))] shadow-sm text-[rgb(var(--text-primary))]'
                        : 'text-[rgb(var(--text-muted))]'
                    }`}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    Phone (390px)
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex justify-center">
                <div
                  className={`transition-all rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] shadow-sm p-5 space-y-4 h-fit ${
                    previewDevice === 'phone' ? 'w-[390px] max-w-full' : 'w-full'
                  }`}
                >
                  <div className="pb-3 border-b border-[rgb(var(--border-base))]">
                    <div className="text-[10px] font-mono text-[rgb(var(--text-muted))]">
                      {WEBSITE_BASE_URL}
                      {currentDraft.canonicalPath}
                    </div>
                    <h4 className="text-base font-bold mt-1" lang={activeLocale}>
                      {currentDraft.title || (
                        <span className="text-rose-500 italic">Untitled Page</span>
                      )}
                    </h4>
                  </div>
                  <div className="space-y-4">
                    {currentDraft.blocks.map((block) => renderLivePreviewBlock(block))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Workflow Action Footer */}
        <div className="px-5 py-3 border-t border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex flex-wrap items-center justify-between gap-3">
          <input
            type="text"
            value={currentDraft.changeNote}
            onChange={(e) =>
              updateCurrentDraft((prev) => ({ ...prev, changeNote: e.target.value }))
            }
            placeholder="Version change note (optional)..."
            className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs w-full sm:w-72"
          />

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <button
              type="button"
              disabled={busyAction === 'preview'}
              onClick={() => void handlePreviewNewTab()}
              className="h-9 px-3.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Preview in new tab
            </button>

            {canEditCms && (
              <button
                type="button"
                disabled={saving || Boolean(busyAction)}
                onClick={() => void handleSaveDraft()}
                className="h-9 px-4 rounded-lg border border-primary-600/30 bg-primary-600/10 text-primary-700 dark:text-primary-200 hover:bg-primary-600/20 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save draft'}
              </button>
            )}

            {isLegal ? (
              <>
                {canEditCms && (
                  <button
                    type="button"
                    disabled={saving || Boolean(busyAction) || requiredWarnings.length > 0}
                    onClick={() => void handlePublishOrSubmit()}
                    className="h-9 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Submit for approval
                  </button>
                )}
                {canPublishCms &&
                  detail.page.approvalStatus === 'pending_approval' &&
                  detail.page.submittedForApprovalById !== user?.id && (
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => void handleApproveLegalNow()}
                      className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      Approve &amp; Publish
                    </button>
                  )}
              </>
            ) : (
              canPublishCms && (
                <button
                  type="button"
                  disabled={saving || Boolean(busyAction) || requiredWarnings.length > 0}
                  onClick={() => void handlePublishOrSubmit()}
                  className="h-9 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45"
                >
                  <Send className="h-3.5 w-3.5" />
                  Publish
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Stage C.1 Media Picker for Social Image & Image Blocks */}
      <MediaLibraryPickerModal
        isOpen={Boolean(mediaTarget)}
        locale={activeLocale}
        defaultFolder={mediaTarget?.kind === 'og' ? 'seo' : 'pages'}
        onClose={() => setMediaTarget(null)}
        onSelect={(selection) => {
          if (!mediaTarget) return;
          if (mediaTarget.kind === 'og') {
            updateCurrentDraft((prev) => ({
              ...prev,
              ogImageUrl: selection.src,
            }));
          } else {
            updateBlockAt(
              mediaTarget.topIndex,
              (b) =>
                b.type === 'image'
                  ? {
                      ...b,
                      props: {
                        ...b.props,
                        mediaId: selection.media.id,
                        alt: selection.alt || b.props.alt,
                        caption: selection.title || b.props.caption,
                      },
                    }
                  : b,
              mediaTarget.colIndex,
              mediaTarget.childIndex,
            );
          }
          setMediaTarget(null);
        }}
      />

      {/* Version History, Highlighted Diff & Non-Destructive Restore */}
      <VersionHistoryPanel
        isOpen={showVersionHistory}
        detail={detail}
        initialLocale={activeLocale}
        canRestore={canEditCms}
        onClose={() => setShowVersionHistory(false)}
        onRestored={async (restoredVersion) => {
          const refreshed = await fetchCmsPageDetail(detail.page.id);
          const restoredDraft = buildLocaleDraftFromDetail(refreshed, restoredVersion.locale);
          setDetail(refreshed);
          setDrafts((prev) => ({ ...prev, [restoredVersion.locale]: restoredDraft }));
          markLocaleSaved(restoredVersion.locale, restoredDraft);
          setActiveLocale(restoredVersion.locale);
          onUpdated(refreshed.page);
          setShowVersionHistory(false);
          setNotice(
            `Restored historical content into new draft ${restoredVersion.locale.toUpperCase()} v${restoredVersion.versionNumber}. Previous history stays intact.`,
          );
        }}
      />

      {/* Concurrent Edit / Merge Conflict Modal */}
      {conflict && (
        <VersionConflictModal
          message={conflict.message}
          localDraft={currentDraft}
          serverVersion={conflict.latestVersion}
          busy={saving || busyAction === 'resolve'}
          onUseServerVersion={() => void handleUseServerVersion()}
          onMergeWithServer={() => void handleMergeWithServer()}
          onForceSaveMine={() => {
            setConflict(null);
            void handleSaveDraft(true);
          }}
        />
      )}
    </div>
  );
}
