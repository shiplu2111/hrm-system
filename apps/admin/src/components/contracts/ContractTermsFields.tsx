import { useId, type ReactNode } from 'react';
import type { EmploymentContractType, PayFrequency } from '@hrm/shared-types';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { FieldError } from '@/components/ui/FieldError';
import { CONTRACT_TYPE_LABELS, PAY_FREQUENCY_LABELS } from '@/lib/contracts-api';
import {
  OVERTIME_TYPE_LABELS,
  type ContractTermsErrors,
  type ContractTermsForm,
  type OvertimeType,
} from '@/lib/contract-form';

interface Props {
  value: ContractTermsForm;
  onChange: (next: ContractTermsForm) => void;
  /** Shown only after the user tries to submit. */
  errors?: ContractTermsErrors;
  disabled?: boolean;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">{title}</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </fieldset>
  );
}

export function ContractTermsFields({ value, onChange, errors = {}, disabled = false }: Props) {
  const id = useId();
  const set = <K extends keyof ContractTermsForm>(key: K, next: ContractTermsForm[K]) =>
    onChange({ ...value, [key]: next });
  const field = (key: keyof ContractTermsForm) => ({
    id: `${id}-${key}`,
    disabled,
    'aria-invalid': errors[key] ? true : undefined,
  });

  return (
    <div className="space-y-6">
      <Section title="Contract basics">
        <div>
          <Label htmlFor={`${id}-contractType`}>Contract type</Label>
          <Select
            {...field('contractType')}
            value={value.contractType}
            onChange={(e) => set('contractType', e.target.value as EmploymentContractType)}
          >
            {Object.entries(CONTRACT_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`${id}-workingHoursPerWeek`}>Working hours per week</Label>
          <Input
            {...field('workingHoursPerWeek')}
            type="number"
            min={0}
            step="0.5"
            value={value.workingHoursPerWeek}
            onChange={(e) => set('workingHoursPerWeek', e.target.value)}
          />
          <FieldError message={errors.workingHoursPerWeek} />
        </div>
        <div>
          <Label htmlFor={`${id}-startDate`}>Start date</Label>
          <Input
            {...field('startDate')}
            type="date"
            value={value.startDate}
            onChange={(e) => set('startDate', e.target.value)}
          />
          <FieldError message={errors.startDate} />
        </div>
        <div>
          <Label htmlFor={`${id}-endDate`}>
            End date{value.contractType === 'fixed_term' ? '' : ' (optional)'}
          </Label>
          <Input
            {...field('endDate')}
            type="date"
            min={value.startDate || undefined}
            value={value.endDate}
            onChange={(e) => set('endDate', e.target.value)}
          />
          <FieldError message={errors.endDate} />
        </div>
        <div>
          <Label htmlFor={`${id}-probationEndDate`}>Probation ends (optional)</Label>
          <Input
            {...field('probationEndDate')}
            type="date"
            min={value.startDate || undefined}
            value={value.probationEndDate}
            onChange={(e) => set('probationEndDate', e.target.value)}
          />
          <FieldError message={errors.probationEndDate} />
        </div>
      </Section>

      <Section title="Pay">
        <div>
          <Label htmlFor={`${id}-payRate`}>Pay rate</Label>
          <Input
            {...field('payRate')}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder="e.g. 85000"
            value={value.payRate}
            onChange={(e) => set('payRate', e.target.value)}
          />
          <FieldError message={errors.payRate} />
        </div>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <div>
            <Label htmlFor={`${id}-payFrequency`}>Paid</Label>
            <Select
              {...field('payFrequency')}
              value={value.payFrequency}
              onChange={(e) => set('payFrequency', e.target.value as PayFrequency | '')}
            >
              <option value="">Not set</option>
              {Object.entries(PAY_FREQUENCY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
            <FieldError message={errors.payFrequency} />
          </div>
          <div>
            <Label htmlFor={`${id}-currency`}>Currency</Label>
            <Input
              {...field('currency')}
              maxLength={3}
              className="uppercase"
              value={value.currency}
              onChange={(e) => set('currency', e.target.value.toUpperCase())}
            />
            <FieldError message={errors.currency} />
          </div>
        </div>
      </Section>

      <Section title="Leave & overtime">
        <div>
          <Label htmlFor={`${id}-leaveEntitlementDays`}>Annual leave (days per year)</Label>
          <Input
            {...field('leaveEntitlementDays')}
            type="number"
            min={0}
            step="0.5"
            value={value.leaveEntitlementDays}
            onChange={(e) => set('leaveEntitlementDays', e.target.value)}
          />
          <FieldError message={errors.leaveEntitlementDays} />
        </div>
        <div>
          <Label htmlFor={`${id}-overtimeType`}>Overtime</Label>
          <Select
            {...field('overtimeType')}
            value={value.overtimeType}
            onChange={(e) => set('overtimeType', e.target.value as OvertimeType)}
          >
            {Object.entries(OVERTIME_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        {value.overtimeType !== 'none' ? (
          <>
            <div>
              <Label htmlFor={`${id}-overtimeThreshold`}>
                Overtime starts after (hours per {value.overtimeType === 'multiplier_after_daily_hours' ? 'day' : 'week'})
              </Label>
              <Input
                {...field('overtimeThreshold')}
                type="number"
                min={0}
                step="0.5"
                value={value.overtimeThreshold}
                onChange={(e) => set('overtimeThreshold', e.target.value)}
              />
              <FieldError message={errors.overtimeThreshold} />
            </div>
            <div>
              <Label htmlFor={`${id}-overtimeMultiplier`}>Overtime rate (× base pay)</Label>
              <Input
                {...field('overtimeMultiplier')}
                type="number"
                min={1}
                step="0.25"
                value={value.overtimeMultiplier}
                onChange={(e) => set('overtimeMultiplier', e.target.value)}
              />
              <FieldError message={errors.overtimeMultiplier} />
            </div>
          </>
        ) : null}
      </Section>

      <Section title="Notice & termination">
        <div>
          <Label htmlFor={`${id}-noticePeriodDays`}>Notice from employee (days)</Label>
          <Input
            {...field('noticePeriodDays')}
            type="number"
            min={0}
            step={1}
            value={value.noticePeriodDays}
            onChange={(e) => set('noticePeriodDays', e.target.value)}
          />
          <FieldError message={errors.noticePeriodDays} />
        </div>
        <div>
          <Label htmlFor={`${id}-employerNoticeDays`}>Notice from employer (days)</Label>
          <Input
            {...field('employerNoticeDays')}
            type="number"
            min={0}
            step={1}
            value={value.employerNoticeDays}
            onChange={(e) => set('employerNoticeDays', e.target.value)}
          />
          <FieldError message={errors.employerNoticeDays} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={`${id}-terminationConditions`}>Termination conditions (optional)</Label>
          <Textarea
            {...field('terminationConditions')}
            rows={3}
            placeholder="When either party may end the contract, and what applies on termination…"
            value={value.terminationConditions}
            onChange={(e) => set('terminationConditions', e.target.value)}
          />
        </div>
      </Section>
    </div>
  );
}
