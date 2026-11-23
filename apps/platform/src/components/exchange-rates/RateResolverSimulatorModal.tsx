import React, { useState } from 'react';
import {
  X,
  Play,
  Calculator,
  Globe,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  BookOpen,
} from 'lucide-react';
import { COMMON_CURRENCIES } from '@hrm/shared-types';
import type { ResolvedPlatformExchangeRate } from '@hrm/shared-types';
import { resolvePlatformExchangeRate } from '@/lib/platform-exchange-rates-api';

interface RateResolverSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBase?: string;
  initialQuote?: string;
}

export function RateResolverSimulatorModal({
  isOpen,
  onClose,
  initialBase = 'AUD',
  initialQuote = 'USD',
}: RateResolverSimulatorModalProps) {
  const [baseCurrency, setBaseCurrency] = useState(initialBase);
  const [quoteCurrency, setQuoteCurrency] = useState(initialQuote);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState<ResolvedPlatformExchangeRate | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSimulate = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await resolvePlatformExchangeRate(baseCurrency, quoteCurrency, asOfDate);
      setResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'No exchange rate could be resolved for this date.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-850/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Platform Exchange Rate Resolver Sandbox
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Simulate how multi-currency payroll calculations resolve rates against effective dates.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Base Currency (Payment)
              </label>
              <select
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 font-bold"
              >
                {COMMON_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Quote Currency (Contract)
              </label>
              <select
                value={quoteCurrency}
                onChange={(e) => setQuoteCurrency(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 font-bold"
              >
                {COMMON_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Payroll Period End / Calculation Date
            </label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2"
            />
          </div>

          <button
            type="button"
            onClick={handleSimulate}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Resolve Effective Platform Rate
          </button>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {result && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-500 uppercase">
                  Resolved Calculation Result
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    result.source === 'platform_manual_override'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : result.source === 'platform_default'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}
                >
                  {result.source.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Direct Rate (1 {result.quoteCurrency})
                  </span>
                  <span className="font-mono font-black text-base text-slate-900 dark:text-white block mt-0.5">
                    {result.rate} {result.baseCurrency}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Inverse Rate (1 {result.baseCurrency})
                  </span>
                  <span className="font-mono text-sm text-slate-700 dark:text-slate-300 block mt-0.5">
                    {result.inverseRate} {result.quoteCurrency}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Effective Dates: {result.effectiveFrom || 'Open-ended'} to {result.effectiveTo || 'Present (Active)'}</span>
                </div>
                {result.overrideReason && (
                  <div className="text-amber-800 dark:text-amber-300 font-medium">
                    <strong>Manual Override Reason:</strong> "{result.overrideReason}"
                  </div>
                )}
                {result.providerName && (
                  <div>
                    <strong>Provider Feed:</strong> {result.providerName}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Building2 className="w-4 h-4 text-emerald-500" />
            Tenants inherit this platform default rate unless overridden per Phase 2 Stage 24.1.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
          >
            Close Simulator
          </button>
        </div>
      </div>
    </div>
  );
}
