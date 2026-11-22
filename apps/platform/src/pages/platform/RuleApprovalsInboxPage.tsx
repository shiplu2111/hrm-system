import { useEffect, useMemo, useState } from 'react';
import type {
  PendingRuleVersionView,
  PublishRuleVersionInput,
  RuleVersionPayrollImpact,
} from '@hrm/shared-types';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCode2,
  FileText,
  Filter,
  GitCompare,
  History,
  Inbox,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import { usePlatformAuth } from '@/context/PlatformAuthContext';
import {
  getPendingRuleApprovals,
  getRuleVersionPayrollImpact,
  publishRuleVersion,
  rejectRuleVersion,
} from '@/lib/platform-countries-api';
import { BackdatedPayrollImpactModal } from '@/components/rules/BackdatedPayrollImpactModal';
import { RejectRuleVersionModal } from '@/components/rules/RejectRuleVersionModal';
import { RuleVersionStatusPill } from '@/components/rules/RuleVersionStatusPill';

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Rule Categories' },
  { value: 'tax', label: 'Tax & Brackets' },
  { value: 'social_security', label: 'Social Security' },
  { value: 'pension', label: 'Pension & Superannuation' },
  { value: 'leave', label: 'Statutory Leave' },
  { value: 'working_hours', label: 'Working Hours' },
  { value: 'ot', label: 'Overtime Multipliers & Caps' },
  { value: 'public_holiday', label: 'Public Holidays' },
  { value: 'employment_rules', label: 'Employment Standards' },
  { value: 'termination', label: 'Termination & Severance' },
];

export function RuleApprovalsInboxPage() {
  const { user } = usePlatformAuth();
  const [items, setItems] = useState<PendingRuleVersionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Active Actions
  const [selectedForReject, setSelectedForReject] = useState<PendingRuleVersionView | null>(null);
  const [selectedForBackdated, setSelectedForBackdated] = useState<{
    item: PendingRuleVersionView;
    impact: RuleVersionPayrollImpact;
  } | null>(null);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Expanded diff states (byId)
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});

  const loadApprovals = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPendingRuleApprovals();
      setItems(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch pending rule approvals inbox.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const toggleDiffExpand = (id: string) => {
    setExpandedDiffs((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Distinct countries present in items for filter dropdown
  const countryOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; flagEmoji: string }>();
    for (const item of items) {
      if (!map.has(item.countryId)) {
        map.set(item.countryId, {
          id: item.countryId,
          name: item.countryName,
          flagEmoji: item.flagEmoji,
        });
      }
    }
    return Array.from(map.values());
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCountry !== 'all' && item.countryId !== selectedCountry) return false;
      if (selectedCategory !== 'all' && item.ruleType !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchCountry = item.countryName.toLowerCase().includes(query);
        const matchCategory = item.ruleTypeLabel.toLowerCase().includes(query);
        const matchSource = item.sourceReference.toLowerCase().includes(query);
        const matchNote = item.changeNote.toLowerCase().includes(query);
        const matchSubmitter = (item.submittedByName || '').toLowerCase().includes(query);
        if (!matchCountry && !matchCategory && !matchSource && !matchNote && !matchSubmitter) {
          return false;
        }
      }
      return true;
    });
  }, [items, selectedCountry, selectedCategory, searchQuery]);

  // Approve & Publish action handler
  const handleApprove = async (item: PendingRuleVersionView) => {
    setError(null);
    setActionSuccessMsg(null);
    try {
      setActionInProgressId(item.id);

      // 1. If backdated, check payroll impact
      if (item.isBackdated) {
        const impact = await getRuleVersionPayrollImpact(item.countryId, item.id);
        if (impact.isBackdated && impact.affectedFinalizedPayrollRunsCount > 0) {
          setSelectedForBackdated({ item, impact });
          return;
        }
      }

      // 2. Publish standard
      if (!confirm(`Publish Version ${item.version} for ${item.countryName} (${item.ruleTypeLabel})?`)) {
        return;
      }

      await publishRuleVersion(item.countryId, item.id);
      setActionSuccessMsg(`Successfully published Version ${item.version} for ${item.countryName}!`);
      await loadApprovals();
    } catch (err: any) {
      setError(err?.message || 'Failed to approve and publish rule version.');
    } finally {
      setActionInProgressId(null);
    }
  };

  // Reject action handler
  const handleRejectConfirm = async (reason: string) => {
    if (!selectedForReject) return;
    try {
      setActionInProgressId(selectedForReject.id);
      await rejectRuleVersion(selectedForReject.countryId, selectedForReject.id, { reason });
      setActionSuccessMsg(`Version ${selectedForReject.version} returned to draft with rejection feedback.`);
      setSelectedForReject(null);
      await loadApprovals();
    } catch (err: any) {
      setError(err?.message || 'Failed to reject rule version.');
      throw err;
    } finally {
      setActionInProgressId(null);
    }
  };

  // Backdated Publish confirmation handler
  const handleConfirmBackdatedPublish = async (options: PublishRuleVersionInput) => {
    if (!selectedForBackdated) return;
    try {
      setActionInProgressId(selectedForBackdated.item.id);
      await publishRuleVersion(selectedForBackdated.item.countryId, selectedForBackdated.item.id, options);
      setActionSuccessMsg(`Backdated Version ${selectedForBackdated.item.version} successfully published and historical payroll runs flagged for compliance review.`);
      setSelectedForBackdated(null);
      await loadApprovals();
    } catch (err: any) {
      setError(err?.message || 'Failed to publish backdated rule version.');
      throw err;
    } finally {
      setActionInProgressId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 dark:text-white">
                  Rule Version Approvals Inbox
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  {items.length} Pending Review
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Compliance Four-Eyes review queue: inspect statutory diffs against published baselines, verify source references, and publish or reject proposed rule versions.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={loadApprovals}
          disabled={loading}
          className="self-start md:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-xs disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Inbox</span>
        </button>
      </div>

      {/* Success Banner */}
      {actionSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-200 text-xs flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold">{actionSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessMsg(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-200 text-xs flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-700 dark:text-rose-300 hover:text-rose-900 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Country Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              aria-label="Filter by country"
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">All Countries ({items.length})</option>
              {countryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.flagEmoji} {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filter by rule category"
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-500"
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes, submitter, ref..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
          />
        </div>
      </div>

      {/* Main Approval Items Queue */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
          <span className="text-xs font-medium">Scanning pending compliance queue...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[380px] p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center shadow-xs">
          <div className="h-16 w-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-4">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            Approvals Inbox Zero
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
            {items.length === 0
              ? 'All statutory rule submissions across all jurisdictions are approved and up to date. When a Compliance Admin submits a draft rule version, it will appear here for review.'
              : 'No pending rule versions matched your active search or category filters.'}
          </p>
          {(selectedCountry !== 'all' || selectedCategory !== 'all' || searchQuery.trim()) && (
            <button
              type="button"
              onClick={() => {
                setSelectedCountry('all');
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredItems.map((item) => {
            const isDiffExpanded = Boolean(expandedDiffs[item.id]);
            const isActing = actionInProgressId === item.id;

            // Separation of duties enforcement
            const isSubmitter = Boolean(
              user?.id && item.submittedBy && item.submittedBy === user.id,
            );
            const isApproverRole =
              user?.roleName === 'Platform Owner' || user?.roleName === 'Platform Admin';
            const canApprove = isApproverRole && !isSubmitter;

            const diffStats = item.diffAgainstPublished?.stats;

            return (
              <div
                key={item.id}
                className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition overflow-hidden"
              >
                {/* Item Top Banner */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/30 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl shrink-0">{item.flagEmoji}</span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          {item.countryName}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          {item.ruleTypeLabel}
                        </span>
                        {item.stateProvinceCode && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                            {item.stateProvinceCode}
                          </span>
                        )}
                        <span className="text-xs font-mono font-bold text-slate-500">
                          Version {item.version}
                        </span>
                        <RuleVersionStatusPill status={item.status} />

                        {item.isBackdated && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Retroactive
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          Effective: {item.effectiveFrom} → {item.effectiveTo || 'Present'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Submission Timestamp Badge */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {item.submittedAt
                        ? `Submitted ${new Date(item.submittedAt).toLocaleDateString()} at ${new Date(item.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : 'Pending Compliance Review'}
                    </span>
                  </div>
                </div>

                {/* Submitter & Proposal Details */}
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Submitter Box */}
                    <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Submitter (Four-Eyes Author)
                        </span>
                        <User className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
                          {(item.submittedByName || 'A').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {item.submittedByName}
                          </div>
                          {item.submittedByEmail && (
                            <div className="text-[11px] text-slate-400 font-mono">
                              {item.submittedByEmail}
                            </div>
                          )}
                        </div>
                      </div>

                      {item.submissionNote && (
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                          <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                            Submitter Note:
                          </span>
                          <p className="italic text-slate-700 dark:text-slate-300 leading-relaxed">
                            "{item.submissionNote}"
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Statutory Metadata Box */}
                    <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Statutory Authority & Description
                        </span>
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                      </div>

                      {item.sourceReference && (
                        <div>
                          <span className="text-[11px] font-semibold text-slate-500 block">
                            Legal Source Reference:
                          </span>
                          <span className="font-mono text-slate-800 dark:text-slate-200 truncate block">
                            {item.sourceReference}
                          </span>
                        </div>
                      )}

                      {item.changeNote && (
                        <div>
                          <span className="text-[11px] font-semibold text-slate-500 block">
                            Change Note:
                          </span>
                          <p className="text-slate-800 dark:text-slate-200 leading-relaxed line-clamp-2">
                            {item.changeNote}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Diff against Current Published Version Section */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/30 dark:bg-slate-900/40">
                    <div
                      onClick={() => toggleDiffExpand(item.id)}
                      className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition select-none"
                    >
                      <div className="flex items-center gap-2 text-xs">
                        {isDiffExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                        <GitCompare className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          Diff against Current Published Version
                        </span>

                        {item.currentPublishedVersion ? (
                          <span className="text-slate-500 font-mono text-[11px]">
                            (v{item.currentPublishedVersion.version} Published · {item.currentPublishedVersion.effectiveFrom})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
                            Initial Baseline (No Preceding Version)
                          </span>
                        )}
                      </div>

                      {diffStats && (
                        <div className="flex items-center gap-1.5 text-[11px] font-mono">
                          {diffStats.added > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold">
                              +{diffStats.added} added
                            </span>
                          )}
                          {diffStats.removed > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-bold">
                              -{diffStats.removed} removed
                            </span>
                          )}
                          {diffStats.modified > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold">
                              ~{diffStats.modified} modified
                            </span>
                          )}
                          {diffStats.added === 0 && diffStats.removed === 0 && diffStats.modified === 0 && (
                            <span className="text-slate-400 italic">No field differences</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Collapsible Diff Body */}
                    {isDiffExpanded && (
                      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                        {!item.currentPublishedVersion ? (
                          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-900/50 dark:text-blue-200 text-xs">
                            <span className="font-bold block mb-1">
                              Inaugural Statutory Baseline
                            </span>
                            <p className="leading-relaxed">
                              This version represents the first published regulation for {item.ruleTypeLabel} in {item.countryName}. Approving this version will establish the statutory baseline for all inheriting tenants.
                            </p>
                          </div>
                        ) : item.diffAgainstPublished ? (
                          <div className="space-y-3">
                            {/* Metadata Differences */}
                            {item.diffAgainstPublished.metadataDiff.some((m) => m.hasChanged) && (
                              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden text-xs">
                                <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                                  Statutory Metadata Changes
                                </div>
                                <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                  {item.diffAgainstPublished.metadataDiff
                                    .filter((m) => m.hasChanged)
                                    .map((m) => (
                                      <div key={m.field} className="px-3 py-2 flex items-center justify-between gap-4 font-mono">
                                        <span className="font-semibold text-slate-600 dark:text-slate-400">
                                          {m.label}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <span className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded">
                                            {m.baseValue || 'None'}
                                          </span>
                                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                          <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded font-bold">
                                            {m.compareValue || 'None'}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Payload Field Differences Table */}
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden text-xs">
                              <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                                Rule Payload Field Changes
                              </div>
                              <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 max-h-60 overflow-y-auto">
                                {item.diffAgainstPublished.payloadDiff.map((field) => {
                                  let badgeColor = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
                                  if (field.type === 'added') badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
                                  if (field.type === 'removed') badgeColor = 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
                                  if (field.type === 'modified') badgeColor = 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';

                                  return (
                                    <div key={field.path} className="px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono">
                                      <div className="flex items-center gap-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${badgeColor}`}>
                                          {field.type}
                                        </span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                          {field.path}
                                        </span>
                                      </div>
                                      <div className="text-[11px] truncate max-w-md">
                                        {field.type === 'modified' && (
                                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                            <span className="text-rose-600 truncate">{JSON.stringify(field.baseValue)}</span>
                                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                            <span className="text-emerald-600 font-bold truncate">{JSON.stringify(field.compareValue)}</span>
                                          </div>
                                        )}
                                        {field.type === 'added' && (
                                          <span className="text-emerald-600 font-bold truncate">{JSON.stringify(field.compareValue)}</span>
                                        )}
                                        {field.type === 'removed' && (
                                          <span className="text-rose-600 truncate">{JSON.stringify(field.baseValue)}</span>
                                        )}
                                        {field.type === 'unchanged' && (
                                          <span className="text-slate-400 truncate">Unchanged</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic">
                            No difference calculation available.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Separation of Duties Bar & Actions Footer */}
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* SoD Policy Banner */}
                    <div className="text-xs flex items-center gap-2">
                      {isSubmitter ? (
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800/60">
                          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            Four-Eyes SoD Policy: You submitted this version. Another reviewer must approve or reject.
                          </span>
                        </div>
                      ) : canApprove ? (
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            Authorized Reviewer ({user?.roleName || 'Platform Admin'}): You are eligible to approve or reject.
                          </span>
                        </div>
                      ) : (
                        <div className="text-slate-500 flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>Platform Owner or Platform Admin role required to approve.</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2.5 self-end sm:self-auto">
                      {canApprove && (
                        <>
                          <button
                            type="button"
                            onClick={() => setSelectedForReject(item)}
                            disabled={isActing}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition shadow-xs disabled:opacity-60 flex items-center gap-1.5"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Reject</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleApprove(item)}
                            disabled={isActing}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm disabled:opacity-60 flex items-center gap-1.5"
                          >
                            {isActing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UploadCloud className="w-3.5 h-3.5" />
                            )}
                            <span>Approve & Publish</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {selectedForReject && (
        <RejectRuleVersionModal
          open={Boolean(selectedForReject)}
          onClose={() => setSelectedForReject(null)}
          version={{
            id: selectedForReject.id,
            version: selectedForReject.version,
            ruleType: selectedForReject.ruleType,
            countryId: selectedForReject.countryId,
            status: selectedForReject.status,
            effectiveFrom: selectedForReject.effectiveFrom,
            effectiveTo: selectedForReject.effectiveTo,
            sourceReference: selectedForReject.sourceReference,
            changeNote: selectedForReject.changeNote,
            createdBy: selectedForReject.submittedBy || 'staff',
            payload: {},
            createdAt: selectedForReject.submittedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          onReject={handleRejectConfirm}
          loading={actionInProgressId === selectedForReject.id}
        />
      )}

      {/* Backdated Impact Modal */}
      {selectedForBackdated && (
        <BackdatedPayrollImpactModal
          open={Boolean(selectedForBackdated)}
          onClose={() => setSelectedForBackdated(null)}
          version={{
            id: selectedForBackdated.item.id,
            version: selectedForBackdated.item.version,
            ruleType: selectedForBackdated.item.ruleType,
            countryId: selectedForBackdated.item.countryId,
            status: selectedForBackdated.item.status,
            effectiveFrom: selectedForBackdated.item.effectiveFrom,
            effectiveTo: selectedForBackdated.item.effectiveTo,
            sourceReference: selectedForBackdated.item.sourceReference,
            changeNote: selectedForBackdated.item.changeNote,
            createdBy: selectedForBackdated.item.submittedBy || 'staff',
            payload: {},
            createdAt: selectedForBackdated.item.submittedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          impact={selectedForBackdated.impact}
          onConfirmPublish={handleConfirmBackdatedPublish}
          loading={actionInProgressId === selectedForBackdated.item.id}
        />
      )}
    </div>
  );
}
