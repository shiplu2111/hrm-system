import React, { useState } from 'react';
import {
  X,
  Edit3,
  AlertTriangle,
  ArrowRight,
  Check,
  RefreshCw,
  ShieldAlert,
  Calendar,
  DollarSign,
  Info,
} from 'lucide-react';
import { COMMON_CURRENCIES } from '@hrm/shared-types';
import { createPlatformManualOverride } from '@/lib/platform-exchange-rates-api';

interface ManualOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialBase?: string;
  initialQuote?: string;
}

export function ManualOverrideModal({
  isOpen,
  onClose,
  onSuccess,
  initialBase = 'AUD',
  initialQuote = 'USD',
}: ManualOverrideModalProps) {
  const [baseCurrency, setBaseCurrency] = useState(initialBase);
  const [quoteCurrency, setQuoteCurrency] = useState(initialQuote);
  const [rate, setRate] = useState<string>('');
  const [inverseRate, setInverseRate] = useState<string>('');
  const [effectiveFrom, setEffectiveFrom] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [effectiveTo, setEffectiveTo] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-calculate rates in both directions
  const handleRateChange = (val: string) => {
    setRate(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setInverseRate((1 / num).toFixed(8));
    } else {
      setInverseRate('');
    }
  };

  const handleInverseRateChange = (val: string) => {
    setInverseRate(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setRate((1 / num).toFixed(8));
    } else {
      setRate('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      setErrorMsg('A valid reason for manual override is mandatory (at least 5 characters).');
      return;
    }
    const numRate = parseFloat(rate);
    if (isNaN(numRate) || numRate <= 0) {
      setErrorMsg('Please specify a positive exchange rate.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      await createPlatformManualOverride({
        baseCurrency,
        quoteCurrency,
        rate: numRate.toFixed(8),
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to apply manual exchange rate override');
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
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Platform Manual Exchange Rate Override
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Apply an administrative override for {baseCurrency} / {quoteCurrency} with mandatory audit reason.
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Policy Notice */}
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Platform Default Override Notice:</span>
            </div>
            <p className="leading-relaxed">
              This sets a new platform default for <strong>{baseCurrency} / {quoteCurrency}</strong>. Individual tenants can override this in organization currency settings (Phase 2 Stage 24.1). <strong>Existing historical rates are never overwritten.</strong>
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Currency Pair Pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Base Currency (Payment / Target) *
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
                Quote Currency (Contract / Source) *
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

          {/* Rate and Inverse Rate inputs (Bidirectional) */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Direct Rate (1 {quoteCurrency} in {baseCurrency}) *
              </label>
              <input
                type="number"
                step="0.00000001"
                min="0.00000001"
                required
                value={rate}
                onChange={(e) => handleRateChange(e.target.value)}
                placeholder="e.g. 1.54200000"
                className="w-full text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Base units per 1 quote unit
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Inverse Rate (1 {baseCurrency} in {quoteCurrency})
              </label>
              <input
                type="number"
                step="0.00000001"
                min="0.00000001"
                value={inverseRate}
                onChange={(e) => handleInverseRateChange(e.target.value)}
                placeholder="e.g. 0.64850843"
                className="w-full text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Quote units per 1 base unit
              </span>
            </div>
          </div>

          {/* Effective Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Effective From Date *
              </label>
              <input
                type="date"
                required
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Effective To Date (Optional)
              </label>
              <input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                placeholder="Open-ended"
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2"
              />
            </div>
          </div>

          {/* Mandatory Reason (Audit Policy) */}
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center justify-between">
              <span>Reason for Manual Override * (Mandatory Audit Requirement)</span>
              <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400">Required</span>
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Central Bank official circular #42 fixing statutory rate for Q4 payroll..."
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* Administrative Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Internal Documentation / References
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Approved by Platform Financial Officer on 2026-11-23"
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              {loading ? 'Applying Override...' : 'Apply Manual Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
