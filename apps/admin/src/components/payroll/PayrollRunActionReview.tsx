import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { PayrollPeriodRecord, PayrollRunRecord } from '@hrm/shared-types';
import { baseCurrencyOf, flowIndex, periodLabel, toCents, type ActionPlan } from '@/lib/payroll-run-flow';
import { payrollRunsCopy } from '@/lib/payroll-runs-copy';
import { formatDate, formatMoney } from '@/lib/payroll-copy';

const copy = payrollRunsCopy.confirm;

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm rounded-lg border border-warning-200 dark:border-warning-800 bg-warning-50 dark:bg-warning-900/20 px-3 py-2 text-warning-800 dark:text-warning-200">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warning-600" />
      <span>{children}</span>
    </div>
  );
}

/** Employees left behind in earlier steps when a whole step moves forward. */
function excludedCount(plan: ActionPlan, allRuns: PayrollRunRecord[]): number {
  if (!plan.fromStatus || !['approve', 'finalize', 'pay'].includes(plan.action)) return 0;
  const from = flowIndex(plan.fromStatus);
  return allRuns.filter((run) => run.status !== 'cancelled' && flowIndex(run.status) < from).length;
}

export function PayrollRunActionReview({
  plan,
  period,
  allRuns,
  stale,
}: {
  plan: ActionPlan;
  period: PayrollPeriodRecord;
  allRuns: PayrollRunRecord[];
  stale: boolean;
}) {
  const currency = baseCurrencyOf(plan.runs) ?? '';
  const mixedCurrency = plan.runs.some((run) => run.payCurrency && run.payCurrency !== run.baseCurrency);
  const zeroNet = plan.action === 'cancel' ? 0 : plan.runs.filter((run) => toCents(run.netPay) === 0).length;
  const excluded = excludedCount(plan, allRuns);
  const sortedRuns = [...plan.runs].sort((a, b) => (a.employeeName ?? '').localeCompare(b.employeeName ?? ''));

  const rows: Array<{ label: string; value: string; strong?: boolean }> = [
    { label: copy.summaryPeriod, value: `${periodLabel(period)} (${formatDate(period.startDate)} – ${formatDate(period.endDate)})` },
    { label: copy.summaryPayment, value: formatDate(period.paymentDate) },
    { label: copy.summaryEmployees, value: String(plan.totals.runCount), strong: true },
    { label: copy.summaryGross, value: `${formatMoney(plan.totals.grossPay)} ${currency}`.trim(), strong: true },
    { label: copy.summaryDeductions, value: `${formatMoney(plan.totals.totalDeductions)} ${currency}`.trim() },
    { label: copy.summaryNet, value: `${formatMoney(plan.totals.netPay)} ${currency}`.trim(), strong: true },
  ];

  return (
    <div className="space-y-4">
      {stale ? (
        <div
          role="status"
          className="flex items-start gap-2 text-sm rounded-lg border border-accent-200 dark:border-accent-800 bg-accent-50 dark:bg-accent-950/30 px-3 py-2 text-accent-800 dark:text-accent-200"
        >
          <RefreshCw className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{copy.stale}</span>
        </div>
      ) : null}

      <div className="rounded-lg border border-base overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-[rgb(var(--border-base))]">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="px-4 py-2.5 text-secondary">{row.label}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${row.strong ? 'font-semibold text-primary' : 'text-primary'}`}>
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mixedCurrency && currency ? <p className="text-xs text-secondary">{copy.currencyNote(currency)}</p> : null}
      {zeroNet > 0 ? <Warning>{payrollRunsCopy.detail.zeroNet(zeroNet)}</Warning> : null}
      {excluded > 0 ? <Warning>{copy.excluded(excluded)}</Warning> : null}

      {plan.action === 'finalize' ? (
        <ul className="list-disc pl-5 space-y-1 text-sm text-secondary">
          {copy.finalizeEffects.map((effect) => (
            <li key={effect}>{effect}</li>
          ))}
        </ul>
      ) : null}

      <details className="rounded-lg border border-base">
        <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wide">
          {copy.employeesList} ({plan.runs.length})
        </summary>
        <ul className="max-h-48 overflow-y-auto divide-y divide-[rgb(var(--border-base))] border-t border-base">
          {sortedRuns.map((run) => (
            <li key={run.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="text-primary truncate">
                {run.employeeName ?? run.employeeId}
                {run.employeeNumber ? <span className="ml-1.5 text-xs text-muted">{run.employeeNumber}</span> : null}
              </span>
              <span className="tabular-nums text-secondary shrink-0">
                {formatMoney(run.netPay)} {run.payCurrency ?? ''}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
