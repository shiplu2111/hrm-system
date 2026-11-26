import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CmsCareerDto, CmsCareerStatus } from '@hrm/shared-types';
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Languages,
  Lock,
  Mail,
  MapPin,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  listCmsCareers,
  permanentDeleteCmsCareer,
  restoreCmsCareer,
  setCmsCareerStatus,
  trashCmsCareer,
} from '@/lib/platform-cms-api';
import { hasPlatformPermission } from '@/lib/permissions';
import { usePermissions } from '@/hooks/usePermission';
import { CareerEditorModal } from '@/components/cms/CareerEditorModal';

type CareerStatusFilter = 'all' | 'open' | 'closed' | 'draft' | 'trashed';

const STATUS_BADGES: Record<CmsCareerStatus, string> = {
  open: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  closed: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  paused: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  draft: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
};

export function CareersManagementPage() {
  const { user: currentUser } = usePermissions();
  const canCreate = hasPlatformPermission(currentUser, 'cms', 'create');
  const canEdit = hasPlatformPermission(currentUser, 'cms', 'edit');
  const canManage = hasPlatformPermission(currentUser, 'cms', 'manage');
  const canDelete = hasPlatformPermission(currentUser, 'cms', 'delete');

  const [careers, setCareers] = useState<CmsCareerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<CareerStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCareer, setEditingCareer] = useState<CmsCareerDto | null>(null);

  const loadCareers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listCmsCareers({ includeTrashed: true });
      setCareers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load career listings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCareers();
  }, [loadCareers]);

  const openCount = useMemo(
    () => careers.filter((c) => !c.deletedAt && c.status === 'open').length,
    [careers],
  );

  const filteredCareers = useMemo(() => {
    return careers.filter((c) => {
      const isTrashed = Boolean(c.deletedAt);
      if (statusFilter === 'trashed') {
        if (!isTrashed) return false;
      } else {
        if (isTrashed) return false;
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hit =
          c.titleEn.toLowerCase().includes(q) ||
          (c.titleBn || '').toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q) ||
          c.locationText.toLowerCase().includes(q) ||
          c.department.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [careers, statusFilter, searchQuery]);

  const handleAction = async (fn: () => Promise<void>, successMessage: string) => {
    setError(null);
    try {
      await fn();
      setNotice(successMessage);
      await loadCareers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Career action failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary-600" />
            Careers CMS
          </h1>
          <p className="text-xs sm:text-sm text-[rgb(var(--text-muted))] mt-1">
            Manage job listings with title, location, type, rich-text description, open/closed status, and application links or email.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadCareers()}
            className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setEditingCareer(null);
                setEditorOpen(true);
              }}
              className="h-9 px-3.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              New Job Listing
            </button>
          )}
        </div>
      </div>

      {/* Live Status Banner */}
      <div
        className={`px-4 py-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
          openCount > 0
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 shrink-0" />
          <span>
            {openCount > 0 ? (
              <>
                <strong>{openCount}</strong> open role{openCount === 1 ? '' : 's'} shown live on{' '}
                <code className="font-mono">/careers</code>.
              </>
            ) : (
              <>
                <strong>0 open roles:</strong> <code className="font-mono">/careers</code> shows the honest empty state. Closed URLs (<code className="font-mono">/careers/:slug</code>) show a friendly “no longer open” page.
              </>
            )}
          </span>
        </div>
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

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'open', 'closed', 'draft', 'trashed'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${
                statusFilter === st
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-secondary))] hover:border-primary-400'
              }`}
            >
              {st === 'all' ? 'All Active' : st.charAt(0).toUpperCase() + st.slice(1)}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="h-3.5 w-3.5 text-[rgb(var(--text-muted))] absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search role title, location, slug…"
            className="h-8 pl-8 pr-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs w-56"
          />
        </div>
      </div>

      {/* Listings */}
      <div className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] divide-y divide-[rgb(var(--border-base))]">
        {filteredCareers.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <Briefcase className="h-8 w-8 text-[rgb(var(--text-muted))] mx-auto" />
            <p className="text-sm font-semibold">No job listings found</p>
            <p className="text-xs text-[rgb(var(--text-muted))]">
              Create a job listing when hiring is approved, or switch filters above.
            </p>
          </div>
        ) : (
          filteredCareers.map((role) => {
            const isTrashed = Boolean(role.deletedAt);
            return (
              <div
                key={role.id}
                className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[rgb(var(--bg-muted))]/30"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold">{role.titleEn}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase ${STATUS_BADGES[role.status]}`}
                    >
                      {role.status}
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border border-[rgb(var(--border-base))] text-[rgb(var(--text-muted))]">
                      <Languages className="h-3 w-3" />
                      {role.isBnTranslated ? 'EN + BN' : 'EN'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[rgb(var(--text-muted))]">
                    <span className="font-mono">/careers/{role.slug}</span>
                    <span>·</span>
                    <span>{role.department}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {role.locationText} ({role.locationType})
                    </span>
                    <span>·</span>
                    <span>{role.employmentType}</span>
                    {role.applyUrl && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          Apply Link
                        </span>
                      </>
                    )}
                    {role.applyEmail && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {role.applyEmail}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {!isTrashed && canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCareer(role);
                        setEditorOpen(true);
                      }}
                      className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  )}

                  {!isTrashed && canManage && role.status !== 'open' && (
                    <button
                      type="button"
                      onClick={() =>
                        handleAction(
                          () => setCmsCareerStatus(role.id, 'open').then(() => undefined),
                          `Opened "/careers/${role.slug}" on website.`,
                        )
                      }
                      className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                    >
                      Mark Open
                    </button>
                  )}

                  {!isTrashed && canManage && role.status === 'open' && (
                    <button
                      type="button"
                      onClick={() =>
                        handleAction(
                          () => setCmsCareerStatus(role.id, 'closed').then(() => undefined),
                          `Closed "/careers/${role.slug}". It now shows the friendly "no longer open" page.`,
                        )
                      }
                      className="h-8 px-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      Close Role
                    </button>
                  )}

                  {!isTrashed && canDelete && (
                    <button
                      type="button"
                      onClick={() =>
                        handleAction(
                          () => trashCmsCareer(role.id).then(() => undefined),
                          `Moved "${role.titleEn}" to Trash.`,
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
                            () => restoreCmsCareer(role.id).then(() => undefined),
                            `Restored "${role.titleEn}" as draft.`,
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
                            () => permanentDeleteCmsCareer(role.id).then(() => undefined),
                            `Permanently deleted "${role.titleEn}".`,
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

      <CareerEditorModal
        isOpen={editorOpen}
        career={editingCareer}
        currentUser={currentUser}
        onClose={() => setEditorOpen(false)}
        onSaved={async (saved) => {
          setEditorOpen(false);
          setNotice(`Saved role "/careers/${saved.slug}" (${saved.status}).`);
          await loadCareers();
        }}
      />
    </div>
  );
}
