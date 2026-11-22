import React, { useState } from 'react';
import type { RuleVersionPayrollImpact, RuleVersionView } from '@hrm/shared-types';
import {
  AlertOctagon,
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  FileCheck,
  History,
  Info,
  Loader2,
  Lock,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface BackdatedPayrollImpactModalProps {
  open: boolean;
  onClose: () => void;
  version: RuleVersionView;
  impact: RuleVersionPayrollImpact;
  onConfirmPublish: (options: { confirmBackdated: boolean; backdatedReason: string }) => Promise<void>;
  loading?: boolean;
}

export function BackdatedPayrollImpactModal({
  open,
  onClose,
  version,
  impact,
  onConfirmPublish,
  loading = false,
}: BackdatedPayrollImpactModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [reason, setReason] = useState(
    `Retroactive statutory ${version.ruleType.replace('_', ' ')} revision effective from ${version.effectiveFrom}`,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acknowledged) {
      setError('You must explicitly acknowledge the backdated payroll impact before publishing.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onConfirmPublish({
        confirmBackdated: true,
        backdatedReason: reason.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to publish backdated rule version.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Backdated Statutory Rule Publication (v${version.version})`} size="xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Warning Banner */}
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800/70 dark:text-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <span className="font-bold text-sm block">
              Warning: Backdated Statutory Effective Date
            </span>
            <p className="leading-relaxed">
              This statutory rule is configured to take effect retroactively on{' '}
              <strong className="font-mono text-amber-950 dark:text-amber-100">{version.effectiveFrom}</strong>{' '}
              (System calculation date: <strong className="font-mono">{impact.calculationDate}</strong>).
              Publishing backdated rules affects finalized historical pay periods.
            </p>
          </div>
        </div>

        {/* Impact Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
              <span>Finalized Payroll Runs</span>
              <FileCheck className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {impact.affectedFinalizedPayrollRunsCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Overlapping period runs
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
              <span>Affected Workspaces</span>
              <Building2 className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {impact.affectedTenantsCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Operating in jurisdiction
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
              <span>Affected Entities</span>
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {impact.affectedCompaniesCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Operating companies
            </div>
          </div>
        </div>

        {/* Affected Tenants Inspection List */}
        {impact.tenants.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Affected Workspaces & Headcounts ({impact.tenants.length})
            </span>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
              {impact.tenants.map((t) => (
                <div key={t.tenantId} className="p-3 text-xs flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{t.tenantName}</span>
                      <span className="text-[11px] text-slate-400 font-mono">({t.subdomain})</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {t.companies.map((c) => `${c.companyName} (${c.affectedRunsCount} runs, ${c.affectedEmployeesCount} staff)`).join(' · ')}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {t.totalAffectedRuns} run{t.totalAffectedRuns > 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RULES.md §3 Statutory Compliance Policy Banner */}
        <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/70 text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-indigo-900 dark:text-indigo-200">
            <ShieldAlert className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>RULES.md §3 Non-Negotiable Financial Immutability Policy</span>
          </div>
          <p className="leading-relaxed">
            In accordance with <strong>RULES.md Section 3</strong>, finalized payroll runs are permanently locked and will{' '}
            <strong>NEVER be mutated in-place</strong>. Publishing this backdated rule will <strong>NOT</strong> recalculate historical payslips or change monetary values.
          </p>
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>
              All {impact.affectedFinalizedPayrollRunsCount} affected runs will be tagged with a compliance review flag for tenant payroll officers to process retroactive adjustments (<code>payroll_adjustments</code>) if required.
            </span>
          </div>
        </div>

        {/* Reason for Backdating */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Audit Reason for Retroactive Publication *
          </label>
          <input
            type="text"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Retroactive statutory rate gazette from ministry of finance"
            className="w-full h-9 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Mandatory Confirmation Checkbox */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          <label className="flex items-start gap-3 cursor-pointer text-xs select-none">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">
              I explicitly confirm that this rule version is <strong>backdated to {version.effectiveFrom}</strong>. I acknowledge that {impact.affectedFinalizedPayrollRunsCount} finalized payroll runs across {impact.affectedTenantsCount} tenant(s) will be flagged for review, and that finalized historical payroll rows will <strong>never be mutated</strong> per RULES.md §3.
            </span>
          </label>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300">
            <AlertOctagon className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting || loading}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!acknowledged || submitting || loading || !reason.trim()}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-sm disabled:opacity-50 transition flex items-center gap-1.5"
          >
            {submitting || loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
            <span>Confirm Backdated & Publish Version {version.version}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
