import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Filter,
  Globe,
  Layers,
  RefreshCw,
  Search,
  Upload,
  X,
} from 'lucide-react';
import type { MissingKeysReport } from '@hrm/shared-types';
import {
  exportPlatformLanguagePack,
  getPlatformMissingKeysReport,
} from '@/lib/platform-language-packs-api';

interface MissingKeysReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  languageCode: string;
  languageName: string;
  onOpenImport?: (code: string) => void;
}

export function MissingKeysReportModal({
  isOpen,
  onClose,
  languageCode,
  languageName,
  onOpenImport,
}: MissingKeysReportModalProps) {
  const [report, setReport] = useState<MissingKeysReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [searchKey, setSearchKey] = useState<string>('');
  const [downloading, setDownloading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !languageCode) return;
    loadReport();
  }, [isOpen, languageCode]);

  const loadReport = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await getPlatformMissingKeysReport(languageCode);
      setReport(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load missing-keys report.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleDownloadTemplate = async () => {
    try {
      setDownloading(true);
      const { filename, jsonContent } = await exportPlatformLanguagePack(
        languageCode,
        'missing-template',
      );
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Failed to export missing keys template.');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  // Filter keys
  const filteredKeys = (report?.missingKeys || []).filter((item) => {
    if (selectedNamespace !== 'all' && item.namespace !== selectedNamespace) {
      return false;
    }
    if (searchKey.trim()) {
      const q = searchKey.toLowerCase();
      return (
        item.key.toLowerCase().includes(q) ||
        item.baseValue.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Missing Keys Report: {languageName}
                </h3>
                <span className="font-mono text-xs uppercase px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                  {languageCode}
                </span>
                {report && (
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      report.completenessPercent >= 90
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : report.completenessPercent >= 50
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                    }`}
                  >
                    {report.completenessPercent}% Complete
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Comparison of keys against global reference language (English · EN).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={downloading || !report || report.missingKeysCount === 0}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Download className={`w-3.5 h-3.5 ${downloading ? 'animate-bounce' : ''}`} />
              Export Missing Template (JSON)
            </button>
            {onOpenImport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenImport(languageCode);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                Import Translations
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {loading && (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm font-medium">Computing translation catalog diff & missing keys...</p>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!loading && report && (
            <>
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Total Base Keys
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
                    {report.totalBaseKeys.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Reference English keys</div>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
                  <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    Translated Keys
                  </div>
                  <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-1">
                    {report.translatedKeys.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                    {report.completenessPercent}% completeness
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                  <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                    Missing Keys
                  </div>
                  <div className="text-xl font-bold font-mono text-amber-700 dark:text-amber-300 mt-1">
                    {report.missingKeysCount.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                    Require localization
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40">
                  <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                    Namespaces
                  </div>
                  <div className="text-xl font-bold font-mono text-indigo-700 dark:text-indigo-300 mt-1">
                    {report.namespaces.length} Modules
                  </div>
                  <div className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">
                    Functional sections
                  </div>
                </div>
              </div>

              {/* Completeness Bar */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">
                    Overall Translation Progress
                  </span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">
                    {report.translatedKeys} / {report.totalBaseKeys} keys ({report.completenessPercent}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      report.completenessPercent >= 90
                        ? 'bg-emerald-500'
                        : report.completenessPercent >= 50
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${report.completenessPercent}%` }}
                  />
                </div>
              </div>

              {/* Namespaces Breakdown Chips */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Module / Namespace Completeness Breakdown:</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Click module to filter keys
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedNamespace('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      selectedNamespace === 'all'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    All Modules ({report.missingKeysCount} missing)
                  </button>

                  {report.namespaces.map((ns) => {
                    const isSelected = selectedNamespace === ns.namespace;
                    return (
                      <button
                        key={ns.namespace}
                        type="button"
                        onClick={() => setSelectedNamespace(ns.namespace)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                          isSelected
                            ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 border-slate-800 dark:border-slate-200'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        <span>{ns.namespace}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            ns.missingKeys === 0
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {ns.missingKeys === 0 ? '100%' : `-${ns.missingKeys}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Missing Keys Search & Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchKey}
                      onChange={(e) => setSearchKey(e.target.value)}
                      placeholder="Search missing key path or English base text..."
                      className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="text-xs text-slate-500 whitespace-nowrap">
                    Showing <span className="font-bold text-slate-900 dark:text-slate-100">{filteredKeys.length}</span> of {report.missingKeysCount} missing keys
                  </div>
                </div>

                {filteredKeys.length === 0 ? (
                  <div className="p-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-center space-y-1">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                    <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                      No Missing Keys in this View!
                    </h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      All translation keys for this module or search query have been localized.
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                          <th className="py-2.5 px-3">Translation Key Path</th>
                          <th className="py-2.5 px-3">Module</th>
                          <th className="py-2.5 px-3">Reference English String</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredKeys.slice(0, 100).map((item) => (
                          <tr
                            key={item.key}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-slate-100 text-[11px]">
                              {item.key}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                                {item.namespace}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-md truncate">
                              "{item.baseValue}"
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  item.status === 'missing'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleCopyKey(item.key)}
                                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                title="Copy key name"
                              >
                                {copiedKey === item.key ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredKeys.length > 100 && (
                      <div className="py-2 px-3 text-center text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800">
                        Showing first 100 of {filteredKeys.length} matching missing keys. Export the missing keys template to inspect and translate all keys.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="text-xs text-slate-500">
            Export template $\rightarrow$ translate missing values $\rightarrow$ import JSON to update completeness.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
