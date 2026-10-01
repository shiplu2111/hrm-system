import { useState, type FormEvent } from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { PayrollPeriodRecord } from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Form';
import { FieldError } from '@/components/ui/FieldError';
import { createPayrollPeriod, updatePayrollPeriod } from '@/lib/payroll-runs-api';
import { isCalendarMonth, monthName, monthRange, periodLabel, periodsOverlap } from '@/lib/payroll-run-flow';
import { payrollRunsCopy } from '@/lib/payroll-runs-copy';
import { payrollCopy, todayIso } from '@/lib/payroll-copy';
import { ApiError } from '@/lib/tenant-api-client';

const copy = payrollRunsCopy.periodForm;

interface PayrollPeriodFormModalProps {
  open: boolean;
  companyId: string;
  /** Null creates a new period. */
  period: PayrollPeriodRecord | null;
  existing: PayrollPeriodRecord[];
  onClose: () => void;
  onSaved: (period: PayrollPeriodRecord) => void;
}

interface Draft {
  month: string;
  custom: boolean;
  startDate: string;
  endDate: string;
  paymentDate: string;
}

function initialDraft(period: PayrollPeriodRecord | null, existing: PayrollPeriodRecord[]): Draft {
  if (period) {
    return {
      month: period.startDate.slice(0, 7),
      custom: !isCalendarMonth(period.startDate, period.endDate),
      startDate: period.startDate.slice(0, 10),
      endDate: period.endDate.slice(0, 10),
      paymentDate: period.paymentDate.slice(0, 10),
    };
  }
  let month = todayIso().slice(0, 7);
  for (let i = 0; i < 12 && existing.some((p) => periodsOverlap(p, monthRange(month))); i += 1) {
    month = nextMonth(month);
  }
  const range = monthRange(month);
  return { month, custom: false, ...range, paymentDate: range.endDate };
}

function nextMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`;
}

/** Dates can only change while every run is still a draft (or cancelled). */
function periodDatesLocked(period: PayrollPeriodRecord | null): boolean {
  const counts = period?.summary?.statusCounts ?? {};
  return Object.entries(counts).some(([status, n]) => (n ?? 0) > 0 && status !== 'draft' && status !== 'cancelled');
}

export function PayrollPeriodFormModal(props: PayrollPeriodFormModalProps) {
  if (!props.open) return null;
  return <PeriodForm key={props.period?.id ?? 'new'} {...props} />;
}

function PeriodForm({ companyId, period, existing, onClose, onSaved }: PayrollPeriodFormModalProps) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(period, existing));
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const datesLocked = periodDatesLocked(period);

  const errors: Partial<Record<'startDate' | 'endDate' | 'paymentDate', string>> = {};
  if (!draft.startDate) errors.startDate = copy.errors.dateRequired;
  if (!draft.endDate) errors.endDate = copy.errors.dateRequired;
  else if (draft.startDate && draft.endDate < draft.startDate) errors.endDate = copy.errors.endBeforeStart;
  if (!draft.paymentDate) errors.paymentDate = copy.errors.dateRequired;
  else if (draft.startDate && draft.paymentDate < draft.startDate) errors.paymentDate = copy.errors.paymentBeforeStart;
  const valid = Object.keys(errors).length === 0;
  const show = (field: keyof typeof errors) => (submitted ? errors[field] : undefined);

  const datesComplete = Boolean(draft.startDate && draft.endDate && draft.endDate >= draft.startDate);
  const overlapping = datesComplete
    ? existing.filter((p) => p.id !== period?.id && periodsOverlap(p, draft))
    : [];
  const offCalendar = datesComplete && !isCalendarMonth(draft.startDate, draft.endDate);

  const update = (patch: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...patch }));

  const setMonth = (month: string) => {
    if (!month) return update({ month });
    const range = monthRange(month);
    const keepPayment = draft.paymentDate && draft.paymentDate !== draft.endDate;
    update({ month, ...range, paymentDate: keepPayment ? draft.paymentDate : range.endDate });
  };

  const setEndDate = (endDate: string) => {
    const followEnd = !draft.paymentDate || draft.paymentDate === draft.endDate;
    update({ endDate, ...(followEnd ? { paymentDate: endDate } : {}) });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const saved = period
        ? await updatePayrollPeriod(
            companyId,
            period.id,
            datesLocked
              ? { paymentDate: draft.paymentDate }
              : { startDate: draft.startDate, endDate: draft.endDate, paymentDate: draft.paymentDate },
          )
        : await createPayrollPeriod(companyId, {
            startDate: draft.startDate,
            endDate: draft.endDate,
            paymentDate: draft.paymentDate,
          });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : payrollRunsCopy.periods.loadError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      title={period ? copy.editTitle : copy.createTitle}
      description={copy.description}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {payrollCopy.common.cancel}
          </Button>
          <Button variant="primary" type="submit" form="payroll-period-form" disabled={busy}>
            {busy ? payrollCopy.common.saving : period ? copy.save : copy.create}
          </Button>
        </>
      }
    >
      <form id="payroll-period-form" onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        {datesLocked ? (
          <p className="flex items-start gap-2 text-sm text-secondary rounded-lg border border-base bg-[rgb(var(--bg-muted))] px-3 py-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted" />
            {copy.datesLocked}
          </p>
        ) : (
          <>
            {!draft.custom ? (
              <div>
                <Label htmlFor="pp-month">{copy.month}</Label>
                <Input id="pp-month" type="month" value={draft.month} onChange={(e) => setMonth(e.target.value)} />
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-sm text-primary cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-base accent-accent-600"
                checked={draft.custom}
                onChange={(e) => {
                  const custom = e.target.checked;
                  if (!custom && draft.month) setMonth(draft.month);
                  update({ custom });
                }}
              />
              {copy.customDates}
            </label>
          </>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="pp-start">{copy.startDate}</Label>
            <Input
              id="pp-start"
              type="date"
              value={draft.startDate}
              onChange={(e) => update({ startDate: e.target.value })}
              disabled={datesLocked || !draft.custom}
              aria-invalid={Boolean(show('startDate'))}
            />
            <FieldError message={show('startDate')} />
          </div>
          <div>
            <Label htmlFor="pp-end">{copy.endDate}</Label>
            <Input
              id="pp-end"
              type="date"
              value={draft.endDate}
              min={draft.startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={datesLocked || !draft.custom}
              aria-invalid={Boolean(show('endDate'))}
            />
            <FieldError message={show('endDate')} />
          </div>
        </div>

        <div className="sm:w-1/2 sm:pr-2">
          <Label htmlFor="pp-payment">{copy.paymentDate}</Label>
          <Input
            id="pp-payment"
            type="date"
            value={draft.paymentDate}
            min={draft.startDate || undefined}
            onChange={(e) => update({ paymentDate: e.target.value })}
            aria-invalid={Boolean(show('paymentDate'))}
          />
          {show('paymentDate') ? (
            <FieldError message={show('paymentDate')} />
          ) : (
            <p className="mt-1 text-xs text-muted">{copy.paymentHint}</p>
          )}
        </div>

        {!datesLocked && offCalendar ? (
          <p className="flex items-start gap-2 text-xs text-secondary">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted" />
            {copy.calendarMonthHint(monthName(draft.endDate))}
          </p>
        ) : null}

        {!datesLocked && overlapping.length > 0 ? (
          <div className="flex items-start gap-2 text-sm rounded-lg border border-warning-200 dark:border-warning-800 bg-warning-50 dark:bg-warning-900/20 px-3 py-2 text-warning-800 dark:text-warning-200">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warning-600" />
            {copy.overlap(overlapping.map((p) => periodLabel(p)).join(', '))}
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-3 py-2"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
