import { useMemo, useState, type FormEvent } from 'react';
import type {
  LockedPayrollPeriodSummary,
  PayComponentRecord,
  SalaryStructureRecord,
} from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Form';
import { FieldError } from '@/components/ui/FieldError';
import {
  MONEY_PATTERN,
  addDaysIso,
  describeStructureValue,
  formatDate,
  formatRate,
  isValidRate,
  payrollCopy,
  percentageSettings,
  todayIso,
} from '@/lib/payroll-copy';
import {
  correctionLockedPeriods,
  datesOverlap,
  formatPeriodList,
  lockedPeriodsIn,
  sameStructureValue as sameValue,
  type StructureChange,
  type StructureFormMode,
  type StructureValue,
} from '@/lib/salary-structure-change';

interface SalaryStructureChangeModalProps {
  open: boolean;
  mode: StructureFormMode;
  employeeName: string;
  components: PayComponentRecord[];
  rows: SalaryStructureRecord[];
  lockedPeriods: LockedPayrollPeriodSummary[];
  /** Restores the fields when returning from the review step. */
  previous?: StructureChange | null;
  onClose: () => void;
  onReview: (change: StructureChange) => void;
}

export function SalaryStructureChangeModal({
  open,
  mode,
  employeeName,
  components,
  rows,
  lockedPeriods,
  previous,
  onClose,
  onReview,
}: SalaryStructureChangeModalProps) {
  const copy = payrollCopy.structureForm;
  const row = mode.kind === 'add' ? null : mode.row;

  const [componentId, setComponentId] = useState('');
  const [amount, setAmount] = useState('');
  const [percentage, setPercentage] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [endDate, setEndDate] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);
  const [prevMode, setPrevMode] = useState(mode);
  const [prevPrevious, setPrevPrevious] = useState(previous);

  const resetFields = () => {
    setTouched({});
    setSubmitted(false);
    const prevValue = previous && 'value' in previous ? previous.value : null;
    const baseValue = prevValue ?? row?.amountOrFormula ?? {};
    setComponentId(previous?.component.id ?? row?.componentId ?? '');
    setAmount(baseValue.amount ?? '');
    setPercentage(baseValue.percentage !== undefined ? formatRate(baseValue.percentage) : '');
    if (mode.kind === 'add') {
      setFrom(previous?.kind === 'add' ? previous.effectiveFrom : todayIso());
      setTo(previous?.kind === 'add' ? (previous.effectiveTo ?? '') : '');
    } else if (mode.kind === 'revise') {
      const suggested = todayIso() > mode.row.effectiveFrom ? todayIso() : addDaysIso(mode.row.effectiveFrom, 1);
      setFrom(previous?.kind === 'revise' ? previous.effectiveFrom : suggested);
      setTo('');
    } else if (mode.kind === 'correct') {
      setFrom(previous?.kind === 'correct' ? previous.effectiveFrom : mode.row.effectiveFrom);
      setTo(previous?.kind === 'correct' ? (previous.effectiveTo ?? '') : (mode.row.effectiveTo ?? ''));
    } else {
      const suggested = todayIso() >= mode.row.effectiveFrom ? todayIso() : mode.row.effectiveFrom;
      setEndDate(previous?.kind === 'end' ? previous.endDate : suggested);
    }
  };

  if (open !== prevOpen || mode !== prevMode || previous !== prevPrevious) {
    setPrevOpen(open);
    setPrevMode(mode);
    setPrevPrevious(previous);
    if (open) resetFields();
  }

  const component = components.find((c) => c.id === componentId) ?? null;
  const calc = component?.calculationType ?? null;
  const pctSettings = component ? percentageSettings(component) : null;

  const value: StructureValue = useMemo(() => {
    if (calc === 'fixed') return { amount: amount.trim() };
    if (calc === 'percentage') return percentage.trim() ? { percentage: Number(percentage) } : {};
    return {};
  }, [calc, amount, percentage]);

  const errors = useMemo(() => {
    const e = copy.errors;
    const next: Partial<Record<'component' | 'amount' | 'percentage' | 'from' | 'to' | 'endDate' | 'form', string>> = {};

    if (mode.kind !== 'end') {
      if (!component) next.component = e.componentRequired;
      if (calc === 'fixed') {
        if (!amount.trim()) next.amount = e.amountRequired;
        else if (!MONEY_PATTERN.test(amount.trim())) next.amount = e.amountFormat;
      }
      if (calc === 'percentage') {
        if (!percentage.trim()) {
          if (pctSettings?.defaultRate === null) next.percentage = e.percentageRequired;
        } else if (!isValidRate(percentage)) {
          next.percentage = e.percentageRange;
        }
      }
    }

    if (mode.kind === 'add' || mode.kind === 'correct') {
      if (!from) next.from = e.dateRequired;
      if (from && to && to < from) next.to = e.toBeforeFrom;
      if (from && component && !next.to) {
        const clash = rows.find(
          (r) =>
            r.componentId === component.id &&
            r.id !== row?.id &&
            datesOverlap(from, to || null, r.effectiveFrom, r.effectiveTo),
        );
        if (clash) {
          next.form = e.overlap(formatDate(clash.effectiveFrom), clash.effectiveTo ? formatDate(clash.effectiveTo) : null);
        }
      }
    }

    if (mode.kind === 'correct' && row && from && !next.to && !next.amount && !next.percentage) {
      const hit = correctionLockedPeriods(lockedPeriods, row, value, from, to || null);
      if (hit.length > 0) next.form = e.touchesLockedPeriod(formatPeriodList(hit));
    }

    if (mode.kind === 'correct' && row && !next.form && !next.amount && !next.percentage) {
      if (sameValue(value, row.amountOrFormula) && from === row.effectiveFrom && (to || null) === row.effectiveTo) {
        next.form = e.noChange;
      }
    }

    if (mode.kind === 'revise' && row) {
      if (!from) next.from = e.dateRequired;
      else if (from <= row.effectiveFrom) next.from = e.reviseAfterStart(formatDate(row.effectiveFrom));
      else if (row.effectiveTo && from > row.effectiveTo) next.from = e.reviseBeforeEnd(formatDate(row.effectiveTo));
      if (!next.amount && !next.percentage && sameValue(value, row.amountOrFormula)) next.form = e.sameValue;
    }

    if (mode.kind === 'end' && row) {
      if (!endDate) next.endDate = e.dateRequired;
      else if (endDate < row.effectiveFrom) next.endDate = e.endBeforeStart(formatDate(row.effectiveFrom));
      else if (row.effectiveTo && endDate >= row.effectiveTo) next.endDate = e.noChange;
      else {
        const hit = lockedPeriodsIn(lockedPeriods, addDaysIso(endDate, 1), row.effectiveTo);
        if (hit.length > 0) next.endDate = e.endInLockedPeriod(formatPeriodList(hit));
      }
    }
    return next;
  }, [copy, mode.kind, component, calc, amount, percentage, pctSettings, from, to, rows, row, lockedPeriods, value, endDate]);

  const show = (field: keyof typeof errors) => (submitted || touched[field] ? errors[field] : undefined);
  const blur = (field: string) => () => setTouched((t) => ({ ...t, [field]: true }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    if (mode.kind === 'add' && component) {
      onReview({ kind: 'add', component, value, effectiveFrom: from, effectiveTo: to || null });
    } else if (row && component) {
      if (mode.kind === 'revise') onReview({ kind: 'revise', row, component, value, effectiveFrom: from });
      if (mode.kind === 'correct') onReview({ kind: 'correct', row, component, value, effectiveFrom: from, effectiveTo: to || null });
      if (mode.kind === 'end') onReview({ kind: 'end', row, component, endDate });
    }
  };

  const title =
    mode.kind === 'add'
      ? copy.addTitle
      : mode.kind === 'revise'
        ? copy.reviseTitle
        : mode.kind === 'correct'
          ? copy.correctTitle
          : copy.endTitle;
  const description =
    mode.kind === 'revise'
      ? copy.reviseDescription
      : mode.kind === 'correct'
        ? copy.correctDescription
        : mode.kind === 'end'
          ? copy.endDescription
          : employeeName;

  const earnings = components.filter((c) => c.type === 'earning');
  const deductions = components.filter((c) => c.type === 'deduction');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {payrollCopy.common.cancel}
          </Button>
          <Button variant="primary" type="submit" form="salary-structure-form">
            {copy.review}
          </Button>
        </>
      }
    >
      <form id="salary-structure-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {mode.kind === 'add' ? (
          <div>
            <Label htmlFor="ss-component">{copy.component}</Label>
            <Select
              id="ss-component"
              value={componentId}
              onChange={(e) => {
                setComponentId(e.target.value);
                setAmount('');
                setPercentage('');
              }}
              onBlur={blur('component')}
              aria-invalid={Boolean(show('component'))}
            >
              <option value="">{copy.chooseComponent}</option>
              {earnings.length ? (
                <optgroup label={payrollCopy.common.earnings}>
                  {earnings.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {payrollCopy.calcType[c.calculationType]}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {deductions.length ? (
                <optgroup label={payrollCopy.common.deductions}>
                  {deductions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {payrollCopy.calcType[c.calculationType]}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </Select>
            <FieldError message={show('component')} />
          </div>
        ) : row && component ? (
          <div className="rounded-lg bg-[rgb(var(--bg-muted))] px-4 py-3 text-sm flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-primary">{component.name}</div>
              <div className="text-xs text-secondary">
                {formatDate(row.effectiveFrom)} – {row.effectiveTo ? formatDate(row.effectiveTo) : payrollCopy.structures.openEnded}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-secondary">{copy.current}</div>
              <div className="font-semibold text-primary tabular-nums">{describeStructureValue(row, component)}</div>
            </div>
          </div>
        ) : null}

        {mode.kind !== 'end' && calc === 'fixed' ? (
          <div>
            <Label htmlFor="ss-amount">{copy.amount}</Label>
            <Input
              id="ss-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={blur('amount')}
              placeholder="0.00"
              className="tabular-nums"
              aria-invalid={Boolean(show('amount'))}
              autoFocus={mode.kind !== 'add'}
            />
            <FieldError message={show('amount')} />
          </div>
        ) : null}

        {mode.kind !== 'end' && calc === 'percentage' && pctSettings ? (
          <div>
            <Label htmlFor="ss-percentage">{copy.percentage}</Label>
            <Input
              id="ss-percentage"
              inputMode="decimal"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              onBlur={blur('percentage')}
              placeholder={pctSettings.defaultRate !== null ? formatRate(pctSettings.defaultRate) : 'e.g. 10'}
              aria-invalid={Boolean(show('percentage'))}
              autoFocus={mode.kind !== 'add'}
            />
            <FieldError message={show('percentage')} />
            <p className="mt-1 text-xs text-muted">
              {copy.percentageBaseHint(payrollCopy.base[pctSettings.base])}{' '}
              {pctSettings.defaultRate !== null ? copy.percentageDefaultHint(formatRate(pctSettings.defaultRate)) : null}
            </p>
          </div>
        ) : null}

        {mode.kind !== 'end' && calc === 'formula' ? (
          <p className="text-sm text-secondary rounded-lg border border-dashed border-base px-4 py-3">{copy.formulaNote}</p>
        ) : null}

        {mode.kind === 'add' || mode.kind === 'correct' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ss-from">{copy.effectiveFrom}</Label>
              <Input id="ss-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} onBlur={blur('from')} aria-invalid={Boolean(show('from'))} />
              <FieldError message={show('from')} />
            </div>
            <div>
              <Label htmlFor="ss-to">{copy.effectiveTo}</Label>
              <Input id="ss-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} onBlur={blur('to')} aria-invalid={Boolean(show('to'))} />
              <FieldError message={show('to')} />
            </div>
          </div>
        ) : null}

        {mode.kind === 'revise' && row ? (
          <div>
            <Label htmlFor="ss-revise-from">{copy.newEffectiveFrom}</Label>
            <Input
              id="ss-revise-from"
              type="date"
              value={from}
              min={addDaysIso(row.effectiveFrom, 1)}
              max={row.effectiveTo ?? undefined}
              onChange={(e) => setFrom(e.target.value)}
              onBlur={blur('from')}
              aria-invalid={Boolean(show('from'))}
            />
            <FieldError message={show('from')} />
          </div>
        ) : null}

        {mode.kind === 'end' && row ? (
          <div>
            <Label htmlFor="ss-end">{copy.endDate}</Label>
            <Input
              id="ss-end"
              type="date"
              value={endDate}
              min={row.effectiveFrom}
              max={row.effectiveTo ? addDaysIso(row.effectiveTo, -1) : undefined}
              onChange={(e) => setEndDate(e.target.value)}
              onBlur={blur('endDate')}
              aria-invalid={Boolean(show('endDate'))}
              autoFocus
            />
            <FieldError message={show('endDate')} />
          </div>
        ) : null}

        {submitted && errors.form ? (
          <p role="alert" className="text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-3 py-2">
            {errors.form}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
