import React, { useState } from 'react';
import type {
  PublishRuleVersionInput,
  RuleVersionPayrollImpact,
  RuleVersionView,
} from '@hrm/shared-types';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  GitCompare,
  Lock,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { usePlatformAuth } from '@/context/PlatformAuthContext';
import {
  getRuleVersionPayrollImpact,
  publishRuleVersion,
  rejectRuleVersion,
  submitRuleVersionForApproval,
} from '@/lib/platform-countries-api';
import { BackdatedPayrollImpactModal } from './BackdatedPayrollImpactModal';
import { RejectRuleVersionModal } from './RejectRuleVersionModal';
import { RuleVersionStatusPill } from './RuleVersionStatusPill';
import { SubmitForApprovalModal } from './SubmitForApprovalModal';

export interface RuleVersionSelectorProps {
  versions: RuleVersionView[];
  selectedVersionId: string | null;
  onSelectVersion: (versionId: string) => void;
  onCreateNewVersion: () => void;
  onCompareVersions: () => void;
  onPublishVersion?: (versionId: string, options?: PublishRuleVersionInput) => void | Promise<void>;
  onSubmitForApproval?: (versionId: string, note?: string) => void | Promise<void>;
  onRejectVersion?: (versionId: string, reason: string) => void | Promise<void>;
  isPublishing?: boolean;
  countryId?: string;
  onRefresh?: () => void | Promise<void>;
}

export function RuleVersionSelector({
  versions,
  selectedVersionId,
  onSelectVersion,
  onCreateNewVersion,
  onCompareVersions,
  onPublishVersion,
  onSubmitForApproval,
  onRejectVersion,
  isPublishing = false,
  countryId,
  onRefresh,
}: RuleVersionSelectorProps) {
  const { user } = usePlatformAuth();

  const currentVersion =
    versions.find((v) => v.id === selectedVersionId) || versions[0] || null;

  // Modals state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isBackdatedModalOpen, setIsBackdatedModalOpen] = useState(false);
  const [payrollImpact, setPayrollImpact] = useState<RuleVersionPayrollImpact | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Separation of duties determination
  const isSubmitter = Boolean(
    user?.id && currentVersion?.submittedBy && currentVersion.submittedBy === user.id,
  );
  const isApproverRole =
    user?.roleName === 'Platform Owner' || user?.roleName === 'Platform Admin';
  const canApprove = isApproverRole && !isSubmitter;

  // Check if current version is backdated relative to current UTC date
  const now = new Date();
  const todayUtcStr = now.toISOString().slice(0, 10);
  const isBackdated = Boolean(
    currentVersion?.effectiveFrom && currentVersion.effectiveFrom < todayUtcStr,
  );

  const handleInitiatePublish = async () => {
    if (!currentVersion) return;
    setActionError(null);

    // If backdated and countryId available, assess payroll impact first
    if (isBackdated && countryId) {
      try {
        setLoadingImpact(true);
        const impact = await getRuleVersionPayrollImpact(countryId, currentVersion.id);
        setPayrollImpact(impact);
        if (impact.isBackdated && impact.affectedFinalizedPayrollRunsCount > 0) {
          setIsBackdatedModalOpen(true);
          return;
        }
      } catch (err: any) {
        setActionError(err?.message || 'Failed to check backdated payroll impact.');
      } finally {
        setLoadingImpact(false);
      }
    }

    if (
      !confirm(
        `Publish Version ${currentVersion.version}? Rules will take effect from ${currentVersion.effectiveFrom}.`,
      )
    ) {
      return;
    }

    try {
      if (onPublishVersion) {
        await onPublishVersion(currentVersion.id);
      } else if (countryId) {
        await publishRuleVersion(countryId, currentVersion.id);
        await onRefresh?.();
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to publish rule version.');
    }
  };

  const handleSubmitForApproval = async (note?: string) => {
    if (!currentVersion) return;
    setActionError(null);
    try {
      if (onSubmitForApproval) {
        await onSubmitForApproval(currentVersion.id, note);
      } else if (countryId) {
        await submitRuleVersionForApproval(countryId, currentVersion.id, {
          submissionNote: note,
        });
        await onRefresh?.();
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to submit rule version for approval.');
    }
  };

  const handleReject = async (reason: string) => {
    if (!currentVersion) return;
    setActionError(null);
    try {
      if (onRejectVersion) {
        await onRejectVersion(currentVersion.id, reason);
      } else if (countryId) {
        await rejectRuleVersion(countryId, currentVersion.id, { reason });
        await onRefresh?.();
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to reject rule version.');
    }
  };

  return (
    <div className="space-y-3">
      {/* Selector and Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 shadow-xs">
        {/* Left: Version Picker & Status */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Version:
            </span>
            <div className="relative inline-block">
              <select
                value={currentVersion?.id || ''}
                onChange={(e) => onSelectVersion(e.target.value)}
                disabled={versions.length === 0}
                className="appearance-none h-9 pl-3 pr-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-xs"
              >
                {versions.length === 0 ? (
                  <option value="">No versions available</option>
                ) : (
                  versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.version} — {v.status.toUpperCase()} ({v.effectiveFrom} to{' '}
                      {v.effectiveTo || 'Present'})
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {currentVersion && (
            <>
              <RuleVersionStatusPill status={currentVersion.status} />

              <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                <Calendar className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                {currentVersion.effectiveFrom} →{' '}
                {currentVersion.effectiveTo || 'Open-Ended'}
              </span>

              {isBackdated && currentVersion.status !== 'published' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  <Clock className="w-3 h-3" /> Backdated
                </span>
              )}
            </>
          )}
        </div>

        {/* Right: Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {currentVersion && versions.length > 1 && (
            <button
              type="button"
              onClick={onCompareVersions}
              className="h-8 px-3 flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-xs"
              title="Compare side-by-side with other versions"
            >
              <GitCompare className="h-3.5 w-3.5 text-indigo-500" />
              <span>Compare Versions</span>
            </button>
          )}

          {/* Draft or Rejected: Submit for Compliance Approval */}
          {currentVersion &&
            (currentVersion.status === 'draft' || currentVersion.status === 'rejected') && (
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(true)}
                className="h-8 px-3.5 flex items-center gap-1.5 rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition shadow-xs"
              >
                <Send className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>Submit for Approval</span>
              </button>
            )}

          {/* Pending Approval: Approve & Publish (if eligible approver) */}
          {currentVersion?.status === 'pending_approval' && (
            <>
              {canApprove && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsRejectModalOpen(true)}
                    className="h-8 px-3 flex items-center gap-1.5 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition shadow-xs"
                  >
                    <XCircle className="h-3.5 w-3.5 text-rose-600" />
                    <span>Reject</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleInitiatePublish}
                    disabled={isPublishing || loadingImpact}
                    className="h-8 px-3.5 flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition shadow-xs disabled:opacity-60"
                  >
                    <UploadCloud className="h-3.5 w-3.5" />
                    <span>Approve & Publish</span>
                  </button>
                </>
              )}
            </>
          )}


          <button
            type="button"
            onClick={onCreateNewVersion}
            className="h-8 px-3.5 flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Version</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{actionError}</span>
        </div>
      )}

      {/* 1. Pending Approval Banner & Separation of Duties Guidance */}
      {currentVersion?.status === 'pending_approval' && (
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/70 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200 text-xs space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-sm block text-blue-950 dark:text-blue-100">
                  Version {currentVersion.version} is Pending Compliance Approval
                </span>
                <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                  Submitted on {currentVersion.submittedAt ? new Date(currentVersion.submittedAt).toLocaleDateString() : 'recently'}
                  {currentVersion.submittedBy && ` · Submitter ID: ${currentVersion.submittedBy}`}
                </span>
                {currentVersion.submissionNote && (
                  <div className="mt-1 text-slate-700 dark:text-slate-300 italic">
                    &ldquo;{currentVersion.submissionNote}&rdquo;
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                Four-Eyes Review
              </span>
            </div>
          </div>

          {/* Submitter Self-Approval Prohibition Warning */}
          {isSubmitter && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/50 dark:border-amber-800/80 dark:text-amber-200 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Separation of Duties Enforced</span>
                <span>
                  You submitted this rule version. Compliance governance strictly prohibits approving your own changes. An independent Platform Owner or Platform Admin must review and approve this version.
                </span>
              </div>
            </div>
          )}

          {/* Approver Authorized Guidance */}
          {canApprove && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800/80 dark:text-emerald-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Authorized Reviewer ({user?.roleName}): You are eligible to approve and publish or reject this version.
              </span>
            </div>
          )}
        </div>
      )}

      {/* 2. Rejection Banner when version was Rejected */}
      {currentVersion?.status === 'rejected' && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/70 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-sm text-rose-950 dark:text-rose-100">
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>Version {currentVersion.version} Returned to Draft (Changes Requested)</span>
          </div>
          {currentVersion.rejectionReason && (
            <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-rose-200 dark:border-rose-900/50 text-slate-800 dark:text-slate-200 font-mono text-[11px]">
              {currentVersion.rejectionReason}
            </div>
          )}
          <p className="text-slate-600 dark:text-slate-400">
            Please review the feedback above, make the necessary adjustments, and click <strong>&quot;Submit for Approval&quot;</strong> to re-submit.
          </p>
        </div>
      )}

      {/* 3. Immutability Alert Banner when version is Published */}
      {currentVersion?.status === 'published' && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-300 text-xs">
          <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold block">
              Published Version Immutable (Locked)
            </span>
            <span>
              In accordance with statutory payroll &amp; compliance governance (RULES.md §3), published rule versions cannot be edited in-place.
              To propose changes, click <strong>&quot;New Version&quot;</strong> to clone this version into a draft.
            </span>
          </div>
        </div>
      )}

      {/* =========================================================================
          WORKFLOW MODALS
          ========================================================================= */}
      {currentVersion && isSubmitModalOpen && (
        <SubmitForApprovalModal
          open={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
          version={currentVersion}
          onSubmit={handleSubmitForApproval}
        />
      )}

      {currentVersion && isRejectModalOpen && (
        <RejectRuleVersionModal
          open={isRejectModalOpen}
          onClose={() => setIsRejectModalOpen(false)}
          version={currentVersion}
          onReject={handleReject}
        />
      )}

      {currentVersion && payrollImpact && isBackdatedModalOpen && (
        <BackdatedPayrollImpactModal
          open={isBackdatedModalOpen}
          onClose={() => setIsBackdatedModalOpen(false)}
          version={currentVersion}
          impact={payrollImpact}
          onConfirmPublish={async (options) => {
            try {
              if (onPublishVersion) {
                await onPublishVersion(currentVersion.id, options);
              } else if (countryId) {
                await publishRuleVersion(countryId, currentVersion.id, options);
                await onRefresh?.();
              }
            } catch (err: any) {
              setActionError(err?.message || 'Failed to publish backdated rule version.');
              throw err;
            }
          }}
          loading={isPublishing}
        />
      )}
    </div>
  );
}
