// apps/platform/src/pages/platform/PlatformAuditPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileClock,
  Filter,
  Layers,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  User,
  Users,
  X,
} from 'lucide-react';
import type {
  PlatformAuditFilterOptions,
  PlatformAuditLogItem,
  PlatformAuditLogQuery,
} from '@hrm/shared-types';
import { usePermissions } from '@/hooks/usePermission';
import {
  exportPlatformAuditCsv,
  getPlatformAuditFilterOptions,
  listPlatformAuditLogs,
} from '@/lib/platform-audit-api';
import { PlatformAuditDiffViewer } from '@/components/audit/PlatformAuditDiffViewer';

export function PlatformAuditPage() {
  const { user } = usePermissions();

  // Role Gate: Platform Owner, Platform Admin, and Read-Only Auditor
  const userRole = (user?.roleName || '').trim();
  const isAuthorized = useMemo(() => {
    if (
      userRole === 'Platform Owner' ||
      userRole === 'Platform Admin' ||
      userRole === 'Read-Only Auditor'
    ) {
      return true;
    }
    const perms = user?.permissions || [];
    return perms.some(
      (p) =>
        (p.module === 'audit' || p.module === 'platform') &&
        (p.action === 'view' || p.action === 'manage'),
    );
  }, [userRole, user?.permissions]);

  // Query & Filter State
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Data & Loading States
  const [logs, setLogs] = useState<PlatformAuditLogItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter options loaded from backend
  const [filterOptions, setFilterOptions] = useState<PlatformAuditFilterOptions>({
    staffMembers: [],
    tenants: [],
    modules: [],
    actions: [],
  });

  // Expanded row IDs for viewing diff
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Fetch filter dropdown options once
  useEffect(() => {
    if (!isAuthorized) return;
    let mounted = true;
    getPlatformAuditFilterOptions()
      .then((opts) => {
        if (mounted) setFilterOptions(opts);
      })
      .catch((err) => {
        console.warn('Could not load audit filter options:', err);
      });
    return () => {
      mounted = false;
    };
  }, [isAuthorized]);

  // Fetch audit logs
  const fetchLogs = async () => {
    if (!isAuthorized) return;
    setLoading(true);
    setError(null);
    try {
      const query: PlatformAuditLogQuery = {
        userId: selectedStaff || undefined,
        tenantId: selectedTenant || undefined,
        module: selectedModule || undefined,
        action: selectedAction || undefined,
        search: searchQuery.trim() || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        page,
        pageSize,
      };

      const res = await listPlatformAuditLogs(query);
      setLogs(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);

      // Auto-expand first item if none expanded
      if (res.items.length > 0 && expandedIds.size === 0) {
        setExpandedIds(new Set([res.items[0].id]));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch platform audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [
    isAuthorized,
    selectedStaff,
    selectedTenant,
    selectedModule,
    selectedAction,
    searchQuery,
    fromDate,
    toDate,
    page,
    pageSize,
  ]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const resetFilters = () => {
    setSelectedStaff('');
    setSelectedTenant('');
    setSelectedModule('');
    setSelectedAction('');
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const query: PlatformAuditLogQuery = {
        userId: selectedStaff || undefined,
        tenantId: selectedTenant || undefined,
        module: selectedModule || undefined,
        action: selectedAction || undefined,
        search: searchQuery.trim() || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      };

      const blob = await exportPlatformAuditCsv(query);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `platform-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  // Quick date presets
  const applyPreset = (preset: 'today' | '7d' | '30d') => {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date();
    if (preset === 'today') {
      setFromDate(end);
      setToDate(end);
    } else if (preset === '7d') {
      start.setDate(start.getDate() - 7);
      setFromDate(start.toISOString().slice(0, 10));
      setToDate(end);
    } else if (preset === '30d') {
      start.setDate(start.getDate() - 30);
      setFromDate(start.toISOString().slice(0, 10));
      setToDate(end);
    }
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    selectedStaff ||
      selectedTenant ||
      selectedModule ||
      selectedAction ||
      searchQuery ||
      fromDate ||
      toDate,
  );

  // Compute metric numbers
  const uniqueOperatorsCount = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.userEmail) set.add(l.userEmail);
    });
    return set.size;
  }, [logs]);

  const criticalActionsCount = useMemo(() => {
    return logs.filter(
      (l) =>
        l.action.includes('suspend') ||
        l.action.includes('reject') ||
        l.action.includes('deactivate') ||
        l.action.includes('delete') ||
        l.action.includes('isolation'),
    ).length;
  }, [logs]);

  // Color tone helpers for modules/actions
  const getActionTone = (action: string, module: string) => {
    const act = action.toLowerCase();
    const mod = module.toLowerCase();

    if (act.includes('suspend') || act.includes('reject') || act.includes('delete') || act.includes('deactivate')) {
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60';
    }
    if (mod === 'billing' || act.includes('plan') || act.includes('invoice')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/60';
    }
    if (mod === 'compliance' || act.includes('publish') || act.includes('rule')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60';
    }
    if (mod === 'support' || act.includes('support') || act.includes('session')) {
      return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900/60';
    }
    if (mod === 'settings' || mod === 'feature_flags' || mod === 'maintenance') {
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  };

  // If not authorized by role:
  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[460px] text-center p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm max-w-xl mx-auto my-12 animate-fade-in">
        <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Privileged Audit Access Restricted
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          Per <strong className="text-slate-700 dark:text-slate-300 font-mono text-xs">AUDIT_LOG.md §5</strong>, platform-level immutable audit records are strictly role-gated to{' '}
          <span className="font-semibold text-amber-600 dark:text-amber-400">Platform Owner</span>,{' '}
          <span className="font-semibold text-amber-600 dark:text-amber-400">Platform Admin</span>, and{' '}
          <span className="font-semibold text-amber-600 dark:text-amber-400">Read-Only Auditor</span>.
          Your current platform role is <span className="font-bold underline">{userRole || 'Operator'}</span>.
        </p>
        <div className="text-xs text-slate-400">
          Contact a Platform Owner to request security auditor clearance.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-slate-900 dark:text-slate-100">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1.5 uppercase tracking-wider">
            <FileClock className="h-4 w-4" /> IMMUTABLE PLATFORM AUDIT TRAIL
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Platform Audit Log</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Privileged cross-tenant operations with cryptographic timestamping, before-and-after evidence, and append-only enforcement.
          </p>
        </div>

        {/* Security & Integrity Status Pill */}
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 shrink-0 font-medium shadow-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span><strong>Append-Only Enforced:</strong> No edit or delete permitted · 365-day statutory retention</span>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Total Logged Events</span>
            <FileClock className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {total.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Authoritative audit ledger</div>
        </div>

        <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Active Staff Operators</span>
            <Users className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {filterOptions.staffMembers.length || uniqueOperatorsCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Verified privileged accounts</div>
        </div>

        <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Monitored Tenants</span>
            <Building2 className="h-4 w-4 text-cyan-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {filterOptions.tenants.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Isolated customer domains</div>
        </div>

        <div className="rounded-2xl border bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/60 p-4 shadow-sm">
          <div className="flex items-center justify-between text-red-500 mb-1">
            <span className="text-xs font-semibold">High-Impact Operations</span>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400">
            {criticalActionsCount}
          </div>
          <div className="text-[11px] text-red-500/80 mt-0.5">Suspensions, overrides & resets</div>
        </div>
      </div>

      {/* Main Filter & Action Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Staff Member Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Staff Member
            </label>
            <select
              value={selectedStaff}
              onChange={(e) => {
                setSelectedStaff(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="">All Staff Members</option>
              {filterOptions.staffMembers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.roleName})
                </option>
              ))}
            </select>
          </div>

          {/* Tenant Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Target Tenant
            </label>
            <select
              value={selectedTenant}
              onChange={(e) => {
                setSelectedTenant(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="">All Tenants (Include Platform-wide)</option>
              {filterOptions.tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.subdomain})
                </option>
              ))}
            </select>
          </div>

          {/* Module Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Platform Module
            </label>
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 capitalize"
            >
              <option value="">All Modules</option>
              {filterOptions.modules.map((m) => (
                <option key={m} value={m}>
                  {m.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Action Type
            </label>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="">All Actions</option>
              {filterOptions.actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Second Row: Date Range & Search & Actions */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Date Range Inputs & Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 text-xs font-medium flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Date:
            </span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none"
              title="From Date"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none"
              title="To Date"
            />

            {/* Presets */}
            <div className="flex items-center gap-1 ml-1">
              <button
                type="button"
                onClick={() => applyPreset('today')}
                className="px-2 py-1 text-[11px] rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium transition"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => applyPreset('7d')}
                className="px-2 py-1 text-[11px] rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium transition"
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => applyPreset('30d')}
                className="px-2 py-1 text-[11px] rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium transition"
              >
                30 Days
              </button>
            </div>
          </div>

          {/* Search Input & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search reason, actor, tenant, ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 transition"
                title="Reset all filters"
              >
                <X className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            )}

            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
              title="Refresh audit logs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {/* CSV Export Button */}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting}
              className="h-8 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchLogs}
            className="underline font-bold hover:text-red-700 ml-4"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Audit Log Entries List / Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Loading platform audit trail...
            </p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
              <FileClock className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No Audit Records Found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No privileged platform operations matched your active filter criteria. Try expanding the date range or clearing filters.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {logs.map((log) => {
              const isExpanded = expandedIds.has(log.id);
              const tone = getActionTone(log.action, log.module);

              return (
                <div key={log.id} className="transition hover:bg-slate-50/40 dark:hover:bg-slate-800/20">
                  {/* Row Header */}
                  <div
                    onClick={() => toggleExpand(log.id)}
                    className="p-4 cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                  >
                    {/* Left: Indicator, Action, Module, Timestamp */}
                    <div className="flex items-start lg:items-center gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        className="mt-0.5 lg:mt-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 transition"
                        title={isExpanded ? 'Collapse Diff' : 'View Diff'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-indigo-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>

                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Action Badge */}
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${tone}`}
                          >
                            {log.action}
                          </span>

                          {/* Module Badge */}
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                            {log.module}
                          </span>

                          {/* Tenant Target */}
                          {log.tenantName ? (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50 flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              <span>{log.tenantName}</span>
                              {log.tenantSubdomain && (
                                <span className="opacity-60 text-[10px]">({log.tenantSubdomain})</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">
                              [Platform Scope]
                            </span>
                          )}

                          <span className="text-slate-300 dark:text-slate-700">•</span>

                          {/* Timestamp */}
                          <span
                            className="text-xs text-slate-500 dark:text-slate-400 font-mono"
                            title={new Date(log.createdAt).toUTCString()}
                          >
                            {new Date(log.createdAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>

                        {/* Stated Reason / Description */}
                        {log.reason ? (
                          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate max-w-3xl">
                            {log.reason}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 italic">
                            No operator stated reason logged
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Operator Identity Badge */}
                    <div className="flex items-center gap-3 shrink-0 ml-7 lg:ml-0">
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {log.userName || 'System Service'}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1 font-mono">
                          <span>{log.userEmail || 'daemon'}</span>
                          {log.userRole && (
                            <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                              · {log.userRole}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300">
                        {log.userName
                          ? log.userName
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                          : 'SYS'}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Diff Area */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 animate-fade-in border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-950/20">
                      <PlatformAuditDiffViewer
                        oldValue={log.oldValue}
                        newValue={log.newValue}
                        reason={log.reason}
                        recordId={log.recordId}
                        ipAddress={log.ipAddress}
                        userAgent={log.userAgent}
                        createdAt={log.createdAt}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer & Pagination */}
        {logs.length > 0 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-slate-50/50 dark:bg-slate-900/50">
            <div className="text-slate-500 font-medium">
              Showing{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {(page - 1) * pageSize + 1}
              </strong>{' '}
              to{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {Math.min(page * pageSize, total)}
              </strong>{' '}
              of <strong className="text-slate-800 dark:text-slate-200">{total}</strong> total audit events
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-slate-500">
                <span>Page Size:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(parseInt(e.target.value, 10));
                    setPage(1);
                  }}
                  className="h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition"
                >
                  Previous
                </button>
                <span className="px-2 font-mono text-slate-700 dark:text-slate-300">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
