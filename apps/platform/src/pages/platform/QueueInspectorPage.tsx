// apps/platform/src/pages/platform/QueueInspectorPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  Eye,
  FileCode,
  Filter,
  History,
  Layers,
  Play,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Terminal,
  Trash2,
  Workflow,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  BullMqJobItem,
  BullMqQueueSummary,
  JobState,
  QueueSystemOverview,
} from '@hrm/shared-types';
import {
  cleanQueue,
  getJobDetails,
  getQueueJobs,
  getQueueOverview,
  removeJob,
  retryJob,
  retryQueueFailed,
} from '@/lib/platform-queues-api';

export function QueueInspectorPage() {
  const [overview, setOverview] = useState<QueueSystemOverview | null>(null);
  const [jobs, setJobs] = useState<BullMqJobItem[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [selectedQueue, setSelectedQueue] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<JobState | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [prominentFilter, setProminentFilter] = useState<'all' | 'prominent'>('all');

  // Selected job for detail modal
  const [activeJobDetails, setActiveJobDetails] = useState<BullMqJobItem | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedStack, setCopiedStack] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Deletion modal state
  const [deleteModalJob, setDeleteModalJob] = useState<BullMqJobItem | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Load Overview & Jobs
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const [ov, jobRes] = await Promise.all([
        getQueueOverview(),
        getQueueJobs({
          queueName: selectedQueue === 'all' ? undefined : selectedQueue,
          state: selectedState,
          search: searchQuery,
          prominentOnly: prominentFilter === 'prominent',
          limit: 50,
        }),
      ]);

      setOverview(ov);
      setJobs(jobRes.items);
      setTotalJobs(jobRes.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load BullMQ queue information.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedQueue, selectedState, prominentFilter]);

  // Handle Search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // Copy to clipboard helper
  const handleCopy = (text: string, type: 'id' | 'stack' | 'payload') => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    } else if (type === 'stack') {
      setCopiedStack(true);
      setTimeout(() => setCopiedStack(false), 2000);
    } else {
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    }
  };

  // Open details modal
  const handleOpenDetails = async (job: BullMqJobItem) => {
    try {
      const fullDetails = await getJobDetails(job.queueName, job.id);
      setActiveJobDetails(fullDetails);
      setDetailModalOpen(true);
    } catch (err: any) {
      setError(`Failed to fetch job details: ${err.message}`);
    }
  };

  // Retry single job
  const handleRetryJob = async (job: BullMqJobItem) => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await retryJob(job.queueName, job.id);
      setSuccessMessage(res.message);
      if (detailModalOpen && activeJobDetails?.id === job.id) {
        setActiveJobDetails({ ...activeJobDetails, state: 'waiting', failedReason: null });
      }
      await loadData(true);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to retry job.');
    } finally {
      setActionLoading(false);
    }
  };

  // Retry all failed jobs in current queue
  const handleRetryAllFailed = async (queueName: string) => {
    if (!confirm(`Are you sure you want to re-queue all failed jobs in "${queueName}"?`)) {
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const res = await retryQueueFailed(queueName);
      setSuccessMessage(res.message);
      await loadData(true);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to retry failed jobs in queue.');
    } finally {
      setActionLoading(false);
    }
  };

  // Prompt delete job modal
  const handlePromptDelete = (job: BullMqJobItem) => {
    setDeleteModalJob(job);
    setDeleteReason('');
    setDeleteError(null);
  };

  // Confirm delete job
  const handleConfirmDelete = async () => {
    if (!deleteModalJob) return;

    if (deleteModalJob.isPayroll && deleteReason.trim().length < 5) {
      setDeleteError('A typed justification reason of at least 5 characters is required to delete a payroll job.');
      return;
    }

    setActionLoading(true);
    setDeleteError(null);

    try {
      const res = await removeJob(deleteModalJob.queueName, deleteModalJob.id, {
        reason: deleteReason.trim(),
      });
      setSuccessMessage(res.message);
      setDeleteModalJob(null);
      if (detailModalOpen && activeJobDetails?.id === deleteModalJob.id) {
        setDetailModalOpen(false);
      }
      await loadData(true);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to remove job from queue.');
    } finally {
      setActionLoading(false);
    }
  };

  // Prominent Queues (Payroll & Sync)
  const prominentQueues = useMemo(() => {
    return overview?.queues.filter((q) => q.isProminent) || [];
  }, [overview]);

  // Helper for status badge styling conforming to DESIGN_SYSTEM.md §5
  const getStateBadge = (state: JobState) => {
    switch (state) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Completed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            Failed
          </span>
        );
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-spin" />
            Active
          </span>
        );
      case 'waiting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Waiting
          </span>
        );
      case 'delayed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Delayed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            {state}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            <span>Platform</span>
            <span>/</span>
            <span>Infrastructure & Jobs</span>
            <span>/</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold">Job Queue Inspector</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              BullMQ Job Queue Inspector
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
              <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Platform Admin & Owner Privileged
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Real-time telemetry, job states, error diagnostics, retries, and audited safe deletion for background queues.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadData()}
            disabled={loading || actionLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-sm transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary-500' : ''}`} />
            Refresh
          </button>
          <a
            href="#/system-health"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-sm transition"
          >
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            System Health
          </a>
        </div>
      </div>

      {/* Success & Error Banners */}
      {successMessage && (
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5 text-sm font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION 1: PROMINENT PAYROLL AND SYNC QUEUES */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <h2 className="text-sm font-bold tracking-wide uppercase text-slate-700 dark:text-slate-300">
              Prominent Subsystem Queues (Payroll & Sync)
            </h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              • High-priority operational workloads
            </span>
          </div>
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            Payroll Delete Safeguard Enforced
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {prominentQueues.map((q) => {
            const isSelected = selectedQueue === q.name;
            const hasFailed = q.counts.failed > 0;

            return (
              <div
                key={q.name}
                onClick={() => setSelectedQueue(q.name)}
                className={`relative cursor-pointer rounded-2xl p-5 border transition-all duration-200 ${
                  isSelected
                    ? 'bg-primary-50/40 dark:bg-primary-950/20 border-primary-500 shadow-md ring-1 ring-primary-500'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
                }`}
              >
                {/* Prominent header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        q.isPayroll
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      }`}
                    >
                      {q.isPayroll ? <DollarSign className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {q.displayName}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {q.name}
                      </span>
                    </div>
                  </div>

                  {q.isPayroll && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                      Payroll Rule
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">
                  {q.description}
                </p>

                {/* Counts breakdown */}
                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                  <div>
                    <span className="block text-xs text-slate-400 dark:text-slate-500">Active</span>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      {q.counts.active}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400 dark:text-slate-500">Waiting</span>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                      {q.counts.waiting}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400 dark:text-slate-500">Failed</span>
                    <span
                      className={`text-sm font-bold ${
                        hasFailed ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'
                      }`}
                    >
                      {q.counts.failed}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400 dark:text-slate-500">Completed</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {q.counts.completed}
                    </span>
                  </div>
                </div>

                {hasFailed && (
                  <div className="mt-3 pt-2.5 border-t border-rose-100 dark:border-rose-950 flex items-center justify-between text-xs text-rose-600 dark:text-rose-400">
                    <span className="flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {q.counts.failed} failed job(s)
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRetryAllFailed(q.name);
                      }}
                      className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-950/80 dark:hover:bg-rose-900 dark:text-rose-300 transition"
                    >
                      Retry Failed
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: QUEUE SELECTION & OVERVIEW METRICS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Workflow className="w-4 h-4 text-primary-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              All BullMQ Background Queues ({overview?.queues.length || 0})
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Filter view:</span>
            <button
              onClick={() => {
                setProminentFilter('all');
                setSelectedQueue('all');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                prominentFilter === 'all' && selectedQueue === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              All Queues
            </button>
            <button
              onClick={() => {
                setProminentFilter('prominent');
                setSelectedQueue('all');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                prominentFilter === 'prominent'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              ⭐ Prominent (Payroll & Sync)
            </button>
          </div>
        </div>

        {/* Horizontal Queue Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedQueue('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
              selectedQueue === 'all'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>All Queues</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 text-white">
              {overview?.activeJobsCount || 0} active
            </span>
          </button>

          {overview?.queues.map((q) => {
            const isSelected = selectedQueue === q.name;
            return (
              <button
                key={q.name}
                onClick={() => setSelectedQueue(q.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{q.displayName.split(' ')[0]}</span>
                {q.counts.failed > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500 text-white">
                    {q.counts.failed}
                  </span>
                )}
                {q.counts.active > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500 text-white">
                    {q.counts.active}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: JOB LISTING & CONTROLS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* State Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['all', 'failed', 'active', 'waiting', 'completed', 'delayed'] as const).map((st) => {
              const isSelected = selectedState === st;
              return (
                <button
                  key={st}
                  onClick={() => setSelectedState(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                    isSelected
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {st}
                </button>
              );
            })}
          </div>

          {/* Search Input & Actions */}
          <div className="flex items-center gap-2.5">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search job ID, tenant, error..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 w-60"
              />
            </form>

            {selectedQueue !== 'all' && (
              <button
                onClick={() => handleRetryAllFailed(selectedQueue)}
                disabled={actionLoading}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" />
                Retry Failed
              </button>
            )}
          </div>
        </div>

        {/* Jobs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Job ID</th>
                <th className="py-3 px-4">Queue & Type</th>
                <th className="py-3 px-4">Job Name & Payload</th>
                <th className="py-3 px-4">State</th>
                <th className="py-3 px-4">Attempts</th>
                <th className="py-3 px-4">Timing</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-500" />
                    Loading background jobs...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                    No background jobs found matching the current criteria.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const isPayroll = job.isPayroll;
                  const isSync = job.isSync;

                  return (
                    <tr
                      key={job.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition duration-150"
                    >
                      {/* Job ID */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{job.id}</span>
                          <button
                            onClick={() => handleCopy(job.id, 'id')}
                            title="Copy Job ID"
                            className="text-slate-400 hover:text-slate-600 transition"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          {copiedId === job.id && (
                            <span className="text-[10px] text-emerald-600 font-semibold">copied</span>
                          )}
                        </div>
                      </td>

                      {/* Queue & Type */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">
                            {job.queueName}
                          </span>
                          {isPayroll && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              💰 Payroll Engine
                            </span>
                          )}
                          {isSync && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              🔄 Attendance Sync
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Job Name & Payload */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">
                          {job.name}
                        </span>
                        {job.failedReason ? (
                          <p className="text-rose-600 dark:text-rose-400 text-[11px] line-clamp-2 font-mono">
                            {job.failedReason}
                          </p>
                        ) : (
                          <p className="text-slate-500 dark:text-slate-400 text-[11px] truncate font-mono">
                            {JSON.stringify(job.data)}
                          </p>
                        )}
                      </td>

                      {/* State */}
                      <td className="py-3.5 px-4">{getStateBadge(job.state)}</td>

                      {/* Attempts */}
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-medium">
                        {job.attemptsMade} / {job.maxAttempts}
                      </td>

                      {/* Timing */}
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                        <div className="flex flex-col">
                          <span>{new Date(job.timestamp).toLocaleTimeString()}</span>
                          {job.durationMs !== null && (
                            <span className="text-[10px] text-slate-400">
                              {job.durationMs > 1000 ? `${(job.durationMs / 1000).toFixed(1)}s` : `${job.durationMs}ms`}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDetails(job)}
                            title="Inspect Diagnostics & Error Stack"
                            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {(job.state === 'failed' || job.state === 'delayed') && (
                            <button
                              onClick={() => handleRetryJob(job)}
                              disabled={actionLoading}
                              title="Retry Job"
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => handlePromptDelete(job)}
                            disabled={actionLoading}
                            title={isPayroll ? 'Delete Payroll Job (Requires Typed Reason)' : 'Remove Job'}
                            className={`p-1.5 rounded-lg transition ${
                              isPayroll
                                ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

        {/* Footer info */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {jobs.length} of {totalJobs} jobs</span>
          <span className="font-mono text-[11px]">
            Redis Store: {overview?.redisConnected ? '🟢 Connected (ioredis)' : '🟡 Simulated Fallback'}
          </span>
        </div>
      </div>

      {/* MODAL 1: JOB DETAILS & DIAGNOSTICS */}
      {detailModalOpen && activeJobDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    activeJobDetails.isPayroll
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  }`}
                >
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Job Diagnostics: {activeJobDetails.name}</span>
                    {getStateBadge(activeJobDetails.state)}
                  </h3>
                  <span className="font-mono text-xs text-slate-500">
                    Queue: {activeJobDetails.queueName} • ID: {activeJobDetails.id}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* Failed Error Callout */}
              {activeJobDetails.failedReason && (
                <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      Failure Reason
                    </span>
                    <span className="text-[11px] font-mono">
                      Attempt {activeJobDetails.attemptsMade} of {activeJobDetails.maxAttempts}
                    </span>
                  </div>
                  <p className="font-mono text-xs">{activeJobDetails.failedReason}</p>
                </div>
              )}

              {/* Stacktrace if available */}
              {activeJobDetails.stacktrace && activeJobDetails.stacktrace.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 text-[11px] flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5" />
                      Stack Trace
                    </span>
                    <button
                      onClick={() => handleCopy(activeJobDetails.stacktrace.join('\n'), 'stack')}
                      className="text-xs text-primary-600 hover:underline flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedStack ? 'Copied' : 'Copy Stack'}
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-48 border border-slate-800">
                    {activeJobDetails.stacktrace.join('\n')}
                  </pre>
                </div>
              )}

              {/* Job Payload Data */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 text-[11px] flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5" />
                    Job Payload Data
                  </span>
                  <button
                    onClick={() => handleCopy(JSON.stringify(activeJobDetails.data, null, 2), 'payload')}
                    className="text-xs text-primary-600 hover:underline flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedPayload ? 'Copied' : 'Copy JSON'}
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-48 border border-slate-800">
                  {JSON.stringify(activeJobDetails.data, null, 2)}
                </pre>
              </div>

              {/* Timing & Meta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">Created At</span>
                  <span>{new Date(activeJobDetails.timestamp).toLocaleTimeString()}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">Processed At</span>
                  <span>
                    {activeJobDetails.processedOn
                      ? new Date(activeJobDetails.processedOn).toLocaleTimeString()
                      : 'Pending'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">Finished At</span>
                  <span>
                    {activeJobDetails.finishedOn
                      ? new Date(activeJobDetails.finishedOn).toLocaleTimeString()
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">Duration</span>
                  <span>
                    {activeJobDetails.durationMs ? `${activeJobDetails.durationMs}ms` : 'In progress'}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between">
              <button
                onClick={() => handlePromptDelete(activeJobDetails)}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove Job
              </button>

              <div className="flex items-center gap-2">
                {activeJobDetails.state === 'failed' && (
                  <button
                    onClick={() => handleRetryJob(activeJobDetails)}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white transition flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Job
                  </button>
                )}
                <button
                  onClick={() => setDetailModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DELETE CONFIRMATION WITH PAYROLL REASON GUARD */}
      {deleteModalJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    deleteModalJob.isPayroll
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {deleteModalJob.isPayroll ? 'Delete Payroll Job — Safety Check' : 'Remove Job from Queue'}
                  </h3>
                  <span className="font-mono text-[11px] text-slate-400">
                    {deleteModalJob.id} ({deleteModalJob.queueName})
                  </span>
                </div>
              </div>

              <button
                onClick={() => setDeleteModalJob(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 text-xs">
              {deleteModalJob.isPayroll ? (
                <div className="p-3.5 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px]">
                    <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>Payroll Integrity Protection</span>
                  </div>
                  <p className="leading-relaxed">
                    Deleting a payroll job removes calculations mid-cycle or purges finalized batches.
                    Per system financial safety rules, you <strong>must provide a typed justification reason</strong> (minimum 5 characters).
                    This action will be written to the <strong>Platform Audit Log</strong>.
                  </p>
                </div>
              ) : (
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Are you sure you want to permanently remove job <strong>{deleteModalJob.id}</strong> from queue{' '}
                  <strong>{deleteModalJob.queueName}</strong>?
                </p>
              )}

              {/* Typed reason field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    {deleteModalJob.isPayroll ? 'Justification Reason (Mandatory)*' : 'Audit Note (Optional)'}
                  </label>
                  {deleteModalJob.isPayroll && (
                    <span
                      className={`text-[11px] font-mono ${
                        deleteReason.trim().length >= 5
                          ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                          : 'text-rose-500'
                      }`}
                    >
                      {deleteReason.trim().length} / 5 chars minimum
                    </span>
                  )}
                </div>

                <textarea
                  rows={3}
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder={
                    deleteModalJob.isPayroll
                      ? 'e.g., Draft batch rerun requested due to statutory rate update on country GB'
                      : 'e.g., Stale webhook discarded after testing endpoint'
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 text-xs"
                />
              </div>

              {deleteError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                  {deleteError}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeleteModalJob(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={actionLoading || (deleteModalJob.isPayroll && deleteReason.trim().length < 5)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition flex items-center gap-1.5 ${
                  deleteModalJob.isPayroll && deleteReason.trim().length < 5
                    ? 'bg-rose-300 dark:bg-rose-900/40 cursor-not-allowed opacity-50'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-sm'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {actionLoading ? 'Removing...' : 'Confirm Permanent Removal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
