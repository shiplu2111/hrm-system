import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  FileJson,
  FileText,
  Info,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { importPlatformLanguagePack } from '@/lib/platform-language-packs-api';

interface ImportLanguagePackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  languageCode: string;
  languageName: string;
}

export function ImportLanguagePackModal({
  isOpen,
  onClose,
  onSuccess,
  languageCode,
  languageName,
}: ImportLanguagePackModalProps) {
  const [jsonInput, setJsonInput] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [markAvailableIfComplete, setMarkAvailableIfComplete] = useState(true);
  const [notes, setNotes] = useState('');

  const [parsingError, setParsingError] = useState<string | null>(null);
  const [parsedKeyCount, setParsedKeyCount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTextChange = (text: string) => {
    setJsonInput(text);
    setErrorMsg(null);
    if (!text.trim()) {
      setParsingError(null);
      setParsedKeyCount(null);
      return;
    }

    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setParsingError('JSON must be an object (nested key-value pairs).');
        setParsedKeyCount(null);
      } else {
        setParsingError(null);
        // Estimate keys count
        const countKeys = (obj: any): number => {
          let count = 0;
          for (const key of Object.keys(obj)) {
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
              count += countKeys(obj[key]);
            } else {
              count++;
            }
          }
          return count;
        };
        setParsedKeyCount(countKeys(parsed));
      }
    } catch (e: any) {
      setParsingError(e.message || 'Invalid JSON syntax');
      setParsedKeyCount(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleTextChange(content);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jsonInput.trim()) {
      setErrorMsg('Please upload a JSON file or paste translation JSON.');
      return;
    }
    if (parsingError) {
      setErrorMsg('Cannot submit invalid JSON. Please fix syntax errors first.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      const parsedObj = JSON.parse(jsonInput);

      await importPlatformLanguagePack(languageCode, {
        translations: parsedObj,
        mode,
        markAvailableIfComplete,
        notes: notes.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to import translations.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Import Translations: {languageName} ({languageCode.toUpperCase()})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload or paste JSON dictionary to update translations and recompute completeness.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* File Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Upload JSON Translation File
            </label>
            <div className="flex items-center gap-3">
              <label className="flex-1 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-xl p-3 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-800/30">
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <FileJson className="w-4 h-4 text-indigo-500" />
                  {fileName ? (
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {fileName}
                    </span>
                  ) : (
                    <span>Choose JSON file or drag here</span>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Paste Raw JSON */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Or Paste JSON Content
              </label>
              {parsedKeyCount !== null && (
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {parsedKeyCount} translation keys detected
                </span>
              )}
              {parsingError && (
                <span className="text-[11px] font-mono text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Syntax Error
                </span>
              )}
            </div>
            <textarea
              rows={8}
              value={jsonInput}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder='{\n  "common": {\n    "save": "Guardar",\n    "cancel": "Cancelar"\n  }\n}'
              className="w-full p-3 font-mono text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {parsingError && (
              <p className="text-[11px] text-red-500 mt-1">{parsingError}</p>
            )}
          </div>

          {/* Import Mode Options */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <label
              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                mode === 'merge'
                  ? 'bg-indigo-50/70 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-700'
                  : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="importMode"
                checked={mode === 'merge'}
                onChange={() => setMode('merge')}
                className="mt-0.5 text-indigo-600"
              />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Merge With Existing
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Overwrites matching keys, preserves untouched existing translations (Recommended).
                </div>
              </div>
            </label>

            <label
              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                mode === 'replace'
                  ? 'bg-amber-50/70 border-amber-300 dark:bg-amber-950/40 dark:border-amber-700'
                  : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="importMode"
                checked={mode === 'replace'}
                onChange={() => setMode('replace')}
                className="mt-0.5 text-amber-600"
              />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Replace Entire Catalog
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Completely replaces the current translation catalog with incoming payload.
                </div>
              </div>
            </label>
          </div>

          {/* Auto availability toggle */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Auto-enable Tenant Availability
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                Mark available to tenants if completeness reaches 95% or higher after import.
              </div>
            </div>
            <input
              type="checkbox"
              checked={markAvailableIfComplete}
              onChange={(e) => setMarkAvailableIfComplete(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Import Changelog / Release Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Translated 150 missing keys in payroll and settings modules"
              className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !jsonInput.trim() || !!parsingError}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${submitting ? 'animate-spin' : ''}`} />
              {submitting ? 'Importing Translations...' : 'Import & Recalculate Completeness'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
