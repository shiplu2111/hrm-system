import { useMemo, useState } from 'react';
import type { CmsLocale, CmsPageDetailDto, CmsPageVersionDto } from '@hrm/shared-types';
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  GitCompare,
  History,
  RotateCcw,
  User,
  X,
} from 'lucide-react';
import { restoreCmsPageVersion } from '@/lib/platform-cms-api';
import { buildVersionSideBySideDiff, type DiffToken } from './cms-diff-utils';

interface VersionHistoryPanelProps {
  isOpen: boolean;
  detail: CmsPageDetailDto;
  initialLocale: CmsLocale;
  canRestore: boolean;
  onClose: () => void;
  onRestored: (restoredVersion: CmsPageVersionDto) => Promise<void> | void;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function DiffTokenRun({
  tokens,
  side,
}: {
  tokens: DiffToken[];
  side: 'left' | 'right';
}) {
  if (tokens.length === 0) {
    return <span className="italic text-[rgb(var(--text-muted))]">(empty)</span>;
  }
  return (
    <span className="whitespace-pre-wrap break-words">
      {tokens.map((tok, idx) => {
        if (tok.type === 'removed' && side === 'left') {
          return (
            <mark
              key={idx}
              className="bg-rose-500/20 text-rose-800 dark:text-rose-200 line-through rounded px-0.5"
            >
              {tok.text}
            </mark>
          );
        }
        if (tok.type === 'added' && side === 'right') {
          return (
            <mark
              key={idx}
              className="bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 font-medium rounded px-0.5"
            >
              {tok.text}
            </mark>
          );
        }
        return <span key={idx}>{tok.text}</span>;
      })}
    </span>
  );
}

export function VersionHistoryPanel({
  isOpen,
  detail,
  initialLocale,
  canRestore,
  onClose,
  onRestored,
}: VersionHistoryPanelProps) {
  const [localeFilter, setLocaleFilter] = useState<CmsLocale>(initialLocale);
  const versions = useMemo(
    () =>
      detail.versions
        .filter((v) => v.locale === localeFilter)
        .sort((a, b) => b.versionNumber - a.versionNumber),
    [detail.versions, localeFilter],
  );

  const [leftVersionId, setLeftVersionId] = useState<string>(() => {
    const initial = detail.versions
      .filter((v) => v.locale === initialLocale)
      .sort((a, b) => b.versionNumber - a.versionNumber);
    return initial[1]?.id ?? initial[0]?.id ?? '';
  });
  const [rightVersionId, setRightVersionId] = useState<string>(() => {
    const initial = detail.versions
      .filter((v) => v.locale === initialLocale)
      .sort((a, b) => b.versionNumber - a.versionNumber);
    return initial[0]?.id ?? '';
  });
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleLocaleSwitch = (loc: CmsLocale) => {
    setLocaleFilter(loc);
    const list = detail.versions
      .filter((v) => v.locale === loc)
      .sort((a, b) => b.versionNumber - a.versionNumber);
    setRightVersionId(list[0]?.id ?? '');
    setLeftVersionId(list[1]?.id ?? list[0]?.id ?? '');
    setError(null);
  };

  const leftVersion = useMemo(
    () => versions.find((v) => v.id === leftVersionId) ?? versions[1] ?? versions[0] ?? null,
    [versions, leftVersionId],
  );
  const rightVersion = useMemo(
    () => versions.find((v) => v.id === rightVersionId) ?? versions[0] ?? null,
    [versions, rightVersionId],
  );

  const diffResult = useMemo(() => {
    if (!leftVersion || !rightVersion) return null;
    return buildVersionSideBySideDiff(leftVersion, rightVersion);
  }, [leftVersion, rightVersion]);

  if (!isOpen) return null;

  const localeState = detail.page.locales.find((l) => l.locale === localeFilter);
  const currentDraftId = localeState?.currentDraftVersionId;
  const currentPublishedId =
    localeState?.currentPublishedVersionId || detail.page.currentPublishedVersionId;

  const handleRestore = async (ver: CmsPageVersionDto) => {
    if (!canRestore) return;
    setRestoringId(ver.id);
    setError(null);
    setNotice(null);
    try {
      const createdDraft = await restoreCmsPageVersion(
        detail.page.id,
        ver.id,
        `Restored as new draft from ${ver.locale.toUpperCase()} v${ver.versionNumber}`,
      );
      setNotice(
        `Created new draft v${createdDraft.versionNumber} from v${ver.versionNumber}. Historical snapshots remain unchanged.`,
      );
      await onRestored(createdDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore version.');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cms-version-history-title"
    >
      <div className="w-full max-w-[1340px] h-[90vh] flex flex-col rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <History className="h-4 w-4 text-primary-600" />
            <div>
              <h2 id="cms-version-history-title" className="text-sm font-bold">
                Immutable Version History · /{detail.page.slug}
              </h2>
              <p className="text-[11px] text-[rgb(var(--text-muted))]">
                Every save creates an append-only snapshot. Restoring creates a new draft version without overwriting history.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg p-0.5 bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border-base))]">
              {(['en', 'bn'] as const).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => handleLocaleSwitch(loc)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold uppercase ${
                    localeFilter === loc
                      ? 'bg-primary-600 text-white'
                      : 'text-[rgb(var(--text-secondary))]'
                  }`}
                >
                  {loc} ({detail.versions.filter((v) => v.locale === loc).length})
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Version History"
              className="h-8 w-8 rounded-lg inline-flex items-center justify-center hover:bg-[rgb(var(--bg-hover))]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {(error || notice) && (
          <div className="px-5 pt-3 space-y-2">
            {error && (
              <div className="px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {notice && (
              <div className="px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{notice}</span>
              </div>
            )}
          </div>
        )}

        {/* Split Body: Left Timeline List + Right Side-by-Side Diff */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden mt-2 border-t border-[rgb(var(--border-base))]">
          {/* Version List */}
          <div className="w-full lg:w-[370px] border-b lg:border-b-0 lg:border-r border-[rgb(var(--border-base))] overflow-y-auto divide-y divide-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))]">
            {versions.length === 0 ? (
              <div className="p-8 text-center text-xs text-[rgb(var(--text-muted))]">
                No saved versions yet for {localeFilter.toUpperCase()}.
              </div>
            ) : (
              versions.map((ver, idx) => {
                const prevVer = versions[idx + 1];
                const isLatestDraft = ver.id === currentDraftId;
                const isPublished = ver.id === currentPublishedId;
                return (
                  <div
                    key={ver.id}
                    className="p-3.5 bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-muted))]/35 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-primary-600/10 text-primary-700 dark:text-primary-300 font-mono text-xs font-bold">
                          v{ver.versionNumber}
                        </span>
                        {isPublished && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                            Published
                          </span>
                        )}
                        {isLatestDraft && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold">
                            Current Draft
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs font-medium text-[rgb(var(--text-primary))]">
                      {ver.changeNote || 'Saved snapshot'}
                    </div>

                    <div className="flex flex-col gap-0.5 text-[11px] text-[rgb(var(--text-muted))]">
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {ver.authorName || 'System'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(ver.createdAt)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {prevVer && (
                        <button
                          type="button"
                          onClick={() => {
                            setLeftVersionId(prevVer.id);
                            setRightVersionId(ver.id);
                          }}
                          className="h-7 px-2 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] hover:bg-[rgb(var(--bg-hover))] text-[11px] font-medium inline-flex items-center gap-1"
                        >
                          <GitCompare className="h-3 w-3" />
                          Diff vs v{prevVer.versionNumber}
                        </button>
                      )}

                      {canRestore && !isLatestDraft && (
                        <button
                          type="button"
                          disabled={restoringId === ver.id}
                          onClick={() => void handleRestore(ver)}
                          className="h-7 px-2.5 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 text-[11px] font-semibold inline-flex items-center gap-1 disabled:opacity-45"
                        >
                          <RotateCcw className="h-3 w-3" />
                          {restoringId === ver.id ? 'Restoring...' : 'Restore as Draft'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Side-by-Side Diff Viewer */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[rgb(var(--bg-surface))]">
            <div className="px-4 py-2.5 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/60 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold">Compare:</span>
                <select
                  aria-label="Base version"
                  value={leftVersion?.id ?? ''}
                  onChange={(e) => setLeftVersionId(e.target.value)}
                  className="h-8 px-2.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-mono"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.versionNumber} · {v.authorName || 'System'}
                    </option>
                  ))}
                </select>

                <ArrowLeftRight className="h-3.5 w-3.5 text-[rgb(var(--text-muted))]" />

                <select
                  aria-label="Target version"
                  value={rightVersion?.id ?? ''}
                  onChange={(e) => setRightVersionId(e.target.value)}
                  className="h-8 px-2.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-mono"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.versionNumber} · {v.authorName || 'System'}
                    </option>
                  ))}
                </select>
              </div>

              <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyChanged}
                  onChange={(e) => setOnlyChanged(e.target.checked)}
                />
                Show changed fields only ({diffResult?.changedCount ?? 0})
              </label>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {!diffResult ? (
                <div className="text-center py-12 text-xs text-[rgb(var(--text-muted))]">
                  Select two versions to compare side-by-side.
                </div>
              ) : (
                diffResult.rows
                  .filter((row) => (!onlyChanged ? true : row.changed))
                  .map((row) => (
                    <div
                      key={row.key}
                      className={`rounded-xl border overflow-hidden ${
                        row.changed
                          ? 'border-amber-500/35'
                          : 'border-[rgb(var(--border-base))]'
                      }`}
                    >
                      <div className="px-3 py-1.5 bg-[rgb(var(--bg-muted))] border-b border-[rgb(var(--border-base))] flex items-center justify-between text-[11px] font-semibold">
                        <span>{row.label}</span>
                        {row.changed ? (
                          <span className="text-amber-700 dark:text-amber-300">Changed</span>
                        ) : (
                          <span className="text-[rgb(var(--text-muted))]">Identical</span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[rgb(var(--border-base))] text-xs">
                        <div className="p-3 bg-rose-500/[0.02]">
                          <div className="text-[10px] font-mono uppercase text-[rgb(var(--text-muted))] mb-1">
                            Base (v{leftVersion?.versionNumber})
                          </div>
                          <DiffTokenRun tokens={row.leftTokens} side="left" />
                        </div>
                        <div className="p-3 bg-emerald-500/[0.02]">
                          <div className="text-[10px] font-mono uppercase text-[rgb(var(--text-muted))] mb-1">
                            Target (v{rightVersion?.versionNumber})
                          </div>
                          <DiffTokenRun tokens={row.rightTokens} side="right" />
                        </div>
                      </div>
                    </div>
                  ))
              )}

              {diffResult && onlyChanged && diffResult.changedCount === 0 && (
                <div className="text-center py-10 text-xs text-[rgb(var(--text-muted))]">
                  No text or block differences between v{leftVersion?.versionNumber} and v
                  {rightVersion?.versionNumber}.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
