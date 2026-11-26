import { useMemo } from 'react';
import type { CmsPageVersionDto } from '@hrm/shared-types';
import {
  AlertTriangle,
  GitMerge,
  RefreshCw,
  Save,
  ShieldAlert,
} from 'lucide-react';
import type { SystemPageLocaleDraft } from './system-page-editor-utils';
import { computeWordDiff } from './cms-diff-utils';

interface VersionConflictModalProps {
  message: string;
  localDraft: SystemPageLocaleDraft;
  serverVersion: CmsPageVersionDto;
  busy?: boolean;
  onUseServerVersion: () => void;
  onMergeWithServer: () => void;
  onForceSaveMine: () => void;
}

export function VersionConflictModal({
  message,
  localDraft,
  serverVersion,
  busy = false,
  onUseServerVersion,
  onMergeWithServer,
  onForceSaveMine,
}: VersionConflictModalProps) {
  const titleDiff = useMemo(
    () => computeWordDiff(serverVersion.title || '', localDraft.title || ''),
    [serverVersion.title, localDraft.title],
  );

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cms-conflict-modal-title"
    >
      <div className="w-full max-w-2xl rounded-xl border border-rose-500/40 bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[rgb(var(--border-base))] bg-rose-500/10 flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 id="cms-conflict-modal-title" className="text-sm font-bold text-rose-700 dark:text-rose-300">
              Concurrent Edit Conflict — Silent Overwrite Blocked
            </h2>
            <p className="text-xs text-[rgb(var(--text-secondary))] mt-0.5">{message}</p>
          </div>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/50 p-3 space-y-1">
            <div className="font-semibold">
              Latest Saved Server Snapshot: v{serverVersion.versionNumber} (
              {serverVersion.locale.toUpperCase()})
            </div>
            <div className="text-[11px] text-[rgb(var(--text-muted))]">
              Saved by <strong>{serverVersion.authorName || 'Another editor'}</strong> on{' '}
              {new Date(serverVersion.createdAt).toLocaleString()} · Note:{' '}
              {serverVersion.changeNote || '—'}
            </div>
          </div>

          <div className="rounded-lg border border-[rgb(var(--border-base))] p-3 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--text-muted))]">
              Title Comparison (Their v{serverVersion.versionNumber} vs Your Local Draft)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-2 rounded bg-[rgb(var(--bg-muted))]/40">
                <div className="text-[10px] font-mono text-[rgb(var(--text-muted))] mb-1">
                  Server v{serverVersion.versionNumber}
                </div>
                {titleDiff.leftTokens.map((t, i) => (
                  <span
                    key={i}
                    className={
                      t.type === 'removed'
                        ? 'bg-rose-500/20 text-rose-800 dark:text-rose-200 px-0.5 rounded'
                        : ''
                    }
                  >
                    {t.text}
                  </span>
                ))}
              </div>
              <div className="p-2 rounded bg-[rgb(var(--bg-muted))]/40">
                <div className="text-[10px] font-mono text-[rgb(var(--text-muted))] mb-1">
                  Your Local Edit
                </div>
                {titleDiff.rightTokens.map((t, i) => (
                  <span
                    key={i}
                    className={
                      t.type === 'added'
                        ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 px-0.5 rounded'
                        : ''
                    }
                  >
                    {t.text}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg p-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Choose how to resolve this conflict. Every save remains immutable in Version History so neither editor&apos;s snapshot is lost.
            </span>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onUseServerVersion}
            className="h-9 px-3.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Load Their v{serverVersion.versionNumber} (Discard Mine)
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={onMergeWithServer}
            className="h-9 px-3.5 rounded-lg border border-indigo-500/35 bg-indigo-500/15 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-500/25 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <GitMerge className="h-3.5 w-3.5" />
            Merge Non-Conflicting Changes
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={onForceSaveMine}
            className="h-9 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            Save Mine as v{serverVersion.versionNumber + 1}
          </button>
        </div>
      </div>
    </div>
  );
}
