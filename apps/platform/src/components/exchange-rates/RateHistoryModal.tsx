import React, { useEffect, useState } from 'react';
import {
  X,
  History,
  Calendar,
  Clock,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Edit3,
  Globe,
  Tag,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import type { PlatformExchangeRateRecord } from '@hrm/shared-types';
import { getPlatformExchangeRateHistory } from '@/lib/platform-exchange-rates-api';

interface RateHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseCurrency: string;
  quoteCurrency: string;
  onOpenOverride: (base: string, quote: string) => void;
}

export function RateHistoryModal({
  isOpen,
  onClose,
  baseCurrency,
  quoteCurrency,
  onOpenOverride,
}: RateHistoryModalProps) {
  const [history, setHistory] = useState<PlatformExchangeRateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getPlatformExchangeRateHistory(baseCurrency, quoteCurrency);
      setHistory(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load rate history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, baseCurrency, quoteCurrency]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-850/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Exchange Rate History: {baseCurrency} / {quoteCurrency}
                </h3>
                <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300">
                  {history.length} Version{history.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Immutable rate history per currency pair. Historical rates are stored with effective dates and never overwritten.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenOverride(baseCurrency, quoteCurrency);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Manual Override
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Immutability & Effective Dating Notice */}
        <div className="px-5 py-3 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border-b border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Historical Rates are Immutable:</strong> Rates are effective-dated and never overwritten. Finalized payroll runs copy and lock their applicable rate as of the pay period end date.
            </span>
          </div>
          <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-amber-200/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-bold shrink-0">
            Never Overwritten
          </span>
        </div>

        {/* History Table Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              Loading exchange rate history...
            </div>
          ) : errorMsg ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs">
              {errorMsg}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              No historical rates found for this currency pair.
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Effective Date Range</th>
                    <th className="px-4 py-3">Direct Rate (1 {quoteCurrency})</th>
                    <th className="px-4 py-3">Inverse Rate (1 {baseCurrency})</th>
                    <th className="px-4 py-3">Rate Source</th>
                    <th className="px-4 py-3">Provider / Override Reason</th>
                    <th className="px-4 py-3 text-right">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {history.map((record, index) => {
                    const isOverride = record.source === 'manual_override';
                    const isCurrent = !record.effectiveTo || new Date(record.effectiveTo) >= new Date();

                    return (
                      <tr
                        key={record.id}
                        className={`hover:bg-slate-50/60 dark:hover:bg-slate-850/50 transition-colors ${
                          isOverride ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''
                        }`}
                      >
                        {/* Effective Range */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{record.effectiveFrom}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span>{record.effectiveTo || 'Present (Active)'}</span>
                          </div>
                          {isCurrent && index === 0 && (
                            <span className="inline-block mt-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              Active In Force
                            </span>
                          )}
                        </td>

                        {/* Direct Rate */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                            {record.rate}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1">
                            {baseCurrency}
                          </span>
                        </td>

                        {/* Inverse Rate */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                            {record.inverseRate || (1 / Number(record.rate)).toFixed(8)}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1">
                            {quoteCurrency}
                          </span>
                        </td>

                        {/* Source Badge */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isOverride
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                : record.source === 'provider'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {isOverride ? 'Manual Override' : record.source}
                          </span>
                        </td>

                        {/* Provider / Reason */}
                        <td className="px-4 py-3">
                          {isOverride && record.overrideReason ? (
                            <div className="text-amber-900 dark:text-amber-200 font-medium">
                              <span className="font-bold">Reason:</span> "{record.overrideReason}"
                            </div>
                          ) : (
                            <div className="text-slate-500 dark:text-slate-400">
                              {record.providerName || record.notes || 'Platform baseline'}
                            </div>
                          )}
                        </td>

                        {/* Created timestamp */}
                        <td className="px-4 py-3 whitespace-nowrap text-right font-mono text-[11px] text-slate-400">
                          {new Date(record.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Tenants inherit this platform rate history unless overridden in tenant settings (Phase 2 Stage 24.1).
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
          >
            Close History
          </button>
        </div>
      </div>
    </div>
  );
}
