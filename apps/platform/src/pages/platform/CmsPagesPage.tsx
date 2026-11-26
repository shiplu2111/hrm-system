import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CmsLocale,
  CmsPageDetailDto,
  CmsPageDto,
  CmsPageStatus,
  CmsResolvedPageDto,
  CmsTranslationStatus,
} from '@hrm/shared-types';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FilePlus2,
  FileText,
  Globe2,
  Languages,
  Lock,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermission';
import {
  createCmsPagePreviewToken,
  duplicateCmsPage,
  fetchCmsPageDetail,
  getCmsTrashRetention,
  listCmsPages,
  purgeExpiredCmsTrashNow,
  resolveCmsDraftPreview,
  restoreCmsPage,
  unpublishCmsPage,
  updateCmsTrashRetention,
} from '@/lib/platform-cms-api';
import { SystemPageEditor } from '@/components/cms/SystemPageEditor';
import { CustomPageBuilder } from '@/components/cms/CustomPageBuilderModal';
import { DeleteCustomPageModal } from '@/components/cms/DeleteCustomPageModal';
import { PermanentDeletePageModal } from '@/components/cms/PermanentDeletePageModal';

const WEBSITE_BASE_URL =
  import.meta.env.VITE_WEBSITE_URL || 'http://localhost:3000';

type TypeFilter = 'all' | 'system' | 'custom';
type StatusFilter = 'all' | CmsPageStatus;
type TranslationFilter = 'all' | 'translated' | 'in_review' | 'untranslated';

function formatRelativeTime(iso?: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const absSec = Math.abs(diffSec);
  if (absSec < 60) return diffSec <= 0 ? 'just now' : 'soon';
  const mins = Math.round(absSec / 60);
  if (mins < 60) return diffSec <= 0 ? `${mins}m ago` : `in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return diffSec <= 0 ? `${hours}h ago` : `in ${hours}h`;
  const days = Math.round(hours / 24);
  return diffSec <= 0 ? `${days}d ago` : `in ${days}d`;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toKebabSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

function getLivePageUrl(page: CmsPageDto): string {
  const path =
    page.canonicalPath ||
    (page.kind === 'custom' ? `/p/${page.slug}` : `/${page.slug}`);
  const normalizedBase = WEBSITE_BASE_URL.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function getBnLocaleStatus(page: CmsPageDto): CmsTranslationStatus {
  const bn = page.locales.find((l) => l.locale === 'bn');
  if (!bn) return 'untranslated';
  if (bn.isTranslated && bn.translationStatus === 'translated') return 'translated';
  return bn.translationStatus;
}

function PageStatusPill({ status }: { status: CmsPageStatus }) {
  const tones: Record<CmsPageStatus, string> = {
    draft: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    scheduled: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
    published: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    unpublished: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    trashed: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold capitalize ${tones[status]}`}
    >
      {status}
    </span>
  );
}

function TranslationPill({ status }: { status: CmsTranslationStatus }) {
  if (status === 'translated') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium">
        <Languages className="h-3 w-3" />
        EN + BN
      </span>
    );
  }
  if (status === 'in_review') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-medium">
        <Languages className="h-3 w-3" />
        BN In Review
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300 text-[11px] font-medium">
      <Languages className="h-3 w-3" />
      Missing BN
    </span>
  );
}

export function CmsPagesPage() {
  const { can, roleName } = usePermissions();
  const canViewCms = can('cms', 'view');
  const canCreateCms = can('cms', 'create');
  const canEditCms = can('cms', 'edit');
  const canDeleteCms = can('cms', 'delete');
  const canPublishCms = can('cms', 'manage');

  const [pages, setPages] = useState<CmsPageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [translationFilter, setTranslationFilter] = useState<TranslationFilter>('all');

  // Active row busy indicator
  const [busyPageId, setBusyPageId] = useState<string | null>(null);

  // Edit Drawer / Modal state
  const [editingDetail, setEditingDetail] = useState<CmsPageDetailDto | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Preview Modal state
  const [previewPayload, setPreviewPayload] = useState<{
    resolved: CmsResolvedPageDto;
    previewUrl: string;
    expiresAt: string;
  } | null>(null);

  // Create Page modal
  const [createOpen, setCreateOpen] = useState(false);

  // Trash view & delete confirmation modals
  const [viewTab, setViewTab] = useState<'active' | 'trash'>('active');
  const [deleteTarget, setDeleteTarget] = useState<CmsPageDto | null>(null);
  const [permDeleteTarget, setPermDeleteTarget] = useState<CmsPageDto | null>(null);
  const [trashRetentionDays, setTrashRetentionDays] = useState<number>(30);
  const [editingRetention, setEditingRetention] = useState<string>('30');
  const [savingRetention, setSavingRetention] = useState(false);

  const loadPages = useCallback(async () => {
    if (!canViewCms) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [data, retention] = await Promise.all([
        listCmsPages({ includeTrashed: true }),
        getCmsTrashRetention().catch(() => ({ days: 30 })),
      ]);
      setPages(data);
      setTrashRetentionDays(retention.days);
      setEditingRetention(String(retention.days));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CMS pages.');
    } finally {
      setLoading(false);
    }
  }, [canViewCms]);

  useEffect(() => {
    void loadPages();
  }, [loadPages]);

  const handleOpenEdit = async (pageId: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const detail = await fetchCmsPageDetail(pageId);
      setEditingDetail(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load page details.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handlePreviewRow = async (page: CmsPageDto, loc: CmsLocale = 'en') => {
    setBusyPageId(page.id);
    setError(null);
    try {
      const tokenBundle = await createCmsPagePreviewToken(page.id, loc);
      const resolved = await resolveCmsDraftPreview(tokenBundle.token);
      setPreviewPayload({
        resolved,
        previewUrl: tokenBundle.previewUrl,
        expiresAt: tokenBundle.expiresAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open draft preview.');
    } finally {
      setBusyPageId(null);
    }
  };

  const handleDuplicateRow = async (page: CmsPageDto) => {
    if (page.kind !== 'custom' || page.locked || !canCreateCms) return;
    setBusyPageId(page.id);
    setError(null);
    setNotice(null);
    try {
      const copy = await duplicateCmsPage(page.id);
      setNotice(`Duplicated "/${page.slug}" into new custom draft "/${copy.slug}".`);
      await loadPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duplicate page failed.');
    } finally {
      setBusyPageId(null);
    }
  };

  const handleUnpublishRow = async (page: CmsPageDto) => {
    if (page.kind !== 'custom' || page.locked || !canPublishCms) return;
    if (!window.confirm(`Unpublish custom page "/${page.slug}"? Visitors will no longer see this page.`)) {
      return;
    }
    setBusyPageId(page.id);
    setError(null);
    setNotice(null);
    try {
      await unpublishCmsPage(page.id, 'Unpublished from CMS Pages list');
      setNotice(`Unpublished custom page "/${page.slug}".`);
      await loadPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unpublish failed.');
    } finally {
      setBusyPageId(null);
    }
  };

  const handleDeleteRow = (page: CmsPageDto) => {
    if (page.kind !== 'custom' || page.locked || !canDeleteCms) return;
    setDeleteTarget(page);
  };

  const handleSaveRetentionDays = async () => {
    const parsed = parseInt(editingRetention, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 3650) {
      setError('Trash retention must be between 1 and 3650 days.');
      return;
    }
    setSavingRetention(true);
    setError(null);
    try {
      const res = await updateCmsTrashRetention(parsed);
      setTrashRetentionDays(res.days);
      setNotice(`Updated Trash retention window to ${res.days} day(s).`);
      await loadPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update retention setting.');
    } finally {
      setSavingRetention(false);
    }
  };

  const handlePurgeExpiredNow = async () => {
    setSavingRetention(true);
    setError(null);
    try {
      const res = await purgeExpiredCmsTrashNow();
      setNotice(
        res.purgedCount > 0
          ? `Purged ${res.purgedCount} expired trashed page(s) past ${res.retentionDays}-day retention.`
          : `No trashed pages are past the ${res.retentionDays}-day retention window yet.`,
      );
      await loadPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to purge expired trash.');
    } finally {
      setSavingRetention(false);
    }
  };

  const handleRestoreRow = async (page: CmsPageDto) => {
    if (page.kind !== 'custom' || !canPublishCms) return;
    setBusyPageId(page.id);
    setError(null);
    setNotice(null);
    try {
      await restoreCmsPage(page.id);
      setNotice(`Restored custom page "/${page.slug}" to draft.`);
      await loadPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed.');
    } finally {
      setBusyPageId(null);
    }
  };

  const activeCount = useMemo(
    () => pages.filter((p) => p.status !== 'trashed').length,
    [pages],
  );
  const trashedCount = useMemo(
    () => pages.filter((p) => p.status === 'trashed').length,
    [pages],
  );

  const filteredPages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return pages.filter((p) => {
      const inTrash = p.status === 'trashed';
      if (viewTab === 'trash') {
        if (!inTrash) return false;
      } else {
        if (inTrash && statusFilter !== 'trashed') return false;
        if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      }
      if (typeFilter !== 'all' && p.kind !== typeFilter) return false;
      const bnStatus = getBnLocaleStatus(p);
      if (translationFilter !== 'all' && bnStatus !== translationFilter) return false;
      if (q) {
        const matchSlug = p.slug.toLowerCase().includes(q);
        const matchEn = (p.titleEn || '').toLowerCase().includes(q);
        const matchBn = (p.titleBn || '').toLowerCase().includes(q);
        if (!matchSlug && !matchEn && !matchBn) return false;
      }
      return true;
    });
  }, [pages, viewTab, typeFilter, statusFilter, translationFilter, searchQuery]);

  if (!canViewCms) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[440px] text-center p-8 rounded-2xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] shadow-sm max-w-xl mx-auto my-8">
        <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 mb-4">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-[rgb(var(--text-primary))] mb-2">
          CMS Pages Restricted
        </h1>
        <p className="text-sm text-[rgb(var(--text-secondary))] max-w-md">
          Your role (<span className="font-semibold">{roleName || 'Operator'}</span>) lacks{' '}
          <code>cms:view</code> permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary-600 dark:text-primary-300 uppercase tracking-wider mb-1">
            <Globe2 className="h-3.5 w-3.5" />
            Website CMS · Inventory
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
            Pages
          </h1>
          <p className="text-sm text-[rgb(var(--text-secondary))] mt-0.5">
            Manage locked system routes and custom landing pages across English and Bengali locales.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadPages()}
            disabled={loading}
            className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {canCreateCms && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="h-9 px-3.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              New Custom Page
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notice">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Active vs Trash View Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Pages view"
          className="inline-flex rounded-xl p-1 bg-[rgb(var(--bg-muted))] border border-[rgb(var(--border-base))]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewTab === 'active'}
            onClick={() => {
              setViewTab('active');
              if (statusFilter === 'trashed') setStatusFilter('all');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              viewTab === 'active'
                ? 'bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] shadow-sm'
                : 'text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
            }`}
          >
            All Pages ({activeCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewTab === 'trash'}
            onClick={() => setViewTab('trash')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              viewTab === 'trash'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Trash ({trashedCount})
          </button>
        </div>

        {viewTab === 'trash' && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs">
            <Settings2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>
              Retention: <strong>{trashRetentionDays} days</strong>
            </span>
            {canPublishCms && (
              <>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={editingRetention}
                  onChange={(e) => setEditingRetention(e.target.value)}
                  aria-label="Trash retention days"
                  className="w-16 h-7 px-2 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                />
                <button
                  type="button"
                  disabled={savingRetention}
                  onClick={() => void handleSaveRetentionDays()}
                  className="h-7 px-2.5 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] font-medium"
                >
                  Save days
                </button>
                <button
                  type="button"
                  disabled={savingRetention}
                  onClick={() => void handlePurgeExpiredNow()}
                  className="h-7 px-2.5 rounded border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 font-medium"
                >
                  Purge expired
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-3.5 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-3.5 w-3.5 text-[rgb(var(--text-muted))] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by page title (EN/BN) or slug..."
            aria-label="Search CMS pages"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
          />
        </div>

        <select
          aria-label="Filter by page type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-medium"
        >
          <option value="all">Type: All ({activeCount})</option>
          <option value="system">System (Locked)</option>
          <option value="custom">Custom Pages</option>
        </select>

        {viewTab === 'active' && (
          <select
            aria-label="Filter by publish status"
            value={statusFilter}
            onChange={(e) => {
              const next = e.target.value as StatusFilter;
              setStatusFilter(next);
              if (next === 'trashed') setViewTab('trash');
            }}
            className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-medium"
          >
            <option value="all">Status: All Active</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
            <option value="trashed">Trashed</option>
          </select>
        )}

        <select
          aria-label="Filter by Bengali translation status"
          value={translationFilter}
          onChange={(e) => setTranslationFilter(e.target.value as TranslationFilter)}
          className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-medium"
        >
          <option value="all">Translation: All</option>
          <option value="translated">BN Translated</option>
          <option value="in_review">BN In Review</option>
          <option value="untranslated">Missing BN</option>
        </select>
      </div>

      {/* Pages Inventory Table */}
      <div className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[980px]">
            <thead className="bg-[rgb(var(--bg-muted))] border-b border-[rgb(var(--border-base))] text-[11px] uppercase tracking-wider text-[rgb(var(--text-muted))]">
              <tr>
                <th className="px-4 py-3 font-semibold">Page Title</th>
                <th className="px-4 py-3 font-semibold">Slug</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Last Edited</th>
                <th className="px-4 py-3 font-semibold">Translation</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border-base))] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[rgb(var(--text-muted))]">
                    Loading CMS pages...
                  </td>
                </tr>
              ) : filteredPages.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <FileText className="h-8 w-8 text-[rgb(var(--text-muted))] mx-auto mb-2" />
                    <p className="text-sm font-medium">No pages match your current filters</p>
                  </td>
                </tr>
              ) : (
                filteredPages.map((page) => {
                  const isSystem = page.kind === 'system' || page.locked;
                  const bnStatus = getBnLocaleStatus(page);
                  const isBusy = busyPageId === page.id;
                  const liveUrl = getLivePageUrl(page);

                  return (
                    <tr
                      key={page.id}
                      className="hover:bg-[rgb(var(--bg-muted))]/35 transition-colors"
                    >
                      {/* Title + Lock Icon */}
                      <td className="px-4 py-3.5 align-top max-w-[280px]">
                        <div className="flex items-start gap-2">
                          {isSystem && (
                            <span
                              title="System page locked — cannot be renamed, deleted, or unpublished"
                              aria-label="System page locked"
                              className="mt-0.5 text-amber-600 dark:text-amber-400 shrink-0"
                            >
                              <Lock className="h-3.5 w-3.5" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-[rgb(var(--text-primary))] truncate">
                              {page.titleEn || `/${page.slug}`}
                            </div>
                            {page.titleBn && (
                              <div className="text-[11px] text-[rgb(var(--text-muted))] truncate mt-0.5" lang="bn">
                                {page.titleBn}
                              </div>
                            )}
                            {page.requiresApproval && page.approvalStatus !== 'none' && (
                              <div className="mt-1">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-medium capitalize">
                                  Legal: {page.approvalStatus.replace(/_/g, ' ')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Slug */}
                      <td className="px-4 py-3.5 align-top font-mono text-[11px] text-[rgb(var(--text-secondary))]">
                        <div>/{page.slug}</div>
                        {page.canonicalPath && page.canonicalPath !== `/${page.slug}` && (
                          <div className="text-[10px] text-[rgb(var(--text-muted))]">
                            live: {page.canonicalPath}
                          </div>
                        )}
                      </td>

                      {/* Type Badge (System or Custom) */}
                      <td className="px-4 py-3.5 align-top">
                        {isSystem ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold">
                            <Lock className="h-3 w-3" />
                            System
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold">
                            Custom
                          </span>
                        )}
                      </td>

                      {/* Status Pill */}
                      <td className="px-4 py-3.5 align-top">
                        <PageStatusPill status={page.status} />
                        {page.status === 'scheduled' && page.scheduledAt && (
                          <div className="text-[10px] text-[rgb(var(--text-muted))] mt-1">
                            {formatDateTime(page.scheduledAt)}
                          </div>
                        )}
                        {page.status === 'trashed' && page.purgeAt && (
                          <div
                            className="text-[10px] text-rose-700 dark:text-rose-300 mt-1 inline-flex items-center gap-1"
                            title={`Scheduled automatic permanent purge on ${formatDateTime(page.purgeAt)}`}
                          >
                            <Clock className="h-3 w-3" />
                            Auto-purge {formatRelativeTime(page.purgeAt)}
                          </div>
                        )}
                      </td>

                      {/* Last Edited By & When */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-medium text-[rgb(var(--text-primary))]">
                          {page.lastEditedByName || 'Platform Seed'}
                        </div>
                        <div
                          className="text-[11px] text-[rgb(var(--text-muted))] mt-0.5"
                          title={formatDateTime(page.lastEditedAt || page.updatedAt)}
                        >
                          {formatRelativeTime(page.lastEditedAt || page.updatedAt)} ·{' '}
                          {formatDateTime(page.lastEditedAt || page.updatedAt)}
                        </div>
                      </td>

                      {/* Translation Status */}
                      <td className="px-4 py-3.5 align-top">
                        <TranslationPill status={bnStatus} />
                      </td>

                      {/* Actions per Row */}
                      <td className="px-4 py-3.5 align-top text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          {canEditCms && page.status !== 'trashed' && (
                            <button
                              type="button"
                              disabled={isBusy || loadingDetail}
                              onClick={() => void handleOpenEdit(page.id)}
                              title="Edit page content & versions"
                              className="h-7 px-2 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-[11px] font-medium inline-flex items-center gap-1"
                            >
                              <Edit3 className="h-3 w-3" />
                              Edit
                            </button>
                          )}

                          {page.status !== 'trashed' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handlePreviewRow(page, 'en')}
                              title="Preview latest draft using signed expiring token"
                              className="h-7 px-2 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-[11px] font-medium inline-flex items-center gap-1"
                            >
                              <Eye className="h-3 w-3" />
                              Preview
                            </button>
                          )}

                          {page.status === 'published' ? (
                            <a
                              href={liveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Open live URL (${liveUrl})`}
                              className="h-7 px-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 text-[11px] font-medium inline-flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View live
                            </a>
                          ) : (
                            <span
                              title="Page must be published before viewing live"
                              className="h-7 px-2 rounded-md border border-[rgb(var(--border-base))] text-[rgb(var(--text-muted))] opacity-45 text-[11px] font-medium inline-flex items-center gap-1 cursor-not-allowed"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View live
                            </span>
                          )}

                          {/* Custom-only actions: Duplicate, Unpublish, Delete / Restore */}
                          {!isSystem && canCreateCms && page.status !== 'trashed' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleDuplicateRow(page)}
                              title="Duplicate custom page into new draft"
                              className="h-7 px-2 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-[11px] font-medium inline-flex items-center gap-1"
                            >
                              <Copy className="h-3 w-3" />
                              Duplicate
                            </button>
                          )}

                          {!isSystem &&
                            canPublishCms &&
                            page.status === 'published' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleUnpublishRow(page)}
                                title="Unpublish custom page"
                                className="h-7 px-2 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-[11px] font-medium inline-flex items-center gap-1"
                              >
                                <EyeOff className="h-3 w-3" />
                                Unpublish
                              </button>
                            )}

                          {!isSystem && canDeleteCms && page.status !== 'trashed' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDeleteRow(page)}
                              title="Inspect links & move custom page to Trash"
                              className="h-7 px-2 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 text-[11px] font-medium inline-flex items-center gap-1"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          )}

                          {!isSystem && canPublishCms && page.status === 'trashed' && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleRestoreRow(page)}
                                title="Restore custom page from trash back to draft"
                                className="h-7 px-2 rounded-md border border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 text-[11px] font-medium inline-flex items-center gap-1"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Restore
                              </button>
                              {canDeleteCms && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => setPermDeleteTarget(page)}
                                  title="Permanently delete custom page and version history (Publisher only)"
                                  className="h-7 px-2 rounded-md border border-rose-600/40 bg-rose-600/15 text-rose-800 dark:text-rose-200 hover:bg-rose-600/25 text-[11px] font-medium inline-flex items-center gap-1"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Delete permanently
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Page Editor Modal: Dedicated Fixed-Structure Editor for System Pages */}
      {editingDetail &&
        (editingDetail.page.kind === 'system' || editingDetail.page.locked) && (
          <SystemPageEditor
            detail={editingDetail}
            onClose={() => setEditingDetail(null)}
            onUpdated={() => {
              void loadPages();
            }}
          />
        )}

      {/* Custom Page Editor Modal (supports Add, Drag & Drop Reorder, Duplicate, Remove Blocks) */}
      {editingDetail &&
        editingDetail.page.kind !== 'system' &&
        !editingDetail.page.locked && (
          <CustomPageBuilder
            mode="edit"
            initialDetail={editingDetail}
            onClose={() => setEditingDetail(null)}
            onUpdated={() => {
              void loadPages();
            }}
          />
        )}

      {/* Create Custom Page Modal */}
      {createOpen && canCreateCms && (
        <CustomPageBuilder
          mode="create"
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            void loadPages();
          }}
        />
      )}

      {/* Signed Expiring Draft Preview Modal */}
      {previewPayload && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cms-preview-title"
        >
          <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="cms-preview-title" className="text-sm font-semibold">
                    Draft Preview · /{previewPayload.resolved.slug}
                  </h2>
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                    NOINDEX DRAFT
                  </span>
                </div>
                <p className="text-[11px] text-[rgb(var(--text-muted))]">
                  Version v{previewPayload.resolved.version.versionNumber} ({previewPayload.resolved.resolvedLocale.toUpperCase()}) · Token expires {formatDateTime(previewPayload.expiresAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPayload(null)}
                aria-label="Close preview"
                className="h-8 w-8 rounded-lg inline-flex items-center justify-center hover:bg-[rgb(var(--bg-hover))]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <h3 className="text-xl font-bold">{previewPayload.resolved.version.title}</h3>
              {previewPayload.resolved.version.blocks.map((block) => (
                <div
                  key={block.id}
                  className="rounded-lg border border-[rgb(var(--border-base))] p-3.5 bg-[rgb(var(--bg-muted))]/30"
                >
                  <div className="text-[10px] font-mono uppercase text-[rgb(var(--text-muted))] mb-1">
                    {block.type}
                  </div>
                  {block.type === 'heading' ? (
                    <div className="font-bold text-base">{block.props.text}</div>
                  ) : block.type === 'rich_text' ? (
                    <div
                      className="cms-rte-prosemirror text-sm"
                      dangerouslySetInnerHTML={{ __html: block.props.html }}
                    />
                  ) : (
                    <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(block.props, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Custom Page Soft-Delete Impact & Safeguard Modal */}
      {deleteTarget && (
        <DeleteCustomPageModal
          page={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={async (trashed) => {
            setDeleteTarget(null);
            setNotice(
              `Moved custom page "/${trashed.slug}" to Trash (retained for ${trashed.trashRetentionDays ?? trashRetentionDays} days).`,
            );
            await loadPages();
          }}
        />
      )}

      {/* Custom Page Permanent Delete Modal (Publisher-only typed confirmation) */}
      {permDeleteTarget && (
        <PermanentDeletePageModal
          page={permDeleteTarget}
          onClose={() => setPermDeleteTarget(null)}
          onDeleted={async () => {
            const slug = permDeleteTarget.slug;
            setPermDeleteTarget(null);
            setNotice(`Permanently deleted "/${slug}" and recorded permanent deletion in audit log.`);
            await loadPages();
          }}
        />
      )}
    </div>
  );
}
