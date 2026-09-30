import type { ReactNode } from 'react';
import { ArrowUp, Plus, X } from 'lucide-react';
import type { LeaveAccrualType, YearlyAccrualAnchor } from '@hrm/shared-types';
import { FieldError } from '@/components/ui/FieldError';
import { Input, Label, Select } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';
import {
  MAX_APPROVAL_STEPS,
  REPORTING_LINE_APPROVERS,
  formatDays,
  type LeavePolicyFormValues,
} from '@/lib/leave-policy';

export interface LeavePolicyFieldsProps {
  values: LeavePolicyFormValues;
  setField: <K extends keyof LeavePolicyFormValues>(key: K, value: LeavePolicyFormValues[K]) => void;
  touch: (key: keyof LeavePolicyFormValues) => void;
  showError: (key: keyof LeavePolicyFormValues) => string | undefined;
  /** Tenant role names offered as approvers, alongside the reporting-line approvers. */
  roleNames: string[];
  /** Unpaid types rarely need an entitlement; the hint changes accordingly. */
  isPaid: boolean;
}

export function PolicySection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        {description ? <p className="text-xs text-muted mt-0.5">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onChange,
  children,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-base px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary">{label}</p>
          <p className="text-xs text-muted mt-0.5">{description}</p>
        </div>
        <Toggle checked={checked} onChange={onChange} label={label} />
      </div>
      {checked && children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

export function LeavePolicyFields({
  values,
  setField,
  touch,
  showError,
  roleNames,
  isPaid,
}: LeavePolicyFieldsProps) {
  const entitlement = Number(values.entitlementDays);
  const approverOptions = [
    ...REPORTING_LINE_APPROVERS,
    ...roleNames
      .filter((name) => !REPORTING_LINE_APPROVERS.some((a) => a.value === name))
      .map((name) => ({ value: name, label: name })),
  ];

  const updateStep = (index: number, roleName: string) =>
    setField(
      'approvalSteps',
      values.approvalSteps.map((s, i) => (i === index ? roleName : s)),
    );
  const removeStep = (index: number) =>
    setField(
      'approvalSteps',
      values.approvalSteps.filter((_, i) => i !== index),
    );
  const moveStepUp = (index: number) => {
    const next = [...values.approvalSteps];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setField('approvalSteps', next);
  };
  const addStep = () => {
    const unused = approverOptions.find((o) => !values.approvalSteps.includes(o.value));
    setField('approvalSteps', [...values.approvalSteps, unused?.value ?? '']);
  };

  return (
    <div className="space-y-7">
      <PolicySection
        title="Entitlement & accrual"
        description="How many days employees earn each leave year and when they are credited."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="policy-entitlement">Entitlement (days per year) *</Label>
            <Input
              id="policy-entitlement"
              inputMode="decimal"
              value={values.entitlementDays}
              onChange={(e) => setField('entitlementDays', e.target.value)}
              onBlur={() => touch('entitlementDays')}
              aria-invalid={Boolean(showError('entitlementDays'))}
            />
            {showError('entitlementDays') ? (
              <FieldError message={showError('entitlementDays')} />
            ) : (
              <p className="mt-1 text-xs text-muted">
                {isPaid ? 'e.g. 20' : 'Use 0 if unpaid leave is not capped.'}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="policy-accrual">Accrual</Label>
            <Select
              id="policy-accrual"
              value={values.accrualType}
              onChange={(e) => setField('accrualType', e.target.value as LeaveAccrualType)}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="on_hire">In full on hire</option>
            </Select>
            <p className="mt-1 text-xs text-muted">
              {values.accrualType === 'monthly'
                ? Number.isFinite(entitlement) && entitlement > 0
                  ? `${formatDays(entitlement / 12)} credited each month, capped at the entitlement.`
                  : 'Entitlement ÷ 12 credited each month.'
                : values.accrualType === 'yearly'
                  ? 'Full entitlement credited once a year.'
                  : 'Full entitlement credited when the employee joins.'}
            </p>
          </div>
          {values.accrualType === 'yearly' ? (
            <div className="sm:col-span-2">
              <Label htmlFor="policy-anchor">Credit on</Label>
              <Select
                id="policy-anchor"
                value={values.yearlyAccrualAnchor}
                onChange={(e) =>
                  setField('yearlyAccrualAnchor', e.target.value as YearlyAccrualAnchor)
                }
              >
                <option value="financial_year">Financial year start</option>
                <option value="hire_anniversary">Each employee's hire anniversary</option>
              </Select>
            </div>
          ) : null}
        </div>
      </PolicySection>

      <PolicySection
        title="Carry-forward & expiry"
        description="Unused days rolled into the next leave year at year-end. Carried days are used first."
      >
        <SwitchRow
          label="Allow carry-forward"
          description="Otherwise unused balance lapses at year-end."
          checked={values.carryForwardEnabled}
          onChange={(v) => setField('carryForwardEnabled', v)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="policy-carry-max">Maximum days carried *</Label>
              <Input
                id="policy-carry-max"
                inputMode="decimal"
                value={values.carryForwardMax}
                onChange={(e) => setField('carryForwardMax', e.target.value)}
                onBlur={() => touch('carryForwardMax')}
                aria-invalid={Boolean(showError('carryForwardMax'))}
              />
              <FieldError message={showError('carryForwardMax')} />
            </div>
            <div>
              <Label htmlFor="policy-expiry">Carried days expire after (months)</Label>
              <Input
                id="policy-expiry"
                inputMode="numeric"
                value={values.expiryMonths}
                placeholder="Never"
                onChange={(e) => setField('expiryMonths', e.target.value)}
                onBlur={() => touch('expiryMonths')}
                aria-invalid={Boolean(showError('expiryMonths'))}
              />
              {showError('expiryMonths') ? (
                <FieldError message={showError('expiryMonths')} />
              ) : (
                <p className="mt-1 text-xs text-muted">Leave blank if carried days never expire.</p>
              )}
            </div>
          </div>
        </SwitchRow>
        <SwitchRow
          label="Allow encashment"
          description="Unused balance can be paid out through payroll at year-end or exit."
          checked={values.encashmentAllowed}
          onChange={(v) => setField('encashmentAllowed', v)}
        />
      </PolicySection>

      <PolicySection title="Request rules">
        <SwitchRow
          label="Allow half-day requests"
          description="Half days deduct 0.5 from the balance."
          checked={values.halfDayAllowed}
          onChange={(v) => setField('halfDayAllowed', v)}
        />
        <SwitchRow
          label="Block during probation"
          description="Employees cannot apply for this leave until probation ends."
          checked={values.probationRestricted}
          onChange={(v) => setField('probationRestricted', v)}
        />
        <SwitchRow
          label="Allow negative balance"
          description="Employees may request beyond their balance; approvers see a warning."
          checked={values.allowNegativeBalance}
          onChange={(v) => setField('allowNegativeBalance', v)}
        >
          <div className="sm:w-1/2">
            <Label htmlFor="policy-negative-cap">Maximum negative days</Label>
            <Input
              id="policy-negative-cap"
              inputMode="decimal"
              value={values.negativeBalanceCap}
              placeholder="No cap"
              onChange={(e) => setField('negativeBalanceCap', e.target.value)}
              onBlur={() => touch('negativeBalanceCap')}
              aria-invalid={Boolean(showError('negativeBalanceCap'))}
            />
            <FieldError message={showError('negativeBalanceCap')} />
          </div>
        </SwitchRow>
        <SwitchRow
          label="Count public holidays as leave"
          description="When off, public holidays inside a leave range are not deducted."
          checked={values.deductPublicHolidays}
          onChange={(v) => setField('deductPublicHolidays', v)}
        />
      </PolicySection>

      <PolicySection
        title="Approval chain"
        description="Requests move through these steps in order. Manager steps follow the requester's reporting line."
      >
        <ol className="space-y-2">
          {values.approvalSteps.map((step, index) => {
            const options = approverOptions.some((o) => o.value === step) || !step
              ? approverOptions
              : [...approverOptions, { value: step, label: step }];
            return (
              <li key={index} className="flex items-center gap-2">
                <span className="h-6 w-6 shrink-0 rounded-full bg-[rgb(var(--bg-muted))] text-xs font-semibold text-secondary flex items-center justify-center">
                  {index + 1}
                </span>
                <Select
                  aria-label={`Approval step ${index + 1}`}
                  value={step}
                  onChange={(e) => updateStep(index, e.target.value)}
                  className="flex-1"
                >
                  {!step ? <option value="">Choose approver…</option> : null}
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  onClick={() => moveStepUp(index)}
                  disabled={index === 0}
                  aria-label={`Move step ${index + 1} up`}
                  className="p-1.5 rounded text-muted hover:text-primary hover:bg-[rgb(var(--bg-hover))] disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeStep(index)}
                  disabled={values.approvalSteps.length <= 1}
                  aria-label={`Remove step ${index + 1}`}
                  className="p-1.5 rounded text-muted hover:text-error-600 hover:bg-[rgb(var(--bg-hover))] disabled:opacity-30 disabled:pointer-events-none"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ol>
        {values.approvalSteps.length < MAX_APPROVAL_STEPS ? (
          <button
            type="button"
            onClick={addStep}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-600 hover:text-accent-700"
          >
            <Plus className="h-3.5 w-3.5" /> Add step
          </button>
        ) : null}
        <FieldError message={showError('approvalSteps')} />
      </PolicySection>

      <PolicySection
        title="Effective period"
        description="Balances and requests use the version in effect on the relevant date."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="policy-from">Effective from *</Label>
            <Input
              id="policy-from"
              type="date"
              value={values.effectiveFrom}
              onChange={(e) => setField('effectiveFrom', e.target.value)}
              onBlur={() => touch('effectiveFrom')}
              aria-invalid={Boolean(showError('effectiveFrom'))}
            />
            <FieldError message={showError('effectiveFrom')} />
          </div>
          <div>
            <Label htmlFor="policy-to">Effective to</Label>
            <Input
              id="policy-to"
              type="date"
              value={values.effectiveTo}
              min={values.effectiveFrom || undefined}
              onChange={(e) => setField('effectiveTo', e.target.value)}
              onBlur={() => touch('effectiveTo')}
              aria-invalid={Boolean(showError('effectiveTo'))}
            />
            {showError('effectiveTo') ? (
              <FieldError message={showError('effectiveTo')} />
            ) : (
              <p className="mt-1 text-xs text-muted">Leave blank to keep it open-ended.</p>
            )}
          </div>
        </div>
      </PolicySection>
    </div>
  );
}
