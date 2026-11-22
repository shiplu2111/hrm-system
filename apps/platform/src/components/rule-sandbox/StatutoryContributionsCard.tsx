import { Building2, Landmark, ShieldCheck } from 'lucide-react';
import type { RuleSandboxContributionsBreakdown } from '@hrm/shared-types';

interface StatutoryContributionsCardProps {
  contributions: RuleSandboxContributionsBreakdown;
  currency: string;
}

export function StatutoryContributionsCard({
  contributions,
  currency,
}: StatutoryContributionsCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center ring-1 ring-sky-500/20">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Statutory Social Security & Superannuation
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300">
                Step 3 · Funds
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Mandatory employer superannuation guarantee and employee payroll withholdings (PAYROLL_LOGIC.md §4).
            </p>
          </div>
        </div>

        {/* Totals Summary */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            Emp. Deduction: <strong>{currency} {contributions.totalEmployeeContributions.toFixed(2)}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60">
            Empr. Contribution: <strong>{currency} {contributions.totalEmployerContributions.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Scheme List */}
        <div className="grid grid-cols-1 gap-3">
          {contributions.items.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {item.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {item.code}
                  </span>
                  {item.isPreTax && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                      Pre-Tax Deduction
                    </span>
                  )}
                </div>
                <div className="text-slate-500">
                  Assessed Base: <strong>{currency} {item.assessedBase.toLocaleString()}</strong> ({item.contributionBase} pay)
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-800 pt-3 sm:pt-0 sm:pl-4 text-right">
                <div>
                  <div className="text-[11px] text-slate-500">Employee Deduction</div>
                  <div className="font-bold text-sm font-mono text-slate-900 dark:text-white mt-0.5">
                    {currency} {item.employeeAmount.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400">({item.employeeRate}%)</div>
                </div>
                <div>
                  <div className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold">
                    Employer Contribution
                  </div>
                  <div className="font-bold text-sm font-mono text-sky-600 dark:text-sky-400 mt-0.5">
                    +{currency} {item.employerAmount.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-sky-500">({item.employerRate}%)</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
