import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, ArrowRight, Loader2, ShieldAlert } from 'lucide-react';
import type {
  CostCentreRecord,
  EmployeeRecord,
  LifecycleEventRecord,
} from '@hrm/shared-types';
import { useAuth } from '@hrm/portal-ui';
import { SidePanel } from '@/components/ui/SidePanel';
import { Button } from '@/components/ui/Button';
import { FieldError } from '@/components/ui/FieldError';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { createLifecycleEvent, listLifecycleEvents } from '@/lib/lifecycle-api';
import { listEmployees } from '@/lib/employees-api';
import { listCostCentres, listDepartments, listDesignations } from '@/lib/organization-api';
import { ApiError } from '@/lib/tenant-api-client';
import {
  buildLifecycleRequest,
  evaluateForEmployee,
  formatAmount,
  getLifecycleAction,
  initialLifecycleForm,
  resolveEventType,
  validateLifecycleForm,
  type ExitType,
  type LifecycleActionKind,
  type LifecycleFormState,
} from '@/lib/lifecycle-actions';

interface LifecycleActionPanelProps {
  open: boolean;
  kind: LifecycleActionKind | null;
  employee: EmployeeRecord;
  companyId: string;
  onClose: () => void;
  onRecorded: (event: LifecycleEventRecord) => void;
}

interface Option {
  id: string;
  name: string;
}

interface Lookups {
  departments: Option[];
  designations: Option[];
  managers: Option[];
  costCentres: Option[];
  lastSalary: { amount: number; currency: string } | null;
}

const EMPTY_LOOKUPS: Lookups = {
  departments: [],
  designations: [],
  managers: [],
  costCentres: [],
  lastSalary: null,
};

const EXIT_OPTIONS: { value: ExitType; label: string; hint: string }[] = [
  { value: 'resignation', label: 'Resignation', hint: 'Employee is leaving voluntarily' },
  { value: 'termination', label: 'Termination', hint: 'Employer is ending employment' },
];

function lastSalaryFrom(events: LifecycleEventRecord[]): Lookups['lastSalary'] {
  const latest = events
    .filter((e) => e.eventType === 'salary_revision' && e.details.newAmount != null)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
  if (!latest) return null;
  return {
    amount: Number(latest.details.newAmount),
    currency: typeof latest.details.currency === 'string' ? latest.details.currency : 'AUD',
  };
}

export function LifecycleActionPanel({
  open,
  kind,
  employee,
  companyId,
  onClose,
  onRecorded,
}: LifecycleActionPanelProps) {
  const { user } = useAuth();
  const action = kind ? getLifecycleAction(kind) : null;

  const [form, setForm] = useState<LifecycleFormState>(() => initialLifecycleForm());
  const [touched, setTouched] = useState<Partial<Record<keyof LifecycleFormState, boolean>>>({});
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [lookups, setLookups] = useState<Lookups>(EMPTY_LOOKUPS);
  const [loadingLookups, setLoadingLookups] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exitDecisions = useMemo(
    () =>
      Object.fromEntries(
        EXIT_OPTIONS.map((o) => [o.value, evaluateForEmployee(user, o.value, employee)]),
      ) as Record<ExitType, ReturnType<typeof evaluateForEmployee>>,
    [user, employee],
  );

  const loadLookups = useCallback(
    async (forKind: LifecycleActionKind) => {
      const needs = {
        departments: ['promotion', 'transfer', 'rehire'].includes(forKind),
        designations: ['promotion', 'rehire'].includes(forKind),
        managers: ['promotion', 'transfer'].includes(forKind),
        costCentres: forKind === 'transfer',
        salary: forKind === 'salary_revision',
      };
      setLoadingLookups(true);
      try {
        const [departments, designations, employees, costCentres, events] = await Promise.all([
          needs.departments ? listDepartments(companyId) : Promise.resolve([]),
          needs.designations ? listDesignations(companyId) : Promise.resolve([]),
          needs.managers ? listEmployees(companyId) : Promise.resolve([] as EmployeeRecord[]),
          needs.costCentres ? listCostCentres(companyId) : Promise.resolve([] as CostCentreRecord[]),
          needs.salary ? listLifecycleEvents(employee.id, 'salary_revision') : Promise.resolve([]),
        ]);
        const next: Lookups = {
          departments: departments.map((d) => ({ id: d.id, name: d.name })),
          designations: designations.map((d) => ({ id: d.id, name: d.name })),
          managers: employees
            .filter((e) => e.id !== employee.id && e.employmentStatus !== 'terminated')
            .map((e) => ({ id: e.id, name: e.fullName })),
          costCentres: costCentres.map((c) => ({ id: c.id, name: `${c.code} — ${c.name}` })),
          lastSalary: lastSalaryFrom(events),
        };
        setLookups(next);
        if (next.lastSalary) {
          const { amount, currency } = next.lastSalary;
          setForm((prev) => ({
            ...prev,
            previousAmount: prev.previousAmount || String(amount),
            currency,
          }));
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load form options');
      } finally {
        setLoadingLookups(false);
      }
    },
    [companyId, employee.id],
  );

  useEffect(() => {
    if (!open || !kind) return;
    const defaultExit = EXIT_OPTIONS.find((o) => exitDecisions[o.value].allowed)?.value ?? '';
    setForm(initialLifecycleForm(kind === 'exit' ? { exitType: defaultExit } : {}));
    setTouched({});
    setStep('form');
    setError(null);
    setLookups(EMPTY_LOOKUPS);
    void loadLookups(kind);
    // Reset only when the panel opens for a new action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind]);

  const errors = useMemo(
    () => (kind ? validateLifecycleForm(kind, form, employee) : {}),
    [kind, form, employee],
  );
  const hasErrors = Object.keys(errors).length > 0;

  const eventType = kind ? resolveEventType(kind, form) : null;
  const decision = eventType ? evaluateForEmployee(user, eventType, employee) : null;

  const update = <K extends keyof LifecycleFormState>(key: K, value: LifecycleFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setTouched((prev) => ({ ...prev, [key]: true }));
  };
  const touch = (key: keyof LifecycleFormState) =>
    setTouched((prev) => ({ ...prev, [key]: true }));
  const showError = (key: keyof LifecycleFormState) => (touched[key] ? errors[key] : undefined);

  const touchAll = () =>
    setTouched(
      Object.fromEntries(Object.keys(form).map((k) => [k, true])) as Record<
        keyof LifecycleFormState,
        boolean
      >,
    );

  const submit = async () => {
    if (!kind) return;
    setSubmitting(true);
    setError(null);
    try {
      const event = await createLifecycleEvent(employee.id, buildLifecycleRequest(kind, form));
      onRecorded(event);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the event');
      setStep('form');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrimary = () => {
    touchAll();
    if (hasErrors || !decision?.allowed || !action) return;
    if (action.requiresReview && step === 'form') {
      setStep('review');
      return;
    }
    void submit();
  };

  if (!action || !kind) return null;

  const Icon = action.icon;
  const isDestructive = action.requiresReview;
  const primaryLabel =
    step === 'review'
      ? `Confirm ${eventType === 'termination' ? 'termination' : eventType === 'resignation' ? 'resignation' : 'suspension'}`
      : action.requiresReview
        ? 'Review'
        : `Record ${action.label.toLowerCase()}`;

  const summaryRows = buildSummary(kind, form, employee);

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={action.label}
      description={`${employee.fullName} · ${employee.employeeNumber}`}
      icon={
        <div
          className={`h-10 w-10 rounded-lg flex items-center justify-center ${
            isDestructive
              ? 'bg-error-50 text-error-600 dark:bg-error-950/40'
              : 'bg-accent-50 text-accent-600 dark:bg-accent-950/40'
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      }
      footer={
        <>
          {step === 'review' ? (
            <Button variant="secondary" onClick={() => setStep('form')} disabled={submitting}>
              Back
            </Button>
          ) : (
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
          )}
          <Button
            variant={step === 'review' ? 'danger' : 'primary'}
            onClick={handlePrimary}
            disabled={submitting || loadingLookups || !decision?.allowed}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              primaryLabel
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {decision && !decision.allowed ? (
          <Notice tone="warning" icon={<ShieldAlert className="h-4 w-4" />}>
            {decision.message}
          </Notice>
        ) : null}

        {error ? (
          <Notice tone="error" icon={<AlertCircle className="h-4 w-4" />}>
            {error}
          </Notice>
        ) : null}

        {step === 'review' ? (
          <ReviewStep eventType={eventType} rows={summaryRows} form={form} />
        ) : loadingLookups ? (
          <div className="flex items-center gap-2 text-sm text-muted py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading options…
          </div>
        ) : (
          <>
            {kind === 'exit' ? (
              <fieldset>
                <legend className="block text-xs font-medium text-secondary mb-1.5">Exit type *</legend>
                <div className="grid grid-cols-2 gap-2">
                  {EXIT_OPTIONS.map((option) => {
                    const optionDecision = exitDecisions[option.value];
                    const selected = form.exitType === option.value;
                    return (
                      <label
                        key={option.value}
                        title={optionDecision.allowed ? undefined : optionDecision.message}
                        className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                          optionDecision.allowed ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                        } ${
                          selected
                            ? 'border-accent-500 bg-accent-50 dark:bg-accent-950/30'
                            : 'border-base hover:bg-[rgb(var(--bg-hover))]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="exitType"
                          className="sr-only"
                          value={option.value}
                          checked={selected}
                          disabled={!optionDecision.allowed}
                          onChange={() => update('exitType', option.value)}
                        />
                        <span className="block text-sm font-medium text-primary">{option.label}</span>
                        <span className="block text-xs text-secondary mt-0.5">
                          {optionDecision.allowed ? option.hint : optionDecision.message}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <FieldError message={showError('exitType')} />
              </fieldset>
            ) : null}

            <Field label="Effective date *" error={showError('effectiveDate')}>
              <Input
                type="date"
                value={form.effectiveDate}
                onChange={(e) => update('effectiveDate', e.target.value)}
                onBlur={() => touch('effectiveDate')}
                aria-invalid={Boolean(showError('effectiveDate'))}
              />
            </Field>

            {kind === 'promotion' ? (
              <>
                <Field
                  label="New designation *"
                  hint={`Current: ${employee.designation?.name ?? 'None'}`}
                  error={showError('newDesignationId')}
                >
                  <OptionSelect
                    value={form.newDesignationId}
                    options={lookups.designations}
                    placeholder="Select designation…"
                    onChange={(v) => update('newDesignationId', v)}
                    onBlur={() => touch('newDesignationId')}
                    invalid={Boolean(showError('newDesignationId'))}
                  />
                </Field>
                <Field
                  label="New department"
                  hint={`Current: ${employee.department?.name ?? 'None'}`}
                  error={showError('newDepartmentId')}
                >
                  <OptionSelect
                    value={form.newDepartmentId}
                    options={lookups.departments}
                    placeholder="Keep current department"
                    onChange={(v) => update('newDepartmentId', v)}
                    invalid={Boolean(showError('newDepartmentId'))}
                  />
                </Field>
                <Field
                  label="New manager"
                  hint={`Current: ${employee.manager?.fullName ?? 'None'}`}
                  error={showError('newManagerId')}
                >
                  <OptionSelect
                    value={form.newManagerId}
                    options={lookups.managers}
                    placeholder="Keep current manager"
                    onChange={(v) => update('newManagerId', v)}
                    invalid={Boolean(showError('newManagerId'))}
                  />
                </Field>
              </>
            ) : null}

            {kind === 'transfer' ? (
              <>
                <p className="text-xs text-secondary -mt-2">
                  Change at least one of the fields below. Blank fields stay as they are.
                </p>
                <Field
                  label="New department"
                  hint={`Current: ${employee.department?.name ?? 'None'}`}
                  error={showError('newDepartmentId')}
                >
                  <OptionSelect
                    value={form.newDepartmentId}
                    options={lookups.departments}
                    placeholder="Keep current department"
                    onChange={(v) => update('newDepartmentId', v)}
                    onBlur={() => touch('newDepartmentId')}
                    invalid={Boolean(showError('newDepartmentId'))}
                  />
                </Field>
                <Field
                  label="New manager"
                  hint={`Current: ${employee.manager?.fullName ?? 'None'}`}
                  error={showError('newManagerId')}
                >
                  <OptionSelect
                    value={form.newManagerId}
                    options={lookups.managers}
                    placeholder="Keep current manager"
                    onChange={(v) => update('newManagerId', v)}
                    invalid={Boolean(showError('newManagerId'))}
                  />
                </Field>
                <Field
                  label="New cost centre"
                  hint={`Current: ${
                    employee.costCentre ? `${employee.costCentre.code} — ${employee.costCentre.name}` : 'None'
                  }`}
                  error={showError('newCostCentreId')}
                >
                  <OptionSelect
                    value={form.newCostCentreId}
                    options={lookups.costCentres}
                    placeholder="Keep current cost centre"
                    onChange={(v) => update('newCostCentreId', v)}
                    invalid={Boolean(showError('newCostCentreId'))}
                  />
                </Field>
              </>
            ) : null}

            {kind === 'salary_revision' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Current salary *"
                    hint={lookups.lastSalary ? 'From the last recorded revision' : undefined}
                    error={showError('previousAmount')}
                  >
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={form.previousAmount}
                      onChange={(e) => update('previousAmount', e.target.value)}
                      onBlur={() => touch('previousAmount')}
                      aria-invalid={Boolean(showError('previousAmount'))}
                    />
                  </Field>
                  <Field label="New salary *" error={showError('newAmount')}>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={form.newAmount}
                      onChange={(e) => update('newAmount', e.target.value)}
                      onBlur={() => touch('newAmount')}
                      aria-invalid={Boolean(showError('newAmount'))}
                    />
                  </Field>
                </div>
                <SalaryDelta previous={form.previousAmount} next={form.newAmount} currency={form.currency} />
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Currency *" error={showError('currency')}>
                    <Input
                      value={form.currency}
                      maxLength={3}
                      onChange={(e) => update('currency', e.target.value.toUpperCase())}
                      onBlur={() => touch('currency')}
                      aria-invalid={Boolean(showError('currency'))}
                    />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Reason">
                      <Input
                        value={form.reason}
                        placeholder="e.g. Annual review"
                        onChange={(e) => update('reason', e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              </>
            ) : null}

            {kind === 'probation' ? (
              <Field
                label="New probation end date *"
                hint={`Current: ${employee.probationEndDate ?? 'Not set'}`}
                error={showError('newProbationEndDate')}
              >
                <Input
                  type="date"
                  value={form.newProbationEndDate}
                  onChange={(e) => update('newProbationEndDate', e.target.value)}
                  onBlur={() => touch('newProbationEndDate')}
                  aria-invalid={Boolean(showError('newProbationEndDate'))}
                />
              </Field>
            ) : null}

            {kind === 'confirmation' ? (
              <Field
                label="Confirmation date"
                hint="Defaults to the effective date"
                error={showError('confirmationDate')}
              >
                <Input
                  type="date"
                  value={form.confirmationDate}
                  onChange={(e) => update('confirmationDate', e.target.value)}
                />
              </Field>
            ) : null}

            {kind === 'suspension' ? (
              <>
                <Field label="Reason *" error={showError('reason')}>
                  <Textarea
                    rows={3}
                    value={form.reason}
                    onChange={(e) => update('reason', e.target.value)}
                    onBlur={() => touch('reason')}
                    aria-invalid={Boolean(showError('reason'))}
                  />
                </Field>
                <Field
                  label="Suspension end date"
                  hint="Leave blank if open-ended"
                  error={showError('suspensionEndDate')}
                >
                  <Input
                    type="date"
                    value={form.suspensionEndDate}
                    onChange={(e) => update('suspensionEndDate', e.target.value)}
                    onBlur={() => touch('suspensionEndDate')}
                    aria-invalid={Boolean(showError('suspensionEndDate'))}
                  />
                </Field>
              </>
            ) : null}

            {kind === 'exit' ? (
              <>
                <Field
                  label={form.exitType === 'termination' ? 'Reason *' : 'Reason'}
                  error={showError('reason')}
                >
                  <Textarea
                    rows={3}
                    value={form.reason}
                    onChange={(e) => update('reason', e.target.value)}
                    onBlur={() => touch('reason')}
                    aria-invalid={Boolean(showError('reason'))}
                  />
                </Field>
                <Field
                  label="Last working date"
                  hint="Defaults to the effective date"
                  error={showError('lastWorkingDate')}
                >
                  <Input
                    type="date"
                    value={form.lastWorkingDate}
                    onChange={(e) => update('lastWorkingDate', e.target.value)}
                    onBlur={() => touch('lastWorkingDate')}
                    aria-invalid={Boolean(showError('lastWorkingDate'))}
                  />
                </Field>
              </>
            ) : null}

            {kind === 'rehire' ? (
              <>
                <Field label="New hire date" hint="Defaults to the original hire date" error={showError('newHireDate')}>
                  <Input
                    type="date"
                    value={form.newHireDate}
                    onChange={(e) => update('newHireDate', e.target.value)}
                  />
                </Field>
                <Field label="Department">
                  <OptionSelect
                    value={form.newDepartmentId}
                    options={lookups.departments}
                    placeholder="Keep previous department"
                    onChange={(v) => update('newDepartmentId', v)}
                  />
                </Field>
                <Field label="Designation">
                  <OptionSelect
                    value={form.newDesignationId}
                    options={lookups.designations}
                    placeholder="Keep previous designation"
                    onChange={(v) => update('newDesignationId', v)}
                  />
                </Field>
              </>
            ) : null}

            <Field label="Notes">
              <Textarea
                rows={2}
                value={form.notes}
                placeholder="Visible in the employee’s lifecycle history"
                onChange={(e) => update('notes', e.target.value)}
              />
            </Field>
          </>
        )}
      </div>
    </SidePanel>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {error ? (
        <FieldError message={error} />
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function OptionSelect({
  value,
  options,
  placeholder,
  onChange,
  onBlur,
  invalid,
}: {
  value: string;
  options: Option[];
  placeholder: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
}) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      aria-invalid={invalid}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </Select>
  );
}

function Notice({
  tone,
  icon,
  children,
}: {
  tone: 'warning' | 'error';
  icon: ReactNode;
  children: ReactNode;
}) {
  const classes =
    tone === 'error'
      ? 'text-error-700 bg-error-50 dark:bg-error-950/30 border-error-200 dark:border-error-800'
      : 'text-warning-800 bg-warning-50 dark:bg-warning-950/30 border-warning-200 dark:border-warning-800';
  return (
    <div className={`flex items-start gap-2 text-sm border rounded-lg px-3 py-2.5 ${classes}`}>
      <span className="shrink-0 mt-0.5">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function SalaryDelta({
  previous,
  next,
  currency,
}: {
  previous: string;
  next: string;
  currency: string;
}) {
  const prev = Number(previous);
  const nxt = Number(next);
  if (!previous || !next || !Number.isFinite(prev) || !Number.isFinite(nxt) || prev <= 0) {
    return null;
  }
  const diff = nxt - prev;
  const pct = (diff / prev) * 100;
  const tone = diff >= 0 ? 'text-success-700 dark:text-success-400' : 'text-error-600';
  return (
    <p className={`text-xs font-medium -mt-2 ${tone}`}>
      {diff >= 0 ? '+' : '−'}
      {formatAmount(Math.abs(diff), /^[A-Z]{3}$/.test(currency) ? currency : 'AUD')} (
      {diff >= 0 ? '+' : '−'}
      {Math.abs(pct).toFixed(1)}%)
    </p>
  );
}

interface SummaryRow {
  label: string;
  from?: string;
  to: string;
}

/** Review rows for actions that require confirmation (suspension, resignation, termination). */
function buildSummary(
  kind: LifecycleActionKind,
  form: LifecycleFormState,
  employee: EmployeeRecord,
): SummaryRow[] {
  const rows: SummaryRow[] = [{ label: 'Effective date', to: form.effectiveDate }];
  const currentStatus = statusText(employee.employmentStatus);
  if (kind === 'suspension') {
    rows.push({ label: 'Status', from: currentStatus, to: 'Inactive' });
    rows.push({ label: 'Reason', to: form.reason || '—' });
    rows.push({ label: 'Suspended until', to: form.suspensionEndDate || 'Open-ended' });
  } else if (kind === 'exit') {
    rows.push({
      label: 'Exit type',
      to: form.exitType === 'termination' ? 'Termination' : 'Resignation',
    });
    rows.push({ label: 'Status', from: currentStatus, to: 'Terminated' });
    rows.push({ label: 'Last working date', to: form.lastWorkingDate || form.effectiveDate });
    rows.push({ label: 'Reason', to: form.reason || '—' });
  }
  return rows;
}

function statusText(status: EmployeeRecord['employmentStatus']): string {
  return { active: 'Active', on_leave: 'On leave', inactive: 'Inactive', terminated: 'Terminated' }[status];
}

function ReviewStep({
  eventType,
  rows,
  form,
}: {
  eventType: string | null;
  rows: SummaryRow[];
  form: LifecycleFormState;
}) {
  const impact =
    eventType === 'suspension'
      ? 'The employee’s status will change to Inactive until they are reinstated.'
      : 'The employee’s status will change to Terminated and an offboarding checklist will be started automatically. This is recorded in the audit log and cannot be undone from this screen.';

  return (
    <div className="space-y-4">
      <Notice tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
        {impact}
      </Notice>
      <dl className="rounded-lg border border-base divide-y divide-[rgb(var(--border-base))]">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4 px-3 py-2.5">
            <dt className="text-xs text-muted pt-0.5">{row.label}</dt>
            <dd className="text-sm text-primary text-right flex items-center gap-1.5 flex-wrap justify-end">
              {row.from ? (
                <>
                  <span className="text-secondary">{row.from}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted" />
                </>
              ) : null}
              <span className="font-medium">{row.to}</span>
            </dd>
          </div>
        ))}
      </dl>
      {form.notes ? (
        <p className="text-xs text-secondary">
          <span className="text-muted">Notes:</span> {form.notes}
        </p>
      ) : null}
    </div>
  );
}
