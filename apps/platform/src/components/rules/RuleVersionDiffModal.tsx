import { useEffect, useState } from 'react';
import type { RuleVersionDiffResult, RuleVersionView } from '@hrm/shared-types';
import {
  AlertCircle,
  ArrowRight,
  Code2,
  GitCompare,
  Layers,
  Loader2,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { compareRuleVersions } from '@/lib/platform-countries-api';
import { RuleVersionStatusPill } from './RuleVersionStatusPill';

interface RuleVersionDiffModalProps {
  open: boolean;
  onClose: () => void;
  versions: RuleVersionView[];
  countryId: string;
  initialBaseVersionId?: string;
  initialCompareVersionId?: string;
}

export function RuleVersionDiffModal({
  open,
  onClose,
  versions,
  countryId,
  initialBaseVersionId,
  initialCompareVersionId,
}: RuleVersionDiffModalProps) {
  const [baseId, setBaseId] = useState<string>(
    initialBaseVersionId || versions[1]?.id || versions[0]?.id || '',
  );
  const [compareId, setCompareId] = useState<string>(
    initialCompareVersionId || versions[0]?.id || '',
  );

  const [loading, setLoading] = useState(false);
  const [diffResult, setDiffResult] = useState<RuleVersionDiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'fields' | 'json'>('fields');

  useEffect(() => {
    if (initialBaseVersionId) setBaseId(initialBaseVersionId);
    if (initialCompareVersionId) setCompareId(initialCompareVersionId);
  }, [initialBaseVersionId, initialCompareVersionId]);

  useEffect(() => {
    if (!open || !baseId || !compareId) return;

    let active = true;
    setLoading(true);
    setError(null);

    compareRuleVersions(countryId, baseId, compareId)
      .then((res) => {
        if (active) setDiffResult(res);
      })
      .catch((err) => {
        if (active) setError(err?.message || 'Failed to calculate diff between versions.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, countryId, baseId, compareId]);

  const baseVersion = versions.find((v) => v.id === baseId);
  const compareVersion = versions.find((v) => v.id === compareId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rule Version Comparison & Diff"
      size="xl"
    >
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        {/* Version Selectors Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Base Version (Original)
            </label>
            <select
              value={baseId}
              onChange={(e) => setBaseId(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version} — {v.status.toUpperCase()} ({v.effectiveFrom})
                </option>
              ))}
            </select>
            {baseVersion && (
              <div className="mt-2 flex items-center gap-2">
                <RuleVersionStatusPill status={baseVersion.status} />
                <span className="text-[11px] text-slate-500 font-mono">
                  {baseVersion.effectiveFrom} → {baseVersion.effectiveTo || 'Present'}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Compare Version (Target / Proposed)
            </label>
            <select
              value={compareId}
              onChange={(e) => setCompareId(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version} — {v.status.toUpperCase()} ({v.effectiveFrom})
                </option>
              ))}
            </select>
            {compareVersion && (
              <div className="mt-2 flex items-center gap-2">
                <RuleVersionStatusPill status={compareVersion.status} />
                <span className="text-[11px] text-slate-500 font-mono">
                  {compareVersion.effectiveFrom} → {compareVersion.effectiveTo || 'Present'}
                </span>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            <span>Calculating version diff...</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : diffResult ? (
          <div className="space-y-4">
            {/* Stats Summary Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <GitCompare className="h-4 w-4 text-indigo-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Diff Summary:
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200">
                  +{diffResult.stats.added} added
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200">
                  -{diffResult.stats.removed} removed
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200">
                  ~{diffResult.stats.modified} modified
                </span>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('fields')}
                  className={`px-2.5 py-1 rounded font-bold transition ${
                    viewMode === 'fields'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5 inline mr-1" />
                  Field Breakdown
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('json')}
                  className={`px-2.5 py-1 rounded font-bold transition ${
                    viewMode === 'json'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Code2 className="h-3.5 w-3.5 inline mr-1" />
                  Raw JSON Diff
                </button>
              </div>
            </div>

            {/* Metadata Diff Table */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">
                Governance & Metadata Comparison
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {diffResult.metadataDiff.map((row) => (
                  <div
                    key={row.field}
                    className={`grid grid-cols-1 md:grid-cols-3 p-3 gap-2 ${
                      row.hasChanged
                        ? 'bg-amber-50/50 dark:bg-amber-950/20'
                        : 'bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      {row.hasChanged && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      )}
                      <span>{row.label}</span>
                    </div>
                    <div className="font-mono text-slate-500 break-words">
                      {row.baseValue || '—'}
                    </div>
                    <div className="font-mono font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 break-words">
                      {row.hasChanged && (
                        <ArrowRight className="h-3 w-3 text-amber-500 shrink-0" />
                      )}
                      <span>{row.compareValue || '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payload View: Fields or JSON */}
            {viewMode === 'fields' ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">
                  Payload Parameter Breakdown
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs max-h-80 overflow-y-auto">
                  {diffResult.payloadDiff.map((field) => {
                    const isAdded = field.type === 'added';
                    const isRemoved = field.type === 'removed';
                    const isModified = field.type === 'modified';

                    return (
                      <div
                        key={field.path}
                        className={`grid grid-cols-1 md:grid-cols-3 p-3 gap-2 ${
                          isAdded
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/30'
                            : isRemoved
                            ? 'bg-red-50/60 dark:bg-red-950/30'
                            : isModified
                            ? 'bg-amber-50/60 dark:bg-amber-950/30'
                            : 'bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold ${
                              isAdded
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                                : isRemoved
                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                : isModified
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {field.type}
                          </span>
                          <span>{field.path}</span>
                        </div>

                        <div className="font-mono text-slate-500 overflow-x-auto">
                          {isAdded
                            ? '—'
                            : typeof field.baseValue === 'object'
                            ? JSON.stringify(field.baseValue)
                            : String(field.baseValue)}
                        </div>

                        <div className="font-mono font-bold text-slate-900 dark:text-slate-100 overflow-x-auto">
                          {isRemoved
                            ? '—'
                            : typeof field.compareValue === 'object'
                            ? JSON.stringify(field.compareValue)
                            : String(field.compareValue)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Raw JSON Side-by-Side */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-500 mb-1">
                    v{diffResult.baseVersion.version} Payload JSON
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-950 text-slate-300 font-mono text-xs overflow-x-auto max-h-80 border border-slate-800">
                    {diffResult.rawBaseJson}
                  </pre>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-500 mb-1">
                    v{diffResult.compareVersion.version} Payload JSON
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-950 text-slate-300 font-mono text-xs overflow-x-auto max-h-80 border border-slate-800">
                    {diffResult.rawCompareJson}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="flex items-center justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close Diff
          </button>
        </div>
      </div>
    </Modal>
  );
}
