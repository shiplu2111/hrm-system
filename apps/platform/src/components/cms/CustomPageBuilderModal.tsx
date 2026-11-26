import { useEffect, useMemo, useState } from 'react';
import type {
  CmsBlockNode,
  CmsCustomPageTemplate,
  CmsFaqDto,
  CmsLocale,
  CmsMenuDto,
  CmsPageDetailDto,
  CmsPageDto,
  CmsSlugAvailabilityDto,
  CmsTranslationStatus,
} from '@hrm/shared-types';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FilePlus2,
  GripVertical,
  HelpCircle,
  History,
  Image as ImageIcon,
  Languages,
  LayoutTemplate,
  ListPlus,
  Loader2,
  Monitor,
  Plus,
  Save,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermission';
import { useCmsEditorCollaboration } from '@/hooks/useCmsEditorCollaboration';
import {
  approveCmsLegalPage,
  checkCmsSlugAvailability,
  createCmsCustomPage,
  createCmsPagePreviewToken,
  fetchCmsPageDetail,
  listCmsFaqs,
  listCmsMenus,
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
import {
  buildLocaleDraftFromDetail,
  copyEnglishDraftToBengali,
  getSeoLengthHint,
  isLegalSystemPage,
  validateSystemPageRequiredFields,
  type SystemPageLocaleDraft,
} from '@/components/cms/system-page-editor-utils';
import {
  buildCustomPageTemplateBlocks,
  createDefaultBlock,
  duplicateBlockAt,
  generateSlugFromTitle,
  hasBengaliScript,
  normalizeManualSlugInput,
  removeBlockAt,
  reorderBlocks,
  transliterateBengaliToSlug,
  validateSlugFormatAndReserved,
} from '@/components/cms/custom-page-utils';

const WEBSITE_BASE_URL =
  import.meta.env.VITE_WEBSITE_URL || 'http://localhost:3000';

interface CustomPageBuilderProps {
  mode: 'create' | 'edit';
  initialDetail?: CmsPageDetailDto;
  isStandalonePage?: boolean;
  onClose?: () => void;
  onCreated?: (page: CmsPageDto) => void;
  onUpdated?: (page: CmsPageDto) => void;
}

const TEMPLATE_OPTIONS: Array<{
  key: CmsCustomPageTemplate;
  title: string;
  description: string;
}> = [
    {
      key: 'standard',
      title: 'Standard page',
      description: 'Clean headline and structured rich-text article layout.',
    },
    {
      key: 'landing',
      title: 'Landing page with hero',
      description: 'Centered hero CTA, 3-column feature highlights, body copy, and closing CTA band.',
    },
    {
      key: 'legal',
      title: 'Legal-style page',
      description: 'Formal policy clauses with Stage F four-eyes approval required before publish.',
    },
  ];

const ADDABLE_BLOCKS: Array<{ type: CmsBlockNode['type']; label: string }> = [
  { type: 'heading', label: 'Heading' },
  { type: 'rich_text', label: 'Rich Text' },
  { type: 'image', label: 'Image' },
  { type: 'button', label: 'Button' },
  { type: 'feature_cards', label: 'Feature Cards' },
  { type: 'faq_list', label: 'FAQ Picker' },
  { type: 'cta_band', label: 'CTA Band' },
  { type: 'columns', label: '2 Columns' },
  { type: 'video_embed', label: 'Video Embed' },
  { type: 'divider', label: 'Divider' },
];

export function CustomPageBuilder({
  mode: initialMode,
  initialDetail,
  isStandalonePage = false,
  onClose,
  onCreated,
  onUpdated,
}: CustomPageBuilderProps) {
  const { can, user } = usePermissions();
  const canCreateCms = can('cms', 'create');
  const canEditCms = can('cms', 'edit');
  const canPublishCms = can('cms', 'manage');

  const [mode, setMode] = useState<'create' | 'edit'>(initialMode);
  const [detail, setDetail] = useState<CmsPageDetailDto | null>(initialDetail ?? null);

  // Create-mode identity & template state
  const [templateKey, setTemplateKey] = useState<CmsCustomPageTemplate>('standard');
  const [slug, setSlug] = useState(initialDetail?.page.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(initialDetail));
  const [slugCheck, setSlugCheck] = useState<CmsSlugAvailabilityDto | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  // Optional menu placement at creation
  const [menus, setMenus] = useState<CmsMenuDto[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState('');
  const [menuItemLabelEn, setMenuItemLabelEn] = useState('');

  // Locale & draft editing state
  const [activeLocale, setActiveLocale] = useState<CmsLocale>('en');
  const [drafts, setDrafts] = useState<Record<CmsLocale, SystemPageLocaleDraft>>(() => {
    if (initialDetail) {
      return {
        en: buildLocaleDraftFromDetail(initialDetail, 'en'),
        bn: buildLocaleDraftFromDetail(initialDetail, 'bn'),
      };
    }
    return {
      en: {
        locale: 'en',
        title: '',
        seoTitle: '',
        seoDescription: '',
        ogImageUrl: '',
        canonicalPath: '/',
        noIndex: false,
        blocks: buildCustomPageTemplateBlocks('standard', 'New Custom Page'),
        isTranslated: true,
        translationStatus: 'translated',
        changeNote: 'Initial custom page draft',
      },
      bn: {
        locale: 'bn',
        title: '',
        seoTitle: '',
        seoDescription: '',
        ogImageUrl: '',
        canonicalPath: '/bn/',
        noIndex: false,
        blocks: buildCustomPageTemplateBlocks('standard', ''),
        isTranslated: false,
        translationStatus: 'untranslated',
        changeNote: '',
      },
    };
  });

  // Drag & Drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Preview, FAQ, and Media modal state
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'phone'>('desktop');
  const [showPreviewPane, setShowPreviewPane] = useState(true);
  const [faqs, setFaqs] = useState<CmsFaqDto[]>([]);
  const [faqSearch, setFaqSearch] = useState('');
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
    pageId: mode === 'edit' ? detail?.page.id : null,
    activeLocale,
    detail: mode === 'edit' ? detail : null,
    currentDraft,
    canEdit: canEditCms,
    onDraftSyncedFromServer: (refreshed, loc) => {
      const nextDraft = buildLocaleDraftFromDetail(refreshed, loc);
      setDetail(refreshed);
      setDrafts((prev) => ({ ...prev, [loc]: nextDraft }));
      onUpdated?.(refreshed.page);
    },
    onAutosaved: (ver) => {
      setNotice(
        `Autosaved ${ver.locale.toUpperCase()} draft v${ver.versionNumber}.`,
      );
    },
  });

  useEffect(() => {
    if (initialDetail) {
      const enDraft = buildLocaleDraftFromDetail(initialDetail, 'en');
      const bnDraft = buildLocaleDraftFromDetail(initialDetail, 'bn');
      setDetail(initialDetail);
      setMode('edit');
      setSlug(initialDetail.page.slug);
      setDrafts({ en: enDraft, bn: bnDraft });
      markLocaleSaved('en', enDraft);
      markLocaleSaved('bn', bnDraft);
    }
  }, [initialDetail, markLocaleSaved]);

  useEffect(() => {
    void listCmsFaqs().then(setFaqs).catch(() => setFaqs([]));
    if (mode === 'create') {
      void listCmsMenus().then(setMenus).catch(() => setMenus([]));
    }
  }, [mode]);

  // Live slug format, reserved list, and debounced server uniqueness validation
  const localSlugValidation = useMemo(
    () => validateSlugFormatAndReserved(slug),
    [slug],
  );

  useEffect(() => {
    if (mode !== 'create') return;
    if (!slug.trim() || !localSlugValidation.valid) {
      setSlugCheck(null);
      setCheckingSlug(false);
      return;
    }

    let cancelled = false;
    setCheckingSlug(true);
    const timer = window.setTimeout(() => {
      void checkCmsSlugAvailability(slug.trim())
        .then((res) => {
          if (!cancelled) setSlugCheck(res);
        })
        .catch(() => {
          if (!cancelled) setSlugCheck(null);
        })
        .finally(() => {
          if (!cancelled) setCheckingSlug(false);
        });
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mode, slug, localSlugValidation.valid]);

  const isTitleBengali = hasBengaliScript(currentDraft.title);
  const isLegal =
    mode === 'create'
      ? templateKey === 'legal' || isLegalSystemPage(slug)
      : Boolean(detail && isLegalSystemPage(detail.page.slug, detail.page.requiresApproval));

  const requiredWarnings = useMemo(
    () => validateSystemPageRequiredFields(currentDraft),
    [currentDraft],
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

  const handleTitleChange = (val: string) => {
    updateCurrentDraft((prev) => ({ ...prev, title: val }));
    if (mode === 'create' && activeLocale === 'en' && !slugTouched) {
      setSlug(generateSlugFromTitle(val));
    }
  };

  const handleTemplateSelect = (nextTemplate: CmsCustomPageTemplate) => {
    setTemplateKey(nextTemplate);
    if (mode === 'create') {
      updateCurrentDraft((prev) => ({
        ...prev,
        blocks: buildCustomPageTemplateBlocks(nextTemplate, prev.title),
      }));
    }
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

      if (colIndex !== undefined && childIndex !== undefined && top.type === 'columns') {
        const nextCols = top.props.columns.map((col, cIdx) => {
          if (cIdx !== colIndex) return col;
          const nextChildren = col.blocks.map((child, chIdx) =>
            chIdx === childIndex ? (updater(child) as any) : child,
          );
          return { ...col, blocks: nextChildren };
        });
        nextBlocks[topIndex] = { ...top, props: { ...top.props, columns: nextCols } };
      } else {
        nextBlocks[topIndex] = updater(top);
      }

      return { ...prev, blocks: nextBlocks };
    });
  };

  const handleAddBlock = (type: CmsBlockNode['type']) => {
    updateCurrentDraft((prev) => ({
      ...prev,
      blocks: [...prev.blocks, createDefaultBlock(type)],
    }));
  };

  const handleCreateDraft = async (): Promise<CmsPageDetailDto | null> => {
    if (!canCreateCms) return null;
    if (!drafts.en.title.trim()) {
      setError('Page Title is required.');
      return null;
    }
    if (!localSlugValidation.valid) {
      setError(localSlugValidation.error || 'Please fix the URL slug.');
      return null;
    }
    if (slugCheck && !slugCheck.available) {
      setError(slugCheck.reason || 'Slug is unavailable.');
      return null;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createCmsCustomPage({
        slug: slug.trim(),
        titleEn: drafts.en.title.trim(),
        seoTitleEn: drafts.en.seoTitle.trim() || drafts.en.title.trim(),
        seoDescriptionEn: drafts.en.seoDescription.trim() || undefined,
        ogImageUrlEn: drafts.en.ogImageUrl.trim() || undefined,
        blocksEn: drafts.en.blocks,
        templateKey,
        requiresApproval: templateKey === 'legal',
        menuId: selectedMenuId || undefined,
        menuItemLabelEn: selectedMenuId
          ? menuItemLabelEn.trim() || drafts.en.title.trim()
          : undefined,
        changeNote:
          drafts.en.changeNote.trim() ||
          `Created custom ${templateKey} page "/${slug.trim()}" as draft`,
      });

      const createdDetail = await fetchCmsPageDetail(created.id);
      setDetail(createdDetail);
      setMode('edit');
      setDrafts({
        en: buildLocaleDraftFromDetail(createdDetail, 'en'),
        bn: buildLocaleDraftFromDetail(createdDetail, 'bn'),
      });
      onCreated?.(createdDetail.page);
      setNotice(
        `Created custom page "/${createdDetail.page.slug}" in Draft status.${selectedMenuId ? ' Added link to selected menu.' : ''
        }`,
      );
      return createdDetail;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create page.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async (
    forceOverwrite = false,
  ): Promise<CmsPageDetailDto | null> => {
    if (mode === 'create') {
      return handleCreateDraft();
    }
    if (!detail || !canEditCms) return null;
    if (!currentDraft.title.trim()) {
      setError('Page Title is required before saving a draft.');
      return null;
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
        canonicalPath: `/${detail.page.slug}`,
        ogImageUrl: currentDraft.ogImageUrl.trim() || null,
        noIndex: currentDraft.noIndex,
        blocks: currentDraft.blocks,
        isTranslated:
          activeLocale === 'en' ? true : currentDraft.translationStatus === 'translated',
        translationStatus:
          activeLocale === 'en' ? 'translated' : currentDraft.translationStatus,
        changeNote:
          currentDraft.changeNote.trim() ||
          `Updated ${activeLocale.toUpperCase()} custom page draft`,
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
      onUpdated?.(refreshed.page);
      setNotice(
        `Saved ${saved.locale.toUpperCase()} draft v${saved.versionNumber} for "/${detail.page.slug}".`,
      );
      return refreshed;
    } catch (err) {
      if (handleSaveErrorConflict(err)) {
        return null;
      }
      setError(err instanceof Error ? err.message : 'Failed to save draft.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleRequestClose = () => {
    if (mode === 'create' && drafts.en.title.trim().length > 0) {
      if (
        !window.confirm(
          'You have an unsaved custom page draft. Are you sure you want to discard it and close?',
        )
      ) {
        return;
      }
    } else if (!confirmLeaveIfDirty()) {
      return;
    }
    onClose?.();
  };

  const handleUseServerVersion = async () => {
    if (!detail) return;
    setBusyAction('resolve');
    try {
      const refreshed = await fetchCmsPageDetail(detail.page.id);
      const nextDraft = buildLocaleDraftFromDetail(refreshed, activeLocale);
      setDetail(refreshed);
      setDrafts((prev) => ({ ...prev, [activeLocale]: nextDraft }));
      markLocaleSaved(activeLocale, nextDraft);
      onUpdated?.(refreshed.page);
      setConflict(null);
      setNotice(
        `Loaded latest server version (${activeLocale.toUpperCase()} v${conflict?.latestVersion.versionNumber ?? ''}).`,
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleMergeWithServer = async () => {
    if (!detail || !conflict) return;
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

  const handlePublishOrSubmit = async () => {
    if (requiredWarnings.length > 0) {
      setError(
        `Complete all ${requiredWarnings.length} required field(s) before ${isLegal ? 'submitting for approval' : 'publishing'
        }.`,
      );
      return;
    }

    setBusyAction('publish');
    setError(null);
    try {
      const savedDetail = await handleSaveDraft();
      if (!savedDetail) {
        setBusyAction(null);
        return;
      }

      if (isLegal) {
        const updated = await submitCmsLegalApproval(savedDetail.page.id, {
          locale: activeLocale,
          note: currentDraft.changeNote.trim() || 'Submitted legal custom page for Stage F review',
        });
        const refreshed = await fetchCmsPageDetail(savedDetail.page.id);
        setDetail(refreshed);
        onUpdated?.(updated);
        setNotice(`Submitted "/${savedDetail.page.slug}" for Stage F legal approval.`);
      } else {
        const updated = await publishCmsPage(savedDetail.page.id, {
          locale: activeLocale,
        });
        const refreshed = await fetchCmsPageDetail(savedDetail.page.id);
        setDetail(refreshed);
        onUpdated?.(updated);
        setNotice(
          `Published "/${savedDetail.page.slug}" live! Now accessible at ${WEBSITE_BASE_URL}/${savedDetail.page.slug} and included in /sitemap.xml.`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed.');
    } finally {
      setBusyAction(null);
    }
  };

  const handlePreviewNewTab = async () => {
    setBusyAction('preview');
    setError(null);
    try {
      let targetId = detail?.page.id;
      if (mode === 'create') {
        const created = await handleCreateDraft();
        targetId = created?.page.id;
      }
      if (!targetId) {
        setBusyAction(null);
        return;
      }
      const tokenBundle = await createCmsPagePreviewToken(targetId, activeLocale);
      const base = WEBSITE_BASE_URL.replace(/\/+$/, '');
      const fullPreviewUrl = `${base}/${activeLocale}/preview?token=${encodeURIComponent(tokenBundle.token)}`;
      setSignedPreviewLink(fullPreviewUrl);
      window.open(fullPreviewUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview token generation failed.');
    } finally {
      setBusyAction(null);
    }
  };

  const renderBlockCard = (block: CmsBlockNode, index: number) => {
    const isDropTarget = dragOverIndex === index && dragIndex !== index;

    return (
      <div
        key={block.id}
        draggable
        onDragStart={() => setDragIndex(index)}
        onDragOver={(e) => {
          e.preventDefault();
          if (dragOverIndex !== index) setDragOverIndex(index);
        }}
        onDragLeave={() => {
          if (dragOverIndex === index) setDragOverIndex(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragIndex !== null && dragIndex !== index) {
            updateCurrentDraft((prev) => ({
              ...prev,
              blocks: reorderBlocks(prev.blocks, dragIndex, index),
            }));
          }
          setDragIndex(null);
          setDragOverIndex(null);
        }}
        onDragEnd={() => {
          setDragIndex(null);
          setDragOverIndex(null);
        }}
        className={`rounded-xl border bg-[rgb(var(--bg-surface))] p-4 space-y-3 transition-all ${isDropTarget
          ? 'border-primary-600 ring-2 ring-primary-600/30'
          : 'border-[rgb(var(--border-base))]'
          }`}
      >
        {/* Block Header with Drag Handle + Up/Down + Duplicate + Remove */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[rgb(var(--border-base))]">
          <div className="flex items-center gap-2">
            <span
              className="cursor-grab active:cursor-grabbing text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]"
              title="Drag to reorder block"
            >
              <GripVertical className="h-4 w-4" />
            </span>
            <span className="text-xs font-semibold capitalize">
              #{index + 1} · {block.type.replace(/_/g, ' ')}
            </span>
            <code className="text-[10px] px-1.5 py-0.5 rounded bg-[rgb(var(--bg-muted))] text-[rgb(var(--text-muted))]">
              {block.id}
            </code>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={index === 0}
              onClick={() =>
                updateCurrentDraft((prev) => ({
                  ...prev,
                  blocks: reorderBlocks(prev.blocks, index, index - 1),
                }))
              }
              title="Move block up"
              aria-label={`Move block ${index + 1} up`}
              className="h-7 w-7 rounded border border-[rgb(var(--border-base))] hover:bg-[rgb(var(--bg-hover))] inline-flex items-center justify-center disabled:opacity-30"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={index === currentDraft.blocks.length - 1}
              onClick={() =>
                updateCurrentDraft((prev) => ({
                  ...prev,
                  blocks: reorderBlocks(prev.blocks, index, index + 1),
                }))
              }
              title="Move block down"
              aria-label={`Move block ${index + 1} down`}
              className="h-7 w-7 rounded border border-[rgb(var(--border-base))] hover:bg-[rgb(var(--bg-hover))] inline-flex items-center justify-center disabled:opacity-30"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                updateCurrentDraft((prev) => ({
                  ...prev,
                  blocks: duplicateBlockAt(prev.blocks, index),
                }))
              }
              title="Duplicate block"
              aria-label={`Duplicate block ${index + 1}`}
              className="h-7 px-2 rounded border border-[rgb(var(--border-base))] hover:bg-[rgb(var(--bg-hover))] text-[11px] inline-flex items-center gap-1"
            >
              <Copy className="h-3 w-3" />
              Duplicate
            </button>
            <button
              type="button"
              onClick={() =>
                updateCurrentDraft((prev) => ({
                  ...prev,
                  blocks: removeBlockAt(prev.blocks, index),
                }))
              }
              title="Remove block"
              aria-label={`Remove block ${index + 1}`}
              className="h-7 px-2 rounded border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 text-[11px] inline-flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </button>
          </div>
        </div>

        {block.type === 'heading' && (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <select
                value={block.props.level}
                onChange={(e) =>
                  updateBlockAt(index, (b) =>
                    b.type === 'heading'
                      ? { ...b, props: { ...b.props, level: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 | 6 } }
                      : b,
                  )
                }
                className="h-9 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-medium"
              >
                {[1, 2, 3, 4, 5, 6].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    Heading H{lvl}
                  </option>
                ))}
              </select>
              <input
                type="text"
                lang={activeLocale}
                placeholder="Heading text *"
                value={block.props.text}
                onChange={(e) =>
                  updateBlockAt(index, (b) =>
                    b.type === 'heading'
                      ? { ...b, props: { ...b.props, text: e.target.value } }
                      : b,
                  )
                }
                className="sm:col-span-3 h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              />
            </div>
            <input
              type="text"
              lang={activeLocale}
              placeholder="Optional subtitle"
              value={block.props.subtitle || ''}
              onChange={(e) =>
                updateBlockAt(index, (b) =>
                  b.type === 'heading'
                    ? { ...b, props: { ...b.props, subtitle: e.target.value || undefined } }
                    : b,
                )
              }
              className="w-full h-8 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
            />
          </div>
        )}

        {block.type === 'rich_text' && (
          <RichTextEditor
            value={block.props.html}
            onChange={(html) =>
              updateBlockAt(index, (b) =>
                b.type === 'rich_text' ? { ...b, props: { html } } : b,
              )
            }
            locale={activeLocale}
            mediaFolder="pages"
            currentUser={user}
            allowRawHtml
            minHeightClassName="min-h-[160px]"
          />
        )}

        {block.type === 'image' && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="h-16 w-28 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] overflow-hidden flex items-center justify-center shrink-0">
                {block.props.mediaId ? (
                  <img
                    src={`/api/v1/public/content/media/${block.props.mediaId}/file`}
                    alt={block.props.alt || 'Selected asset'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-5 w-5 text-[rgb(var(--text-muted))]" />
                )}
              </div>
              <button
                type="button"
                onClick={() => setMediaTarget({ kind: 'block', topIndex: index })}
                className="h-8 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
              >
                <ImageIcon className="h-3.5 w-3.5 text-primary-600" />
                Pick Image from Media Library
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                lang={activeLocale}
                placeholder="Alt text (required) *"
                value={block.props.alt}
                onChange={(e) =>
                  updateBlockAt(index, (b) =>
                    b.type === 'image'
                      ? { ...b, props: { ...b.props, alt: e.target.value } }
                      : b,
                  )
                }
                className="h-8 px-2.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              />
              <input
                type="text"
                lang={activeLocale}
                placeholder="Optional caption"
                value={block.props.caption || ''}
                onChange={(e) =>
                  updateBlockAt(index, (b) =>
                    b.type === 'image'
                      ? { ...b, props: { ...b.props, caption: e.target.value || undefined } }
                      : b,
                  )
                }
                className="h-8 px-2.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              />
            </div>
          </div>
        )}

        {block.type === 'button' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              lang={activeLocale}
              placeholder="Button label *"
              value={block.props.label}
              onChange={(e) =>
                updateBlockAt(index, (b) =>
                  b.type === 'button'
                    ? { ...b, props: { ...b.props, label: e.target.value } }
                    : b,
                )
              }
              className="h-8 px-2.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
            />
            <input
              type="text"
              placeholder="URL (e.g. /demo or https://...)"
              value={block.props.href}
              onChange={(e) =>
                updateBlockAt(index, (b) =>
                  b.type === 'button'
                    ? { ...b, props: { ...b.props, href: e.target.value } }
                    : b,
                )
              }
              className="h-8 px-2.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-mono"
            />
          </div>
        )}

        {block.type === 'feature_cards' && (
          <div className="space-y-2">
            <input
              type="text"
              lang={activeLocale}
              placeholder="Feature section heading"
              value={block.props.heading || ''}
              onChange={(e) =>
                updateBlockAt(index, (b) =>
                  b.type === 'feature_cards'
                    ? { ...b, props: { ...b.props, heading: e.target.value || undefined } }
                    : b,
                )
              }
              className="w-full h-8 px-2.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
            />
            {block.props.cards.map((c, cIdx) => (
              <div key={c.id || cIdx} className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/30">
                <input
                  type="text"
                  lang={activeLocale}
                  placeholder="Card title *"
                  value={c.title}
                  onChange={(e) =>
                    updateBlockAt(index, (b) =>
                      b.type === 'feature_cards'
                        ? {
                          ...b,
                          props: {
                            ...b.props,
                            cards: b.props.cards.map((item, idx) =>
                              idx === cIdx ? { ...item, title: e.target.value } : item,
                            ),
                          },
                        }
                        : b,
                    )
                  }
                  className="h-8 px-2 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                />
                <input
                  type="text"
                  lang={activeLocale}
                  placeholder="Card description *"
                  value={c.description}
                  onChange={(e) =>
                    updateBlockAt(index, (b) =>
                      b.type === 'feature_cards'
                        ? {
                          ...b,
                          props: {
                            ...b.props,
                            cards: b.props.cards.map((item, idx) =>
                              idx === cIdx ? { ...item, description: e.target.value } : item,
                            ),
                          },
                        }
                        : b,
                    )
                  }
                  className="h-8 px-2 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                />
              </div>
            ))}
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
              updateBlockAt(index, (b) =>
                b.type === 'faq_list'
                  ? { ...b, props: { ...b.props, heading: nextHeading } }
                  : b,
              )
            }
            onChangeTopic={(nextTopic) =>
              updateBlockAt(index, (b) =>
                b.type === 'faq_list'
                  ? { ...b, props: { ...b.props, category: nextTopic } }
                  : b,
              )
            }
            onChangeLimit={(nextLimit) =>
              updateBlockAt(index, (b) =>
                b.type === 'faq_list'
                  ? { ...b, props: { ...b.props, limit: nextLimit } }
                  : b,
              )
            }
            onClearPickedIds={() =>
              updateBlockAt(index, (b) =>
                b.type === 'faq_list'
                  ? { ...b, props: { ...b.props, faqIds: undefined } }
                  : b,
              )
            }
            onToggleFaqId={(faqId) =>
              updateBlockAt(index, (b) => {
                if (b.type !== 'faq_list') return b;
                const set = new Set(b.props.faqIds ?? []);
                if (set.has(faqId)) set.delete(faqId);
                else set.add(faqId);
                return {
                  ...b,
                  props: {
                    ...b.props,
                    faqIds: set.size > 0 ? Array.from(set) : undefined,
                  },
                };
              })
            }
          />
        )}

        {block.type === 'cta_band' && (
          <div className="space-y-2">
            <input
              type="text"
              lang={activeLocale}
              placeholder="CTA headline *"
              value={block.props.title}
              onChange={(e) =>
                updateBlockAt(index, (b) =>
                  b.type === 'cta_band' ? { ...b, props: { ...b.props, title: e.target.value } } : b,
                )
              }
              className="w-full h-8 px-2.5 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                lang={activeLocale}
                placeholder="Primary Button Label *"
                value={block.props.primaryButton.label}
                onChange={(e) =>
                  updateBlockAt(index, (b) =>
                    b.type === 'cta_band'
                      ? {
                        ...b,
                        props: {
                          ...b.props,
                          primaryButton: { ...b.props.primaryButton, label: e.target.value },
                        },
                      }
                      : b,
                  )
                }
                className="h-8 px-2.5 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              />
              <input
                type="text"
                placeholder="Primary Button URL *"
                value={block.props.primaryButton.href}
                onChange={(e) =>
                  updateBlockAt(index, (b) =>
                    b.type === 'cta_band'
                      ? {
                        ...b,
                        props: {
                          ...b.props,
                          primaryButton: { ...b.props.primaryButton, href: e.target.value },
                        },
                      }
                      : b,
                  )
                }
                className="h-8 px-2.5 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-mono"
              />
            </div>
          </div>
        )}

        {block.type === 'video_embed' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Accessible video title *"
              value={block.props.title}
              onChange={(e) =>
                updateBlockAt(index, (b) =>
                  b.type === 'video_embed' ? { ...b, props: { ...b.props, title: e.target.value } } : b,
                )
              }
              className="h-8 px-2.5 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
            />
            <input
              type="text"
              placeholder="https://youtube.com/watch?v=... or vimeo.com/..."
              value={block.props.url}
              onChange={(e) =>
                updateBlockAt(index, (b) =>
                  b.type === 'video_embed' ? { ...b, props: { ...b.props, url: e.target.value } } : b,
                )
              }
              className="h-8 px-2.5 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-mono"
            />
          </div>
        )}

        {block.type === 'columns' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {block.props.columns.map((col, cIdx) => (
              <div key={col.id || cIdx} className="space-y-2">
                <div className="text-[11px] font-semibold text-[rgb(var(--text-muted))]">
                  Column {cIdx + 1}
                </div>
                {col.blocks.map((child, chIdx) =>
                  child.type === 'rich_text' ? (
                    <RichTextEditor
                      key={child.id}
                      value={child.props.html}
                      onChange={(html) =>
                        updateBlockAt(
                          index,
                          (b) => (b.type === 'rich_text' ? { ...b, props: { html } } : b),
                          cIdx,
                          chIdx,
                        )
                      }
                      locale={activeLocale}
                      currentUser={user}
                      minHeightClassName="min-h-[120px]"
                    />
                  ) : null,
                )}
              </div>
            ))}
          </div>
        )}

        {block.type === 'divider' && (
          <input
            type="text"
            placeholder="Optional divider label"
            value={block.props.label || ''}
            onChange={(e) =>
              updateBlockAt(index, (b) =>
                b.type === 'divider'
                  ? { ...b, props: { ...b.props, label: e.target.value || undefined } }
                  : b,
              )
            }
            className="w-full h-8 px-2.5 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
          />
        )}
      </div>
    );
  };

  const containerClass = isStandalonePage
    ? 'rounded-2xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] shadow-sm overflow-hidden flex flex-col min-h-[82vh]'
    : 'w-full max-w-[1440px] h-[93vh] flex flex-col rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] shadow-2xl overflow-hidden';

  const content = (
    <div className={containerClass}>
      {/* Top Header */}
      <div className="px-5 py-3 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-8 w-8 rounded-lg bg-primary-600/15 text-primary-600 flex items-center justify-center shrink-0">
            <FilePlus2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold truncate">
                {mode === 'create'
                  ? 'Create Custom Page'
                  : `Edit Custom Page · /${detail?.page.slug}`}
              </h2>
              <span className="px-2 py-0.5 rounded bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border-base))] text-[10px] font-semibold capitalize">
                {detail?.page.status ?? 'draft'}
              </span>
              {isLegal && (
                <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[10px] font-semibold">
                  Legal Approval Workflow
                </span>
              )}
            </div>
            <p className="text-[11px] text-[rgb(var(--text-muted))] truncate flex flex-wrap items-center gap-2">
              <span>
                {mode === 'create'
                  ? 'Starts as a draft. Publishing makes it live at its slug and adds it to the website sitemap.'
                  : 'Add, drag-and-drop reorder, duplicate, or remove blocks freely.'}
                {mode === 'edit' && activeBaseVersion ? ` · Editing v${activeBaseVersion.versionNumber}` : ''}
              </span>
              {mode === 'edit' && (
                autosaving ? (
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
                ) : null
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode === 'edit' && detail && (
            <button
              type="button"
              onClick={() => setShowVersionHistory(true)}
              className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
            >
              <History className="h-3.5 w-3.5 text-primary-600" />
              History ({detail.versions.length})
            </button>
          )}
          {mode === 'edit' && (
            <>
              <div className="inline-flex rounded-lg p-0.5 bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border-base))]">
                {(['en', 'bn'] as const).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setActiveLocale(loc)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 ${activeLocale === loc
                      ? 'bg-primary-600 text-white'
                      : 'text-[rgb(var(--text-secondary))]'
                      }`}
                  >
                    <Languages className="h-3.5 w-3.5" />
                    {loc === 'en' ? 'English' : 'Bengali (বাংলা)'}
                  </button>
                ))}
              </div>
              {activeLocale === 'bn' && (
                <button
                  type="button"
                  onClick={() =>
                    setDrafts((prev) => ({
                      ...prev,
                      bn: copyEnglishDraftToBengali(prev.en, prev.bn),
                    }))
                  }
                  className="h-8 px-3 rounded-lg border border-primary-600/30 bg-primary-600/10 text-primary-700 dark:text-primary-300 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy from English
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => setShowPreviewPane((p) => !p)}
            className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-medium hidden lg:inline-flex items-center gap-1.5"
          >
            {showPreviewPane ? 'Hide Preview' : 'Show Live Preview'}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={handleRequestClose}
              aria-label="Close builder"
              className="h-8 w-8 rounded-lg inline-flex items-center justify-center hover:bg-[rgb(var(--bg-hover))]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Banners & Warnings */}
      <div className="px-5 pt-3 space-y-2 shrink-0">
        {mode === 'edit' && otherEditors.length > 0 && (
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
              Signed preview:{' '}
              <a
                href={signedPreviewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-mono"
              >
                {signedPreviewLink}
              </a>
            </span>
          </div>
        )}
        {requiredWarnings.length > 0 && (
          <div className="px-3.5 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>{requiredWarnings.length} required field warning(s):</strong>{' '}
              {requiredWarnings.slice(0, 3).map((w) => `${w.label} (${w.message})`).join(' · ')}
            </span>
          </div>
        )}
      </div>

      {/* Main Split Editor + Live Preview */}
      <div className="flex-1 min-h-0 flex overflow-hidden mt-3 border-t border-[rgb(var(--border-base))]">
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[rgb(var(--bg-base))]">
          {/* Title, Slug & Template Card */}
          <section className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Page Title {mode === 'edit' ? `(${activeLocale.toUpperCase()})` : ''}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  lang={isTitleBengali ? 'bn' : activeLocale}
                  value={currentDraft.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Enter page title (English or বাংলা)..."
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-sm"
                />
                {mode === 'create' && isTitleBengali && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="text-amber-700 dark:text-amber-300">
                      Bengali title detected:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSlugTouched(false);
                        setSlug(transliterateBengaliToSlug(currentDraft.title));
                      }}
                      className="px-2 py-0.5 rounded bg-primary-600/10 text-primary-700 dark:text-primary-300 font-semibold hover:bg-primary-600/20"
                    >
                      Transliterate to Slug
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSlugTouched(true);
                        setSlug('');
                      }}
                      className="px-2 py-0.5 rounded border border-[rgb(var(--border-base))] text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-hover))]"
                    >
                      Enter Manual Slug
                    </button>
                  </div>
                )}
              </div>

              {mode === 'create' ? (
                <div>
                  <label className="block text-xs font-medium mb-1">
                    URL Slug <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[rgb(var(--text-muted))]">
                      /
                    </span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        setSlug(normalizeManualSlugInput(e.target.value));
                      }}
                      placeholder="your-page-slug"
                      className={`w-full h-9 pl-6 pr-8 rounded-lg border text-xs font-mono bg-[rgb(var(--bg-surface))] ${slug && (!localSlugValidation.valid || slugCheck?.available === false)
                        ? 'border-rose-500'
                        : slugCheck?.available
                          ? 'border-emerald-500'
                          : 'border-[rgb(var(--border-base))]'
                        }`}
                    />
                    {checkingSlug && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[rgb(var(--text-muted))] absolute right-2.5 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                  <div className="mt-1 text-[11px]">
                    {!slug.trim() ? (
                      <span className="text-[rgb(var(--text-muted))]">
                        Auto-generated from title or entered manually
                      </span>
                    ) : !localSlugValidation.valid ? (
                      <span className="text-rose-600 font-medium">
                        {localSlugValidation.error}
                      </span>
                    ) : slugCheck && !slugCheck.available ? (
                      <span className="text-rose-600 font-medium">{slugCheck.reason}</span>
                    ) : slugCheck?.available ? (
                      <span className="text-emerald-600 font-medium">
                        Available at {WEBSITE_BASE_URL}/{slugCheck.slug}
                      </span>
                    ) : (
                      <span className="text-[rgb(var(--text-muted))]">Checking availability...</span>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium mb-1">Live Slug</label>
                  <div className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex items-center text-xs font-mono">
                    /{detail?.page.slug}
                  </div>
                </div>
              )}
            </div>

            {mode === 'create' && (
              <>
                {/* Template Selector */}
                <div>
                  <label className="block text-xs font-medium mb-2 inline-flex items-center gap-1.5">
                    <LayoutTemplate className="h-3.5 w-3.5 text-primary-600" />
                    Template Choice
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {TEMPLATE_OPTIONS.map((tpl) => (
                      <button
                        key={tpl.key}
                        type="button"
                        onClick={() => handleTemplateSelect(tpl.key)}
                        className={`text-left p-3 rounded-lg border transition-all ${templateKey === tpl.key
                          ? 'border-primary-600 ring-2 ring-primary-600/20 bg-primary-600/5'
                          : 'border-[rgb(var(--border-base))] hover:border-[rgb(var(--border-strong))]'
                          }`}
                      >
                        <div className="text-xs font-semibold">{tpl.title}</div>
                        <div className="text-[11px] text-[rgb(var(--text-muted))] mt-0.5">
                          {tpl.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Menu Assignment at Creation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[rgb(var(--border-base))]">
                  <div>
                    <label className="block text-xs font-medium mb-1 inline-flex items-center gap-1">
                      <ListPlus className="h-3.5 w-3.5 text-primary-600" />
                      Add to Navigation Menu (Optional)
                    </label>
                    <select
                      value={selectedMenuId}
                      onChange={(e) => setSelectedMenuId(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                    >
                      <option value="">Do not add to a menu right now</option>
                      {menus.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.location})
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedMenuId && (
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Menu Link Label (Optional)
                      </label>
                      <input
                        type="text"
                        value={menuItemLabelEn}
                        onChange={(e) => setMenuItemLabelEn(e.target.value)}
                        placeholder={drafts.en.title || 'Defaults to page title'}
                        className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {mode === 'edit' && activeLocale === 'bn' && (
              <div className="flex items-center justify-between pt-2 border-t border-[rgb(var(--border-base))]">
                <span className="text-xs font-medium">Bengali Translation Status</span>
                <select
                  value={currentDraft.translationStatus}
                  onChange={(e) =>
                    updateCurrentDraft((prev) => ({
                      ...prev,
                      translationStatus: e.target.value as CmsTranslationStatus,
                      isTranslated: e.target.value === 'translated',
                    }))
                  }
                  className="h-8 px-2.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                >
                  <option value="untranslated">Untranslated</option>
                  <option value="in_review">In Review</option>
                  <option value="translated">Translated</option>
                </select>
              </div>
            )}
          </section>

          {/* Ordered Block Builder (Add, Drag & Drop Reorder, Duplicate, Remove) */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--text-secondary))]">
                Ordered Content Blocks ({currentDraft.blocks.length}) — Drag or use arrows to reorder
              </h3>
            </div>

            {currentDraft.blocks.map((block, index) => renderBlockCard(block, index))}

            <div className="rounded-xl border border-dashed border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-surface))] p-3">
              <div className="text-[11px] font-semibold text-[rgb(var(--text-secondary))] mb-2 flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-primary-600" />
                Add Block
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ADDABLE_BLOCKS.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => handleAddBlock(item.type)}
                    className="h-7 px-2.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] hover:bg-[rgb(var(--bg-hover))] text-[11px] font-medium inline-flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* SEO & Social Share Metadata */}
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
                <span className="text-[11px] text-[rgb(var(--text-muted))]">
                  {seoTitleHint.text}
                </span>
              </div>
              <input
                type="text"
                value={currentDraft.seoTitle}
                onChange={(e) =>
                  updateCurrentDraft((prev) => ({ ...prev, seoTitle: e.target.value }))
                }
                className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">SEO Description</label>
                <span className="text-[11px] text-[rgb(var(--text-muted))]">
                  {seoDescHint.text}
                </span>
              </div>
              <textarea
                rows={2}
                value={currentDraft.seoDescription}
                onChange={(e) =>
                  updateCurrentDraft((prev) => ({
                    ...prev,
                    seoDescription: e.target.value,
                  }))
                }
                className="w-full p-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Social Share Image</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={currentDraft.ogImageUrl}
                  onChange={(e) =>
                    updateCurrentDraft((prev) => ({ ...prev, ogImageUrl: e.target.value }))
                  }
                  className="flex-1 h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setMediaTarget({ kind: 'og' })}
                  className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] text-xs font-medium inline-flex items-center gap-1"
                >
                  <ImageIcon className="h-3.5 w-3.5 text-primary-600" />
                  Media Library
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Live Desktop & Phone Preview Pane */}
        {showPreviewPane && (
          <div className="hidden lg:flex w-[42%] min-w-[400px] border-l border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/50 flex-col overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] flex items-center justify-between">
              <span className="text-xs font-semibold">Live Preview</span>
              <div className="inline-flex rounded-lg p-0.5 bg-[rgb(var(--bg-muted))] border border-[rgb(var(--border-base))]">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1 ${previewDevice === 'desktop'
                    ? 'bg-[rgb(var(--bg-surface))] shadow-sm'
                    : 'text-[rgb(var(--text-muted))]'
                    }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('phone')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1 ${previewDevice === 'phone'
                    ? 'bg-[rgb(var(--bg-surface))] shadow-sm'
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
                className={`rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-5 space-y-4 h-fit ${previewDevice === 'phone' ? 'w-[390px] max-w-full' : 'w-full'
                  }`}
              >
                <div className="pb-2 border-b border-[rgb(var(--border-base))]">
                  <div className="text-[10px] font-mono text-[rgb(var(--text-muted))]">
                    {WEBSITE_BASE_URL}/{slug || detail?.page.slug || 'your-slug'}
                  </div>
                  <h4 className="text-base font-bold mt-1">
                    {currentDraft.title || 'Untitled Custom Page'}
                  </h4>
                </div>
                {currentDraft.blocks.map((block) => (
                  <div key={block.id} className="space-y-1">
                    {block.type === 'heading' && (
                      <div className="text-lg font-bold">{block.props.text}</div>
                    )}
                    {block.type === 'rich_text' && (
                      <div
                        className="cms-rte-prosemirror text-xs"
                        dangerouslySetInnerHTML={{ __html: block.props.html }}
                      />
                    )}
                    {block.type === 'button' && (
                      <span className="inline-block px-3 py-1.5 rounded bg-primary-600 text-white text-xs font-semibold">
                        {block.props.label}
                      </span>
                    )}
                    {block.type === 'image' && block.props.mediaId && (
                      <img
                        src={`/api/v1/public/content/media/${block.props.mediaId}/file`}
                        alt={block.props.alt}
                        className="rounded-lg max-h-48 object-cover"
                      />
                    )}
                    {block.type === 'feature_cards' && (
                      <div className="grid grid-cols-1 gap-2">
                        {block.props.cards.map((c, i) => (
                          <div key={c.id || i} className="p-2 rounded border border-[rgb(var(--border-base))] text-xs">
                            <div className="font-semibold">{c.title}</div>
                            <div className="text-[11px] text-[rgb(var(--text-secondary))]">{c.description}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {block.type === 'cta_band' && (
                      <div className="p-3 rounded-lg bg-[#0c2239] text-white text-xs space-y-1">
                        <div className="font-bold">{block.props.title}</div>
                        <span className="inline-block px-2.5 py-1 rounded bg-white text-[#0c2239] font-semibold">
                          {block.props.primaryButton.label}
                        </span>
                      </div>
                    )}
                    {block.type === 'divider' && <hr className="border-[rgb(var(--border-base))]" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-5 py-3 border-t border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex flex-wrap items-center justify-between gap-3">
        <input
          type="text"
          value={currentDraft.changeNote}
          onChange={(e) =>
            updateCurrentDraft((prev) => ({ ...prev, changeNote: e.target.value }))
          }
          placeholder="Change note..."
          className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs w-full sm:w-72"
        />

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <button
            type="button"
            disabled={busyAction === 'preview' || (mode === 'create' && !localSlugValidation.valid)}
            onClick={() => void handlePreviewNewTab()}
            className="h-9 px-3.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-45"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Preview in new tab
          </button>

          <button
            type="button"
            disabled={
              saving ||
              Boolean(busyAction) ||
              (mode === 'create' && (!localSlugValidation.valid || slugCheck?.available === false))
            }
            onClick={() => void handleSaveDraft()}
            className="h-9 px-4 rounded-lg border border-primary-600/30 bg-primary-600/10 text-primary-700 dark:text-primary-200 hover:bg-primary-600/20 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : mode === 'create' ? 'Save as draft' : 'Save draft'}
          </button>

          {isLegal ? (
            <>
              <button
                type="button"
                disabled={saving || Boolean(busyAction) || requiredWarnings.length > 0}
                onClick={() => void handlePublishOrSubmit()}
                className="h-9 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Submit for approval
              </button>
              {mode === 'edit' &&
                detail?.page.approvalStatus === 'pending_approval' &&
                canPublishCms &&
                detail.page.submittedForApprovalById !== user?.id && (
                  <button
                    type="button"
                    onClick={() =>
                      void approveCmsLegalPage(detail.page.id, { publishNow: true }).then(
                        async (updated) => {
                          const refreshed = await fetchCmsPageDetail(detail.page.id);
                          setDetail(refreshed);
                          onUpdated?.(updated);
                        },
                      )
                    }
                    className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                  >
                    Approve &amp; Publish
                  </button>
                )}
            </>
          ) : (
            canPublishCms && (
              <button
                type="button"
                disabled={
                  saving ||
                  Boolean(busyAction) ||
                  requiredWarnings.length > 0 ||
                  (mode === 'create' && (!localSlugValidation.valid || slugCheck?.available === false))
                }
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

      <MediaLibraryPickerModal
        isOpen={Boolean(mediaTarget)}
        locale={activeLocale}
        defaultFolder={mediaTarget?.kind === 'og' ? 'seo' : 'pages'}
        onClose={() => setMediaTarget(null)}
        onSelect={(selection) => {
          if (!mediaTarget) return;
          if (mediaTarget.kind === 'og') {
            updateCurrentDraft((prev) => ({ ...prev, ogImageUrl: selection.src }));
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

      {detail && (
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
            onUpdated?.(refreshed.page);
            setShowVersionHistory(false);
            setNotice(
              `Restored historical content into new draft ${restoredVersion.locale.toUpperCase()} v${restoredVersion.versionNumber}. Previous history stays intact.`,
            );
          }}
        />
      )}

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

  if (isStandalonePage) {
    return content;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
    >
      {content}
    </div>
  );
}
