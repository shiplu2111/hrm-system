import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CmsChangelogEntryDto, CmsChangelogTag } from '@hrm/shared-types';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  Globe,
  Languages,
  Plus,
  RefreshCw,
  RotateCcw,
  Rss,
  Search,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  listCmsChangelog,
  permanentDeleteCmsChangelogEntry,
  publishCmsChangelogEntry,
  restoreCmsChangelogEntry,
  trashCmsChangelogEntry,
  unpublishCmsChangelogEntry,
} from '@/lib/platform-cms-api';
import { hasPlatformPermission } from '@/lib/permissions';
import { usePermissions } from '@/hooks/usePermission';
import { ChangelogEditorModal } from '@/components/cms/ChangelogEditorModal';

type VisibilityFilter = 'all' | 'published' | 'hidden' | 'trashed';

const TAG_BADGE_MAP: Record<CmsChangelogTag, { label: string; className: string; icon: typeof Sparkles }> = {
  new: {
    label: 'New',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    icon: Sparkles,
  },
  improved: {
    label: 'Improved',
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    icon: CheckCircle2,
  },
  fixed: {
    label: 'Fixed',
    className: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
    icon: Wrench,
  },
  security: {
    label: 'Security',
    className: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
    icon: Sparkles,
  },
};

export function ChangelogManagementPage() {
  const { user: currentUser } = usePermissions();
  const canCreate = hasPlatformPermission(currentUser, 'cms', 'create');
  const canEdit = hasPlatformPermission(currentUser, 'cms', 'edit');
  const canManage = hasPlatformPermission(currentUser, 'cms', 'manage');
  const canDelete = hasPlatformPermission(currentUser, 'cms', 'delete');

  const [entries, setEntries] = useState<CmsChangelogEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [tagFilter, setTagFilter] = useState<CmsChangelogTag | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CmsChangelogEntryDto | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listCmsChangelog({ includeTrashed: true });
      setEntries(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load changelog entries.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const publishedCount = useMemo(
    () => entries.filter((e) => !e.deletedAt && e.isPublished).length,
    [entries],
  );

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const isTrashed = Boolean(entry.deletedAt);
      if (visibilityFilter === 'trashed') {
        if (!isTrashed) return false;
      } else {
        if (isTrashed) return false;
        if (visibilityFilter === 'published' && !entry.isPublished) return false;
        if (visibilityFilter === 'hidden' && entry.isPublished) return false;
      }
      if (tagFilter !== 'all' && entry.tag !== tagFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hit =
          entry.titleEn.toLowerCase().includes(q) ||
          (entry.titleBn || '').toLowerCase().includes(q) ||
          entry.slug.toLowerCase().includes(q) ||
          (entry.moduleRefs || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [entries, visibilityFilter, tagFilter, searchQuery]);

  const handleAction = async (fn: () => Promise<void>, successMessage: string) => {
    setError(null);
    try {
      await fn();
      setNotice(successMessage);
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary-600" />
            Product Changelog CMS
          </h1>
          <p className="text-xs sm:text-sm text-[rgb(var(--text-muted))] mt-1">
            Publish release notes with release date, tag (New, Improved, Fixed), rich-text body, and public visibility control.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadEntries()}
            className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setEditingEntry(null);
                setEditorOpen(true);
              }}
              className="h-9 px-3.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              New Entry
            </button>
          )}
        </div>
      </div>

      {/* Visibility Info Banner */}
      <div className="px-4 py-3 rounded-xl border border-primary-500/25 bg-primary-500/5 text-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary-600 shrink-0" />
          <span>
            <strong>{publishedCount}</strong> published changelog{' '}
            {publishedCount === 1 ? 'entry is' : 'entries are'} visible on{' '}
            <code className="font-mono">/changelog</code>. Draft/hidden entries never appear on the website.
          </span>
        </div>
        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[rgb(var(--text-muted))]">
          <Rss className="h-3.5 w-3.5" />
          /changelog/rss.xml
        </span>
      </div>

      {notice && (
        <div className="px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="opacity-70 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="opacity-70 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'All Active' },
              { id: 'published', label: 'Published (Visible)' },
              { id: 'hidden', label: 'Hidden / Draft' },
              { id: 'trashed', label: 'Trash' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setVisibilityFilter(item.id)}
              className={`h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${
                visibilityFilter === item.id
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-secondary))] hover:border-primary-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-[rgb(var(--text-muted))] absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, area, slug…"
              className="h-8 pl-8 pr-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs w-48"
            />
          </div>

          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value as CmsChangelogTag | 'all')}
            className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
          >
            <option value="all">All Tags</option>
            <option value="new">New</option>
            <option value="improved">Improved</option>
            <option value="fixed">Fixed</option>
          </select>
        </div>
      </div>

      {/* Entries List */}
      <div className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] divide-y divide-[rgb(var(--border-base))]">
        {filteredEntries.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <Sparkles className="h-8 w-8 text-[rgb(var(--text-muted))] mx-auto" />
            <p className="text-sm font-semibold">No changelog entries found</p>
            <p className="text-xs text-[rgb(var(--text-muted))]">
              Create a release update entry with rich-text notes and toggle visibility to publish it.
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const tagInfo = TAG_BADGE_MAP[entry.tag] ?? TAG_BADGE_MAP.improved;
            const TagIcon = tagInfo.icon;
            const isTrashed = Boolean(entry.deletedAt);

            return (
              <div
                key={entry.id}
                className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[rgb(var(--bg-muted))]/30"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${tagInfo.className}`}
                    >
                      <TagIcon className="h-3 w-3" />
                      {tagInfo.label}
                    </span>

                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[rgb(var(--text-muted))]">
                      <Calendar className="h-3.5 w-3.5" />
                      {entry.releaseDate}
                    </span>

                    {entry.isPublished ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                        <Eye className="h-3 w-3" />
                        Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30">
                        <EyeOff className="h-3 w-3" />
                        Hidden
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border border-[rgb(var(--border-base))] text-[rgb(var(--text-muted))]">
                      <Languages className="h-3 w-3" />
                      {entry.isBnTranslated ? 'EN + BN' : 'EN'}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold">{entry.titleEn}</h3>

                  {entry.summaryEn && (
                    <p className="text-xs text-[rgb(var(--text-secondary))] line-clamp-2">
                      {entry.summaryEn}
                    </p>
                  )}

                  <div className="text-[11px] text-[rgb(var(--text-muted))] font-mono">
                    #{entry.slug}
                    {entry.moduleRefs ? ` · ${entry.moduleRefs}` : ''}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {!isTrashed && canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEntry(entry);
                        setEditorOpen(true);
                      }}
                      className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  )}

                  {!isTrashed && canManage && (
                    <button
                      type="button"
                      onClick={() =>
                        handleAction(
                          () =>
                            (entry.isPublished
                              ? unpublishCmsChangelogEntry(entry.id)
                              : publishCmsChangelogEntry(entry.id)
                            ).then(() => undefined),
                          entry.isPublished
                            ? `Hidden "${entry.titleEn}" from website.`
                            : `Published "${entry.titleEn}" live on website.`,
                        )
                      }
                      className={`h-8 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 ${
                        entry.isPublished
                          ? 'border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {entry.isPublished ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5" />
                          Hide
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" />
                          Publish
                        </>
                      )}
                    </button>
                  )}

                  {!isTrashed && canDelete && (
                    <button
                      type="button"
                      onClick={() =>
                        handleAction(
                          () => trashCmsChangelogEntry(entry.id).then(() => undefined),
                          `Moved "${entry.titleEn}" to Trash.`,
                        )
                      }
                      className="h-8 px-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-medium inline-flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Trash
                    </button>
                  )}

                  {isTrashed && canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          handleAction(
                            () => restoreCmsChangelogEntry(entry.id).then(() => undefined),
                            `Restored "${entry.titleEn}" as hidden draft.`,
                          )
                        }
                        className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] text-xs font-medium inline-flex items-center gap-1"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleAction(
                            () => permanentDeleteCmsChangelogEntry(entry.id).then(() => undefined),
                            `Permanently deleted "${entry.titleEn}".`,
                          )
                        }
                        className="h-8 px-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Forever
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <ChangelogEditorModal
        isOpen={editorOpen}
        entry={editingEntry}
        currentUser={currentUser}
        onClose={() => setEditorOpen(false)}
        onSaved={async (saved) => {
          setEditorOpen(false);
          setNotice(
            `Saved changelog entry "${saved.titleEn}" (${saved.isPublished ? 'published' : 'hidden'}).`,
          );
          await loadEntries();
        }}
      />
    </div>
  );
}
