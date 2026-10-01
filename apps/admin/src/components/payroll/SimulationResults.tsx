import { Loader2 } from 'lucide-react';
import type { PayrollSimulationResult } from '@hrm/shared-types';
import { compareLines } from '@/lib/payroll-simulation';
import { fromCents, toCents } from '@/lib/payroll-run-flow';
import { simulationCopy } from '@/lib/payroll-simulation-copy';
import { formatMoney, formatSignedMoney, payrollCopy } from '@/lib/payroll-copy';

const copy = simulationCopy.results;

function Diff({ cents, inverse = false }: { cents: number; inverse?: boolean }) {
  const favourable = inverse ? cents < 0 : cents > 0;
  return (
    <span
      className={`tabular-nums ${
        cents === 0 ? 'text-muted' : favourable ? 'text-success-700 dark:text-success-400' : 'text-error-700 dark:text-error-400'
      }`}
    >
      {formatSignedMoney(fromCents(cents))}
    </span>
  );
}

export function SimulationResults({ result, updating }: { result: PayrollSimulationResult; updating: boolean }) {
  const { baseline, simulated } = result;
  const currency = simulated.currency?.payCurrency ?? baseline.currency?.payCurrency ?? null;
  const lines = compareLines(baseline, simulated);
  const totals: Array<{ label: string; key: 'grossPay' | 'totalDeductions' | 'netPay'; strong?: boolean }> = [
    { label: copy.gross, key: 'grossPay' },
    { label: copy.deductions, key: 'totalDeductions' },
    { label: copy.net, key: 'netPay', strong: true },
  ];
  const superBefore = baseline.superannuation;
  const superAfter = simulated.superannuation;

  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-warning-300 dark:border-warning-700 surface shadow-card">
      <div
        aria-hidden
        className="pointer-events-none select-none absolute inset-0 flex items-center justify-center"
      >
        <span className="-rotate-[20deg] text-7xl font-black uppercase tracking-[0.2em] text-warning-500/10 dark:text-warning-400/10">
          {copy.watermark}
        </span>
      </div>

      <div className="relative">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-dashed border-warning-300 dark:border-warning-700 simulation-hatch">
          <h2 className="text-sm font-semibold text-primary">{copy.title}</h2>
          {updating ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-secondary" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {copy.updating}
            </span>
          ) : null}
        </div>

        <div className={`p-5 space-y-5 transition-opacity ${updating ? 'opacity-60' : ''}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-secondary border-b border-base">
                <th className="text-left font-medium py-2" />
                <th className="text-right font-medium py-2 px-3">{copy.current}</th>
                <th className="text-right font-semibold py-2 px-3 text-warning-800 dark:text-warning-200">{copy.projected}</th>
                <th className="text-right font-medium py-2 pl-3">{copy.difference}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border-base))]">
              {totals.map((row) => (
                <tr key={row.key} className={row.strong ? 'font-semibold' : ''}>
                  <td className={`py-2.5 ${row.strong ? 'text-primary' : 'text-secondary'}`}>{row.label}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-secondary">{formatMoney(baseline[row.key])}</td>
                  <td
                    className={`py-2.5 px-3 text-right tabular-nums text-primary bg-warning-50/60 dark:bg-warning-950/20 ${
                      row.strong ? 'text-lg' : ''
                    }`}
                  >
                    {formatMoney(simulated[row.key])}
                  </td>
                  <td className="py-2.5 pl-3 text-right">
                    <Diff
                      cents={toCents(simulated[row.key]) - toCents(baseline[row.key])}
                      inverse={row.key === 'totalDeductions'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div>
            <h3 className="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">{copy.linesTitle}</h3>
            {lines.length === 0 ? (
              <p className="text-sm text-muted">{copy.noLines}</p>
            ) : (
              <div className="rounded-lg border border-base overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-secondary bg-[rgb(var(--bg-muted))]">
                      <th className="text-left font-medium px-3 py-2">{copy.colComponent}</th>
                      <th className="text-right font-medium px-3 py-2">{copy.current}</th>
                      <th className="text-right font-medium px-3 py-2">{copy.projected}</th>
                      <th className="text-right font-medium px-3 py-2">{copy.difference}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgb(var(--border-base))]">
                    {lines.map((line) => (
                      <tr key={`${line.type}-${line.key}`} className={line.status === 'removed' ? 'text-muted' : ''}>
                        <td className="px-3 py-2">
                          <div className={line.status === 'removed' ? 'line-through' : 'text-primary'}>{line.name}</div>
                          <div className="text-xs text-muted">
                            {line.type === 'earning' ? payrollCopy.common.earnings : payrollCopy.common.deductions}
                            {line.status === 'added' ? ` · ${simulationCopy.lines.added}` : ''}
                            {line.status === 'removed' ? ` · ${simulationCopy.lines.removed}` : ''}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-secondary">
                          {line.current === null ? payrollCopy.common.none : formatMoney(line.current)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-primary">
                          {line.projected === null ? payrollCopy.common.none : formatMoney(line.projected)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Diff cents={line.diffCents} inverse={line.type === 'deduction'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-1 text-xs text-secondary">
            {currency ? <p>{copy.currency(currency)}</p> : null}
            {superBefore || superAfter ? (
              <p>
                {copy.employerSuper(
                  (superAfter ?? superBefore)?.schemeName ?? '',
                  formatMoney(superBefore?.employerContribution ?? '0'),
                  formatMoney(superAfter?.employerContribution ?? '0'),
                )}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
