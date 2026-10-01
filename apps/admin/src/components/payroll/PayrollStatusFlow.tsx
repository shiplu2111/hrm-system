import { Check, MoreHorizontal } from 'lucide-react';
import { PAYROLL_RUN_FLOW, type PayrollRunRecord, type PayrollRunStatus } from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { RunStatusDot } from '@/components/payroll/PayrollRunStatus';
import { periodStage, totalsFor } from '@/lib/payroll-run-flow';
import { payrollRunsCopy } from '@/lib/payroll-runs-copy';
import { formatMoney } from '@/lib/payroll-copy';

export interface StepAction {
  key: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface PayrollStatusFlowProps {
  runs: PayrollRunRecord[];
  filter: PayrollRunStatus | 'all';
  onFilter: (status: PayrollRunStatus | 'all') => void;
  /** First action is the step's main button; the rest go in its overflow menu. */
  actionsFor: (status: PayrollRunStatus, runs: PayrollRunRecord[]) => StepAction[];
  busy: boolean;
}

export function PayrollStatusFlow({ runs, filter, onFilter, actionsFor, busy }: PayrollStatusFlowProps) {
  const counts: Partial<Record<PayrollRunStatus, number>> = {};
  for (const run of runs) counts[run.status] = (counts[run.status] ?? 0) + 1;
  const { stage: current } = periodStage(counts);
  const currentIndex = current ? PAYROLL_RUN_FLOW.indexOf(current) : -1;

  return (
    <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {PAYROLL_RUN_FLOW.map((status, index) => {
        const stepRuns = runs.filter((run) => run.status === status);
        const count = stepRuns.length;
        const done = currentIndex !== -1 && index < currentIndex && count === 0;
        const isCurrent = status === current;
        const selected = filter === status;
        const actions = count > 0 ? actionsFor(status, stepRuns) : [];
        const [main, ...more] = actions;
        const label = payrollRunsCopy.status[status];

        return (
          <li
            key={status}
            className={`relative flex flex-col rounded-xl border p-3.5 transition-colors ${
              selected
                ? 'border-accent-500 ring-2 ring-accent-500/20 surface'
                : isCurrent
                  ? 'border-accent-300 dark:border-accent-700 bg-accent-50/60 dark:bg-accent-950/20'
                  : 'border-base surface'
            }`}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <button
              type="button"
              onClick={() => onFilter(selected ? 'all' : status)}
              aria-pressed={selected}
              className="text-left rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-bold ${
                    done
                      ? 'bg-success-600 text-white'
                      : isCurrent
                        ? 'bg-accent-600 text-white'
                        : 'bg-[rgb(var(--bg-muted))] text-secondary'
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span className="text-sm font-semibold text-primary truncate">{label}</span>
                {count > 0 ? <RunStatusDot status={status} /> : null}
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className={`text-2xl font-bold tabular-nums ${count > 0 ? 'text-primary' : 'text-muted'}`}>{count}</span>
                {count > 0 ? (
                  <span className="text-xs text-secondary tabular-nums truncate">{formatMoney(totalsFor(stepRuns).netPay)}</span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-muted line-clamp-2">{payrollRunsCopy.statusHint[status]}</p>
            </button>

            {main ? (
              <div className="mt-3 flex items-center gap-1">
                <Button
                  size="sm"
                  variant={main.danger ? 'danger' : isCurrent ? 'primary' : 'secondary'}
                  onClick={main.onClick}
                  disabled={busy}
                  className="flex-1 min-w-0"
                >
                  <span className="truncate">{main.label}</span>
                </Button>
                {more.length > 0 ? (
                  <Dropdown
                    width="w-60"
                    trigger={
                      <button
                        type="button"
                        aria-label={payrollRunsCopy.actions.more(label)}
                        disabled={busy}
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-muted hover:text-primary hover:bg-[rgb(var(--bg-muted))] disabled:opacity-50"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    }
                  >
                    {more.map((action) => (
                      <DropdownItem key={action.key} onClick={action.onClick} disabled={busy}>
                        <span className={action.danger ? 'text-error-600' : undefined}>{action.label}</span>
                      </DropdownItem>
                    ))}
                  </Dropdown>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
