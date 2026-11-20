import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileClock,
  KeyRound,
  LogOut,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type {
  SupportAccessMode,
  SupportAccessStatus,
  SupportSessionListItem,
  SupportSessionStats,
} from '@hrm/shared-types';
import {
  fetchSupportSessions,
  fetchSupportStats,
  issueSupportSessionTokenDirect,
  revokeSupportSessionDirect,
} from '@/lib/api-client';

export function SupportSessionsLogPage() {
  const [sessions, setSessions] = useState<SupportSessionListItem[]>([]);
  const [stats, setStats] = useState<SupportSessionStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<SupportAccessStatus | 'all'>('all');
  const [modeFilter, setModeFilter] = useState<SupportAccessMode | 'all'>('all');
  const [sortOption, setSortOption] = useState<string>('newest');

  // Modals & Action States
  const [inspectingSession, setInspectingSession] = useState<SupportSessionListItem | null>(null);
  const [revokingSession, setRevokingSession] = useState<SupportSessionListItem | null>(null);
  const [revokeReason, setRevokeReason] = useState<string>('');
  const [isRevoking, setIsRevoking] = useState<boolean>(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

  // Load metrics stats
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await fetchSupportStats();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load support stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Load sessions list
  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let sortBy: 'createdAt' | 'expiresAt' | 'durationMinutes' | 'actionsCount' = 'createdAt';
      let sortDir: 'asc' | 'desc' = 'desc';

      if (sortOption === 'oldest') {
        sortBy = 'createdAt';
        sortDir = 'asc';
      } else if (sortOption === 'actions_desc') {
        sortBy = 'actionsCount';
        sortDir = 'desc';
      } else if (sortOption === 'duration_desc') {
        sortBy = 'durationMinutes';
        sortDir = 'desc';
      } else if (sortOption === 'expires_desc') {
        sortBy = 'expiresAt';
        sortDir = 'desc';
      }

      const res = await fetchSupportSessions({
        page,
        limit,
        search: search.trim() || undefined,
        status: statusFilter,
        accessMode: modeFilter,
        sortBy,
        sortDir,
      });

      setSessions(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err?.message || 'Failed to load support sessions log');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter, modeFilter, sortOption]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Handle Search input with reset to page 1
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  // Launch admin impersonation session in new tab
  const handleLaunchSession = async (session: SupportSessionListItem) => {
    setLaunchingId(session.id);
    setLaunchError(null);
    try {
      const res = await issueSupportSessionTokenDirect(session.id);
      const adminPort = '5173';
      const adminUrl = `${window.location.protocol}//${window.location.hostname}:${adminPort}/?support_token=${encodeURIComponent(
        res.accessToken,
      )}`;
      window.open(adminUrl, '_blank');
      // Refresh list to update any actions/status
      loadSessions();
    } catch (err: any) {
      setLaunchError(`Failed to launch session: ${err?.message || 'Token generation failed'}`);
    } finally {
      setLaunchingId(null);
    }
  };

  // Confirm Revoke
  const handleConfirmRevoke = async () => {
    if (!revokingSession) return;
    if (revokeReason.trim().length < 10) {
      setRevokeError('Revocation reason must be at least 10 characters.');
      return;
    }

    setIsRevoking(true);
    setRevokeError(null);
    try {
      await revokeSupportSessionDirect(revokingSession.id, revokeReason.trim());
      setRevokingSession(null);
      setRevokeReason('');
      await Promise.all([loadSessions(), loadStats()]);
    } catch (err: any) {
      setRevokeError(err?.message || 'Failed to revoke support session');
    } finally {
      setIsRevoking(false);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    if (!sessions.length) return;
    const headers = [
      'Session ID',
      'Staff Name',
      'Staff Email',
      'Platform Role',
      'Tenant Name',
      'Tenant Subdomain',
      'Status',
      'Access Mode',
      'Duration (Min)',
      'Actions Taken',
      'Auto Approved',
      'Reason',
      'Created At',
      'Expires At',
      'Revoked At',
      'Revoke Reason',
    ];

    const rows = sessions.map((s) => [
      `"${s.id}"`,
      `"${(s.staffName || '').replace(/"/g, '""')}"`,
      `"${s.staffEmail || ''}"`,
      `"${s.platformUserRoleName || ''}"`,
      `"${(s.tenantName || '').replace(/"/g, '""')}"`,
      `"${s.tenantSubdomain || ''}"`,
      `"${s.status}"`,
      `"${s.accessMode}"`,
      s.durationMinutes,
      s.actionsCount,
      s.autoApproved ? 'Yes' : 'No',
      `"${(s.reason || '').replace(/"/g, '""')}"`,
      `"${s.createdAt}"`,
      `"${s.expiresAt || ''}"`,
      `"${s.revokedAt || ''}"`,
      `"${(s.revokedReason || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `support-sessions-log-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format date helper
  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  // Status badge renderer
  const renderStatusBadge = (session: SupportSessionListItem) => {
    const isActuallyExpired =
      session.status === 'approved' &&
      session.expiresAt &&
      new Date(session.expiresAt).getTime() < Date.now();

    const effectiveStatus = isActuallyExpired ? 'expired' : session.status;

    switch (effectiveStatus) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Active Session
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="h-3 w-3" />
            Pending Approval
          </span>
        );
      case 'revoked':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <LogOut className="h-3 w-3" />
            Revoked
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
            <X className="h-3 w-3" />
            Rejected
          </span>
        );
      case 'expired':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <Clock className="h-3 w-3" />
            Expired
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-900 dark:text-slate-100">
      {/* 1. Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 mb-1 tracking-wider uppercase">
            <ShieldCheck className="h-4 w-4" />
            Dual-Audited Impersonation Trail
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Support Sessions Log</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Complete cryptographic audit trail of all platform staff impersonation sessions across
            tenant workspaces. Every action is dual-logged to both platform and tenant logs with
            zero financial mutability.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-slate-800 border border-slate-700 text-xs font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Dual-Audit Active</span>
            <span className="text-slate-400">·</span>
            <span className="font-mono text-[11px] text-amber-300">Max 4h Limit</span>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={sessions.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              loadSessions();
              loadStats();
            }}
            disabled={loading}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition disabled:opacity-50"
            title="Refresh logs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Operational Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Sessions */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Grants</span>
            <FileClock className="h-4 w-4" />
          </div>
          <div className="text-2xl font-extrabold">
            {statsLoading ? '—' : stats?.totalSessions ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Historical requests</div>
        </div>

        {/* Active Sessions */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Live Active</span>
            <Activity className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <span>{statsLoading ? '—' : stats?.activeSessions ?? 0}</span>
            {stats && stats.activeSessions > 0 && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Impersonations active</div>
        </div>

        {/* Actions Taken */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Actions Taken</span>
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {statsLoading ? '—' : stats?.totalActionsTaken ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Audited API actions</div>
        </div>

        {/* Preauthorized */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Pre-authorised</span>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold">
            {statsLoading ? '—' : stats?.preauthorizedCount ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Zero-wait access</div>
        </div>

        {/* Read-Write Sessions */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Read-Write</span>
            <KeyRound className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-extrabold">
            {statsLoading ? '—' : stats?.readWriteCount ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Explicit write grants</div>
        </div>

        {/* Average Duration */}
        <div className="rounded-2xl border p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Avg Duration</span>
            <Clock className="h-4 w-4" />
          </div>
          <div className="text-2xl font-extrabold">
            {statsLoading ? '—' : `${stats?.avgDurationMinutes ?? 0}m`}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Per session average</div>
        </div>
      </div>

      {/* 3. Toolbar & Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search staff, tenant, reason..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Active / Approved</option>
              <option value="pending">Pending Approval</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
              <option value="rejected">Rejected</option>
            </select>

            {/* Mode Filter */}
            <select
              value={modeFilter}
              onChange={(e) => {
                setModeFilter(e.target.value as any);
                setPage(1);
              }}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">All Modes</option>
              <option value="read_only">Read-Only</option>
              <option value="read_write">Read-Write</option>
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortOption}
              onChange={(e) => {
                setSortOption(e.target.value);
                setPage(1);
              }}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="actions_desc">Sort: Most Actions</option>
              <option value="duration_desc">Sort: Longest Duration</option>
              <option value="expires_desc">Sort: Expiration Window</option>
            </select>
          </div>
        </div>
      </div>

      {/* Launch Error Banner if any */}
      {launchError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between text-xs text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{launchError}</span>
          </div>
          <button
            type="button"
            onClick={() => setLaunchError(null)}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/60 rounded"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 4. Table Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Who (Staff Engineer)</th>
                <th className="px-4 py-3">Which Tenant</th>
                <th className="px-4 py-3">Reason / Context</th>
                <th className="px-4 py-3">Duration & Mode</th>
                <th className="px-4 py-3 text-center">Actions Taken</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Window</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
                      <span>Loading support sessions log...</span>
                    </div>
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldAlert className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold text-slate-600 dark:text-slate-300 text-sm">
                        No support sessions found
                      </p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        {search || statusFilter !== 'all' || modeFilter !== 'all'
                          ? 'No session matches your active search and filter criteria.'
                          : 'No staff impersonation sessions have been requested yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                sessions.map((session) => {
                  const isActive =
                    session.status === 'approved' &&
                    session.expiresAt &&
                    new Date(session.expiresAt).getTime() > Date.now();

                  return (
                    <tr
                      key={session.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Who */}
                      <td className="px-4 py-3 font-medium">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {session.staffName}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {session.staffEmail}
                          </span>
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                            {session.platformUserRoleName || 'Platform Operator'}
                          </span>
                        </div>
                      </td>

                      {/* Which Tenant */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                            {session.tenantName}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {session.tenantSubdomain}.cmsnbd.com
                          </span>
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="px-4 py-3 max-w-xs">
                        <p
                          className="text-slate-600 dark:text-slate-300 truncate cursor-pointer hover:underline"
                          title={session.reason}
                          onClick={() => setInspectingSession(session)}
                        >
                          {session.reason}
                        </p>
                        {session.revokedReason && (
                          <p className="text-[10px] text-rose-500 truncate mt-0.5">
                            Revocation: {session.revokedReason}
                          </p>
                        )}
                      </td>

                      {/* Duration & Mode */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span>{session.durationMinutes} min</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-tight ${
                                session.accessMode === 'read_write'
                                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {session.accessMode === 'read_write' ? 'Read-Write' : 'Read-Only'}
                            </span>
                            {session.autoApproved && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                Pre-auth
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Actions Taken Count */}
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                              session.actionsCount > 0
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                            }`}
                            title={`${session.actionsCount} actions audited in tenant & platform logs`}
                          >
                            {session.actionsCount}{' '}
                            {session.actionsCount === 1 ? 'action' : 'actions'}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">{renderStatusBadge(session)}</td>

                      {/* Timestamps */}
                      <td className="px-4 py-3 text-[11px] text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">
                        <div>Created: {formatDate(session.createdAt)}</div>
                        {session.expiresAt && <div>Expires: {formatDate(session.expiresAt)}</div>}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Launch button if active */}
                          {isActive && (
                            <button
                              type="button"
                              onClick={() => handleLaunchSession(session)}
                              disabled={launchingId === session.id}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm flex items-center gap-1 transition disabled:opacity-50"
                              title="Launch Impersonation Session in Admin portal"
                            >
                              {launchingId === session.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <ExternalLink className="h-3 w-3" />
                              )}
                              <span>Launch</span>
                            </button>
                          )}

                          {/* Revoke button if active */}
                          {isActive && (
                            <button
                              type="button"
                              onClick={() => {
                                setRevokingSession(session);
                                setRevokeReason('');
                                setRevokeError(null);
                              }}
                              className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-semibold text-[11px] transition"
                              title="Revoke active impersonation session immediately"
                            >
                              Revoke
                            </button>
                          )}

                          {/* Inspect button */}
                          <button
                            type="button"
                            onClick={() => setInspectingSession(session)}
                            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
                            title="Inspect detailed session audit metadata"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing{' '}
            <strong className="text-slate-800 dark:text-slate-200">
              {sessions.length > 0 ? (page - 1) * limit + 1 : 0}
            </strong>{' '}
            to{' '}
            <strong className="text-slate-800 dark:text-slate-200">
              {Math.min(page * limit, total)}
            </strong>{' '}
            of <strong className="text-slate-800 dark:text-slate-200">{total}</strong> sessions
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1 || loading}
              className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition"
              aria-label="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 font-mono text-[11px]">
              Page {page} of {totalPages || 1}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages || loading}
              className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition"
              aria-label="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 6. Revocation Modal */}
      {revokingSession && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
                <AlertOctagon className="h-5 w-5" />
                <h3 className="text-base">Revoke Support Session</h3>
              </div>
              <button
                type="button"
                onClick={() => setRevokingSession(null)}
                disabled={isRevoking}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                You are about to terminate the active support access session for engineer{' '}
                <strong className="text-slate-900 dark:text-white">
                  {revokingSession.staffName}
                </strong>{' '}
                on tenant{' '}
                <strong className="text-slate-900 dark:text-white">
                  {revokingSession.tenantName}
                </strong>
                .
              </p>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Mandatory Revocation Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="State the justification for early termination (min 10 characters)..."
                  rows={3}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>Minimum 10 characters required</span>
                  <span
                    className={
                      revokeReason.trim().length >= 10
                        ? 'text-emerald-500 font-bold'
                        : 'text-slate-400'
                    }
                  >
                    {revokeReason.trim().length}/10
                  </span>
                </div>
              </div>

              {revokeError && (
                <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{revokeError}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRevokingSession(null)}
                disabled={isRevoking}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={isRevoking || revokeReason.trim().length < 10}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isRevoking ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Revoking...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Revoke Access</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Detailed Audit Metadata Inspector Modal */}
      {inspectingSession && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileClock className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold">Support Session Audit Record</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingSession(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Top metadata grid */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Request ID
                  </span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 break-all">
                    {inspectingSession.id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Tenant ID
                  </span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 break-all">
                    {inspectingSession.tenantId}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Staff Engineer
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {inspectingSession.staffName} ({inspectingSession.staffEmail})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Tenant Workspace
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {inspectingSession.tenantName} ({inspectingSession.tenantSubdomain}.cmsnbd.com)
                  </span>
                </div>
              </div>

              {/* Justification Box */}
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">
                  Access Justification (Reason)
                </span>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                  {inspectingSession.reason}
                </div>
              </div>

              {/* Status & Timing */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Duration
                  </span>
                  <span className="font-bold">{inspectingSession.durationMinutes} Minutes</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Mode</span>
                  <span className="font-bold uppercase tracking-tight">
                    {inspectingSession.accessMode}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Audited Actions
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {inspectingSession.actionsCount} Operations
                  </span>
                </div>
              </div>

              {/* Security & Audit Verification */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400 mb-1">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Immutable Dual-Audit Guarantees</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                  <li>Token is signed with HMAC-SHA256 and expires strictly after duration limit.</li>
                  <li>
                    Payroll calculations, batch runs, and direct payment exports are hard-blocked.
                  </li>
                  <li>Bank account details and sensitive tax IDs are redacted.</li>
                  <li>
                    Every API request creates matching entries in tenant's audit_logs and platform_audit_logs.
                  </li>
                </ul>
              </div>

              {/* Token JTI & timestamps */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 font-mono text-[11px] space-y-1 text-slate-600 dark:text-slate-400">
                <div>Created: {inspectingSession.createdAt}</div>
                <div>Approved: {inspectingSession.approvedAt || '—'}</div>
                <div>Expires: {inspectingSession.expiresAt || '—'}</div>
                {inspectingSession.revokedAt && (
                  <div className="text-rose-500">
                    Revoked: {inspectingSession.revokedAt} ({inspectingSession.revokedReason})
                  </div>
                )}
                {inspectingSession.tokenJti && (
                  <div>Token JTI: {inspectingSession.tokenJti}</div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingSession(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
