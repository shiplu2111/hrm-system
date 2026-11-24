// apps/platform/src/components/audit/PlatformAuditDiffViewer.tsx
import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  FileCode,
  Globe,
  Monitor,
  PlusCircle,
  MinusCircle,
  Tag,
} from 'lucide-react';

interface PlatformAuditDiffViewerProps {
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason?: string | null;
  recordId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

type TabType = 'diff' | 'raw_old' | 'raw_new';

function formatVal(val: unknown): string {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  return String(val);
}

export function PlatformAuditDiffViewer({
  oldValue,
  newValue,
  reason,
  recordId,
  ipAddress,
  userAgent,
  createdAt,
}: PlatformAuditDiffViewerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('diff');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showUnchanged, setShowUnchanged] = useState<boolean>(false);

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isCreation = oldValue === null || Object.keys(oldValue || {}).length === 0;
  const isDeletion = newValue === null || Object.keys(newValue || {}).length === 0;

  // Key-by-key comparison
  const diffEntries = useMemo(() => {
    const oldObj = oldValue || {};
    const newObj = newValue || {};
    const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)])).sort();

    return allKeys.map((key) => {
      const hasOld = key in oldObj;
      const hasNew = key in newObj;
      const valOld = (oldObj as any)[key];
      const valNew = (newObj as any)[key];

      let status: 'added' | 'removed' | 'modified' | 'unchanged' = 'unchanged';
      if (!hasOld && hasNew) {
        status = 'added';
      } else if (hasOld && !hasNew) {
        status = 'removed';
      } else if (JSON.stringify(valOld) !== JSON.stringify(valNew)) {
        status = 'modified';
      }

      return {
        key,
        status,
        oldValStr: hasOld ? formatVal(valOld) : undefined,
        newValStr: hasNew ? formatVal(valNew) : undefined,
      };
    });
  }, [oldValue, newValue]);

  const changedCount = diffEntries.filter((d) => d.status !== 'unchanged').length;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 p-4 space-y-4 text-xs font-sans">
      {/* Top Details Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
        <div>
          <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">
            Record ID
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <code className="font-mono text-slate-800 dark:text-slate-200 truncate select-all">
              {recordId || 'N/A (Platform Scope)'}
            </code>
            {recordId && (
              <button
                type="button"
                onClick={() => handleCopy(recordId, 'recordId')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition"
                title="Copy Record ID"
              >
                {copiedKey === 'recordId' ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            )}
          </div>
        </div>

        <div>
          <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">
            IP Address
          </span>
          <div className="flex items-center gap-1.5 mt-0.5 text-slate-700 dark:text-slate-300 font-mono">
            <Globe className="h-3.5 w-3.5 text-slate-400" />
            <span>{ipAddress || 'Internal / Service'}</span>
          </div>
        </div>

        <div>
          <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">
            User Agent / Client
          </span>
          <div className="flex items-center gap-1.5 mt-0.5 text-slate-700 dark:text-slate-300 truncate" title={userAgent || 'Automated Internal Process'}>
            <Monitor className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{userAgent ? userAgent.split(') ')[0] + ')' : 'Internal Platform Service'}</span>
          </div>
        </div>

        <div>
          <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">
            Authoritative Timestamp
          </span>
          <div className="flex items-center gap-1.5 mt-0.5 text-slate-700 dark:text-slate-300 font-mono">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>{new Date(createdAt).toUTCString()}</span>
          </div>
        </div>
      </div>

      {/* Mandatory Reason Banner */}
      {reason && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-[11px] uppercase tracking-wider text-amber-800 dark:text-amber-300 block mb-0.5">
              Operator Stated Reason
            </span>
            <p className="text-xs leading-relaxed italic font-medium">"{reason}"</p>
          </div>
        </div>
      )}

      {/* Tabs & Controls */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('diff')}
            className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition flex items-center gap-1.5 ${
              activeTab === 'diff'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            <span>State Diff ({isCreation ? 'Created' : isDeletion ? 'Deleted' : `${changedCount} changed`})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('raw_old')}
            className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition flex items-center gap-1.5 ${
              activeTab === 'raw_old'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <FileCode className="h-3.5 w-3.5" />
            <span>Before (JSON)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('raw_new')}
            className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition flex items-center gap-1.5 ${
              activeTab === 'raw_new'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <FileCode className="h-3.5 w-3.5" />
            <span>After (JSON)</span>
          </button>
        </div>

        {activeTab === 'diff' && !isCreation && !isDeletion && (
          <label className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showUnchanged}
              onChange={(e) => setShowUnchanged(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Show unchanged fields</span>
          </label>
        )}
      </div>

      {/* TAB CONTENT: DIFF */}
      {activeTab === 'diff' && (
        <div className="space-y-2">
          {isCreation ? (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-800 dark:text-emerald-300 font-semibold mb-2">
              ✨ New Entity Provisioned / Created (Initial State)
            </div>
          ) : isDeletion ? (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-800 dark:text-red-300 font-semibold mb-2">
              🗑️ Entity Permanently Deleted or Cancelled
            </div>
          ) : null}

          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-950 divide-y divide-slate-100 dark:divide-slate-800/60">
            {diffEntries
              .filter((d) => showUnchanged || d.status !== 'unchanged' || isCreation || isDeletion)
              .map((entry) => {
                if (entry.status === 'added' || isCreation) {
                  return (
                    <div
                      key={entry.key}
                      className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/20 flex flex-col md:flex-row md:items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 font-mono text-emerald-900 dark:text-emerald-300 font-bold min-w-[200px]">
                        <PlusCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span>{entry.key}</span>
                      </div>
                      <div className="font-mono text-emerald-800 dark:text-emerald-200 break-all flex-1 text-right">
                        {entry.newValStr}
                      </div>
                    </div>
                  );
                }

                if (entry.status === 'removed' || isDeletion) {
                  return (
                    <div
                      key={entry.key}
                      className="p-2.5 bg-red-50/60 dark:bg-red-950/20 flex flex-col md:flex-row md:items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 font-mono text-red-900 dark:text-red-300 font-bold min-w-[200px]">
                        <MinusCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        <span>{entry.key}</span>
                      </div>
                      <div className="font-mono text-red-800 dark:text-red-200 line-through break-all flex-1 text-right">
                        {entry.oldValStr}
                      </div>
                    </div>
                  );
                }

                if (entry.status === 'modified') {
                  return (
                    <div
                      key={entry.key}
                      className="p-2.5 bg-amber-50/40 dark:bg-amber-950/10 flex flex-col md:flex-row items-stretch gap-2"
                    >
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-200 min-w-[180px] self-start md:self-center">
                        {entry.key}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 flex-1 font-mono text-xs">
                        <div className="p-2 rounded bg-red-50/70 dark:bg-red-950/40 border border-red-200/60 dark:border-red-900/40 text-red-700 dark:text-red-300 break-all">
                          <span className="block text-[10px] text-red-500 font-bold uppercase mb-0.5">
                            Before
                          </span>
                          <span className="line-through">{entry.oldValStr}</span>
                        </div>
                        <div className="p-2 rounded bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 break-all">
                          <span className="block text-[10px] text-emerald-500 font-bold uppercase mb-0.5">
                            After
                          </span>
                          <span>{entry.newValStr}</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Unchanged
                return (
                  <div
                    key={entry.key}
                    className="p-2 text-slate-500 dark:text-slate-400 flex items-center justify-between font-mono"
                  >
                    <span className="font-medium text-slate-600 dark:text-slate-300 min-w-[200px]">
                      {entry.key}
                    </span>
                    <span className="truncate max-w-md">{entry.newValStr}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB CONTENT: RAW OLD */}
      {activeTab === 'raw_old' && (
        <div className="relative">
          <button
            type="button"
            onClick={() => handleCopy(JSON.stringify(oldValue, null, 2), 'raw_old')}
            className="absolute top-2 right-2 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 font-sans transition"
          >
            {copiedKey === 'raw_old' ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            <span>Copy</span>
          </button>
          <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-80 border border-slate-800">
            {oldValue ? JSON.stringify(oldValue, null, 2) : '// No previous state (Created)'}
          </pre>
        </div>
      )}

      {/* TAB CONTENT: RAW NEW */}
      {activeTab === 'raw_new' && (
        <div className="relative">
          <button
            type="button"
            onClick={() => handleCopy(JSON.stringify(newValue, null, 2), 'raw_new')}
            className="absolute top-2 right-2 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 font-sans transition"
          >
            {copiedKey === 'raw_new' ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            <span>Copy</span>
          </button>
          <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-80 border border-slate-800">
            {newValue ? JSON.stringify(newValue, null, 2) : '// No new state (Deleted)'}
          </pre>
        </div>
      )}
    </div>
  );
}
