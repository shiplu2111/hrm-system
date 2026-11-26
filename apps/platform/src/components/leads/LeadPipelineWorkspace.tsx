import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Filter,
  Globe2,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Sparkles,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type {
  LeadStatus,
  PlatformLeadDetail,
  PlatformLeadItem,
  PlatformLeadRecordKind,
  PlatformLeadStaffOption,
  PlatformLeadsListResponse,
} from '@hrm/shared-types';
import { usePermissions } from '@/hooks/usePermission';
import {
  downloadPlatformLeadsCsv,
  getPlatformLeadDetail,
  listPlatformLeads,
  updatePlatformLead,
} from '@/lib/platform-leads-api';

interface LeadPipelineWorkspaceProps {
  mode: 'leads' | 'demo-requests';
}

const STATUS_META: Record<
  LeadStatus,
  { label: string; badgeClass: string; cardBorder: string }
> = {
  new: {
    label: 'New',
    badgeClass:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    cardBorder: 'border-l-blue-500',
  },
  contacted: {
    label: 'Contacted',
    badgeClass:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    cardBorder: 'border-l-amber-500',
  },
  qualified: {
    label: 'Qualified',
    badgeClass:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
    cardBorder: 'border-l-indigo-500',
  },
  closed: {
    label: 'Closed',
    badgeClass:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    cardBorder: 'border-l-emerald-500',
  },
};

const KIND_LABELS: Record<PlatformLeadRecordKind, string> = {
  lead: 'Sales Lead',
  demo: 'Demo Request',
  contact: 'Contact Message',
};

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

export function LeadPipelineWorkspace({ mode }: LeadPipelineWorkspaceProps) {
  const { can } = usePermissions();
  const canEdit = can('leads', 'edit');

  const isDemoMode = mode === 'demo-requests';
  const defaultKind: PlatformLeadRecordKind | 'leads_and_contacts' = isDemoMode
    ? 'demo'
    : 'leads_and_contacts';

  const [kindFilter, setKindFilter] = useState<PlatformLeadRecordKind | 'leads_and_contacts'>(
    defaultKind,
  );
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const [listData, setListData] = useState<PlatformLeadsListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);

  const [selectedRow, setSelectedRow] = useState<{
    kind: PlatformLeadRecordKind;
    id: string;
  } | null>(null);
  const [detail, setDetail] = useState<PlatformLeadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // Editable fields inside detail drawer
  const [editStatus, setEditStatus] = useState<LeadStatus>('new');
  const [editAssigneeId, setEditAssigneeId] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [noteAppend, setNoteAppend] = useState<string>('');
  const [auditReason, setAuditReason] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  useEffect(() => {
    setKindFilter(isDemoMode ? 'demo' : 'leads_and_contacts');
    setSelectedRow(null);
    setDetail(null);
    setPage(1);
  }, [isDemoMode]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listPlatformLeads({
        kind: kindFilter,
        status: statusFilter,
        country: countryFilter,
        source: sourceFilter,
        assigneeUserId: assigneeFilter,
        from: fromDate || undefined,
        to: toDate || undefined,
        search,
        page,
        pageSize: 20,
      });
      setListData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load pipeline records.');
    } finally {
      setLoading(false);
    }
  }, [
    assigneeFilter,
    countryFilter,
    fromDate,
    kindFilter,
    page,
    search,
    sourceFilter,
    statusFilter,
    toDate,
  ]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const openDetail = async (item: PlatformLeadItem) => {
    setSelectedRow({ kind: item.kind, id: item.id });
    setDetailLoading(true);
    setSaveFeedback(null);
    try {
      const res = await getPlatformLeadDetail(item.kind, item.id);
      setDetail(res);
      setEditStatus(res.status);
      setEditAssigneeId(res.assigneeUserId ?? '');
      setEditNotes(res.notes ?? '');
      setNoteAppend('');
      setAuditReason('');
    } catch (err: any) {
      setError(err?.message || 'Unable to load record details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveDetail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !canEdit) return;
    setSaving(true);
    setSaveFeedback(null);
    try {
      const updated = await updatePlatformLead(detail.kind, detail.id, {
        status: editStatus,
        assigneeUserId: editAssigneeId || '',
        ...(noteAppend.trim() ? { noteAppend: noteAppend.trim() } : { notes: editNotes }),
        reason: auditReason.trim() || undefined,
      });
      setDetail(updated);
      setEditStatus(updated.status);
      setEditAssigneeId(updated.assigneeUserId ?? '');
      setEditNotes(updated.notes ?? '');
      setNoteAppend('');
      setAuditReason('');
      setSaveFeedback('Changes saved and logged to Platform Audit Logs.');
      void fetchList();
    } catch (err: any) {
      setSaveFeedback(err?.message || 'Failed to update record.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await downloadPlatformLeadsCsv({
        kind: kindFilter,
        status: statusFilter,
        country: countryFilter,
        source: sourceFilter,
        assigneeUserId: assigneeFilter,
        from: fromDate || undefined,
        to: toDate || undefined,
        search,
      });
    } catch (err: any) {
      setError(err?.message || 'CSV export failed.');
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setKindFilter(defaultKind);
    setStatusFilter('all');
    setCountryFilter('all');
    setSourceFilter('all');
    setAssigneeFilter('all');
    setFromDate('');
    setToDate('');
    setSearch('');
    setPage(1);
  };

  const items = listData?.items ?? [];
  const staffList: PlatformLeadStaffOption[] = listData?.staff ?? [];
  const counts = listData?.countsByStatus ?? { new: 0, contacted: 0, qualified: 0, closed: 0 };

  return (
    <div className="space-y-6" data-testid={isDemoMode ? 'platform-demo-requests-page' : 'platform-leads-page'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sales &amp; Website Pipeline</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
            {isDemoMode ? 'Demo Requests' : 'Leads & Contact Inquiries'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isDemoMode
              ? 'Public walkthrough requests captured from the marketing site, ready for qualification and scheduling.'
              : 'Commercial sales leads and contact messages captured across the public website with attribution tracking.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void fetchList()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleExportCsv()}
            disabled={exporting}
            data-testid="leads-export-csv"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-amber-400 disabled:opacity-60 transition"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {(['new', 'contacted', 'qualified', 'closed'] as LeadStatus[]).map((st) => {
          const meta = STATUS_META[st];
          const active = statusFilter === st;
          return (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStatusFilter(active ? 'all' : st);
                setPage(1);
              }}
              className={`text-left rounded-xl border border-slate-200 dark:border-slate-800 border-l-4 ${meta.cardBorder} bg-white dark:bg-slate-900 p-4 transition hover:shadow-sm ${
                active ? 'ring-2 ring-amber-500/40' : ''
              }`}
            >
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {meta.label}
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
                {counts[st] ?? 0}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Filter className="w-3.5 h-3.5 text-amber-500" />
            <span>Filter Pipeline</span>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            Reset filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search company, name, or work email..."
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Status */}
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as LeadStatus | 'all');
              setPage(1);
            }}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            <option value="all">All statuses</option>
            {(['new', 'contacted', 'qualified', 'closed'] as LeadStatus[]).map((st) => (
              <option key={st} value={st}>
                {STATUS_META[st].label}
              </option>
            ))}
          </select>

          {/* Country */}
          <select
            aria-label="Filter by country"
            value={countryFilter}
            onChange={(e) => {
              setCountryFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            <option value="all">All countries</option>
            {(listData?.filters.countries ?? []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Source */}
          <select
            aria-label="Filter by source"
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            <option value="all">All sources</option>
            {(listData?.filters.sources ?? []).map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>

          {/* Assignee */}
          <select
            aria-label="Filter by assignee"
            value={assigneeFilter}
            onChange={(e) => {
              setAssigneeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            <option value="all">All assignees</option>
            <option value="unassigned">Unassigned</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range & Type Sub-Filter */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {!isDemoMode && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500">Type:</span>
              <select
                aria-label="Filter record kind"
                value={kindFilter}
                onChange={(e) => {
                  setKindFilter(
                    e.target.value as PlatformLeadRecordKind | 'leads_and_contacts',
                  );
                  setPage(1);
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="leads_and_contacts">Sales Leads &amp; Contact Messages</option>
                <option value="lead">Sales Leads only</option>
                <option value="contact">Contact Messages only</option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <label htmlFor="leads-from-date" className="text-[11px] font-medium text-slate-500">
              From:
            </label>
            <input
              id="leads-from-date"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="leads-to-date" className="text-[11px] font-medium text-slate-500">
              To:
            </label>
            <input
              id="leads-to-date"
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4 text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Company &amp; Contact</th>
                <th className="py-3 px-4">Country / Size</th>
                <th className="py-3 px-4">Source / UTM</th>
                <th className="py-3 px-4">Assignee</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading records...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No matching records found for the current filters.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const st = STATUS_META[item.status] ?? STATUS_META.new;
                  const isSelected =
                    selectedRow?.id === item.id && selectedRow?.kind === item.kind;
                  return (
                    <tr
                      key={`${item.kind}-${item.id}`}
                      onClick={() => void openDetail(item)}
                      data-testid={`lead-row-${item.id}`}
                      className={`cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                        isSelected ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{item.company || item.name}</span>
                          {!isDemoMode && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                              {item.topic ? `${KIND_LABELS[item.kind]} · ${item.topic}` : KIND_LABELS[item.kind]}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.name} · {item.workEmail}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        <div>{item.country || '—'}</div>
                        <div className="text-[11px] text-slate-400">
                          {item.employeeCountBand || 'Unspecified'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        <div className="font-mono text-[11px]">{item.sourcePage || '—'}</div>
                        {(item.utmSource || item.utmCampaign) && (
                          <div className="text-[11px] text-amber-600 dark:text-amber-400">
                            {[item.utmSource, item.utmCampaign].filter(Boolean).join(' / ')}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {item.assigneeName || (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${st.badgeClass}`}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDateTime(item.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {listData && listData.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            <span>
              Page {listData.page} of {listData.totalPages} ({listData.total} records)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= listData.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Slide-Over Drawer */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs">
          <div
            data-testid="lead-detail-drawer"
            className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full overflow-y-auto shadow-2xl border-l border-slate-200 dark:border-slate-800 p-6 space-y-6"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {detail ? KIND_LABELS[detail.kind] : 'Record Detail'}
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {detail?.company || detail?.name || 'Loading...'}
                </h2>
                {detail && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {detail.name} · {detail.workEmail}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Close detail drawer"
                onClick={() => {
                  setSelectedRow(null);
                  setDetail(null);
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading || !detail ? (
              <div className="py-12 text-center text-sm text-slate-400">Loading details...</div>
            ) : (
              <div className="space-y-6">
                {/* Summary Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-1">
                    <div className="text-slate-400 flex items-center gap-1">
                      <Globe2 className="w-3.5 h-3.5" /> Country
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {detail.country || '—'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-1">
                    <div className="text-slate-400 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> Team Size
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {detail.employeeCountBand || '—'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-1">
                    <div className="text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Submitted
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {formatDateTime(detail.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Inquiry Message */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-2">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                    <span>Inquiry Details {detail.topic ? `(${detail.topic})` : ''}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {detail.message || 'No additional notes submitted.'}
                  </p>
                </div>

                {/* Attribution & Privacy Consent */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 text-xs">
                  <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5 text-amber-500" />
                    <span>Source &amp; Attribution</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                    <div>
                      Source Page: <span className="font-mono">{detail.sourcePage || '—'}</span>
                    </div>
                    <div>
                      UTM Source: <span className="font-mono">{detail.utmSource || '—'}</span>
                    </div>
                    <div>
                      UTM Medium: <span className="font-mono">{detail.utmMedium || '—'}</span>
                    </div>
                    <div>
                      UTM Campaign: <span className="font-mono">{detail.utmCampaign || '—'}</span>
                    </div>
                    <div>
                      Privacy Consent: <strong>{detail.privacyConsent ? 'Yes' : 'No'}</strong>
                    </div>
                    <div>
                      Marketing Consent: <strong>{detail.marketingConsent ? 'Yes' : 'No'}</strong>
                    </div>
                  </div>
                </div>

                {/* Workflow Form: Status, Staff Assignment & Notes */}
                <form
                  onSubmit={handleSaveDetail}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-amber-500" />
                      Pipeline Management
                    </h3>
                    {saveFeedback && (
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {saveFeedback}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label
                        htmlFor="detail-status"
                        className="block text-xs font-semibold text-slate-600 dark:text-slate-300"
                      >
                        Status
                      </label>
                      <select
                        id="detail-status"
                        disabled={!canEdit}
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as LeadStatus)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      >
                        {(['new', 'contacted', 'qualified', 'closed'] as LeadStatus[]).map(
                          (st) => (
                            <option key={st} value={st}>
                              {STATUS_META[st].label}
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="detail-assignee"
                        className="block text-xs font-semibold text-slate-600 dark:text-slate-300"
                      >
                        Assign to Staff
                      </label>
                      <select
                        id="detail-assignee"
                        disabled={!canEdit}
                        value={editAssigneeId}
                        onChange={(e) => setEditAssigneeId(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      >
                        <option value="">Unassigned</option>
                        {staffList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.firstName} {s.lastName} ({s.roleName})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="detail-audit-reason"
                      className="block text-xs font-semibold text-slate-600 dark:text-slate-300"
                    >
                      Status / Assignment Audit Note (optional)
                    </label>
                    <input
                      id="detail-audit-reason"
                      type="text"
                      disabled={!canEdit}
                      value={auditReason}
                      onChange={(e) => setAuditReason(e.target.value)}
                      placeholder="e.g. Verified headcount and scheduled intro walkthrough"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="detail-note-append"
                      className="block text-xs font-semibold text-slate-600 dark:text-slate-300"
                    >
                      Add Timestamped Call / Follow-Up Note
                    </label>
                    <textarea
                      id="detail-note-append"
                      rows={2}
                      disabled={!canEdit}
                      value={noteAppend}
                      onChange={(e) => setNoteAppend(e.target.value)}
                      placeholder="Log discovery notes, next steps, or follow-up summary..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="detail-notes"
                      className="block text-xs font-semibold text-slate-600 dark:text-slate-300"
                    >
                      Saved Notes Log
                    </label>
                    <textarea
                      id="detail-notes"
                      rows={4}
                      disabled={!canEdit}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Internal staff notes appear here..."
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  {canEdit && (
                    <div className="flex items-center justify-end gap-3">
                      <a
                        href={`mailto:${detail.workEmail}`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Email Contact
                      </a>
                      <button
                        type="submit"
                        disabled={saving}
                        data-testid="lead-save-button"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold disabled:opacity-60 transition"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  )}
                </form>

                {/* Activity Timeline */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-amber-500" />
                    Activity &amp; Audit History
                  </h3>
                  {detail.activity.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      No audit activity recorded yet for this item.
                    </p>
                  ) : (
                    <ul className="space-y-2.5" data-testid="lead-activity-list">
                      {detail.activity.map((entry) => {
                        const oldStatus = entry.oldValue?.status as string | undefined;
                        const newStatus = entry.newValue?.status as string | undefined;
                        return (
                          <li
                            key={entry.id}
                            className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                {entry.action}
                              </span>
                              <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDateTime(entry.createdAt)}
                              </span>
                            </div>
                            {entry.reason && (
                              <p className="text-slate-600 dark:text-slate-300">{entry.reason}</p>
                            )}
                            {oldStatus && newStatus && oldStatus !== newStatus && (
                              <div className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                Status: {oldStatus} &rarr; {newStatus}
                              </div>
                            )}
                            <div className="text-[11px] text-slate-400">
                              Actor: {entry.actorName || entry.actorEmail || 'Public Website'}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
