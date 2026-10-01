import { useMemo, useState, type FormEvent } from 'react';
import type { PayComponentRecord } from '@hrm/shared-types';
import { PAY_FORMULA_REF_PATHS } from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { FieldError } from '@/components/ui/FieldError';
import { isValidRate, payrollCopy, refLabel } from '@/lib/payroll-copy';
import {
  FORMULA_TEMPLATES,
  parseFormulaText,
  safeDescribeFormula,
  stringifyFormula,
  type FormulaTemplate,
  type PayComponentDraft,
} from '@/lib/pay-component-draft';

interface PayComponentFormModalProps {
  open: boolean;
  editing: PayComponentRecord | null;
  initialDraft: PayComponentDraft;
  existing: PayComponentRecord[];
  onClose: () => void;
  onReview: (draft: PayComponentDraft) => void;
}

export function PayComponentFormModal({
  open,
  editing,
  initialDraft,
  existing,
  onClose,
  onReview,
}: PayComponentFormModalProps) {
  const copy = payrollCopy.componentForm;
  const [draft, setDraft] = useState<PayComponentDraft>(initialDraft);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [template, setTemplate] = useState<FormulaTemplate>('overtime');
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevInitialDraft, setPrevInitialDraft] = useState(initialDraft);

  if (open !== prevOpen || initialDraft !== prevInitialDraft) {
    setPrevOpen(open);
    setPrevInitialDraft(initialDraft);
    if (open) {
      setDraft(initialDraft);
      setTouched({});
      setSubmitted(false);
      const match = (Object.keys(FORMULA_TEMPLATES) as Array<keyof typeof FORMULA_TEMPLATES>).find(
        (key) => stringifyFormula(FORMULA_TEMPLATES[key]) === initialDraft.formulaText,
      );
      setTemplate(match ?? 'custom');
    }
  }

  const assignmentRows = editing?.usage?.assignmentCount ?? 0;
  const calcLocked = Boolean(editing) && assignmentRows > 0;

  const formula = useMemo(() => parseFormulaText(draft.formulaText), [draft.formulaText]);
  const formulaDescription = formula.rule ? safeDescribeFormula(formula.rule) : null;

  const errors = useMemo(() => {
    const next: Partial<Record<'name' | 'defaultRate' | 'formula', string>> = {};
    const name = draft.name.trim();
    if (!name) next.name = copy.errors.nameRequired;
    else if (name.length > 100) next.name = copy.errors.nameTooLong;
    else if (
      existing.some(
        (c) =>
          c.id !== editing?.id &&
          c.type === draft.type &&
          c.name.trim().toLowerCase() === name.toLowerCase(),
      )
    ) {
      next.name = copy.errors.nameTaken(draft.type);
    }
    if (draft.calculationType === 'percentage' && draft.defaultRate.trim() && !isValidRate(draft.defaultRate)) {
      next.defaultRate = copy.errors.rateRange;
    }
    if (draft.calculationType === 'formula' && formula.error) next.formula = formula.error;
    return next;
  }, [draft, existing, editing, formula.error, copy]);

  const show = (field: keyof typeof errors) => (submitted || touched[field] ? errors[field] : undefined);
  const set = <K extends keyof PayComponentDraft>(key: K, value: PayComponentDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    onReview(draft);
  };

  const chooseTemplate = (value: FormulaTemplate) => {
    setTemplate(value);
    if (value !== 'custom') set('formulaText', stringifyFormula(FORMULA_TEMPLATES[value]));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? copy.editTitle : copy.createTitle}
      description={copy.description}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {payrollCopy.common.cancel}
          </Button>
          <Button variant="primary" type="submit" form="pay-component-form">
            {copy.review}
          </Button>
        </>
      }
    >
      <form id="pay-component-form" onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <Label htmlFor="pc-name">{copy.name}</Label>
          <Input
            id="pc-name"
            value={draft.name}
            maxLength={120}
            onChange={(e) => set('name', e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            placeholder={copy.namePlaceholder}
            aria-invalid={Boolean(show('name'))}
            autoFocus
          />
          <FieldError message={show('name')} />
        </div>

        <fieldset>
          <legend className="block text-xs font-medium text-secondary mb-1.5">{copy.type}</legend>
          <div className="inline-flex p-1 rounded-lg border border-base surface gap-1">
            {(['earning', 'deduction'] as const).map((type) => (
              <button
                key={type}
                type="button"
                disabled={Boolean(editing)}
                onClick={() => set('type', type)}
                aria-pressed={draft.type === type}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                  draft.type === type
                    ? 'bg-accent-600 text-white shadow-sm'
                    : 'text-secondary hover:text-primary disabled:opacity-50'
                }`}
              >
                {type === 'earning' ? payrollCopy.common.earning : payrollCopy.common.deduction}
              </button>
            ))}
          </div>
          {editing ? <p className="mt-1 text-xs text-muted">{copy.typeLocked}</p> : null}
        </fieldset>

        <fieldset>
          <legend className="block text-xs font-medium text-secondary mb-1.5">{copy.calculation}</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(['fixed', 'percentage', 'formula'] as const).map((calc) => {
              const selected = draft.calculationType === calc;
              return (
                <button
                  key={calc}
                  type="button"
                  disabled={calcLocked && !selected}
                  onClick={() => set('calculationType', calc)}
                  aria-pressed={selected}
                  className={`text-left rounded-lg border px-3 py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    selected
                      ? 'border-accent-500 bg-accent-50 dark:bg-accent-950/40 ring-2 ring-accent-500/20'
                      : 'border-base hover:bg-[rgb(var(--bg-hover))]'
                  }`}
                >
                  <span className="block text-sm font-semibold text-primary">{payrollCopy.calcType[calc]}</span>
                  <span className="block text-xs text-secondary mt-0.5">{payrollCopy.calcTypeHint[calc]}</span>
                </button>
              );
            })}
          </div>
          {calcLocked ? <p className="mt-1.5 text-xs text-muted">{copy.calcLocked(assignmentRows)}</p> : null}
        </fieldset>

        {draft.calculationType === 'percentage' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pc-base">{copy.base}</Label>
              <Select
                id="pc-base"
                value={draft.base}
                onChange={(e) => set('base', e.target.value as 'basic' | 'gross')}
              >
                <option value="basic">{copy.baseBasic}</option>
                <option value="gross">{copy.baseGross}</option>
              </Select>
              {draft.base === 'gross' && draft.type === 'earning' ? (
                <p className="mt-1 text-xs text-warning-700 dark:text-warning-300">{copy.baseGrossEarningHint}</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="pc-rate">{copy.defaultRate}</Label>
              <Input
                id="pc-rate"
                inputMode="decimal"
                value={draft.defaultRate}
                onChange={(e) => set('defaultRate', e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, defaultRate: true }))}
                placeholder="e.g. 40"
                aria-invalid={Boolean(show('defaultRate'))}
              />
              <FieldError message={show('defaultRate')} />
              {!show('defaultRate') ? <p className="mt-1 text-xs text-muted">{copy.defaultRateHint}</p> : null}
            </div>
          </div>
        ) : null}

        {draft.calculationType === 'formula' ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="pc-template">{copy.template}</Label>
              <Select
                id="pc-template"
                value={template}
                onChange={(e) => chooseTemplate(e.target.value as FormulaTemplate)}
              >
                <option value="overtime">{copy.templateOvertime}</option>
                <option value="unpaid">{copy.templateUnpaid}</option>
                <option value="loan">{copy.templateLoan}</option>
                <option value="custom">{copy.templateCustom}</option>
              </Select>
            </div>
            {formulaDescription ? (
              <div className="rounded-lg bg-[rgb(var(--bg-muted))] px-3 py-2 text-sm">
                <span className="text-xs font-medium text-secondary">{copy.formulaReads}: </span>
                <span className="text-primary">{formulaDescription}</span>
              </div>
            ) : null}
            <div>
              <Label htmlFor="pc-formula">{copy.formulaJson}</Label>
              <Textarea
                id="pc-formula"
                rows={10}
                spellCheck={false}
                value={draft.formulaText}
                onChange={(e) => {
                  set('formulaText', e.target.value);
                  setTemplate('custom');
                }}
                onBlur={() => setTouched((t) => ({ ...t, formula: true }))}
                className="font-mono text-xs"
                aria-invalid={Boolean(show('formula'))}
              />
              <FieldError message={show('formula')} />
            </div>
            <details className="text-xs text-secondary">
              <summary className="cursor-pointer select-none">{copy.formulaAvailableRefs}</summary>
              <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                {PAY_FORMULA_REF_PATHS.map((ref) => (
                  <li key={ref}>
                    <code className="font-mono text-[11px] text-primary">{ref}</code>{' '}
                    <span className="text-muted">— {refLabel(ref)}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}