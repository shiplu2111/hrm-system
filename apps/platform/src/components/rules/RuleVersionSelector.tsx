import type { RuleVersionView } from '@hrm/shared-types';
import {
  Calendar,
  ChevronDown,
  GitCompare,
  Lock,
  Plus,
  Send,
  UploadCloud,
} from 'lucide-react';
import { RuleVersionStatusPill } from './RuleVersionStatusPill';

interface RuleVersionSelectorProps {
  versions: RuleVersionView[];
  selectedVersionId: string | null;
  onSelectVersion: (versionId: string) => void;
  onCreateNewVersion: () => void;
  onCompareVersions: () => void;
  onPublishVersion?: (versionId: string) => void;
  onSubmitForApproval?: (versionId: string) => void;
  isPublishing?: boolean;
}

export function RuleVersionSelector({
  versions,
  selectedVersionId,
  onSelectVersion,
  onCreateNewVersion,
  onCompareVersions,
  onPublishVersion,
  onSubmitForApproval,
  isPublishing = false,
}: RuleVersionSelectorProps) {
  const currentVersion =
    versions.find((v) => v.id === selectedVersionId) || versions[0] || null;

  return (
    <div className="space-y-3">
      {/* Selector and Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60">
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

          {currentVersion?.status === 'draft' && onSubmitForApproval && (
            <button
              type="button"
              onClick={() => onSubmitForApproval(currentVersion.id)}
              className="h-8 px-3 flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition shadow-xs"
            >
              <Send className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>Submit for Approval</span>
            </button>
          )}

          {currentVersion &&
            (currentVersion.status === 'draft' ||
              currentVersion.status === 'pending_approval') &&
            onPublishVersion && (
              <button
                type="button"
                onClick={() => onPublishVersion(currentVersion.id)}
                disabled={isPublishing}
                className="h-8 px-3.5 flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition shadow-xs disabled:opacity-60"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                <span>Publish Version</span>
              </button>
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

      {/* Immutability Alert Banner when version is Published */}
      {currentVersion?.status === 'published' && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-300 text-xs">
          <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold block">
              Published Version Immutable (Locked)
            </span>
            <span>
              In accordance with statutory payroll & compliance governance, published rule versions cannot be edited in-place.
              To propose changes, click <strong>&quot;New Version&quot;</strong> to clone this version into a draft.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
