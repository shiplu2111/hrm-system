import { useEffect, useState } from 'react';
import type { RuleVersionTimelineEntry, RuleVersionTimelineResponse } from '@hrm/shared-types';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCode2,
  FileText,
  GitCommit,
  GitCompare,
  History,
  Layers,
  Loader2,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  User,
  XCircle,
} from 'lucide-react';
import { getRuleVersionTimeline } from '@/lib/platform-countries-api';
import { RuleVersionStatusPill } from './RuleVersionStatusPill';
import { RuleVersionDiffModal } from './RuleVersionDiffModal';

interface RuleVersionTimelineProps {
  countryId: string;
  ruleType: string;
  stateProvinceId?: string | null;
  initialTimeline?: RuleVersionTimelineResponse | null;
  onSelectVersion?: (versionId: string) => void;
  className?: string;
}

export function RuleVersionTimeline({
  countryId,
  ruleType,
  stateProvinceId,
  initialTimeline,
  onSelectVersion,
  className = '',
}: RuleVersionTimelineProps) {
  const [timeline, setTimeline] = useState<RuleVersionTimelineResponse | null>(
    initialTimeline || null,
  );
  const [loading, setLoading] = useState(!initialTimeline);
  const [error, setError] = useState<string | null>(null);

  // Expanded payloads and diff modal state
  const [expandedPayloads, setExpandedPayloads] = useState<Record<string, boolean>>({});
  const [diffModalVersions, setDiffModalVersions] = useState<{
    baseId: string;
    compareId: string;
  } | null>(null);

  const loadTimeline = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getRuleVersionTimeline(countryId, ruleType, stateProvinceId);
      setTimeline(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load rule version timeline.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialTimeline) {
      loadTimeline();
    } else {
      setTimeline(initialTimeline);
    }
  }, [countryId, ruleType, stateProvinceId, initialTimeline]);

  const togglePayloadExpand = (versionId: string) => {
    setExpandedPayloads((prev) => ({
      ...prev,
      [versionId]: !prev[versionId],
    }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 dark:text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
        <span className="text-xs font-medium">Loading version timeline...</span>
      </div>
    );
  }

  if (error || !timeline) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300">
        <div className="flex items-center gap-2 font-semibold text-sm mb-1">
          <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          <span>Timeline Unavailable</span>
        </div>
        <p className="text-xs text-rose-700 dark:text-rose-400 mb-3">{error || 'Could not load timeline.'}</p>
        <button
          type="button"
          onClick={loadTimeline}
          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  // Display versions in reverse chronological order (newest on top) for reading
  const reversedVersions = [...timeline.versions].reverse();

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Timeline Header Summary Banner */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{timeline.flagEmoji}</span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {timeline.countryName} · {timeline.ruleTypeLabel}
              </h4>
              {timeline.stateProvinceCode && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                  {timeline.stateProvinceCode} Scope
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {timeline.totalVersions} version{timeline.totalVersions === 1 ? '' : 's'} recorded in append-only statutory log
              </span>
            </p>
          </div>
        </div>

        {timeline.currentPublishedVersionNumber ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Currently Active: Version {timeline.currentPublishedVersionNumber}</span>
          </div>
        ) : (
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-300 text-xs font-semibold">
            No Published Baseline Active
          </div>
        )}
      </div>

      {/* Timeline Vertical Track */}
      <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
        {reversedVersions.map((v, idx) => {
          const isExpanded = Boolean(expandedPayloads[v.id]);
          const precedingVersion = reversedVersions[idx + 1] || null;

          // Node color & icon according to status
          let nodeBg = 'bg-slate-400 dark:bg-slate-600 text-white';
          let nodeBorder = 'border-slate-300 dark:border-slate-700';
          let NodeIcon = Clock;

          if (v.status === 'published') {
            nodeBg = 'bg-emerald-500 text-white shadow-emerald-500/20 shadow-md';
            nodeBorder = 'border-emerald-200 dark:border-emerald-800';
            NodeIcon = CheckCircle2;
          } else if (v.status === 'pending_approval') {
            nodeBg = 'bg-amber-500 text-white shadow-amber-500/20 shadow-md animate-pulse';
            nodeBorder = 'border-amber-200 dark:border-amber-800';
            NodeIcon = Clock;
          } else if (v.status === 'rejected') {
            nodeBg = 'bg-rose-500 text-white shadow-rose-500/20 shadow-md';
            nodeBorder = 'border-rose-200 dark:border-rose-800';
            NodeIcon = XCircle;
          } else if (v.status === 'draft') {
            nodeBg = 'bg-sky-500 text-white shadow-sky-500/20 shadow-md';
            nodeBorder = 'border-sky-200 dark:border-sky-800';
            NodeIcon = FileText;
          }

          return (
            <div key={v.id} className="relative group">
              {/* Circular Timeline Node */}
              <div
                className={`absolute -left-6 sm:-left-8 top-1.5 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center border-2 ${nodeBorder} ${nodeBg} transition-transform group-hover:scale-110 z-10`}
              >
                <NodeIcon className="w-3.5 h-3.5" />
              </div>

              {/* Version Detail Card */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow transition p-5 space-y-4">
                {/* Header Row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        Version {v.version}
                      </span>
                      <RuleVersionStatusPill status={v.status} />

                      {v.isCurrentPublished && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Active Baseline
                        </span>
                      )}

                      {v.isBackdated && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          Retroactive
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Effective: {v.effectiveFrom} → {v.effectiveTo || 'Present (Open-Ended)'}
                      </span>
                    </div>
                  </div>

                  {/* Top-Right Quick Actions */}
                  <div className="flex items-center gap-2">
                    {onSelectVersion && (
                      <button
                        type="button"
                        onClick={() => onSelectVersion(v.id)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition"
                      >
                        Select in Editor
                      </button>
                    )}

                    {precedingVersion && (
                      <button
                        type="button"
                        onClick={() =>
                          setDiffModalVersions({
                            baseId: precedingVersion.id,
                            compareId: v.id,
                          })
                        }
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 dark:text-indigo-300 transition"
                        title={`Compare v${precedingVersion.version} with v${v.version}`}
                      >
                        <GitCompare className="w-3.5 h-3.5" />
                        <span>Diff vs v{precedingVersion.version}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Change Note & Source Reference */}
                <div className="space-y-2 text-xs">
                  {v.changeNote && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-slate-800 dark:text-slate-200">
                      <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                        Change Description:
                      </span>
                      <p className="leading-relaxed">{v.changeNote}</p>
                    </div>
                  )}

                  {v.sourceReference && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold">Statutory Reference:</span>
                      <span className="font-mono truncate">{v.sourceReference}</span>
                    </div>
                  )}
                </div>

                {/* Audit Lifecycle Trail: Creator, Submitter, Approver, Rejecter */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  {/* Creator */}
                  <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                    <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                        Created By
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {v.creator.name}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {new Date(v.creator.at).toLocaleDateString()} {new Date(v.creator.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Submitter */}
                  {v.submitter && (
                    <div className="flex items-start gap-2.5 p-2 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
                      <Layers className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 block">
                          Submitted for Approval
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {v.submitter.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {new Date(v.submitter.at).toLocaleDateString()}
                        </span>
                        {v.submitter.note && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 italic">
                            "{v.submitter.note}"
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Approver */}
                  {v.approver && (
                    <div className="flex items-start gap-2.5 p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                          Approved & Published By
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {v.approver.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {new Date(v.approver.at).toLocaleDateString()} {new Date(v.approver.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Rejecter */}
                  {v.rejecter && (
                    <div className="sm:col-span-2 flex items-start gap-2.5 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-900 dark:text-rose-200">
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 block">
                          Rejected by {v.rejecter.name} on {new Date(v.rejecter.at).toLocaleDateString()}
                        </span>
                        <p className="text-xs text-rose-800 dark:text-rose-300 mt-0.5 font-medium">
                          Reason: {v.rejecter.reason}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Diff Summary Metric Chip */}
                {v.diffSummary && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-500">Changes vs v{v.version - 1}:</span>
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      {v.diffSummary.fieldsAdded > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold">
                          +{v.diffSummary.fieldsAdded} added
                        </span>
                      )}
                      {v.diffSummary.fieldsRemoved > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-bold">
                          -{v.diffSummary.fieldsRemoved} removed
                        </span>
                      )}
                      {v.diffSummary.fieldsModified > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold">
                          ~{v.diffSummary.fieldsModified} modified
                        </span>
                      )}
                      {v.diffSummary.totalChanges === 0 && (
                        <span className="text-slate-400 italic">Identical payload structure</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Expandable JSON Payload Inspection */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => togglePayloadExpand(v.id)}
                    className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    <FileCode2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isExpanded ? 'Hide Raw JSON Payload' : 'Inspect Raw JSON Payload'}</span>
                  </button>

                  {isExpanded && (
                    <div className="mt-2.5 p-3.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto max-h-60 border border-slate-800">
                      <pre>{JSON.stringify(v.payload, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Side-by-Side Diff Modal Triggered from Timeline */}
      {diffModalVersions && (
        <RuleVersionDiffModal
          open={Boolean(diffModalVersions)}
          onClose={() => setDiffModalVersions(null)}
          countryId={countryId}
          baseVersionId={diffModalVersions.baseId}
          compareVersionId={diffModalVersions.compareId}
        />
      )}
    </div>
  );
}
