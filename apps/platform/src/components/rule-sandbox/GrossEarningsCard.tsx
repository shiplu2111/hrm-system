import { AlertTriangle, Clock, DollarSign, ShieldAlert } from 'lucide-react';
import type { RuleSandboxGrossBreakdown } from '@hrm/shared-types';

interface GrossEarningsCardProps {
  gross: RuleSandboxGrossBreakdown;
  currency: string;
}

export function GrossEarningsCard({ gross, currency }: GrossEarningsCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center ring-1 ring-emerald-500/20">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Gross Earnings & Overtime
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                Step 1 · Gross
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Contracted base salary, itemized overtime multipliers, and attendance adjustments (PAYROLL_LOGIC.md §3, §9).
            </p>
          </div>
        </div>

        {/* Hourly Rate Chip */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          <span>
            Derived Hourly: <strong>{currency} {gross.hourlyRate.toFixed(2)}/hr</strong>
          </span>
          <span className="text-[11px] text-slate-400">
            ({gross.standardMonthlyHours.toFixed(1)}h/mo)
          </span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Overtime Cap Breach Notice */}
        {gross.overtimeCapBreach && gross.overtimeCapBreach.breached && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
              gross.overtimeCapBreach.action === 'auto_cap'
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}
          >
            <ShieldAlert className="h-5 w-5 shrink-0 text-current mt-0.5" />
            <div>
              <div className="font-bold text-sm mb-0.5">
                {gross.overtimeCapBreach.action === 'auto_cap'
                  ? 'Statutory Overtime Capped'
                  : 'Statutory Overtime Cap Breach Flagged'}
              </div>
              <p>{gross.overtimeCapBreach.message}</p>
            </div>
          </div>
        )}

        {/* Itemized Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-950/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Component</th>
                <th className="py-2.5 px-4 text-center">Hours / Units</th>
                <th className="py-2.5 px-4 text-center">Multiplier</th>
                <th className="py-2.5 px-4 text-right">Calculation</th>
                <th className="py-2.5 px-4 text-right">Amount ({currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {/* Base Salary */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                  Base Salary
                </td>
                <td className="py-3 px-4 text-center text-slate-500">
                  {gross.standardMonthlyHours.toFixed(1)} hrs
                </td>
                <td className="py-3 px-4 text-center text-slate-500">1.0×</td>
                <td className="py-3 px-4 text-right text-slate-500 font-mono">
                  Standard Contract
                </td>
                <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white font-mono">
                  {gross.baseSalary.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>

              {/* Overtime Lines */}
              {gross.overtimeLines.map((ot) => (
                <tr
                  key={ot.category}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                >
                  <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                    <span className="font-semibold">{ot.label}</span>
                  </td>
                  <td className="py-3 px-4 text-center font-mono">
                    {ot.hours.toFixed(1)} hrs
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                      {ot.multiplier.toFixed(2)}×
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-slate-500 font-mono">
                    {ot.hours}h × {currency}{ot.rate.toFixed(2)} × {ot.multiplier}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    +{ot.amount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}

              {/* Leave Deductions */}
              {gross.leaveDeductionLines.map((ld, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                >
                  <td className="py-3 px-4 text-rose-700 dark:text-rose-400 font-semibold">
                    {ld.leaveType}
                  </td>
                  <td className="py-3 px-4 text-center font-mono">{ld.daysOrHours}</td>
                  <td className="py-3 px-4 text-center text-slate-400">—</td>
                  <td className="py-3 px-4 text-right text-slate-500 font-mono">
                    Absence Deduction
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-rose-400 font-mono">
                    -{ld.amount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50/80 dark:bg-slate-950/80 border-t-2 border-slate-200 dark:border-slate-800 font-bold text-sm">
              <tr>
                <td colSpan={4} className="py-3 px-4 text-slate-800 dark:text-slate-100">
                  Total Gross Pay (Earnings)
                </td>
                <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400 font-mono text-base">
                  {currency}{' '}
                  {gross.totalGrossPay.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
