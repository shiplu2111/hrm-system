import { Calculator, Percent, Sparkles } from 'lucide-react';
import type { RuleSandboxTaxBreakdown } from '@hrm/shared-types';

interface TaxBracketsCardProps {
  tax: RuleSandboxTaxBreakdown;
  currency: string;
}

export function TaxBracketsCard({ tax, currency }: TaxBracketsCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center ring-1 ring-rose-500/20">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Statutory Income Tax & Progressive Brackets
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
                Step 2 · Tax
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Annualized bracket progression, marginal tax tiers, and statutory rebates (PAYROLL_LOGIC.md §10).
            </p>
          </div>
        </div>

        {/* Effective Rate Chip */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-xs font-semibold text-rose-700 dark:text-rose-300">
            Effective Tax Rate:{' '}
            <strong className="text-rose-900 dark:text-rose-100 font-bold">
              {tax.effectiveTaxRate.toFixed(2)}%
            </strong>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Taxable Base Overview Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <div className="text-slate-500 text-[11px]">Period Taxable Gross</div>
            <div className="font-bold text-sm text-slate-900 dark:text-white font-mono mt-0.5">
              {currency}{' '}
              {tax.periodTaxableIncome.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
          <div>
            <div className="text-slate-500 text-[11px]">Annualized Taxable Income</div>
            <div className="font-bold text-sm text-slate-900 dark:text-white font-mono mt-0.5">
              {currency}{' '}
              {tax.annualTaxableIncome.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
          <div>
            <div className="text-slate-500 text-[11px]">Tax Schedule & Filing Status</div>
            <div className="font-bold text-sm text-indigo-600 dark:text-indigo-400 mt-0.5">
              FY {tax.taxYear} · {tax.filingStatus || 'Standard Resident'}
            </div>
          </div>
        </div>

        {/* Progressive Brackets Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-950/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4 text-center">Tier</th>
                <th className="py-2.5 px-4">Bracket Range (Annual)</th>
                <th className="py-2.5 px-4 text-center">Marginal Rate</th>
                <th className="py-2.5 px-4 text-right">Taxable in Tier</th>
                <th className="py-2.5 px-4 text-right">Tax Assessed ({currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {tax.brackets.map((b) => {
                const isActive = b.taxableAmountInBracket > 0;
                return (
                  <tr
                    key={b.bracketIndex}
                    className={
                      isActive
                        ? 'bg-rose-50/20 dark:bg-rose-950/10'
                        : 'opacity-60 hover:opacity-100 transition-opacity'
                    }
                  >
                    <td className="py-2.5 px-4 text-center font-bold text-slate-500">
                      #{b.bracketIndex}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {currency} {b.from.toLocaleString()} —{' '}
                        {b.to != null ? `${currency} ${b.to.toLocaleString()}` : 'Unlimited'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {b.explanation}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.rate === 0
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {b.rate}%
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-600 dark:text-slate-300">
                      {currency}{' '}
                      {b.taxableAmountInBracket.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold font-mono text-slate-900 dark:text-white">
                      {currency}{' '}
                      {b.taxAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50/80 dark:bg-slate-950/80 border-t-2 border-slate-200 dark:border-slate-800 font-bold text-xs">
              {/* Rebates if any */}
              {tax.rebatesApplied.map((rebate) => (
                <tr key={rebate.code} className="text-emerald-600 dark:text-emerald-400">
                  <td colSpan={4} className="py-2 px-4">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Less Statutory Rebate: {rebate.name} ({rebate.code})
                    </span>
                  </td>
                  <td className="py-2 px-4 text-right font-mono">
                    -{currency}{' '}
                    {rebate.amount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-slate-200 dark:border-slate-800">
                <td colSpan={4} className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                  Annual Net Tax Assessed
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white">
                  {currency}{' '}
                  {tax.annualNetTax.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
              <tr className="bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-sm">
                <td colSpan={4} className="py-3 px-4 font-extrabold">
                  Monthly Tax Withholding Deduction
                </td>
                <td className="py-3 px-4 text-right font-black font-mono text-base">
                  {currency}{' '}
                  {tax.periodTaxDeduction.toLocaleString(undefined, {
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
