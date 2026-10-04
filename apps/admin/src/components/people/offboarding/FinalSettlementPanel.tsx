import { useState } from 'react';
import {
  Ban,
  Calculator,
  CheckCircle2,
  Info,
  Loader2,
  Lock,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import type {
  EmployeeOffboardingRecord,
  EmployeeOffboardingTaskRecord,
  OffboardingSettlementOptions,
  OffboardingSettlementRecord,
} from '@hrm/shared-types';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import {
  applyPayrollAdjustment,
  cancelFinalSettlement,
  generateFinalSettlement,
  getSettlementOptions,
  submitPayrollAdjustment,
} from '@/lib/offboarding-api';
import {
  formatCurrencyAmount,
  formatSignedCurrency,
  settlementStatusBadge,
} from '@/lib/offboarding-display';
import { formatShortDate } from '@/lib/onboarding-display';
import { ApiError } from '@/lib/tenant-api-client';

interface SettlementLineDraft {
  key: number;
  componentId: string;
  amount: string;
}

interface FinalSettlementPanelProps {
  offboarding: EmployeeOffboardingRecord;
  task: EmployeeOffboardingTaskRecord | null;
  canGenerate: boolean;
  canEditPayroll: boolean;
  canFinalizePayroll: boolean;
  onChanged: (record?: EmployeeOffboardingRecord) => Promise<void>;
  onNotice: (message: string) => void;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error ? err.message : fallback;
}

function periodLabel(start: string, end: string): string {
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

function SettlementEntry({ settlement }: { settlement: OffboardingSettlementRecord }) {
  const { adjustment, currency } = settlement;
  const money = (value: string | null) => formatCurrencyAmount(value, currency);
  const changed = settlement.lines.filter((line) => Number(line.difference) !== 0);
  const net = Number(adjustment.adjustmentNetPay);

  const totals = [
    {
      label: 'Gross pay',
      original: adjustment.originalGrossPay,
      revised: adjustment.revisedGrossPay,
      difference: adjustment.adjustmentGrossPay,
    },
    {
      label: 'Deductions',
      original: adjustment.originalTotalDeductions,
      revised: adjustment.revisedTotalDeductions,
      difference: adjustment.adjustmentTotalDeductions,
    },
    {
      label: 'Net pay',
      original: adjustment.originalNetPay,
      revised: adjustment.revisedNetPay,
      difference: adjustment.adjustmentNetPay,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-base px-4 py-3">
          <div className="text-xs text-muted">Last finalized net pay</div>
          <div className="text-lg font-semibold text-primary mt-0.5">{money(adjustment.originalNetPay)}</div>
          <div className="text-xs text-secondary mt-0.5">
            {periodLabel(settlement.originalRun.periodStart, settlement.originalRun.periodEnd)}
          </div>
        </div>
        <div className="rounded-lg border border-base px-4 py-3">
          <div className="text-xs text-muted">Recalculated net pay</div>
          <div className="text-lg font-semibold text-primary mt-0.5">{money(adjustment.revisedNetPay)}</div>
          <div className="text-xs text-secondary mt-0.5">With settlement lines applied</div>
        </div>
        <div
          className={`rounded-lg border px-4 py-3 ${
            net > 0
              ? 'border-success-200 bg-success-50 dark:bg-success-950/30 dark:border-success-800'
              : net < 0
                ? 'border-error-200 bg-error-50 dark:bg-error-950/30 dark:border-error-800'
                : 'border-base'
          }`}
        >
          <div className="text-xs text-muted">{net < 0 ? 'Amount to recover' : 'Settlement payable'}</div>
          <div className="text-2xl font-bold text-primary mt-0.5">
            {formatSignedCurrency(adjustment.adjustmentNetPay, currency)}
          </div>
          <div className="text-xs text-secondary mt-0.5">
            {settlement.applyToPeriod
              ? `Paid with ${periodLabel(settlement.applyToPeriod.startDate, settlement.applyToPeriod.endDate)} payroll`
              : 'Pay cycle not set — payroll picks it up in the next run'}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-base">
        <table className="w-full text-sm">
          <thead className="bg-[rgb(var(--bg-muted))] text-xs text-muted">
            <tr>
              <th className="text-left font-medium px-4 py-2">Component</th>
              <th className="text-right font-medium px-4 py-2">Finalized run</th>
              <th className="text-right font-medium px-4 py-2">Recalculated</th>
              <th className="text-right font-medium px-4 py-2">Difference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgb(var(--border-base))]">
            {settlement.lines.map((line) => {
              const diff = Number(line.difference);
              return (
                <tr key={line.componentId} className={diff !== 0 ? 'bg-accent-50/40 dark:bg-accent-950/20' : ''}>
                  <td className="px-4 py-2">
                    <span className="text-primary">{line.componentName}</span>
                    <span className="ml-2 text-xs text-muted">
                      {line.componentType === 'earning' ? 'Earning' : 'Deduction'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-secondary">
                    {line.original === null ? '—' : money(line.original)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-secondary">
                    {line.revised === null ? '—' : money(line.revised)}
                  </td>
                  <td
                    className={`px-4 py-2 text-right tabular-nums font-medium ${
                      diff === 0 ? 'text-muted' : 'text-primary'
                    }`}
                  >
                    {line.original === null ? '—' : formatSignedCurrency(line.difference, currency)}
                  </td>
                </tr>
              );
            })}
            {totals.map((row) => (
              <tr key={row.label} className="bg-[rgb(var(--bg-muted))]/50 font-semibold">
                <td className="px-4 py-2 text-primary">{row.label}</td>
                <td className="px-4 py-2 text-right tabular-nums">{money(row.original)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{money(row.revised)}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatSignedCurrency(row.difference, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-muted space-y-1">
        {!settlement.originalBreakdownAvailable ? (
          <p>
            The finalized run has no stored component breakdown, so only its totals can be compared.
          </p>
        ) : changed.length === 0 ? (
          <p>No component changed — the recalculation matches the finalized run.</p>
        ) : null}
        <p className="flex items-start gap-1.5">
          <Lock className="h-3 w-3 mt-0.5 shrink-0" />
          The finalized run is not changed. This entry pays or recovers the difference in a later
          pay cycle and is recorded in the audit log.
        </p>
      </div>
    </div>
  );
}

export function FinalSettlementPanel({
  offboarding,
  task,
  canGenerate,
  canEditPayroll,
  canFinalizePayroll,
  onChanged,
  onNotice,
}: FinalSettlementPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [generateOpen, setGenerateOpen] = useState(false);
  const [options, setOptions] = useState<OffboardingSettlementOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [form, setForm] = useState({ runId: '', periodId: '', reason: '' });
  const [lines, setLines] = useState<SettlementLineDraft[]>([]);
  const [lineKey, setLineKey] = useState(1);

  const settlement = offboarding.settlement ?? null;
  const adjustment = settlement?.adjustment ?? null;
  const active = offboarding.status !== 'cancelled';
  const entryCancelled = adjustment?.status === 'cancelled';
  const canStartGenerate =
    active && canGenerate && task !== null && task.status !== 'skipped' && (!adjustment || entryCancelled);

  const openGenerate = async () => {
    setGenerateOpen(true);
    setError(null);
    setOptionsLoading(true);
    try {
      const loaded = await getSettlementOptions(offboarding.id);
      setOptions(loaded);
      setForm({
        runId: loaded.runs[0]?.id ?? '',
        periodId: loaded.periods.find((p) => p.status !== 'draft')?.id ?? '',
        reason: '',
      });
      setLines([]);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load settlement options'));
    } finally {
      setOptionsLoading(false);
    }
  };

  const lineErrors = lines.map((line) => {
    if (!line.componentId) return 'Choose a component';
    if (!/^\d+(\.\d{1,2})?$/.test(line.amount.trim())) return 'Enter an amount like 1200.00';
    if (lines.filter((l) => l.componentId === line.componentId).length > 1) return 'Component used twice';
    return null;
  });

  const submitGenerate = async () => {
    if (!task || !form.runId || lineErrors.some(Boolean)) return;
    setBusy('generate');
    setError(null);
    try {
      const record = await generateFinalSettlement(offboarding.id, task.id, {
        originalPayrollRunId: form.runId,
        applyToPayrollPeriodId: form.periodId || undefined,
        reason: form.reason.trim() || undefined,
        lines: lines.map((line) => ({ componentId: line.componentId, amount: line.amount.trim() })),
      });
      setGenerateOpen(false);
      await onChanged(record);
      onNotice('Settlement entry generated as a draft payroll adjustment.');
    } catch (err) {
      setError(errorMessage(err, 'Failed to generate the settlement'));
    } finally {
      setBusy(null);
    }
  };

  const runWorkflow = async (key: string, action: () => Promise<unknown>, message: string) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      await onChanged();
      onNotice(message);
    } catch (err) {
      setError(errorMessage(err, 'Failed to update the settlement'));
    } finally {
      setBusy(null);
    }
  };

  const statusBadge = adjustment ? settlementStatusBadge(adjustment.status) : null;
  const componentById = new Map(options?.components.map((c) => [c.id, c]) ?? []);
  const addedLines =
    adjustment?.structureOverrides?.filter((o) => o.componentId && o.amount !== undefined) ?? [];
  const lineComponentName = (componentId: string) =>
    settlement?.lines.find((l) => l.componentId === componentId)?.componentName ?? 'Component';

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <Calculator className="h-4 w-4 text-muted" /> Final settlement
          </span>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {statusBadge ? (
            <Badge tone={statusBadge.tone} dot>
              {statusBadge.label}
            </Badge>
          ) : task ? (
            <Badge tone={task.status === 'skipped' ? 'neutral' : 'warning'} dot>
              {task.status === 'skipped' ? 'Skipped' : 'Not generated'}
            </Badge>
          ) : null}
          {adjustment && !entryCancelled && active ? (
            <>
              {adjustment.status === 'draft' && canEditPayroll ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() =>
                    void runWorkflow(
                      'submit',
                      () => submitPayrollAdjustment(offboarding.companyId, adjustment.id),
                      'Settlement submitted to payroll.',
                    )
                  }
                >
                  {busy === 'submit' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Submit to payroll
                </Button>
              ) : null}
              {adjustment.status === 'pending' && canFinalizePayroll ? (
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={() =>
                    void runWorkflow(
                      'apply',
                      () => applyPayrollAdjustment(offboarding.companyId, adjustment.id),
                      'Settlement marked as applied.',
                    )
                  }
                >
                  {busy === 'apply' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Mark applied
                </Button>
              ) : null}
              {adjustment.status !== 'applied' && canEditPayroll ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => {
                    setCancelReason('');
                    setCancelOpen(true);
                  }}
                >
                  <Ban className="h-3.5 w-3.5" /> Cancel entry
                </Button>
              ) : null}
            </>
          ) : null}
          {canStartGenerate ? (
            <Button size="sm" onClick={() => void openGenerate()}>
              <Calculator className="h-3.5 w-3.5" />
              {entryCancelled ? 'Generate again' : 'Generate settlement'}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {error && !generateOpen ? (
          <div className="text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-3 py-2">
            {error}
          </div>
        ) : null}

        {!offboarding.settlementVisible ? (
          <p className="text-sm text-secondary flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted" />
            Settlement figures are visible to users with payroll access.
            {task ? ` The settlement step is ${task.status === 'pending' ? 'pending' : task.status}.` : ''}
          </p>
        ) : !task ? (
          <p className="text-sm text-secondary">
            This checklist has no final settlement step, so no settlement entry is generated.
          </p>
        ) : !settlement ? (
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-strong px-4 py-4">
            <Info className="h-4 w-4 text-muted mt-0.5 shrink-0" />
            <div className="text-sm text-secondary space-y-1">
              <p>
                {task.status === 'skipped'
                  ? 'The settlement step was skipped. Reopen it to generate a settlement.'
                  : 'No settlement entry yet.'}
              </p>
              <p className="text-xs text-muted">
                Generating re-runs payroll for the employee’s last finalized period with any settlement
                lines you add (e.g. leave encashment, notice pay, recoveries) and stores the difference
                as a payroll adjustment for a later pay cycle. The finalized run itself never changes.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span>Entry #{adjustment!.id.slice(0, 8)}</span>
              <span>Generated {formatShortDate(adjustment!.createdAt)}</span>
              <span>
                Based on the {settlement.originalRun.status} run for{' '}
                {periodLabel(settlement.originalRun.periodStart, settlement.originalRun.periodEnd)}
              </span>
              {adjustment!.appliedAt ? <span>Applied {formatShortDate(adjustment!.appliedAt)}</span> : null}
            </div>
            <p className="text-sm text-primary">{adjustment!.reason}</p>
            {statusBadge ? <p className="text-xs text-secondary">{statusBadge.help}</p> : null}
            {addedLines.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {addedLines.map((line) => (
                  <Badge key={line.componentId} tone="info">
                    {lineComponentName(line.componentId!)}: {formatCurrencyAmount(line.amount!, settlement.currency)}
                  </Badge>
                ))}
              </div>
            ) : null}
            <div className={entryCancelled ? 'opacity-60' : ''}>
              <SettlementEntry settlement={settlement} />
            </div>
          </>
        )}
      </CardBody>

      <Modal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        size="lg"
        title="Generate final settlement"
        description="Creates a draft payroll adjustment. Nothing is paid until payroll applies it."
        footer={
          <>
            <Button variant="secondary" onClick={() => setGenerateOpen(false)} disabled={busy === 'generate'}>
              Cancel
            </Button>
            <Button
              onClick={() => void submitGenerate()}
              disabled={busy === 'generate' || optionsLoading || !form.runId || lineErrors.some(Boolean)}
            >
              {busy === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Generate draft
            </Button>
          </>
        }
      >
        {optionsLoading ? (
          <div className="flex items-center gap-2 text-sm text-secondary py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading payroll data…
          </div>
        ) : options ? (
          <div className="space-y-5">
            {error ? (
              <div className="text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-3 py-2">
                {error}
              </div>
            ) : null}
            {options.runs.length === 0 ? (
              <p className="text-sm text-secondary">
                {offboarding.employeeName} has no finalized or paid payroll run yet. Finalize a payroll
                run first — the settlement is calculated against it.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="settle-run">Recalculate against</Label>
                    <Select
                      id="settle-run"
                      value={form.runId}
                      onChange={(e) => setForm({ ...form, runId: e.target.value })}
                    >
                      {options.runs.map((run) => (
                        <option key={run.id} value={run.id}>
                          {periodLabel(run.periodStart, run.periodEnd)} · net{' '}
                          {formatCurrencyAmount(run.netPay, run.payCurrency)} ({run.status})
                        </option>
                      ))}
                    </Select>
                    <p className="text-xs text-muted mt-1">Usually the final month worked.</p>
                  </div>
                  <div>
                    <Label htmlFor="settle-period">Pay in cycle</Label>
                    <Select
                      id="settle-period"
                      value={form.periodId}
                      onChange={(e) => setForm({ ...form, periodId: e.target.value })}
                    >
                      <option value="">Next payroll cycle (set later)</option>
                      {options.periods.map((period) => (
                        <option key={period.id} value={period.id}>
                          {periodLabel(period.startDate, period.endDate)} · pays{' '}
                          {formatShortDate(period.paymentDate)} ({period.status})
                        </option>
                      ))}
                    </Select>
                    {options.periods.length === 0 ? (
                      <p className="text-xs text-muted mt-1">No open payroll periods yet.</p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Settlement lines</Label>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={options.components.length === 0 || lines.length >= 20}
                      onClick={() => {
                        setLines([...lines, { key: lineKey, componentId: '', amount: '' }]);
                        setLineKey(lineKey + 1);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add line
                    </Button>
                  </div>
                  {lines.length === 0 ? (
                    <p className="text-xs text-muted rounded-lg border border-dashed border-strong px-3 py-3">
                      No lines — the entry will only reflect salary changes since the run was finalized.
                      Add lines for leave encashment, notice pay, gratuity or recoveries.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {lines.map((line, index) => {
                        const component = componentById.get(line.componentId);
                        return (
                          <div key={line.key}>
                            <div className="flex items-start gap-2">
                              <Select
                                aria-label="Pay component"
                                className="flex-1"
                                value={line.componentId}
                                onChange={(e) =>
                                  setLines(
                                    lines.map((l) =>
                                      l.key === line.key ? { ...l, componentId: e.target.value } : l,
                                    ),
                                  )
                                }
                              >
                                <option value="">Choose a pay component…</option>
                                {options.components.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} ({c.type === 'earning' ? 'earning' : 'deduction'})
                                  </option>
                                ))}
                              </Select>
                              <Input
                                aria-label="Amount"
                                className="w-36"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={line.amount}
                                onChange={(e) =>
                                  setLines(
                                    lines.map((l) => (l.key === line.key ? { ...l, amount: e.target.value } : l)),
                                  )
                                }
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label="Remove line"
                                onClick={() => setLines(lines.filter((l) => l.key !== line.key))}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            {lineErrors[index] && (line.componentId || line.amount) ? (
                              <p className="text-xs text-error-600 mt-1">{lineErrors[index]}</p>
                            ) : component?.currentAmount ? (
                              <p className="text-xs text-warning-700 mt-1">
                                Already on the salary structure at {component.currentAmount} — this amount
                                replaces it for the recalculation.
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {options.components.length === 0 ? (
                    <p className="text-xs text-muted mt-1">
                      No fixed-amount pay components exist. Create one under Payroll → Pay Components.
                    </p>
                  ) : null}
                </div>

                <div>
                  <Label htmlFor="settle-reason">Reason</Label>
                  <Textarea
                    id="settle-reason"
                    rows={2}
                    maxLength={500}
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    placeholder={`Full & final settlement for ${offboarding.employeeName}`}
                  />
                </div>
              </>
            )}
          </div>
        ) : error ? (
          <p className="text-sm text-error-600">{error}</p>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel settlement entry"
        tone="danger"
        description={
          <div className="space-y-3">
            <p>
              The payroll adjustment will be cancelled and the settlement step reopened so a new entry
              can be generated.
            </p>
            <div>
              <Label htmlFor="settle-cancel-reason">Reason (optional)</Label>
              <Textarea
                id="settle-cancel-reason"
                rows={2}
                maxLength={500}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Leave balance corrected"
              />
            </div>
          </div>
        }
        confirmLabel="Cancel entry"
        onConfirm={async () => {
          const record = await cancelFinalSettlement(offboarding.id, cancelReason.trim() || undefined);
          await onChanged(record);
          onNotice('Settlement entry cancelled. The settlement step is pending again.');
        }}
        onClose={() => setCancelOpen(false)}
      />
    </Card>
  );
}
