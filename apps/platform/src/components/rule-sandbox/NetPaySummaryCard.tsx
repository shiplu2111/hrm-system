import { CheckCircle2, ShieldCheck, Wallet } from 'lucide-react';
import type { RuleSandboxSummary } from '@hrm/shared-types';

interface NetPaySummaryCardProps {
  summary: RuleSandboxSummary;
  currency: string;
}

export function NetPaySummaryCard({ summary, currency }: NetPaySummaryCardProps) {
  return (
    <div className="rounded-2xl border-2 border-indigo-500/30 dark:border-indigo-500/40 bg-gradient-to-br from-indigo-900/10 via-white to-sky-900/10 dark:from-indigo-950/40 dark:via-slate-900 dark:to-sky-950/30 shadow-md p-6 overflow-hidden relative">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-lg text-slate-900 dark:text-white">
              Net Pay & Financial Summary
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Deterministic Gross-to-Net payroll output (PAYROLL_LOGIC.md §6).
            </p>
          </div>
        </div>

        {/* Non-mutation Assurance Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Dry Run · Zero Database Mutations</span>
        </div>
      </div>

      {/* Main Figures Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border border-slate-200 dark:border-slate-800 shadow-xs mb-6">
        {/* Gross */}
        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Gross Pay
          </span>
          <div className="font-extrabold text-xl text-slate-800 dark:text-slate-100 font-mono">
            {currency}{' '}
            {summary.grossEarnings.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <p className="text-[10px] text-slate-400">Contracted base + overtime - leave</p>
        </div>

        {/* Total Deductions */}
        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500">
            Total Deductions
          </span>
          <div className="font-extrabold text-xl text-rose-600 dark:text-rose-400 font-mono">
            -{currency}{' '}
            {summary.totalDeductions.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <p className="text-[10px] text-slate-400">Income tax & employee contributions</p>
        </div>

        {/* Net Take-Home Pay Hero */}
        <div className="space-y-1 md:border-l md:border-r border-slate-200 dark:border-slate-800 md:px-4">
          <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Net Take-Home Pay
          </span>
          <div className="font-black text-2xl text-indigo-600 dark:text-indigo-300 font-mono tracking-tight">
            {currency}{' '}
            {summary.netPay.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
            {summary.netToGrossRatio}% of gross earnings
          </div>
        </div>

        {/* Employer Total Employment Cost */}
        <div className="space-y-1 md:pl-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            Total Employer Cost
          </span>
          <div className="font-extrabold text-xl text-sky-700 dark:text-sky-300 font-mono">
            {currency}{' '}
            {summary.totalEmployerCost.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <p className="text-[10px] text-slate-400">
            Includes {currency} {summary.totalEmployerContributions.toFixed(2)} statutory on-costs
          </p>
        </div>
      </div>

      {/* Progress Bar Visualizing Split */}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
          <span>Net Take-Home ({summary.netToGrossRatio}%)</span>
          <span>Deductions ({summary.effectiveTaxRate.toFixed(1)}% Tax + Contributions)</span>
        </div>
        <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, summary.netToGrossRatio))}%` }}
          />
          <div
            className="h-full bg-rose-500 transition-all duration-500"
            style={{ width: `${Math.max(0, 100 - summary.netToGrossRatio)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
