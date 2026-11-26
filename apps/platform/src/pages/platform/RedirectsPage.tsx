import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CmsPageDto,
  CmsRedirectCsvImportResultDto,
  CmsRedirectRuleDto,
  CmsRedirectType,
} from '@hrm/shared-types';
import {
  AlertCircle,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Download,
  Edit3,
  FileSpreadsheet,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermission';
import {
  createCmsRedirect,
  deleteCmsRedirect,
  exportCmsRedirectsCsv,
  importCmsRedirectsCsv,
  listCmsPages,
  listCmsRedirects,
  updateCmsRedirect,
} from '@/lib/platform-cms-api';

const TYPE_LABELS: Record<CmsRedirectType, string> = {
  permanent_301: '301 Permanent',
  temporary_302: '302 Temporary',
  permanent_308: '308 Permanent',
  temporary_307: '307 Temporary',
};

export function RedirectsPage() {
  const { can, roleName } = usePermissions();
  const canViewCms = can('cms', 'view');
  const canEditCms = can('cms', 'edit');

  const [rules, setRules] = useState<CmsRedirectRuleDto[]>([]);
  const [pages, setPages] = useState<CmsPageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | CmsRedirectType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'true' | 'false'>('all');

  // Add/Edit Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CmsRedirectRuleDto | null>(null);
  const [sourcePath, setSourcePath] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [redirectType, setRedirectType] = useState<CmsRedirectType>('permanent_301');
  const [isActive, setIsActive] = useState(true);
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // CSV Import Modal
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState(
    'source_path,destination_url,redirect_type,is_active,note\n/old-promo,/pricing,301,true,Seasonal redirect',
  );
  const [importResult, setImportResult] = useState<CmsRedirectCsvImportResultDto | null>(null);

  const loadRedirects = useCallback(async () => {
    if (!canViewCms) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [rows, pageList] = await Promise.all([
        listCmsRedirects({
          search: searchQuery,
          redirectType: typeFilter,
          isActive: statusFilter,
        }),
        listCmsPages({ includeTrashed: false }).catch(() => []),
      ]);
      setRules(rows);
      setPages(pageList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load redirects.');
    } finally {
      setLoading(false);
    }
  }, [canViewCms, searchQuery, typeFilter, statusFilter]);

  useEffect(() => {
    void loadRedirects();
  }, [loadRedirects]);

  const stats = useMemo(() => {
    const active = rules.filter((r) => r.isActive).length;
    const totalHits = rules.reduce((acc, r) => acc + (r.hitCount ?? 0), 0);
    return {
      total: rules.length,
      active,
      totalHits,
    };
  }, [rules]);

  const openCreateForm = () => {
    setEditingRule(null);
    setSourcePath('');
    setDestinationUrl('/');
    setRedirectType('permanent_301');
    setIsActive(true);
    setNote('');
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (r: CmsRedirectRuleDto) => {
    setEditingRule(r);
    setSourcePath(r.sourcePath);
    setDestinationUrl(r.destinationUrl);
    setRedirectType(r.redirectType);
    setIsActive(r.isActive);
    setNote(r.note ?? '');
    setFormError(null);
    setFormOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditCms) return;
    setFormError(null);
    if (!sourcePath.trim() || !destinationUrl.trim()) {
      setFormError('Source path and destination URL are required.');
      return;
    }

    setBusy(true);
    try {
      if (editingRule) {
        await updateCmsRedirect(editingRule.id, {
          sourcePath: sourcePath.trim(),
          destinationUrl: destinationUrl.trim(),
          redirectType,
          isActive,
          note: note.trim() || null,
        });
        setNotice(`Updated redirect ${sourcePath.trim()} -> ${destinationUrl.trim()}.`);
      } else {
        await createCmsRedirect({
          sourcePath: sourcePath.trim(),
          destinationUrl: destinationUrl.trim(),
          redirectType,
          isActive,
          note: note.trim() || null,
        });
        setNotice(`Created ${TYPE_LABELS[redirectType]} redirect ${sourcePath.trim()}.`);
      }
      setFormOpen(false);
      await loadRedirects();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save redirect rule.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleRuleActive = async (r: CmsRedirectRuleDto) => {
    if (!canEditCms) return;
    setBusy(true);
    setError(null);
    try {
      await updateCmsRedirect(r.id, { isActive: !r.isActive });
      setNotice(`${!r.isActive ? 'Activated' : 'Paused'} redirect "${r.sourcePath}".`);
      await loadRedirects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not toggle redirect status.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRule = async (r: CmsRedirectRuleDto) => {
    if (!canEditCms) return;
    if (!window.confirm(`Delete redirect rule "${r.sourcePath} -> ${r.destinationUrl}"?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteCmsRedirect(r.id);
      setNotice(`Deleted redirect "${r.sourcePath}".`);
      await loadRedirects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleExportCsv = async () => {
    setBusy(true);
    setError(null);
    try {
      const csv = await exportCmsRedirectsCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cms-redirects-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setNotice('Exported CMS redirects CSV.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export CSV.');
    } finally {
      setBusy(false);
    }
  };

  const handleImportCsvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditCms || !csvText.trim()) return;
    setBusy(true);
    setError(null);
    setImportResult(null);
    try {
      const result = await importCmsRedirectsCsv(csvText);
      setImportResult(result);
      setNotice(
        `CSV import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped.`,
      );
      await loadRedirects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV import failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!canViewCms) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] text-center p-8 rounded-2xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] shadow-sm max-w-xl mx-auto my-8">
        <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 mb-4">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold mb-2">CMS Redirects Restricted</h1>
        <p className="text-sm text-[rgb(var(--text-secondary))]">
          Your role ({roleName || 'Operator'}) lacks <code>cms:view</code> permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary-600 dark:text-primary-300 uppercase tracking-wider mb-1">
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Website CMS · Traffic &amp; SEO Continuity
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
            Redirects
          </h1>
          <p className="text-sm text-[rgb(var(--text-secondary))] mt-0.5">
            301/302 manual rules, automatic 301s from slug changes or page deletions, loop/chain guard, CSV import/export, and hit counters.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleExportCsv()}
            className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>

          {canEditCms && (
            <button
              type="button"
              onClick={() => {
                setImportResult(null);
                setCsvOpen(true);
              }}
              className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              Import CSV
            </button>
          )}

          <button
            type="button"
            onClick={() => void loadRedirects()}
            disabled={loading}
            className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {canEditCms && (
            <button
              type="button"
              onClick={openCreateForm}
              className="h-9 px-3.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              New Redirect
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-4 shadow-sm">
          <div className="text-[11px] font-medium text-[rgb(var(--text-muted))]">Total Redirect Rules</div>
          <div className="text-2xl font-bold mt-1">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-4 shadow-sm">
          <div className="text-[11px] font-medium text-[rgb(var(--text-muted))]">Active Rules</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
            {stats.active}
          </div>
        </div>
        <div className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-4 shadow-sm">
          <div className="text-[11px] font-medium text-[rgb(var(--text-muted))]">Recorded Redirect Hits</div>
          <div className="text-2xl font-bold mt-1 text-primary-600 dark:text-primary-400">
            {stats.totalHits.toLocaleString()}
          </div>
        </div>
      </div>

      {notice && (
        <div className="px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-3.5 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-3.5 w-3.5 text-[rgb(var(--text-muted))] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search source path, destination URL, or note..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
          />
        </div>

        <select
          aria-label="Filter by redirect status code"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | CmsRedirectType)}
          className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-medium"
        >
          <option value="all">Type: All</option>
          <option value="permanent_301">301 Permanent</option>
          <option value="temporary_302">302 Temporary</option>
          <option value="permanent_308">308 Permanent</option>
          <option value="temporary_307">307 Temporary</option>
        </select>

        <select
          aria-label="Filter by active state"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'true' | 'false')}
          className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-medium"
        >
          <option value="all">Status: All</option>
          <option value="true">Active Only</option>
          <option value="false">Paused Only</option>
        </select>
      </div>

      {/* Rules Table */}
      <div className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[820px]">
            <thead className="bg-[rgb(var(--bg-muted))] border-b border-[rgb(var(--border-base))] text-[11px] uppercase tracking-wider text-[rgb(var(--text-muted))]">
              <tr>
                <th className="px-4 py-3 font-semibold">Source Path</th>
                <th className="px-4 py-3 font-semibold">Destination</th>
                <th className="px-4 py-3 font-semibold">HTTP Code</th>
                <th className="px-4 py-3 font-semibold">Hits</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border-base))] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[rgb(var(--text-muted))]">
                    Loading redirect rules...
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[rgb(var(--text-muted))]">
                    No redirect rules found.
                  </td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r.id} className="hover:bg-[rgb(var(--bg-muted))]/35">
                    <td className="px-4 py-3 align-top">
                      <code className="font-mono font-semibold text-[rgb(var(--text-primary))]">
                        {r.sourcePath}
                      </code>
                      {r.note && (
                        <div className="text-[11px] text-[rgb(var(--text-muted))] mt-0.5 max-w-[300px] truncate">
                          {r.note}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="inline-flex items-center gap-1.5 font-mono text-[11px] text-primary-700 dark:text-primary-300">
                        <ArrowRight className="h-3 w-3 shrink-0" />
                        <span>{r.destinationUrl}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          r.redirectType === 'temporary_302' || r.redirectType === 'temporary_307'
                            ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                            : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                        }`}
                      >
                        {TYPE_LABELS[r.redirectType] ?? r.redirectType}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top font-mono font-semibold">
                      {(r.hitCount ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          r.isActive
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {r.isActive ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      {canEditCms && (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleToggleRuleActive(r)}
                            className="h-7 px-2 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-[11px] inline-flex items-center gap-1"
                          >
                            {r.isActive ? (
                              <>
                                <PauseCircle className="h-3 w-3" /> Pause
                              </>
                            ) : (
                              <>
                                <PlayCircle className="h-3 w-3" /> Enable
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditForm(r)}
                            className="h-7 px-2 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-[11px] inline-flex items-center gap-1"
                          >
                            <Edit3 className="h-3 w-3" /> Edit
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleDeleteRule(r)}
                            aria-label={`Delete redirect ${r.sourcePath}`}
                            className="h-7 w-7 rounded border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 inline-flex items-center justify-center"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Redirect Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cms-redirect-modal-title"
        >
          <form
            onSubmit={handleSaveRule}
            className="w-full max-w-lg rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex items-center justify-between gap-2">
              <h2 id="cms-redirect-modal-title" className="text-sm font-bold">
                {editingRule ? `Edit Redirect · ${editingRule.sourcePath}` : 'Create Redirect Rule'}
              </h2>
              <button type="button" onClick={() => setFormOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              {formError && (
                <div className="px-3 py-2 rounded-lg border border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-medium mb-1">
                  Source Path <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={sourcePath}
                  onChange={(e) => setSourcePath(e.target.value)}
                  placeholder="/old-promo-slug"
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">
                  Destination Path or URL <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="/pricing or https://example.com"
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-mono"
                />
                {pages.length > 0 && (
                  <div className="mt-1.5">
                    <select
                      aria-label="Quick select destination page"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) setDestinationUrl(e.target.value);
                      }}
                      className="w-full h-8 px-2.5 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/40 text-[11px]"
                    >
                      <option value="">Or pick an existing CMS page destination...</option>
                      <option value="/">Home (/)</option>
                      {pages
                        .filter((p) => p.status === 'published')
                        .map((p) => (
                          <option key={p.id} value={p.canonicalPath || `/${p.slug}`}>
                            {p.titleEn || `/${p.slug}`} ({p.canonicalPath || `/${p.slug}`})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Redirect Status Code</label>
                  <select
                    value={redirectType}
                    onChange={(e) => setRedirectType(e.target.value as CmsRedirectType)}
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                  >
                    <option value="permanent_301">301 Permanent</option>
                    <option value="temporary_302">302 Temporary</option>
                    <option value="permanent_308">308 Permanent</option>
                    <option value="temporary_307">307 Temporary</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="h-4 w-4 rounded"
                    />
                    Active rule
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why this redirect exists"
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="h-9 px-4 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="h-9 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                {busy ? 'Saving...' : 'Save Redirect'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CSV Import Modal */}
      {csvOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cms-redirect-csv-title"
        >
          <form
            onSubmit={handleImportCsvSubmit}
            className="w-full max-w-2xl rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary-600" />
                <h2 id="cms-redirect-csv-title" className="text-sm font-bold">
                  Import Redirects CSV
                </h2>
              </div>
              <button type="button" onClick={() => setCsvOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <p className="text-[rgb(var(--text-secondary))]">
                Columns: <code>source_path,destination_url,redirect_type,is_active,note</code>. Redirect loops and chains are automatically rejected per row.
              </p>

              <div>
                <label className="block font-medium mb-1">Upload .csv file</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setCsvText(await f.text());
                  }}
                  className="block w-full text-xs"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">CSV Content</label>
                <textarea
                  rows={7}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full p-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] font-mono text-[11px]"
                />
              </div>

              {importResult && (
                <div className="p-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/40 space-y-1.5">
                  <div className="font-semibold">
                    Result: {importResult.created} created, {importResult.updated} updated,{' '}
                    {importResult.skipped} skipped
                  </div>
                  {importResult.errors.length > 0 && (
                    <ul className="space-y-1 text-rose-700 dark:text-rose-300 max-h-32 overflow-y-auto">
                      {importResult.errors.map((err, idx) => (
                        <li key={idx}>
                          Row {err.row} ({err.sourcePath || 'empty'}): {err.error}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCsvOpen(false)}
                className="h-9 px-4 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-medium"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={busy}
                className="h-9 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Import Rules
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
